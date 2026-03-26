export interface EventPartner {
  name: string
  logoUrl: string
  website?: string
}

export interface TCGEvent {
  id: string
  title: string
  date: string
  endDate?: string
  location: string
  address: string
  city: string
  description: string
  youtubeVideoId?: string
  ticketUrl?: string
  imageUrl?: string
  tags: string[]
  partners?: EventPartner[]
  isActive?: boolean
  entryFee?: number | null
}

export interface ArtworkPiece {
  id: string
  title: string
  description: string
  imagePath: string
  tags: string[]
  sold?: boolean
}

export interface Product {
  id: string
  name: string
  description: string
  price: number
  stock: number
  imageUrl: string
  isFeatured: boolean
  isActive: boolean
  tags: string[]
}

export interface CartItem extends Product {
  quantity: number
}

export interface OrderRequest {
  name: string
  email: string
  phone?: string
  motif: string
  size?: string
  message: string
}

export interface ShopOrder {
  firstName: string
  lastName: string
  email: string
  phone?: string
  street: string
  zip: string
  city: string
  items: CartItem[]
  subtotal: number
  shipping: number
  total: number
  paymentMethod: 'invoice' | 'prepayment' | 'cash_on_pickup'
  notes?: string
}
