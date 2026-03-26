import type { VercelRequest, VercelResponse } from '@vercel/node'
import { initDb } from '../_db'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const db = await initDb()

  if (req.method === 'GET') {
    const result = await db.execute('SELECT * FROM orders ORDER BY created_at DESC')
    return res.json(result.rows)
  }

  if (req.method === 'POST') {
    const { name, email, phone, motif, size, message } = req.body
    if (!name || !email || !motif) {
      return res.status(400).json({ error: 'Name, E-Mail und Motiv sind Pflicht' })
    }
    await db.execute({
      sql: `INSERT INTO orders (name, email, phone, motif, size, message) VALUES (?, ?, ?, ?, ?, ?)`,
      args: [name, email, phone ?? null, motif, size ?? null, message ?? null],
    })
    return res.status(201).json({ ok: true, message: 'Anfrage eingegangen!' })
  }

  res.status(405).json({ error: 'Method not allowed' })
}
