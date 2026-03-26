import { CheckCircle, Home, ShoppingBag } from 'lucide-react'
import { Link, useSearchParams } from 'react-router-dom'

export default function CheckoutSuccess() {
  const [params] = useSearchParams()
  const orderNumber = params.get('order')

  return (
    <div className="max-w-lg mx-auto px-4 py-8 pt-24 text-center">
      <div className="bg-bg-surface border border-green-500/20 rounded-2xl p-10">
        <CheckCircle size={60} className="text-green-400 mx-auto mb-4" />
        <h1 className="font-display text-3xl font-black text-white mb-2">Vielen Dank!</h1>
        <p className="text-gray-400 mb-4">Deine Bestellung ist eingegangen.</p>
        {orderNumber && (
          <div className="bg-bg-raised rounded-xl px-4 py-3 mb-6">
            <p className="text-gray-500 text-xs mb-1">Bestellnummer</p>
            <p className="text-white font-mono font-bold text-lg">{orderNumber}</p>
          </div>
        )}
        <p className="text-gray-500 text-sm mb-8">
          Du erhältst in Kürze eine Bestätigung per E-Mail mit allen Details zu deiner Bestellung.
        </p>
        <div className="flex gap-3 justify-center">
          <Link to="/" className="btn-outline flex items-center gap-2 text-sm">
            <Home size={14} /> Startseite
          </Link>
          <Link to="/shop" className="btn-primary flex items-center gap-2 text-sm">
            <ShoppingBag size={14} /> Weiter shoppen
          </Link>
        </div>
      </div>
    </div>
  )
}
