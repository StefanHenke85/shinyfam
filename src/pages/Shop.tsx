import { useState, useEffect } from 'react'
import { ShoppingBag, Search } from 'lucide-react'
import ProductCard from '../components/ProductCard'
import { useCart } from '../contexts/CartContext'
import type { Product } from '../types'

export default function Shop() {
  const { itemCount, setIsOpen } = useCart()
  const [products, setProducts] = useState<Product[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState<'all' | 'available' | 'featured'>('all')

  useEffect(() => {
    fetch('/api/products')
      .then((r) => r.json())
      .then((data) => setProducts(Array.isArray(data) ? data : []))
      .catch(() => setProducts([]))
      .finally(() => setLoading(false))
  }, [])

  const filtered = products.filter((p) => {
    const matchSearch = p.name.toLowerCase().includes(search.toLowerCase()) ||
      p.description?.toLowerCase().includes(search.toLowerCase())
    const matchFilter =
      filter === 'all' ? true :
      filter === 'available' ? p.stock > 0 :
      p.isFeatured
    return matchSearch && matchFilter
  })

  return (
    <div className="max-w-6xl mx-auto px-4 py-8 pt-24">
      {/* Header */}
      <div className="flex items-center justify-between mb-8 flex-wrap gap-4">
        <div>
          <h1 className="font-display text-4xl md:text-5xl font-black text-white flex items-center gap-3 mb-1">
            <ShoppingBag size={36} className="text-accent-purple" />
            Shop
          </h1>
          <p className="text-gray-400">{products.length} Produkte verfügbar</p>
        </div>
        <button
          type="button"
          onClick={() => setIsOpen(true)}
          className="relative btn-outline flex items-center gap-2 text-sm"
        >
          <ShoppingBag size={16} />
          Warenkorb
          {itemCount > 0 && (
            <span className="absolute -top-2 -right-2 bg-accent-purple text-white text-xs rounded-full w-5 h-5 flex items-center justify-center">
              {itemCount}
            </span>
          )}
        </button>
      </div>

      {/* Search + Filter */}
      <div className="flex flex-col sm:flex-row gap-3 mb-8">
        <div className="relative flex-1">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Produkt suchen..."
            className="w-full bg-bg-surface border border-white/10 rounded-xl pl-9 pr-4 py-2 text-white text-sm focus:border-accent-purple outline-none transition-colors"
          />
        </div>
        <div className="flex gap-2">
          {(['all', 'available', 'featured'] as const).map((f) => (
            <button
              key={f}
              type="button"
              onClick={() => setFilter(f)}
              className={`text-sm px-3 py-2 rounded-xl border transition-colors ${
                filter === f ? 'bg-accent-purple border-accent-purple text-white' : 'border-white/10 text-gray-400 hover:border-white/30'
              }`}
            >
              {f === 'all' ? 'Alle' : f === 'available' ? 'Verfügbar' : '✨ Featured'}
            </button>
          ))}
        </div>
      </div>

      {/* Grid */}
      {loading ? (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {[...Array(8)].map((_, i) => (
            <div key={i} className="bg-bg-surface rounded-2xl aspect-square animate-pulse" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-20 text-gray-600">
          {search ? `Keine Produkte für "${search}" gefunden.` : 'Noch keine Produkte vorhanden.'}
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {filtered.map((p) => <ProductCard key={p.id} product={p} />)}
        </div>
      )}
    </div>
  )
}
