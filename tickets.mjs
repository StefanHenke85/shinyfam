// ShinyFam Online-Tickets (Besucher-Eintritt + Haendler-Standbuchung)
// -------------------------------------------------------------------
// Eigenes Modul, damit server.mjs nur an zwei Stellen angefasst wird:
//   1. handleTickets(...) im /api-Router (vor dem 404)
//   2. ticketOgHtml(...) im Static-Catch-all (Vorschau-Text fuer Instagram/Facebook)
//
// Ablauf: Bestellung -> Status "pending" + Mail mit Zahlungsinfos
// (Ueberweisung oder PayPal.me, beides manuell bestaetigt) -> Admin klickt
// "bezahlt" -> Tickets mit QR-Code werden erzeugt und per Mail (PDF) verschickt
// -> am Einlass QR mit beliebiger Handy-Kamera scannen, eingeloggter Admin
// checkt auf /t/<code> ein.
//
// Haendler: Standbuchung legt zusaetzlich eine normale Haendleranfrage
// (event_inquiries) an, damit Rechnungen, Logos und Haendlerlisten wie
// gewohnt funktionieren. Unratütox-Gebühr (Standard 10 EUR) wird bar vor Ort
// kassiert und pro Haendler im Admin abgehakt (erhalten/zurueck/einbehalten).

import { randomBytes } from 'crypto'

const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789' // ohne 0/O/1/I

function randomCode(len) {
  const bytes = randomBytes(len)
  let s = ''
  for (let i = 0; i < len; i++) s += CODE_ALPHABET[bytes[i] % CODE_ALPHABET.length]
  return s
}

const euro = (n) => `${Number(n || 0).toFixed(2).replace('.', ',')} €`

function esc(s) {
  return String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]))
}

function baseUrl() {
  return (process.env.TICKETS_BASE_URL || 'https://shinyfam.de').replace(/\/$/, '')
}

// ---------- Event-Tage ----------
const DAY_NAMES = ['Sonntag', 'Montag', 'Dienstag', 'Mittwoch', 'Donnerstag', 'Freitag', 'Samstag']

function eventDays(ev) {
  const d1 = ev.date ? ev.date.slice(0, 10) : null
  const d2 = ev.end_date ? ev.end_date.slice(0, 10) : null
  const days = []
  if (d1) days.push({ key: 'tag1', date: d1 })
  if (d2 && d2 !== d1) days.push({ key: 'tag2', date: d2 })
  return days.map((d) => {
    const dt = new Date(d.date + 'T12:00:00')
    return { ...d, label: `${DAY_NAMES[dt.getDay()]}, ${d.date.slice(8, 10)}.${d.date.slice(5, 7)}.${d.date.slice(0, 4)}` }
  })
}

function daysForKey(key) {
  if (key === 'beide') return ['tag1', 'tag2']
  return [key]
}

function dayLabel(ev, key) {
  if (key === 'beide') return 'Beide Tage'
  const d = eventDays(ev).find((x) => x.key === key)
  return d ? d.label : key
}

function defaultConfig(ev) {
  const fee = ev.entry_fee != null ? Number(ev.entry_fee) : 3
  const days = eventDays(ev)
  const visitorOptions = days.map((d) => ({ key: d.key, label: `Tagesticket ${d.label}`, price: fee, enabled: true }))
  if (days.length > 1) visitorOptions.push({ key: 'beide', label: 'Wochenendticket (beide Tage)', price: Math.round(fee * 2 * 100) / 100, enabled: true })
  let allowed = null
  try { allowed = ev.allowed_attendance_days ? JSON.parse(ev.allowed_attendance_days) : null } catch { /* ignorieren */ }
  return {
    slug: '',
    visitorEnabled: false,
    visitorOptions,
    visitorLimit: null,
    visitorInfo: 'Kinder unter 16 Jahren haben freien Eintritt.',
    dealerEnabled: false,
    dealerMeterOptions: [2, 3, 4, 5, 6],
    dealerDayOptions: allowed && allowed.length ? allowed : (days.length > 1 ? ['beide', 'tag1', 'tag2'] : ['tag1']),
    dealerPricePerMeterDay: ev.price_per_meter_day != null ? Number(ev.price_per_meter_day) : null,
    dealerLimit: null,
    // Tischbestand pro Event (12.11.2026): [{ length: 1.2, count: 40 }, ...].
    // Ist er gesetzt, waehlen Haendler Tische statt Meter.
    dealerTables: [],
    dealerMaxMeters: 6,
    depositAmount: 10,
    salesEnd: ev.date || null,
    paypalEnabled: true,
    transferEnabled: true,
  }
}

// ---------- DB ----------
let schemaReady = false
async function ensureSchema(db) {
  if (schemaReady) return
  await db(`CREATE TABLE IF NOT EXISTS ticket_config (event_id TEXT PRIMARY KEY, slug TEXT, data TEXT NOT NULL, updated_at TEXT DEFAULT (datetime('now')))`).catch(() => {})
  await db(`CREATE TABLE IF NOT EXISTS ticket_orders (id INTEGER PRIMARY KEY AUTOINCREMENT, order_number TEXT UNIQUE NOT NULL, access_key TEXT NOT NULL, event_id TEXT NOT NULL, event_title TEXT, kind TEXT NOT NULL, name TEXT NOT NULL, email TEXT NOT NULL, phone TEXT, company TEXT, street TEXT, zip_city TEXT, customer_type TEXT, items TEXT NOT NULL, total REAL NOT NULL, payment_method TEXT NOT NULL, payment_status TEXT DEFAULT 'pending', inquiry_id INTEGER, admin_note TEXT, created_at TEXT DEFAULT (datetime('now')), paid_at TEXT, cancelled_at TEXT)`).catch(() => {})
  await db(`CREATE TABLE IF NOT EXISTS tickets (code TEXT PRIMARY KEY, order_id INTEGER NOT NULL, event_id TEXT NOT NULL, kind TEXT NOT NULL, label TEXT NOT NULL, valid_days TEXT NOT NULL, holder TEXT, checkins TEXT DEFAULT '{}', status TEXT DEFAULT 'valid', created_at TEXT DEFAULT (datetime('now')))`).catch(() => {})
  await db(`ALTER TABLE ticket_orders ADD COLUMN is_test INTEGER DEFAULT 0`).catch(() => {})
  await db(`ALTER TABLE event_inquiries ADD COLUMN deposit_status TEXT DEFAULT NULL`).catch(() => {})
  await db(`ALTER TABLE event_inquiries ADD COLUMN deposit_note TEXT DEFAULT NULL`).catch(() => {})
  await db(`ALTER TABLE event_inquiries ADD COLUMN ticket_order TEXT DEFAULT NULL`).catch(() => {})
  schemaReady = true
}

async function loadEvent(db, id) {
  const r = await db('SELECT * FROM events WHERE id = ? LIMIT 1', [id])
  return r.rows[0] || null
}

async function loadConfig(db, ev) {
  const r = await db('SELECT data FROM ticket_config WHERE event_id = ?', [ev.id])
  const base = defaultConfig(ev)
  if (!r.rows[0]) return { ...base, saved: false }
  try { return { ...base, ...JSON.parse(r.rows[0].data), saved: true } } catch { return { ...base, saved: false } }
}

async function findEventBySlugOrId(db, key) {
  const k = String(key || '').toLowerCase()
  const bySlug = await db('SELECT event_id FROM ticket_config WHERE lower(slug) = ? LIMIT 1', [k])
  const id = bySlug.rows[0]?.event_id || key
  return loadEvent(db, id)
}

// PayPal.me-Name aus allem, was im Admin eingetragen wird: "shinyfam", "@shinyfam",
// "paypal.me/shinyfam", "https://www.paypal.com/paypalme/ShinyFam/" usw.
function paypalName(v) {
  let s = String(v || '').trim()
  const m = s.match(/paypal(?:\.me|\.com\/paypalme)\/+([^/?#\s]+)/i)
  if (m) s = m[1]
  return s.replace(/^@/, '').replace(/[/?#].*$/, '').trim()
}

async function getSettings(db) {
  const r = await db("SELECT key, value FROM settings WHERE key LIKE 'ticket_%'")
  const s = {}
  for (const row of r.rows) s[row.key] = row.value
  return {
    bankHolder: s.ticket_bank_holder || '',
    iban: s.ticket_iban || '',
    bic: s.ticket_bic || '',
    bankName: s.ticket_bank_name || '',
    // Testmodus: Standard AN, bis im Admin bewusst ausgeschaltet
    sandbox: s.ticket_sandbox !== 'false',
    paypalMe: paypalName(s.ticket_paypal_me),
  }
}

async function soldCounts(db, eventId, sandbox = false) {
  const r = await db("SELECT kind, items FROM ticket_orders WHERE event_id = ? AND payment_status != 'cancelled' AND COALESCE(is_test,0) = ?", [eventId, sandbox ? 1 : 0])
  let visitors = 0, dealers = 0
  const tableUse = { tag1: {}, tag2: {} } // tag -> laenge -> belegte Tische
  for (const row of r.rows) {
    if (row.kind === 'dealer') {
      dealers++
      try {
        for (const it of JSON.parse(row.items)) {
          for (const t of it.tables || []) {
            for (const day of it.days || []) {
              const k = String(Number(t.length))
              tableUse[day] ||= {}
              tableUse[day][k] = (tableUse[day][k] || 0) + Number(t.qty || 0)
            }
          }
        }
      } catch { /* */ }
      continue
    }
    try { for (const it of JSON.parse(row.items)) visitors += Number(it.qty || 0) } catch { /* */ }
  }
  return { visitors, dealers, tableUse }
}

const fmtM = (n) => String(Math.round(Number(n) * 100) / 100).replace('.', ',')

// Freie Tische je Laenge fuer eine Tageskombination (Minimum ueber die Tage)
function tablesFree(cfg, counts, days) {
  return (cfg.dealerTables || []).map((t) => {
    const k = String(Number(t.length))
    const used = Math.max(0, ...days.map((d) => counts.tableUse?.[d]?.[k] || 0))
    return { length: Number(t.length), total: Number(t.count), free: Math.max(0, Number(t.count) - used) }
  })
}

function salesOpen(cfg) {
  if (!cfg.salesEnd) return true
  return Date.now() < new Date(cfg.salesEnd).getTime()
}

// ---------- Mail ----------
async function sendMail({ to, toName, subject, html, attachments, replyTo }) {
  if (!process.env.BREVO_API_KEY) return false
  const body = {
    sender: { name: 'ShinyFam Tickets', email: 'info@shinyfam.de' },
    to: [{ email: to, ...(toName ? { name: toName } : {}) }],
    subject,
    htmlContent: `<html><head><meta charset="utf-8"></head><body style="font-family:Arial,sans-serif;color:#1a1a2e;line-height:1.5">${html}</body></html>`,
  }
  if (replyTo) body.replyTo = replyTo
  if (attachments?.length) body.attachment = attachments
  try {
    const r = await fetch('https://api.brevo.com/v3/smtp/email', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json; charset=utf-8', 'api-key': process.env.BREVO_API_KEY },
      body: JSON.stringify(body),
    })
    if (!r.ok) console.error('[tickets] Mailfehler', r.status, await r.text().catch(() => ''))
    return r.ok
  } catch (e) {
    console.error('[tickets] Mailfehler', e?.message || e)
    return false
  }
}

const isTest = (o) => o?.is_test === 1 || o?.is_test === '1' || o?.is_test === true
const TEST_NOTE = '<p style="background:#fde2e2;border:1px solid #f59e9e;border-radius:8px;padding:10px 12px"><strong>TESTBESTELLUNG</strong> – nur ein Test, es wird kein Geld eingezogen und die Tickets gelten nicht am Einlass.</p>'

function paymentBlockHtml(order, settings) {
  const parts = []
  if (isTest(order)) {
    parts.push(TEST_NOTE)
    settings = { ...settings, bankHolder: settings.bankHolder || 'Test-Konto', iban: settings.iban || 'DE00 0000 0000 0000 0000 00 (Test)', paypalMe: settings.paypalMe || 'test' }
  }
  if (order.payment_method === 'transfer') {
    parts.push(`<p><strong>Bitte überweise ${euro(order.total)} an:</strong><br>
      Kontoinhaber: ${esc(settings.bankHolder || '(wird noch ergänzt)')}<br>
      IBAN: ${esc(settings.iban || '(wird noch ergänzt)')}<br>
      ${settings.bic ? `BIC: ${esc(settings.bic)}<br>` : ''}${settings.bankName ? `Bank: ${esc(settings.bankName)}<br>` : ''}
      <strong>Verwendungszweck: ${esc(order.order_number)}</strong></p>`)
  } else {
    const link = settings.paypalMe ? `https://paypal.me/${encodeURIComponent(settings.paypalMe)}/${Number(order.total).toFixed(2)}EUR` : null
    parts.push(`<p><strong>Bitte zahle ${euro(order.total)} per PayPal:</strong><br>
      ${link ? `<a href="${link}" style="display:inline-block;margin:8px 0;padding:10px 18px;background:#0070ba;color:#fff;border-radius:8px;text-decoration:none">Jetzt mit PayPal bezahlen</a><br>` : '(PayPal-Link wird noch ergänzt)<br>'}
      Bitte gib als Nachricht unbedingt <strong>${esc(order.order_number)}</strong> an, damit wir deine Zahlung zuordnen können.</p>`)
  }
  parts.push('<p>Sobald deine Zahlung bei uns eingegangen ist, bekommst du deine Tickets mit QR-Code per E-Mail.</p>')
  return parts.join('')
}

function statusLink(order) {
  return `${baseUrl()}/tickets/bestellung/${order.order_number}?k=${order.access_key}`
}

function itemsHtml(items) {
  return '<table style="border-collapse:collapse;margin:8px 0">' + items.map((it) =>
    `<tr><td style="padding:3px 12px 3px 0">${it.qty} × ${esc(it.label)}</td><td style="padding:3px 0;text-align:right">${euro(it.qty * it.price)}</td></tr>`).join('') + '</table>'
}

function depositHtml(cfg) {
  const amount = cfg?.depositAmount != null ? Number(cfg.depositAmount) : 10
  if (!amount) return ''
  return `<p style="background:#fff7e6;border:1px solid #f5c26b;border-radius:8px;padding:10px 12px"><strong>Wichtig – Unratütox-Gebühr:</strong> Vor Ort nehmen wir eine Unratütox-Gebühr von <strong>${euro(amount)} in bar</strong>. Bitte passend mitbringen. Du bekommst sie nach der Messe zurück, wenn deine Standfläche sauber und ordentlich hinterlassen wurde.</p>`
}

async function mailOrderReceived(order, ev, cfg, settings) {
  const items = JSON.parse(order.items)
  const isDealer = order.kind === 'dealer'
  await sendMail({
    to: order.email, toName: order.name,
    subject: `${isTest(order) ? '[TEST] ' : ''}${isDealer ? 'Deine Standbuchung' : 'Deine Ticketbestellung'} ${order.order_number} – ${ev.title.trim()}`,
    html: `<h2 style="color:#7c3aed">Danke für deine ${isDealer ? 'Standbuchung' : 'Bestellung'}, ${esc(order.name)}!</h2>
      <p><strong>${esc(ev.title.trim())}</strong><br>${esc(ev.location || '')}, ${esc(ev.address || '')} ${esc(ev.city || '')}</p>
      ${itemsHtml(items)}
      <p><strong>Gesamt: ${euro(order.total)}</strong> · Bestellnummer: <strong>${esc(order.order_number)}</strong></p>
      ${paymentBlockHtml(order, settings)}
      ${isDealer ? depositHtml(cfg) : ''}
      <p>Den Stand deiner Bestellung kannst du jederzeit hier ansehen:<br><a href="${statusLink(order)}">${statusLink(order)}</a></p>
      <p>Viele Grüße<br>Dein ShinyFam-Team<br>info@shinyfam.de</p>`,
  })
}

// ---------- QR / PDF ----------
async function qrPng(text, size = 320) {
  const QR = await import('qrcode')
  return (QR.default || QR).toBuffer(text, { type: 'png', width: size, margin: 1, errorCorrectionLevel: 'M' })
}

function ticketUrl(code) {
  return `${baseUrl()}/t/${code}`
}

async function buildTicketsPdf(order, ev, tickets, cfg) {
  const { default: PDFDocument } = await import('pdfkit')
  const qrs = await Promise.all(tickets.map((t) => qrPng(ticketUrl(t.code), 400)))
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ margin: 50, size: 'A4' })
    const chunks = []
    doc.on('data', (c) => chunks.push(c))
    doc.on('end', () => resolve(Buffer.concat(chunks)))
    doc.on('error', reject)
    tickets.forEach((t, i) => {
      if (i > 0) doc.addPage()
      const W = doc.page.width
      doc.rect(0, 0, W, 10).fill('#7c3aed')
      doc.fontSize(24).fillColor('#7c3aed').font('Helvetica-Bold').text('ShinyFam', 50, 36)
      doc.fontSize(10).fillColor('#888').font('Helvetica').text('TCG Community am Niederrhein · shinyfam.de', 50, 64)
      doc.fontSize(20).fillColor('#1a1a2e').font('Helvetica-Bold').text(ev.title.trim(), 50, 110, { width: W - 100 })
      doc.fontSize(11).fillColor('#4a5070').font('Helvetica').text([ev.location, ev.address, ev.city].map((x) => String(x || '').trim()).filter(Boolean).join(', '), 50, 140, { width: W - 100 })
      doc.roundedRect(50, 175, W - 100, 330, 12).lineWidth(1.5).strokeColor('#e0d6ff').stroke()
      doc.image(qrs[i], 70, 195, { width: 220 })
      doc.fontSize(9).fillColor('#8a90a8').text(t.kind === 'dealer' ? 'HÄNDLER-TICKET' : 'EINTRITTSKARTE', 310, 200)
      // Fliesslayout (12.11.): lange Texte brechen um und schieben den Rest nach unten
      const TW = W - 370
      doc.fontSize(16).fillColor('#1a1a2e').font('Helvetica-Bold').text(t.label, 310, 216, { width: TW })
      doc.fontSize(11).fillColor('#4a5070').font('Helvetica')
      const days = JSON.parse(t.valid_days).map((k) => dayLabel(ev, k)).join('\n')
      doc.moveDown(0.8).text('Gültig:', 310, doc.y, { width: TW })
      doc.font('Helvetica-Bold').text(days, 310, doc.y, { width: TW }).font('Helvetica')
      if (t.holder) doc.moveDown(0.5).text(`Name: ${t.holder}`, 310, doc.y, { width: TW })
      doc.text(`Bestellung: ${order.order_number}`, 310, doc.y + 2, { width: TW })
      doc.fontSize(18).fillColor('#7c3aed').font('Helvetica-Bold').text(t.code, 310, Math.max(doc.y + 14, 345))
      doc.fontSize(9).fillColor('#8a90a8').font('Helvetica').text('Ticket-Code (falls der QR-Code nicht lesbar ist)', 310, doc.y + 2, { width: TW })
      if (isTest(order)) {
        doc.save().rotate(-20, { origin: [W / 2, 420] }).fontSize(60).fillColor('#e11d48').fillOpacity(0.18).font('Helvetica-Bold').text('TEST – UNGÜLTIG', 0, 400, { width: W, align: 'center' }).restore()
        doc.fillOpacity(1).font('Helvetica')
      }
      if (t.kind === 'dealer' && cfg?.depositAmount) {
        const dy = Math.max(doc.y + 14, 400)
        doc.roundedRect(310, dy, W - 380, 80, 8).fill('#fff7e6')
        doc.fontSize(10).fillColor('#8a5a00').font('Helvetica-Bold').text(`Unratütox-Gebühr ${euro(cfg.depositAmount)} in bar mitbringen`, 320, dy + 10, { width: W - 400 })
        doc.fontSize(9).font('Helvetica').text('Rückgabe nach der Messe, wenn die Standfläche sauber und ordentlich hinterlassen wurde.', 320, doc.y + 4, { width: W - 400 })
      }
      doc.fontSize(9).fillColor('#4a5070').font('Helvetica').text('Bitte dieses Ticket ausgedruckt oder auf dem Handy am Einlass vorzeigen. Jeder QR-Code ist nur einmal pro Tag gültig. Weitergabe nur unverändert erlaubt; der erste Scan zählt.', 50, 525, { width: W - 100 })
      doc.fontSize(8).fillColor('#aaa').text('ShinyFam · Heike Karg · Bönninghardter Straße 72, 46519 Alpen · info@shinyfam.de', 50, doc.page.height - 70, { width: W - 100, align: 'center' })
    })
    doc.end()
  })
}

async function issueTickets(db, order, ev) {
  const existing = await db('SELECT * FROM tickets WHERE order_id = ?', [order.id])
  if (existing.rows.length) return existing.rows
  const items = JSON.parse(order.items)
  for (const it of items) {
    for (let n = 0; n < Number(it.qty || 0); n++) {
      const code = randomCode(10)
      await db('INSERT INTO tickets (code, order_id, event_id, kind, label, valid_days, holder) VALUES (?,?,?,?,?,?,?)',
        [code, order.id, order.event_id, order.kind, it.label, JSON.stringify(it.days), order.kind === 'dealer' ? (order.company || order.name) : order.name])
    }
  }
  return (await db('SELECT * FROM tickets WHERE order_id = ? ORDER BY created_at, code', [order.id])).rows
}

async function mailTickets(db, order, ev, cfg) {
  const tickets = (await db('SELECT * FROM tickets WHERE order_id = ? ORDER BY created_at, code', [order.id])).rows
  if (!tickets.length) return false
  const pdf = await buildTicketsPdf(order, ev, tickets, cfg)
  const isDealer = order.kind === 'dealer'
  return sendMail({
    to: order.email, toName: order.name,
    subject: `${isTest(order) ? '[TEST] ' : ''}${isDealer ? 'Deine Standbestätigung' : 'Deine Tickets'} für ${ev.title.trim()} (${order.order_number})`,
    html: `<h2 style="color:#7c3aed">Zahlung erhalten – ${isDealer ? 'dein Stand ist bestätigt' : 'hier sind deine Tickets'}!</h2>
      <p>Hallo ${esc(order.name)},</p>
      <p>vielen Dank, deine Zahlung über <strong>${euro(order.total)}</strong> ist bei uns eingegangen.
      Im Anhang findest du ${tickets.length === 1 ? 'dein Ticket' : `deine ${tickets.length} Tickets`} als PDF.
      Zeig den QR-Code einfach am Einlass vor – ausgedruckt oder auf dem Handy.</p>
      ${isDealer ? depositHtml(cfg) : ''}
      <p>Deine Tickets kannst du auch jederzeit online abrufen:<br><a href="${statusLink(order)}">${statusLink(order)}</a></p>
      <p><strong>${esc(ev.title.trim())}</strong><br>${esc(ev.location || '')}, ${esc(ev.address || '')} ${esc(ev.city || '')}</p>
      <p>Wir freuen uns auf dich!<br>Dein ShinyFam-Team</p>`,
    attachments: [{ name: `ShinyFam-Tickets-${order.order_number}.pdf`, content: pdf.toString('base64') }],
  })
}

// ---------- einfache Missbrauchsbremse ----------
const orderHits = new Map()
function rateLimited(ip) {
  const now = Date.now()
  const arr = (orderHits.get(ip) || []).filter((t) => now - t < 3600_000)
  arr.push(now)
  orderHits.set(ip, arr)
  return arr.length > 12
}

function publicOrder(o) {
  return {
    orderNumber: o.order_number, kind: o.kind, name: o.name, email: o.email, company: o.company,
    items: JSON.parse(o.items), total: Number(o.total), paymentMethod: o.payment_method,
    paymentStatus: o.payment_status, createdAt: o.created_at, paidAt: o.paid_at,
  }
}

function adminOrder(o) {
  return { ...publicOrder(o), isTest: isTest(o), id: Number(o.id), eventId: o.event_id, eventTitle: o.event_title, phone: o.phone, street: o.street, zipCity: o.zip_city, customerType: o.customer_type, inquiryId: o.inquiry_id != null ? Number(o.inquiry_id) : null, adminNote: o.admin_note, accessKey: o.access_key, cancelledAt: o.cancelled_at }
}

function currentEventDayKey(ev) {
  const today = new Date().toLocaleDateString('sv-SE', { timeZone: 'Europe/Berlin' })
  const d = eventDays(ev).find((x) => x.date === today)
  return d ? d.key : null
}

// ===================================================================
// Router
// ===================================================================
export async function handleTickets(req, res, path, method, { dbExecute: db, isAdmin, notifyWhatsApp }) {
  if (!(path.startsWith('/tickets') || path.startsWith('/ticket-'))) return false
  await ensureSchema(db)
  const admin = async () => isAdmin(req.headers.authorization)
  const deny = () => res.status(401).json({ error: 'Unauthorized' })

  // ---- Oeffentlich: Events mit Verkauf ----
  if (path === '/tickets/shop' && method === 'GET') {
    const r = await db('SELECT c.event_id, c.slug, c.data, e.title, e.date, e.end_date, e.city, e.location FROM ticket_config c JOIN events e ON e.id = c.event_id ORDER BY e.date ASC')
    const out = []
    for (const row of r.rows) {
      let cfg = {}
      try { cfg = JSON.parse(row.data) } catch { /* */ }
      if (!(cfg.visitorEnabled || cfg.dealerEnabled)) continue
      if (row.end_date && new Date(row.end_date).getTime() < Date.now() - 86400000) continue
      out.push({ eventId: row.event_id, slug: row.slug || row.event_id, title: row.title.trim(), date: row.date, endDate: row.end_date, city: (row.city || '').trim(), location: (row.location || '').trim(), visitorEnabled: !!cfg.visitorEnabled, dealerEnabled: !!cfg.dealerEnabled, open: salesOpen(cfg) })
    }
    return res.json(out), true
  }

  const shopMatch = path.match(/^\/tickets\/shop\/([^/]+)$/)
  if (shopMatch && method === 'GET') {
    const ev = await findEventBySlugOrId(db, decodeURIComponent(shopMatch[1]))
    if (!ev) return res.status(404).json({ error: 'Event nicht gefunden' }), true
    const cfg = await loadConfig(db, ev)
    const isAdm = await admin()
    if (!(cfg.visitorEnabled || cfg.dealerEnabled) && !isAdm) return res.status(404).json({ error: 'Für dieses Event gibt es (noch) keinen Online-Verkauf.' }), true
    const settings = await getSettings(db)
    const counts = await soldCounts(db, ev.id, settings.sandbox)
    let schedule = null
    try { schedule = ev.schedule ? JSON.parse(ev.schedule) : null } catch { /* */ }
    return res.json({
      event: { id: ev.id, title: ev.title.trim(), date: ev.date, endDate: ev.end_date, location: (ev.location || '').trim(), address: (ev.address || '').trim(), city: (ev.city || '').trim(), imageUrl: ev.image_url || null, schedule, soldOut: !!ev.sold_out_label },
      days: eventDays(ev),
      open: salesOpen(cfg),
      preview: !(cfg.visitorEnabled || cfg.dealerEnabled),
      visitor: cfg.visitorEnabled || isAdm ? {
        enabled: !!cfg.visitorEnabled,
        options: cfg.visitorOptions.filter((o) => o.enabled !== false).map((o) => ({ key: o.key, label: o.label, price: Number(o.price) })),
        remaining: cfg.visitorLimit ? Math.max(0, cfg.visitorLimit - counts.visitors) : null,
        info: cfg.visitorInfo || '',
      } : null,
      dealer: cfg.dealerEnabled || isAdm ? {
        enabled: !!cfg.dealerEnabled && !ev.sold_out_label,
        meterOptions: cfg.dealerMeterOptions,
        dayOptions: cfg.dealerDayOptions.map((k) => ({ key: k, label: dayLabel(ev, k), days: daysForKey(k).length })),
        pricePerMeterDay: cfg.dealerPricePerMeterDay,
        remaining: cfg.dealerLimit ? Math.max(0, cfg.dealerLimit - counts.dealers) : null,
        maxMeters: Number(cfg.dealerMaxMeters || 0) || null,
        tables: (cfg.dealerTables || []).length ? Object.fromEntries(cfg.dealerDayOptions.map((k) => [k, tablesFree(cfg, counts, daysForKey(k))])) : null,
        depositAmount: Number(cfg.depositAmount || 0),
      } : null,
      sandbox: settings.sandbox,
      payment: { paypal: !!cfg.paypalEnabled && (!!settings.paypalMe || settings.sandbox), transfer: !!cfg.transferEnabled && (!!settings.iban || settings.sandbox) },
    }), true
  }

  // ---- Oeffentlich: Bestellung anlegen ----
  if (path === '/tickets/order' && method === 'POST') {
    const ip = String(req.headers['x-forwarded-for'] || req.socket?.remoteAddress || '').split(',')[0].trim()
    if (rateLimited(ip)) return res.status(429).json({ error: 'Zu viele Bestellungen in kurzer Zeit. Bitte später erneut versuchen.' }), true
    const b = req.body || {}
    const ev = await loadEvent(db, String(b.eventId || ''))
    if (!ev) return res.status(404).json({ error: 'Event nicht gefunden' }), true
    const cfg = await loadConfig(db, ev)
    const settings = await getSettings(db)
    if (!salesOpen(cfg)) return res.status(400).json({ error: 'Der Online-Verkauf für dieses Event ist beendet.' }), true
    const name = String(b.name || '').trim().slice(0, 120)
    const email = String(b.email || '').trim().slice(0, 160)
    if (!name || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return res.status(400).json({ error: 'Bitte Name und gültige E-Mail angeben.' }), true
    if (!b.acceptTerms) return res.status(400).json({ error: 'Bitte die Teilnahme- und Ticketbedingungen akzeptieren.' }), true
    const pm = b.paymentMethod === 'paypal' ? 'paypal' : 'transfer'
    if (pm === 'paypal' && !(cfg.paypalEnabled && (settings.paypalMe || settings.sandbox))) return res.status(400).json({ error: 'PayPal ist für dieses Event nicht verfügbar.' }), true
    if (pm === 'transfer' && !(cfg.transferEnabled && (settings.iban || settings.sandbox))) return res.status(400).json({ error: 'Überweisung ist für dieses Event nicht verfügbar.' }), true
    const counts = await soldCounts(db, ev.id, settings.sandbox)
    const kind = b.kind === 'dealer' ? 'dealer' : 'visitor'
    let items = []
    let extra = {}

    if (kind === 'visitor') {
      if (!cfg.visitorEnabled) return res.status(400).json({ error: 'Besuchertickets sind für dieses Event nicht freigeschaltet.' }), true
      const q = b.quantities || {}
      for (const o of cfg.visitorOptions) {
        if (o.enabled === false) continue
        const qty = Math.max(0, Math.min(10, parseInt(q[o.key] || 0, 10) || 0))
        if (qty) items.push({ key: o.key, label: o.label, price: Number(o.price), qty, days: daysForKey(o.key) })
      }
      const total = items.reduce((s, i) => s + i.qty, 0)
      if (!total) return res.status(400).json({ error: 'Bitte mindestens ein Ticket auswählen.' }), true
      if (total > 10) return res.status(400).json({ error: 'Maximal 10 Tickets pro Bestellung.' }), true
      if (cfg.visitorLimit && counts.visitors + total > cfg.visitorLimit) return res.status(400).json({ error: `Leider sind nur noch ${Math.max(0, cfg.visitorLimit - counts.visitors)} Tickets verfügbar.` }), true
    } else {
      if (!cfg.dealerEnabled || ev.sold_out_label) return res.status(400).json({ error: 'Die Online-Standbuchung ist für dieses Event nicht verfügbar.' }), true
      if (cfg.dealerLimit && counts.dealers >= cfg.dealerLimit) return res.status(400).json({ error: 'Leider sind alle online buchbaren Stände vergeben.' }), true
      const dayKey = String(b.days || '')
      if (!cfg.dealerDayOptions.includes(dayKey)) return res.status(400).json({ error: 'Diese Teilnahme-Option ist nicht buchbar.' }), true
      let meters = Number(b.meters)
      let tables = null
      if ((cfg.dealerTables || []).length) {
        // Tischmodus: b.tables = { "1.2": 3, "1.8": 1 }
        const want = b.tables && typeof b.tables === 'object' ? b.tables : {}
        const free = tablesFree(cfg, counts, daysForKey(dayKey))
        tables = []
        for (const t of free) {
          const q = Math.max(0, Math.min(20, parseInt(want[String(t.length)] || 0, 10) || 0))
          if (!q) continue
          if (q > t.free) return res.status(400).json({ error: `Von den ${fmtM(t.length)}-m-Tischen sind nur noch ${t.free} frei.` }), true
          tables.push({ length: t.length, qty: q })
        }
        if (!tables.length) return res.status(400).json({ error: 'Bitte mindestens einen Tisch auswählen.' }), true
        meters = Math.round(tables.reduce((s, t) => s + t.length * t.qty, 0) * 100) / 100
        const maxM = Number(cfg.dealerMaxMeters || 0)
        if (maxM && meters > maxM + 0.001) return res.status(400).json({ error: `Maximal ${fmtM(maxM)} m pro Händler.` }), true
      } else if (!cfg.dealerMeterOptions.map(Number).includes(meters)) return res.status(400).json({ error: 'Diese Standgröße ist nicht buchbar.' }), true
      if (cfg.dealerPricePerMeterDay == null) return res.status(400).json({ error: 'Für dieses Event ist noch kein Standpreis hinterlegt.' }), true
      const street = String(b.street || '').trim(), zipCity = String(b.zipCity || '').trim()
      const customerType = b.customerType === 'privat' ? 'privat' : 'gewerblich'
      const company = String(b.company || '').trim()
      if (!street || !zipCity || (customerType === 'gewerblich' && !company)) return res.status(400).json({ error: 'Bitte Adresse' + (customerType === 'gewerblich' ? ' und Firmenname' : '') + ' angeben.' }), true
      const nDays = daysForKey(dayKey).length
      const price = Math.round(Number(cfg.dealerPricePerMeterDay) * meters * nDays * 100) / 100
      const tablesText = tables ? tables.map((t) => `${t.qty}× ${fmtM(t.length)} m`).join(' + ') : ''
      items = [{ key: dayKey, label: `Händlerstand ${fmtM(meters)} m${tables ? ` (${tablesText})` : ''} – ${dayLabel(ev, dayKey)}`, price, qty: 1, days: daysForKey(dayKey), meters, ...(tables ? { tables } : {}) }]
      extra = { company, street, zipCity, customerType, tcg: String(b.tcg || '').slice(0, 80), message: String(b.message || '').slice(0, 1000), logoUrl: typeof b.logoUrl === 'string' && b.logoUrl.length < 400000 ? b.logoUrl : null, meters, dayKey, nDays, tablesText }
    }

    const total = Math.round(items.reduce((s, i) => s + i.price * i.qty, 0) * 100) / 100
    let orderNumber
    for (let i = 0; i < 5; i++) {
      orderNumber = 'TK-' + randomCode(6)
      const dup = await db('SELECT 1 FROM ticket_orders WHERE order_number = ?', [orderNumber])
      if (!dup.rows.length) break
    }
    const accessKey = randomBytes(12).toString('hex')
    const phone = String(b.phone || '').trim().slice(0, 40) || null
    await db('INSERT INTO ticket_orders (order_number, access_key, event_id, event_title, kind, name, email, phone, company, street, zip_city, customer_type, items, total, payment_method, is_test) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)',
      [orderNumber, accessKey, ev.id, ev.title, kind, name, email, phone, extra.company || null, extra.street || null, extra.zipCity || null, extra.customerType || null, JSON.stringify(items), total, pm, settings.sandbox ? 1 : 0])
    const order = (await db('SELECT * FROM ticket_orders WHERE order_number = ?', [orderNumber])).rows[0]

    if (kind === 'dealer' && !settings.sandbox) {
      // normale Haendleranfrage mitfuehren (Rechnung, Logo, Haendlerliste)
      await db('INSERT INTO event_inquiries (name,email,event_name,event_date,tcg,meters,message,attendance_days,logo_url,company,phone,street,zip_city,meters_num,days_count,customer_type,ticket_order) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)',
        [name, email, ev.title, ev.date, extra.tcg || null, `${fmtM(extra.meters)}m${extra.tablesText ? ' (' + extra.tablesText + ')' : ''}`, `[Online-Buchung ${orderNumber}, ${pm === 'paypal' ? 'PayPal' : 'Überweisung'}, ${euro(total)}, noch nicht bezahlt]${extra.message ? '\n' + extra.message : ''}`, extra.dayKey, extra.logoUrl, extra.company || null, phone, extra.street, extra.zipCity, extra.meters, extra.nDays, extra.customerType, orderNumber]).catch((e) => console.error('[tickets] inquiry', e))
      const inq = await db('SELECT id FROM event_inquiries WHERE ticket_order = ? ORDER BY id DESC LIMIT 1', [orderNumber]).catch(() => ({ rows: [] }))
      if (inq.rows[0]) await db('UPDATE ticket_orders SET inquiry_id = ? WHERE id = ?', [inq.rows[0].id, order.id])
      const brandName = extra.customerType === 'gewerblich' ? extra.company : name
      if (extra.logoUrl && brandName) {
        const ex = await db('SELECT id FROM brands WHERE name = ?', [brandName]).catch(() => ({ rows: [] }))
        if (!ex.rows.length) await db('INSERT INTO brands (id,name,logo_url,sort_order) VALUES (?,?,?,?)', [`brand-${Date.now()}`, brandName, extra.logoUrl, 9999]).catch(() => {})
      }
      await db('INSERT OR IGNORE INTO contacts (name,email,phone,tags,subscribed,source) VALUES (?,?,?,?,1,?)', [extra.company ? `${extra.company} (${name})` : name, email, phone, JSON.stringify(['Händler']), 'ticket-dealer']).catch(() => {})
    }

    mailOrderReceived(order, ev, cfg, settings).catch(() => {})
    // Testmodus: keine Haendleranfrage, keine Mail an info@, kein WhatsApp
    if (settings.sandbox) return res.json({ ok: true, orderNumber, key: accessKey, test: true }), true
    const summary = `${kind === 'dealer' ? '🏪 Neue Online-Standbuchung' : '🎟️ Neue Ticketbestellung'} ${orderNumber}\n${ev.title.trim()}\n${name}${extra.company ? ' (' + extra.company + ')' : ''}\n${items.map((i) => `${i.qty}× ${i.label}`).join('\n')}\nSumme: ${euro(total)} per ${pm === 'paypal' ? 'PayPal' : 'Überweisung'}`
    notifyWhatsApp(process.env.WA_NOTIFY_ADMIN, summary)
    if (kind === 'dealer' && process.env.TICKETS_WA_HAENDLER === '1') notifyWhatsApp(process.env.WA_NOTIFY_HAENDLER, summary)
    sendMail({ to: 'info@shinyfam.de', subject: summary.split('\n')[0], html: `<pre style="font-family:Arial,sans-serif">${esc(summary)}\n\nE-Mail: ${esc(email)}${phone ? '\nTelefon: ' + esc(phone) : ''}</pre><p>Nach Zahlungseingang im Admin unter „Tickets“ auf „bezahlt“ klicken.</p>`, replyTo: { email, name } }).catch(() => {})
    return res.json({ ok: true, orderNumber, key: accessKey }), true
  }

  // ---- Oeffentlich: Bestellstatus ----
  const orderMatch = path.match(/^\/tickets\/order\/(TK-[A-Z0-9]+)$/)
  if (orderMatch && method === 'GET') {
    const r = await db('SELECT * FROM ticket_orders WHERE order_number = ?', [orderMatch[1]])
    const o = r.rows[0]
    if (!o || (o.access_key !== req.query?.k && !(await admin()))) return res.status(404).json({ error: 'Bestellung nicht gefunden' }), true
    const ev = await loadEvent(db, o.event_id)
    const cfg = ev ? await loadConfig(db, ev) : null
    const settings = await getSettings(db)
    const tickets = o.payment_status === 'paid' ? (await db('SELECT code, kind, label, valid_days, holder, checkins, status FROM tickets WHERE order_id = ? ORDER BY created_at, code', [o.id])).rows.map((t) => ({ code: t.code, kind: t.kind, label: t.label, validDays: JSON.parse(t.valid_days), status: t.status })) : []
    return res.json({
      order: { ...publicOrder(o), isTest: isTest(o) },
      event: ev ? { title: ev.title.trim(), date: ev.date, endDate: ev.end_date, location: (ev.location || '').trim(), address: (ev.address || '').trim(), city: (ev.city || '').trim() } : null,
      days: ev ? eventDays(ev) : [],
      tickets,
      depositAmount: o.kind === 'dealer' ? Number(cfg?.depositAmount || 0) : 0,
      payment: o.payment_status === 'pending' ? {
        method: o.payment_method,
        bankHolder: settings.bankHolder || (isTest(o) ? 'Test-Konto' : ''), iban: settings.iban || (isTest(o) ? 'DE00 0000 0000 0000 0000 00 (Test)' : ''), bic: settings.bic, bankName: settings.bankName,
        paypalLink: settings.paypalMe ? `https://paypal.me/${encodeURIComponent(settings.paypalMe)}/${Number(o.total).toFixed(2)}EUR` : null,
        reference: o.order_number,
      } : null,
    }), true
  }

  // Testmodus: Zahlung per Knopf simulieren (nur fuer Testbestellungen)
  const simMatch = path.match(/^\/tickets\/order\/(TK-[A-Z0-9]+)\/simulate-payment$/)
  if (simMatch && method === 'POST') {
    const o = (await db('SELECT * FROM ticket_orders WHERE order_number = ?', [simMatch[1]])).rows[0]
    if (!o || o.access_key !== req.query?.k) return res.status(404).json({ error: 'Bestellung nicht gefunden' }), true
    if (!isTest(o)) return res.status(400).json({ error: 'Nur für Testbestellungen.' }), true
    if (o.payment_status !== 'pending') return res.json({ ok: true }), true
    const ev = await loadEvent(db, o.event_id)
    const cfg = await loadConfig(db, ev)
    await db("UPDATE ticket_orders SET payment_status = 'paid', paid_at = datetime('now') WHERE id = ?", [o.id])
    const fresh = (await db('SELECT * FROM ticket_orders WHERE id = ?', [o.id])).rows[0]
    await issueTickets(db, fresh, ev)
    mailTickets(db, fresh, ev, cfg).catch(() => {})
    return res.json({ ok: true }), true
  }

  const pdfMatch = path.match(/^\/tickets\/pdf\/(TK-[A-Z0-9]+)$/)
  if (pdfMatch && method === 'GET') {
    const o = (await db('SELECT * FROM ticket_orders WHERE order_number = ?', [pdfMatch[1]])).rows[0]
    if (!o || (o.access_key !== req.query?.k && !(await admin())) || o.payment_status !== 'paid') return res.status(404).json({ error: 'Nicht gefunden' }), true
    const ev = await loadEvent(db, o.event_id)
    const cfg = await loadConfig(db, ev)
    const tickets = (await db('SELECT * FROM tickets WHERE order_id = ? ORDER BY created_at, code', [o.id])).rows
    const pdf = await buildTicketsPdf(o, ev, tickets, cfg)
    res.setHeader('Content-Type', 'application/pdf')
    res.setHeader('Content-Disposition', `inline; filename="ShinyFam-Tickets-${o.order_number}.pdf"`)
    return res.end(pdf), true
  }

  const qrMatch = path.match(/^\/tickets\/qr\/([A-Z0-9]{10})\.png$/)
  if (qrMatch && method === 'GET') {
    const png = await qrPng(ticketUrl(qrMatch[1]), 360)
    res.setHeader('Content-Type', 'image/png')
    res.setHeader('Cache-Control', 'public, max-age=86400')
    return res.end(png), true
  }

  // ---- Ticket pruefen (oeffentlich: nur gueltig/ungueltig; Admin: Details) ----
  const checkMatch = path.match(/^\/tickets\/check\/([A-Za-z0-9]{10})$/)
  if (checkMatch && method === 'GET') {
    const code = checkMatch[1].toUpperCase()
    const t = (await db('SELECT * FROM tickets WHERE code = ?', [code])).rows[0]
    if (!t) return res.json({ found: false }), true
    const o = (await db('SELECT * FROM ticket_orders WHERE id = ?', [t.order_id])).rows[0]
    const ev = await loadEvent(db, t.event_id)
    const checkins = JSON.parse(t.checkins || '{}')
    const base = {
      found: true, code, isTest: isTest(o), kind: t.kind, label: t.label, validDays: JSON.parse(t.valid_days),
      status: o?.payment_status === 'cancelled' || t.status !== 'valid' ? 'cancelled' : 'valid',
      event: ev ? { title: ev.title.trim(), date: ev.date, endDate: ev.end_date } : null,
      days: ev ? eventDays(ev) : [], today: ev ? currentEventDayKey(ev) : null,
      checkins,
    }
    if (!(await admin())) return res.json(base), true
    let deposit = null
    if (t.kind === 'dealer' && o?.inquiry_id) {
      const inq = (await db('SELECT id, deposit_status, deposit_note FROM event_inquiries WHERE id = ?', [o.inquiry_id])).rows[0]
      const cfg = await loadConfig(db, ev)
      if (inq) deposit = { inquiryId: Number(inq.id), status: inq.deposit_status, note: inq.deposit_note, amount: Number(cfg.depositAmount || 0) }
    }
    return res.json({ ...base, admin: true, holder: t.holder, order: o ? adminOrder(o) : null, deposit }), true
  }

  const checkinMatch = path.match(/^\/tickets\/checkin\/([A-Za-z0-9]{10})$/)
  if (checkinMatch && method === 'POST') {
    if (!(await admin())) return deny(), true
    const code = checkinMatch[1].toUpperCase()
    const t = (await db('SELECT * FROM tickets WHERE code = ?', [code])).rows[0]
    if (!t) return res.status(404).json({ error: 'Ticket unbekannt' }), true
    const o = (await db('SELECT * FROM ticket_orders WHERE id = ?', [t.order_id])).rows[0]
    if (o?.payment_status !== 'paid' || t.status !== 'valid') return res.status(400).json({ error: 'Ticket ist storniert oder nicht bezahlt!' }), true
    if (isTest(o) && !(await getSettings(db)).sandbox) return res.status(400).json({ error: 'TEST-Ticket – am echten Einlass ungültig!' }), true
    const valid = JSON.parse(t.valid_days)
    const day = String(req.body?.day || '')
    if (!valid.includes(day)) return res.status(400).json({ error: 'Ticket gilt nicht für diesen Tag!' }), true
    const checkins = JSON.parse(t.checkins || '{}')
    if (checkins[day] && !req.body?.undo) return res.status(409).json({ error: `Schon eingecheckt um ${new Date(checkins[day]).toLocaleTimeString('de-DE', { timeZone: 'Europe/Berlin', hour: '2-digit', minute: '2-digit' })} Uhr!`, checkins }), true
    if (req.body?.undo) delete checkins[day]; else checkins[day] = new Date().toISOString()
    await db('UPDATE tickets SET checkins = ? WHERE code = ?', [JSON.stringify(checkins), code])
    return res.json({ ok: true, checkins }), true
  }

  // ================= Admin =================
  if (path.startsWith('/tickets/admin')) {
    if (!(await admin())) return deny(), true

    if (path === '/tickets/admin/events' && method === 'GET') {
      const st = await getSettings(db)
      const evs = (await db('SELECT * FROM events ORDER BY date DESC')).rows
      const out = []
      for (const ev of evs) {
        const cfg = await loadConfig(db, ev)
        const counts = await soldCounts(db, ev.id, st.sandbox)
        const paid = await db("SELECT COUNT(*) AS n, COALESCE(SUM(total),0) AS s FROM ticket_orders WHERE event_id = ? AND payment_status = 'paid' AND COALESCE(is_test,0) = ?", [ev.id, st.sandbox ? 1 : 0])
        const pending = await db("SELECT COUNT(*) AS n, COALESCE(SUM(total),0) AS s FROM ticket_orders WHERE event_id = ? AND payment_status = 'pending' AND COALESCE(is_test,0) = ?", [ev.id, st.sandbox ? 1 : 0])
        out.push({ id: ev.id, title: ev.title.trim(), date: ev.date, endDate: ev.end_date, days: eventDays(ev), config: cfg, counts, paid: { n: Number(paid.rows[0].n), sum: Number(paid.rows[0].s) }, pending: { n: Number(pending.rows[0].n), sum: Number(pending.rows[0].s) } })
      }
      return res.json(out), true
    }

    if (path === '/tickets/admin/sandbox') {
      if (method === 'PUT') await db('INSERT OR REPLACE INTO settings (key, value) VALUES (?,?)', ['ticket_sandbox', req.body?.on ? 'true' : 'false'])
      const st = await getSettings(db)
      const n = await db('SELECT COUNT(*) AS n FROM ticket_orders WHERE COALESCE(is_test,0) = 1')
      return res.json({ sandbox: st.sandbox, testOrders: Number(n.rows[0].n) }), true
    }

    if (path === '/tickets/admin/test-data' && method === 'DELETE') {
      await db('DELETE FROM tickets WHERE order_id IN (SELECT id FROM ticket_orders WHERE COALESCE(is_test,0) = 1)')
      await db('DELETE FROM ticket_orders WHERE COALESCE(is_test,0) = 1')
      return res.json({ ok: true }), true
    }

    const cfgMatch = path.match(/^\/tickets\/admin\/config\/([^/]+)$/)
    if (cfgMatch && method === 'PUT') {
      const ev = await loadEvent(db, cfgMatch[1])
      if (!ev) return res.status(404).json({ error: 'Event nicht gefunden' }), true
      const b = req.body || {}
      const slug = String(b.slug || '').toLowerCase().replace(/[^a-z0-9-]/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '').slice(0, 40)
      if (slug) {
        const dup = await db('SELECT event_id FROM ticket_config WHERE lower(slug) = ? AND event_id != ?', [slug, ev.id])
        if (dup.rows.length) return res.status(400).json({ error: 'Dieser Kurzlink ist schon vergeben.' }), true
      }
      const num = (v) => (v === '' || v == null || isNaN(Number(v)) ? null : Number(v))
      const cfg = {
        slug,
        visitorEnabled: !!b.visitorEnabled,
        visitorOptions: (Array.isArray(b.visitorOptions) ? b.visitorOptions : []).map((o) => ({ key: String(o.key), label: String(o.label || '').slice(0, 80), price: num(o.price) ?? 0, enabled: o.enabled !== false })).filter((o) => ['tag1', 'tag2', 'beide'].includes(o.key)),
        visitorLimit: num(b.visitorLimit),
        visitorInfo: String(b.visitorInfo || '').slice(0, 500),
        dealerEnabled: !!b.dealerEnabled,
        dealerMeterOptions: (Array.isArray(b.dealerMeterOptions) ? b.dealerMeterOptions : []).map(Number).filter((n) => n > 0 && n <= 50),
        dealerDayOptions: (Array.isArray(b.dealerDayOptions) ? b.dealerDayOptions : []).filter((k) => ['tag1', 'tag2', 'beide'].includes(k)),
        dealerPricePerMeterDay: num(b.dealerPricePerMeterDay),
        dealerLimit: num(b.dealerLimit),
        dealerTables: (Array.isArray(b.dealerTables) ? b.dealerTables : []).map((t) => ({ length: num(t.length), count: parseInt(t.count, 10) || 0 })).filter((t) => t.length > 0 && t.length <= 10 && t.count > 0).slice(0, 10),
        dealerMaxMeters: num(b.dealerMaxMeters),
        depositAmount: num(b.depositAmount) ?? 0,
        salesEnd: b.salesEnd || null,
        paypalEnabled: !!b.paypalEnabled,
        transferEnabled: !!b.transferEnabled,
      }
      await db('INSERT OR REPLACE INTO ticket_config (event_id, slug, data, updated_at) VALUES (?,?,?,datetime(\'now\'))', [ev.id, slug || null, JSON.stringify(cfg)])
      return res.json({ ok: true }), true
    }

    if (path === '/tickets/admin/orders' && method === 'GET') {
      const ev = req.query?.event
      const r = ev ? await db('SELECT * FROM ticket_orders WHERE event_id = ? ORDER BY id DESC', [ev]) : await db('SELECT * FROM ticket_orders ORDER BY id DESC LIMIT 500')
      const ids = r.rows.map((o) => o.id)
      const tmap = {}
      if (ids.length) {
        const tr = await db(`SELECT order_id, code, label, valid_days, checkins, status FROM tickets WHERE order_id IN (${ids.map(() => '?').join(',')})`, ids)
        for (const t of tr.rows) (tmap[t.order_id] ||= []).push({ code: t.code, label: t.label, validDays: JSON.parse(t.valid_days), checkins: JSON.parse(t.checkins || '{}'), status: t.status })
      }
      return res.json(r.rows.map((o) => ({ ...adminOrder(o), tickets: tmap[o.id] || [] }))), true
    }

    const actMatch = path.match(/^\/tickets\/admin\/orders\/(\d+)$/)
    if (actMatch && method === 'PATCH') {
      const o = (await db('SELECT * FROM ticket_orders WHERE id = ?', [actMatch[1]])).rows[0]
      if (!o) return res.status(404).json({ error: 'Bestellung nicht gefunden' }), true
      const ev = await loadEvent(db, o.event_id)
      const cfg = await loadConfig(db, ev)
      const action = req.body?.action
      if (action === 'note') {
        await db('UPDATE ticket_orders SET admin_note = ? WHERE id = ?', [String(req.body.note || '').slice(0, 1000), o.id])
        return res.json({ ok: true }), true
      }
      if (action === 'paid') {
        if (o.payment_status === 'paid') return res.json({ ok: true, already: true }), true
        await db("UPDATE ticket_orders SET payment_status = 'paid', paid_at = datetime('now'), cancelled_at = NULL WHERE id = ?", [o.id])
        await db("UPDATE tickets SET status = 'valid' WHERE order_id = ?", [o.id])
        const fresh = (await db('SELECT * FROM ticket_orders WHERE id = ?', [o.id])).rows[0]
        await issueTickets(db, fresh, ev)
        if (o.inquiry_id) await db("UPDATE event_inquiries SET status = 'confirmed', message = replace(message, 'noch nicht bezahlt', 'BEZAHLT') WHERE id = ?", [o.inquiry_id]).catch(() => {})
        const mailed = await mailTickets(db, fresh, ev, cfg)
        return res.json({ ok: true, mailed }), true
      }
      if (action === 'resend') {
        if (o.payment_status === 'paid') return res.json({ ok: true, mailed: await mailTickets(db, o, ev, cfg) }), true
        const settings = await getSettings(db)
        await mailOrderReceived(o, ev, cfg, settings)
        return res.json({ ok: true, mailed: true }), true
      }
      if (action === 'cancel') {
        await db("UPDATE ticket_orders SET payment_status = 'cancelled', cancelled_at = datetime('now') WHERE id = ?", [o.id])
        await db("UPDATE tickets SET status = 'cancelled' WHERE order_id = ?", [o.id])
        if (o.inquiry_id) await db("UPDATE event_inquiries SET status = 'declined' WHERE id = ?", [o.inquiry_id]).catch(() => {})
        if (req.body?.notify) {
          await sendMail({ to: o.email, toName: o.name, subject: `Stornierung ${o.order_number} – ${ev.title.trim()}`, html: `<p>Hallo ${esc(o.name)},</p><p>deine Bestellung <strong>${esc(o.order_number)}</strong> für ${esc(ev.title.trim())} wurde storniert${o.payment_status === 'pending' ? ', da bis jetzt keine Zahlung eingegangen ist' : ''}. Bereits gezahlte Beträge erstatten wir dir selbstverständlich.</p><p>Fragen? Antworte einfach auf diese Mail oder schreib an info@shinyfam.de.</p><p>Viele Grüße<br>Dein ShinyFam-Team</p>` })
        }
        return res.json({ ok: true }), true
      }
      if (action === 'reopen') {
        await db("UPDATE ticket_orders SET payment_status = 'pending', cancelled_at = NULL, paid_at = NULL WHERE id = ?", [o.id])
        await db("UPDATE tickets SET status = 'cancelled' WHERE order_id = ?", [o.id])
        return res.json({ ok: true }), true
      }
      return res.status(400).json({ error: 'Unbekannte Aktion' }), true
    }

    // Kaution: alle Haendler eines Events (Online-Buchungen UND normale Anfragen)
    if (path === '/tickets/admin/deposits' && method === 'GET') {
      const ev = await loadEvent(db, String(req.query?.event || ''))
      if (!ev) return res.status(404).json({ error: 'Event nicht gefunden' }), true
      const cfg = await loadConfig(db, ev)
      const r = await db("SELECT id, name, company, email, phone, meters, attendance_days, status, deposit_status, deposit_note, ticket_order FROM event_inquiries WHERE trim(event_name) = ? AND status != 'declined' AND (archived IS NULL OR archived = 0 OR archived = '0') ORDER BY COALESCE(company, name)", [ev.title.trim()])
      return res.json({ amount: Number(cfg.depositAmount || 0), dealers: r.rows.map((x) => ({ ...x, id: Number(x.id) })) }), true
    }

    const depMatch = path.match(/^\/tickets\/admin\/deposits\/(\d+)$/)
    if (depMatch && method === 'PATCH') {
      const st = req.body?.status
      if (![null, 'received', 'returned', 'kept'].includes(st)) return res.status(400).json({ error: 'Ungültiger Status' }), true
      await db('UPDATE event_inquiries SET deposit_status = ?, deposit_note = ? WHERE id = ?', [st, req.body?.note != null ? String(req.body.note).slice(0, 300) : null, depMatch[1]])
      return res.json({ ok: true }), true
    }
  }

  return false
}

// ---------- Vorschau fuer Instagram/Facebook/WhatsApp-Links ----------
// Crawler fuehren kein JavaScript aus -> fuer /tickets/<kurzlink> die
// og:-Tags direkt im ausgelieferten index.html ersetzen.
export async function ticketOgHtml(db, reqPath, html) {
  const m = reqPath.match(/^\/tickets\/([^/]+)\/?$/)
  if (!m || m[1] === 'bestellung') return null
  try {
    await ensureSchema(db)
    const ev = await findEventBySlugOrId(db, decodeURIComponent(m[1]))
    if (!ev) return null
    const cfg = await loadConfig(db, ev)
    if (!(cfg.visitorEnabled || cfg.dealerEnabled)) return null
    const days = eventDays(ev).map((d) => d.label).join(' & ')
    const title = `Tickets: ${ev.title.trim()} – ${days}`
    const what = [cfg.visitorEnabled ? 'Eintrittskarten' : null, cfg.dealerEnabled ? 'Händlerstände' : null].filter(Boolean).join(' und ')
    const desc = `${what} jetzt online sichern – ${(ev.location || '').trim()}, ${(ev.city || '').trim()}. Bezahlen per PayPal oder Überweisung.`
    const url = `${baseUrl()}/tickets/${encodeURIComponent(m[1])}`
    const img = ev.image_url && /^https?:/.test(ev.image_url) ? ev.image_url : `${baseUrl()}/next-event.jpg`
    return html
      .replace(/<title>[^<]*<\/title>/, `<title>${esc(title)}</title>`)
      .replace(/(property="og:url" content=")[^"]*/, `$1${esc(url)}`)
      .replace(/(property="og:title" content=")[^"]*/, `$1${esc(title)}`)
      .replace(/(property="og:description" content=")[^"]*/, `$1${esc(desc)}`)
      .replace(/(property="og:image" content=")[^"]*/, `$1${esc(img)}`)
      .replace(/(name="twitter:title" content=")[^"]*/, `$1${esc(title)}`)
      .replace(/(name="twitter:description" content=")[^"]*/, `$1${esc(desc)}`)
      .replace(/(name="twitter:image" content=")[^"]*/, `$1${esc(img)}`)
  } catch {
    return null
  }
}
