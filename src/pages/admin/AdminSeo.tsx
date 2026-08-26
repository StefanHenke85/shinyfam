import { useState } from 'react'
import { Search, CheckCircle, XCircle, AlertCircle, RefreshCw, ExternalLink, BookOpen } from 'lucide-react'

interface SeoCheck {
  id: string
  label: string
  ok: boolean
  info: string
}

interface SeoResult {
  score: number
  checks: SeoCheck[]
  loadMs: number
}

export default function AdminSeo({ token }: { token: string }) {
  const [result, setResult] = useState<SeoResult | null>(null)
  const [loading, setLoading] = useState(false)
  const [ran, setRan] = useState(false)

  async function runCheck() {
    setLoading(true)
    try {
      const r = await fetch('/api/seo/check', { headers: { Authorization: `Bearer ${token}` } })
      setResult(await r.json())
      setRan(true)
    } finally {
      setLoading(false)
    }
  }

  const scoreColor = !result ? '' :
    result.score >= 80 ? 'text-green-500' :
    result.score >= 60 ? 'text-yellow-500' : 'text-red-500'

  const scoreBg = !result ? '' :
    result.score >= 80 ? 'bg-green-500' :
    result.score >= 60 ? 'bg-yellow-500' : 'bg-red-500'

  const failed = result?.checks.filter(c => !c.ok) ?? []
  const passed = result?.checks.filter(c => c.ok) ?? []

  return (
    <div>
      <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
        <h2 className="font-display text-2xl font-bold section-title flex items-center gap-2">
          <Search size={22} className="text-accent-purple" /> SEO Analyse
        </h2>
        <button type="button" onClick={runCheck} disabled={loading}
          className="btn-primary flex items-center gap-2">
          <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
          {loading ? 'Analysiere…' : ran ? 'Erneut prüfen' : 'Analyse starten'}
        </button>
      </div>

      {/* Google Search Console Anleitung */}
      <div className="admin-card mb-4 border-accent-purple/30">
        <h3 className="font-semibold section-title mb-3 flex items-center gap-2">
          <BookOpen size={16} className="text-accent-purple" /> Google Search Console einrichten (einmalig, 5 Min.)
        </h3>
        <ol className="flex flex-col gap-3 text-sm">
          <li className="flex gap-3">
            <span className="w-6 h-6 rounded-full bg-accent-purple/20 text-accent-purple font-bold text-xs flex items-center justify-center shrink-0 mt-0.5">1</span>
            <span className="text-secondary">
              <a href="https://search.google.com/search-console" target="_blank" rel="noopener noreferrer"
                className="text-accent-purple hover:underline font-medium">search.google.com/search-console</a> öffnen → <strong className="text-primary">Eigentum hinzufügen</strong> → URL-Präfix → <code className="bg-bg-raised px-1 rounded text-xs">https://shinyfam.de</code>
            </span>
          </li>
          <li className="flex gap-3">
            <span className="w-6 h-6 rounded-full bg-accent-purple/20 text-accent-purple font-bold text-xs flex items-center justify-center shrink-0 mt-0.5">2</span>
            <span className="text-secondary">Verifizierungsmethode <strong className="text-primary">"HTML-Tag"</strong> wählen → den <code className="bg-bg-raised px-1 rounded text-xs">content="…"</code> Wert kopieren</span>
          </li>
          <li className="flex gap-3">
            <span className="w-6 h-6 rounded-full bg-accent-purple/20 text-accent-purple font-bold text-xs flex items-center justify-center shrink-0 mt-0.5">3</span>
            <span className="text-secondary">Stefan Bescheid geben — er trägt den Code in <code className="bg-bg-raised px-1 rounded text-xs">index.html</code> ein und deployt (2 Min.)</span>
          </li>
          <li className="flex gap-3">
            <span className="w-6 h-6 rounded-full bg-accent-purple/20 text-accent-purple font-bold text-xs flex items-center justify-center shrink-0 mt-0.5">4</span>
            <span className="text-secondary">In der Console: <strong className="text-primary">Sitemap einreichen</strong> → <code className="bg-bg-raised px-1 rounded text-xs">sitemap.xml</code> eingeben → fertig</span>
          </li>
        </ol>
        <div className="mt-4 p-3 bg-accent-gold/10 border border-accent-gold/30 rounded-xl flex items-start gap-2">
          <AlertCircle size={14} className="text-accent-gold shrink-0 mt-0.5" />
          <p className="text-xs text-secondary">Nach der Einrichtung dauert es 2–4 Wochen bis Google alle Seiten indexiert hat. Die Console zeigt dann Klicks, Impressionen und welche Keywords Besucher bringen.</p>
        </div>
        <div className="flex gap-2 mt-3 flex-wrap">
          <a href="https://search.google.com/search-console" target="_blank" rel="noopener noreferrer"
            className="btn-primary text-xs flex items-center gap-1.5">
            <ExternalLink size={12} /> Search Console öffnen
          </a>
          <a href="https://search.google.com/search-console/sitemaps?resource_id=https://shinyfam.de/" target="_blank" rel="noopener noreferrer"
            className="btn-outline text-xs flex items-center gap-1.5">
            <ExternalLink size={12} /> Sitemap direkt einreichen
          </a>
        </div>
      </div>

      {!ran && !loading && (
        <div className="admin-card text-center py-12">
          <Search size={48} className="mx-auto mb-4 text-muted opacity-40" />
          <p className="section-title font-semibold mb-1">Live-SEO-Analyse</p>
          <p className="text-secondary text-sm max-w-sm mx-auto">
            Prüft die echte shinyfam.de auf Ladezeit, Meta-Tags, Schema, Sitemap, Keywords und mehr.
          </p>
        </div>
      )}

      {loading && (
        <div className="admin-card text-center py-12">
          <RefreshCw size={36} className="mx-auto mb-4 text-accent-purple animate-spin" />
          <p className="text-secondary text-sm">Analysiere shinyfam.de…</p>
        </div>
      )}

      {result && !loading && (
        <div className="flex flex-col gap-4">
          {/* Score */}
          <div className="admin-card flex items-center gap-6 flex-wrap">
            <div className="text-center">
              <div className={`font-display text-6xl font-black ${scoreColor}`}>{result.score}</div>
              <div className="text-muted text-xs mt-1">von 100</div>
            </div>
            <div className="flex-1 min-w-0">
              <p className="section-title font-bold text-lg mb-2">
                {result.score >= 80 ? '🎉 Sehr gut!' : result.score >= 60 ? '👍 Solide Basis' : '⚠️ Verbesserungsbedarf'}
              </p>
              <div className="w-full bg-bg-raised rounded-full h-3 overflow-hidden">
                <div className={`h-3 rounded-full transition-all ${scoreBg}`} style={{ width: `${result.score}%` }} />
              </div>
              <p className="text-muted text-xs mt-2">{passed.length} von {result.checks.length} Prüfungen bestanden</p>
            </div>
          </div>

          {/* Probleme */}
          {failed.length > 0 && (
            <div className="admin-card">
              <h3 className="font-semibold section-title mb-3 flex items-center gap-2">
                <XCircle size={16} className="text-red-500" /> Verbesserungspotenzial ({failed.length})
              </h3>
              <div className="flex flex-col gap-2">
                {failed.map(c => (
                  <div key={c.id} className="flex items-start gap-3 p-3 bg-red-500/5 border border-red-500/20 rounded-xl">
                    <XCircle size={16} className="text-red-500 shrink-0 mt-0.5" />
                    <div>
                      <p className="font-medium text-sm section-title">{c.label}</p>
                      <p className="text-secondary text-xs mt-0.5">{c.info}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Bestanden */}
          <div className="admin-card">
            <h3 className="font-semibold section-title mb-3 flex items-center gap-2">
              <CheckCircle size={16} className="text-green-500" /> Bestanden ({passed.length})
            </h3>
            <div className="flex flex-col gap-2">
              {passed.map(c => (
                <div key={c.id} className="flex items-start gap-3 p-3 bg-green-500/5 border border-green-500/20 rounded-xl">
                  <CheckCircle size={16} className="text-green-500 shrink-0 mt-0.5" />
                  <div>
                    <p className="font-medium text-sm section-title">{c.label}</p>
                    <p className="text-secondary text-xs mt-0.5">{c.info}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Externe Tools */}
          <div className="admin-card">
            <h3 className="font-semibold section-title mb-3 flex items-center gap-2">
              <AlertCircle size={16} className="text-accent-orange" /> Weitere kostenlose Tools
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
              {[
                ['Google Search Console', 'https://search.google.com/search-console', 'Indexierung & Crawling-Fehler'],
                ['Google PageSpeed', 'https://pagespeed.web.dev/?url=https://shinyfam.de', 'Core Web Vitals & Performance'],
                ['Google Rich Results', 'https://search.google.com/test/rich-results?url=https://shinyfam.de', 'Schema.org Validierung'],
                ['Mobile-Friendly Test', 'https://search.google.com/test/mobile-friendly?url=https://shinyfam.de', 'Mobile-Optimierung prüfen'],
              ].map(([label, url, desc]) => (
                <a key={url} href={url} target="_blank" rel="noopener noreferrer"
                  className="flex items-center gap-3 p-3 bg-bg-raised rounded-xl border border-theme hover:border-accent-purple/50 transition-colors group">
                  <ExternalLink size={14} className="text-muted group-hover:text-accent-purple shrink-0" />
                  <div>
                    <p className="text-sm font-medium section-title">{label}</p>
                    <p className="text-xs text-muted">{desc}</p>
                  </div>
                </a>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
