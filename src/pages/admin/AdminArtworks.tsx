import { useState, useEffect } from 'react'
import { Plus, Trash2, Palette } from 'lucide-react'
import ImageUpload from '../../components/ImageUpload'

interface Artwork {
  id: string; title: string; description: string
  image_url: string; tags: string[]; sold: boolean
}

export default function AdminArtworks({ token }: { token: string }) {
  const [artworks, setArtworks] = useState<Artwork[]>([])
  const [form, setForm] = useState({ title: '', description: '', image_url: '', tags: '', sold: false })
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const headers = { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }

  async function load() {
    setLoading(true)
    const res = await fetch('/api/artworks', { headers })
    const data = await res.json()
    setArtworks(Array.isArray(data) ? data : [])
    setLoading(false)
  }
  useEffect(() => { load() }, [])

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    await fetch('/api/artworks', {
      method: 'POST', headers,
      body: JSON.stringify({ id: `art-${Date.now()}`, ...form, tags: form.tags.split(',').map((t) => t.trim()).filter(Boolean) }),
    })
    setForm({ title: '', description: '', image_url: '', tags: '', sold: false })
    await load()
    setSaving(false)
  }

  async function handleDelete(id: string) {
    if (!confirm('Kunstwerk löschen?')) return
    await fetch(`/api/artworks/${id}`, { method: 'DELETE', headers })
    await load()
  }

  async function toggleSold(a: Artwork) {
    await fetch(`/api/artworks/${a.id}`, { method: 'PATCH', headers, body: JSON.stringify({ sold: !a.sold }) })
    await load()
  }

  return (
    <div>
      <h2 className="font-display text-2xl font-bold section-title mb-6 flex items-center gap-2">
        <Palette size={22} className="text-accent-pink" aria-hidden="true" /> Kunstwerke verwalten
      </h2>

      <form onSubmit={handleSave} className="admin-card mb-8">
        <h3 className="font-semibold section-title mb-4 flex items-center gap-2">
          <Plus size={16} aria-hidden="true" /> Neues Kunstwerk
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div>
            <label htmlFor="art-title" className="admin-label">Titel *</label>
            <input id="art-title" required value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} className="input-field" />
          </div>
          <div className="md:col-span-2">
            <ImageUpload
              label="Foto"
              value={form.image_url}
              onChange={(url) => setForm({ ...form, image_url: url })}
            />
          </div>
          <div>
            <label htmlFor="art-tags" className="admin-label">Tags (kommagetrennt)</label>
            <input id="art-tags" value={form.tags} onChange={(e) => setForm({ ...form, tags: e.target.value })} placeholder="Pikachu, Aquarell, Digital" className="input-field" />
          </div>
          <div className="flex items-center gap-2 pt-5">
            <input type="checkbox" id="art-sold" checked={form.sold} onChange={(e) => setForm({ ...form, sold: e.target.checked })} />
            <label htmlFor="art-sold" className="text-secondary text-sm cursor-pointer">Bereits verkauft</label>
          </div>
          <div className="md:col-span-2">
            <label htmlFor="art-desc" className="admin-label">Beschreibung</label>
            <textarea id="art-desc" rows={2} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} className="input-field resize-none" />
          </div>
        </div>
        <button type="submit" disabled={saving} className="btn-primary mt-4">
          {saving ? 'Wird gespeichert…' : 'Kunstwerk speichern'}
        </button>
      </form>

      {loading ? (
        <p className="text-secondary text-center py-8">Lädt…</p>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {artworks.length === 0
            ? <p className="text-muted text-center py-8 col-span-full">Noch keine Kunstwerke.</p>
            : artworks.map((a) => (
              <div key={a.id} className="card rounded-xl overflow-hidden">
                <div className="aspect-square raised flex items-center justify-center overflow-hidden">
                  {a.image_url
                    ? <img src={a.image_url} alt={a.title} className="w-full h-full object-cover" />
                    : <Palette size={32} className="text-muted" aria-hidden="true" />}
                </div>
                <div className="p-3">
                  <p className="section-title text-sm font-medium truncate">{a.title}</p>
                  <div className="flex items-center justify-between mt-2">
                    <button type="button" onClick={() => toggleSold(a)}
                      className={`text-xs px-2 py-0.5 rounded-full border transition-colors ${a.sold ? 'admin-badge-sold' : 'admin-badge-available'}`}>
                      {a.sold ? 'Verkauft' : 'Verfügbar'}
                    </button>
                    <button type="button" onClick={() => handleDelete(a.id)} className="icon-btn text-muted hover:text-red-500 w-7 h-7" aria-label={`${a.title} löschen`}>
                      <Trash2 size={14} aria-hidden="true" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
        </div>
      )}
    </div>
  )
}
