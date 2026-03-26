import { useState, useEffect } from 'react'
import { Package, ChevronDown, ChevronUp } from 'lucide-react'

interface Order {
  id: number; order_number: string; first_name: string; last_name: string
  email: string; city: string; total: number; order_status: string
  payment_method: string; items: string; created_at: string
}

const statusLabels: Record<string, string> = {
  new: 'Neu', processing: 'In Bearbeitung', shipped: 'Versendet',
  delivered: 'Geliefert', cancelled: 'Storniert',
}

export default function AdminOrders({ token }: { token: string }) {
  const [orders, setOrders] = useState<Order[]>([])
  const [expanded, setExpanded] = useState<number | null>(null)
  const [loading, setLoading] = useState(false)
  const headers = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }

  async function load() {
    setLoading(true)
    const res = await fetch('/api/shop/orders/admin', { headers })
    const data = await res.json()
    setOrders(Array.isArray(data) ? data : [])
    setLoading(false)
  }
  useEffect(() => { load() }, [])

  async function updateStatus(id: number, status: string) {
    await fetch(`/api/shop/orders/${id}/status`, { method: 'PATCH', headers, body: JSON.stringify({ status }) })
    await load()
  }

  return (
    <div>
      <h2 className="font-display text-2xl font-bold section-title mb-6 flex items-center gap-2">
        <Package size={22} className="text-accent-orange" aria-hidden="true" /> Bestellungen
      </h2>

      {loading ? (
        <p className="text-secondary text-center py-8">Lädt…</p>
      ) : orders.length === 0 ? (
        <p className="text-muted text-center py-8">Noch keine Bestellungen.</p>
      ) : (
        <div className="flex flex-col gap-3">
          {orders.map((o) => (
            <div key={o.id} className="admin-card overflow-hidden p-0">
              <button
                type="button"
                className="w-full p-4 flex items-center justify-between gap-4 text-left"
                onClick={() => setExpanded(expanded === o.id ? null : o.id)}
                aria-expanded={expanded === o.id ? 'true' : 'false'}
              >
                <div className="flex items-center gap-3 min-w-0">
                  <span className={`admin-status-badge admin-status-${o.order_status}`}>
                    {statusLabels[o.order_status] || o.order_status}
                  </span>
                  <div className="min-w-0">
                    <p className="section-title font-medium text-sm">{o.order_number}</p>
                    <p className="text-secondary text-xs truncate">{o.first_name} {o.last_name} · {o.city}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  <span className="font-bold section-title">€{o.total?.toFixed(2)}</span>
                  {expanded === o.id
                    ? <ChevronUp size={14} className="text-muted" aria-hidden="true" />
                    : <ChevronDown size={14} className="text-muted" aria-hidden="true" />}
                </div>
              </button>
              {expanded === o.id && (
                <div className="px-4 pb-4 border-t border-theme pt-3">
                  <p className="text-secondary text-sm mb-1">{o.email} · {o.payment_method}</p>
                  <p className="text-muted text-xs mb-3">{new Date(o.created_at).toLocaleString('de-DE')}</p>
                  <div className="flex gap-2 flex-wrap">
                    {Object.keys(statusLabels).map((s) => (
                      <button key={s} type="button"
                        onClick={() => updateStatus(o.id, s)}
                        className={`text-xs px-3 py-1 rounded-full border transition-colors ${o.order_status === s ? 'btn-primary !py-1 !px-3' : 'btn-outline !py-1 !px-3'}`}>
                        {statusLabels[s]}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
