import { useState, useEffect } from 'react'
import { Plus, Trash2 } from 'lucide-react'
import YTIcon from '../../components/YTIcon'

interface Video { id: string; title: string }

export default function AdminVideos({ token }: { token: string }) {
  const [videos, setVideos] = useState<Video[]>([])
  const [id, setId] = useState('')
  const [title, setTitle] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const headers = { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }

  async function load() {
    const res = await fetch('/api/videos')
    const data = await res.json()
    setVideos(Array.isArray(data) ? data : [])
  }
  useEffect(() => { load() }, [])

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault()
    if (!id.trim() || !title.trim()) return
    setSaving(true)
    setError('')
    const res = await fetch('/api/videos', {
      method: 'POST',
      headers,
      body: JSON.stringify({ id: id.trim(), title: title.trim() }),
    })
    if (!res.ok) {
      const d = await res.json().catch(() => ({}))
      setError(d.error || 'Fehler beim Speichern')
    } else {
      setId('')
      setTitle('')
      await load()
    }
    setSaving(false)
  }

  async function handleDelete(videoId: string) {
    await fetch(`/api/videos/${videoId}`, { method: 'DELETE', headers })
    await load()
  }

  return (
    <div>
      <h2 className="font-display text-2xl font-bold section-title mb-6 flex items-center gap-2">
        <YTIcon size={22} className="text-red-500" aria-hidden="true" /> YouTube Videos
      </h2>

      <form onSubmit={handleAdd} className="admin-card mb-8">
        <h3 className="font-semibold section-title mb-4 flex items-center gap-2">
          <Plus size={16} aria-hidden="true" /> Video hinzufügen (max. 3)
        </h3>
        <p className="text-secondary text-sm mb-4">
          Die Video-ID findest du in der YouTube-URL nach <code>v=</code> — z.B. bei<br />
          <code>youtube.com/watch?v=<strong>dQw4w9WgXcQ</strong></code> ist die ID <strong>dQw4w9WgXcQ</strong>
        </p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div>
            <label htmlFor="vid-id" className="admin-label">Video-ID *</label>
            <input
              id="vid-id"
              required
              value={id}
              onChange={(e) => setId(e.target.value)}
              placeholder="dQw4w9WgXcQ"
              className="input-field"
            />
          </div>
          <div>
            <label htmlFor="vid-title" className="admin-label">Titel *</label>
            <input
              id="vid-title"
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Unser Stand auf der TCG Börse"
              className="input-field"
            />
          </div>
        </div>
        {error && <p className="text-red-500 text-sm mt-3">{error}</p>}
        <button type="submit" disabled={saving || videos.length >= 3} className="btn-primary mt-4">
          {saving ? 'Wird gespeichert…' : 'Video hinzufügen'}
        </button>
        {videos.length >= 3 && (
          <p className="text-muted text-xs mt-2">Maximal 3 Videos. Bitte zuerst ein altes löschen.</p>
        )}
      </form>

      {videos.length === 0 ? (
        <p className="text-muted text-center py-8">Noch keine Videos eingetragen.</p>
      ) : (
        <div className="flex flex-col gap-3">
          {videos.map((v) => (
            <div key={v.id} className="admin-list-item">
              <div className="flex-1 min-w-0">
                <p className="font-semibold section-title truncate">{v.title}</p>
                <p className="text-secondary text-xs mt-0.5">ID: {v.id}</p>
              </div>
              <a
                href={`https://www.youtube.com/watch?v=${v.id}`}
                target="_blank"
                rel="noopener noreferrer"
                className="icon-btn text-muted hover:text-red-500 shrink-0"
                aria-label="Video auf YouTube öffnen"
              >
                <YTIcon size={16} aria-hidden="true" />
              </a>
              <button
                type="button"
                onClick={() => handleDelete(v.id)}
                className="icon-btn text-muted hover:text-red-500 shrink-0"
                aria-label={`${v.title} löschen`}
              >
                <Trash2 size={16} aria-hidden="true" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
