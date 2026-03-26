import { useState, useEffect } from 'react'
import { Cookie, X } from 'lucide-react'
import { useTheme } from '../contexts/ThemeContext'

export type CookieConsent = 'all' | 'necessary' | null

const STORAGE_KEY = 'shinyfam-cookie-consent'

export function getCookieConsent(): CookieConsent {
  return (localStorage.getItem(STORAGE_KEY) as CookieConsent) ?? null
}

export default function CookieBanner() {
  const { t } = useTheme()
  const [visible, setVisible] = useState(false)
  const [showDetails, setShowDetails] = useState(false)

  useEffect(() => {
    if (!getCookieConsent()) setVisible(true)
  }, [])

  function accept(choice: 'all' | 'necessary') {
    localStorage.setItem(STORAGE_KEY, choice)
    setVisible(false)
  }

  if (!visible) return null

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={t('cookie.title')}
      className="fixed bottom-0 left-0 right-0 z-[100] p-4 md:p-6"
    >
      <div
        className="max-w-2xl mx-auto rounded-2xl p-5 shadow-2xl"
        style={{
          background: 'var(--bg-surface)',
          border: '1px solid var(--border)',
          boxShadow: '0 -4px 40px rgba(0,0,0,0.15)',
        }}
      >
        <div className="flex items-start gap-3 mb-3">
          <Cookie size={20} className="shrink-0 mt-0.5" style={{ color: 'var(--accent-orange)' }} aria-hidden="true" />
          <div className="flex-1 min-w-0">
            <h2 className="font-display font-bold text-base mb-1" style={{ color: 'var(--text-primary)' }}>
              {t('cookie.title')}
            </h2>
            <p className="text-sm leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
              {t('cookie.text')}
            </p>

            {showDetails && (
              <div
                className="mt-3 rounded-xl p-3 text-xs leading-relaxed space-y-2"
                style={{ background: 'var(--bg-raised)', color: 'var(--text-muted)' }}
              >
                <p><strong style={{ color: 'var(--text-primary)' }}>{t('cookie.details.necessary')}</strong> {t('cookie.details.necessaryText')}</p>
                <p><strong style={{ color: 'var(--text-primary)' }}>{t('cookie.details.youtube')}</strong> {t('cookie.details.youtubeText')} <a href="https://policies.google.com/privacy" target="_blank" rel="noopener noreferrer" style={{ color: 'var(--accent-purple)' }} className="underline">{t('cookie.details.privacyLink')}</a>.</p>
              </div>
            )}
          </div>
          <button
            type="button"
            onClick={() => accept('necessary')}
            aria-label="Cookie-Banner schließen (nur notwendige)"
            className="shrink-0 p-1 rounded-lg hover:opacity-70 transition-opacity"
            style={{ color: 'var(--text-muted)' }}
          >
            <X size={18} aria-hidden="true" />
          </button>
        </div>

        <div className="flex flex-wrap gap-2 items-center justify-between">
          <button
            type="button"
            onClick={() => setShowDetails(!showDetails)}
            className="text-xs underline transition-opacity hover:opacity-70"
            style={{ color: 'var(--text-muted)' }}
          >
            {showDetails ? t('cookie.showLess') : t('cookie.more')}
          </button>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => accept('necessary')}
              className="btn-outline text-xs !py-2 !px-3"
            >
              {t('cookie.necessary')}
            </button>
            <button
              type="button"
              onClick={() => accept('all')}
              className="btn-primary text-xs !py-2 !px-3"
            >
              {t('cookie.accept')}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
