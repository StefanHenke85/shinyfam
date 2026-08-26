import { useState, useEffect } from 'react'
import { Users, Plus, Trash2, Send, Mail, RefreshCw, ChevronDown, ChevronUp } from 'lucide-react'

interface Contact {
  id: number
  name: string
  email: string
  phone: string | null
  notes: string | null
  tags: string[]
  subscribed: number
  source: string
  created_at: string
}

interface NewsletterHistory {
  id: number
  subject: string
  body: string
  tags: string
  sent_count: number
  created_at: string
}

const emptyContact = { name: '', email: '', phone: '', notes: '', tags: '' }

export default function AdminContacts({ token }: { token: string }) {
  const [contacts, setContacts] = useState<Contact[]>([])
  const [history, setHistory] = useState<NewsletterHistory[]>([])
  const [loading, setLoading] = useState(false)
  const [view, setView] = useState<'contacts' | 'newsletter'>('contacts')
  const [showAdd, setShowAdd] = useState(false)
  const [form, setForm] = useState(emptyContact)
  const [saving, setSaving] = useState(false)
  const [filterTag, setFilterTag] = useState('')
  // Newsletter compose
  const [nlSubject, setNlSubject] = useState('')
  const [nlBody, setNlBody] = useState('')
  const [nlTag, setNlTag] = useState('')
  const [sending, setSending] = useState(false)
  const [sendResult, setSendResult] = useState('')
  const [expandedHistory, setExpandedHistory] = useState<number | null>(null)

  async function load() {
    setLoading(true)
    try {
      const [cr, hr] = await Promise.all([
        fetch('/api/contacts', { headers: { Authorization: `Bearer ${token}` } }).then(r => r.json()),
        fetch('/api/newsletter/history', { headers: { Authorization: `Bearer ${token}` } }).then(r => r.json()),
      ])
      if (Array.isArray(cr)) setContacts(cr)
      if (Array.isArray(hr)) setHistory(hr)
    } catch { /* ignore */ } finally { setLoading(false) }
  }

  useEffect(() => { load() }, [])

  const allTags = Array.from(new Set(contacts.flatMap(c => c.tags)))
  const filtered = filterTag ? contacts.filter(c => c.tags.includes(filterTag)) : contacts
  const subscribedCount = (filterTag ? filtered : contacts).filter(c => c.subscribed).length

  async function addContact(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    const tags = form.tags.split(',').map(t => t.trim()).filter(Boolean)
    await fetch('/api/contacts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ ...form, tags }),
    })
    setSaving(false)
    setForm(emptyContact)
    setShowAdd(false)
    load()
  }

  async function deleteContact(id: number) {
    if (!confirm('Kontakt löschen?')) return
    await fetch(`/api/contacts/${id}`, { method: 'DELETE', headers: { Authorization: `Bearer ${token}` } })
    setContacts(prev => prev.filter(c => c.id !== id))
  }

  async function toggleSubscribed(contact: Contact) {
    const next = !contact.subscribed
    await fetch(`/api/contacts/${contact.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ ...contact, subscribed: next }),
    })
    setContacts(prev => prev.map(c => c.id === contact.id ? { ...c, subscribed: next ? 1 : 0 } : c))
  }

  async function sendNewsletter(e: React.FormEvent) {
    e.preventDefault()
    if (!confirm(`Newsletter an ${subscribedCount} Kontakte senden?`)) return
    setSending(true)
    setSendResult('')
    try {
      const tags = nlTag ? [nlTag] : []
      const r = await fetch('/api/newsletter/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ subject: nlSubject, body: nlBody, tags }),
      })
      const data = await r.json()
      setSendResult(`✓ Gesendet an ${data.sent} Kontakte`)
      setNlSubject('')
      setNlBody('')
      setNlTag('')
      load()
    } catch { setSendResult('Fehler beim Senden') } finally { setSending(false) }
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h2 className="section-title text-xl font-bold font-display flex items-center gap-2">
          <Users size={20} /> Kontakte & Newsletter
        </h2>
        <div className="flex gap-2">
          <button type="button" onClick={() => setView('contacts')}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${view === 'contacts' ? 'bg-primary text-white' : 'bg-bg-raised text-muted border border-theme'}`}>
            Kontakte ({contacts.length})
          </button>
          <button type="button" onClick={() => setView('newsletter')}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${view === 'newsletter' ? 'bg-primary text-white' : 'bg-bg-raised text-muted border border-theme'}`}>
            Newsletter
          </button>
          <button type="button" onClick={load} disabled={loading} className="p-1.5 rounded-lg bg-bg-raised border border-theme hover:bg-bg-hover">
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
          </button>
        </div>
      </div>

      {view === 'contacts' && (
        <div>
          <div className="flex flex-wrap items-center gap-2 mb-4">
            {allTags.length > 0 && (
              <div className="flex gap-1 flex-wrap">
                <button type="button" onClick={() => setFilterTag('')}
                  className={`text-xs px-2 py-1 rounded-full border transition-colors ${!filterTag ? 'bg-accent-purple border-accent-purple text-white' : 'border-theme text-muted hover:border-white/30'}`}>
                  Alle
                </button>
                {allTags.map(tag => (
                  <button key={tag} type="button" onClick={() => setFilterTag(tag)}
                    className={`text-xs px-2 py-1 rounded-full border transition-colors ${filterTag === tag ? 'bg-accent-purple border-accent-purple text-white' : 'border-theme text-muted hover:border-white/30'}`}>
                    {tag}
                  </button>
                ))}
              </div>
            )}
            <button type="button" onClick={() => setShowAdd(v => !v)}
              className="ml-auto flex items-center gap-1 px-3 py-1.5 rounded-lg bg-accent-purple text-white text-sm hover:bg-accent-purple/80 transition-colors">
              <Plus size={14} /> Kontakt hinzufügen
            </button>
          </div>

          {showAdd && (
            <form onSubmit={addContact} className="rounded-xl border border-theme bg-bg-raised p-4 mb-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-muted mb-1 block">Name *</label>
                <input required value={form.name} onChange={e => setForm({...form, name: e.target.value})} className="admin-input w-full" placeholder="Max Mustermann" />
              </div>
              <div>
                <label className="text-xs text-muted mb-1 block">E-Mail *</label>
                <input required type="email" value={form.email} onChange={e => setForm({...form, email: e.target.value})} className="admin-input w-full" placeholder="max@beispiel.de" />
              </div>
              <div>
                <label className="text-xs text-muted mb-1 block">Telefon</label>
                <input value={form.phone} onChange={e => setForm({...form, phone: e.target.value})} className="admin-input w-full" placeholder="+49 123 456789" />
              </div>
              <div>
                <label className="text-xs text-muted mb-1 block">Tags (kommagetrennt)</label>
                <input value={form.tags} onChange={e => setForm({...form, tags: e.target.value})} className="admin-input w-full" placeholder="Händler, Pokémon TCG" />
              </div>
              <div className="sm:col-span-2">
                <label className="text-xs text-muted mb-1 block">Notizen</label>
                <input value={form.notes} onChange={e => setForm({...form, notes: e.target.value})} className="admin-input w-full" placeholder="..." />
              </div>
              <div className="sm:col-span-2 flex gap-2">
                <button type="submit" disabled={saving} className="btn-primary text-sm flex items-center gap-1">
                  <Plus size={13} /> Speichern
                </button>
                <button type="button" onClick={() => setShowAdd(false)} className="btn-outline text-sm">Abbrechen</button>
              </div>
            </form>
          )}

          <p className="text-xs text-muted mb-3">{filtered.length} Kontakte · {subscribedCount} abonniert</p>

          <div className="space-y-2">
            {filtered.length === 0 && (
              <div className="text-center py-12 text-muted text-sm">Keine Kontakte</div>
            )}
            {filtered.map(contact => (
              <div key={contact.id} className="flex items-center gap-3 rounded-lg border border-theme bg-bg-raised p-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-medium text-sm">{contact.name}</span>
                    {contact.tags.map(tag => (
                      <span key={tag} className="text-xs px-1.5 py-0.5 rounded-full bg-accent-purple/20 text-accent-purple">{tag}</span>
                    ))}
                    <span className="text-xs text-muted">{contact.source}</span>
                  </div>
                  <div className="flex items-center gap-3 mt-0.5">
                    <span className="text-xs text-muted flex items-center gap-1"><Mail size={10} />{contact.email}</span>
                    {contact.phone && <span className="text-xs text-muted">{contact.phone}</span>}
                  </div>
                </div>
                <button type="button" onClick={() => toggleSubscribed(contact)}
                  className={`text-xs px-2 py-1 rounded-full border transition-colors flex-shrink-0 ${contact.subscribed ? 'bg-green-500/20 text-green-500 border-green-500/30' : 'bg-red-500/10 text-red-400 border-red-500/20'}`}>
                  {contact.subscribed ? 'Aktiv' : 'Abgemeldet'}
                </button>
                <button type="button" onClick={() => deleteContact(contact.id)} className="p-1.5 rounded text-red-400 hover:text-red-600 hover:bg-red-500/10 transition-colors flex-shrink-0">
                  <Trash2 size={14} />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {view === 'newsletter' && (
        <div className="space-y-6">
          <form onSubmit={sendNewsletter} className="rounded-xl border border-theme bg-bg-raised p-5 space-y-4 max-w-2xl">
            <h3 className="font-semibold text-sm section-title">Neue Nachricht senden</h3>
            <div>
              <label className="text-xs text-muted mb-1 block">Empfänger-Gruppe (leer = alle)</label>
              <select value={nlTag} onChange={e => setNlTag(e.target.value)} className="admin-input w-full text-sm">
                <option value="">Alle abonnierten Kontakte ({contacts.filter(c => c.subscribed).length})</option>
                {allTags.map(tag => (
                  <option key={tag} value={tag}>{tag} ({contacts.filter(c => c.subscribed && c.tags.includes(tag)).length})</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-xs text-muted mb-1 block">Betreff *</label>
              <input required value={nlSubject} onChange={e => setNlSubject(e.target.value)} className="admin-input w-full" placeholder="Neues Event: ShinyFam @ TCG Messe..." />
            </div>
            <div>
              <label className="text-xs text-muted mb-1 block">Nachricht *</label>
              <textarea required value={nlBody} onChange={e => setNlBody(e.target.value)} rows={6} className="admin-input w-full font-mono text-sm"
                placeholder="Hallo,&#10;&#10;wir freuen uns, euch über unser neues Event zu informieren!&#10;..." />
            </div>
            {sendResult && (
              <div className={`text-sm p-3 rounded-lg ${sendResult.startsWith('✓') ? 'bg-green-500/10 text-green-600' : 'bg-red-500/10 text-red-500'}`}>
                {sendResult}
              </div>
            )}
            <button type="submit" disabled={sending || subscribedCount === 0} className="btn-primary text-sm flex items-center gap-2">
              <Send size={13} /> {sending ? 'Sende…' : `Senden an ${subscribedCount} Kontakte`}
            </button>
          </form>

          {history.length > 0 && (
            <div>
              <h3 className="text-sm font-semibold text-muted uppercase tracking-wider mb-3">Verlauf</h3>
              <div className="space-y-2">
                {history.map(h => (
                  <div key={h.id} className="rounded-lg border border-theme bg-bg-raised overflow-hidden">
                    <button type="button" onClick={() => setExpandedHistory(expandedHistory === h.id ? null : h.id)}
                      className="w-full flex items-center justify-between p-3 text-left hover:bg-bg-hover transition-colors">
                      <div>
                        <span className="font-medium text-sm">{h.subject}</span>
                        <span className="text-xs text-muted ml-3">{h.sent_count} gesendet · {new Date(h.created_at).toLocaleDateString('de-DE')}</span>
                      </div>
                      {expandedHistory === h.id ? <ChevronUp size={14} className="text-muted" /> : <ChevronDown size={14} className="text-muted" />}
                    </button>
                    {expandedHistory === h.id && (
                      <div className="px-3 pb-3 text-sm text-secondary whitespace-pre-wrap border-t border-theme pt-3">
                        {h.body}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
