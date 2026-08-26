import { useState, useEffect } from 'react'
import { BarChart2, RefreshCw, TrendingUp, Eye, FileText, Globe } from 'lucide-react'

interface Stats {
  total: number
  byPage: { path: string; c: number }[]
  byDay: { day: string; c: number }[]
  byRef: { referrer: string; c: number }[]
}

export default function AdminAnalytics({ token }: { token: string }) {
  const [stats, setStats] = useState<Stats | null>(null)
  const [days, setDays] = useState(30)
  const [loading, setLoading] = useState(false)

  async function load() {
    setLoading(true)
    try {
      const r = await fetch(`/api/analytics/stats?days=${days}`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      const data = await r.json()
      setStats(data)
    } catch {
      // ignore
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [days])

  const maxDay = stats ? Math.max(...stats.byDay.map(d => d.c), 1) : 1

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h2 className="section-title text-xl font-bold font-display flex items-center gap-2">
          <BarChart2 size={20} /> Besucher-Statistik
        </h2>
        <div className="flex items-center gap-2">
          <select
            value={days}
            onChange={e => setDays(Number(e.target.value))}
            className="admin-input text-sm py-1 px-2"
          >
            <option value={7}>7 Tage</option>
            <option value={30}>30 Tage</option>
            <option value={90}>90 Tage</option>
          </select>
          <button
            type="button"
            onClick={load}
            disabled={loading}
            className="p-1.5 rounded-lg bg-bg-raised border border-theme hover:bg-bg-hover transition-colors"
            title="Aktualisieren"
          >
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
          </button>
        </div>
      </div>

      {!stats ? (
        <div className="text-muted text-center py-16">{loading ? 'Lade…' : 'Keine Daten'}</div>
      ) : (
        <div className="space-y-6">
          {/* KPI */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="rounded-xl border border-theme bg-bg-raised p-4 flex items-center gap-3">
              <Eye size={22} className="text-accent-purple" />
              <div>
                <p className="text-2xl font-bold font-display section-title">{stats.total.toLocaleString('de-DE')}</p>
                <p className="text-xs text-muted">Seitenaufrufe gesamt</p>
              </div>
            </div>
            <div className="rounded-xl border border-theme bg-bg-raised p-4 flex items-center gap-3">
              <TrendingUp size={22} className="text-accent-gold" />
              <div>
                <p className="text-2xl font-bold font-display section-title">
                  {stats.byDay.length > 0 ? Math.round(stats.total / stats.byDay.length) : 0}
                </p>
                <p className="text-xs text-muted">Ø pro Tag</p>
              </div>
            </div>
            <div className="rounded-xl border border-theme bg-bg-raised p-4 flex items-center gap-3">
              <FileText size={22} className="text-accent-pink" />
              <div>
                <p className="text-2xl font-bold font-display section-title">{stats.byPage.length}</p>
                <p className="text-xs text-muted">verschiedene Seiten</p>
              </div>
            </div>
          </div>

          {/* Verlauf */}
          {stats.byDay.length > 0 && (
            <div className="rounded-xl border border-theme bg-bg-raised p-4">
              <h3 className="text-sm font-semibold text-muted uppercase tracking-wider mb-4">Verlauf</h3>
              <div className="flex items-end gap-1 h-32">
                {stats.byDay.map(d => (
                  <div key={d.day} className="flex-1 flex flex-col items-center gap-1 min-w-0" title={`${d.day}: ${d.c}`}>
                    <div
                      className="w-full rounded-sm bg-accent-purple/70 hover:bg-accent-purple transition-colors"
                      style={{ height: `${Math.max(4, (d.c / maxDay) * 120)}px` }}
                    />
                    {stats.byDay.length <= 14 && (
                      <span className="text-[9px] text-muted truncate w-full text-center">
                        {d.day.slice(5)}
                      </span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Top Seiten */}
            <div className="rounded-xl border border-theme bg-bg-raised p-4">
              <h3 className="text-sm font-semibold text-muted uppercase tracking-wider mb-3 flex items-center gap-1">
                <FileText size={13} /> Top Seiten
              </h3>
              {stats.byPage.length === 0 ? (
                <p className="text-muted text-sm">Keine Daten</p>
              ) : (
                <div className="space-y-2">
                  {stats.byPage.map(p => (
                    <div key={p.path} className="flex items-center gap-2">
                      <span className="text-sm text-secondary truncate flex-1">{p.path || '/'}</span>
                      <span className="text-sm font-mono font-semibold section-title">{p.c}</span>
                      <div className="w-16 h-1.5 rounded-full bg-bg-hover overflow-hidden">
                        <div
                          className="h-full rounded-full bg-accent-purple"
                          style={{ width: `${(p.c / (stats.byPage[0]?.c || 1)) * 100}%` }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Referrer */}
            <div className="rounded-xl border border-theme bg-bg-raised p-4">
              <h3 className="text-sm font-semibold text-muted uppercase tracking-wider mb-3 flex items-center gap-1">
                <Globe size={13} /> Herkunft (Referrer)
              </h3>
              {stats.byRef.length === 0 ? (
                <p className="text-muted text-sm">Direkte Aufrufe / kein Referrer</p>
              ) : (
                <div className="space-y-2">
                  {stats.byRef.map(r => (
                    <div key={r.referrer} className="flex items-center gap-2">
                      <span className="text-sm text-secondary truncate flex-1">{r.referrer}</span>
                      <span className="text-sm font-mono font-semibold section-title">{r.c}</span>
                      <div className="w-16 h-1.5 rounded-full bg-bg-hover overflow-hidden">
                        <div
                          className="h-full rounded-full bg-accent-gold"
                          style={{ width: `${(r.c / (stats.byRef[0]?.c || 1)) * 100}%` }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
