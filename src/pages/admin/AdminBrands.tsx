import { useState, useEffect } from 'react'
import { Plus, Trash2, Store, Pencil, X } from 'lucide-react'
import ImageUpload from '../../components/ImageUpload'

interface Brand { id: string; name: string; logo_url: string | null; website: string | null; sort_order: number }

const EMPTY = { name: '', logoUrl: '', website: '' }

export default function AdminBrands({ token }: { token: string }) {
  const [brands, setBrands] = useState<Brand[]>([])
  const [form, setForm] = useState(EMPTY)
  const [editId, setEditId] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const headers = { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }

  async function load() {
    const res = await fetch('/api/brands')
    const data = await res.json()
    setBrands(Array.isArray(data) ? data : [])
  }
  useEffect(() => { load() }, [])

  function startEdit(b: Brand) {
    setForm({ name: b.name, logoUrl: b.logo_url ?? '', website: b.website ?? '' })
    setEditId(b.id)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  function cancelEdit() {
    setForm(EMPTY)
    setEditId(null)
    setError('')
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    if (!form.name.trim()) return
    setSaving(true)
    setError('')
    const body = { name: form.name.trim(), logo_url: form.logoUrl.trim() || null, website: form.website.trim() || null, sort_order: editId ? brands.find(b => b.id === editId)?.sort_order ?? 0 : brands.length }
    const res = editId
      ? await fetch(`/api/brands/${editId}`, { method: 'PATCH', headers, body: JSON.stringify(body) })
      : await fetch('/api/brands', { method: 'POST', headers, body: JSON.stringify({ id: crypto.randomUUID(), ...body }) })
    if (!res.ok) {
      const d = await res.json().catch(() => ({}))
      setError(d.error || 'Fehler beim Speichern')
    } else {
      setForm(EMPTY)
      setEditId(null)
      await load()
    }
    setSaving(false)
  }

  async function handleDelete(id: string) {
    await fetch(`/api/brands/${id}`, { method: 'DELETE', headers })
    if (editId === id) cancelEdit()
    await load()
  }

  return (
    <div>
      <h2 className="font-display text-2xl font-bold section-title mb-6 flex items-center gap-2">
        <Store size={22} className="text-accent-purple" aria-hidden="true" /> Händler
      </h2>

      <form onSubmit={handleSave} className="admin-card mb-8">
        <h3 className="font-semibold section-title mb-4 flex items-center gap-2">
          {editId ? <Pencil size={16} aria-hidden="true" /> : <Plus size={16} aria-hidden="true" />}
          {editId ? 'Händler bearbeiten' : 'Händler hinzufügen'}
        </h3>
        <div className="flex flex-col gap-3">
          <div>
            <label htmlFor="brand-name" className="admin-label">Name *</label>
            <input
              id="brand-name"
              required
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder="z.B. Kaizen Cards"
              className="input-field"
            />
          </div>
          <ImageUpload label="Logo (optional)" value={form.logoUrl} onChange={url => setForm({ ...form, logoUrl: url })} maxSize={300} quality={0.7} />
          <div>
            <label htmlFor="brand-website" className="admin-label">Website (optional)</label>
            <input
              id="brand-website"
              type="url"
              value={form.website}
              onChange={(e) => setForm({ ...form, website: e.target.value })}
              placeholder="https://..."
              className="input-field"
            />
          </div>
        </div>
        {error && <p className="text-red-500 text-sm mt-3">{error}</p>}
        <div className="flex gap-3 mt-4">
          <button type="submit" disabled={saving} className="btn-primary">
            {saving ? 'Wird gespeichert…' : editId ? 'Änderungen speichern' : 'Händler hinzufügen'}
          </button>
          {editId && (
            <button type="button" onClick={cancelEdit} className="btn-outline flex items-center gap-1">
              <X size={14} aria-hidden="true" /> Abbrechen
            </button>
          )}
        </div>
      </form>

      {brands.length === 0 ? (
        <p className="text-muted text-center py-8">Noch keine Händler eingetragen.</p>
      ) : (
        <div className="flex flex-col gap-3">
          {brands.map((b) => (
            <div key={b.id} className={`admin-list-item${editId === b.id ? ' ring-2 ring-accent-gold' : ''}`}>
              {b.logo_url && (
                <img src={b.logo_url} alt={b.name} className="h-10 w-16 object-contain rounded shrink-0" />
              )}
              <div className="flex-1 min-w-0">
                <p className="font-semibold section-title truncate">{b.name}</p>
                {b.website && <p className="text-secondary text-xs mt-0.5 truncate">{b.website}</p>}
              </div>
              <button
                type="button"
                onClick={() => startEdit(b)}
                className="icon-btn text-muted hover:text-accent-gold shrink-0"
                aria-label={`${b.name} bearbeiten`}
              >
                <Pencil size={16} aria-hidden="true" />
              </button>
              <button
                type="button"
                onClick={() => handleDelete(b.id)}
                className="icon-btn text-muted hover:text-red-500 shrink-0"
                aria-label={`${b.name} löschen`}
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
