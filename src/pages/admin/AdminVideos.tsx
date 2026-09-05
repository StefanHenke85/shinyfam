import { useState, useEffect } from 'react'
import { Plus, Trash2, Instagram, ExternalLink } from 'lucide-react'

interface Video { id: string; title: string; url: string }

export default function AdminVideos({ token }: { token: string }) {
  const [videos, setVideos] = useState<Video[]>([])
  const [url, setUrl] = useState('')
  const [title, setTitle] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const headers = { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }
  const MAX_VIDEOS = 6

  async function load() {
    const res = await fetch('/api/videos')
    const data = await res.json()
    setVideos(Array.isArray(data) ? data : [])
  }
  useEffect(() => { load() }, [])

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault()
    if (!url.trim() || !title.trim()) return
    setSaving(true)
    setError('')
    const id = url.trim().match(/\/(reel|p|tv)\/([^/?]+)/)?.[2] || url.trim()
    const res = await fetch('/api/videos', {
      method: 'POST',
      headers,
      body: JSON.stringify({ id, title: title.trim(), url: url.trim() }),
    })
    if (!res.ok) {
      const d = await res.json().catch(() => ({}))
      setError(d.error || 'Fehler beim Speichern')
    } else {
      setUrl('')
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
        <Instagram size={22} className="text-accent-pink" aria-hidden="true" /> Instagram Videos
      </h2>

      <form onSubmit={handleAdd} className="admin-card mb-8">
        <h3 className="font-semibold section-title mb-4 flex items-center gap-2">
          <Plus size={16} aria-hidden="true" /> Video hinzufügen (max. {MAX_VIDEOS})
        </h3>
        <p className="text-secondary text-sm mb-4">
          Öffne den Reel/Post auf Instagram, klicke auf <strong>Teilen → Link kopieren</strong> und füge ihn hier ein — z.B.<br />
          <code>instagram.com/reel/AbCdEfGhIjK</code>
        </p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div>
            <label htmlFor="vid-url" className="admin-label">Instagram-Link *</label>
            <input
              id="vid-url"
              required
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://www.instagram.com/reel/AbCdEfGhIjK/"
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
        <button type="submit" disabled={saving || videos.length >= MAX_VIDEOS} className="btn-primary mt-4">
          {saving ? 'Wird gespeichert…' : 'Video hinzufügen'}
        </button>
        {videos.length >= MAX_VIDEOS && (
          <p className="text-muted text-xs mt-2">Maximal {MAX_VIDEOS} Videos. Bitte zuerst ein altes löschen.</p>
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
                <p className="text-secondary text-xs mt-0.5 truncate">{v.url}</p>
              </div>
              <a
                href={v.url}
                target="_blank"
                rel="noopener noreferrer"
                className="icon-btn text-muted hover:text-accent-pink shrink-0"
                aria-label="Video auf Instagram öffnen"
              >
                <ExternalLink size={16} aria-hidden="true" />
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
