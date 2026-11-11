import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { CalendarDays, MapPin, Ticket, Store, Minus, Plus, Loader2 } from 'lucide-react'
import ImageUpload from '../components/ImageUpload'

const inputCls = 'w-full bg-bg-surface border border-theme rounded-lg px-3 py-2 text-primary text-sm focus:border-accent-purple outline-none transition-colors'
const euro = (n: number) => `${n.toFixed(2).replace('.', ',')} €`

interface ShopListItem { eventId: string; slug: string; title: string; date: string; endDate: string | null; city: string; location: string; visitorEnabled: boolean; dealerEnabled: boolean; open: boolean }
interface DayInfo { key: string; date: string; label: string }
interface ShopData {
  event: { id: string; title: string; date: string; endDate: string | null; location: string; address: string; city: string; imageUrl: string | null; schedule: { label: string; start: string; end: string }[] | null; soldOut: boolean }
  days: DayInfo[]
  open: boolean
  preview: boolean
  visitor: { enabled: boolean; options: { key: string; label: string; price: number }[]; remaining: number | null; info: string } | null
  dealer: { enabled: boolean; meterOptions: number[]; dayOptions: { key: string; label: string; days: number }[]; pricePerMeterDay: number | null; remaining: number | null; depositAmount: number; maxMeters?: number | null; tables?: Record<string, { length: number; total: number; free: number }[]> | null } | null
  payment: { paypal: boolean; transfer: boolean }
  sandbox?: boolean
}

function fmtRange(date: string, end: string | null) {
  const d = new Date(date)
  const opts: Intl.DateTimeFormatOptions = { weekday: 'short', day: '2-digit', month: '2-digit', year: 'numeric' }
  if (!end || end.slice(0, 10) === date.slice(0, 10)) return d.toLocaleDateString('de-DE', opts)
  return `${d.toLocaleDateString('de-DE', { weekday: 'short', day: '2-digit', month: '2-digit' })} – ${new Date(end).toLocaleDateString('de-DE', opts)}`
}

function TicketList() {
  const [list, setList] = useState<ShopListItem[] | null>(null)
  useEffect(() => { fetch('/api/tickets/shop').then(r => r.json()).then(setList).catch(() => setList([])) }, [])
  return (
    <div className="max-w-3xl mx-auto px-4 py-12 pt-28">
      <h1 className="font-display text-4xl font-black section-title mb-2">Tickets</h1>
      <p className="text-secondary mb-8">Eintrittskarten und Händlerstände für unsere nächsten Events – bequem online, bezahlt per PayPal oder Überweisung.</p>
      {list === null && <p className="text-muted flex items-center gap-2"><Loader2 className="animate-spin" size={16} /> Lädt…</p>}
      {list?.length === 0 && <div className="card rounded-2xl p-6 text-secondary">Aktuell läuft kein Online-Verkauf. Schau bald wieder vorbei oder folge uns auf Instagram!</div>}
      <div className="flex flex-col gap-4">
        {list?.map(e => (
          <Link key={e.eventId} to={`/tickets/${e.slug}`} className="card rounded-2xl p-5 hover:border-accent-purple transition-colors block">
            <p className="font-display font-bold text-xl section-title">{e.title}</p>
            <p className="text-secondary text-sm mt-1 flex items-center gap-2"><CalendarDays size={14} /> {fmtRange(e.date, e.endDate)}</p>
            <p className="text-secondary text-sm flex items-center gap-2"><MapPin size={14} /> {e.location}, {e.city}</p>
            <div className="flex gap-2 mt-3 flex-wrap">
              {e.visitorEnabled && <span className="text-xs px-2 py-1 rounded-full bg-accent-purple/10 text-accent-purple font-semibold">🎟️ Eintritt</span>}
              {e.dealerEnabled && <span className="text-xs px-2 py-1 rounded-full bg-accent-purple/10 text-accent-purple font-semibold">🏪 Händlerstand</span>}
              {!e.open && <span className="text-xs px-2 py-1 rounded-full bg-red-500/10 text-red-500 font-semibold">Verkauf beendet</span>}
            </div>
          </Link>
        ))}
      </div>
    </div>
  )
}

function PaymentChoice({ value, onChange, payment }: { value: string; onChange: (v: string) => void; payment: ShopData['payment'] }) {
  return (
    <div>
      <span className="text-secondary text-xs mb-1 block">Bezahlung *</span>
      <div className="flex gap-2">
        {payment.paypal && (
          <label className={`flex-1 text-center px-3 py-2 rounded-lg border text-sm cursor-pointer ${value === 'paypal' ? 'border-accent-purple bg-accent-purple/10 text-primary font-medium' : 'border-theme bg-bg-surface text-secondary'}`}>
            <input type="radio" className="sr-only" checked={value === 'paypal'} onChange={() => onChange('paypal')} /> PayPal
          </label>
        )}
        {payment.transfer && (
          <label className={`flex-1 text-center px-3 py-2 rounded-lg border text-sm cursor-pointer ${value === 'transfer' ? 'border-accent-purple bg-accent-purple/10 text-primary font-medium' : 'border-theme bg-bg-surface text-secondary'}`}>
            <input type="radio" className="sr-only" checked={value === 'transfer'} onChange={() => onChange('transfer')} /> Überweisung
          </label>
        )}
      </div>
      <p className="text-muted text-xs mt-1">
        {value === 'paypal' ? 'Nach dem Absenden bekommst du einen PayPal-Link. Tickets kommen per Mail, sobald die Zahlung bei uns geprüft ist.' : 'Nach dem Absenden bekommst du unsere Bankdaten. Tickets kommen per Mail, sobald das Geld eingegangen ist (meist 1–2 Werktage).'}
      </p>
    </div>
  )
}

function Terms({ checked, onChange, dealer }: { checked: boolean; onChange: (v: boolean) => void; dealer?: boolean }) {
  return (
    <label className="flex items-start gap-2 text-xs text-secondary cursor-pointer">
      <input type="checkbox" required checked={checked} onChange={e => onChange(e.target.checked)} className="mt-0.5" />
      <span>
        Ich akzeptiere die <Link to="/ticket-bedingungen" target="_blank" className="text-accent-purple underline">Ticket- und Teilnahmebedingungen</Link>
        {dealer ? ' (inkl. Unratütox-Gebühr)' : ''} und habe die <Link to="/datenschutz" target="_blank" className="text-accent-purple underline">Datenschutzerklärung</Link> gelesen.
        Mir ist bekannt, dass bei Tickets für einen festen Veranstaltungstermin kein Widerrufsrecht besteht (§ 312g Abs. 2 Nr. 9 BGB).
      </span>
    </label>
  )
}

function VisitorForm({ data }: { data: ShopData }) {
  const nav = useNavigate()
  const v = data.visitor!
  const [qty, setQty] = useState<Record<string, number>>({})
  const [form, setForm] = useState({ name: '', email: '', phone: '' })
  const [pm, setPm] = useState(data.payment.paypal ? 'paypal' : 'transfer')
  const [terms, setTerms] = useState(false)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  const count = Object.values(qty).reduce((a, b) => a + b, 0)
  const total = v.options.reduce((s, o) => s + (qty[o.key] || 0) * o.price, 0)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setErr('')
    if (!count) { setErr('Bitte mindestens ein Ticket auswählen.'); return }
    setBusy(true)
    try {
      const r = await fetch('/api/tickets/order', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ kind: 'visitor', eventId: data.event.id, quantities: qty, ...form, paymentMethod: pm, acceptTerms: terms }) })
      const d = await r.json()
      if (!r.ok) throw new Error(d.error || 'Fehler')
      nav(`/tickets/bestellung/${d.orderNumber}?k=${d.key}`)
    } catch (e) { setErr((e as Error).message) } finally { setBusy(false) }
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-4">
      <div className="flex flex-col gap-2">
        {v.options.map(o => (
          <div key={o.key} className="flex items-center justify-between gap-3 rounded-xl border border-theme bg-bg-surface px-4 py-3">
            <div>
              <p className="text-primary font-semibold text-sm">{o.label}</p>
              <p className="text-secondary text-sm">{euro(o.price)}</p>
            </div>
            <div className="flex items-center gap-2">
              <button type="button" aria-label="weniger" className="icon-btn w-8 h-8 border border-theme rounded-lg" onClick={() => setQty({ ...qty, [o.key]: Math.max(0, (qty[o.key] || 0) - 1) })}><Minus size={14} /></button>
              <span className="w-6 text-center font-bold text-primary">{qty[o.key] || 0}</span>
              <button type="button" aria-label="mehr" className="icon-btn w-8 h-8 border border-theme rounded-lg" onClick={() => setQty({ ...qty, [o.key]: Math.min(10, (qty[o.key] || 0) + 1) })}><Plus size={14} /></button>
            </div>
          </div>
        ))}
        {v.info && <p className="text-muted text-xs">{v.info}</p>}
        {v.remaining != null && <p className="text-muted text-xs">Noch {v.remaining} Tickets verfügbar.</p>}
      </div>
      <div className="grid sm:grid-cols-2 gap-3">
        <div className="sm:col-span-2"><label className="text-secondary text-xs mb-1 block">Name *</label><input required className={inputCls} value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="Max Mustermann" /></div>
        <div><label className="text-secondary text-xs mb-1 block">E-Mail * (hierhin kommen die Tickets)</label><input required type="email" className={inputCls} value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} placeholder="max@beispiel.de" /></div>
        <div><label className="text-secondary text-xs mb-1 block">Telefon</label><input type="tel" className={inputCls} value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} /></div>
      </div>
      <PaymentChoice value={pm} onChange={setPm} payment={data.payment} />
      <Terms checked={terms} onChange={setTerms} />
      {err && <p className="text-red-500 text-sm">{err}</p>}
      <button type="submit" disabled={busy || !count} className="btn-primary flex items-center justify-center gap-2">
        {busy ? <Loader2 size={16} className="animate-spin" /> : <Ticket size={16} />}
        {count ? `${count} Ticket${count > 1 ? 's' : ''} verbindlich bestellen – ${euro(total)}` : 'Tickets auswählen'}
      </button>
    </form>
  )
}

function DealerForm({ data }: { data: ShopData }) {
  const nav = useNavigate()
  const d = data.dealer!
  const [form, setForm] = useState({ customerType: 'gewerblich', company: '', name: '', email: '', phone: '', street: '', zip: '', city: '', tcg: '', message: '', logoUrl: '' })
  const [meters, setMeters] = useState<number>(d.meterOptions[0] || 0)
  const [days, setDays] = useState<string>(d.dayOptions[0]?.key || '')
  const [pm, setPm] = useState(data.payment.paypal ? 'paypal' : 'transfer')
  const [terms, setTerms] = useState(false)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  const nDays = d.dayOptions.find(o => o.key === days)?.days || 1
  // Tischmodus: Haendler waehlen Tische je Laenge
  const tableList = d.tables ? (d.tables[days] || []) : null
  const [tableQty, setTableQty] = useState<Record<string, number>>({})
  const tableMeters = tableList ? Math.round(tableList.reduce((s, t) => s + t.length * (tableQty[String(t.length)] || 0), 0) * 100) / 100 : 0
  const effMeters = tableList ? tableMeters : meters
  const tooMuch = !!(tableList && d.maxMeters && tableMeters > d.maxMeters + 0.001)
  const price = d.pricePerMeterDay != null ? Math.round(d.pricePerMeterDay * effMeters * nDays * 100) / 100 : null
  const fm = (n: number) => String(n).replace('.', ',')
  const isCommercial = form.customerType === 'gewerblich'

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setErr(''); setBusy(true)
    try {
      const r = await fetch('/api/tickets/order', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ kind: 'dealer', eventId: data.event.id, ...form, company: isCommercial ? form.company : '', zipCity: `${form.zip.trim()} ${form.city.trim()}`.trim(), meters, tables: tableList ? tableQty : undefined, days, paymentMethod: pm, acceptTerms: terms }) })
      const res = await r.json()
      if (!r.ok) throw new Error(res.error || 'Fehler')
      nav(`/tickets/bestellung/${res.orderNumber}?k=${res.key}`)
    } catch (e) { setErr((e as Error).message) } finally { setBusy(false) }
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-3">
      <div className="grid sm:grid-cols-2 gap-3">
        {!tableList && (
        <div>
          <label className="text-secondary text-xs mb-1 block">Standgröße *</label>
          <select className={inputCls} value={meters} onChange={e => setMeters(Number(e.target.value))} disabled={d.meterOptions.length < 2}>
            {d.meterOptions.map(m => <option key={m} value={m}>{m} Meter</option>)}
          </select>
        </div>
        )}
        <div>
          <label className="text-secondary text-xs mb-1 block">Teilnahme *</label>
          <select className={inputCls} value={days} onChange={e => setDays(e.target.value)} disabled={d.dayOptions.length < 2}>
            {d.dayOptions.map(o => <option key={o.key} value={o.key}>{o.label}</option>)}
          </select>
        </div>
      </div>
      {tableList && (
        <div className="rounded-xl border border-theme p-3 flex flex-col gap-2">
          <p className="text-secondary text-xs">Tische auswählen *{d.maxMeters ? ` (max. ${fm(d.maxMeters)} m pro Händler)` : ''}</p>
          {tableList.map(t => {
            const k = String(t.length)
            const q = tableQty[k] || 0
            return (
              <div key={k} className="flex items-center gap-3 text-sm">
                <span className="text-primary font-semibold w-28">Tisch {fm(t.length)} m</span>
                <button type="button" className="btn-outline px-3 py-1" disabled={q <= 0} onClick={() => setTableQty({ ...tableQty, [k]: q - 1 })}>−</button>
                <span className="text-primary font-bold w-6 text-center">{q}</span>
                <button type="button" className="btn-outline px-3 py-1" disabled={q >= t.free || (!!d.maxMeters && tableMeters + t.length > d.maxMeters + 0.001)} onClick={() => setTableQty({ ...tableQty, [k]: q + 1 })}>+</button>
                <span className="text-muted text-xs">{t.free > 0 ? `noch ${t.free} frei` : 'ausgebucht'}</span>
              </div>
            )
          })}
          <p className="text-primary text-sm">Deine Standlänge: <strong>{fm(tableMeters)} m</strong></p>
          {tooMuch && <p className="text-red-500 text-xs">Maximal {fm(d.maxMeters!)} m pro Händler.</p>}
        </div>
      )}
      {price != null && effMeters > 0 && (
        <p className="text-primary text-sm">Standgebühr: <strong>{euro(price)}</strong> <span className="text-muted">({fm(effMeters)} m × {nDays} Tag{nDays > 1 ? 'e' : ''} × {euro(d.pricePerMeterDay!)})</span></p>
      )}
      {d.depositAmount > 0 && (
        <div className="rounded-xl border border-amber-400/60 bg-amber-400/10 p-3 text-sm text-primary">
          <strong>Unratütox-Gebühr: {euro(d.depositAmount)} in bar vor Ort.</strong> Bitte passend mitbringen – du bekommst sie nach der Messe zurück, wenn deine Standfläche sauber und ordentlich hinterlassen wurde.
        </div>
      )}
      <div className="flex gap-2">
        {(['gewerblich', 'privat'] as const).map(t => (
          <label key={t} className={`flex-1 text-center px-3 py-2 rounded-lg border text-sm cursor-pointer ${form.customerType === t ? 'border-accent-purple bg-accent-purple/10 text-primary font-medium' : 'border-theme bg-bg-surface text-secondary'}`}>
            <input type="radio" className="sr-only" checked={form.customerType === t} onChange={() => setForm({ ...form, customerType: t })} /> {t === 'gewerblich' ? 'Gewerblich' : 'Privat'}
          </label>
        ))}
      </div>
      <div className="grid sm:grid-cols-2 gap-3">
        {isCommercial && <div className="sm:col-span-2"><label className="text-secondary text-xs mb-1 block">Firmenname *</label><input required className={inputCls} value={form.company} onChange={e => setForm({ ...form, company: e.target.value })} /></div>}
        <div className="sm:col-span-2"><label className="text-secondary text-xs mb-1 block">Ansprechpartner *</label><input required className={inputCls} value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} /></div>
        <div><label className="text-secondary text-xs mb-1 block">E-Mail *</label><input required type="email" className={inputCls} value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} /></div>
        <div><label className="text-secondary text-xs mb-1 block">Telefon</label><input type="tel" className={inputCls} value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} /></div>
        <div className="sm:col-span-2"><label className="text-secondary text-xs mb-1 block">Straße / Hausnummer *</label><input required className={inputCls} value={form.street} onChange={e => setForm({ ...form, street: e.target.value })} /></div>
        <div><label className="text-secondary text-xs mb-1 block">PLZ *</label><input required inputMode="numeric" pattern="[0-9]{4,5}" maxLength={5} className={inputCls} value={form.zip} onChange={e => setForm({ ...form, zip: e.target.value.replace(/\D/g, '') })} /></div>
        <div><label className="text-secondary text-xs mb-1 block">Ort *</label><input required className={inputCls} value={form.city} onChange={e => setForm({ ...form, city: e.target.value })} /></div>
        <div className="sm:col-span-2">
          <label className="text-secondary text-xs mb-1 block">Welches TCG?</label>
          <select className={inputCls} value={form.tcg} onChange={e => setForm({ ...form, tcg: e.target.value })}>
            <option value="">Bitte wählen…</option>
            {['Pokémon TCG', 'Magic: The Gathering', 'Yu-Gi-Oh!', 'One Piece TCG', 'Lorcana', 'Dragon Ball Super TCG', 'Digimon TCG', 'Sonstiges'].map(t => <option key={t}>{t}</option>)}
          </select>
        </div>
      </div>
      <ImageUpload label="Logo (optional – erscheint bei den Händlern)" value={form.logoUrl} onChange={url => setForm({ ...form, logoUrl: url })} maxSize={300} quality={0.7} />
      <div><label className="text-secondary text-xs mb-1 block">Weitere Infos</label><textarea rows={2} className={inputCls + ' resize-none'} value={form.message} onChange={e => setForm({ ...form, message: e.target.value })} /></div>
      <PaymentChoice value={pm} onChange={setPm} payment={data.payment} />
      <Terms checked={terms} onChange={setTerms} dealer />
      {err && <p className="text-red-500 text-sm">{err}</p>}
      <button type="submit" disabled={busy || price == null || effMeters <= 0 || tooMuch} className="btn-primary flex items-center justify-center gap-2">
        {busy ? <Loader2 size={16} className="animate-spin" /> : <Store size={16} />}
        {price != null ? `Stand verbindlich buchen – ${euro(price)}` : 'Standpreis fehlt noch'}
      </button>
    </form>
  )
}

function TicketShop({ slug }: { slug: string }) {
  const [data, setData] = useState<ShopData | null>(null)
  const [error, setError] = useState('')
  const [sp] = useSearchParams()
  const [tab, setTab] = useState<'visitor' | 'dealer'>(sp.get('haendler') ? 'dealer' : 'visitor')

  useEffect(() => {
    const token = localStorage.getItem('shinyfam-admin-token')
    fetch(`/api/tickets/shop/${encodeURIComponent(slug)}`, { headers: token ? { Authorization: `Bearer ${token}` } : {} })
      .then(async r => { const d = await r.json(); if (!r.ok) throw new Error(d.error || 'Fehler'); return d })
      .then((d: ShopData) => { setData(d); if (!d.visitor?.enabled && d.dealer?.enabled) setTab('dealer') })
      .catch(e => setError(e.message))
  }, [slug])

  const hasVisitor = !!data?.visitor && (data.visitor.enabled || data.preview)
  const hasDealer = !!data?.dealer && (data.dealer.enabled || data.preview)
  const schedule = useMemo(() => data?.event.schedule?.map((s, i) => `${data.days[i]?.label || s.label}: ${s.start}–${s.end} Uhr`) || [], [data])

  if (error) return <div className="max-w-2xl mx-auto px-4 py-12 pt-28"><div className="card rounded-2xl p-6"><p className="text-primary font-semibold mb-2">{error}</p><Link to="/tickets" className="text-accent-purple underline text-sm">Alle Ticket-Angebote</Link></div></div>
  if (!data) return <div className="max-w-2xl mx-auto px-4 py-12 pt-28 text-muted flex items-center gap-2"><Loader2 className="animate-spin" size={16} /> Lädt…</div>

  const ev = data.event
  return (
    <div className="max-w-2xl mx-auto px-4 py-12 pt-28">
      {data.sandbox && <div className="mb-4 rounded-xl border-2 border-red-400 bg-red-500/10 p-3 text-sm text-primary"><strong>🧪 TESTMODUS</strong> – hier kann gefahrlos ausprobiert werden. Es wird kein Geld eingezogen, Bestellungen landen nicht in den echten Listen und die Tickets gelten nicht am Einlass.</div>}
      {data.preview && <div className="mb-4 rounded-xl border border-amber-400/60 bg-amber-400/10 p-3 text-sm text-primary">Admin-Vorschau: Der Verkauf ist für Besucher noch nicht freigeschaltet.</div>}
      <p className="text-accent-purple font-semibold text-sm mb-1">Online-Tickets</p>
      <h1 className="font-display text-3xl md:text-4xl font-black section-title mb-3">{ev.title}</h1>
      <div className="text-secondary text-sm flex flex-col gap-1 mb-6">
        <span className="flex items-center gap-2"><CalendarDays size={14} /> {fmtRange(ev.date, ev.endDate)}</span>
        {schedule.map(s => <span key={s} className="pl-6 text-muted">{s}</span>)}
        <span className="flex items-center gap-2"><MapPin size={14} /> {ev.location}, {ev.address}, {ev.city}</span>
      </div>
      {!data.open ? (
        <div className="card rounded-2xl p-6 text-secondary">Der Online-Verkauf ist beendet. Tickets gibt es noch an der Tageskasse.</div>
      ) : !data.payment.paypal && !data.payment.transfer ? (
        <div className="card rounded-2xl p-6 text-secondary">Der Online-Vorverkauf startet in Kürze – die Bezahlmöglichkeiten werden gerade eingerichtet. Schau bald wieder vorbei!{data.preview || localStorage.getItem('shinyfam-admin-token') ? <p className="text-amber-600 text-sm mt-2">Admin: Im Admin unter Tickets → „Bank & PayPal“ IBAN und/oder PayPal.me eintragen, dann kann bestellt werden.</p> : null}</div>
      ) : (
        <div className="card rounded-2xl p-5">
          {hasVisitor && hasDealer && (
            <div className="flex gap-2 mb-5">
              <button type="button" onClick={() => setTab('visitor')} className={`flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-sm font-semibold border ${tab === 'visitor' ? 'border-accent-purple bg-accent-purple/10 text-primary' : 'border-theme text-secondary'}`}><Ticket size={15} /> Eintritt</button>
              <button type="button" onClick={() => setTab('dealer')} className={`flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-sm font-semibold border ${tab === 'dealer' ? 'border-accent-purple bg-accent-purple/10 text-primary' : 'border-theme text-secondary'}`}><Store size={15} /> Händlerstand</button>
            </div>
          )}
          {tab === 'visitor' && hasVisitor && <VisitorForm data={data} />}
          {(tab === 'dealer' || !hasVisitor) && hasDealer && (
            ev.soldOut || (data.dealer!.remaining === 0)
              ? <p className="text-secondary">Alle Händlerstände sind vergeben.</p>
              : <DealerForm data={data} />
          )}
          {!hasVisitor && !hasDealer && <p className="text-secondary">Für dieses Event gibt es (noch) keinen Online-Verkauf.</p>}
        </div>
      )}
      <p className="text-muted text-xs mt-6">Fragen? Schreib uns an <a href="mailto:info@shinyfam.de" className="text-accent-purple underline">info@shinyfam.de</a>.</p>
    </div>
  )
}

export default function Tickets() {
  const { slug } = useParams()
  return slug ? <TicketShop slug={slug} /> : <TicketList />
}
