import { useState } from 'react'
import { Send, X } from 'lucide-react'
import ImageUpload from './ImageUpload'
import type { PriceTier } from '../types'

interface Props {
  eventName: string
  eventDate: string
  eventEndDate?: string | null
  priceTiers?: PriceTier[] | null
  onClose: () => void
}

const emptyForm = { customerType: 'gewerblich', name: '', email: '', company: '', phone: '', street: '', zipCity: '', tcg: '', meters: '', location: '', message: '', logoUrl: '', attendanceDays: 'beide', priceTier: '' }

export default function EventInquiryForm({ eventName, eventDate, eventEndDate, priceTiers, onClose }: Props) {
  const isMultiDay = !!eventEndDate && new Date(eventEndDate).toDateString() !== new Date(eventDate).toDateString()
  const hasPriceTiers = !!priceTiers && priceTiers.length > 0
  const [form, setForm] = useState({ ...emptyForm, priceTier: hasPriceTiers ? priceTiers![0].label : '' })
  const [sent, setSent] = useState(false)
  const [sending, setSending] = useState(false)
  const isCommercial = form.customerType === 'gewerblich'

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSending(true)
    await fetch('/api/event-inquiry', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...form,
        company: isCommercial ? form.company : '',
        logoUrl: isCommercial ? form.logoUrl : '',
        eventName,
        date: eventDate,
        attendanceDays: isMultiDay ? form.attendanceDays : null,
        priceTier: hasPriceTiers ? form.priceTier : null,
      }),
    }).catch(() => {})
    setSent(true)
    setSending(false)
  }

  if (sent) return (
    <div className="mt-4 rounded-xl border border-accent-purple/30 bg-accent-purple/5 p-5 text-center">
      <p className="text-lg mb-1">✓</p>
      <p className="font-semibold text-primary text-sm mb-1">Anfrage gesendet!</p>
      <p className="text-secondary text-xs">Wir melden uns so schnell wie möglich bei dir.</p>
    </div>
  )

  return (
    <div className="mt-4 rounded-xl border border-accent-purple/30 bg-accent-purple/5 p-4">
      <div className="flex items-center justify-between mb-3">
        <p className="font-semibold text-primary text-sm">Als Händler anfragen</p>
        <button type="button" onClick={onClose} aria-label="Formular schließen" className="icon-btn text-muted hover:text-primary w-6 h-6">
          <X size={14} aria-hidden="true" />
        </button>
      </div>
      <form onSubmit={handleSubmit} className="flex flex-col gap-3">
        <div className="grid grid-cols-1 gap-3">
          <div>
            <span className="text-secondary text-xs mb-1 block">Ich frage an als *</span>
            <div className="flex gap-2">
              {(['gewerblich', 'privat'] as const).map(type => (
                <label key={type}
                  className={`flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded-lg border text-sm cursor-pointer transition-colors ${form.customerType === type ? 'border-accent-purple bg-accent-purple/10 text-primary font-medium' : 'border-theme bg-bg-surface text-secondary'}`}>
                  <input type="radio" name="customerType" value={type} checked={form.customerType === type}
                    onChange={e => setForm({ ...form, customerType: e.target.value })} className="sr-only" />
                  {type === 'gewerblich' ? 'Gewerblich' : 'Privat'}
                </label>
              ))}
            </div>
          </div>
          {isCommercial && (
            <div>
              <label className="text-secondary text-xs mb-1 block">Firmenname *</label>
              <input required placeholder="Mustermann Cards" value={form.company}
                onChange={e => setForm({ ...form, company: e.target.value })}
                className="w-full bg-bg-surface border border-theme rounded-lg px-3 py-2 text-primary text-sm focus:border-accent-purple outline-none transition-colors" />
            </div>
          )}
          <div>
            <label className="text-secondary text-xs mb-1 block">Dein Name *</label>
            <input required placeholder="Max Mustermann" value={form.name}
              onChange={e => setForm({ ...form, name: e.target.value })}
              className="w-full bg-bg-surface border border-theme rounded-lg px-3 py-2 text-primary text-sm focus:border-accent-purple outline-none transition-colors" />
          </div>
          <div>
            <label className="text-secondary text-xs mb-1 block">E-Mail *</label>
            <input required type="email" placeholder="max@beispiel.de" value={form.email}
              onChange={e => setForm({ ...form, email: e.target.value })}
              className="w-full bg-bg-surface border border-theme rounded-lg px-3 py-2 text-primary text-sm focus:border-accent-purple outline-none transition-colors" />
          </div>
          <div>
            <label className="text-secondary text-xs mb-1 block">Telefon</label>
            <input type="tel" placeholder="0123 4567890" value={form.phone}
              onChange={e => setForm({ ...form, phone: e.target.value })}
              className="w-full bg-bg-surface border border-theme rounded-lg px-3 py-2 text-primary text-sm focus:border-accent-purple outline-none transition-colors" />
          </div>
          <div>
            <label className="text-secondary text-xs mb-1 block">Straße / Hausnummer *</label>
            <input required placeholder="Musterstraße 1" value={form.street}
              onChange={e => setForm({ ...form, street: e.target.value })}
              className="w-full bg-bg-surface border border-theme rounded-lg px-3 py-2 text-primary text-sm focus:border-accent-purple outline-none transition-colors" />
          </div>
          <div>
            <label className="text-secondary text-xs mb-1 block">PLZ / Ort *</label>
            <input required placeholder="12345 Musterstadt" value={form.zipCity}
              onChange={e => setForm({ ...form, zipCity: e.target.value })}
              className="w-full bg-bg-surface border border-theme rounded-lg px-3 py-2 text-primary text-sm focus:border-accent-purple outline-none transition-colors" />
          </div>
          <div>
            <label htmlFor="inquiry-tcg" className="text-secondary text-xs mb-1 block">Welches TCG? *</label>
            <select id="inquiry-tcg" required value={form.tcg} onChange={e => setForm({ ...form, tcg: e.target.value })}
              className="w-full bg-bg-surface border border-theme rounded-lg px-3 py-2 text-primary text-sm focus:border-accent-purple outline-none transition-colors">
              <option value="">Bitte wählen…</option>
              <option>Pokémon TCG</option>
              <option>Magic: The Gathering</option>
              <option>Yu-Gi-Oh!</option>
              <option>One Piece TCG</option>
              <option>Lorcana</option>
              <option>Dragon Ball Super TCG</option>
              <option>Digimon TCG</option>
              <option>Sonstiges</option>
            </select>
          </div>
          <div>
            <label className="text-secondary text-xs mb-1 block">Benötigte Standfläche</label>
            <input placeholder="z.B. 2m × 1m oder Tisch" value={form.meters}
              onChange={e => setForm({ ...form, meters: e.target.value })}
              className="w-full bg-bg-surface border border-theme rounded-lg px-3 py-2 text-primary text-sm focus:border-accent-purple outline-none transition-colors" />
          </div>
          {hasPriceTiers && (
            <div>
              <label htmlFor="inquiry-price-tier" className="text-secondary text-xs mb-1 block">Standort-Kategorie *</label>
              <select id="inquiry-price-tier" required value={form.priceTier} onChange={e => setForm({ ...form, priceTier: e.target.value })}
                className="w-full bg-bg-surface border border-theme rounded-lg px-3 py-2 text-primary text-sm focus:border-accent-purple outline-none transition-colors">
                {priceTiers!.map(t => (
                  <option key={t.label} value={t.label}>{t.label} ({t.pricePerMeterDay.toFixed(2)} € / Meter / Tag)</option>
                ))}
              </select>
            </div>
          )}
          {isMultiDay && (
            <div>
              <label htmlFor="inquiry-days" className="text-secondary text-xs mb-1 block">Teilnahme an</label>
              <select id="inquiry-days" value={form.attendanceDays} onChange={e => setForm({ ...form, attendanceDays: e.target.value })}
                className="w-full bg-bg-surface border border-theme rounded-lg px-3 py-2 text-primary text-sm focus:border-accent-purple outline-none transition-colors">
                <option value="beide">Beide Tage (komplettes Event)</option>
                <option value="tag1">Nur Tag 1</option>
                <option value="tag2">Nur Tag 2</option>
              </select>
            </div>
          )}
          {isCommercial && (
            <ImageUpload
              label="Euer Logo (optional – wird direkt im Händlerbereich hinterlegt)"
              value={form.logoUrl}
              onChange={url => setForm({ ...form, logoUrl: url })}
              maxSize={300}
              quality={0.7}
            />
          )}
          <div>
            <label className="text-secondary text-xs mb-1 block">Weitere Infos</label>
            <textarea rows={2} value={form.message} onChange={e => setForm({ ...form, message: e.target.value })}
              placeholder="Kurze Beschreibung deines Standes…"
              className="w-full bg-bg-surface border border-theme rounded-lg px-3 py-2 text-primary text-sm focus:border-accent-purple outline-none transition-colors resize-none" />
          </div>
        </div>
        <button type="submit" disabled={sending} className="btn-primary text-sm flex items-center justify-center gap-2">
          <Send size={13} />
          {sending ? 'Wird gesendet…' : 'Anfrage senden'}
        </button>
      </form>
    </div>
  )
}
