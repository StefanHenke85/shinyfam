import { useState, useEffect } from 'react'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { CartProvider } from './contexts/CartContext'
import { ThemeProvider } from './contexts/ThemeContext'
import Navbar from './components/Navbar'
import Footer from './components/Footer'
import CartSidebar from './components/CartSidebar'
import CookieBanner from './components/CookieBanner'
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
import Admin from './pages/admin/Admin'
import MaintenancePage from './pages/MaintenancePage'

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
                      <Route path="/ueber-uns" element={<UeberUns />} />
                      <Route path="/kontakt" element={<Kontakt />} />
                      <Route path="/impressum" element={<Impressum />} />
                      <Route path="/datenschutz" element={<Datenschutz />} />
                      <Route path="*" element={
                        <div className="flex flex-col items-center justify-center min-h-[60vh] text-center px-4">
                          <p className="text-8xl mb-4">🃏</p>
                          <h1 className="font-display text-4xl font-black section-title mb-3">404</h1>
                          <p className="text-secondary text-lg mb-6">Diese Seite gibt es leider nicht.</p>
                          <a href="/" className="btn-primary">Zur Startseite</a>
                        </div>
                      } />
                    </Routes>
                  </main>
                  <Footer />
                  <CookieBanner />
                </div>
              )
            } />
          </Routes>
        </BrowserRouter>
      </CartProvider>
    </ThemeProvider>
  )
}
