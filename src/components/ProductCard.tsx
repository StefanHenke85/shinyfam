import { ShoppingCart, Package } from 'lucide-react'
import type { Product } from '../types'
import { useCart } from '../contexts/CartContext'

interface Props {
  product: Product
}

export default function ProductCard({ product }: Props) {
  const { addItem, items } = useCart()
  const cartItem = items.find((i) => i.id === product.id)
  const inCart = cartItem ? cartItem.quantity : 0
  const outOfStock = product.stock <= 0

  return (
    <div className="bg-bg-surface border border-white/5 rounded-2xl overflow-hidden card-hover flex flex-col">
      {/* Image */}
      <div className="relative aspect-square bg-bg-raised overflow-hidden">
        {product.imageUrl ? (
          <img src={product.imageUrl} alt={product.name} className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <Package size={40} className="text-gray-700" />
          </div>
        )}
        {product.isFeatured && (
          <div className="absolute top-2 left-2 bg-accent-gold text-black text-xs font-bold px-2 py-0.5 rounded-full">
            ✨ Featured
          </div>
        )}
        {outOfStock && (
          <div className="absolute inset-0 bg-black/60 flex items-center justify-center">
            <span className="text-white font-semibold text-sm">Ausverkauft</span>
          </div>
        )}
        {product.stock <= 3 && product.stock > 0 && (
          <div className="absolute top-2 right-2 bg-accent-orange/90 text-white text-xs px-2 py-0.5 rounded-full">
            Nur noch {product.stock}
          </div>
        )}
      </div>

      {/* Info */}
      <div className="p-4 flex flex-col flex-1">
        <div className="flex flex-wrap gap-1 mb-2">
          {product.tags.slice(0, 2).map((tag) => (
            <span key={tag} className="text-xs bg-accent-purple/10 text-accent-purple border border-accent-purple/20 px-2 py-0.5 rounded-full">
              {tag}
            </span>
          ))}
        </div>
        <h3 className="text-white font-semibold mb-1">{product.name}</h3>
        <p className="text-gray-500 text-sm flex-1 mb-3 line-clamp-2">{product.description}</p>
        <div className="flex items-center justify-between mt-auto">
          <span className="text-xl font-bold gradient-text">€{product.price.toFixed(2)}</span>
          <button
            type="button"
            onClick={() => !outOfStock && addItem(product)}
            disabled={outOfStock}
            className={`flex items-center gap-2 text-sm px-3 py-2 rounded-full font-medium transition-all
              ${outOfStock
                ? 'bg-gray-800 text-gray-600 cursor-not-allowed'
                : inCart > 0
                  ? 'bg-accent-purple text-white'
                  : 'btn-primary !py-2 !px-3'
              }`}
          >
            <ShoppingCart size={14} />
            {inCart > 0 ? `${inCart} im Warenkorb` : 'Kaufen'}
          </button>
        </div>
      </div>
    </div>
  )
}
