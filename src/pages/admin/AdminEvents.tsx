import { useState, useEffect } from 'react'
import { Plus, Trash2, Calendar, Pencil, X } from 'lucide-react'
import type { TCGEvent, EventPartner } from '../../types'
import ImageUpload from '../../components/ImageUpload'

interface Brand { id: string; name: string; logo_url: string | null; website: string | null }

interface FormState {
  title: string; date: string; endDate: string; location: string
  address: string; city: string; description: string; tags: string[]
  youtubeVideoId: string; ticketUrl: string; imageUrl: string
  partners: EventPartner[]; isActive: boolean; entryFee: string
}

const EMPTY: FormState = {
  title: '', date: '', endDate: '', location: '', address: '', city: '',
  description: '', tags: [], youtubeVideoId: '', ticketUrl: '', imageUrl: '', partners: [],
  isActive: true, entryFee: '',
}

export default function AdminEvents({ token }: { token: string }) {
  const [events, setEvents] = useState<TCGEvent[]>([])
  const [brands, setBrands] = useState<Brand[]>([])
  const [form, setForm] = useState<FormState>(EMPTY)
  const [tagsInput, setTagsInput] = useState('')
  const [editId, setEditId] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const headers = { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }

  async function load() {
    setLoading(true)
    const res = await fetch('/api/events')
    const data = await res.json()
    setEvents(Array.isArray(data) ? data : [])
    setLoading(false)
  }

  useEffect(() => {
    load()
    fetch('/api/brands').then(r => r.json()).then(d => setBrands(Array.isArray(d) ? d : [])).catch(() => {})
  }, [])

  function startEdit(ev: TCGEvent) {
    const r = ev as unknown as Record<string, unknown>
    setForm({
      title: ev.title,
      date: ev.date ? ev.date.slice(0, 16) : '',
      endDate: ev.endDate ? ev.endDate.slice(0, 16) : (r.end_date ? String(r.end_date).slice(0, 16) : ''),
      location: ev.location,
      address: ev.address,
      city: ev.city,
      description: ev.description,
      tags: ev.tags || [],
      youtubeVideoId: ev.youtubeVideoId || '',
      ticketUrl: ev.ticketUrl || '',
      imageUrl: String(r.image_url || ''),
      partners: ev.partners || [],
      isActive: ev.isActive ?? Boolean(r.is_active ?? true),
      entryFee: ev.entryFee != null ? String(ev.entryFee) : (r.entry_fee != null ? String(r.entry_fee) : ''),
    })
    setTagsInput((ev.tags || []).join(', '))
    setEditId(ev.id)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  function cancelEdit() {
    setForm(EMPTY)
    setTagsInput('')
    setEditId(null)
    setError('')
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    setError('')
    const tags = tagsInput.split(',').map(t => t.trim()).filter(Boolean)
    const partners = form.partners.filter(p => p.name.trim())
    try {
      const body = { ...form, tags, partners, imageUrl: form.imageUrl || null, endDate: form.endDate || null, entryFee: form.entryFee !== '' ? parseFloat(form.entryFee) : null }
      const res = editId
        ? await fetch(`/api/events/${editId}`, { method: 'PATCH', headers, body: JSON.stringify(body) })
        : await fetch('/api/events', { method: 'POST', headers, body: JSON.stringify({ id: `evt-${Date.now()}`, ...body }) })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        setError(data.error || `Fehler ${res.status}`)
      } else {
        setForm(EMPTY); setTagsInput(''); setEditId(null)
        await load()
      }
    } catch {
      setError('Netzwerkfehler – bitte erneut versuchen')
    }
    setSaving(false)
  }

  async function handleDelete(id: string, title: string) {
    if (!confirm(`"${title}" löschen?`)) return
    await fetch(`/api/events/${id}`, { method: 'DELETE', headers })
    if (editId === id) cancelEdit()
    await load()
  }

  return (
    <div>
      <h2 className="font-display text-2xl font-bold section-title mb-6 flex items-center gap-2">
        <Calendar size={22} className="text-accent-gold" aria-hidden="true" /> Events verwalten
      </h2>

      <form onSubmit={handleSave} className="admin-card mb-8">
        <h3 className="font-semibold section-title mb-4 flex items-center gap-2">
          {editId ? <Pencil size={16} aria-hidden="true" /> : <Plus size={16} aria-hidden="true" />}
          {editId ? 'Event bearbeiten' : 'Neues Event'}
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {([['title','Titel',true],['location','Veranstaltungsort',true],['address','Adresse',true],['city','Stadt',true]] as [keyof FormState, string, boolean][]).map(([key, label, req]) => (
            <div key={key}>
              <label htmlFor={`evt-${key}`} className="admin-label">{label}{req && ' *'}</label>
              <input id={`evt-${key}`} required={req} value={form[key] as string}
                onChange={e => setForm({ ...form, [key]: e.target.value })} className="input-field" />
            </div>
          ))}

          <div>
            <label htmlFor="evt-date" className="admin-label">Startzeit *</label>
            <input id="evt-date" required type="datetime-local" value={form.date}
              onChange={e => setForm({ ...form, date: e.target.value })} className="input-field" />
          </div>
          <div>
            <label htmlFor="evt-enddate" className="admin-label">Endzeit</label>
            <input id="evt-enddate" type="datetime-local" value={form.endDate}
              onChange={e => setForm({ ...form, endDate: e.target.value })} className="input-field" />
          </div>

          <div>
            <label htmlFor="evt-fee" className="admin-label">Eintrittspreis (€, leer = kostenlos)</label>
            <input id="evt-fee" type="number" min="0" step="0.50" value={form.entryFee}
              onChange={e => setForm({ ...form, entryFee: e.target.value })}
              placeholder="z.B. 3.00" className="input-field" />
          </div>

          <div className="flex items-center gap-3 md:col-span-2 p-3 bg-bg-raised rounded-xl">
            <button
              type="button"
              onClick={() => setForm(f => ({ ...f, isActive: !f.isActive }))}
              className={`relative w-12 h-6 rounded-full transition-colors shrink-0 ${form.isActive ? 'bg-green-500' : 'bg-bg-surface border border-theme'}`}
              aria-label="Event aktiv schalten"
            >
              <span className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform ${form.isActive ? 'translate-x-6' : ''}`} />
            </button>
            <div>
              <p className="text-sm font-semibold section-title">{form.isActive ? '✓ Event ist aktiv (sichtbar)' : 'Event ist inaktiv (nur Entwurf)'}</p>
              <p className="text-xs text-muted">Inaktive Events sind nur im Admin-Bereich sichtbar</p>
            </div>
          </div>

          <div>
            <label htmlFor="evt-tags" className="admin-label">Tags (kommagetrennt)</label>
            <input id="evt-tags" value={tagsInput}
              onChange={e => setTagsInput(e.target.value)}
              placeholder="Pokémon, Turnier, Börse" className="input-field" />
          </div>
          <div>
            <label htmlFor="evt-ticket" className="admin-label">Ticket-URL</label>
            <input id="evt-ticket" value={form.ticketUrl}
              onChange={e => setForm({ ...form, ticketUrl: e.target.value })}
              placeholder="https://..." className="input-field" />
          </div>
          <div>
            <label htmlFor="evt-youtube" className="admin-label">YouTube Video-ID</label>
            <input id="evt-youtube" value={form.youtubeVideoId}
              onChange={e => setForm({ ...form, youtubeVideoId: e.target.value })}
              placeholder="dQw4w9WgXcQ" className="input-field" />
          </div>

          <div className="md:col-span-2">
            <label htmlFor="evt-desc" className="admin-label">Beschreibung *</label>
            <textarea id="evt-desc" required rows={3} value={form.description}
              onChange={e => setForm({ ...form, description: e.target.value })}
              className="input-field resize-none" />
          </div>

          <div className="md:col-span-2">
            <ImageUpload label="Event-Foto (wird auf der Startseite angezeigt)"
              value={form.imageUrl} onChange={url => setForm({ ...form, imageUrl: url })} />
          </div>
        </div>

        {/* Partner aus Händler-Liste */}
        <div className="mt-6">
          <p className="admin-label mb-3">Händler bei diesem Event</p>
          {brands.length === 0 ? (
            <p className="text-muted text-sm">Noch keine Händler angelegt. Bitte zuerst im Tab „Händler" eintragen.</p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {brands.map((b) => {
                const selected = form.partners.some(p => p.name === b.name)
                return (
                  <button
                    key={b.id}
                    type="button"
                    onClick={() => {
                      if (selected) {
                        setForm(f => ({ ...f, partners: f.partners.filter(p => p.name !== b.name) }))
                      } else {
                        setForm(f => ({ ...f, partners: [...f.partners, { name: b.name, logoUrl: b.logo_url ?? '', website: b.website ?? '' }] }))
                      }
                    }}
                    className={`flex items-center gap-2 px-3 py-2 rounded-xl border text-sm transition-colors ${
                      selected
                        ? 'border-accent-purple bg-accent-purple/10 text-primary'
                        : 'border-theme text-secondary hover:border-accent-purple/50'
                    }`}
                  >
                    {b.logo_url && <img src={b.logo_url} alt="" className="h-5 w-auto object-contain" />}
                    {b.name}
                    {selected && <X size={12} aria-hidden="true" />}
                  </button>
                )
              })}
            </div>
          )}
          {form.partners.length > 0 && (
            <p className="text-xs text-secondary mt-2">{form.partners.length} Händler ausgewählt</p>
          )}
        </div>

        {error && <p className="text-red-500 text-sm mt-3">{error}</p>}
        <div className="flex gap-3 mt-4 flex-wrap">
          <button type="submit" disabled={saving} className="btn-primary">
            {saving ? 'Wird gespeichert…' : editId ? 'Änderungen speichern' : 'Event speichern'}
          </button>
          {editId && (
            <button type="button" onClick={cancelEdit} className="btn-outline flex items-center gap-1">
              <X size={14} aria-hidden="true" /> Abbrechen
            </button>
          )}
        </div>
      </form>

      {loading ? (
        <p className="text-secondary text-center py-8">Lädt…</p>
      ) : events.length === 0 ? (
        <p className="text-muted text-center py-8">Noch keine Events.</p>
      ) : (
        <div className="flex flex-col gap-3">
          {events.map((ev) => (
            <div key={ev.id} className={`admin-list-item${editId === ev.id ? ' ring-2 ring-accent-gold' : ''}`}>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <p className="font-semibold section-title truncate">{ev.title}</p>
                  {!ev.isActive && <span className="text-xs bg-yellow-500/20 text-yellow-600 px-2 py-0.5 rounded-full shrink-0">Entwurf</span>}
                </div>
                <p className="text-secondary text-sm">
                  {new Date(ev.date).toLocaleString('de-DE')}
                  {(ev.endDate || (ev as unknown as Record<string,string>).end_date) && (
                    <> – {new Date(ev.endDate || (ev as unknown as Record<string,string>).end_date).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })} Uhr</>
                  )}
                  {' · '}{ev.city}
                </p>
                <div className="flex gap-1 mt-1 flex-wrap">
                  {(ev.tags || []).map(t => <span key={t} className="tag">{t}</span>)}
                  {(ev.partners || []).length > 0 && (
                    <span className="tag tag-muted">{(ev.partners || []).length} Partner</span>
                  )}
                </div>
              </div>
              <button type="button" onClick={() => startEdit(ev)}
                className="icon-btn text-muted hover:text-accent-gold shrink-0"
                aria-label={`${ev.title} bearbeiten`}>
                <Pencil size={16} aria-hidden="true" />
              </button>
              <button type="button" onClick={() => handleDelete(ev.id, ev.title)}
                className="icon-btn text-muted hover:text-red-500 shrink-0"
                aria-label={`${ev.title} löschen`}>
                <Trash2 size={16} aria-hidden="true" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
