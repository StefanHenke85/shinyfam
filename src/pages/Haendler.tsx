import { useState, useEffect } from 'react'
import { Store, ExternalLink, ChevronRight } from 'lucide-react'
import { Link } from 'react-router-dom'
import NewsletterSignup from '../components/NewsletterSignup'

interface Brand { id: string; name: string; logo_url: string | null; website: string | null }

export default function Haendler() {
  const [brands, setBrands] = useState<Brand[]>([])

  useEffect(() => {
    fetch('/api/brands/public')
      .then(r => r.json())
      .then(d => setBrands(Array.isArray(d) ? d : []))
      .catch(() => {})
  }, [])

  return (
    <div className="max-w-6xl mx-auto px-4 py-8 pt-24">
      {/* Schema.org */}
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify({
        "@context": "https://schema.org",
        "@type": "ItemList",
        "name": "Händler & Aussteller – ShinyFam TCG-Börsen",
        "description": "Alle Händler und Aussteller, die bei ShinyFam TCG-Börsen am Niederrhein dabei waren oder dabei sind.",
        "url": "https://shinyfam.de/haendler"
      })}} />

      <div className="mb-10">
        <div className="flex items-center gap-3 mb-2">
          <Store size={32} className="text-accent-purple" aria-hidden="true" />
          <h1 className="font-display text-4xl md:text-5xl font-black text-primary">Händler</h1>
        </div>
        <p className="text-secondary max-w-2xl">
          Das sind die Händler und Aussteller, die bei unseren TCG-Börsen am Niederrhein dabei sind.
          Du möchtest auch ausstellen? Schreib uns eine Anfrage direkt über die Event-Seite!
        </p>
        <Link to="/events" className="btn-primary mt-4 inline-flex items-center gap-1.5 text-sm">
          <ChevronRight size={14} aria-hidden="true" />
          Als Händler anfragen
        </Link>
      </div>

      {brands.length === 0 ? (
        <div className="card rounded-2xl p-12 text-center text-muted">
          <Store size={40} className="mx-auto mb-3 opacity-30" aria-hidden="true" />
          <p>Noch keine Händler eingetragen.</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4 mb-16">
          {brands.map(b => (
            <div key={b.id} className="card rounded-2xl p-4 flex flex-col items-center gap-3 text-center group hover:border-accent-purple/40 transition-colors">
              {b.logo_url ? (
                <img src={b.logo_url} alt={b.name} className="h-16 w-full object-contain" />
              ) : (
                <div className="h-16 w-full flex items-center justify-center">
                  <Store size={28} className="text-muted" aria-hidden="true" />
                </div>
              )}
              <p className="font-semibold text-primary text-sm leading-tight">{b.name}</p>
              {b.website && (
                <a
                  href={b.website}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-accent-purple text-xs flex items-center gap-1 hover:underline"
                  aria-label={`${b.name} Website besuchen`}
                >
                  <ExternalLink size={11} aria-hidden="true" />
                  Website
                </a>
              )}
            </div>
          ))}
        </div>
      )}

      {/* CTA + Newsletter */}
      <div className="rounded-2xl border border-accent-purple/30 bg-accent-purple/5 p-6 md:p-8">
        <h2 className="font-display text-xl font-black text-primary mb-1">Kein Event verpassen</h2>
        <p className="text-secondary text-sm mb-4">Trag dich ein und wir informieren dich per Mail wenn neue Events anstehen.</p>
        <NewsletterSignup />
      </div>
    </div>
  )
}
