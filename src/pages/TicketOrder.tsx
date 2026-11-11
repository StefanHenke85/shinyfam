import { useEffect, useState } from 'react'
import { Link, useParams, useSearchParams } from 'react-router-dom'
import { CheckCircle2, Clock, XCircle, Download, Copy, Loader2 } from 'lucide-react'

const euro = (n: number) => `${n.toFixed(2).replace('.', ',')} €`

interface OrderData {
  order: { orderNumber: string; kind: 'visitor' | 'dealer'; name: string; email: string; company: string | null; items: { label: string; qty: number; price: number }[]; total: number; paymentMethod: 'paypal' | 'transfer'; paymentStatus: 'pending' | 'paid' | 'cancelled'; createdAt: string }
  event: { title: string; date: string; endDate: string | null; location: string; address: string; city: string } | null
  days: { key: string; label: string }[]
  tickets: { code: string; kind: string; label: string; validDays: string[]; status: string }[]
  depositAmount: number
  payment: { method: string; bankHolder: string; iban: string; bic: string; bankName: string; paypalLink: string | null; reference: string } | null
}

function CopyRow({ label, value }: { label: string; value: string }) {
  const [done, setDone] = useState(false)
  if (!value) return null
  return (
    <div className="flex items-center justify-between gap-2 py-1.5 border-b border-theme last:border-0">
      <span className="text-muted text-xs">{label}</span>
      <button type="button" className="flex items-center gap-1.5 text-primary text-sm font-mono" onClick={() => { navigator.clipboard?.writeText(value); setDone(true); setTimeout(() => setDone(false), 1500) }}>
        {value} <Copy size={12} className={done ? 'text-green-500' : 'text-muted'} />
      </button>
    </div>
  )
}

export default function TicketOrder() {
  const { number } = useParams()
  const [sp] = useSearchParams()
  const k = sp.get('k') || ''
  const [data, setData] = useState<OrderData | null>(null)
  const [error, setError] = useState('')

  useEffect(() => {
    let stop = false
    const load = () => {
      const token = localStorage.getItem('shinyfam-admin-token')
      fetch(`/api/tickets/order/${number}?k=${encodeURIComponent(k)}`, { headers: token ? { Authorization: `Bearer ${token}` } : {} })
        .then(async r => { const d = await r.json(); if (!r.ok) throw new Error(d.error || 'Fehler'); return d })
        .then(d => { if (!stop) setData(d) })
        .catch(e => { if (!stop) setError(e.message) })
    }
    load()
    const t = setInterval(load, 60000) // Seite offen lassen -> Tickets erscheinen nach Zahlungseingang
    return () => { stop = true; clearInterval(t) }
  }, [number, k])

  if (error) return <div className="max-w-2xl mx-auto px-4 py-12 pt-28"><div className="card rounded-2xl p-6 text-primary">{error}</div></div>
  if (!data) return <div className="max-w-2xl mx-auto px-4 py-12 pt-28 text-muted flex items-center gap-2"><Loader2 className="animate-spin" size={16} /> Lädt…</div>

  const o = data.order
  const dayLabel = (key: string) => data.days.find(d => d.key === key)?.label || key
  return (
    <div className="max-w-2xl mx-auto px-4 py-12 pt-28">
      <p className="text-accent-purple font-semibold text-sm mb-1">Bestellung {o.orderNumber}</p>
      <h1 className="font-display text-3xl font-black section-title mb-2">{data.event?.title}</h1>
      {data.event && <p className="text-secondary text-sm mb-6">{data.event.location}, {data.event.address}, {data.event.city}</p>}

      <div className="card rounded-2xl p-5 mb-5">
        {o.paymentStatus === 'paid' && <p className="flex items-center gap-2 text-green-600 font-semibold mb-3"><CheckCircle2 size={18} /> Bezahlt – {o.kind === 'dealer' ? 'dein Stand ist bestätigt' : 'deine Tickets sind gültig'}</p>}
        {o.paymentStatus === 'pending' && <p className="flex items-center gap-2 text-amber-600 font-semibold mb-3"><Clock size={18} /> Wartet auf Zahlung</p>}
        {o.paymentStatus === 'cancelled' && <p className="flex items-center gap-2 text-red-500 font-semibold mb-3"><XCircle size={18} /> Storniert</p>}
        {o.items.map(i => (
          <div key={i.label} className="flex justify-between text-sm text-primary py-1"><span>{i.qty} × {i.label}</span><span>{euro(i.qty * i.price)}</span></div>
        ))}
        <div className="flex justify-between font-bold text-primary border-t border-theme mt-2 pt-2"><span>Gesamt</span><span>{euro(o.total)}</span></div>
      </div>

      {data.payment && (
        <div className="card rounded-2xl p-5 mb-5">
          <h2 className="font-display font-bold text-lg section-title mb-2">So bezahlst du</h2>
          {data.payment.method === 'paypal' ? (
            <>
              {data.payment.paypalLink
                ? <a href={data.payment.paypalLink} target="_blank" rel="noopener noreferrer" className="btn-primary inline-flex mb-3">Jetzt {euro(o.total)} mit PayPal zahlen</a>
                : <p className="text-secondary text-sm mb-2">Der PayPal-Link wird gerade eingerichtet – wir melden uns per Mail.</p>}
              <p className="text-secondary text-sm">Bitte gib bei PayPal als Nachricht <strong className="text-primary">{data.payment.reference}</strong> an.</p>
            </>
          ) : (
            <div className="text-sm">
              <CopyRow label="Kontoinhaber" value={data.payment.bankHolder} />
              <CopyRow label="IBAN" value={data.payment.iban} />
              <CopyRow label="BIC" value={data.payment.bic} />
              <CopyRow label="Bank" value={data.payment.bankName} />
              <CopyRow label="Betrag" value={euro(o.total)} />
              <CopyRow label="Verwendungszweck" value={data.payment.reference} />
              {!data.payment.iban && <p className="text-secondary mt-2">Die Bankdaten werden gerade ergänzt – du bekommst sie auch per Mail.</p>}
            </div>
          )}
          <p className="text-muted text-xs mt-3">Sobald deine Zahlung da ist, schicken wir dir die Tickets per Mail an {o.email}. Diese Seite aktualisiert sich automatisch.</p>
        </div>
      )}

      {data.depositAmount > 0 && o.paymentStatus !== 'cancelled' && (
        <div className="rounded-xl border border-amber-400/60 bg-amber-400/10 p-4 text-sm text-primary mb-5">
          <strong>Unratkaution: {euro(data.depositAmount)} in bar mitbringen.</strong> Du bekommst sie nach der Messe zurück, wenn deine Standfläche sauber und ordentlich hinterlassen wurde.
        </div>
      )}

      {data.tickets.length > 0 && (
        <div className="card rounded-2xl p-5 mb-5">
          <div className="flex items-center justify-between mb-3 gap-2 flex-wrap">
            <h2 className="font-display font-bold text-lg section-title">Deine Tickets</h2>
            <a href={`/api/tickets/pdf/${o.orderNumber}?k=${encodeURIComponent(k)}`} target="_blank" rel="noopener noreferrer" className="btn-outline text-sm inline-flex items-center gap-2"><Download size={14} /> PDF</a>
          </div>
          <div className="grid sm:grid-cols-2 gap-4">
            {data.tickets.map(t => (
              <div key={t.code} className="rounded-xl border border-theme bg-white p-3 text-center">
                <img src={`/api/tickets/qr/${t.code}.png`} alt={`QR-Code Ticket ${t.code}`} className="w-full max-w-[220px] mx-auto" />
                <p className="text-gray-900 font-semibold text-sm mt-2">{t.label}</p>
                <p className="text-gray-600 text-xs">{t.validDays.map(dayLabel).join(' + ')}</p>
                <p className="text-purple-700 font-mono font-bold mt-1">{t.code}</p>
                {t.status !== 'valid' && <p className="text-red-600 text-xs font-bold">STORNIERT</p>}
              </div>
            ))}
          </div>
          <p className="text-muted text-xs mt-3">Am Einlass einfach den QR-Code zeigen – ausgedruckt oder auf dem Handy (Bildschirm hell stellen).</p>
        </div>
      )}
      <p className="text-muted text-xs">Fragen zur Bestellung? <a href={`mailto:info@shinyfam.de?subject=${o.orderNumber}`} className="text-accent-purple underline">info@shinyfam.de</a> · <Link to="/ticket-bedingungen" className="text-accent-purple underline">Ticketbedingungen</Link></p>
    </div>
  )
}
