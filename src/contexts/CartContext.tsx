import { createContext, useContext, useState, useEffect, type ReactNode } from 'react'
import type { CartItem, Product } from '../types'

interface CartContextType {
  items: CartItem[]
  itemCount: number
  total: number
  isOpen: boolean
  addItem: (product: Product) => void
  removeItem: (id: string) => void
  updateQuantity: (id: string, quantity: number) => void
  clearCart: () => void
  setIsOpen: (open: boolean) => void
}

const CartContext = createContext<CartContextType | null>(null)

const STORAGE_KEY = 'shinyfam-cart'
const FREE_SHIPPING_THRESHOLD = 50

export function CartProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<CartItem[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY)
      return saved ? JSON.parse(saved) : []
    } catch {
      return []
    }
  })
  const [isOpen, setIsOpen] = useState(false)

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(items))
  }, [items])

  const itemCount = items.reduce((sum, i) => sum + i.quantity, 0)
  const subtotal = items.reduce((sum, i) => sum + i.price * i.quantity, 0)
  const shipping = subtotal >= FREE_SHIPPING_THRESHOLD || subtotal === 0 ? 0 : 4.99
  const total = subtotal + shipping

  function addItem(product: Product) {
    setItems((prev) => {
      const existing = prev.find((i) => i.id === product.id)
      if (existing) {
        return prev.map((i) =>
          i.id === product.id ? { ...i, quantity: Math.min(i.quantity + 1, product.stock) } : i
        )
      }
      return [...prev, { ...product, quantity: 1 }]
    })
    setIsOpen(true)
  }

  function removeItem(id: string) {
    setItems((prev) => prev.filter((i) => i.id !== id))
  }

  function updateQuantity(id: string, quantity: number) {
    if (quantity <= 0) return removeItem(id)
    setItems((prev) =>
      prev.map((i) => (i.id === id ? { ...i, quantity } : i))
    )
  }

  function clearCart() {
    setItems([])
  }

  return (
    <CartContext.Provider value={{ items, itemCount, total, isOpen, addItem, removeItem, updateQuantity, clearCart, setIsOpen }}>
      {children}
    </CartContext.Provider>
  )
}

export function useCart() {
  const ctx = useContext(CartContext)
  if (!ctx) throw new Error('useCart must be used within CartProvider')
  return ctx
}

export { FREE_SHIPPING_THRESHOLD }
