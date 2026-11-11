import { useEffect, useState } from 'react'

// Online-Ticketverkauf (tickets.mjs): Liste einmal pro Seitenaufruf laden
export type ShopEntry = { eventId: string; slug: string; title: string; date: string; visitorEnabled: boolean; dealerEnabled: boolean; open: boolean }

let shopPromise: Promise<ShopEntry[]> | null = null
function loadShop() {
  shopPromise ||= fetch('/api/tickets/shop').then(r => r.json()).then(d => (Array.isArray(d) ? d : [])).catch(() => [])
  return shopPromise
}

export function useTicketShopList() {
  const [list, setList] = useState<ShopEntry[]>([])
  useEffect(() => { loadShop().then(l => setList(l.filter(e => e.open))) }, [])
  return list
}

export function useTicketShop(eventId: string | undefined) {
  const list = useTicketShopList()
  return eventId ? list.find(e => e.eventId === eventId) || null : null
}
