import type { VercelRequest, VercelResponse } from '@vercel/node'
import { initDb } from '../../_db'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'PATCH') return res.status(405).json({ error: 'Method not allowed' })

  const db = await initDb()
  const { id } = req.query
  const { status } = req.body

  if (!['new', 'in_progress', 'done', 'cancelled'].includes(status)) {
    return res.status(400).json({ error: 'Ungültiger Status' })
  }

  await db.execute({ sql: 'UPDATE orders SET status = ? WHERE id = ?', args: [status, id as string] })
  return res.json({ ok: true })
}
