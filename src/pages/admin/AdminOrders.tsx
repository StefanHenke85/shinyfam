import { useState, useEffect } from 'react'
import { Package, ChevronDown, ChevronUp, Users, ArrowUpDown, Palette, Trash2, CheckCheck, Send } from 'lucide-react'

interface MailTemplate {
  id: number; name: string; type: string; subject: string; body: string
}

interface ShopOrder {
  id: number; order_number: string; first_name: string; last_name: string
  email: string; city: string; total: number; order_status: string
  payment_method: string; items: string; created_at: string
}

interface Inquiry {
  id: number; name: string; email: string; event_name: string; event_date: string | null
  tcg: string | null; meters: string | null; message: string | null
  attendance_days: string | null; logo_url: string | null
  status: string; created_at: string
}

const attendanceDaysLabels: Record<string, string> = {
  beide: 'Beide Tage', tag1: 'Nur Tag 1', tag2: 'Nur Tag 2',
}

interface ArtworkOrder {
  id: number; name: string; email: string; phone: string | null
  motif: string; size: string | null; message: string | null
  status: string; created_at: string
}

type SortKey = 'date_desc' | 'date_asc' | 'status' | 'event'

const shopStatusLabels: Record<string, string> = {
  new: 'Neu', processing: 'In Bearbeitung', shipped: 'Versendet',
  delivered: 'Geliefert', cancelled: 'Storniert',
}

const inquiryStatusLabels: Record<string, string> = {
  new: 'Neu', contacted: 'Kontaktiert', confirmed: 'Bestätigt', declined: 'Abgelehnt', done: 'Erledigt',
}

const artworkStatusLabels: Record<string, string> = {
  new: 'Neu', contacted: 'Kontaktiert', confirmed: 'Bestätigt', declined: 'Abgelehnt', done: 'Erledigt',
}

const statusOrder: Record<string, number> = { new: 0, contacted: 1, confirmed: 2, declined: 3, done: 4 }

export default function AdminOrders({ token }: { token: string }) {
  const [tab, setTab] = useState<'inquiries' | 'artwork' | 'shop'>('inquiries')
  const [shopOrders, setShopOrders] = useState<ShopOrder[]>([])
  const [inquiries, setInquiries] = useState<Inquiry[]>([])
  const [artworkOrders, setArtworkOrders] = useState<ArtworkOrder[]>([])
  const [expanded, setExpanded] = useState<number | null>(null)
  const [loading, setLoading] = useState(false)
  const [sort, setSort] = useState<SortKey>('date_desc')
  const [noteEdits, setNoteEdits] = useState<Record<number, string>>({})
  const [noteSaving, setNoteSaving] = useState<number | null>(null)
  const [templates, setTemplates] = useState<MailTemplate[]>([])
  const [sendingMail, setSendingMail] = useState<number | null>(null)
  const [mailMsg, setMailMsg] = useState<Record<number, string>>({})
  const headers = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }

  async function load() {
    setLoading(true)
    const [shopRes, inquiriesRes, artworkRes, tmplRes] = await Promise.all([
      fetch('/api/shop/orders/admin', { headers }).then(r => r.json()).catch(() => []),
      fetch('/api/event-inquiries', { headers }).then(r => r.json()).catch(() => []),
      fetch('/api/orders', { headers }).then(r => r.json()).catch(() => []),
      fetch('/api/mail/templates', { headers }).then(r => r.json()).catch(() => []),
    ])
    setShopOrders(Array.isArray(shopRes) ? shopRes : [])
    setInquiries(Array.isArray(inquiriesRes) ? inquiriesRes : [])
    setArtworkOrders(Array.isArray(artworkRes) ? artworkRes : [])
    setTemplates(Array.isArray(tmplRes) ? tmplRes : [])
    setLoading(false)
  }
  useEffect(() => { load() }, [])

  async function updateShopStatus(id: number, status: string) {
    await fetch(`/api/shop/orders/${id}/status`, { method: 'PATCH', headers, body: JSON.stringify({ status }) })
    await load()
  }

  async function updateInquiryStatus(id: number, status: string) {
    await fetch(`/api/event-inquiries/${id}/status`, { method: 'PATCH', headers, body: JSON.stringify({ status }) })
    setInquiries(prev => prev.map(i => i.id === id ? { ...i, status } : i))
  }

  async function updateArtworkStatus(id: number, status: string) {
    await fetch(`/api/orders/${id}/status`, { method: 'PATCH', headers, body: JSON.stringify({ status }) })
    setArtworkOrders(prev => prev.map(o => o.id === id ? { ...o, status } : o))
  }

  async function deleteInquiry(id: number, name: string) {
    if (!confirm(`Händler-Anfrage von „${name}" wirklich löschen?`)) return
    await fetch(`/api/event-inquiries/${id}`, { method: 'DELETE', headers })
    setInquiries(prev => prev.filter(i => i.id !== id))
    if (expanded === id) setExpanded(null)
  }

  async function deleteArtworkOrder(id: number, name: string) {
    if (!confirm(`Kunstwerk-Anfrage von „${name}" wirklich löschen?`)) return
    await fetch(`/api/orders/${id}`, { method: 'DELETE', headers })
    setArtworkOrders(prev => prev.filter(o => o.id !== id))
    if (expanded === id) setExpanded(null)
  }

  async function sendTemplate(inquiryId: number, templateId: number) {
    setSendingMail(inquiryId)
    try {
      const r = await fetch('/api/mail/send-template', {
        method: 'POST', headers,
        body: JSON.stringify({ template_id: templateId, inquiry_id: inquiryId }),
      })
      const d = await r.json()
      if (r.ok) {
        setMailMsg(prev => ({ ...prev, [inquiryId]: '✓ Mail gesendet!' }))
      } else {
        setMailMsg(prev => ({ ...prev, [inquiryId]: '✗ Fehler: ' + d.error }))
      }
    } catch (e: any) {
      setMailMsg(prev => ({ ...prev, [inquiryId]: '✗ ' + e.message }))
    } finally {
      setSendingMail(null)
      setTimeout(() => setMailMsg(prev => { const n = { ...prev }; delete n[inquiryId]; return n }), 4000)
    }
  }

  async function saveNote(inq: Inquiry) {
    const note = noteEdits[inq.id] ?? inq.message ?? ''
    setNoteSaving(inq.id)
    await fetch(`/api/event-inquiries/${inq.id}/note`, { method: 'PATCH', headers, body: JSON.stringify({ note: note || null }) })
    setInquiries(prev => prev.map(i => i.id === inq.id ? { ...i, message: note || null } : i))
    setNoteSaving(null)
  }

  const sortedInquiries = [...inquiries].sort((a, b) => {
    if (sort === 'date_asc') return new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
    if (sort === 'date_desc') return new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    if (sort === 'status') return (statusOrder[a.status] ?? 9) - (statusOrder[b.status] ?? 9)
    if (sort === 'event') return a.event_name.localeCompare(b.event_name)
    return 0
  })

  const newInquiries = inquiries.filter(i => i.status === 'new').length
  const newArtwork = artworkOrders.filter(o => o.status === 'new').length

  return (
    <div>
      <div className="flex items-center gap-3 mb-6 flex-wrap">
        <button type="button" onClick={() => { setTab('inquiries'); setExpanded(null) }}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${tab === 'inquiries' ? 'bg-accent-purple text-white' : 'bg-bg-raised text-muted border border-theme'}`}>
          <Users size={15} /> Händler-Anfragen
          {newInquiries > 0 && <span className="ml-1 bg-white/20 text-white text-xs px-1.5 py-0.5 rounded-full">{newInquiries}</span>}
        </button>
        <button type="button" onClick={() => { setTab('artwork'); setExpanded(null) }}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${tab === 'artwork' ? 'bg-accent-pink text-white' : 'bg-bg-raised text-muted border border-theme'}`}>
          <Palette size={15} /> Kunstwerk-Anfragen
          {newArtwork > 0 && <span className="ml-1 bg-white/20 text-white text-xs px-1.5 py-0.5 rounded-full">{newArtwork}</span>}
        </button>
        <button type="button" onClick={() => { setTab('shop'); setExpanded(null) }}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${tab === 'shop' ? 'bg-accent-orange text-white' : 'bg-bg-raised text-muted border border-theme'}`}>
          <Package size={15} /> Shop-Bestellungen
        </button>
      </div>

      {loading ? (
        <p className="text-secondary text-center py-8">Lädt…</p>
      ) : tab === 'inquiries' ? (
        <>
          {inquiries.length > 0 && (
            <div className="flex items-center gap-2 mb-3 flex-wrap">
              <ArrowUpDown size={14} className="text-muted shrink-0" />
              <span className="text-xs text-muted">Sortierung:</span>
              {([['date_desc', 'Neueste zuerst'], ['date_asc', 'Älteste zuerst'], ['status', 'Status'], ['event', 'Event']] as [SortKey, string][]).map(([key, label]) => (
                <button key={key} type="button" onClick={() => setSort(key)}
                  className={`text-xs px-2.5 py-1 rounded-full border transition-colors ${sort === key ? 'bg-accent-purple text-white border-transparent' : 'border-theme text-secondary hover:border-accent-purple/50'}`}>
                  {label}
                </button>
              ))}
            </div>
          )}
          {sortedInquiries.length === 0 ? (
            <p className="text-muted text-center py-8">Noch keine Händler-Anfragen.</p>
          ) : (
            <div className="flex flex-col gap-3">
              {sortedInquiries.map((inq) => {
                const noteVal = noteEdits[inq.id] ?? inq.message ?? ''
                const noteChanged = inq.id in noteEdits && noteEdits[inq.id] !== (inq.message ?? '')
                return (
                  <div key={inq.id} className="admin-card overflow-hidden p-0">
                    <button type="button"
                      className="w-full p-4 flex items-center justify-between gap-4 text-left"
                      onClick={() => setExpanded(expanded === inq.id ? null : inq.id)}>
                      <div className="flex items-center gap-3 min-w-0">
                        <span className={`admin-status-badge ${inq.status === 'new' ? 'admin-status-new' : inq.status === 'confirmed' ? 'admin-status-delivered' : inq.status === 'declined' ? 'admin-status-cancelled' : 'admin-status-processing'}`}>
                          {inquiryStatusLabels[inq.status] || inq.status}
                        </span>
                        <div className="min-w-0">
                          <p className="section-title font-medium text-sm">{inq.name}</p>
                          <p className="text-secondary text-xs truncate">{inq.event_name}{inq.tcg ? ` · ${inq.tcg}` : ''}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <span className="text-xs text-muted">{new Date(inq.created_at).toLocaleDateString('de-DE')}</span>
                        {expanded === inq.id ? <ChevronUp size={14} className="text-muted" /> : <ChevronDown size={14} className="text-muted" />}
                      </div>
                    </button>
                    {expanded === inq.id && (
                      <div className="px-4 pb-4 border-t border-theme pt-3 space-y-3">
                        <div className="grid grid-cols-2 gap-2 text-sm">
                          <div><span className="text-muted text-xs">E-Mail</span><br /><a href={`mailto:${inq.email}`} className="text-accent-purple hover:underline">{inq.email}</a></div>
                          {inq.event_date && <div><span className="text-muted text-xs">Datum</span><br />{new Date(inq.event_date).toLocaleDateString('de-DE')}</div>}
                          {inq.tcg && <div><span className="text-muted text-xs">TCG</span><br />{inq.tcg}</div>}
                          {inq.meters && <div><span className="text-muted text-xs">Standfläche</span><br />{inq.meters}</div>}
                          {inq.attendance_days && <div><span className="text-muted text-xs">Teilnahme</span><br />{attendanceDaysLabels[inq.attendance_days] || inq.attendance_days}</div>}
                        </div>
                        {inq.logo_url && (
                          <div>
                            <span className="text-muted text-xs block mb-1">Logo</span>
                            <img src={inq.logo_url} alt={`Logo ${inq.name}`} className="h-12 object-contain bg-white rounded p-1" />
                          </div>
                        )}
                        <div>
                          <label className="text-muted text-xs block mb-1">Notiz / Nachricht</label>
                          <textarea rows={3} value={noteVal}
                            onChange={e => setNoteEdits(prev => ({ ...prev, [inq.id]: e.target.value }))}
                            className="input-field resize-none text-sm w-full" placeholder="Notiz hinzufügen…" />
                          {noteChanged && (
                            <button type="button" onClick={() => saveNote(inq)} disabled={noteSaving === inq.id}
                              className="btn-primary text-xs mt-1.5 !py-1.5 !px-4">
                              {noteSaving === inq.id ? 'Speichert…' : 'Notiz speichern'}
                            </button>
                          )}
                        </div>
                        {templates.length > 0 && (
                          <div className="pt-1">
                            <p className="text-muted text-xs mb-1.5 flex items-center gap-1"><Send size={11} /> Vorlage senden:</p>
                            <div className="flex gap-2 flex-wrap">
                              {templates.map(t => (
                                <button key={t.id} type="button"
                                  disabled={sendingMail === inq.id}
                                  onClick={() => sendTemplate(inq.id, t.id)}
                                  className="text-xs px-3 py-1 rounded-full border border-accent-purple/40 text-accent-purple hover:bg-accent-purple/10 transition-colors flex items-center gap-1 disabled:opacity-50">
                                  <Send size={10} />
                                  {sendingMail === inq.id ? 'Sende…' : t.name}
                                </button>
                              ))}
                            </div>
                            {mailMsg[inq.id] && (
                              <p className={`text-xs mt-1.5 px-2 py-1 rounded ${mailMsg[inq.id].startsWith('✓') ? 'bg-green-500/10 text-green-600' : 'bg-red-500/10 text-red-500'}`}>
                                {mailMsg[inq.id]}
                              </p>
                            )}
                          </div>
                        )}
                        <div className="flex gap-2 flex-wrap pt-1 items-center">
                          {Object.entries(inquiryStatusLabels).map(([s, label]) => (
                            <button key={s} type="button" onClick={() => updateInquiryStatus(inq.id, s)}
                              className={`text-xs px-3 py-1 rounded-full border transition-colors flex items-center gap-1 ${inq.status === s ? 'btn-primary !py-1 !px-3' : 'btn-outline !py-1 !px-3'}`}>
                              {s === 'done' && <CheckCheck size={11} />}{label}
                            </button>
                          ))}
                          <button type="button" onClick={() => deleteInquiry(inq.id, inq.name)}
                            className="ml-auto text-xs px-3 py-1 rounded-full border border-red-500/30 text-red-500 hover:bg-red-500/10 transition-colors flex items-center gap-1">
                            <Trash2 size={11} /> Löschen
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </>
      ) : tab === 'artwork' ? (
        artworkOrders.length === 0 ? (
          <p className="text-muted text-center py-8">Noch keine Kunstwerk-Anfragen.</p>
        ) : (
          <div className="flex flex-col gap-3">
            {artworkOrders.map((ao) => (
              <div key={ao.id} className="admin-card overflow-hidden p-0">
                <button type="button"
                  className="w-full p-4 flex items-center justify-between gap-4 text-left"
                  onClick={() => setExpanded(expanded === ao.id ? null : ao.id)}>
                  <div className="flex items-center gap-3 min-w-0">
                    <span className={`admin-status-badge ${ao.status === 'new' ? 'admin-status-new' : ao.status === 'confirmed' ? 'admin-status-delivered' : ao.status === 'declined' ? 'admin-status-cancelled' : 'admin-status-processing'}`}>
                      {artworkStatusLabels[ao.status] || ao.status}
                    </span>
                    <div className="min-w-0">
                      <p className="section-title font-medium text-sm">{ao.name}</p>
                      <p className="text-secondary text-xs truncate">{ao.motif}{ao.size ? ` · ${ao.size}` : ''}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className="text-xs text-muted">{new Date(ao.created_at).toLocaleDateString('de-DE')}</span>
                    {expanded === ao.id ? <ChevronUp size={14} className="text-muted" /> : <ChevronDown size={14} className="text-muted" />}
                  </div>
                </button>
                {expanded === ao.id && (
                  <div className="px-4 pb-4 border-t border-theme pt-3 space-y-3">
                    <div className="grid grid-cols-2 gap-2 text-sm">
                      <div><span className="text-muted text-xs">E-Mail</span><br /><a href={`mailto:${ao.email}`} className="text-accent-pink hover:underline">{ao.email}</a></div>
                      {ao.phone && <div><span className="text-muted text-xs">Telefon</span><br />{ao.phone}</div>}
                      <div><span className="text-muted text-xs">Motiv</span><br />{ao.motif}</div>
                      {ao.size && <div><span className="text-muted text-xs">Größe</span><br />{ao.size}</div>}
                    </div>
                    {ao.message && (
                      <div>
                        <span className="text-muted text-xs">Nachricht</span>
                        <p className="text-secondary text-sm mt-0.5 whitespace-pre-wrap">{ao.message}</p>
                      </div>
                    )}
                    <div className="flex gap-2 flex-wrap pt-1 items-center">
                      {Object.entries(artworkStatusLabels).map(([s, label]) => (
                        <button key={s} type="button" onClick={() => updateArtworkStatus(ao.id, s)}
                          className={`text-xs px-3 py-1 rounded-full border transition-colors flex items-center gap-1 ${ao.status === s ? 'btn-primary !py-1 !px-3' : 'btn-outline !py-1 !px-3'}`}>
                          {s === 'done' && <CheckCheck size={11} />}{label}
                        </button>
                      ))}
                      <button type="button" onClick={() => deleteArtworkOrder(ao.id, ao.name)}
                        className="ml-auto text-xs px-3 py-1 rounded-full border border-red-500/30 text-red-500 hover:bg-red-500/10 transition-colors flex items-center gap-1">
                        <Trash2 size={11} /> Löschen
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )
      ) : (
        shopOrders.length === 0 ? (
          <p className="text-muted text-center py-8">Noch keine Shop-Bestellungen.</p>
        ) : (
          <div className="flex flex-col gap-3">
            {shopOrders.map((o) => (
              <div key={o.id} className="admin-card overflow-hidden p-0">
                <button type="button"
                  className="w-full p-4 flex items-center justify-between gap-4 text-left"
                  onClick={() => setExpanded(expanded === o.id ? null : o.id)}>
                  <div className="flex items-center gap-3 min-w-0">
                    <span className={`admin-status-badge admin-status-${o.order_status}`}>
                      {shopStatusLabels[o.order_status] || o.order_status}
                    </span>
                    <div className="min-w-0">
                      <p className="section-title font-medium text-sm">{o.order_number}</p>
                      <p className="text-secondary text-xs truncate">{o.first_name} {o.last_name} · {o.city}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    <span className="font-bold section-title">€{o.total?.toFixed(2)}</span>
                    {expanded === o.id ? <ChevronUp size={14} className="text-muted" /> : <ChevronDown size={14} className="text-muted" />}
                  </div>
                </button>
                {expanded === o.id && (
                  <div className="px-4 pb-4 border-t border-theme pt-3">
                    <p className="text-secondary text-sm mb-1">{o.email} · {o.payment_method}</p>
                    <p className="text-muted text-xs mb-3">{new Date(o.created_at).toLocaleString('de-DE')}</p>
                    <div className="flex gap-2 flex-wrap">
                      {Object.entries(shopStatusLabels).map(([s, label]) => (
                        <button key={s} type="button" onClick={() => updateShopStatus(o.id, s)}
                          className={`text-xs px-3 py-1 rounded-full border transition-colors ${o.order_status === s ? 'btn-primary !py-1 !px-3' : 'btn-outline !py-1 !px-3'}`}>
                          {label}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )
      )}
    </div>
  )
}
