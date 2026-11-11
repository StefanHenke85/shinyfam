import { useState, useEffect } from 'react'
import AdminLogin from './AdminLogin'
import AdminEvents from './AdminEvents'
import AdminArtworks from './AdminArtworks'
import AdminProducts from './AdminProducts'
import AdminOrders from './AdminOrders'
import AdminVideos from './AdminVideos'
import AdminBrands from './AdminBrands'
import AdminMail from './AdminMail'
import AdminAnalytics from './AdminAnalytics'
import AdminContacts from './AdminContacts'
import AdminSeo from './AdminSeo'
import AdminTickets from './AdminTickets'
import { CalendarDays, Palette, ShoppingBag, Package, LogOut, Store, Construction, Mail, BarChart2, Users, Search, Instagram, Ticket } from 'lucide-react'

type Tab = 'events' | 'artworks' | 'products' | 'orders' | 'videos' | 'brands' | 'mail' | 'analytics' | 'contacts' | 'seo' | 'tickets'

export default function Admin({ onMaintenanceChange }: { onMaintenanceChange?: (v: boolean) => void }) {
  const [token, setToken] = useState<string | null>(() => localStorage.getItem('shinyfam-admin-token'))
  const [tab, setTab] = useState<Tab>('events')
  const [maintenance, setMaintenance] = useState(false)
  const [maintenanceSaving, setMaintenanceSaving] = useState(false)

  useEffect(() => {
    fetch('/api/settings')
      .then(r => r.json())
      .then(data => setMaintenance(data.maintenance === 'true'))
      .catch(() => {})
  }, [])

  async function toggleMaintenance() {
    if (!token) return
    const next = !maintenance
    if (next && !confirm('Wartungsmodus aktivieren?\n\nDie Seite zeigt dann für alle Besucher eine „Im Aufbau"-Meldung.\n\nJetzt aktivieren?')) return
    setMaintenanceSaving(true)
    try {
      await fetch('/api/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ key: 'maintenance', value: String(next) }),
      })
      setMaintenance(next)
      onMaintenanceChange?.(next)
    } finally {
      setMaintenanceSaving(false)
    }
  }

  function logout() {
    localStorage.removeItem('shinyfam-admin-token')
    setToken(null)
  }

  if (!token) return <AdminLogin onLogin={setToken} />

  const tabs: { key: Tab; label: string; icon: React.ReactNode }[] = [
    { key: 'events',   label: 'Events',       icon: <CalendarDays size={16} /> },
    { key: 'artworks', label: 'Kunstwerke',    icon: <Palette size={16} /> },
    { key: 'products', label: 'Shop',          icon: <ShoppingBag size={16} /> },
    { key: 'orders',   label: 'Bestellungen',  icon: <Package size={16} /> },
    { key: 'tickets',  label: 'Tickets',       icon: <Ticket size={16} /> },
    { key: 'videos',   label: 'Instagram',     icon: <Instagram size={16} /> },
    { key: 'brands',   label: 'Händler',        icon: <Store size={16} /> },
    { key: 'mail',      label: 'Postfach',    icon: <Mail size={16} /> },
    { key: 'analytics', label: 'Statistik',   icon: <BarChart2 size={16} /> },
    { key: 'contacts',  label: 'Kontakte',    icon: <Users size={16} /> },
    { key: 'seo',       label: 'SEO',         icon: <Search size={16} /> },
  ]

  return (
    <div className="admin-root">
      <nav className="admin-nav">
        <div className="flex items-center gap-2">
          <img src="/logo.jpg" alt="ShinyFam" className="h-8 w-8 rounded-lg object-cover" />
          <span className="font-display font-bold section-title text-sm">Admin</span>
        </div>
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={toggleMaintenance}
            disabled={maintenanceSaving}
            title={maintenance ? 'Wartungsmodus deaktivieren' : 'Wartungsmodus aktivieren'}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
              maintenance
                ? 'bg-amber-500 text-white hover:bg-amber-600'
                : 'bg-bg-raised text-muted hover:text-primary border border-theme'
            }`}
          >
            <Construction size={13} aria-hidden="true" />
            {maintenance ? 'Im Aufbau AN' : 'Im Aufbau'}
          </button>
          <button type="button" onClick={logout} className="admin-logout-btn">
            <LogOut size={14} aria-hidden="true" /> Abmelden
          </button>
        </div>
      </nav>

      <div className="admin-tabs-bar">
        <div className="max-w-6xl mx-auto flex overflow-x-auto">
          {tabs.map((t) => (
            <button
              key={t.key}
              type="button"
              onClick={() => setTab(t.key)}
              className={`admin-tab${tab === t.key ? ' admin-tab-active' : ''}`}
            >
              {t.icon}{t.label}
            </button>
          ))}
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-4 py-8">
        {tab === 'events'   && <AdminEvents token={token} />}
        {tab === 'artworks' && <AdminArtworks token={token} />}
        {tab === 'products' && <AdminProducts token={token} />}
        {tab === 'orders'   && <AdminOrders token={token} />}
        {tab === 'videos'   && <AdminVideos token={token} />}
        {tab === 'brands'   && <AdminBrands token={token} />}
        {tab === 'mail'      && <AdminMail token={token} />}
        {tab === 'analytics' && <AdminAnalytics token={token} />}
        {tab === 'contacts'  && <AdminContacts token={token} />}
        {tab === 'seo'       && <AdminSeo token={token} />}
        {tab === 'tickets'   && <AdminTickets token={token} />}
      </div>
    </div>
  )
}
