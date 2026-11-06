import { useEffect, useMemo, useState } from 'react'
import { AlertTriangle, CheckCircle2, RefreshCw, Save, Send, XCircle } from 'lucide-react'

// Zahlungserinnerung / Mahnung an ausgewählte Händler (06.11.2026).
// Empfänger kommen aus den Händleranfragen inkl. letzter Rechnung, jede Mail
// geht einzeln über Brevo raus (Backend: /api/mail/dunning/*).

interface Recipient {
  id: number
  name: string
  company: string | null
  email: string
  event_name: string
  event_date: string | null
  status: string | null
  archived: boolean
  invoice_number: string | null
  invoice_date: string | null
  invoice_total: number | null
  invoice_status: string | null
}

interface SendResult { id: number; name?: string; email?: string; ok: boolean; error?: string }

const DEFAULT_SUBJECT = 'LETZTE ZAHLUNGSAUFFORDERUNG – Buchung der GRAV ISLAND CARDSCON 2026'
const DEFAULT_BODY = `Hallo zusammen,
hiermit möchten wir euch an die noch offene Rechnung für eure Teilnahme an der GRAV ISLAND CARDSCON 2026 erinnern.
Die Rechnung wurde am 24.09.2026 ausgestellt. Das vereinbarte Zahlungsziel von 14 Tagen ist inzwischen abgelaufen, ein Zahlungseingang ist bei uns bislang jedoch noch nicht erfolgt.
Da die Veranstaltung bereits in wenigen Wochen stattfindet und wir nun in die konkrete Planung gehen, möchten wir euch letztmalig eine Nachfrist zur Begleichung der offenen Rechnung bis zum 26.10.2026 einräumen.
Bitte überweist den offenen Rechnungsbetrag spätestens bis zum 26.10.2026.
Sollte bis zu diesem Datum kein Zahlungseingang erfolgen und auch keine Rückmeldung von euch eingehen, sehen wir uns gezwungen, eure Reservierung für die GRAV ISLAND CARDSCON 2026 zu stornieren. Die dadurch frei werdenden Verkaufsflächen werden wir anschließend anderweitig vergeben.
Falls ihr die Rechnung bereits überwiesen habt, bitten wir euch, diese Nachricht zu ignorieren. Sollte es Fragen zur Rechnung oder zur Zahlung geben, meldet euch bitte kurzfristig bei uns.
Vielen Dank für eure Rückmeldung und euer Verständnis.
Liebe Grüße
Heike & Dennis`

const PLACEHOLDERS: [string, string][] = [
  ['{{name}}', 'Name'], ['{{firma}}', 'Firma (sonst Name)'], ['{{event}}', 'Event'], ['{{datum}}', 'Event-Datum'],
  ['{{rechnung}}', 'Rechnungsnr.'], ['{{rechnungsdatum}}', 'Rechnungsdatum'], ['{{betrag}}', 'Betrag'],
]

const fmtDate = (d: string | null) => (d ? new Date(d).toLocaleDateString('de-DE') : '')
const fmtMoney = (n: number | null) => (n != null ? n.toLocaleString('de-DE', { minimumFractionDigits: 2 }) + ' €' : '')

export default function AdminDunning({ token }: { token: string }) {
  const auth = { Authorization: `Bearer ${token}` }
  const [recipients, setRecipients] = useState<Recipient[]>([])
  const [loading, setLoading] = useState(false)
  const [eventFilter, setEventFilter] = useState('')
  const [onlyOpen, setOnlyOpen] = useState(false)
  const [nameSearch, setNameSearch] = useState('')
  const [showArchived, setShowArchived] = useState(false)
  const [selected, setSelected] = useState<Set<number>>(new Set())
  const [subject, setSubject] = useState(DEFAULT_SUBJECT)
  const [body, setBody] = useState(DEFAULT_BODY)
  const [copyToSelf, setCopyToSelf] = useState(true)
  const [msg, setMsg] = useState('')
  const [sending, setSending] = useState(false)
  const [results, setResults] = useState<SendResult[] | null>(null)

  async function loadRecipients() {
    setLoading(true)
    try {
      const r = await fetch('/api/mail/dunning/recipients', { headers: auth })
      const data = await r.json()
      if (Array.isArray(data)) {
        setRecipients(data)
        if (!eventFilter && data.some((x: Recipient) => /grav/i.test(x.event_name))) setEventFilter('grav')
      }
    } finally {
      setLoading(false)
    }
  }

  async function loadTemplate() {
    try {
      const r = await fetch('/api/mail/dunning/template', { headers: auth })
      const t = await r.json()
      if (t?.subject) setSubject(t.subject)
      if (t?.body) setBody(t.body)
    } catch { /* Standardtext bleibt */ }
  }

  useEffect(() => { loadRecipients(); loadTemplate() }, [])

  const events = useMemo(() => [...new Set(recipients.map(r => r.event_name))].sort(), [recipients])
  const ev = eventFilter.trim().toLowerCase()
  const ns = nameSearch.trim().toLowerCase()
  const visible = recipients.filter(r =>
    (!ev || r.event_name.toLowerCase().includes(ev)) &&
    (!ns || `${r.company || ''} ${r.name} ${r.email}`.toLowerCase().includes(ns)) &&
    (showArchived || !r.archived) &&
    (!onlyOpen || (r.invoice_number && r.invoice_status !== 'paid')))

  function toggle(id: number) {
    setSelected(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n })
  }
  const allVisibleSelected = visible.length > 0 && visible.every(r => selected.has(r.id))
  function toggleAll() {
    setSelected(prev => {
      const n = new Set(prev)
      if (allVisibleSelected) visible.forEach(r => n.delete(r.id)); else visible.forEach(r => n.add(r.id))
      return n
    })
  }

  async function saveTemplate() {
    setMsg('Speichere Vorlage …')
    const r = await fetch('/api/mail/dunning/template', { method: 'PUT', headers: { ...auth, 'Content-Type': 'application/json' }, body: JSON.stringify({ subject, body }) })
    setMsg(r.ok ? 'Vorlage gespeichert – wird beim nächsten Öffnen wieder geladen.' : 'Fehler beim Speichern der Vorlage.')
  }

  async function send() {
    const ids = [...selected]
    if (!ids.length) { setMsg('Bitte mindestens einen Händler auswählen.'); return }
    if (!subject.trim() || !body.trim()) { setMsg('Betreff und Text dürfen nicht leer sein.'); return }
    const names = recipients.filter(r => selected.has(r.id)).map(r => r.company || r.name)
    if (!confirm(`Mahnung jetzt an ${ids.length} Händler senden?\n\n${names.join('\n')}`)) return
    setSending(true); setMsg(''); setResults(null)
    try {
      const r = await fetch('/api/mail/dunning/send', {
        method: 'POST', headers: { ...auth, 'Content-Type': 'application/json' },
        body: JSON.stringify({ inquiry_ids: ids, subject, body, copyToSelf }),
      })
      const data = await r.json()
      if (!r.ok) { setMsg('Fehler: ' + (data.error || r.status)); return }
      setResults(data.results)
      setMsg(`${data.sent} verschickt${data.failed ? `, ${data.failed} fehlgeschlagen` : ''}.`)
      if (!data.failed) setSelected(new Set())
    } catch (e) {
      setMsg('Fehler: ' + String(e))
    } finally {
      setSending(false)
    }
  }

  const badge = (r: Recipient) => {
    if (!r.invoice_number) return <span className="text-xs px-2 py-0.5 rounded-full bg-bg-raised text-muted border border-theme">keine Rechnung</span>
    if (r.invoice_status === 'paid') return <span className="text-xs px-2 py-0.5 rounded-full bg-green-500/15 text-green-500">bezahlt</span>
    return <span className="text-xs px-2 py-0.5 rounded-full bg-red-500/15 text-red-500">offen</span>
  }

  return (
    <div className="grid lg:grid-cols-2 gap-6">
      {/* Empfaenger */}
      <div className="space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <input list="dunningEvents" value={eventFilter} onChange={e => setEventFilter(e.target.value)} placeholder="Event filtern (leer = alle)" className="admin-input flex-1 min-w-[160px]" />
          <datalist id="dunningEvents">{events.map(ev => <option key={ev} value={ev} />)}</datalist>
          <input value={nameSearch} onChange={e => setNameSearch(e.target.value)} placeholder="Händler suchen …" className="admin-input flex-1 min-w-[140px]" />
          <button type="button" onClick={loadRecipients} disabled={loading} title="Aktualisieren"
            className="p-2 rounded-lg bg-bg-raised border border-theme hover:bg-bg-hover transition-colors">
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
          </button>
        </div>
        <div className="flex flex-wrap gap-4 text-sm">
          <label className="flex items-center gap-2"><input type="checkbox" checked={onlyOpen} onChange={e => setOnlyOpen(e.target.checked)} /> nur mit offener Rechnung im ShinyFam-Rechnungsmodul</label>
          <label className="flex items-center gap-2"><input type="checkbox" checked={showArchived} onChange={e => setShowArchived(e.target.checked)} /> archivierte zeigen</label>
        </div>

        <div className="rounded-xl border border-theme overflow-hidden">
          <label className="flex items-center gap-3 px-3 py-2 bg-bg-raised border-b border-theme text-sm font-medium cursor-pointer">
            <input type="checkbox" checked={allVisibleSelected} onChange={toggleAll} />
            Alle angezeigten auswählen ({visible.length}) · ausgewählt: {selected.size}
          </label>
          <div className="max-h-[480px] overflow-y-auto divide-y divide-[var(--border)]">
            {visible.length === 0 && (
              <p className="p-4 text-sm text-muted">{loading ? 'Lade Händler …' : 'Keine Händler für diesen Filter.'}</p>
            )}
            {visible.map(r => (
              <label key={r.id} className={`flex items-start gap-3 px-3 py-2.5 cursor-pointer hover:bg-bg-hover ${selected.has(r.id) ? 'bg-primary/5' : ''}`}>
                <input type="checkbox" className="mt-1" checked={selected.has(r.id)} onChange={() => toggle(r.id)} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-medium">{r.company || r.name}</span>
                    {badge(r)}
                  </div>
                  <div className="text-xs text-muted break-all">{r.company ? `${r.name} · ` : ''}{r.email}</div>
                  {r.invoice_number && (
                    <div className="text-xs text-muted">Rechnung {r.invoice_number} vom {fmtDate(r.invoice_date)} · {fmtMoney(r.invoice_total)}</div>
                  )}
                  <div className="text-xs text-muted">{r.event_name}{r.event_date ? ` · ${fmtDate(r.event_date)}` : ''}</div>
                </div>
              </label>
            ))}
          </div>
        </div>
      </div>

      {/* Text */}
      <div className="space-y-3">
        <div>
          <label className="block text-sm font-medium mb-1">Betreff</label>
          <input type="text" value={subject} onChange={e => setSubject(e.target.value)} className="admin-input w-full" />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Text</label>
          <textarea value={body} onChange={e => setBody(e.target.value)} rows={16} className="admin-input w-full text-sm" />
          <p className="text-xs text-muted mt-1">
            Platzhalter (werden pro Händler ersetzt):{' '}
            {PLACEHOLDERS.map(([p, l]) => (
              <button key={p} type="button" title={l} onClick={() => setBody(b => b + p)}
                className="inline-block font-mono mr-1 mb-1 px-1.5 py-0.5 rounded bg-bg-raised border border-theme hover:border-primary">{p}</button>
            ))}
          </p>
        </div>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={copyToSelf} onChange={e => setCopyToSelf(e.target.checked)} />
          Kopie mit Empfängerliste an info@shinyfam.de
        </label>
        <div className="flex flex-wrap items-center gap-2">
          <button type="button" onClick={send} disabled={sending || !selected.size}
            className="flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors disabled:opacity-50">
            <Send size={14} /> {sending ? 'Sende …' : `An ${selected.size} Händler senden`}
          </button>
          <button type="button" onClick={saveTemplate}
            className="flex items-center gap-2 px-3 py-2 rounded-lg bg-bg-raised border border-theme hover:bg-bg-hover text-sm">
            <Save size={14} /> Text als Vorlage speichern
          </button>
          <button type="button" onClick={() => { if (confirm('Betreff und Text auf den Standardtext zurücksetzen?')) { setSubject(DEFAULT_SUBJECT); setBody(DEFAULT_BODY) } }}
            className="px-3 py-2 rounded-lg text-sm text-muted hover:text-primary">Standardtext</button>
        </div>
        {msg && <p className="text-sm flex items-center gap-2"><AlertTriangle size={14} className="text-amber-500" />{msg}</p>}
        {results && (
          <ul className="text-sm space-y-1 rounded-xl border border-theme p-3">
            {results.map(r => (
              <li key={r.id} className="flex items-start gap-2">
                {r.ok ? <CheckCircle2 size={14} className="text-green-500 mt-0.5" /> : <XCircle size={14} className="text-red-500 mt-0.5" />}
                <span>{r.name} <span className="text-muted">{r.email}</span>{!r.ok && <span className="text-red-500"> – {r.error}</span>}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}
