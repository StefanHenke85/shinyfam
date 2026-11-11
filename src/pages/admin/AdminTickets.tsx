import { useCallback, useEffect, useState } from 'react'
import { Check, X, Mail, RotateCcw, Copy, ExternalLink, Save, Loader2 } from 'lucide-react'

const euro = (n: number) => `${Number(n || 0).toFixed(2).replace('.', ',')} €`
const inputCls = 'w-full bg-bg-surface border border-theme rounded-lg px-3 py-2 text-primary text-sm focus:border-accent-purple outline-none'

interface VisitorOption { key: string; label: string; price: number; enabled: boolean }
interface Config {
  slug: string; visitorEnabled: boolean; visitorOptions: VisitorOption[]; visitorLimit: number | null; visitorInfo: string
  dealerEnabled: boolean; dealerMeterOptions: number[]; dealerDayOptions: string[]; dealerPricePerMeterDay: number | null; dealerLimit: number | null
  depositAmount: number; salesEnd: string | null; paypalEnabled: boolean; transferEnabled: boolean; saved?: boolean
}
interface EventRow { id: string; title: string; date: string; endDate: string | null; days: { key: string; label: string }[]; config: Config; counts: { visitors: number; dealers: number }; paid: { n: number; sum: number }; pending: { n: number; sum: number } }
interface OrderRow { isTest?: boolean; id: number; orderNumber: string; accessKey: string; kind: 'visitor' | 'dealer'; name: string; email: string; phone: string | null; company: string | null; items: { label: string; qty: number; price: number }[]; total: number; paymentMethod: string; paymentStatus: string; createdAt: string; paidAt: string | null; adminNote: string | null; tickets: { code: string; checkins: Record<string, string>; status: string }[] }
interface Dealer { id: number; name: string; company: string | null; email: string; phone: string | null; meters: string | null; attendance_days: string | null; status: string; deposit_status: string | null; ticket_order: string | null }

export default function AdminTickets({ token }: { token: string }) {
  const auth = { Authorization: `Bearer ${token}` }
  const [events, setEvents] = useState<EventRow[]>([])
  const [eventId, setEventId] = useState('')
  const [view, setView] = useState<'orders' | 'deposit' | 'config' | 'bank'>('orders')
  const ev = events.find(e => e.id === eventId)
  const [sandbox, setSandbox] = useState<{ sandbox: boolean; testOrders: number } | null>(null)
  const loadSandbox = useCallback(() => {
    fetch('/api/tickets/admin/sandbox', { headers: auth }).then(r => r.json()).then(setSandbox).catch(() => {})
  }, [token]) // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { loadSandbox() }, [loadSandbox])
  async function toggleSandbox() {
    if (!sandbox) return
    const on = !sandbox.sandbox
    if (!on && !confirm('Testmodus AUS und echten Verkauf starten?\n\nAb jetzt sind Bestellungen echt: Zahlungsdaten müssen eingetragen sein, Händlerbuchungen landen in den Händler-Anfragen und info@shinyfam.de bekommt Benachrichtigungen.')) return
    await fetch('/api/tickets/admin/sandbox', { method: 'PUT', headers: { ...auth, 'Content-Type': 'application/json' }, body: JSON.stringify({ on }) })
    loadSandbox(); loadEvents()
  }
  async function clearTest() {
    if (!confirm('Alle Testbestellungen und Test-Tickets löschen?')) return
    await fetch('/api/tickets/admin/test-data', { method: 'DELETE', headers: auth })
    loadSandbox(); loadEvents()
  }

  const loadEvents = useCallback(() => {
    fetch('/api/tickets/admin/events', { headers: auth }).then(r => r.json()).then((d: EventRow[]) => {
      if (!Array.isArray(d)) return
      setEvents(d)
      setEventId(cur => cur || (d.find(e => new Date(e.endDate || e.date) >= new Date())?.id ?? d[0]?.id ?? ''))
    })
  }, [token]) // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { loadEvents() }, [loadEvents])

  const shopLink = ev ? `${window.location.origin}/tickets/${ev.config.slug || ev.id}` : ''

  return (
    <div>
      <div className="flex flex-wrap items-center gap-3 mb-4">
        <h2 className="font-display text-2xl font-bold section-title mr-auto">Online-Tickets</h2>
        <select className={inputCls + ' max-w-xs'} value={eventId} onChange={e => setEventId(e.target.value)}>
          {events.map(e => <option key={e.id} value={e.id}>{e.title} ({e.date.slice(0, 10)})</option>)}
        </select>
      </div>

      {sandbox && (
        <div className={`rounded-xl p-3 mb-4 flex flex-wrap items-center gap-3 text-sm border-2 ${sandbox.sandbox ? 'border-red-400 bg-red-500/10' : 'border-green-500 bg-green-500/10'}`}>
          <span className="text-primary font-bold mr-auto">{sandbox.sandbox ? '🧪 Testmodus AN – Bestellungen sind nur Tests (Zahlung per Knopf simulierbar)' : '✅ Echter Verkauf läuft'}</span>
          {sandbox.testOrders > 0 && <button type="button" onClick={clearTest} className="btn-outline text-xs">{sandbox.testOrders} Testbestellung{sandbox.testOrders > 1 ? 'en' : ''} löschen</button>}
          <button type="button" onClick={toggleSandbox} className={sandbox.sandbox ? 'btn-primary text-xs' : 'btn-outline text-xs'}>{sandbox.sandbox ? 'Echten Verkauf starten' : 'Zurück in den Testmodus'}</button>
        </div>
      )}

      {ev && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
          <div className="card rounded-xl p-3"><p className="text-muted text-xs">Bezahlt</p><p className="text-primary font-bold">{ev.paid.n} · {euro(ev.paid.sum)}</p></div>
          <div className="card rounded-xl p-3"><p className="text-muted text-xs">Offen</p><p className="text-amber-600 font-bold">{ev.pending.n} · {euro(ev.pending.sum)}</p></div>
          <div className="card rounded-xl p-3"><p className="text-muted text-xs">Besuchertickets</p><p className="text-primary font-bold">{ev.counts.visitors}{ev.config.visitorLimit ? ` / ${ev.config.visitorLimit}` : ''}</p></div>
          <div className="card rounded-xl p-3"><p className="text-muted text-xs">Online-Stände</p><p className="text-primary font-bold">{ev.counts.dealers}{ev.config.dealerLimit ? ` / ${ev.config.dealerLimit}` : ''}</p></div>
        </div>
      )}

      {ev && (ev.config.visitorEnabled || ev.config.dealerEnabled) && (
        <div className="card rounded-xl p-3 mb-4 flex flex-wrap items-center gap-2 text-sm">
          <span className="text-muted">Link für Instagram/Facebook/WhatsApp:</span>
          <code className="text-primary">{shopLink}</code>
          <button type="button" className="btn-outline text-xs inline-flex items-center gap-1" onClick={() => navigator.clipboard?.writeText(shopLink)}><Copy size={12} /> Kopieren</button>
          <a href={shopLink} target="_blank" rel="noopener noreferrer" className="btn-outline text-xs inline-flex items-center gap-1"><ExternalLink size={12} /> Öffnen</a>
        </div>
      )}

      <div className="flex gap-2 mb-4 flex-wrap">
        {([['orders', 'Bestellungen'], ['deposit', 'Händler & Unratütox'], ['config', 'Verkauf einrichten'], ['bank', 'Bank & PayPal']] as const).map(([k, l]) => (
          <button key={k} type="button" onClick={() => setView(k)} className={`px-3 py-1.5 rounded-lg text-sm font-semibold border ${view === k ? 'border-accent-purple bg-accent-purple/10 text-primary' : 'border-theme text-secondary'}`}>{l}</button>
        ))}
      </div>

      {ev && view === 'orders' && <Orders token={token} eventId={ev.id} days={ev.days} onChange={loadEvents} />}
      {ev && view === 'deposit' && <Deposits token={token} eventId={ev.id} />}
      {ev && view === 'config' && <ConfigForm key={ev.id} token={token} ev={ev} onSaved={loadEvents} />}
      {view === 'bank' && <BankSettings token={token} />}
    </div>
  )
}

function Orders({ token, eventId, days, onChange }: { token: string; eventId: string; days: { key: string; label: string }[]; onChange: () => void }) {
  const [orders, setOrders] = useState<OrderRow[] | null>(null)
  const [filter, setFilter] = useState<'all' | 'pending' | 'paid' | 'cancelled'>('pending')
  const [q, setQ] = useState('')
  const [busy, setBusy] = useState<number | null>(null)
  const load = useCallback(() => {
    fetch(`/api/tickets/admin/orders?event=${encodeURIComponent(eventId)}`, { headers: { Authorization: `Bearer ${token}` } }).then(r => r.json()).then(setOrders)
  }, [eventId, token])
  useEffect(() => { load() }, [load])

  async function act(o: OrderRow, action: string, extra: Record<string, unknown> = {}) {
    if (action === 'paid' && !confirm(`Zahlung von ${euro(o.total)} für ${o.orderNumber} (${o.name}) eingegangen?\n\nDie Tickets werden sofort per Mail verschickt.`)) return
    if (action === 'cancel' && !confirm(`${o.orderNumber} wirklich stornieren? Die Tickets werden ungültig.`)) return
    setBusy(o.id)
    try {
      const r = await fetch(`/api/tickets/admin/orders/${o.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body: JSON.stringify({ action, ...extra }) })
      const d = await r.json()
      if (!r.ok) alert(d.error || 'Fehler')
      else if (action === 'paid' && d.mailed === false) alert('Bezahlt markiert, aber die Mail konnte nicht verschickt werden. Bitte später „Mail erneut“ klicken.')
      load(); onChange()
    } finally { setBusy(null) }
  }

  if (!orders) return <p className="text-muted flex items-center gap-2"><Loader2 size={14} className="animate-spin" /> Lädt…</p>
  const ql = q.toLowerCase()
  const list = orders.filter(o => (filter === 'all' || o.paymentStatus === filter) && (!ql || [o.orderNumber, o.name, o.email, o.company || ''].some(s => s.toLowerCase().includes(ql))))
  const ageDays = (iso: string) => Math.floor((Date.now() - new Date(iso.replace(' ', 'T') + 'Z').getTime()) / 86400000)
  const dl = (k: string) => days.find(d => d.key === k)?.label.split(',')[0] || k

  return (
    <div>
      <div className="flex flex-wrap gap-2 mb-3">
        {(['pending', 'paid', 'cancelled', 'all'] as const).map(f => (
          <button key={f} type="button" onClick={() => setFilter(f)} className={`px-3 py-1 rounded-full text-xs font-semibold border ${filter === f ? 'border-accent-purple bg-accent-purple/10 text-primary' : 'border-theme text-secondary'}`}>
            {{ pending: 'Wartet auf Zahlung', paid: 'Bezahlt', cancelled: 'Storniert', all: 'Alle' }[f]} ({orders.filter(o => f === 'all' || o.paymentStatus === f).length})
          </button>
        ))}
        <input value={q} onChange={e => setQ(e.target.value)} placeholder="Suche Name / TK-Nummer / Mail" className={inputCls + ' max-w-xs ml-auto'} />
      </div>
      {list.length === 0 && <p className="text-muted text-sm">Keine Bestellungen.</p>}
      <div className="flex flex-col gap-2">
        {list.map(o => (
          <div key={o.id} className="card rounded-xl p-4">
            <div className="flex flex-wrap items-start gap-3">
              <div className="mr-auto">
                <p className="font-mono text-sm font-bold text-accent-purple">{o.orderNumber} <span className="text-xs text-muted font-sans">{o.isTest ? '🧪 TEST · ' : ''}{o.kind === 'dealer' ? '🏪 Händler' : '🎟️ Besucher'} · {o.paymentMethod === 'paypal' ? 'PayPal' : 'Überweisung'}</span></p>
                <p className="text-primary font-semibold">{o.company ? `${o.company} – ` : ''}{o.name}</p>
                <p className="text-secondary text-xs">{o.email}{o.phone ? ` · ${o.phone}` : ''} · bestellt {o.createdAt.slice(0, 16)}{o.paymentStatus === 'pending' && ageDays(o.createdAt) >= 5 ? ` · ⚠️ seit ${ageDays(o.createdAt)} Tagen offen` : ''}</p>
                <p className="text-secondary text-sm mt-1">{o.items.map(i => `${i.qty}× ${i.label}`).join(', ')}</p>
                {o.tickets.length > 0 && <p className="text-muted text-xs mt-1">Tickets: {o.tickets.map(t => `${t.code}${Object.keys(t.checkins).length ? ' ✓' + Object.keys(t.checkins).map(dl).join('/') : ''}`).join(' · ')}</p>}
              </div>
              <div className="text-right">
                <p className="text-primary font-bold">{euro(o.total)}</p>
                <span className={`admin-status-badge ${o.paymentStatus === 'paid' ? 'admin-status-delivered' : o.paymentStatus === 'cancelled' ? 'admin-status-cancelled' : 'admin-status-new'}`}>{o.paymentStatus === 'paid' ? 'bezahlt' : o.paymentStatus === 'cancelled' ? 'storniert' : 'offen'}</span>
              </div>
            </div>
            <div className="flex flex-wrap gap-2 mt-3">
              {o.paymentStatus === 'pending' && <button type="button" disabled={busy === o.id} onClick={() => act(o, 'paid')} className="btn-primary text-xs inline-flex items-center gap-1"><Check size={12} /> Zahlung eingegangen</button>}
              {o.paymentStatus !== 'cancelled' && <button type="button" disabled={busy === o.id} onClick={() => act(o, 'resend')} className="btn-outline text-xs inline-flex items-center gap-1"><Mail size={12} /> {o.paymentStatus === 'paid' ? 'Tickets erneut senden' : 'Zahlungsinfo erneut'}</button>}
              {o.paymentStatus !== 'cancelled' && <button type="button" disabled={busy === o.id} onClick={() => act(o, 'cancel', { notify: confirm('Kunde per Mail über die Stornierung informieren?') })} className="btn-outline text-xs inline-flex items-center gap-1"><X size={12} /> Stornieren</button>}
              {o.paymentStatus === 'cancelled' && <button type="button" disabled={busy === o.id} onClick={() => act(o, 'reopen')} className="btn-outline text-xs inline-flex items-center gap-1"><RotateCcw size={12} /> Wieder öffnen</button>}
              <a href={`/tickets/bestellung/${o.orderNumber}?k=${o.accessKey}`} target="_blank" rel="noopener noreferrer" className="btn-outline text-xs inline-flex items-center gap-1"><ExternalLink size={12} /> Kundenansicht</a>
              <button type="button" onClick={() => { const n = prompt('Notiz', o.adminNote || ''); if (n !== null) act(o, 'note', { note: n }) }} className="btn-outline text-xs">Notiz{o.adminNote ? ': ' + o.adminNote.slice(0, 30) : ''}</button>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

function Deposits({ token, eventId }: { token: string; eventId: string }) {
  const [data, setData] = useState<{ amount: number; dealers: Dealer[] } | null>(null)
  const load = useCallback(() => {
    fetch(`/api/tickets/admin/deposits?event=${encodeURIComponent(eventId)}`, { headers: { Authorization: `Bearer ${token}` } }).then(r => r.json()).then(setData)
  }, [eventId, token])
  useEffect(() => { load() }, [load])
  async function set(d: Dealer, status: string | null) {
    await fetch(`/api/tickets/admin/deposits/${d.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body: JSON.stringify({ status }) })
    load()
  }
  if (!data) return <p className="text-muted">Lädt…</p>
  const c = (s: string | null) => data.dealers.filter(d => d.deposit_status === s).length
  return (
    <div>
      <p className="text-secondary text-sm mb-3">
        Alle Händler dieses Events (Online-Buchungen und normale Anfragen, ohne abgelehnte). Unratütox-Gebühr {euro(data.amount)} bar ·
        kassiert {c('received')} · zurück {c('returned')} · einbehalten {c('kept')} · offen {c(null)} ·
        <strong className="text-primary"> Kasse aktuell: {euro((c('received') + c('kept')) * data.amount)}</strong>
      </p>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead><tr className="text-left text-muted text-xs"><th className="py-2 pr-2">Händler</th><th className="pr-2">Stand</th><th className="pr-2">Status</th><th>Unratütox</th></tr></thead>
          <tbody>
            {data.dealers.map(d => (
              <tr key={d.id} className="border-t border-theme">
                <td className="py-2 pr-2"><p className="text-primary font-semibold">{d.company || d.name}</p><p className="text-muted text-xs">{d.company ? d.name : ''}{d.ticket_order ? ` · ${d.ticket_order}` : ''}</p></td>
                <td className="pr-2 text-secondary text-xs">{d.meters || '–'} · {d.attendance_days === 'beide' ? 'beide' : d.attendance_days === 'tag1' ? 'Tag 1' : d.attendance_days === 'tag2' ? 'Tag 2' : '–'}</td>
                <td className="pr-2 text-xs text-secondary">{d.status}</td>
                <td>
                  <div className="flex gap-1 flex-wrap">
                    {([['received', 'Erhalten'], ['returned', 'Zurück'], ['kept', 'Einbehalten']] as const).map(([s, l]) => (
                      <button key={s} type="button" onClick={() => set(d, d.deposit_status === s ? null : s)} className={`px-2 py-1 rounded text-xs border ${d.deposit_status === s ? (s === 'kept' ? 'bg-red-500 text-white border-red-500' : 'bg-green-600 text-white border-green-600') : 'border-theme text-secondary'}`}>{l}</button>
                    ))}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function ConfigForm({ token, ev, onSaved }: { token: string; ev: EventRow; onSaved: () => void }) {
  const [c, setC] = useState<Config>(ev.config)
  const [meters, setMeters] = useState(ev.config.dealerMeterOptions.join(', '))
  const [msg, setMsg] = useState('')
  const dayOpts = ev.days.length > 1 ? [['beide', 'Beide Tage'], ...ev.days.map(d => [d.key, d.label])] : ev.days.map(d => [d.key, d.label])

  async function save() {
    setMsg('')
    const body = { ...c, dealerMeterOptions: meters.split(/[ ,;]+/).map(Number).filter(n => n > 0) }
    const r = await fetch(`/api/tickets/admin/config/${ev.id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body: JSON.stringify(body) })
    const d = await r.json()
    setMsg(r.ok ? 'Gespeichert ✓' : d.error || 'Fehler')
    if (r.ok) onSaved()
  }

  const chk = 'flex items-center gap-2 text-sm text-primary'
  return (
    <div className="flex flex-col gap-4">
      {!ev.config.saved && <p className="text-amber-600 text-sm">Noch nicht eingerichtet – unten stehen Vorschläge aus den Event-Daten. Erst nach „Speichern“ und Haken bei „aktiv“ ist der Verkauf sichtbar.</p>}
      <div className="card rounded-xl p-4 grid md:grid-cols-2 gap-3">
        <div><label className="text-secondary text-xs block mb-1">Kurzlink (z.B. rheinberg)</label><input className={inputCls} value={c.slug} onChange={e => setC({ ...c, slug: e.target.value })} placeholder="rheinberg" /></div>
        <div><label className="text-secondary text-xs block mb-1">Online-Verkauf endet</label><input type="datetime-local" className={inputCls} value={c.salesEnd || ''} onChange={e => setC({ ...c, salesEnd: e.target.value || null })} /></div>
        <label className={chk}><input type="checkbox" checked={c.paypalEnabled} onChange={e => setC({ ...c, paypalEnabled: e.target.checked })} /> PayPal anbieten</label>
        <label className={chk}><input type="checkbox" checked={c.transferEnabled} onChange={e => setC({ ...c, transferEnabled: e.target.checked })} /> Überweisung anbieten</label>
      </div>

      <div className="card rounded-xl p-4 flex flex-col gap-3">
        <label className={chk + ' font-bold'}><input type="checkbox" checked={c.visitorEnabled} onChange={e => setC({ ...c, visitorEnabled: e.target.checked })} /> 🎟️ Besuchertickets aktiv</label>
        {c.visitorOptions.map((o, i) => (
          <div key={o.key} className="grid grid-cols-[auto_1fr_110px] gap-2 items-center">
            <input type="checkbox" checked={o.enabled} onChange={e => { const v = [...c.visitorOptions]; v[i] = { ...o, enabled: e.target.checked }; setC({ ...c, visitorOptions: v }) }} />
            <input className={inputCls} value={o.label} onChange={e => { const v = [...c.visitorOptions]; v[i] = { ...o, label: e.target.value }; setC({ ...c, visitorOptions: v }) }} />
            <input type="number" step="0.5" min="0" className={inputCls} value={o.price} onChange={e => { const v = [...c.visitorOptions]; v[i] = { ...o, price: Number(e.target.value) }; setC({ ...c, visitorOptions: v }) }} />
          </div>
        ))}
        <div className="grid md:grid-cols-2 gap-3">
          <div><label className="text-secondary text-xs block mb-1">Max. Online-Tickets gesamt (leer = unbegrenzt)</label><input type="number" className={inputCls} value={c.visitorLimit ?? ''} onChange={e => setC({ ...c, visitorLimit: e.target.value ? Number(e.target.value) : null })} /></div>
          <div><label className="text-secondary text-xs block mb-1">Hinweis unter den Tickets</label><input className={inputCls} value={c.visitorInfo} onChange={e => setC({ ...c, visitorInfo: e.target.value })} /></div>
        </div>
      </div>

      <div className="card rounded-xl p-4 flex flex-col gap-3">
        <label className={chk + ' font-bold'}><input type="checkbox" checked={c.dealerEnabled} onChange={e => setC({ ...c, dealerEnabled: e.target.checked })} /> 🏪 Händlerstände online buchbar</label>
        <div className="grid md:grid-cols-2 gap-3">
          <div><label className="text-secondary text-xs block mb-1">Buchbare Meter (z.B. 2, 3, 4)</label><input className={inputCls} value={meters} onChange={e => setMeters(e.target.value)} /></div>
          <div><label className="text-secondary text-xs block mb-1">Preis pro Meter und Tag (€)</label><input type="number" step="0.5" className={inputCls} value={c.dealerPricePerMeterDay ?? ''} onChange={e => setC({ ...c, dealerPricePerMeterDay: e.target.value ? Number(e.target.value) : null })} /></div>
          <div><label className="text-secondary text-xs block mb-1">Max. Online-Stände (leer = unbegrenzt)</label><input type="number" className={inputCls} value={c.dealerLimit ?? ''} onChange={e => setC({ ...c, dealerLimit: e.target.value ? Number(e.target.value) : null })} /></div>
          <div><label className="text-secondary text-xs block mb-1">Unratütox-Gebühr bar vor Ort (€)</label><input type="number" step="1" className={inputCls} value={c.depositAmount} onChange={e => setC({ ...c, depositAmount: Number(e.target.value) })} /></div>
        </div>
        <div className="flex flex-wrap gap-3">
          {dayOpts.map(([k, l]) => (
            <label key={k} className={chk}><input type="checkbox" checked={c.dealerDayOptions.includes(k)} onChange={e => setC({ ...c, dealerDayOptions: e.target.checked ? [...c.dealerDayOptions, k] : c.dealerDayOptions.filter(x => x !== k) })} /> {l}</label>
          ))}
        </div>
      </div>
      <div className="flex items-center gap-3">
        <button type="button" onClick={save} className="btn-primary inline-flex items-center gap-2"><Save size={14} /> Speichern</button>
        <a href={`/tickets/${c.slug || ev.id}`} target="_blank" rel="noopener noreferrer" className="btn-outline inline-flex items-center gap-2 text-sm"><ExternalLink size={14} /> Vorschau</a>
        {msg && <span className="text-sm text-secondary">{msg}</span>}
      </div>
    </div>
  )
}

function BankSettings({ token }: { token: string }) {
  const keys = [['ticket_bank_holder', 'Kontoinhaber'], ['ticket_iban', 'IBAN'], ['ticket_bic', 'BIC (optional)'], ['ticket_bank_name', 'Bank (optional)'], ['ticket_paypal_me', 'PayPal.me-Name (nur der Name, z.B. shinyfam)']] as const
  const [vals, setVals] = useState<Record<string, string>>({})
  const [msg, setMsg] = useState('')
  useEffect(() => { fetch('/api/settings').then(r => r.json()).then(d => setVals(d)) }, [])
  async function save() {
    for (const [k] of keys) {
      await fetch('/api/settings', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body: JSON.stringify({ key: k, value: (vals[k] || '').trim() }) })
    }
    setMsg('Gespeichert ✓')
  }
  return (
    <div className="card rounded-xl p-4 flex flex-col gap-3 max-w-xl">
      <p className="text-secondary text-sm">Diese Daten stehen in der Bestellbestätigung und auf der Bestellseite. Zahlungseingänge prüft ihr selbst (Konto/PayPal) und klickt dann bei der Bestellung auf „Zahlung eingegangen“.</p>
      {keys.map(([k, l]) => (
        <div key={k}><label className="text-secondary text-xs block mb-1">{l}</label><input className={inputCls} value={vals[k] || ''} onChange={e => setVals({ ...vals, [k]: e.target.value })} /></div>
      ))}
      <p className="text-muted text-xs">Tipp PayPal: Kunden sollten „Waren und Dienstleistungen“ wählen – dann seid ihr und die Kunden abgesichert.</p>
      <div className="flex items-center gap-3"><button type="button" onClick={save} className="btn-primary inline-flex items-center gap-2"><Save size={14} /> Speichern</button>{msg && <span className="text-sm text-secondary">{msg}</span>}</div>
    </div>
  )
}
