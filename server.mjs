import express from 'express'
import { createServer } from 'http'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'
import { createClient } from '@libsql/client'
import { randomBytes } from 'crypto'

const __dirname = dirname(fileURLToPath(import.meta.url))
const app = express()
app.use(express.json({ limit: '10mb' }))

const PORT = process.env.PORT || 3001

function getDb() {
  return createClient({
    url: process.env.TURSO_DATABASE_URL,
    authToken: process.env.TURSO_AUTH_TOKEN,
  })
}

async function initDb() {
  const db = getDb()
  await db.execute(`CREATE TABLE IF NOT EXISTS events (id TEXT PRIMARY KEY, title TEXT NOT NULL, date TEXT NOT NULL, end_date TEXT, location TEXT NOT NULL, address TEXT NOT NULL, city TEXT NOT NULL, description TEXT NOT NULL, youtube_video_id TEXT, ticket_url TEXT, image_url TEXT, tags TEXT NOT NULL DEFAULT '[]', partners TEXT DEFAULT '[]', created_at TEXT DEFAULT (datetime('now')))`)
  await db.execute(`ALTER TABLE events ADD COLUMN partners TEXT DEFAULT '[]'`).catch(() => {})
  await db.execute(`ALTER TABLE events ADD COLUMN is_active INTEGER DEFAULT 1`).catch(() => {})
  await db.execute(`ALTER TABLE events ADD COLUMN entry_fee REAL DEFAULT NULL`).catch(() => {})
  await db.execute(`CREATE TABLE IF NOT EXISTS orders (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL, email TEXT NOT NULL, phone TEXT, motif TEXT NOT NULL, size TEXT, message TEXT, status TEXT DEFAULT 'new', created_at TEXT DEFAULT (datetime('now')))`)
  await db.execute(`CREATE TABLE IF NOT EXISTS products (id TEXT PRIMARY KEY, name TEXT NOT NULL, description TEXT, price REAL NOT NULL, stock INTEGER DEFAULT 1, image_url TEXT, is_featured INTEGER DEFAULT 0, is_active INTEGER DEFAULT 1, tags TEXT DEFAULT '[]', created_at TEXT DEFAULT (datetime('now')))`)
  await db.execute(`CREATE TABLE IF NOT EXISTS artworks (id TEXT PRIMARY KEY, title TEXT NOT NULL, description TEXT, image_url TEXT, tags TEXT DEFAULT '[]', sold INTEGER DEFAULT 0, is_active INTEGER DEFAULT 1, created_at TEXT DEFAULT (datetime('now')))`)
  await db.execute(`CREATE TABLE IF NOT EXISTS shop_orders (id INTEGER PRIMARY KEY AUTOINCREMENT, order_number TEXT UNIQUE NOT NULL, first_name TEXT NOT NULL, last_name TEXT NOT NULL, email TEXT NOT NULL, phone TEXT, street TEXT NOT NULL, zip TEXT NOT NULL, city TEXT NOT NULL, items TEXT NOT NULL, subtotal REAL NOT NULL, shipping REAL DEFAULT 4.99, total REAL NOT NULL, payment_method TEXT DEFAULT 'invoice', payment_status TEXT DEFAULT 'pending', order_status TEXT DEFAULT 'new', notes TEXT, created_at TEXT DEFAULT (datetime('now')))`)
  await db.execute(`CREATE TABLE IF NOT EXISTS admin_sessions (token TEXT PRIMARY KEY, created_at TEXT DEFAULT (datetime('now')))`)
  await db.execute(`CREATE TABLE IF NOT EXISTS youtube_videos (id TEXT PRIMARY KEY, title TEXT NOT NULL, sort_order INTEGER DEFAULT 0, created_at TEXT DEFAULT (datetime('now')))`)
  await db.execute(`CREATE TABLE IF NOT EXISTS brands (id TEXT PRIMARY KEY, name TEXT NOT NULL, logo_url TEXT, website TEXT, sort_order INTEGER DEFAULT 0, created_at TEXT DEFAULT (datetime('now')))`)
  await db.execute(`CREATE TABLE IF NOT EXISTS settings (key TEXT PRIMARY KEY, value TEXT NOT NULL)`)
  return db
}

async function isAdmin(db, auth) {
  if (!auth?.startsWith('Bearer ')) return false
  const r = await db.execute({ sql: 'SELECT token FROM admin_sessions WHERE token = ?', args: [auth.slice(7)] })
  return r.rows.length > 0
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
app.all('/api/*', async (req, res) => {
  const path = req.path.replace(/^\/api/, '').replace(/\?.*$/, '')
  const method = req.method

  try {
    const db = await initDb()

    if (path === '/health') return res.json({ ok: true })

    if (path === '/admin/login' && method === 'POST') {
      const { password } = req.body
      if (!process.env.ADMIN_PASSWORD || password !== process.env.ADMIN_PASSWORD)
        return res.status(401).json({ error: 'Falsches Passwort' })
      const token = randomBytes(32).toString('hex')
      await db.execute({ sql: 'INSERT INTO admin_sessions (token) VALUES (?)', args: [token] })
      return res.json({ token })
    }

    if (path === '/events') {
      if (method === 'GET') {
        const adminMode = await isAdmin(db, req.headers.authorization)
        const sql = adminMode ? 'SELECT * FROM events ORDER BY date ASC' : 'SELECT * FROM events WHERE is_active = 1 ORDER BY date ASC'
        const r = await db.execute(sql)
        return res.json(r.rows.map(row => ({ ...row, tags: JSON.parse(row.tags || '[]'), partners: JSON.parse(row.partners || '[]'), isActive: row.is_active === 1 || row.is_active === null, entryFee: row.entry_fee ?? null })))
      }
      if (method === 'POST') {
        if (!await isAdmin(db, req.headers.authorization)) return res.status(401).json({ error: 'Unauthorized' })
        const { id, title, date, endDate, location, address, city, description, youtubeVideoId, ticketUrl, imageUrl, tags, partners, isActive, entryFee } = req.body
        if (!id || !title || !date) return res.status(400).json({ error: 'Pflichtfelder fehlen' })
        await db.execute({ sql: `INSERT INTO events (id,title,date,end_date,location,address,city,description,youtube_video_id,ticket_url,image_url,tags,partners,is_active,entry_fee) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`, args: [id, title, date, endDate ?? null, location, address, city, description, youtubeVideoId ?? null, ticketUrl ?? null, imageUrl ?? null, JSON.stringify(tags ?? []), JSON.stringify(partners ?? []), isActive ? 1 : 0, entryFee ?? null] })
        return res.status(201).json({ ok: true })
      }
    }

    const eventMatch = path.match(/^\/events\/([^/]+)$/)
    if (eventMatch) {
      const id = eventMatch[1]
      if (!await isAdmin(db, req.headers.authorization)) return res.status(401).json({ error: 'Unauthorized' })
      if (method === 'DELETE') {
        await db.execute({ sql: 'DELETE FROM events WHERE id = ?', args: [id] })
        return res.json({ ok: true })
      }
      if (method === 'PATCH') {
        const { title, date, endDate, location, address, city, description, youtubeVideoId, ticketUrl, imageUrl, tags, partners, isActive, entryFee } = req.body
        await db.execute({ sql: `UPDATE events SET title=?,date=?,end_date=?,location=?,address=?,city=?,description=?,youtube_video_id=?,ticket_url=?,image_url=?,tags=?,partners=?,is_active=?,entry_fee=? WHERE id=?`, args: [title, date, endDate ?? null, location, address, city, description, youtubeVideoId ?? null, ticketUrl ?? null, imageUrl ?? null, JSON.stringify(tags ?? []), JSON.stringify(partners ?? []), isActive ? 1 : 0, entryFee ?? null, id] })
        return res.json({ ok: true })
      }
    }

    if (path === '/artworks') {
      if (method === 'GET') {
        const r = await db.execute('SELECT * FROM artworks WHERE is_active = 1 ORDER BY created_at DESC')
        return res.json(r.rows.map(row => ({ ...row, tags: JSON.parse(row.tags) })))
      }
      if (method === 'POST') {
        if (!await isAdmin(db, req.headers.authorization)) return res.status(401).json({ error: 'Unauthorized' })
        const { id, title, description, image_url, tags, sold } = req.body
        if (!id || !title) return res.status(400).json({ error: 'Pflichtfelder fehlen' })
        await db.execute({ sql: `INSERT INTO artworks (id,title,description,image_url,tags,sold) VALUES (?,?,?,?,?,?)`, args: [id, title, description ?? '', image_url ?? '', JSON.stringify(tags ?? []), sold ? 1 : 0] })
        return res.status(201).json({ ok: true })
      }
    }

    const artworkMatch = path.match(/^\/artworks\/([^/]+)$/)
    if (artworkMatch) {
      const id = artworkMatch[1]
      if (!await isAdmin(db, req.headers.authorization)) return res.status(401).json({ error: 'Unauthorized' })
      if (method === 'PATCH') {
        const { sold } = req.body
        await db.execute({ sql: 'UPDATE artworks SET sold = ? WHERE id = ?', args: [sold ? 1 : 0, id] })
        return res.json({ ok: true })
      }
      if (method === 'DELETE') {
        await db.execute({ sql: 'DELETE FROM artworks WHERE id = ?', args: [id] })
        return res.json({ ok: true })
      }
    }

    if (path === '/products') {
      if (method === 'GET') {
        const r = await db.execute('SELECT * FROM products WHERE is_active = 1 ORDER BY is_featured DESC, created_at DESC')
        return res.json(r.rows.map(row => ({ ...row, tags: JSON.parse(row.tags) })))
      }
      if (method === 'POST') {
        if (!await isAdmin(db, req.headers.authorization)) return res.status(401).json({ error: 'Unauthorized' })
        const { id, name, description, price, stock, image_url, tags, is_featured } = req.body
        if (!id || !name || price === undefined) return res.status(400).json({ error: 'Pflichtfelder fehlen' })
        await db.execute({ sql: `INSERT INTO products (id,name,description,price,stock,image_url,tags,is_featured) VALUES (?,?,?,?,?,?,?,?)`, args: [id, name, description ?? '', price, stock ?? 1, image_url ?? '', JSON.stringify(tags ?? []), is_featured ? 1 : 0] })
        return res.status(201).json({ ok: true })
      }
    }

    if (path === '/products/admin') {
      if (!await isAdmin(db, req.headers.authorization)) return res.status(401).json({ error: 'Unauthorized' })
      const r = await db.execute('SELECT * FROM products ORDER BY created_at DESC')
      return res.json(r.rows.map(row => ({ ...row, tags: JSON.parse(row.tags) })))
    }

    const productMatch = path.match(/^\/products\/([^/]+)$/)
    if (productMatch) {
      const id = productMatch[1]
      if (!await isAdmin(db, req.headers.authorization)) return res.status(401).json({ error: 'Unauthorized' })
      if (method === 'DELETE') {
        await db.execute({ sql: 'DELETE FROM products WHERE id = ?', args: [id] })
        return res.json({ ok: true })
      }
    }

    if (path === '/orders') {
      if (method === 'POST') {
        const { name, email, phone, motif, size, message } = req.body
        if (!name || !email || !motif) return res.status(400).json({ error: 'Pflichtfelder fehlen' })
        await db.execute({ sql: `INSERT INTO orders (name,email,phone,motif,size,message) VALUES (?,?,?,?,?,?)`, args: [name, email, phone ?? null, motif, size ?? null, message ?? null] })
        return res.status(201).json({ ok: true, message: 'Anfrage eingegangen!' })
      }
      if (method === 'GET') {
        if (!await isAdmin(db, req.headers.authorization)) return res.status(401).json({ error: 'Unauthorized' })
        const r = await db.execute('SELECT * FROM orders ORDER BY created_at DESC')
        return res.json(r.rows)
      }
    }

    if (path === '/shop/orders') {
      if (method === 'POST') {
        const { firstName, lastName, email, phone, street, zip, city, items, subtotal, shipping, total, paymentMethod, notes } = req.body
        if (!firstName || !lastName || !email || !street || !zip || !city || !items?.length)
          return res.status(400).json({ error: 'Pflichtfelder fehlen' })
        const orderNumber = generateOrderNumber()
        await db.execute({ sql: `INSERT INTO shop_orders (order_number,first_name,last_name,email,phone,street,zip,city,items,subtotal,shipping,total,payment_method,notes) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)`, args: [orderNumber, firstName, lastName, email, phone ?? null, street, zip, city, JSON.stringify(items), subtotal, shipping, total, paymentMethod ?? 'prepayment', notes ?? null] })
        return res.status(201).json({ ok: true, orderNumber })
      }
    }

    if (path === '/shop/orders/admin') {
      if (!await isAdmin(db, req.headers.authorization)) return res.status(401).json({ error: 'Unauthorized' })
      const r = await db.execute('SELECT * FROM shop_orders ORDER BY created_at DESC')
      return res.json(r.rows)
    }

    const shopOrderStatusMatch = path.match(/^\/shop\/orders\/(\d+)\/status$/)
    if (shopOrderStatusMatch) {
      if (!await isAdmin(db, req.headers.authorization)) return res.status(401).json({ error: 'Unauthorized' })
      if (method === 'PATCH') {
        const { status } = req.body
        const valid = ['new', 'processing', 'shipped', 'delivered', 'cancelled']
        if (!valid.includes(status)) return res.status(400).json({ error: 'Ungültiger Status' })
        await db.execute({ sql: 'UPDATE shop_orders SET order_status = ? WHERE id = ?', args: [status, shopOrderStatusMatch[1]] })
        return res.json({ ok: true })
      }
    }

    if (path === '/youtube-feed') {
      const CHANNEL_ID = 'UCCH4_wO5f9D9E_-rbGw5ojw'
      const feedUrl = `https://www.youtube.com/feeds/videos.xml?channel_id=${CHANNEL_ID}`
      const feedRes = await fetch(feedUrl)
      const xml = await feedRes.text()
      const videos = []
      const entries = xml.match(/<entry>([\s\S]*?)<\/entry>/g) || []
      for (const entry of entries.slice(0, 3)) {
        const idMatch = entry.match(/<yt:videoId>([^<]+)<\/yt:videoId>/)
        const titleMatch = entry.match(/<title>([^<]+)<\/title>/)
        const pubMatch = entry.match(/<published>([^<]+)<\/published>/)
        if (idMatch && titleMatch) videos.push({ id: idMatch[1], title: titleMatch[1], published: pubMatch?.[1] ?? '' })
      }
      return res.json(videos)
    }

    if (path === '/videos') {
      if (method === 'GET') {
        const r = await db.execute('SELECT * FROM youtube_videos ORDER BY sort_order ASC, created_at DESC LIMIT 3')
        return res.json(r.rows)
      }
      if (method === 'POST') {
        if (!await isAdmin(db, req.headers.authorization)) return res.status(401).json({ error: 'Unauthorized' })
        const { id, title } = req.body
        if (!id || !title) return res.status(400).json({ error: 'Pflichtfelder fehlen' })
        const count = await db.execute('SELECT COUNT(*) as c FROM youtube_videos')
        if (count.rows[0].c >= 3) {
          const oldest = await db.execute('SELECT id FROM youtube_videos ORDER BY sort_order ASC, created_at ASC LIMIT 1')
          if (oldest.rows.length > 0) await db.execute({ sql: 'DELETE FROM youtube_videos WHERE id = ?', args: [oldest.rows[0].id] })
        }
        await db.execute({ sql: 'INSERT OR REPLACE INTO youtube_videos (id, title) VALUES (?,?)', args: [id, title] })
        return res.status(201).json({ ok: true })
      }
    }

    const videoMatch = path.match(/^\/videos\/([^/]+)$/)
    if (videoMatch) {
      if (!await isAdmin(db, req.headers.authorization)) return res.status(401).json({ error: 'Unauthorized' })
      if (method === 'DELETE') {
        await db.execute({ sql: 'DELETE FROM youtube_videos WHERE id = ?', args: [videoMatch[1]] })
        return res.json({ ok: true })
      }
    }

    if (path === '/brands') {
      if (method === 'GET') {
        const r = await db.execute('SELECT * FROM brands ORDER BY sort_order ASC, created_at ASC')
        return res.json(r.rows)
      }
      if (method === 'POST') {
        if (!await isAdmin(db, req.headers.authorization)) return res.status(401).json({ error: 'Unauthorized' })
        const { id, name, logo_url, website, sort_order } = req.body
        if (!id || !name) return res.status(400).json({ error: 'Pflichtfelder fehlen' })
        await db.execute({ sql: `INSERT INTO brands (id,name,logo_url,website,sort_order) VALUES (?,?,?,?,?)`, args: [id, name, logo_url ?? null, website ?? null, sort_order ?? 0] })
        return res.status(201).json({ ok: true })
      }
    }

    const brandMatch = path.match(/^\/brands\/([^/]+)$/)
    if (brandMatch) {
      const id = brandMatch[1]
      if (!await isAdmin(db, req.headers.authorization)) return res.status(401).json({ error: 'Unauthorized' })
      if (method === 'DELETE') {
        await db.execute({ sql: 'DELETE FROM brands WHERE id = ?', args: [id] })
        return res.json({ ok: true })
      }
      if (method === 'PATCH') {
        const { name, logo_url, website, sort_order } = req.body
        await db.execute({ sql: `UPDATE brands SET name=?,logo_url=?,website=?,sort_order=? WHERE id=?`, args: [name, logo_url ?? null, website ?? null, sort_order ?? 0, id] })
        return res.json({ ok: true })
      }
    }

    if (path === '/settings') {
      if (method === 'GET') {
        const r = await db.execute('SELECT key, value FROM settings')
        const obj = {}
        for (const row of r.rows) obj[row.key] = row.value
        return res.json(obj)
      }
      if (method === 'POST') {
        if (!await isAdmin(db, req.headers.authorization)) return res.status(401).json({ error: 'Unauthorized' })
        const { key, value } = req.body
        if (!key) return res.status(400).json({ error: 'key fehlt' })
        await db.execute({ sql: 'INSERT OR REPLACE INTO settings (key, value) VALUES (?,?)', args: [key, String(value)] })
        return res.json({ ok: true })
      }
    }

    return res.status(404).json({ error: 'Not found', path })
  } catch (err) {
    console.error(err)
    return res.status(500).json({ error: 'Serverfehler' })
  }
})

// Static frontend
app.use(express.static(join(__dirname, 'dist')))
app.get('*', (req, res) => {
  res.sendFile(join(__dirname, 'dist', 'index.html'))
})

createServer(app).listen(PORT, () => {
  console.log(`ShinyFam server running on port ${PORT}`)
})
