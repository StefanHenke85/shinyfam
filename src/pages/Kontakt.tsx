import { Mail, Instagram, MessageCircle } from 'lucide-react'
import YTIcon from '../components/YTIcon'
import { useTheme } from '../contexts/ThemeContext'

export default function Kontakt() {
  const { t } = useTheme()

  const contacts = [
    {
      icon: <Instagram size={24} />,
      label: 'Instagram',
      handle: '@shiny.fam.tcg',
      href: 'https://instagram.com/shiny.fam.tcg',
      qr: '/qr-instagram.jpg',
      color: 'text-accent-pink',
      bg: 'bg-accent-pink/10 hover:bg-accent-pink/20',
    },
    {
      icon: <MessageCircle size={24} />,
      label: 'WhatsApp',
      handle: t('contact.whatsapp'),
      href: null,
      qr: '/qr-whatsapp.jpg',
      color: 'text-green-400',
      bg: 'bg-green-500/10 hover:bg-green-500/20',
    },
    {
      icon: <YTIcon size={24} />,
      label: 'YouTube',
      handle: '@ShinyFam26',
      href: 'https://youtube.com/@ShinyFam26',
      qr: '/qr-youtube.jpg',
      color: 'text-red-400',
      bg: 'bg-red-500/10 hover:bg-red-500/20',
    },
  ]

  return (
    <div className="max-w-4xl mx-auto px-4 py-8 pt-24">
      <div className="text-center mb-12">
        <h1 className="font-display text-4xl md:text-5xl font-black section-title mb-2">{t('contact.title')}</h1>
        <p className="text-secondary">{t('contact.sub')}</p>
      </div>

      {/* E-Mail */}
      <a
        href="mailto:info@shinyfam.de"
        className="flex items-center gap-4 bg-bg-surface border border-theme rounded-2xl p-5 mb-6 card-hover group"
      >
        <div className="w-12 h-12 bg-accent-purple/10 group-hover:bg-accent-purple/20 rounded-full flex items-center justify-center shrink-0 transition-colors">
          <Mail size={20} className="text-accent-purple" />
        </div>
        <div>
          <p className="text-primary font-semibold">E-Mail</p>
          <p className="text-secondary text-sm">info@shinyfam.de</p>
        </div>
      </a>

      {/* Social Cards mit QR */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {contacts.map((c) => (
          <div
            key={c.label}
            className="bg-bg-surface border border-theme rounded-2xl overflow-hidden card-hover"
          >
            {/* QR Code */}
            <div className="bg-white p-4 flex items-center justify-center">
              <img
                src={c.qr}
                alt={`QR Code ${c.label}`}
                className="w-full max-w-[200px] h-auto rounded-lg"
              />
            </div>

            {/* Info */}
            <div className="p-4 flex items-center gap-3">
              <div className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 transition-colors ${c.bg}`}>
                <span className={c.color}>{c.icon}</span>
              </div>
              <div className="min-w-0">
                <p className="text-primary font-semibold text-sm">{c.label}</p>
                {c.href ? (
                  <a
                    href={c.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={`text-xs truncate hover:underline ${c.color}`}
                  >
                    {c.handle}
                  </a>
                ) : (
                  <p className="text-muted text-xs">{c.handle}</p>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
