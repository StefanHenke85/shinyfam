import { useState, useEffect } from 'react'
import { BrowserRouter, Routes, Route, useLocation, Link } from 'react-router-dom'
import { CartProvider } from './contexts/CartContext'
import { ThemeProvider } from './contexts/ThemeContext'
import Navbar from './components/Navbar'
import Footer from './components/Footer'
import CartSidebar from './components/CartSidebar'
import CookieBanner from './components/CookieBanner'
import ScrollToTopButton from './components/ScrollToTopButton'
import Home from './pages/Home'
import Events from './pages/Events'
import Artwork from './pages/Artwork'
import Shop from './pages/Shop'
import Checkout from './pages/Checkout'
import CheckoutSuccess from './pages/CheckoutSuccess'
import Kontakt from './pages/Kontakt'
import Impressum from './pages/Impressum'
import Datenschutz from './pages/Datenschutz'
import UeberUns from './pages/UeberUns'
import Haendler from './pages/Haendler'
import Admin from './pages/admin/Admin'
import MaintenancePage from './pages/MaintenancePage'
import Tickets from './pages/Tickets'
import TicketOrder from './pages/TicketOrder'
import TicketCheck from './pages/TicketCheck'
import TicketBedingungen from './pages/TicketBedingungen'
import TicketScan from './pages/TicketScan'

function NotFound() {
  return (
    <div className="flex flex-col items-center justify-center min-h-[70vh] text-center px-4 py-16">
      <div className="text-8xl mb-6 animate-bounce">🃏</div>
      <div className="inline-block bg-accent-purple/10 border border-accent-purple/20 text-accent-purple font-bold text-sm px-4 py-1.5 rounded-full mb-4">
        Fehler 404
      </div>
      <h1 className="font-display text-4xl md:text-5xl font-black section-title mb-3">
        Diese Seite existiert nicht
      </h1>
      <p className="text-secondary text-lg mb-2 max-w-md">
        Vielleicht wurde die Seite verschoben oder der Link ist falsch.
      </p>
      <p className="text-muted text-sm mb-8">Kein Problem — hier sind ein paar hilfreiche Links:</p>
      <div className="flex flex-wrap gap-3 justify-center mb-10">
        <Link to="/" className="btn-primary">🏠 Startseite</Link>
        <Link to="/events" className="btn-outline">📅 Events</Link>
        <Link to="/shop" className="btn-outline">🛒 Shop</Link>
        <Link to="/artwork" className="btn-outline">🎨 Kunstwerke</Link>
      </div>
      <p className="text-xs text-muted">
        Fragen? <a href="mailto:info@shinyfam.de" className="text-accent-purple hover:underline">info@shinyfam.de</a>
      </p>
    </div>
  )
}

function PageTracker() {
  const location = useLocation()
  useEffect(() => {
    if (location.pathname.startsWith('/admin')) return
    fetch('/api/analytics/track', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ path: location.pathname, referrer: document.referrer || null }),
    }).catch(() => {})
  }, [location.pathname])
  return null
}

export default function App() {
  const [maintenance, setMaintenance] = useState<boolean | null>(null)

  useEffect(() => {
    fetch('/api/settings')
      .then(r => r.json())
      .then(data => setMaintenance(data.maintenance === 'true'))
      .catch(() => setMaintenance(false))
  }, [])

  if (maintenance === null) return null

  return (
    <ThemeProvider>
      <CartProvider>
        <BrowserRouter>
          <PageTracker />
          <Routes>
            <Route path="/admin/*" element={<Admin onMaintenanceChange={setMaintenance} />} />
            <Route path="*" element={
              maintenance ? <MaintenancePage /> : (
                <div className="page-wrapper flex flex-col">
                  <Navbar />
                  <CartSidebar />
                  <main id="main-content" className="flex-1" tabIndex={-1}>
                    <Routes>
                      <Route path="/" element={<Home />} />
                      <Route path="/events" element={<Events />} />
                      <Route path="/artwork" element={<Artwork />} />
                      <Route path="/shop" element={<Shop />} />
                      <Route path="/checkout" element={<Checkout />} />
                      <Route path="/checkout/success" element={<CheckoutSuccess />} />
                      <Route path="/haendler" element={<Haendler />} />
                      <Route path="/ueber-uns" element={<UeberUns />} />
                      <Route path="/kontakt" element={<Kontakt />} />
                      <Route path="/impressum" element={<Impressum />} />
                      <Route path="/datenschutz" element={<Datenschutz />} />
                      <Route path="/tickets" element={<Tickets />} />
                      <Route path="/tickets/bestellung/:number" element={<TicketOrder />} />
                      <Route path="/tickets/:slug" element={<Tickets />} />
                      <Route path="/t/:code" element={<TicketCheck />} />
                      <Route path="/einlass" element={<TicketScan />} />
                      <Route path="/ticket-bedingungen" element={<TicketBedingungen />} />
                      <Route path="*" element={<NotFound />} />
                    </Routes>
                  </main>
                  <Footer />
                  <CookieBanner />
                  <ScrollToTopButton />
                </div>
              )
            } />
          </Routes>
        </BrowserRouter>
      </CartProvider>
    </ThemeProvider>
  )
}
