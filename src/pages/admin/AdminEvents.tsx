import { useState, useEffect } from 'react'
import { Plus, Trash2, Calendar, Pencil, X, Copy, Check, Megaphone } from 'lucide-react'
import type { TCGEvent, EventPartner, EventScheduleDay } from '../../types'
import ImageUpload from '../../components/ImageUpload'

interface Brand { id: string; name: string; logo_url: string | null; website: string | null }
interface PriceTierForm { label: string; pricePerMeterDay: string }

interface FormState {
  title: string; date: string; endDate: string; location: string
  address: string; city: string; description: string; tags: string[]
  youtubeVideoId: string; ticketUrl: string; imageUrl: string
  partners: EventPartner[]; isActive: boolean; entryFee: string
  schedule: EventScheduleDay[]; maxVendors: string; pricePerMeterDay: string
  priceTiers: PriceTierForm[]; requireDay1WithDay2: boolean
}

const EMPTY: FormState = {
  title: '', date: '', endDate: '', location: '', address: '', city: '',
  description: '', tags: [], youtubeVideoId: '', ticketUrl: '', imageUrl: '', partners: [],
  isActive: true, entryFee: '', schedule: [], maxVendors: '', pricePerMeterDay: '', priceTiers: [],
  requireDay1WithDay2: false,
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
  const [copied, setCopied] = useState<string | null>(null)
  const [promoEvent, setPromoEvent] = useState<TCGEvent | null>(null)
  const [copiedPlatform, setCopiedPlatform] = useState<string | null>(null)

  function buildTexts(ev: TCGEvent) {
    const date = new Date(ev.date)
    const dateStr = date.toLocaleDateString('de-DE', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' })
    const timeStr = date.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })
    const endStr = ev.endDate ? ` – ${new Date(ev.endDate).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })}` : ''
    const fee = ev.entryFee ? `Eintritt: ${ev.entryFee.toFixed(2)} €` : 'Eintritt frei!'
    const hashtags = `#ShinyFam #TCG #PokémonTCG #Pokémon #NRW #Niederrhein #Sammelkarten #TCGBörse #${ev.city.replace(/\s+/g, '')}`

    return {
      instagram: `🃏✨ ${ev.title} ✨🃏

Hey ShinyFam! 👋 Wir sind wieder dabei!

📅 ${dateStr}
🕙 ${timeStr}${endStr} Uhr
📍 ${ev.location}, ${ev.city}

${ev.description}

🎟️ ${fee}
🔗 Alle Infos & als Händler bewerben: Link in Bio!

${hashtags} #TCGCommunity #Trading`,

      facebook: `🎉 ${ev.title}

Hey Leute! Wir freuen uns euch wieder auf einer TCG Börse zu sehen! 🃏

📅 ${dateStr}
🕙 ${timeStr}${endStr} Uhr
📍 ${ev.location}, ${ev.address ? ev.address + ', ' : ''}${ev.city}

${ev.description}

🎟️ ${fee}

👉 Alle Infos & Händleranfragen direkt auf unserer Website:
https://shinyfam.de/events

Teilt den Post und bringt Freunde mit! 💪
${hashtags}`,

      discord: `📢 **${ev.title}**

Hey @everyone! Neues Event in Sicht! 🃏

📅 **${dateStr}**
🕙 **${timeStr}${endStr} Uhr**
📍 **${ev.location}, ${ev.city}**

${ev.description}

🎟️ ${fee}

🔗 **Alle Infos & als Händler anmelden:** https://shinyfam.de/events`,

      whatsapp: `🃏 *${ev.title}*

📅 ${dateStr}
🕙 ${timeStr}${endStr} Uhr
📍 ${ev.location}, ${ev.city}

${ev.description}

🎟️ ${fee}

👉 Alle Infos: https://shinyfam.de/events`,

      gmb: buildGmbPost(ev),
    }
  }

  async function copyPlatform(text: string, platform: string) {
    await navigator.clipboard.writeText(text)
    setCopiedPlatform(platform)
    setTimeout(() => setCopiedPlatform(null), 2000)
  }

  function buildGmbPost(ev: TCGEvent): string {
    const date = new Date(ev.date)
    const dateStr = date.toLocaleDateString('de-DE', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' })
    const timeStr = date.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })
    const endStr = ev.endDate ? ` – ${new Date(ev.endDate).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })}` : ''
    const fee = ev.entryFee ? `🎟️ Eintritt: ${ev.entryFee.toFixed(2)} €\n` : '🎟️ Eintritt frei!\n'
    const tags = (ev.tags || []).map(t => `#${t.replace(/\s+/g, '')}`).join(' ')

    return `🃏 ${ev.title}

📅 ${dateStr}
🕙 ${timeStr}${endStr} Uhr
📍 ${ev.location}, ${ev.city}

${ev.description}

${fee}
👉 Alle Infos & Händleranfragen: https://shinyfam.de/events

${tags} #ShinyFam #TCG #PokémonTCG #NRW #Niederrhein`
  }

  async function copyGmbPost(ev: TCGEvent) {
    const text = buildGmbPost(ev)
    await navigator.clipboard.writeText(text)
    setCopied(ev.id)
    setTimeout(() => setCopied(null), 2500)
  }

  const headers = { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }

  async function load() {
    setLoading(true)
    const res = await fetch('/api/events', { headers: { Authorization: `Bearer ${token}` } })
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
      imageUrl: ev.imageUrl || String(r.image_url || ''),
      partners: ev.partners || [],
      isActive: ev.isActive ?? Boolean(r.is_active ?? true),
      entryFee: ev.entryFee != null ? String(ev.entryFee) : (r.entry_fee != null ? String(r.entry_fee) : ''),
      schedule: ev.schedule || [],
      maxVendors: ev.maxVendors != null ? String(ev.maxVendors) : (r.max_vendors != null ? String(r.max_vendors) : ''),
      pricePerMeterDay: ev.pricePerMeterDay != null ? String(ev.pricePerMeterDay) : (r.price_per_meter_day != null ? String(r.price_per_meter_day) : ''),
      priceTiers: ((ev.priceTiers ?? (r.price_tiers ? JSON.parse(String(r.price_tiers)) : [])) as { label: string; pricePerMeterDay: number }[]).map(t => ({ label: t.label, pricePerMeterDay: String(t.pricePerMeterDay) })),
      requireDay1WithDay2: ev.requireDay1WithDay2 ?? (r.require_day1_with_day2 === 1 || r.require_day1_with_day2 === '1'),
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
      const priceTiers = form.priceTiers.filter(t => t.label.trim() && t.pricePerMeterDay !== '').map(t => ({ label: t.label.trim(), pricePerMeterDay: parseFloat(t.pricePerMeterDay) }))
      const body = { ...form, tags, partners, imageUrl: form.imageUrl || null, endDate: form.endDate || null, entryFee: form.entryFee !== '' ? parseFloat(form.entryFee) : null, schedule: form.schedule.length > 0 ? form.schedule : null, maxVendors: form.maxVendors !== '' ? parseInt(form.maxVendors) : null, pricePerMeterDay: form.pricePerMeterDay !== '' ? parseFloat(form.pricePerMeterDay) : null, priceTiers }
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

          <div>
            <label htmlFor="evt-max-vendors" className="admin-label">Max. Händlerplätze (leer = unbegrenzt)</label>
            <input id="evt-max-vendors" type="number" min="1" step="1" value={form.maxVendors}
              onChange={e => setForm({ ...form, maxVendors: e.target.value })}
              placeholder="z.B. 20" className="input-field" />
          </div>

          <div className={form.priceTiers.length > 0 ? 'opacity-40 pointer-events-none' : ''}>
            <label htmlFor="evt-price-per-meter" className="admin-label">Standgebühr (€ pro Meter pro Tag, für Rechnungen)</label>
            <input id="evt-price-per-meter" type="number" min="0" step="0.50" value={form.pricePerMeterDay}
              onChange={e => setForm({ ...form, pricePerMeterDay: e.target.value })}
              placeholder="z.B. 12.50" className="input-field" disabled={form.priceTiers.length > 0} />
            <p className="text-muted text-xs mt-1">Nur wenn es keine unterschiedlichen Standort-Kategorien gibt. Sonst unten Preisstufen anlegen.</p>
          </div>

          {/* Preisstufen (z.B. Indoor / Outdoor überdacht / Outdoor Freifläche) */}
          <div className="md:col-span-2">
            <div className="flex items-center justify-between mb-2">
              <label className="admin-label mb-0">Preisstufen nach Standort (optional, überschreibt die einfache Standgebühr)</label>
              <button type="button"
                onClick={() => setForm(f => ({ ...f, priceTiers: [...f.priceTiers, { label: '', pricePerMeterDay: '' }] }))}
                className="text-xs btn-outline !py-1 !px-3 flex items-center gap-1">
                <Plus size={12} /> Preisstufe hinzufügen
              </button>
            </div>
            {form.priceTiers.length === 0 ? (
              <p className="text-muted text-xs">Keine Preisstufen — Standgebühr oben wird verwendet. Händler können dann keine Standort-Kategorie auswählen.</p>
            ) : (
              <div className="flex flex-col gap-2">
                {form.priceTiers.map((tier, i) => (
                  <div key={i} className="flex items-center gap-2 bg-bg-raised rounded-lg p-2">
                    <input value={tier.label}
                      onChange={e => setForm(f => ({ ...f, priceTiers: f.priceTiers.map((t, j) => j === i ? { ...t, label: e.target.value } : t) }))}
                      placeholder="z.B. Drin, Draußen, Draußen überdacht" className="input-field !py-1 text-sm flex-1 min-w-0" />
                    <input type="number" min="0" step="0.50" value={tier.pricePerMeterDay} title="€ pro Meter pro Tag"
                      onChange={e => setForm(f => ({ ...f, priceTiers: f.priceTiers.map((t, j) => j === i ? { ...t, pricePerMeterDay: e.target.value } : t) }))}
                      placeholder="€/m/Tag" className="input-field !py-1 text-sm !w-28" />
                    <button type="button" onClick={() => setForm(f => ({ ...f, priceTiers: f.priceTiers.filter((_, j) => j !== i) }))}
                      className="text-red-500 hover:text-red-600 p-1" aria-label="Preisstufe entfernen">
                      <X size={14} />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Mehrtägiger Zeitplan */}
          <div className="md:col-span-2">
            <div className="flex items-center justify-between mb-2">
              <label className="admin-label mb-0">Zeitplan (mehrtägig, optional)</label>
              <button type="button"
                onClick={() => setForm(f => ({ ...f, schedule: [...f.schedule, { label: `Tag ${f.schedule.length + 1}`, start: '10:00', end: '17:00' }] }))}
                className="text-xs btn-outline !py-1 !px-3 flex items-center gap-1">
                <Plus size={12} /> Tag hinzufügen
              </button>
            </div>
            {form.schedule.length === 0 ? (
              <p className="text-muted text-xs">Kein Zeitplan — Start/Endzeit oben wird verwendet.</p>
            ) : (
              <div className="flex flex-col gap-2">
                {form.schedule.map((day, i) => (
                  <div key={i} className="flex items-center gap-2 bg-bg-raised rounded-lg p-2">
                    <input value={day.label}
                      onChange={e => setForm(f => ({ ...f, schedule: f.schedule.map((d, j) => j === i ? { ...d, label: e.target.value } : d) }))}
                      placeholder="z.B. Samstag" className="input-field !py-1 text-sm flex-1 min-w-0" />
                    <input type="time" value={day.start} title="Startzeit"
                      onChange={e => setForm(f => ({ ...f, schedule: f.schedule.map((d, j) => j === i ? { ...d, start: e.target.value } : d) }))}
                      className="input-field !py-1 text-sm !w-28" />
                    <span className="text-muted text-xs">–</span>
                    <input type="time" value={day.end} title="Endzeit"
                      onChange={e => setForm(f => ({ ...f, schedule: f.schedule.map((d, j) => j === i ? { ...d, end: e.target.value } : d) }))}
                      className="input-field !py-1 text-sm !w-28" />
                    <button type="button" onClick={() => setForm(f => ({ ...f, schedule: f.schedule.filter((_, j) => j !== i) }))}
                      className="text-red-500 hover:text-red-600 p-1" aria-label="Tag entfernen">
                      <X size={14} />
                    </button>
                  </div>
                ))}
              </div>
            )}
            {form.schedule.length >= 2 && (
              <label className="flex items-center gap-2 mt-3 text-sm text-secondary cursor-pointer">
                <input type="checkbox" checked={form.requireDay1WithDay2}
                  onChange={e => setForm({ ...form, requireDay1WithDay2: e.target.checked })}
                  className="w-4 h-4" />
                {form.schedule[0]?.label || 'Tag 1'} ist nur buchbar, wenn auch {form.schedule[1]?.label || 'Tag 2'} mitgebucht wird
              </label>
            )}
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
              <button type="button" onClick={() => setPromoEvent(ev)}
                className="icon-btn text-muted hover:text-accent-pink shrink-0"
                aria-label="Event bewerben" title="Event bewerben">
                <Megaphone size={16} />
              </button>
              <button type="button" onClick={() => copyGmbPost(ev)}
                className={`icon-btn shrink-0 transition-colors ${copied === ev.id ? 'text-green-500' : 'text-muted hover:text-accent-purple'}`}
                aria-label="Google My Business Post kopieren"
                title="GMB Post kopieren">
                {copied === ev.id ? <Check size={16} /> : <Copy size={16} />}
              </button>
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

      {/* Promo Modal */}
      {promoEvent && (() => {
        const texts = buildTexts(promoEvent)
        const platforms = [
          { key: 'instagram', label: 'Instagram', emoji: '📸', color: 'bg-gradient-to-r from-purple-500 to-pink-500', text: texts.instagram },
          { key: 'facebook', label: 'Facebook', emoji: '👥', color: 'bg-blue-600', text: texts.facebook },
          { key: 'whatsapp', label: 'WhatsApp', emoji: '💬', color: 'bg-green-500', text: texts.whatsapp },
          { key: 'discord', label: 'Discord', emoji: '🎮', color: 'bg-indigo-500', text: texts.discord },
          { key: 'gmb', label: 'Google My Business', emoji: '🔍', color: 'bg-accent-orange', text: texts.gmb },
        ]
        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm" onClick={() => setPromoEvent(null)}>
            <div className="bg-bg-surface border border-theme rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto shadow-2xl" onClick={e => e.stopPropagation()}>
              <div className="flex items-center justify-between p-5 border-b border-theme sticky top-0 bg-bg-surface z-10">
                <div className="flex items-center gap-2">
                  <Megaphone size={18} className="text-accent-pink" />
                  <div>
                    <p className="font-bold section-title">{promoEvent.title} bewerben</p>
                    <p className="text-xs text-muted">Text kopieren → auf der Plattform einfügen</p>
                  </div>
                </div>
                <button type="button" onClick={() => setPromoEvent(null)} className="icon-btn text-muted hover:text-primary" aria-label="Schließen">
                  <X size={18} />
                </button>
              </div>

              <div className="p-5 flex flex-col gap-4">
                {platforms.map(p => (
                  <div key={p.key} className="border border-theme rounded-xl overflow-hidden">
                    <div className={`flex items-center justify-between px-4 py-2.5 ${p.color}`}>
                      <span className="text-white font-bold text-sm flex items-center gap-2">
                        {p.emoji} {p.label}
                      </span>
                      <button type="button" onClick={() => copyPlatform(p.text, p.key)}
                        className="flex items-center gap-1.5 bg-white/20 hover:bg-white/30 text-white text-xs px-3 py-1 rounded-lg transition-colors">
                        {copiedPlatform === p.key ? <><Check size={12} /> Kopiert!</> : <><Copy size={12} /> Kopieren</>}
                      </button>
                    </div>
                    <pre className="text-xs text-secondary p-4 whitespace-pre-wrap font-sans leading-relaxed bg-bg-raised max-h-40 overflow-y-auto">
                      {p.text}
                    </pre>
                  </div>
                ))}

                <div className="bg-accent-purple/5 border border-accent-purple/20 rounded-xl p-4 text-xs text-secondary">
                  <p className="font-semibold text-primary mb-1">💡 Tipp für mehr Reichweite</p>
                  <p>Poste auf allen Plattformen <strong>gleichzeitig</strong>, idealerweise <strong>Dienstag–Donnerstag 18–20 Uhr</strong>. Bitte Freunde den Post zu teilen — jeder Share = kostenlose Werbung und hilft dem Google-Ranking! 🚀</p>
                </div>
              </div>
            </div>
          </div>
        )
      })()}
    </div>
  )
}
