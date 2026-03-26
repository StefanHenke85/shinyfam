import { X, Plus, Minus, Trash2, ShoppingBag, ArrowRight } from 'lucide-react'
import { Link } from 'react-router-dom'
import { useCart, FREE_SHIPPING_THRESHOLD } from '../contexts/CartContext'
import { useTheme } from '../contexts/ThemeContext'

export default function CartSidebar() {
  const { items, total, isOpen, removeItem, updateQuantity, setIsOpen } = useCart()
  const { t } = useTheme()
  const subtotal = items.reduce((sum, i) => sum + i.price * i.quantity, 0)
  const shipping = subtotal >= FREE_SHIPPING_THRESHOLD && subtotal > 0 ? 0 : subtotal === 0 ? 0 : 4.99
  const shippingProgress = Math.min((subtotal / FREE_SHIPPING_THRESHOLD) * 100, 100)

  if (!isOpen) return null

  return (
    <>
      <div className="cart-backdrop fixed inset-0 z-40" onClick={() => setIsOpen(false)} aria-hidden="true" />
      <div role="dialog" aria-modal="true" aria-label={t('cart.title')} className="cart-sidebar fixed right-0 top-0 h-full w-full max-w-sm z-50 flex flex-col shadow-2xl">

        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-theme">
          <h2 className="font-display font-bold section-title flex items-center gap-2">
            <ShoppingBag size={18} className="text-accent-purple" aria-hidden="true" />
            {t('cart.title')}
            {items.length > 0 && (
              <span className="cart-badge-static" aria-label={`${items.reduce((s, i) => s + i.quantity, 0)} ${t('cart.items')}`}>
                {items.reduce((s, i) => s + i.quantity, 0)}
              </span>
            )}
          </h2>
          <button type="button" onClick={() => setIsOpen(false)} className="icon-btn" aria-label={t('cart.close')}>
            <X size={18} aria-hidden="true" />
          </button>
        </div>

        {/* Shipping progress */}
        {subtotal > 0 && subtotal < FREE_SHIPPING_THRESHOLD && (
          <div className="shipping-bar-note px-4 py-2 border-b border-theme">
            <p className="text-xs text-secondary mb-1">
              Noch <strong className="text-accent-gold">€{(FREE_SHIPPING_THRESHOLD - subtotal).toFixed(2)}</strong> {t('cart.shippingLeft')}
            </p>
            <div className="h-1 rounded-full shipping-bar-track">
              <div className="h-full rounded-full bg-gradient-brand transition-all" style={{ width: `${shippingProgress}%` }} aria-hidden="true" />
            </div>
          </div>
        )}
        {subtotal >= FREE_SHIPPING_THRESHOLD && subtotal > 0 && (
          <div className="shipping-free-banner px-4 py-2 border-b text-xs font-medium">
            {t('cart.freeShipping')}
          </div>
        )}

        {/* Items */}
        <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-3">
          {items.length === 0 ? (
            <div className="flex-1 flex flex-col items-center justify-center text-center py-16">
              <ShoppingBag size={40} className="text-muted mb-3" aria-hidden="true" />
              <p className="text-secondary">{t('cart.empty')}</p>
              <button type="button" onClick={() => setIsOpen(false)} className="btn-outline text-sm mt-4">
                {t('cart.continueShopping')}
              </button>
            </div>
          ) : (
            <ul className="flex flex-col gap-3 list-none p-0 m-0">
              {items.map((item) => (
                <li key={item.id} className="cart-item">
                  {item.imageUrl ? (
                    <img src={item.imageUrl} alt={item.name} className="w-14 h-14 object-cover rounded-lg shrink-0" />
                  ) : (
                    <div className="cart-item-placeholder w-14 h-14 rounded-lg shrink-0 flex items-center justify-center">
                      <ShoppingBag size={18} className="text-muted" aria-hidden="true" />
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium section-title truncate">{item.name}</p>
                    <p className="text-sm font-bold gradient-text">€{item.price.toFixed(2)}</p>
                    <div className="flex items-center gap-2 mt-1">
                      <button type="button" onClick={() => updateQuantity(item.id, item.quantity - 1)} className="qty-btn" aria-label={`${t('cart.less')} ${item.name}`}>
                        <Minus size={10} aria-hidden="true" />
                      </button>
                      <span className="text-sm w-4 text-center section-title" aria-label={`${t('cart.quantity')}: ${item.quantity}`}>{item.quantity}</span>
                      <button type="button" onClick={() => updateQuantity(item.id, item.quantity + 1)} disabled={item.quantity >= item.stock} className="qty-btn" aria-label={`${t('cart.more')} ${item.name}`}>
                        <Plus size={10} aria-hidden="true" />
                      </button>
                      <button type="button" onClick={() => removeItem(item.id)} className="icon-btn w-7 h-7 ml-auto text-muted" aria-label={`${item.name} ${t('cart.remove')}`}>
                        <Trash2 size={13} aria-hidden="true" />
                      </button>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Footer */}
        {items.length > 0 && (
          <div className="p-4 border-t border-theme">
            <dl className="mb-4">
              <div className="flex justify-between text-sm text-secondary mb-1">
                <dt>{t('cart.subtotal')}</dt><dd>€{subtotal.toFixed(2)}</dd>
              </div>
              <div className="flex justify-between text-sm text-secondary mb-3">
                <dt>{t('cart.shipping')}</dt>
                <dd className={shipping === 0 ? 'shipping-free-text' : ''}>
                  {shipping === 0 ? t('cart.free') : `€${shipping.toFixed(2)}`}
                </dd>
              </div>
              <div className="flex justify-between font-bold section-title">
                <dt>{t('cart.total')}</dt>
                <dd className="gradient-text text-lg">€{total.toFixed(2)}</dd>
              </div>
            </dl>
            <Link to="/checkout" onClick={() => setIsOpen(false)} className="btn-primary w-full justify-center">
              {t('cart.checkout')} <ArrowRight size={15} aria-hidden="true" />
            </Link>
          </div>
        )}
      </div>
    </>
  )
}
