import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft, CheckCircle, Package, CreditCard } from 'lucide-react'
import { Link } from 'react-router-dom'
import { useCart } from '../contexts/CartContext'

type PaymentMethod = 'invoice' | 'prepayment' | 'cash_on_pickup'

interface FormData {
  firstName: string
  lastName: string
  email: string
  phone: string
  street: string
  zip: string
  city: string
  paymentMethod: PaymentMethod
  notes: string
}

const paymentOptions: { value: PaymentMethod; label: string; desc: string }[] = [
  { value: 'invoice', label: 'Rechnung', desc: 'Zahlung nach Erhalt (Privatpersonen auf Anfrage)' },
  { value: 'prepayment', label: 'Vorkasse', desc: 'Banküberweisung vor Versand' },
  { value: 'cash_on_pickup', label: 'Abholung', desc: 'Bar bei Abholung / auf Events' },
]

export default function Checkout() {
  const { items, total, clearCart } = useCart()
  const navigate = useNavigate()
  const subtotal = items.reduce((sum, i) => sum + i.price * i.quantity, 0)
  const shipping = subtotal >= 50 && subtotal > 0 ? 0 : subtotal === 0 ? 0 : 4.99

  const [form, setForm] = useState<FormData>({
    firstName: '', lastName: '', email: '', phone: '',
    street: '', zip: '', city: '',
    paymentMethod: 'prepayment', notes: '',
  })
  const [loading, setLoading] = useState(false)
  const [errors, setErrors] = useState<Partial<FormData>>({})

  function validate() {
    const e: Partial<FormData> = {}
    if (!form.firstName) e.firstName = 'Pflichtfeld'
    if (!form.lastName) e.lastName = 'Pflichtfeld'
    if (!form.email || !/\S+@\S+\.\S+/.test(form.email)) e.email = 'Gültige E-Mail erforderlich'
    if (!form.street) e.street = 'Pflichtfeld'
    if (!form.zip || !/^\d{5}$/.test(form.zip)) e.zip = '5-stellige PLZ'
    if (!form.city) e.city = 'Pflichtfeld'
    setErrors(e)
    return Object.keys(e).length === 0
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!validate() || items.length === 0) return
    setLoading(true)
    try {
      const res = await fetch('/api/shop/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...form, items, subtotal, shipping, total }),
      })
      const data = await res.json()
      if (res.ok) {
        clearCart()
        navigate(`/checkout/success?order=${data.orderNumber}`)
      }
    } catch (_) {
      // show error
    } finally {
      setLoading(false)
    }
  }

  if (items.length === 0) {
    return (
      <div className="max-w-xl mx-auto px-4 py-8 pt-24 text-center">
        <Package size={48} className="text-gray-700 mx-auto mb-4" />
        <h1 className="font-display text-2xl font-bold text-white mb-2">Warenkorb ist leer</h1>
        <Link to="/shop" className="btn-primary mt-4 inline-block">Zum Shop</Link>
      </div>
    )
  }

  const field = (name: keyof FormData, label: string, type = 'text', placeholder = '') => (
    <div>
      <label className="text-gray-400 text-xs mb-1 block">{label} {['firstName','lastName','email','street','zip','city'].includes(name) ? '*' : ''}</label>
      <input
        type={type}
        value={form[name] as string}
        onChange={(e) => setForm({ ...form, [name]: e.target.value })}
        placeholder={placeholder}
        className={`w-full bg-bg-raised border rounded-lg px-3 py-2 text-white text-sm outline-none transition-colors
          ${errors[name] ? 'border-red-500' : 'border-white/10 focus:border-accent-purple'}`}
      />
      {errors[name] && <p className="text-red-400 text-xs mt-0.5">{errors[name]}</p>}
    </div>
  )

  return (
    <div className="max-w-5xl mx-auto px-4 py-8 pt-24">
      <Link to="/shop" className="flex items-center gap-2 text-gray-400 hover:text-white text-sm mb-6 transition-colors">
        <ArrowLeft size={14} /> Zurück zum Shop
      </Link>

      <h1 className="font-display text-3xl font-black text-white mb-8 flex items-center gap-2">
        <CreditCard size={28} className="text-accent-purple" />
        Kasse
      </h1>

      <form onSubmit={handleSubmit}>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left: Form */}
          <div className="lg:col-span-2 flex flex-col gap-6">
            {/* Address */}
            <div className="bg-bg-surface border border-white/5 rounded-2xl p-6">
              <h2 className="text-white font-semibold mb-4">Lieferadresse</h2>
              <div className="grid grid-cols-2 gap-3">
                {field('firstName', 'Vorname', 'text', 'Max')}
                {field('lastName', 'Nachname', 'text', 'Mustermann')}
                <div className="col-span-2">{field('email', 'E-Mail', 'email', 'max@beispiel.de')}</div>
                <div className="col-span-2">{field('phone', 'Telefon', 'tel', '+49 151 ...')}</div>
                <div className="col-span-2">{field('street', 'Straße & Hausnummer', 'text', 'Musterstraße 1')}</div>
                {field('zip', 'PLZ', 'text', '12345')}
                {field('city', 'Stadt', 'text', 'Musterstadt')}
              </div>
            </div>

            {/* Payment */}
            <div className="bg-bg-surface border border-white/5 rounded-2xl p-6">
              <h2 className="text-white font-semibold mb-4">Zahlungsart</h2>
              <div className="flex flex-col gap-3">
                {paymentOptions.map((opt) => (
                  <label
                    key={opt.value}
                    className={`flex items-start gap-3 p-3 rounded-xl border cursor-pointer transition-colors
                      ${form.paymentMethod === opt.value ? 'border-accent-purple bg-accent-purple/10' : 'border-white/5 hover:border-white/20'}`}
                  >
                    <input
                      type="radio"
                      name="payment"
                      value={opt.value}
                      checked={form.paymentMethod === opt.value}
                      onChange={() => setForm({ ...form, paymentMethod: opt.value })}
                      className="mt-0.5 accent-purple-500"
                    />
                    <div>
                      <p className="text-white text-sm font-medium">{opt.label}</p>
                      <p className="text-gray-500 text-xs">{opt.desc}</p>
                    </div>
                  </label>
                ))}
              </div>
            </div>

            {/* Notes */}
            <div className="bg-bg-surface border border-white/5 rounded-2xl p-6">
              <h2 className="text-white font-semibold mb-3">Anmerkungen</h2>
              <textarea
                rows={3}
                value={form.notes}
                onChange={(e) => setForm({ ...form, notes: e.target.value })}
                placeholder="Besondere Wünsche, Lieferhinweise..."
                className="w-full bg-bg-raised border border-white/10 rounded-lg px-3 py-2 text-white text-sm focus:border-accent-purple outline-none resize-none transition-colors"
              />
            </div>
          </div>

          {/* Right: Order Summary */}
          <div>
            <div className="bg-bg-surface border border-white/5 rounded-2xl p-6 sticky top-24">
              <h2 className="text-white font-semibold mb-4">Bestellung</h2>
              <div className="flex flex-col gap-3 mb-4">
                {items.map((item) => (
                  <div key={item.id} className="flex justify-between text-sm">
                    <span className="text-gray-400 truncate mr-2">{item.name} × {item.quantity}</span>
                    <span className="text-white shrink-0">€{(item.price * item.quantity).toFixed(2)}</span>
                  </div>
                ))}
              </div>
              <div className="section-divider mb-3" />
              <div className="flex justify-between text-sm text-gray-400 mb-1">
                <span>Zwischensumme</span><span>€{subtotal.toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-sm text-gray-400 mb-3">
                <span>Versand</span>
                <span>{shipping === 0 ? <span className="text-green-400">Kostenlos</span> : `€${shipping.toFixed(2)}`}</span>
              </div>
              <div className="flex justify-between font-bold text-white mb-6">
                <span>Gesamt</span>
                <span className="gradient-text text-lg">€{(subtotal + shipping).toFixed(2)}</span>
              </div>
              <button
                type="submit"
                disabled={loading}
                className="btn-primary w-full text-center flex items-center justify-center gap-2"
              >
                {loading ? 'Wird verarbeitet...' : 'Bestellung aufgeben'}
                {!loading && <CheckCircle size={16} />}
              </button>
              <p className="text-gray-600 text-xs text-center mt-3">
                Mit der Bestellung akzeptierst du unsere AGB.
              </p>
            </div>
          </div>
        </div>
      </form>
    </div>
  )
}
