import { useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { Menu, X, Sun, Moon, ShoppingBag } from 'lucide-react'
import { useTheme } from '../contexts/ThemeContext'
import { useCart } from '../contexts/CartContext'

export default function Navbar() {
  const [open, setOpen] = useState(false)
  const location = useLocation()
  const { theme, lang, toggleTheme, toggleLang, t } = useTheme()
  const { itemCount, setIsOpen: openCart } = useCart()

  const navLinks = [
    { to: '/',        label: t('nav.home') },
    { to: '/events',   label: t('nav.events') },
    { to: '/haendler', label: 'Händler' },
    { to: '/artwork',  label: t('nav.artwork') },
    { to: '/ueber-uns', label: t('nav.about') },
    { to: '/kontakt', label: t('nav.contact') },
  ]

  const isActive = (path: string) =>
    path === '/' ? location.pathname === '/' : location.pathname.startsWith(path)

  return (
    <header>
      <nav className="nav-root fixed top-0 left-0 right-0 z-50" aria-label="Hauptnavigation">
        <div className="max-w-6xl mx-auto px-4 flex items-center justify-between h-16 gap-4">

          {/* Logo */}
          <Link
            to="/"
            className="nav-logo-link shrink-0"
            aria-label={t('nav.toHome')}
            onClick={() => setOpen(false)}
          >
            <img src="/logo.jpg" alt="ShinyFam Logo" className="nav-logo-img" />
            <span className="text-lg font-display font-black gradient-text nav-logo-text" aria-hidden="true">
              ShinyFam
            </span>
          </Link>

          {/* Desktop Nav */}
          <div className="hidden md:flex items-center gap-0.5 flex-1 justify-center">
            {navLinks.map((link) => (
              <Link
                key={link.to}
                to={link.to}
                className="nav-link"
                aria-current={isActive(link.to) ? 'page' : undefined}
              >
                {link.label}
              </Link>
            ))}
          </div>

          {/* Right controls */}
          <div className="flex items-center gap-1 shrink-0">
            {/* Lang toggle */}
            <button
              type="button"
              onClick={toggleLang}
              aria-label={t('a11y.toggleLang')}
              className="icon-btn hidden md:flex text-xs font-bold"
            >
              {lang === 'de' ? 'EN' : 'DE'}
            </button>

            {/* Theme toggle */}
            <button
              type="button"
              onClick={toggleTheme}
              aria-label={theme === 'dark' ? t('a11y.lightmode') : t('a11y.darkmode')}
              className="icon-btn"
            >
              {theme === 'dark'
                ? <Sun size={16} aria-hidden="true" />
                : <Moon size={16} aria-hidden="true" />}
            </button>

            {/* Cart */}
            <button
              type="button"
              onClick={() => openCart(true)}
              aria-label={`${t('a11y.openCart')}${itemCount > 0 ? `, ${itemCount} ${t('cart.items')}` : ''}`}
              className="icon-btn relative"
            >
              <ShoppingBag size={16} aria-hidden="true" />
              {itemCount > 0 && (
                <span
                  className="cart-badge absolute -top-1 -right-1"
                  aria-hidden="true"
                >
                  {itemCount}
                </span>
              )}
            </button>

            {/* Mobile menu toggle */}
            <button
              type="button"
              onClick={() => setOpen(!open)}
              aria-label={open ? t('a11y.closeMenu') : t('a11y.openMenu')}
              aria-expanded={open ? 'true' : 'false'}
              aria-controls="mobile-menu"
              className="icon-btn"
            >
              {open ? <X size={18} aria-hidden="true" /> : <Menu size={18} aria-hidden="true" />}
            </button>
          </div>
        </div>

        {/* Mobile menu */}
        {open && (
          <div id="mobile-menu" className="mobile-menu md:hidden px-4 py-3 flex flex-col gap-1">
            {navLinks.map((link) => (
              <Link
                key={link.to}
                to={link.to}
                onClick={() => setOpen(false)}
                className="mobile-nav-link"
                aria-current={isActive(link.to) ? 'page' : undefined}
              >
                {link.label}
              </Link>
            ))}
            <div className="flex gap-2 pt-3 mt-1 border-t border-theme">
              <button type="button" onClick={toggleLang} className="btn-outline text-xs flex-1 justify-center">
                {lang === 'de' ? 'English' : 'Deutsch'}
              </button>
              <a
                href="https://instagram.com/shiny.fam.tcg"
                target="_blank"
                rel="noopener noreferrer"
                className="btn-primary text-xs flex-1 justify-center"
                onClick={() => setOpen(false)}
              >
                {t('nav.cta')}
              </a>
            </div>
          </div>
        )}
      </nav>
    </header>
  )
}
