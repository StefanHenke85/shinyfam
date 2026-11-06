import 'dotenv/config'
import express from 'express'
import { createServer } from 'http'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'
import { randomBytes } from 'crypto'
import nodeFetch from 'node-fetch'
import https from 'https'
// node-fetch v3 löst zu IPv4 auf auf diesem IPv6-only Server → eigenen Agent mit IPv6 erzwingen
const ipv6Agent = new https.Agent({ family: 6 })
if (!globalThis.fetch) {
  globalThis.fetch = (url, opts = {}) => nodeFetch(url, { agent: /^https/i.test(url) ? ipv6Agent : undefined, ...opts })
}

const __dirname = dirname(fileURLToPath(import.meta.url))
const app = express()
app.use(express.json({ limit: '10mb' }))
app.use((req, res, next) => { if (req.headers['content-type'] && !req.headers['content-type'].includes('charset')) req.headers['content-type'] = req.headers['content-type'] + '; charset=utf-8'; next() })

const PORT = process.env.PORT || 3001

// WhatsApp-Benachrichtigungen ueber die lokale Baileys-Bridge (eigener
// PM2-Prozess auf Port 3102). Faellt still aus, wenn die Bridge nicht
// laeuft oder keine Zielnummer konfiguriert ist — E-Mail bleibt der
// verlaessliche Hauptkanal, WhatsApp ist ein zusaetzliches Ping.
const WA_BRIDGE_URL = process.env.WA_BRIDGE_URL || 'http://127.0.0.1:3102'
async function notifyWhatsApp(toNumber, text) {
  const to = String(toNumber || '').replace(/\D/g, '')
  if (!to) return

  // Die WhatsApp-Bridge (Baileys) trennt die Verbindung alle paar Minuten
  // kurz und baut sie automatisch neu auf. Trifft ein Sendeversuch genau
  // dieses Fenster, schlaegt er fehl -- daher ein automatischer zweiter
  // Versuch nach kurzer Verzoegerung, bevor endgueltig aufgegeben wird.
  const attempt = async () => {
    const res = await nodeFetch(`${WA_BRIDGE_URL}/send`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ to, text }),
    })
    if (!res.ok) {
      const body = await res.text().catch(() => '')
      throw new Error(`Bridge-Fehler ${res.status}: ${body}`)
    }
  }

  try {
    await attempt()
  } catch (e) {
    console.error('[whatsapp-notify] erster Versuch fehlgeschlagen, erneuter Versuch in 8s:', e?.message || e)
    await new Promise((resolve) => setTimeout(resolve, 8000))
    try {
      await attempt()
    } catch (e2) {
      console.error('[whatsapp-notify] auch zweiter Versuch fehlgeschlagen:', e2?.message || e2)
    }
  }
}

// Turso HTTP API — direkte Verbindung (Server hat normale IPv4-Anbindung,
// der frühere Cloudflare-Worker-Umweg für IPv6-only-Hosts wird nicht mehr gebraucht)
const TURSO_URL = (process.env.TURSO_DATABASE_URL || '').replace(/^libsql:\/\//, 'https://')

async function dbExecute(sql, args = []) {
  const url = TURSO_URL + '/v2/pipeline'
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${process.env.TURSO_AUTH_TOKEN}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      requests: [{ type: 'execute', stmt: { sql, args: args.map(v => v === null ? { type: 'null' } : typeof v === 'number' ? { type: 'float', value: v } : { type: 'text', value: String(v) }) } }, { type: 'close' }]
    })
  })
  const data = await res.json()
  if (data.results?.[0]?.type === 'error') throw new Error(data.results[0].error.message)
  const result = data.results?.[0]?.response?.result
  if (!result) return { rows: [] }
  const cols = result.cols.map(c => c.name)
  const rows = result.rows.map(row => {
    const obj = {}
    row.forEach((val, i) => { obj[cols[i]] = val?.value ?? null })
    return obj
  })
  return { rows }
}

async function getInvoiceSellerInfo() {
  const r = await dbExecute('SELECT key, value FROM settings')
  const s = {}
  for (const row of r.rows) s[row.key] = row.value
  return {
    name: s.invoice_seller_name || 'ShinyFam · Heike Karg',
    address: s.invoice_seller_address || 'Bönninghardter Straße 72, 46519 Alpen',
    taxNumber: s.invoice_seller_tax_number || '',
  }
}

async function nextInvoiceNumber() {
  const year = new Date().getFullYear()
  const r = await dbExecute(
    "SELECT invoice_number FROM invoices WHERE invoice_number LIKE ? ORDER BY id DESC LIMIT 1",
    [`RE-${year}-%`]
  )
  const last = r.rows[0]?.invoice_number
  const lastSeq = last ? parseInt(last.split('-')[2], 10) : 0
  const seq = (Number.isFinite(lastSeq) ? lastSeq : 0) + 1
  return `RE-${year}-${String(seq).padStart(4, '0')}`
}

function resolvePricePerMeterDay(inquiry, event) {
  const tiers = event?.price_tiers ? JSON.parse(event.price_tiers) : null
  if (tiers && tiers.length > 0) {
    if (inquiry.price_tier) {
      const match = tiers.find(t => t.label === inquiry.price_tier)
      if (match) return { price: Number(match.pricePerMeterDay), tierLabel: match.label }
    }
    return { price: null, tierLabel: null }
  }
  return { price: event?.price_per_meter_day != null ? Number(event.price_per_meter_day) : null, tierLabel: null }
}

function computeInvoiceItems(inquiry, event) {
  const { price: pricePerMeterDay, tierLabel } = resolvePricePerMeterDay(inquiry, event)
  const meters = inquiry.meters_num != null ? Number(inquiry.meters_num) : null
  const days = inquiry.days_count != null ? Number(inquiry.days_count) : 1
  const items = []
  const tierSuffix = tierLabel ? `, ${tierLabel}` : ''
  if (pricePerMeterDay != null && meters != null) {
    items.push({
      description: `Standgebühr${inquiry.event_name ? ' – ' + inquiry.event_name : ''} (${meters} m × ${days} Tag${days > 1 ? 'e' : ''}${tierSuffix})`,
      quantity: meters * days,
      unit: 'm/Tag',
      unitPrice: pricePerMeterDay,
      total: Math.round(pricePerMeterDay * meters * days * 100) / 100,
    })
  } else {
    items.push({
      description: `Standgebühr${inquiry.event_name ? ' – ' + inquiry.event_name : ''}${inquiry.meters ? ' (' + inquiry.meters + ')' : ''}${tierSuffix}`,
      quantity: 1,
      unit: '',
      unitPrice: null,
      total: null,
    })
  }
  return items
}

async function buildInvoicePdf({ invoiceNumber, invoiceDate, seller, recipient, items, total }) {
  const { default: PDFDocument } = await import('pdfkit')
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ margin: 60, size: 'A4' })
    const chunks = []
    doc.on('data', c => chunks.push(c))
    doc.on('end', () => resolve(Buffer.concat(chunks)))
    doc.on('error', reject)

    doc.rect(0, 0, doc.page.width, 8).fill('#7c3aed')
    doc.moveDown(0.5)
    doc.fontSize(22).fillColor('#7c3aed').font('Helvetica-Bold').text('ShinyFam', 60, 30)
    doc.fontSize(10).fillColor('#888').font('Helvetica').text('TCG Community am Niederrhein · info@shinyfam.de · shinyfam.de', 60, 56)
    doc.moveTo(60, 76).lineTo(doc.page.width - 60, 76).strokeColor('#e0d6ff').lineWidth(1).stroke()

    doc.fontSize(20).fillColor('#1a1a2e').font('Helvetica-Bold').text('Rechnung', 60, 100)
    doc.fontSize(10).fillColor('#4a5070').font('Helvetica')
    doc.text(`Rechnungsnummer: ${invoiceNumber}`, 60, 128)
    doc.text(`Rechnungsdatum: ${invoiceDate}`, 60, 142)

    doc.fontSize(9).fillColor('#8a90a8').text('VON', 60, 170)
    doc.fontSize(10).fillColor('#1a1a2e').font('Helvetica-Bold').text(seller.name, 60, 184)
    doc.fontSize(10).fillColor('#4a5070').font('Helvetica').text(seller.address, 60, 198)
    if (seller.taxNumber) doc.text(`Steuernummer: ${seller.taxNumber}`, 60, 212)

    const recipientY = 170
    doc.fontSize(9).fillColor('#8a90a8').text('AN', 320, recipientY)
    doc.fontSize(10).fillColor('#1a1a2e').font('Helvetica-Bold').text(recipient.company || recipient.name, 320, recipientY + 14)
    doc.fontSize(10).fillColor('#4a5070').font('Helvetica')
    let ry = recipientY + 28
    if (recipient.company) { doc.text(recipient.name, 320, ry); ry += 14 }
    if (recipient.street) { doc.text(recipient.street, 320, ry); ry += 14 }
    if (recipient.zipCity) { doc.text(recipient.zipCity, 320, ry); ry += 14 }

    let y = 270
    doc.moveTo(60, y).lineTo(doc.page.width - 60, y).strokeColor('#e0d6ff').lineWidth(1).stroke()
    y += 12
    doc.fontSize(9).fillColor('#8a90a8').font('Helvetica-Bold')
    doc.text('Beschreibung', 60, y, { width: 280 })
    doc.text('Menge', 340, y, { width: 60, align: 'right' })
    doc.text('Einzelpreis', 400, y, { width: 70, align: 'right' })
    doc.text('Gesamt', 475, y, { width: 75, align: 'right' })
    y += 16
    doc.moveTo(60, y).lineTo(doc.page.width - 60, y).strokeColor('#e0d6ff').lineWidth(1).stroke()
    y += 10

    doc.font('Helvetica').fillColor('#1a1a2e')
    for (const item of items) {
      const rowHeight = 18
      doc.fontSize(10).text(item.description, 60, y, { width: 280 })
      doc.text(item.quantity != null ? `${item.quantity} ${item.unit || ''}`.trim() : '–', 340, y, { width: 60, align: 'right' })
      doc.text(item.unitPrice != null ? `${item.unitPrice.toFixed(2)} €` : '–', 400, y, { width: 70, align: 'right' })
      doc.text(item.total != null ? `${item.total.toFixed(2)} €` : 'nach Absprache', 475, y, { width: 75, align: 'right' })
      y += rowHeight
    }
    y += 6
    doc.moveTo(340, y).lineTo(doc.page.width - 60, y).strokeColor('#e0d6ff').lineWidth(1).stroke()
    y += 10
    doc.fontSize(11).font('Helvetica-Bold')
    doc.text('Gesamtbetrag', 340, y, { width: 100, align: 'left' })
    doc.text(total != null ? `${total.toFixed(2)} €` : 'nach Absprache', 440, y, { width: 110, align: 'right' })
    y += 30

    doc.fontSize(9).fillColor('#4a5070').font('Helvetica')
    doc.text('Gemäß § 19 UStG wird keine Umsatzsteuer berechnet.', 60, y, { width: doc.page.width - 120 })
    y += 30

    doc.fontSize(9).fillColor('#aaa').text(`${seller.name} · ${seller.address} · info@shinyfam.de`, 60, doc.page.height - 80, { align: 'center', width: doc.page.width - 120 })

    doc.end()
  })
}

async function initDb() {
  await dbExecute(`CREATE TABLE IF NOT EXISTS events (id TEXT PRIMARY KEY, title TEXT NOT NULL, date TEXT NOT NULL, end_date TEXT, location TEXT NOT NULL, address TEXT NOT NULL, city TEXT NOT NULL, description TEXT NOT NULL, youtube_video_id TEXT, ticket_url TEXT, image_url TEXT, tags TEXT NOT NULL DEFAULT '[]', partners TEXT DEFAULT '[]', created_at TEXT DEFAULT (datetime('now')))`).catch(() => {})
  await dbExecute(`ALTER TABLE events ADD COLUMN partners TEXT DEFAULT '[]'`).catch(() => {})
  await dbExecute(`ALTER TABLE events ADD COLUMN is_active INTEGER DEFAULT 1`).catch(() => {})
  await dbExecute(`ALTER TABLE events ADD COLUMN entry_fee REAL DEFAULT NULL`).catch(() => {})
  await dbExecute(`ALTER TABLE events ADD COLUMN schedule TEXT DEFAULT NULL`).catch(() => {})
  await dbExecute(`ALTER TABLE events ADD COLUMN max_vendors INTEGER DEFAULT NULL`).catch(() => {})
  await dbExecute(`ALTER TABLE events ADD COLUMN price_per_meter_day REAL DEFAULT NULL`).catch(() => {})
  await dbExecute(`ALTER TABLE events ADD COLUMN price_tiers TEXT DEFAULT NULL`).catch(() => {})
  await dbExecute(`ALTER TABLE events ADD COLUMN require_day1_with_day2 INTEGER DEFAULT 0`).catch(() => {})
  // Welche Teilnahme-Optionen bei der Haendleranfrage pro Event wählbar sind,
  // als JSON-Array ("tag1","tag2","beide"). NULL = alle drei wie bisher
  // (Rueckwaertskompatibilitaet zu bereits bestehenden Events). Leeres Array
  // [] bedeutet: keine Anfrage moeglich (z.B. wegen Sold Out).
  await dbExecute(`ALTER TABLE events ADD COLUMN allowed_attendance_days TEXT DEFAULT NULL`).catch(() => {})
  // Overlay-Badge auf der Event-Karte, z.B. "SOLD OUT" oder "AUSVERKAUFT".
  await dbExecute(`ALTER TABLE events ADD COLUMN sold_out_label TEXT DEFAULT NULL`).catch(() => {})
  await dbExecute(`CREATE TABLE IF NOT EXISTS orders (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL, email TEXT NOT NULL, phone TEXT, motif TEXT NOT NULL, size TEXT, message TEXT, status TEXT DEFAULT 'new', created_at TEXT DEFAULT (datetime('now')))`).catch(() => {})
  await dbExecute(`CREATE TABLE IF NOT EXISTS products (id TEXT PRIMARY KEY, name TEXT NOT NULL, description TEXT, price REAL NOT NULL, stock INTEGER DEFAULT 1, image_url TEXT, is_featured INTEGER DEFAULT 0, is_active INTEGER DEFAULT 1, tags TEXT DEFAULT '[]', created_at TEXT DEFAULT (datetime('now')))`).catch(() => {})
  await dbExecute(`CREATE TABLE IF NOT EXISTS artworks (id TEXT PRIMARY KEY, title TEXT NOT NULL, description TEXT, image_url TEXT, tags TEXT DEFAULT '[]', sold INTEGER DEFAULT 0, is_active INTEGER DEFAULT 1, created_at TEXT DEFAULT (datetime('now')))`).catch(() => {})
  await dbExecute(`CREATE TABLE IF NOT EXISTS shop_orders (id INTEGER PRIMARY KEY AUTOINCREMENT, order_number TEXT UNIQUE NOT NULL, first_name TEXT NOT NULL, last_name TEXT NOT NULL, email TEXT NOT NULL, phone TEXT, street TEXT NOT NULL, zip TEXT NOT NULL, city TEXT NOT NULL, items TEXT NOT NULL, subtotal REAL NOT NULL, shipping REAL DEFAULT 4.99, total REAL NOT NULL, payment_method TEXT DEFAULT 'invoice', payment_status TEXT DEFAULT 'pending', order_status TEXT DEFAULT 'new', notes TEXT, created_at TEXT DEFAULT (datetime('now')))`).catch(() => {})
  await dbExecute(`CREATE TABLE IF NOT EXISTS admin_sessions (token TEXT PRIMARY KEY, created_at TEXT DEFAULT (datetime('now')))`).catch(() => {})
  await dbExecute(`CREATE TABLE IF NOT EXISTS youtube_videos (id TEXT PRIMARY KEY, title TEXT NOT NULL, sort_order INTEGER DEFAULT 0, created_at TEXT DEFAULT (datetime('now')))`).catch(() => {})
  await dbExecute(`ALTER TABLE youtube_videos ADD COLUMN url TEXT DEFAULT NULL`).catch(() => {})
  await dbExecute(`CREATE TABLE IF NOT EXISTS brands (id TEXT PRIMARY KEY, name TEXT NOT NULL, logo_url TEXT, website TEXT, sort_order INTEGER DEFAULT 0, created_at TEXT DEFAULT (datetime('now')))`).catch(() => {})
  await dbExecute(`CREATE TABLE IF NOT EXISTS settings (key TEXT PRIMARY KEY, value TEXT NOT NULL)`).catch(() => {})
  await dbExecute(`CREATE TABLE IF NOT EXISTS event_inquiries (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL, email TEXT NOT NULL, event_name TEXT NOT NULL, event_date TEXT, tcg TEXT, meters TEXT, message TEXT, status TEXT DEFAULT 'new', created_at TEXT DEFAULT (datetime('now')))`).catch(() => {})
  await dbExecute(`ALTER TABLE event_inquiries ADD COLUMN attendance_days TEXT DEFAULT NULL`).catch(() => {})
  await dbExecute(`ALTER TABLE event_inquiries ADD COLUMN logo_url TEXT DEFAULT NULL`).catch(() => {})
  await dbExecute(`ALTER TABLE event_inquiries ADD COLUMN company TEXT DEFAULT NULL`).catch(() => {})
  await dbExecute(`ALTER TABLE event_inquiries ADD COLUMN phone TEXT DEFAULT NULL`).catch(() => {})
  await dbExecute(`ALTER TABLE event_inquiries ADD COLUMN street TEXT DEFAULT NULL`).catch(() => {})
  await dbExecute(`ALTER TABLE event_inquiries ADD COLUMN zip_city TEXT DEFAULT NULL`).catch(() => {})
  await dbExecute(`ALTER TABLE event_inquiries ADD COLUMN archived INTEGER DEFAULT 0`).catch(() => {})
  await dbExecute(`ALTER TABLE event_inquiries ADD COLUMN meters_num REAL DEFAULT NULL`).catch(() => {})
  await dbExecute(`ALTER TABLE event_inquiries ADD COLUMN days_count REAL DEFAULT NULL`).catch(() => {})
  await dbExecute(`ALTER TABLE event_inquiries ADD COLUMN price_tier TEXT DEFAULT NULL`).catch(() => {})
  await dbExecute(`ALTER TABLE event_inquiries ADD COLUMN customer_type TEXT DEFAULT 'gewerblich'`).catch(() => {})
  await dbExecute(`CREATE TABLE IF NOT EXISTS invoices (id INTEGER PRIMARY KEY AUTOINCREMENT, invoice_number TEXT UNIQUE NOT NULL, invoice_date TEXT NOT NULL, inquiry_id INTEGER, event_name TEXT NOT NULL, event_date TEXT, recipient_company TEXT, recipient_name TEXT NOT NULL, recipient_street TEXT, recipient_zip_city TEXT, items TEXT NOT NULL, total REAL, status TEXT DEFAULT 'open', created_at TEXT DEFAULT (datetime('now')))`).catch(() => {})
  await dbExecute(`ALTER TABLE invoices ADD COLUMN status TEXT DEFAULT 'open'`).catch(() => {})
  await dbExecute(`CREATE TABLE IF NOT EXISTS analytics (id INTEGER PRIMARY KEY AUTOINCREMENT, path TEXT NOT NULL, referrer TEXT, ua TEXT, country TEXT, ts TEXT DEFAULT (datetime('now')))`).catch(() => {})
  await dbExecute(`CREATE INDEX IF NOT EXISTS analytics_ts ON analytics(ts)`).catch(() => {})
  await dbExecute(`CREATE INDEX IF NOT EXISTS analytics_path ON analytics(path)`).catch(() => {})
  await dbExecute(`CREATE TABLE IF NOT EXISTS mail_folders (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL, sort_order INTEGER DEFAULT 0, created_at TEXT DEFAULT (datetime('now')))`).catch(() => {})
  await dbExecute(`CREATE TABLE IF NOT EXISTS mail_folder_items (id INTEGER PRIMARY KEY AUTOINCREMENT, folder_id INTEGER NOT NULL, mail_uid TEXT NOT NULL, mail_subject TEXT, mail_from TEXT, mail_date TEXT, created_at TEXT DEFAULT (datetime('now')), UNIQUE(folder_id, mail_uid))`).catch(() => {})
  await dbExecute(`CREATE TABLE IF NOT EXISTS contacts (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL, email TEXT NOT NULL UNIQUE, phone TEXT, notes TEXT, tags TEXT DEFAULT '[]', subscribed INTEGER DEFAULT 1, source TEXT DEFAULT 'manual', created_at TEXT DEFAULT (datetime('now')))`).catch(() => {})
  await dbExecute(`CREATE TABLE IF NOT EXISTS newsletter_sends (id INTEGER PRIMARY KEY AUTOINCREMENT, subject TEXT NOT NULL, body TEXT NOT NULL, tags TEXT DEFAULT '[]', sent_count INTEGER DEFAULT 0, created_at TEXT DEFAULT (datetime('now')))`).catch(() => {})
  await dbExecute(`CREATE TABLE IF NOT EXISTS mail_templates (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL, type TEXT NOT NULL DEFAULT 'custom', subject TEXT NOT NULL, body TEXT NOT NULL, created_at TEXT DEFAULT (datetime('now')), updated_at TEXT DEFAULT (datetime('now')))`).catch(() => {})
}

async function isAdmin(auth) {
  if (!auth?.startsWith('Bearer ')) return false
  const r = await dbExecute('SELECT token FROM admin_sessions WHERE token = ?', [auth.slice(7)])
  return r.rows.length > 0
}

async function sendWebPush(subscription, payload) {
  const vapidPublic = process.env.VAPID_PUBLIC_KEY
  const vapidPrivate = process.env.VAPID_PRIVATE_KEY
  if (!vapidPublic || !vapidPrivate) throw new Error('VAPID keys not configured')

  // Try to use web-push package if installed
  try {
    const { default: webpush } = await import('web-push')
    webpush.setVapidDetails('mailto:info@shinyfam.de', vapidPublic, vapidPrivate)
    await webpush.sendNotification(subscription, payload)
    return
  } catch (e) {
    if (e.code !== 'ERR_MODULE_NOT_FOUND') {
      const err = new Error(e.message)
      err.statusCode = e.statusCode
      throw err
    }
  }
  throw new Error('web-push package not installed. Run: npm install web-push')
}

function generateOrderNumber() {
  const d = new Date().toISOString().slice(2, 10).replace(/-/g, '')
  const rand = Math.random().toString(36).slice(2, 6).toUpperCase()
  return `SF-${d}-${rand}`
}

// CORS
app.use((req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,PATCH,DELETE,OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type,Authorization')
  if (req.method === 'OPTIONS') return res.status(200).end()
  next()
})

// API Routes
app.all('/api/*splat', async (req, res) => {
  const path = req.path.replace(/^\/api/, '').replace(/\?.*$/, '')
  const method = req.method

  try {
    await initDb()

    if (path === '/health') return res.json({ ok: true })

    // Internal-Endpunkte fuer HenkeJarvis (Wohnzimmer-Server) -- nutzt die
    // hiesige, dauerhaft laufende ShinyFam-WhatsApp-Bridge als zuverlaessigen
    // Versandweg fuer Stefans eigene Benachrichtigungen (z.B. 'Fenster offen,
    // niemand zuhause'), unabhaengig vom Online-Zustand seines Laptops. Mit
    // eigenem Secret-Token abgesichert statt des vollen Admin-Logins, da es
    // nur fuer diesen einen Server-zu-Server-Zweck gedacht ist, nicht fuer
    // Menschen im Browser (Stefans Entscheidung, 2026-10-08).
    if (path === '/internal/notify-stefan' && method === 'POST') {
      const token = req.headers['x-internal-token']
      if (!process.env.INTERNAL_NOTIFY_TOKEN || token !== process.env.INTERNAL_NOTIFY_TOKEN) {
        return res.status(401).json({ error: 'Unauthorized' })
      }
      const { text } = req.body || {}
      if (!text) return res.status(400).json({ error: 'text erforderlich' })
      try {
        await notifyWhatsApp(process.env.WA_NOTIFY_ADMIN, text)
        return res.json({ ok: true })
      } catch (e) {
        return res.status(502).json({ error: String(e?.message || e) })
      }
    }

    // Lese-Gegenstueck zu /internal/notify-stefan: liefert Stefans "Notiz an
    // mich selbst"-Nachrichten (fuer HenkeJarvis' self_command_watcher.py,
    // der daraus Heizungs-Sprachbefehle erkennt), siehe /self-notes in
    // shinyfam-bridge.js fuer die eigentliche Quelle. Gleicher Token-Schutz.
    if (path === '/internal/self-notes' && method === 'GET') {
      const token = req.headers['x-internal-token']
      if (!process.env.INTERNAL_NOTIFY_TOKEN || token !== process.env.INTERNAL_NOTIFY_TOKEN) {
        return res.status(401).json({ error: 'Unauthorized' })
      }
      try {
        const since = req.query?.since || '0'
        const r = await fetch(`${WA_BRIDGE_URL}/self-notes?since=${encodeURIComponent(since)}`)
        if (!r.ok) throw new Error(`Bridge-Fehler ${r.status}`)
        const data = await r.json()
        return res.json(data)
      } catch (e) {
        return res.status(502).json({ error: String(e?.message || e) })
      }
    }

    // Analytics track — no auth, called from frontend
    if (path === '/analytics/track' && method === 'POST') {
      const { path: pg, referrer } = req.body
      if (pg && !pg.startsWith('/admin')) {
        const ua = (req.headers['user-agent'] || '').slice(0, 200)
        await dbExecute('INSERT INTO analytics (path, referrer, ua) VALUES (?,?,?)', [pg, referrer || null, ua])
      }
      return res.json({ ok: true })
    }

    if (path === '/analytics/stats' && method === 'GET') {
      if (!await isAdmin(req.headers.authorization)) return res.status(401).json({ error: 'Unauthorized' })
      const days = parseInt(req.query?.days || '30', 10)
      const since = new Date(Date.now() - days * 86400000).toISOString().slice(0, 19)
      const [total, byPage, byDay, byRef] = await Promise.all([
        dbExecute('SELECT COUNT(*) as c FROM analytics WHERE ts >= ?', [since]),
        dbExecute('SELECT path, COUNT(*) as c FROM analytics WHERE ts >= ? GROUP BY path ORDER BY c DESC LIMIT 10', [since]),
        dbExecute("SELECT substr(ts,1,10) as day, COUNT(*) as c FROM analytics WHERE ts >= ? GROUP BY day ORDER BY day ASC", [since]),
        dbExecute('SELECT referrer, COUNT(*) as c FROM analytics WHERE ts >= ? AND referrer IS NOT NULL AND referrer != \'\' GROUP BY referrer ORDER BY c DESC LIMIT 10', [since]),
      ])
      return res.json({
        total: total.rows[0]?.c || 0,
        byPage: byPage.rows,
        byDay: byDay.rows,
        byRef: byRef.rows,
      })
    }

    if (path === '/seo/check' && method === 'GET') {
      if (!await isAdmin(req.headers.authorization)) return res.status(401).json({ error: 'Unauthorized' })
      const base = 'https://shinyfam.de'
      const checks = []
      const t0 = Date.now()

      // Fetch homepage
      let html = ''
      let loadMs = 0
      try {
        const r = await fetch(base + '/', { signal: AbortSignal.timeout(8000) })
        loadMs = Date.now() - t0
        html = await r.text()
        checks.push({ id: 'https', label: 'HTTPS aktiv', ok: true, info: 'shinyfam.de läuft über HTTPS' })
        checks.push({ id: 'load', label: 'Ladezeit', ok: loadMs < 2000, info: `${loadMs}ms ${loadMs < 1000 ? '✓ Sehr gut' : loadMs < 2000 ? '✓ OK' : '⚠ Langsam (Ziel: < 2s)'}` })
      } catch {
        checks.push({ id: 'https', label: 'HTTPS aktiv', ok: false, info: 'Seite nicht erreichbar' })
      }

      // Meta checks
      checks.push({ id: 'title', label: 'Meta-Titel', ok: html.includes('<title>') && html.includes('ShinyFam'), info: html.match(/<title>([^<]+)<\/title>/)?.[1]?.slice(0,60) || 'Nicht gefunden' })
      checks.push({ id: 'desc', label: 'Meta-Description', ok: html.includes('name="description"'), info: html.match(/name="description"\s+content="([^"]+)"/)?.[1]?.slice(0,80) || 'Nicht gefunden' })
      checks.push({ id: 'canonical', label: 'Canonical URL', ok: html.includes('rel="canonical"'), info: html.match(/rel="canonical"\s+href="([^"]+)"/)?.[1] || 'Nicht gefunden' })
      checks.push({ id: 'og', label: 'Open Graph Tags', ok: html.includes('og:title') && html.includes('og:image'), info: html.includes('og:title') ? 'og:title, og:description, og:image vorhanden' : 'Fehlen' })
      checks.push({ id: 'schema', label: 'Schema.org Daten', ok: html.includes('application/ld+json'), info: html.includes('LocalBusiness') && html.includes('FAQPage') ? 'LocalBusiness + FAQPage vorhanden' : 'Unvollständig' })
      checks.push({ id: 'keywords', label: 'Keywords TCG Dülmen/Wesel', ok: html.includes('TCG D') && html.includes('TCG Wesel'), info: html.includes('TCG Dülmen') ? 'TCG Dülmen, TCG Wesel vorhanden' : 'Fehlen in Meta-Keywords' })

      // Sitemap
      try {
        const sr = await fetch(base + '/sitemap.xml', { signal: AbortSignal.timeout(5000) })
        const sxml = await sr.text()
        const count = (sxml.match(/<loc>/g) || []).length
        checks.push({ id: 'sitemap', label: 'Sitemap', ok: sr.ok && count > 0, info: `${count} URLs gefunden, lastmod vorhanden: ${sxml.includes('lastmod') ? 'Ja' : 'Nein'}` })
      } catch { checks.push({ id: 'sitemap', label: 'Sitemap', ok: false, info: 'Nicht erreichbar' }) }

      // robots.txt
      try {
        const rr = await fetch(base + '/robots.txt', { signal: AbortSignal.timeout(5000) })
        const rtxt = await rr.text()
        checks.push({ id: 'robots', label: 'robots.txt', ok: rr.ok && rtxt.includes('Sitemap'), info: rtxt.includes('Sitemap') ? 'Sitemap-Eintrag vorhanden' : 'Sitemap fehlt in robots.txt' })
      } catch { checks.push({ id: 'robots', label: 'robots.txt', ok: false, info: 'Nicht erreichbar' }) }

      // llms.txt
      try {
        const lr = await fetch(base + '/llms.txt', { signal: AbortSignal.timeout(5000) })
        checks.push({ id: 'llms', label: 'llms.txt (KI-Suchen)', ok: lr.ok, info: lr.ok ? 'Vorhanden — ChatGPT/Gemini/Perplexity können die Seite lesen' : 'Fehlt' })
      } catch { checks.push({ id: 'llms', label: 'llms.txt (KI-Suchen)', ok: false, info: 'Nicht erreichbar' }) }

      // Events from DB
      const evRows = await dbExecute("SELECT COUNT(*) as c FROM events WHERE is_active = 1 OR is_active = '1'")
      const evCount = Number(evRows.rows[0]?.c || 0)
      checks.push({ id: 'events', label: 'Aktive Events', ok: evCount > 0, info: `${evCount} aktive Event${evCount !== 1 ? 's' : ''} in der Datenbank` })

      // Analytics
      const aRows = await dbExecute("SELECT COUNT(*) as c FROM analytics WHERE ts >= datetime('now','-30 days')")
      const visits = Number(aRows.rows[0]?.c || 0)
      checks.push({ id: 'analytics', label: 'Besuchertracking', ok: visits > 0, info: `${visits} Seitenaufrufe in den letzten 30 Tagen` })

      const score = Math.round((checks.filter(c => c.ok).length / checks.length) * 100)
      return res.json({ score, checks, loadMs })
    }

    if (path === '/admin/login' && method === 'POST') {
      const { password } = req.body
      if (!process.env.ADMIN_PASSWORD || password !== process.env.ADMIN_PASSWORD)
        return res.status(401).json({ error: 'Falsches Passwort' })
      const token = randomBytes(32).toString('hex')
      await dbExecute('INSERT INTO admin_sessions (token) VALUES (?)', [token])
      return res.json({ token })
    }

    if (path === '/events') {
      if (method === 'GET') {
        const adminMode = await isAdmin(req.headers.authorization)
        const sql = adminMode ? 'SELECT * FROM events ORDER BY date ASC' : "SELECT * FROM events WHERE is_active = 1 OR is_active = '1' ORDER BY date ASC"
        const r = await dbExecute(sql)
        return res.json(r.rows.map(row => ({ ...row, tags: JSON.parse(row.tags || '[]'), partners: JSON.parse(row.partners || '[]'), isActive: row.is_active === 1 || row.is_active === '1' || row.is_active === null, entryFee: row.entry_fee != null ? Number(row.entry_fee) : null, endDate: row.end_date ?? null, imageUrl: row.image_url ?? null, youtubeVideoId: row.youtube_video_id ?? null, ticketUrl: row.ticket_url ?? null, schedule: row.schedule ? JSON.parse(row.schedule) : null, maxVendors: row.max_vendors != null ? Number(row.max_vendors) : null, pricePerMeterDay: row.price_per_meter_day != null ? Number(row.price_per_meter_day) : null, priceTiers: row.price_tiers ? JSON.parse(row.price_tiers) : null, requireDay1WithDay2: row.require_day1_with_day2 === 1 || row.require_day1_with_day2 === '1', allowedAttendanceDays: row.allowed_attendance_days ? JSON.parse(row.allowed_attendance_days) : null, soldOutLabel: row.sold_out_label ?? null })))
      }
      if (method === 'POST') {
        if (!await isAdmin(req.headers.authorization)) return res.status(401).json({ error: 'Unauthorized' })
        const { id, title, date, endDate, location, address, city, description, youtubeVideoId, ticketUrl, imageUrl, tags, partners, isActive, entryFee, schedule, maxVendors, pricePerMeterDay, priceTiers, requireDay1WithDay2 } = req.body
        if (!id || !title || !date) return res.status(400).json({ error: 'Pflichtfelder fehlen' })
        await dbExecute(`INSERT INTO events (id,title,date,end_date,location,address,city,description,youtube_video_id,ticket_url,image_url,tags,partners,is_active,entry_fee,schedule,max_vendors,price_per_meter_day,price_tiers,require_day1_with_day2) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`, [id, title, date, endDate ?? null, location, address, city, description, youtubeVideoId ?? null, ticketUrl ?? null, imageUrl ?? null, JSON.stringify(tags ?? []), JSON.stringify(partners ?? []), isActive ? 1 : 0, entryFee ?? null, schedule ? JSON.stringify(schedule) : null, maxVendors ?? null, pricePerMeterDay ?? null, priceTiers && priceTiers.length > 0 ? JSON.stringify(priceTiers) : null, requireDay1WithDay2 ? 1 : 0])
        return res.status(201).json({ ok: true })
      }
    }

    // Event-Kapazität (verfügbare Plätze) — muss VOR eventMatch stehen
    if (path === '/events/capacity' && method === 'GET') {
      const r = await dbExecute("SELECT event_name, COUNT(*) as count FROM event_inquiries WHERE status != 'declined' GROUP BY event_name")
      const map = {}
      r.rows.forEach(row => { map[row.event_name] = Number(row.count) })
      return res.json(map)
    }

    // Dediziertes, minimales PATCH nur fuer die Teilnahme-Tage-Sperrung
    // (Dennis' Admin-Checkboxen "Tag 1/Tag 2 sperren", 28.10.2026) -- bewusst
    // NICHT im generischen PATCH /events/:id untergebracht, da dieses alle
    // Felder aus dem Request-Body destrukturiert und mit `?? null` schreibt;
    // ein Teil-Update dort wuerde alle nicht mitgesendeten Felder loeschen.
    const attendanceMatch = path.match(/^\/events\/([^/]+)\/attendance$/)
    if (attendanceMatch && method === 'PATCH') {
      if (!await isAdmin(req.headers.authorization)) return res.status(401).json({ error: 'Unauthorized' })
      const id = attendanceMatch[1]
      const { allowedAttendanceDays } = req.body
      if (allowedAttendanceDays !== null && !Array.isArray(allowedAttendanceDays)) {
        return res.status(400).json({ error: 'allowedAttendanceDays muss ein Array oder null sein' })
      }
      await dbExecute('UPDATE events SET allowed_attendance_days = ? WHERE id = ?', [allowedAttendanceDays === null ? null : JSON.stringify(allowedAttendanceDays), id])
      return res.json({ ok: true })
    }

    const eventMatch = path.match(/^\/events\/([^/]+)$/)
    if (eventMatch) {
      const id = eventMatch[1]
      if (!await isAdmin(req.headers.authorization)) return res.status(401).json({ error: 'Unauthorized' })
      if (method === 'DELETE') {
        await dbExecute('DELETE FROM events WHERE id = ?', [id])
        return res.json({ ok: true })
      }
      if (method === 'PATCH') {
        const { title, date, endDate, location, address, city, description, youtubeVideoId, ticketUrl, imageUrl, tags, partners, isActive, entryFee, schedule, maxVendors, pricePerMeterDay, priceTiers, requireDay1WithDay2 } = req.body
        await dbExecute(`UPDATE events SET title=?,date=?,end_date=?,location=?,address=?,city=?,description=?,youtube_video_id=?,ticket_url=?,image_url=?,tags=?,partners=?,is_active=?,entry_fee=?,schedule=?,max_vendors=?,price_per_meter_day=?,price_tiers=?,require_day1_with_day2=? WHERE id=?`, [title, date, endDate ?? null, location, address, city, description, youtubeVideoId ?? null, ticketUrl ?? null, imageUrl ?? null, JSON.stringify(tags ?? []), JSON.stringify(partners ?? []), isActive ? 1 : 0, entryFee ?? null, schedule ? JSON.stringify(schedule) : null, maxVendors ?? null, pricePerMeterDay ?? null, priceTiers && priceTiers.length > 0 ? JSON.stringify(priceTiers) : null, requireDay1WithDay2 ? 1 : 0, id])
        return res.json({ ok: true })
      }
    }

    if (path === '/artworks') {
      if (method === 'GET') {
        const r = await dbExecute('SELECT * FROM artworks WHERE is_active = 1 ORDER BY created_at DESC')
        return res.json(r.rows.map(row => ({ ...row, tags: JSON.parse(row.tags), sold: row.sold === 1 || row.sold === '1' ? 1 : 0 })))
      }
      if (method === 'POST') {
        if (!await isAdmin(req.headers.authorization)) return res.status(401).json({ error: 'Unauthorized' })
        const { id, title, description, image_url, tags, sold } = req.body
        if (!id || !title) return res.status(400).json({ error: 'Pflichtfelder fehlen' })
        await dbExecute(`INSERT INTO artworks (id,title,description,image_url,tags,sold) VALUES (?,?,?,?,?,?)`, [id, title, description ?? '', image_url ?? '', JSON.stringify(tags ?? []), sold ? 1 : 0])
        return res.status(201).json({ ok: true })
      }
    }

    const artworkMatch = path.match(/^\/artworks\/([^/]+)$/)
    if (artworkMatch) {
      const id = artworkMatch[1]
      if (!await isAdmin(req.headers.authorization)) return res.status(401).json({ error: 'Unauthorized' })
      if (method === 'PATCH') {
        const { sold, title, description, image_url, tags } = req.body
        if (title !== undefined) {
          await dbExecute('UPDATE artworks SET title=?, description=?, image_url=?, tags=?, sold=? WHERE id=?', [title, description ?? '', image_url ?? '', JSON.stringify(tags ?? []), sold ? 1 : 0, id])
        } else {
          await dbExecute('UPDATE artworks SET sold = ? WHERE id = ?', [sold ? 1 : 0, id])
        }
        return res.json({ ok: true })
      }
      if (method === 'DELETE') {
        await dbExecute('DELETE FROM artworks WHERE id = ?', [id])
        return res.json({ ok: true })
      }
    }

    if (path === '/products') {
      if (method === 'GET') {
        const r = await dbExecute('SELECT * FROM products WHERE is_active = 1 ORDER BY is_featured DESC, created_at DESC')
        return res.json(r.rows.map(row => ({ ...row, tags: JSON.parse(row.tags) })))
      }
      if (method === 'POST') {
        if (!await isAdmin(req.headers.authorization)) return res.status(401).json({ error: 'Unauthorized' })
        const { id, name, description, price, stock, image_url, tags, is_featured } = req.body
        if (!id || !name || price === undefined) return res.status(400).json({ error: 'Pflichtfelder fehlen' })
        await dbExecute(`INSERT INTO products (id,name,description,price,stock,image_url,tags,is_featured) VALUES (?,?,?,?,?,?,?,?)`, [id, name, description ?? '', price, stock ?? 1, image_url ?? '', JSON.stringify(tags ?? []), is_featured ? 1 : 0])
        return res.status(201).json({ ok: true })
      }
    }

    if (path === '/products/admin') {
      if (!await isAdmin(req.headers.authorization)) return res.status(401).json({ error: 'Unauthorized' })
      const r = await dbExecute('SELECT * FROM products ORDER BY created_at DESC')
      return res.json(r.rows.map(row => ({ ...row, tags: JSON.parse(row.tags) })))
    }

    const productMatch = path.match(/^\/products\/([^/]+)$/)
    if (productMatch) {
      const id = productMatch[1]
      if (!await isAdmin(req.headers.authorization)) return res.status(401).json({ error: 'Unauthorized' })
      if (method === 'DELETE') {
        await dbExecute('DELETE FROM products WHERE id = ?', [id])
        return res.json({ ok: true })
      }
    }

    if (path === '/orders') {
      if (method === 'POST') {
        const { name, email, phone, motif, size, message } = req.body
        if (!name || !email || !motif) return res.status(400).json({ error: 'Pflichtfelder fehlen' })
        await dbExecute(`INSERT INTO orders (name,email,phone,motif,size,message) VALUES (?,?,?,?,?,?)`, [name, email, phone ?? null, motif, size ?? null, message ?? null])
        // WhatsApp-Ping an Heike (Kunstwerke) + Stefan (Zweitabsicherung)
        {
          const waText = `🎨 Neue Kunstwerk-Anfrage bei ShinyFam\n\nName: ${name}\nE-Mail: ${email}${phone ? '\nTelefon: ' + phone : ''}\nMotiv: ${motif}${size ? '\nGröße: ' + size : ''}${message ? '\n\nNachricht:\n' + message : ''}`
          notifyWhatsApp(process.env.WA_NOTIFY_KUNSTWERKE, waText)
          notifyWhatsApp(process.env.WA_NOTIFY_ADMIN, waText)
        }
        if (process.env.BREVO_API_KEY) {
          // Benachrichtigung ans ShinyFam-Postfach
          fetch('https://api.brevo.com/v3/smtp/email', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json; charset=utf-8', 'api-key': process.env.BREVO_API_KEY },
            body: JSON.stringify({
              sender: { name: 'ShinyFam Bestellungen', email: 'info@shinyfam.de' },
              to: [{ email: 'info@shinyfam.de' }],
              replyTo: { email, name },
              subject: `Neue Bild-Anfrage: ${motif}`,
              htmlContent: `<html><head><meta charset="utf-8"></head><body><pre style="font-family:sans-serif">Neue Bestellanfrage\n\nName: ${name}\nE-Mail: ${email}\n${phone ? 'Telefon: ' + phone + '\n' : ''}Motiv: ${motif}${size ? '\nGröße: ' + size : ''}${message ? '\n\nNachricht:\n' + message : ''}</pre></body></html>`
            })
          }).catch(() => {})
          // Automatische Bestätigungsmail an den Kunden
          fetch('https://api.brevo.com/v3/smtp/email', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'api-key': process.env.BREVO_API_KEY },
            body: JSON.stringify({
              sender: { name: 'ShinyFam', email: 'info@shinyfam.de' },
              to: [{ email, name }],
              subject: 'Deine Anfrage bei ShinyFam ✓',
              textContent: `Hallo ${name},\n\nvielen Dank für deine Nachricht! Deine E-Mail hat uns erreicht und wir kümmern uns schnellstmöglich um dein Anliegen.\n\nDeine Angaben:\n${motif}${size ? '\nGröße: ' + size : ''}${message ? '\n\n' + message : ''}\n\nViele Grüße\nDas ShinyFam-Team\ninfo@shinyfam.de`
            })
          }).catch(() => {})
        }
        return res.status(201).json({ ok: true, message: 'Anfrage eingegangen!' })
      }
      if (method === 'GET') {
        if (!await isAdmin(req.headers.authorization)) return res.status(401).json({ error: 'Unauthorized' })
        const r = await dbExecute('SELECT * FROM orders ORDER BY created_at DESC')
        return res.json(r.rows)
      }
    }

    const artworkOrderStatusMatch = path.match(/^\/orders\/(\d+)\/status$/)
    if (artworkOrderStatusMatch && method === 'PATCH') {
      if (!await isAdmin(req.headers.authorization)) return res.status(401).json({ error: 'Unauthorized' })
      const { status } = req.body
      await dbExecute('UPDATE orders SET status = ? WHERE id = ?', [status, artworkOrderStatusMatch[1]])
      return res.json({ ok: true })
    }

    const artworkOrderDeleteMatch = path.match(/^\/orders\/(\d+)$/)
    if (artworkOrderDeleteMatch && method === 'DELETE') {
      if (!await isAdmin(req.headers.authorization)) return res.status(401).json({ error: 'Unauthorized' })
      await dbExecute('DELETE FROM orders WHERE id = ?', [artworkOrderDeleteMatch[1]])
      return res.json({ ok: true })
    }

    if (path === '/shop/orders') {
      if (method === 'POST') {
        const { firstName, lastName, email, phone, street, zip, city, items, subtotal, shipping, total, paymentMethod, notes } = req.body
        if (!firstName || !lastName || !email || !street || !zip || !city || !items?.length)
          return res.status(400).json({ error: 'Pflichtfelder fehlen' })
        const orderNumber = generateOrderNumber()
        await dbExecute(`INSERT INTO shop_orders (order_number,first_name,last_name,email,phone,street,zip,city,items,subtotal,shipping,total,payment_method,notes) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)`, [orderNumber, firstName, lastName, email, phone ?? null, street, zip, city, JSON.stringify(items), subtotal, shipping, total, paymentMethod ?? 'prepayment', notes ?? null])
        return res.status(201).json({ ok: true, orderNumber })
      }
    }

    if (path === '/shop/orders/admin') {
      if (!await isAdmin(req.headers.authorization)) return res.status(401).json({ error: 'Unauthorized' })
      const r = await dbExecute('SELECT * FROM shop_orders ORDER BY created_at DESC')
      return res.json(r.rows)
    }

    const shopOrderStatusMatch = path.match(/^\/shop\/orders\/(\d+)\/status$/)
    if (shopOrderStatusMatch) {
      if (!await isAdmin(req.headers.authorization)) return res.status(401).json({ error: 'Unauthorized' })
      if (method === 'PATCH') {
        const { status } = req.body
        const valid = ['new', 'processing', 'shipped', 'delivered', 'cancelled']
        if (!valid.includes(status)) return res.status(400).json({ error: 'Ungültiger Status' })
        await dbExecute('UPDATE shop_orders SET order_status = ? WHERE id = ?', [status, shopOrderStatusMatch[1]])
        return res.json({ ok: true })
      }
    }

    if (path === '/videos') {
      if (method === 'GET') {
        const r = await dbExecute('SELECT * FROM youtube_videos ORDER BY sort_order ASC, created_at DESC LIMIT 6')
        return res.json(r.rows)
      }
      if (method === 'POST') {
        if (!await isAdmin(req.headers.authorization)) return res.status(401).json({ error: 'Unauthorized' })
        const { id, title, url } = req.body
        if (!id || !title || !url) return res.status(400).json({ error: 'Pflichtfelder fehlen' })
        const existing = await dbExecute('SELECT id FROM youtube_videos WHERE id = ?', [id])
        if (existing.rows.length > 0) return res.status(409).json({ error: 'Dieses Video ist bereits eingetragen' })
        const count = await dbExecute('SELECT COUNT(*) as c FROM youtube_videos')
        if (count.rows[0].c >= 6) {
          const oldest = await dbExecute('SELECT id FROM youtube_videos ORDER BY sort_order ASC, created_at ASC LIMIT 1')
          if (oldest.rows.length > 0) await dbExecute('DELETE FROM youtube_videos WHERE id = ?', [oldest.rows[0].id])
        }
        await dbExecute('INSERT INTO youtube_videos (id, title, url) VALUES (?,?,?)', [id, title, url])
        return res.status(201).json({ ok: true })
      }
    }

    const videoMatch = path.match(/^\/videos\/([^/]+)$/)
    if (videoMatch) {
      if (!await isAdmin(req.headers.authorization)) return res.status(401).json({ error: 'Unauthorized' })
      if (method === 'DELETE') {
        await dbExecute('DELETE FROM youtube_videos WHERE id = ?', [videoMatch[1]])
        return res.json({ ok: true })
      }
    }

    if (path === '/brands') {
      if (method === 'GET') {
        const r = await dbExecute('SELECT * FROM brands ORDER BY sort_order ASC, created_at ASC')
        return res.json(r.rows)
      }
      if (method === 'POST') {
        if (!await isAdmin(req.headers.authorization)) return res.status(401).json({ error: 'Unauthorized' })
        const { id, name, logo_url, website, sort_order } = req.body
        if (!id || !name) return res.status(400).json({ error: 'Pflichtfelder fehlen' })
        await dbExecute(`INSERT INTO brands (id,name,logo_url,website,sort_order) VALUES (?,?,?,?,?)`, [id, name, logo_url ?? null, website ?? null, sort_order ?? 0])
        return res.status(201).json({ ok: true })
      }
    }

    // Öffentliche Händlerliste — muss VOR brandMatch stehen
    if (path === '/brands/public' && method === 'GET') {
      const r = await dbExecute('SELECT id, name, logo_url, website FROM brands ORDER BY sort_order ASC, name ASC')
      return res.json(r.rows)
    }

    const brandMatch = path.match(/^\/brands\/([^/]+)$/)
    if (brandMatch) {
      const id = brandMatch[1]
      if (!await isAdmin(req.headers.authorization)) return res.status(401).json({ error: 'Unauthorized' })
      if (method === 'DELETE') {
        await dbExecute('DELETE FROM brands WHERE id = ?', [id])
        return res.json({ ok: true })
      }
      if (method === 'PATCH') {
        const { name, logo_url, website, sort_order } = req.body
        await dbExecute(`UPDATE brands SET name=?,logo_url=?,website=?,sort_order=? WHERE id=?`, [name, logo_url ?? null, website ?? null, sort_order ?? 0, id])
        return res.json({ ok: true })
      }
    }

    if (path === '/settings') {
      if (method === 'GET') {
        const r = await dbExecute('SELECT key, value FROM settings')
        const obj = {}
        for (const row of r.rows) obj[row.key] = row.value
        return res.json(obj)
      }
      if (method === 'POST') {
        if (!await isAdmin(req.headers.authorization)) return res.status(401).json({ error: 'Unauthorized' })
        const { key, value } = req.body
        if (!key) return res.status(400).json({ error: 'key fehlt' })
        await dbExecute('INSERT OR REPLACE INTO settings (key, value) VALUES (?,?)', [key, String(value)])
        return res.json({ ok: true })
      }
    }

    // Mail API
    if (path === '/mail/inbox' && method === 'GET') {
      if (!await isAdmin(req.headers.authorization)) return res.status(401).json({ error: 'Unauthorized' })
      try {
        const { default: Imap } = await import('node-imap')
        const { simpleParser } = await import('mailparser')
        const mails = await new Promise((resolve, reject) => {
          const imap = new Imap({ user: 'info', password: process.env.MAIL_PASSWORD || 'ShinyFam2026!', host: 'localhost', port: 143, tls: false })
          const messages = []
          imap.once('ready', () => {
            imap.openBox('INBOX', false, (err, box) => {
              if (err) { imap.end(); return reject(err) }
              const total = box.messages.total
              if (total === 0) { imap.end(); return resolve([]) }
              const start = Math.max(1, total - 199)
              const f = imap.seq.fetch(`${start}:${total}`, { bodies: ['HEADER', 'TEXT'], markSeen: false, struct: true })
              f.on('message', (msg, seqno) => {
                let header = '', body = '', uid = seqno
                msg.on('attributes', attrs => { uid = attrs.uid || seqno })
                msg.on('body', (stream, info) => {
                  let buf = ''
                  stream.on('data', d => { buf += d.toString('utf8') })
                  stream.once('end', () => { if (info.which === 'HEADER') header = buf; else body = buf })
                })
                msg.once('end', () => messages.push({ uid, raw: header + '\r\n' + body }))
              })
              f.once('error', reject)
              f.once('end', async () => {
                imap.end()
                const parsed = await Promise.all(messages.map(async m => {
                  const p = await simpleParser(m.raw)
                  return { id: m.uid, from: p.from?.text || '', subject: p.subject || '(kein Betreff)', date: p.date?.toISOString() || '', text: p.text || '', html: p.html || '' }
                }))
                resolve(parsed.reverse())
              })
            })
          })
          imap.once('error', reject)
          imap.connect()
        })
        return res.json(mails)
      } catch (e) {
        console.error('Mail error:', e)
        return res.status(500).json({ error: e.message })
      }
    }

    if (path === '/mail/delete' && method === 'POST') {
      if (!await isAdmin(req.headers.authorization)) return res.status(401).json({ error: 'Unauthorized' })
      const { id } = req.body
      const { default: Imap } = await import('node-imap')
      await new Promise((resolve, reject) => {
        const imap = new Imap({ user: 'info', password: process.env.MAIL_PASSWORD || 'ShinyFam2026!', host: 'localhost', port: 143, tls: false })
        imap.once('ready', () => {
          imap.openBox('INBOX', false, (err) => {
            if (err) { imap.end(); return reject(err) }
            imap.addFlags(id, '\\Deleted', (e) => {
              if (e) { imap.end(); return reject(e) }
              imap.expunge((e2) => { imap.end(); e2 ? reject(e2) : resolve(null) })
            })
          })
        })
        imap.once('error', reject)
        imap.connect()
      })
      return res.json({ ok: true })
    }

    if (path === '/event-inquiries' && method === 'GET') {
      if (!await isAdmin(req.headers.authorization)) return res.status(401).json({ error: 'Unauthorized' })
      const r = await dbExecute('SELECT * FROM event_inquiries ORDER BY created_at DESC')
      return res.json(r.rows)
    }

    if (path === '/event-inquiries/archive-event' && method === 'PATCH') {
      if (!await isAdmin(req.headers.authorization)) return res.status(401).json({ error: 'Unauthorized' })
      const { eventName, eventDate, archived } = req.body
      if (!eventName) return res.status(400).json({ error: 'eventName fehlt' })
      if (eventDate) {
        await dbExecute('UPDATE event_inquiries SET archived = ? WHERE event_name = ? AND event_date = ?', [archived ? 1 : 0, eventName, eventDate])
      } else {
        await dbExecute('UPDATE event_inquiries SET archived = ? WHERE event_name = ? AND event_date IS NULL', [archived ? 1 : 0, eventName])
      }
      return res.json({ ok: true })
    }

    const inquiryStatusMatch = path.match(/^\/event-inquiries\/(\d+)\/status$/)
    if (inquiryStatusMatch && method === 'PATCH') {
      if (!await isAdmin(req.headers.authorization)) return res.status(401).json({ error: 'Unauthorized' })
      const { status } = req.body
      await dbExecute('UPDATE event_inquiries SET status = ? WHERE id = ?', [status, inquiryStatusMatch[1]])
      return res.json({ ok: true })
    }

    const inquiryNoteMatch = path.match(/^\/event-inquiries\/(\d+)\/note$/)
    if (inquiryNoteMatch && method === 'PATCH') {
      if (!await isAdmin(req.headers.authorization)) return res.status(401).json({ error: 'Unauthorized' })
      const { note } = req.body
      await dbExecute('UPDATE event_inquiries SET message = ? WHERE id = ?', [note ?? null, inquiryNoteMatch[1]])
      return res.json({ ok: true })
    }

    const inquiryDeleteMatch = path.match(/^\/event-inquiries\/(\d+)$/)
    if (inquiryDeleteMatch && method === 'DELETE') {
      if (!await isAdmin(req.headers.authorization)) return res.status(401).json({ error: 'Unauthorized' })
      await dbExecute('DELETE FROM event_inquiries WHERE id = ?', [inquiryDeleteMatch[1]])
      return res.json({ ok: true })
    }

    if (path === '/event-inquiry' && method === 'POST') {
      const { name, email, eventName, date, tcg, meters, metersNum, message, logoUrl, attendanceDays, company, phone, street, zipCity, priceTier, customerType } = req.body
      const isCommercial = customerType !== 'privat'
      if (!name || !email || !eventName || !street || !zipCity || !meters || (isCommercial && !company)) return res.status(400).json({ error: 'Pflichtfelder fehlen' })
      // Pro Event konfigurierbar, welche Teilnahme-Optionen (Tag 1 / Tag 2 /
      // Beide) ueberhaupt waehlbar sind — admin-gepflegt in allowed_attendance_days
      // (JSON-Array). NULL = alle drei erlaubt (Altbestand/Default), leeres
      // Array = Event komplett gesperrt (z.B. Sold Out). Serverseitig prüfen,
      // da das Frontend umgehbar ist. require_day1_with_day2 bleibt als
      // Altlogik-Fallback erhalten, falls allowed_attendance_days nicht gesetzt ist.
      const evRes = await dbExecute('SELECT allowed_attendance_days, require_day1_with_day2, sold_out_label FROM events WHERE title = ? LIMIT 1', [eventName]).catch(() => ({ rows: [] }))
      const ev = evRes.rows[0]
      if (ev) {
        if (ev.sold_out_label) return res.status(400).json({ error: 'Dieses Event ist ausverkauft, Händleranfragen sind nicht mehr möglich.' })
        if (ev.allowed_attendance_days) {
          const allowedDays = JSON.parse(ev.allowed_attendance_days)
          if (attendanceDays && !allowedDays.includes(attendanceDays)) {
            return res.status(400).json({ error: 'Diese Teilnahme-Option ist für dieses Event nicht verfügbar.' })
          }
        } else if (attendanceDays === 'tag1') {
          const requiresBothDays = ev.require_day1_with_day2 === 1 || ev.require_day1_with_day2 === '1'
          if (requiresBothDays) return res.status(400).json({ error: 'Tag 1 ist nur buchbar, wenn auch Tag 2 mitgebucht wird.' })
        }
      }
      const resolvedMetersNum = metersNum != null ? Number(metersNum) : (meters ? parseFloat(String(meters).replace(',', '.')) || null : null)
      const daysCount = attendanceDays === 'beide' ? 2 : 1
      // Immer in DB speichern — unabhängig vom Mailserver
      await dbExecute('INSERT INTO event_inquiries (name,email,event_name,event_date,tcg,meters,message,attendance_days,logo_url,company,phone,street,zip_city,meters_num,days_count,price_tier,customer_type) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)',
        [name, email, eventName, date || null, tcg || null, meters || null, message || null, attendanceDays || null, logoUrl || null, company || null, phone || null, street || null, zipCity || null, resolvedMetersNum, daysCount, priceTier || null, isCommercial ? 'gewerblich' : 'privat']).catch(() => {})
      // Logo hochgeladen → direkt als Händler eintragen (nur wenn noch nicht
      // vorhanden). Anzeigename: Firmenname bei Gewerblich, sonst Ansprechpartner
      // (private Aussteller haben kein company-Feld, sollen aber trotzdem mit
      // Logo auf der Händlerseite auftauchen).
      const brandName = isCommercial ? company : name
      if (logoUrl && brandName) {
        const existing = await dbExecute('SELECT id FROM brands WHERE name = ?', [brandName]).catch(() => ({ rows: [] }))
        if (existing.rows.length === 0) {
          await dbExecute('INSERT INTO brands (id,name,logo_url,sort_order) VALUES (?,?,?,?)',
            [`brand-${Date.now()}`, brandName, logoUrl, 9999]).catch(() => {})
        }
      }
      const attendanceDaysLabels = { beide: 'Beide Tage (komplettes Event)', tag1: 'Nur Tag 1', tag2: 'Nur Tag 2' }
      const attendanceLabel = attendanceDays ? (attendanceDaysLabels[attendanceDays] || attendanceDays) : null
      const dateFormatted = date ? new Date(date).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' }) : null
      const subject = `Händler-Anfrage: ${eventName}${dateFormatted ? ' – ' + dateFormatted : ''}${attendanceLabel ? ' (' + attendanceLabel + ')' : ''}`
      const details = [
        `Art: ${isCommercial ? 'Gewerblich' : 'Privat'}`,
        isCommercial ? `Firma: ${company}` : null,
        `Ansprechpartner: ${name}`,
        `E-Mail: ${email}`,
        phone ? `Telefon: ${phone}` : null,
        street ? `Straße/Hausnr.: ${street}` : null,
        zipCity ? `PLZ/Ort: ${zipCity}` : null,
        `Event: ${eventName}`,
        dateFormatted ? `Datum: ${dateFormatted}` : null,
        attendanceLabel ? `Teilnahme: ${attendanceLabel}` : null,
        tcg ? `TCG: ${tcg}` : null,
        meters ? `Standfläche: ${meters}` : null,
        message ? `\nNachricht:\n${message}` : null,
      ].filter(Boolean).join('\n')
      // WhatsApp-Ping an Dennis (Händler-Anfragen) + Stefan (Zweitabsicherung)
      {
        const waText = `🏪 Neue Händler-Anfrage bei ShinyFam\n\n${details}`
        notifyWhatsApp(process.env.WA_NOTIFY_HAENDLER, waText)
        notifyWhatsApp(process.env.WA_NOTIFY_ADMIN, waText)
      }
      if (process.env.BREVO_API_KEY) {
        fetch('https://api.brevo.com/v3/smtp/email', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json; charset=utf-8', 'api-key': process.env.BREVO_API_KEY },
          body: JSON.stringify({
            sender: { name: 'ShinyFam Kontaktformular', email: 'info@shinyfam.de' },
            to: [{ email: 'info@shinyfam.de' }],
            replyTo: { email, name },
            subject,
            htmlContent: `<html><head><meta charset="utf-8"></head><body><pre style="font-family:sans-serif">Neue Händler-Anfrage\n\n${details}</pre></body></html>`
          })
        }).catch(() => {})
        fetch('https://api.brevo.com/v3/smtp/email', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json; charset=utf-8', 'api-key': process.env.BREVO_API_KEY },
          body: JSON.stringify({
            sender: { name: 'ShinyFam', email: 'info@shinyfam.de' },
            to: [{ email, name }],
            subject: `Deine Anfrage für ${eventName}${dateFormatted ? ' am ' + dateFormatted : ''}`,
            htmlContent: `<html><head><meta charset="utf-8"></head><body><p>Hallo ${name},</p><p>vielen Dank für deine Anfrage! Deine E-Mail hat uns erreicht und wir kümmern uns schnellstmöglich um dein Anliegen.</p><p><strong>Deine Angaben:</strong><br>Event: ${eventName}${dateFormatted ? '<br>Datum: ' + dateFormatted : ''}${tcg ? '<br>TCG: ' + tcg : ''}${meters ? '<br>Standfläche: ' + meters : ''}</p><p>Viele Grüße<br>Das ShinyFam-Team<br>info@shinyfam.de</p></body></html>`
          })
        }).catch(() => {})
      }
      // Händler als Kontakt speichern
      await dbExecute('INSERT OR IGNORE INTO contacts (name,email,phone,tags,subscribed,source) VALUES (?,?,?,?,1,?)', [isCommercial ? `${company} (${name})` : name, email, phone || null, JSON.stringify(['Händler']), 'event-inquiry']).catch(() => {})
      return res.json({ ok: true })
    }

    if (path === '/mail/send' && method === 'POST') {
      if (!await isAdmin(req.headers.authorization)) return res.status(401).json({ error: 'Unauthorized' })
      const { to, subject, text } = req.body
      if (!to || !subject || !text) return res.status(400).json({ error: 'Felder fehlen' })
      const brevoRes = await fetch('https://api.brevo.com/v3/smtp/email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'api-key': process.env.BREVO_API_KEY },
        body: JSON.stringify({ sender: { name: 'ShinyFam', email: 'info@shinyfam.de' }, to: [{ email: to }], subject, textContent: text })
      })
      if (!brevoRes.ok) { const e = await brevoRes.json(); throw new Error(e.message || 'Brevo error') }
      return res.json({ ok: true })
    }

    // Push notification subscriptions
    if (path === '/push/subscribe' && method === 'POST') {
      if (!await isAdmin(req.headers.authorization)) return res.status(401).json({ error: 'Unauthorized' })
      await dbExecute(`CREATE TABLE IF NOT EXISTS push_subscriptions (endpoint TEXT PRIMARY KEY, data TEXT NOT NULL)`)
      const sub = req.body
      await dbExecute('INSERT OR REPLACE INTO push_subscriptions (endpoint, data) VALUES (?,?)', [sub.endpoint, JSON.stringify(sub)])
      return res.json({ ok: true })
    }

    if (path === '/push/unsubscribe' && method === 'POST') {
      if (!await isAdmin(req.headers.authorization)) return res.status(401).json({ error: 'Unauthorized' })
      await dbExecute('DELETE FROM push_subscriptions WHERE endpoint = ?', [req.body.endpoint])
      return res.json({ ok: true })
    }

    // Internal push trigger - called by Postfix on new mail
    if (path === '/push/trigger' && method === 'POST') {
      const secret = req.headers['x-push-secret']
      if (secret !== (process.env.PUSH_TRIGGER_SECRET || 'shinyfam-push-2026')) return res.status(401).json({ error: 'Unauthorized' })
      const { subject, from } = req.body
      try {
        await dbExecute(`CREATE TABLE IF NOT EXISTS push_subscriptions (endpoint TEXT PRIMARY KEY, data TEXT NOT NULL)`)
        const r = await dbExecute('SELECT data FROM push_subscriptions')
        const subs = r.rows.map(row => JSON.parse(row.data))
        const payload = JSON.stringify({ title: 'Neue Mail – ShinyFam', body: `Von: ${from || 'unbekannt'}\n${subject || '(kein Betreff)'}`, url: '/admin', tag: 'new-mail' })
        let sent = 0
        for (const sub of subs) {
          try {
            await sendWebPush(sub, payload)
            sent++
          } catch (e) {
            console.error('Push send error:', e.message)
            // Remove invalid subscriptions
            if (e.statusCode === 410 || e.statusCode === 404) {
              await dbExecute('DELETE FROM push_subscriptions WHERE endpoint = ?', [sub.endpoint]).catch(() => {})
            }
          }
        }
        return res.json({ ok: true, sent })
      } catch (e) {
        console.error('Push trigger error:', e)
        return res.status(500).json({ error: e.message })
      }
    }

    // Mail folders
    if (path === '/mail/folders' && method === 'GET') {
      if (!await isAdmin(req.headers.authorization)) return res.status(401).json({ error: 'Unauthorized' })
      const r = await dbExecute('SELECT * FROM mail_folders ORDER BY sort_order ASC, created_at ASC')
      return res.json(r.rows)
    }
    if (path === '/mail/folders' && method === 'POST') {
      if (!await isAdmin(req.headers.authorization)) return res.status(401).json({ error: 'Unauthorized' })
      const { name } = req.body
      if (!name) return res.status(400).json({ error: 'Name fehlt' })
      const r = await dbExecute('INSERT INTO mail_folders (name) VALUES (?) RETURNING id', [name])
      return res.status(201).json({ ok: true, id: r.rows[0]?.id })
    }
    const folderMatch = path.match(/^\/mail\/folders\/(\d+)$/)
    if (folderMatch) {
      if (!await isAdmin(req.headers.authorization)) return res.status(401).json({ error: 'Unauthorized' })
      const fid = folderMatch[1]
      if (method === 'DELETE') {
        await dbExecute('DELETE FROM mail_folders WHERE id = ?', [fid])
        await dbExecute('DELETE FROM mail_folder_items WHERE folder_id = ?', [fid])
        return res.json({ ok: true })
      }
      if (method === 'GET') {
        const r = await dbExecute('SELECT * FROM mail_folder_items WHERE folder_id = ? ORDER BY created_at DESC', [fid])
        return res.json(r.rows)
      }
    }
    if (path === '/mail/folders/assign' && method === 'POST') {
      if (!await isAdmin(req.headers.authorization)) return res.status(401).json({ error: 'Unauthorized' })
      const { folder_id, mail_uid, mail_subject, mail_from, mail_date } = req.body
      if (!folder_id || !mail_uid) return res.status(400).json({ error: 'Felder fehlen' })
      await dbExecute('INSERT OR REPLACE INTO mail_folder_items (folder_id, mail_uid, mail_subject, mail_from, mail_date) VALUES (?,?,?,?,?)', [folder_id, String(mail_uid), mail_subject || null, mail_from || null, mail_date || null])
      // Mark as deleted in IMAP so it disappears from inbox
      try {
        const { default: Imap } = await import('node-imap')
        await new Promise((resolve, reject) => {
          const imap = new Imap({ user: 'info', password: process.env.MAIL_PASSWORD || 'ShinyFam2026!', host: 'localhost', port: 143, tls: false })
          imap.once('ready', () => {
            imap.openBox('INBOX', false, (err) => {
              if (err) { imap.end(); return resolve(null) }
              imap.addFlags(Number(mail_uid), '\\Deleted', (e) => {
                if (e) { imap.end(); return resolve(null) }
                imap.expunge((e2) => { imap.end(); resolve(null) })
              })
            })
          })
          imap.once('error', () => resolve(null))
          imap.connect()
        })
      } catch (e) { /* ignore IMAP errors, DB assignment already saved */ }
      return res.json({ ok: true })
    }
    if (path === '/mail/folders/unassign' && method === 'POST') {
      if (!await isAdmin(req.headers.authorization)) return res.status(401).json({ error: 'Unauthorized' })
      const { folder_id, mail_uid } = req.body
      await dbExecute('DELETE FROM mail_folder_items WHERE folder_id = ? AND mail_uid = ?', [folder_id, String(mail_uid)])
      return res.json({ ok: true })
    }

    // Mail Templates
    if (path === '/mail/templates' && method === 'GET') {
      if (!await isAdmin(req.headers.authorization)) return res.status(401).json({ error: 'Unauthorized' })
      const r = await dbExecute('SELECT * FROM mail_templates ORDER BY type ASC, name ASC')
      return res.json(r.rows)
    }
    if (path === '/mail/templates' && method === 'POST') {
      if (!await isAdmin(req.headers.authorization)) return res.status(401).json({ error: 'Unauthorized' })
      const { name, type, subject, body } = req.body
      if (!name || !subject || !body) return res.status(400).json({ error: 'Felder fehlen' })
      const r = await dbExecute('INSERT INTO mail_templates (name,type,subject,body) VALUES (?,?,?,?) RETURNING id', [name, type || 'custom', subject, body])
      return res.status(201).json({ ok: true, id: r.rows[0]?.id })
    }
    const tmplMatch = path.match(/^\/mail\/templates\/(\d+)$/)
    if (tmplMatch) {
      if (!await isAdmin(req.headers.authorization)) return res.status(401).json({ error: 'Unauthorized' })
      const tid = tmplMatch[1]
      if (method === 'PATCH') {
        const { name, type, subject, body } = req.body
        await dbExecute('UPDATE mail_templates SET name=?, type=?, subject=?, body=?, updated_at=datetime(\'now\') WHERE id=?', [name, type || 'custom', subject, body, tid])
        return res.json({ ok: true })
      }
      if (method === 'DELETE') {
        await dbExecute('DELETE FROM mail_templates WHERE id=?', [tid])
        return res.json({ ok: true })
      }
    }

    // Send template mail to inquiry (with optional PDF attachment)
    if (path === '/mail/send-template' && method === 'POST') {
      if (!await isAdmin(req.headers.authorization)) return res.status(401).json({ error: 'Unauthorized' })
      const { template_id, inquiry_id } = req.body
      if (!template_id || !inquiry_id) return res.status(400).json({ error: 'Felder fehlen' })
      const [tmplRes, inqRes] = await Promise.all([
        dbExecute('SELECT * FROM mail_templates WHERE id=?', [template_id]),
        dbExecute('SELECT * FROM event_inquiries WHERE id=?', [inquiry_id]),
      ])
      const tmpl = tmplRes.rows[0]
      const inq = inqRes.rows[0]
      if (!tmpl || !inq) return res.status(404).json({ error: 'Vorlage oder Anfrage nicht gefunden' })
      const eventDate = inq.event_date ? new Date(inq.event_date).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' }) : ''
      function fillPlaceholders(text) {
        return (text || '')
          .replace(/\{\{name\}\}/g, inq.name)
          .replace(/\{\{email\}\}/g, inq.email)
          .replace(/\{\{event\}\}/g, inq.event_name)
          .replace(/\{\{datum\}\}/g, eventDate)
          .replace(/\{\{meters\}\}/g, inq.meters || '')
          .replace(/\{\{tcg\}\}/g, inq.tcg || '')
          .replace(/\{\{message\}\}/g, inq.message || '')
      }
      const subject = fillPlaceholders(tmpl.subject)
      const bodyText = fillPlaceholders(tmpl.body)

      // Generate PDF if template type is 'pdf'
      let attachment = null
      if (tmpl.type === 'pdf') {
        try {
          const { default: PDFDocument } = await import('pdfkit')
          const pdfBuffer = await new Promise((resolve, reject) => {
            const doc = new PDFDocument({ margin: 60, size: 'A4' })
            const chunks = []
            doc.on('data', c => chunks.push(c))
            doc.on('end', () => resolve(Buffer.concat(chunks)))
            doc.on('error', reject)
            // Header bar
            doc.rect(0, 0, doc.page.width, 8).fill('#7c3aed')
            // Logo area
            doc.moveDown(0.5)
            doc.fontSize(22).fillColor('#7c3aed').font('Helvetica-Bold').text('ShinyFam', 60, 30)
            doc.fontSize(10).fillColor('#888').font('Helvetica').text('TCG Community am Niederrhein · info@shinyfam.de · shinyfam.de', 60, 56)
            doc.moveTo(60, 76).lineTo(doc.page.width - 60, 76).strokeColor('#e0d6ff').lineWidth(1).stroke()
            // Title
            doc.moveDown(2)
            doc.fontSize(18).fillColor('#1a1a2e').font('Helvetica-Bold').text(tmpl.name, { align: 'center' })
            doc.moveDown(0.3)
            doc.fontSize(10).fillColor('#888').font('Helvetica').text(`Rheinberg, ${new Date().toLocaleDateString('de-DE')}`, { align: 'center' })
            doc.moveDown(1.5)
            // Recipient info box
            doc.rect(60, doc.y, doc.page.width - 120, 56).fillColor('#f8f7ff').fill()
            const boxY = doc.y - 56 + 12
            doc.fontSize(9).fillColor('#8a90a8').font('Helvetica').text('AN', 72, boxY)
            doc.fontSize(11).fillColor('#1a1a2e').font('Helvetica-Bold').text(inq.name, 72, boxY + 14)
            doc.fontSize(10).fillColor('#4a5070').font('Helvetica').text(inq.email, 72, boxY + 28)
            if (inq.event_name) doc.text(`Event: ${inq.event_name}${eventDate ? '  ·  ' + eventDate : ''}`, 72, boxY + 40)
            doc.moveDown(2.5)
            // Body text
            doc.fontSize(11).fillColor('#1a1a2e').font('Helvetica')
            const lines = bodyText.split('\n')
            for (const line of lines) {
              if (line.trim() === '') { doc.moveDown(0.4); continue }
              doc.text(line, 60, doc.y, { width: doc.page.width - 120 })
            }
            // Footer
            doc.moveDown(3)
            doc.moveTo(60, doc.y).lineTo(doc.page.width - 60, doc.y).strokeColor('#e0d6ff').lineWidth(1).stroke()
            doc.moveDown(0.5)
            doc.fontSize(9).fillColor('#aaa').text('ShinyFam · Heike Karg · Bönninghardter Straße 72, 46519 Alpen · info@shinyfam.de', 60, doc.y, { align: 'center' })
            doc.end()
          })
          attachment = {
            name: `${tmpl.name.replace(/[^a-zA-Z0-9äöüÄÖÜ_-]/g, '_')}.pdf`,
            content: pdfBuffer.toString('base64'),
            type: 'application/pdf',
          }
        } catch (e) {
          console.error('PDF generation error:', e)
        }
      }

      const mailBody = {
        sender: { name: 'ShinyFam', email: 'info@shinyfam.de' },
        to: [{ email: inq.email, name: inq.name }],
        subject,
        textContent: bodyText,
        ...(attachment ? { attachment: [attachment] } : {}),
      }
      const brevoRes = await fetch('https://api.brevo.com/v3/smtp/email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'api-key': process.env.BREVO_API_KEY },
        body: JSON.stringify(mailBody),
      })
      if (!brevoRes.ok) {
        const err = await brevoRes.json().catch(() => ({}))
        return res.status(500).json({ error: err.message || 'Mail-Versand fehlgeschlagen' })
      }
      return res.json({ ok: true })
    }

    // Rechnungsstammdaten (Kleinunternehmer nach § 19 UStG)
    if (path === '/invoices/seller-info') {
      if (!await isAdmin(req.headers.authorization)) return res.status(401).json({ error: 'Unauthorized' })
      if (method === 'GET') return res.json(await getInvoiceSellerInfo())
      if (method === 'POST') {
        const { name, address, taxNumber } = req.body
        await dbExecute('INSERT OR REPLACE INTO settings (key, value) VALUES (?,?)', ['invoice_seller_name', name ?? ''])
        await dbExecute('INSERT OR REPLACE INTO settings (key, value) VALUES (?,?)', ['invoice_seller_address', address ?? ''])
        await dbExecute('INSERT OR REPLACE INTO settings (key, value) VALUES (?,?)', ['invoice_seller_tax_number', taxNumber ?? ''])
        return res.json({ ok: true })
      }
    }

    if (path === '/invoices' && method === 'GET') {
      if (!await isAdmin(req.headers.authorization)) return res.status(401).json({ error: 'Unauthorized' })
      const r = await dbExecute('SELECT * FROM invoices ORDER BY id DESC')
      return res.json(r.rows.map(row => ({ ...row, items: JSON.parse(row.items || '[]') })))
    }

    const invoiceStatusMatch = path.match(/^\/invoices\/(\d+)\/status$/)
    if (invoiceStatusMatch && method === 'PATCH') {
      if (!await isAdmin(req.headers.authorization)) return res.status(401).json({ error: 'Unauthorized' })
      const { status } = req.body
      if (!['open', 'sent', 'paid'].includes(status)) return res.status(400).json({ error: 'Ungültiger Status' })
      await dbExecute('UPDATE invoices SET status = ? WHERE id = ?', [status, invoiceStatusMatch[1]])
      return res.json({ ok: true })
    }

    // Einzelrechnung für eine Händler-Anfrage erstellen (PDF als Base64 zurückgeben)
    if (path === '/invoices/generate' && method === 'POST') {
      if (!await isAdmin(req.headers.authorization)) return res.status(401).json({ error: 'Unauthorized' })
      const { inquiry_id } = req.body
      if (!inquiry_id) return res.status(400).json({ error: 'inquiry_id fehlt' })
      const inqRes = await dbExecute('SELECT * FROM event_inquiries WHERE id = ?', [inquiry_id])
      const inq = inqRes.rows[0]
      if (!inq) return res.status(404).json({ error: 'Anfrage nicht gefunden' })
      const eventRes = await dbExecute('SELECT * FROM events WHERE title = ? LIMIT 1', [inq.event_name])
      const event = eventRes.rows[0] || null

      const items = computeInvoiceItems(inq, event)
      const total = items.every(it => it.total != null) ? Math.round(items.reduce((s, it) => s + it.total, 0) * 100) / 100 : null
      const seller = await getInvoiceSellerInfo()
      const invoiceNumber = await nextInvoiceNumber()
      const invoiceDate = new Date().toLocaleDateString('de-DE')
      const recipient = { company: inq.company, name: inq.name, street: inq.street, zipCity: inq.zip_city }

      const pdfBuffer = await buildInvoicePdf({ invoiceNumber, invoiceDate, seller, recipient, items, total })

      await dbExecute(
        'INSERT INTO invoices (invoice_number,invoice_date,inquiry_id,event_name,event_date,recipient_company,recipient_name,recipient_street,recipient_zip_city,items,total) VALUES (?,?,?,?,?,?,?,?,?,?,?)',
        [invoiceNumber, invoiceDate, inquiry_id, inq.event_name, inq.event_date, inq.company, inq.name, inq.street, inq.zip_city, JSON.stringify(items), total]
      )

      return res.json({
        ok: true,
        invoiceNumber,
        pdf: pdfBuffer.toString('base64'),
        filename: `Rechnung_${invoiceNumber}.pdf`,
      })
    }

    // Sammel-Rechnungslauf für alle (aktiven) Anfragen eines Events
    if (path === '/invoices/generate-event' && method === 'POST') {
      if (!await isAdmin(req.headers.authorization)) return res.status(401).json({ error: 'Unauthorized' })
      const { eventName, eventDate } = req.body
      if (!eventName) return res.status(400).json({ error: 'eventName fehlt' })
      const inqRes = eventDate
        ? await dbExecute("SELECT * FROM event_inquiries WHERE event_name = ? AND event_date = ? AND status != 'declined'", [eventName, eventDate])
        : await dbExecute("SELECT * FROM event_inquiries WHERE event_name = ? AND event_date IS NULL AND status != 'declined'", [eventName])
      const inquiries = inqRes.rows
      if (inquiries.length === 0) return res.status(404).json({ error: 'Keine Anfragen für dieses Event gefunden' })

      const eventRes = await dbExecute('SELECT * FROM events WHERE title = ? LIMIT 1', [eventName])
      const event = eventRes.rows[0] || null
      const seller = await getInvoiceSellerInfo()
      const invoiceDate = new Date().toLocaleDateString('de-DE')

      const results = []
      for (const inq of inquiries) {
        const items = computeInvoiceItems(inq, event)
        const total = items.every(it => it.total != null) ? Math.round(items.reduce((s, it) => s + it.total, 0) * 100) / 100 : null
        const invoiceNumber = await nextInvoiceNumber()
        const recipient = { company: inq.company, name: inq.name, street: inq.street, zipCity: inq.zip_city }
        const pdfBuffer = await buildInvoicePdf({ invoiceNumber, invoiceDate, seller, recipient, items, total })
        await dbExecute(
          'INSERT INTO invoices (invoice_number,invoice_date,inquiry_id,event_name,event_date,recipient_company,recipient_name,recipient_street,recipient_zip_city,items,total) VALUES (?,?,?,?,?,?,?,?,?,?,?)',
          [invoiceNumber, invoiceDate, inq.id, inq.event_name, inq.event_date, inq.company, inq.name, inq.street, inq.zip_city, JSON.stringify(items), total]
        )
        results.push({
          inquiryId: inq.id,
          company: inq.company,
          invoiceNumber,
          pdf: pdfBuffer.toString('base64'),
          filename: `Rechnung_${invoiceNumber}_${(inq.company || inq.name).replace(/[^\w\-äöüÄÖÜß]+/g, '_')}.pdf`,
        })
      }
      return res.json({ ok: true, count: results.length, invoices: results })
    }

    // Rechnung per Mail an den Händler verschicken
    if (path === '/invoices/send' && method === 'POST') {
      if (!await isAdmin(req.headers.authorization)) return res.status(401).json({ error: 'Unauthorized' })
      const { inquiry_id, invoiceNumber, pdfBase64, filename } = req.body
      if (!inquiry_id || !pdfBase64) return res.status(400).json({ error: 'Felder fehlen' })
      const inqRes = await dbExecute('SELECT * FROM event_inquiries WHERE id = ?', [inquiry_id])
      const inq = inqRes.rows[0]
      if (!inq) return res.status(404).json({ error: 'Anfrage nicht gefunden' })
      if (!process.env.BREVO_API_KEY) return res.status(500).json({ error: 'Mailversand nicht konfiguriert' })

      const brevoRes = await fetch('https://api.brevo.com/v3/smtp/email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json; charset=utf-8', 'api-key': process.env.BREVO_API_KEY },
        body: JSON.stringify({
          sender: { name: 'ShinyFam', email: 'info@shinyfam.de' },
          to: [{ email: inq.email, name: inq.name }],
          subject: `Rechnung ${invoiceNumber || ''} – ${inq.event_name}`,
          htmlContent: `<html><head><meta charset="utf-8"></head><body><p>Hallo ${inq.name},</p><p>anbei die Rechnung für eure Teilnahme bei ${inq.event_name}.</p><p>Viele Grüße<br>Das ShinyFam-Team<br>info@shinyfam.de</p></body></html>`,
          attachment: [{ name: filename || 'Rechnung.pdf', content: pdfBase64 }],
        }),
      })
      if (!brevoRes.ok) {
        const err = await brevoRes.json().catch(() => ({}))
        return res.status(500).json({ error: err.message || 'Mail-Versand fehlgeschlagen' })
      }
      if (invoiceNumber) await dbExecute("UPDATE invoices SET status = 'sent' WHERE invoice_number = ?", [invoiceNumber]).catch(() => {})
      return res.json({ ok: true })
    }

    // Contacts
    if (path === '/contacts') {
      if (!await isAdmin(req.headers.authorization)) return res.status(401).json({ error: 'Unauthorized' })
      if (method === 'GET') {
        const r = await dbExecute('SELECT * FROM contacts ORDER BY created_at DESC')
        return res.json(r.rows.map(row => ({ ...row, tags: JSON.parse(row.tags || '[]') })))
      }
      if (method === 'POST') {
        const { name, email, phone, notes, tags, subscribed, source } = req.body
        if (!name || !email) return res.status(400).json({ error: 'Name und E-Mail erforderlich' })
        await dbExecute('INSERT OR IGNORE INTO contacts (name,email,phone,notes,tags,subscribed,source) VALUES (?,?,?,?,?,?,?)', [name, email, phone || null, notes || null, JSON.stringify(tags || []), subscribed !== false ? 1 : 0, source || 'manual'])
        return res.status(201).json({ ok: true })
      }
    }
    const contactMatch = path.match(/^\/contacts\/(\d+)$/)
    if (contactMatch) {
      if (!await isAdmin(req.headers.authorization)) return res.status(401).json({ error: 'Unauthorized' })
      const cid = contactMatch[1]
      if (method === 'DELETE') {
        await dbExecute('DELETE FROM contacts WHERE id = ?', [cid])
        return res.json({ ok: true })
      }
      if (method === 'PATCH') {
        const { name, email, phone, notes, tags, subscribed } = req.body
        await dbExecute('UPDATE contacts SET name=?,email=?,phone=?,notes=?,tags=?,subscribed=? WHERE id=?', [name, email, phone || null, notes || null, JSON.stringify(tags || []), subscribed ? 1 : 0, cid])
        return res.json({ ok: true })
      }
    }

    // Newsletter send
    if (path === '/newsletter/send' && method === 'POST') {
      if (!await isAdmin(req.headers.authorization)) return res.status(401).json({ error: 'Unauthorized' })
      const { subject, body, tags } = req.body
      if (!subject || !body) return res.status(400).json({ error: 'Betreff und Text erforderlich' })
      // Get all subscribed contacts, optionally filtered by tags
      const allContacts = await dbExecute('SELECT * FROM contacts WHERE subscribed = 1')
      let recipients = allContacts.rows.map(r => ({ ...r, tags: JSON.parse(r.tags || '[]') }))
      if (tags && tags.length > 0) {
        recipients = recipients.filter(c => tags.some((t) => c.tags.includes(t)))
      }
      let sent = 0
      if (process.env.BREVO_API_KEY) {
        for (const contact of recipients) {
          await fetch('https://api.brevo.com/v3/smtp/email', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'api-key': process.env.BREVO_API_KEY },
            body: JSON.stringify({
              sender: { name: 'ShinyFam', email: 'info@shinyfam.de' },
              to: [{ email: contact.email, name: contact.name }],
              subject,
              textContent: body + '\n\n---\nUm dich abzumelden, antworte auf diese Mail mit "Abmelden".'
            })
          }).catch(() => {})
          sent++
        }
      }
      await dbExecute('INSERT INTO newsletter_sends (subject, body, tags, sent_count) VALUES (?,?,?,?)', [subject, body, JSON.stringify(tags || []), sent])
      return res.json({ ok: true, sent })
    }

    if (path === '/newsletter/history' && method === 'GET') {
      if (!await isAdmin(req.headers.authorization)) return res.status(401).json({ error: 'Unauthorized' })
      const r = await dbExecute('SELECT * FROM newsletter_sends ORDER BY created_at DESC LIMIT 20')
      return res.json(r.rows)
    }

    // Öffentlicher Newsletter-Signup (kein Auth nötig)
    if (path === '/newsletter/signup' && method === 'POST') {
      const { name, email } = req.body
      if (!email) return res.status(400).json({ error: 'E-Mail fehlt' })
      await dbExecute('INSERT OR IGNORE INTO contacts (name,email,tags,subscribed,source) VALUES (?,?,?,1,?)',
        [name || email.split('@')[0], email, JSON.stringify(['Newsletter']), 'newsletter-signup']).catch(() => {})
      // Bestätigungsmail
      if (process.env.BREVO_API_KEY) {
        fetch('https://api.brevo.com/v3/smtp/email', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'api-key': process.env.BREVO_API_KEY },
          body: JSON.stringify({
            sender: { name: 'ShinyFam', email: 'info@shinyfam.de' },
            to: [{ email, name: name || '' }],
            subject: 'Willkommen bei ShinyFam! 🃏',
            htmlContent: `<html><body><p>Hey${name ? ' ' + name : ''},</p><p>du bist jetzt im ShinyFam-Newsletter! Wir informieren dich über neue Events, Händler und Neuigkeiten aus der TCG-Community am Niederrhein.</p><p>Bis bald!<br>Das ShinyFam-Team<br>info@shinyfam.de</p></body></html>`
          })
        }).catch(() => {})
      }
      return res.json({ ok: true })
    }

    return res.status(404).json({ error: 'Not found', path })
  } catch (err) {
    console.error(err)
    return res.status(500).json({ error: 'Serverfehler' })
  }
})

// Static frontend
app.use(express.static(join(__dirname, 'dist')))
app.get('*splat', (req, res) => {
  res.sendFile(join(__dirname, 'dist', 'index.html'))
})


createServer(app).listen(PORT, () => {
  console.log(`ShinyFam server running on port ${PORT}`)
})
