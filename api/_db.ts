import { createClient } from '@libsql/client'

export function getDb() {
  return createClient({
    url: process.env.TURSO_DATABASE_URL!,
    authToken: process.env.TURSO_AUTH_TOKEN,
  })
}

export async function initDb() {
  const db = getDb()
  await db.execute(`
    CREATE TABLE IF NOT EXISTS events (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      date TEXT NOT NULL,
      end_date TEXT,
      location TEXT NOT NULL,
      address TEXT NOT NULL,
      city TEXT NOT NULL,
      description TEXT NOT NULL,
      youtube_video_id TEXT,
      ticket_url TEXT,
      image_url TEXT,
      tags TEXT NOT NULL DEFAULT '[]',
      created_at TEXT DEFAULT (datetime('now'))
    )
  `)
  await db.execute(`
    CREATE TABLE IF NOT EXISTS orders (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      email TEXT NOT NULL,
      phone TEXT,
      motif TEXT NOT NULL,
      size TEXT,
      message TEXT,
      status TEXT DEFAULT 'new',
      created_at TEXT DEFAULT (datetime('now'))
    )
  `)
  return db
}
