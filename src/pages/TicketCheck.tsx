import { useCallback, useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { CheckCircle2, XCircle, AlertTriangle, Loader2, Undo2 } from 'lucide-react'

interface CheckData {
  found: boolean
  isTest?: boolean
  code: string
  kind: 'visitor' | 'dealer'
  label: string
  validDays: string[]
  status: 'valid' | 'cancelled'
  event: { title: string } | null
  days: { key: string; label: string }[]
  today: string | null
  checkins: Record<string, string>
  admin?: boolean
  holder?: string
  order?: { orderNumber: string; name: string; company: string | null; paymentStatus: string }
  deposit?: { inquiryId: number; status: string | null; amount: number } | null
}

const time = (iso: string) => new Date(iso).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })

export default function TicketCheck() {
  const { code = '' } = useParams()
  const nav = useNavigate()
  const token = localStorage.getItem('shinyfam-admin-token')
  const [data, setData] = useState<CheckData | null>(null)
  const [day, setDay] = useState('')
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null)
  const [busy, setBusy] = useState(false)
  const [manual, setManual] = useState('')

  const load = useCallback(() => {
    fetch(`/api/tickets/check/${code}`, { headers: token ? { Authorization: `Bearer ${token}` } : {} })
      .then(r => r.json())
      .then((d: CheckData) => {
        setData(d)
        if (d.found) setDay(cur => cur || (d.today && d.validDays.includes(d.today) ? d.today : d.validDays.find(k => !d.checkins[k]) || d.validDays[0]))
      })
      .catch(() => setData({ found: false } as CheckData))
  }, [code, token])

  useEffect(() => { setMsg(null); setDay(''); load() }, [load])

  async function checkin(undo = false) {
    setBusy(true); setMsg(null)
    try {
      const r = await fetch(`/api/tickets/checkin/${code}`, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body: JSON.stringify({ day, undo }) })
      const d = await r.json()
      setMsg(r.ok ? { ok: true, text: undo ? 'Check-in zurückgenommen.' : 'Eingecheckt – viel Spaß!' } : { ok: false, text: d.error || 'Fehler' })
      load()
    } finally { setBusy(false) }
  }

  async function setDeposit(status: string | null) {
    if (!data?.deposit) return
    await fetch(`/api/tickets/admin/deposits/${data.deposit.inquiryId}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body: JSON.stringify({ status }) })
    load()
  }

  if (!data) return <div className="max-w-md mx-auto px-4 pt-28 pb-12 text-muted flex items-center gap-2"><Loader2 size={16} className="animate-spin" /> Prüfe Ticket…</div>

  const dayLabel = (k: string) => data.days?.find(d => d.key === k)?.label || k
  const usedToday = !!(day && data.checkins?.[day])
  const validForDay = !!day && data.validDays?.includes(day)
  const ok = data.found && data.status === 'valid'

  return (
    <div className="max-w-md mx-auto px-4 pt-28 pb-12">
      <div className={`rounded-2xl p-6 text-center text-white mb-4 ${!ok ? 'bg-red-600' : data.admin && usedToday ? 'bg-amber-500' : 'bg-green-600'}`}>
        {!ok ? <XCircle size={56} className="mx-auto mb-2" /> : data.admin && usedToday ? <AlertTriangle size={56} className="mx-auto mb-2" /> : <CheckCircle2 size={56} className="mx-auto mb-2" />}
        <p className="text-2xl font-black">
          {!data.found ? 'Ticket unbekannt' : data.status !== 'valid' ? 'Ungültig / storniert' : data.admin && usedToday ? 'Heute schon eingecheckt' : 'Gültiges Ticket'}
        </p>
        {data.found && <p className="text-sm opacity-90 mt-1">{data.event?.title}</p>}
        {data.isTest && <p className="mt-2 inline-block bg-white/90 text-red-600 font-black text-sm px-3 py-1 rounded-full">🧪 TEST-TICKET</p>}
      </div>

      {data.found && (
        <div className="card rounded-2xl p-5 mb-4">
          <p className="text-xs text-muted">{data.kind === 'dealer' ? 'HÄNDLER' : 'BESUCHER'} · {data.code}</p>
          <p className="text-lg font-bold text-primary">{data.label}</p>
          <p className="text-secondary text-sm">Gültig: {data.validDays.map(dayLabel).join(' + ')}</p>
          {data.admin && data.holder && <p className="text-secondary text-sm">Name: {data.holder}</p>}
          {data.admin && data.order && <p className="text-muted text-xs">Bestellung {data.order.orderNumber} · {data.order.paymentStatus === 'paid' ? 'bezahlt' : data.order.paymentStatus}</p>}
          {Object.entries(data.checkins || {}).map(([k, v]) => <p key={k} className="text-muted text-xs">Eingecheckt {dayLabel(k)} um {time(v)} Uhr</p>)}
        </div>
      )}

      {data.admin && ok && (
        <div className="card rounded-2xl p-5 mb-4">
          {data.validDays.length > 1 || !data.today ? (
            <div className="flex gap-2 mb-3">
              {data.validDays.map(k => (
                <button key={k} type="button" onClick={() => { setDay(k); setMsg(null) }} className={`flex-1 px-2 py-2 rounded-lg border text-xs font-semibold ${day === k ? 'border-accent-purple bg-accent-purple/10 text-primary' : 'border-theme text-secondary'}`}>{dayLabel(k)}</button>
              ))}
            </div>
          ) : null}
          {data.today && !data.validDays.includes(data.today) && <p className="text-red-500 text-sm font-semibold mb-2">Achtung: Dieses Ticket gilt NICHT für heute!</p>}
          {!usedToday ? (
            <button type="button" disabled={busy || !validForDay} onClick={() => checkin(false)} className="btn-primary w-full text-lg py-4">{busy ? 'Moment…' : `Einchecken (${dayLabel(day)})`}</button>
          ) : (
            <button type="button" disabled={busy} onClick={() => checkin(true)} className="btn-outline w-full flex items-center justify-center gap-2"><Undo2 size={14} /> Check-in zurücknehmen</button>
          )}
          {msg && <p className={`mt-3 text-center font-semibold ${msg.ok ? 'text-green-600' : 'text-red-500'}`}>{msg.text}</p>}
        </div>
      )}

      {data.admin && data.deposit && data.deposit.amount > 0 && (
        <div className="rounded-2xl border border-amber-400/60 bg-amber-400/10 p-5 mb-4">
          <p className="font-bold text-primary mb-1">Unratütox-Gebühr {data.deposit.amount.toFixed(2).replace('.', ',')} € (bar)</p>
          <p className="text-secondary text-sm mb-3">Status: {data.deposit.status === 'received' ? '✅ erhalten' : data.deposit.status === 'returned' ? '↩️ zurückgegeben' : data.deposit.status === 'kept' ? '❌ einbehalten' : '⏳ noch nicht kassiert'}</p>
          <div className="grid grid-cols-3 gap-2">
            <button type="button" onClick={() => setDeposit('received')} className="btn-outline text-xs px-2">Erhalten</button>
            <button type="button" onClick={() => setDeposit('returned')} className="btn-outline text-xs px-2">Zurück</button>
            <button type="button" onClick={() => setDeposit('kept')} className="btn-outline text-xs px-2">Einbehalten</button>
          </div>
        </div>
      )}

      {data.admin && (
        <form onSubmit={e => { e.preventDefault(); const c = manual.trim().toUpperCase().replace(/.*\/T\//, ''); if (c) { setManual(''); nav(`/t/${c}`) } }} className="flex gap-2">
          <input value={manual} onChange={e => setManual(e.target.value)} placeholder="Nächster Code (oder QR scannen)" className="flex-1 bg-bg-surface border border-theme rounded-lg px-3 py-2 text-primary text-sm uppercase" />
          <button type="submit" className="btn-primary text-sm">Prüfen</button>
        </form>
      )}
      {!data.admin && data.found && <p className="text-muted text-xs text-center">Einlass-Team: im Admin anmelden, dann erscheint hier der Check-in.</p>}
    </div>
  )
}
