import { Mail, Instagram, MessageCircle } from 'lucide-react'
import YTIcon from './YTIcon'
import { Link } from 'react-router-dom'
import { useTheme } from '../contexts/ThemeContext'

export default function Footer() {
  const { t } = useTheme()

  return (
    <footer className="footer-root mt-24">
      <div className="max-w-6xl mx-auto px-4 py-12">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">

          {/* Brand */}
          <div className="flex flex-col gap-3">
            <span className="text-2xl font-display font-black gradient-text">✦ ShinyFam</span>
            <p className="text-sm leading-relaxed text-secondary">{t('footer.tagline')}</p>
          </div>

          {/* Navigation */}
          <nav aria-label="Footer Navigation">
            <h3 className="font-semibold mb-3 text-primary">{t('footer.nav')}</h3>
            <ul className="flex flex-col gap-2 list-none p-0 m-0">
              {[
                { to: '/',          label: t('nav.home') },
                { to: '/events',    label: t('nav.events') },
                { to: '/artwork',   label: t('nav.artwork') },
                { to: '/ueber-uns', label: t('nav.about') },
                { to: '/kontakt',   label: t('nav.contact') },
                { to: '/impressum',   label: 'Impressum' },
                { to: '/datenschutz', label: 'Datenschutz' },
              ].map((link) => (
                <li key={link.to}>
                  <Link
                    to={link.to}
                    className="text-secondary text-sm hover-primary transition-colors"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>

          {/* Social */}
          <div>
            <h3 className="font-semibold mb-3 text-primary">{t('footer.social')}</h3>
            <ul className="flex flex-col gap-3 list-none p-0 m-0">
              <li>
                <a href="mailto:info@shinyfam.de" className="footer-social-link">
                  <Mail size={16} className="text-accent-purple shrink-0" aria-hidden="true" />
                  <span>info@shinyfam.de</span>
                </a>
              </li>
              <li>
                <a href="https://instagram.com/shiny.fam.tcg" target="_blank" rel="noopener noreferrer" className="footer-social-link">
                  <Instagram size={16} className="text-accent-pink shrink-0" aria-hidden="true" />
                  <span>@shiny.fam.tcg</span>
                </a>
              </li>
              <li>
                <a href="https://youtube.com/@ShinyFam26" target="_blank" rel="noopener noreferrer" className="footer-social-link">
                  <YTIcon size={16} className="text-red-500 shrink-0" />
                  <span>@ShinyFam26</span>
                </a>
              </li>
              <li>
                <Link to="/kontakt" className="footer-social-link">
                  <MessageCircle size={16} className="text-green-500 shrink-0" aria-hidden="true" />
                  <span>WhatsApp (QR-Code)</span>
                </Link>
              </li>
            </ul>
          </div>
        </div>

        <div className="section-divider mt-8 mb-6" />

        <div className="flex flex-wrap gap-4 justify-center items-center text-xs text-muted">
          <span>© {new Date().getFullYear()} ShinyFam</span>
          <Link to="/impressum" className="hover-primary transition-colors">Impressum</Link>
          <Link to="/datenschutz" className="hover-primary transition-colors">Datenschutz</Link>
        </div>
      </div>

      {/* Floating Instagram Button */}
      <a
        href="https://instagram.com/shiny.fam.tcg"
        target="_blank"
        rel="noopener noreferrer"
        aria-label="Instagram @shiny.fam.tcg öffnen"
        className="fixed bottom-6 right-6 z-40 btn-primary w-12 h-12 !p-0 justify-center shadow-lg"
      >
        <Instagram size={20} aria-hidden="true" />
      </a>
    </footer>
  )
}
