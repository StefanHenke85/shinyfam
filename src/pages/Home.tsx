import { useEffect, useState, useRef, useCallback } from 'react'
import { Link } from 'react-router-dom'
import { Sparkles, CalendarDays, Palette, ChevronRight, ChevronLeft, Users, Zap, MapPin, Clock, ExternalLink } from 'lucide-react'
import EventCard from '../components/EventCard'
import YTIcon from '../components/YTIcon'
import CountdownTimer from '../components/CountdownTimer'
import { useTheme } from '../contexts/ThemeContext'
import type { TCGEvent } from '../types'

interface YTVideo { id: string; title: string }
interface Artwork { id: string; title: string; image_url: string }

export default function Home() {
  const { t } = useTheme()
  const [events, setEvents] = useState<TCGEvent[]>([])
  const [videos, setVideos] = useState<YTVideo[]>([])
  const [artworks, setArtworks] = useState<Artwork[]>([])
  const [artIdx, setArtIdx] = useState(0)
  const [flipping, setFlipping] = useState<number[]>([])
  const artTimer = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => {
    fetch('/api/events')
      .then(r => r.json())
      .then(data => setEvents(Array.isArray(data) ? data : []))
      .catch(() => {})
    fetch('/api/youtube-feed')
      .then(r => r.json())
      .then(data => setVideos(Array.isArray(data) ? data : []))
      .catch(() => {})
    fetch('/api/artworks')
      .then(r => r.json())
      .then(data => setArtworks(Array.isArray(data) ? data : []))
      .catch(() => {})
  }, [])

  const navigate = useCallback((dir: 1 | -1) => {
    if (artTimer.current) clearInterval(artTimer.current)
    const visible = [0, 1, 2]
    setFlipping(visible)
    setTimeout(() => {
      setArtIdx(i => (i + dir + artworks.length) % artworks.length)
      setFlipping([])
    }, 300)
  }, [artworks.length])

  useEffect(() => {
    if (artworks.length < 2) return
    artTimer.current = setInterval(() => navigate(1), 4000)
    return () => { if (artTimer.current) clearInterval(artTimer.current) }
  }, [artworks.length, navigate])

  const goTo = (idx: number) => {
    if (artTimer.current) clearInterval(artTimer.current)
    setFlipping([0, 1, 2])
    setTimeout(() => { setArtIdx(idx); setFlipping([]) }, 300)
  }

  const now = new Date()
  const sorted = [...events].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
  const upcoming = sorted.filter(e => new Date(e.date) >= now)
  const nextEvent = upcoming[0] ?? null
  const moreEvents = upcoming.slice(1, 3)

  return (
    <div>
      {/* Hero */}
      <section className="hero-section relative min-h-screen flex items-center justify-center overflow-hidden" aria-label="Hero">
        <div className="hero-blob hero-blob-1" aria-hidden="true" />
        <div className="hero-blob hero-blob-2" aria-hidden="true" />
        <div className="hero-blob hero-blob-3" aria-hidden="true" />
        <div className="tcg-card-deco tcg-card-deco-1 tcg-card-deco-pos-1" aria-hidden="true">🃏</div>
        <div className="tcg-card-deco tcg-card-deco-2 tcg-card-deco-pos-2" aria-hidden="true">⚡</div>
        <div className="tcg-card-deco tcg-card-deco-3 tcg-card-deco-pos-3" aria-hidden="true">🌟</div>
        <div className="tcg-card-deco tcg-card-deco-pos-4" aria-hidden="true">🔥</div>

        <div className="relative z-10 text-center px-4 max-w-2xl mx-auto">
          <div className="hero-logo mx-auto mb-6" aria-hidden="true">
            <img src="/logo.jpg" alt="" className="w-full h-full object-contain p-3" />
          </div>
          <div className="tcg-badge mb-4">
            <Zap size={11} aria-hidden="true" />
            Pokémon, One Piece &amp; andere TCG Community
          </div>
          <h1 className="font-display text-5xl md:text-7xl font-black mb-4 section-title">
            <span className="gradient-text">ShinyFam</span>
          </h1>
          <p className="text-secondary text-lg md:text-xl mb-8 leading-relaxed max-w-lg mx-auto">
            {t('hero.tagline')}
          </p>
          <div className="flex flex-wrap gap-3 justify-center mb-10">
            <Link to="/events" className="btn-primary">
              <CalendarDays size={16} aria-hidden="true" />
              {t('hero.events')}
            </Link>
            <Link to="/artwork" className="btn-outline">
              <Palette size={16} aria-hidden="true" />
              {t('hero.artwork')}
            </Link>
          </div>

          <div className="tcg-stats-bar inline-flex">
            <div className="tcg-stat">
              <span className="tcg-stat-value">🏆 TCG</span>
              <span className="tcg-stat-label">{t('home.turniereLabel')}</span>
            </div>
            <div className="tcg-stats-divider" aria-hidden="true" />
            <div className="tcg-stat">
              <span className="tcg-stat-value">🎨 Art</span>
              <span className="tcg-stat-label">{t('home.artLabel')}</span>
            </div>
            <div className="tcg-stats-divider" aria-hidden="true" />
            <div className="tcg-stat">
              <Users size={20} className="tcg-stat-icon" aria-hidden="true" />
              <span className="tcg-stat-label">Community</span>
            </div>
          </div>
        </div>

        <div className="absolute bottom-8 left-1/2 -translate-x-1/2 flex flex-col items-center gap-1 text-muted text-xs" aria-hidden="true">
          <ChevronRight size={14} className="rotate-90" />
          <span>Scroll</span>
        </div>
      </section>

      {nextEvent && (
        <section className="next-event-section" aria-labelledby="next-event-heading">
          <div className="max-w-6xl mx-auto px-4 py-16">
            <div className="next-event-card">
              <div className="next-event-image-wrap">
                {nextEvent.imageUrl ? (
                  <img
                    src={nextEvent.imageUrl}
                    alt={`ShinyFam Stand bei ${nextEvent.title}`}
                    className="next-event-image"
                  />
                ) : (
                  <div className="next-event-placeholder">
                    <div className="next-event-placeholder-inner">
                      <img src="/logo.jpg" alt="ShinyFam" className="next-event-placeholder-logo" />
                      <p className="text-primary font-display font-black text-xl mt-3">ShinyFam</p>
                      <p className="text-secondary text-sm mt-1">{nextEvent.title}</p>
                    </div>
                  </div>
                )}
                <div className="next-event-image-badge">
                  <Sparkles size={12} aria-hidden="true" />
                  {t('home.nextEvent')}
                </div>
              </div>
              <div className="next-event-info">
                <p className="next-event-eyebrow">
                  <MapPin size={13} aria-hidden="true" />
                  {t('home.whereNext')}
                </p>
                <h2 id="next-event-heading" className="font-display text-2xl md:text-3xl font-black section-title mb-4">
                  {nextEvent.title}
                </h2>
                <dl className="next-event-meta">
                  <div className="next-event-meta-row">
                    <dt><CalendarDays size={15} className="text-accent-orange" aria-label="Datum" /></dt>
                    <dd className="text-secondary text-sm">
                      {new Date(nextEvent.date).toLocaleDateString('de-DE', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' })}
                    </dd>
                  </div>
                  <div className="next-event-meta-row">
                    <dt><Clock size={15} className="text-accent-purple" aria-label="Uhrzeit" /></dt>
                    <dd className="text-secondary text-sm">
                      {new Date(nextEvent.date).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })} {t('events.timeUnit')}
                    </dd>
                  </div>
                  <div className="next-event-meta-row">
                    <dt><MapPin size={15} className="text-accent-pink" aria-label="Ort" /></dt>
                    <dd className="text-secondary text-sm flex flex-col gap-0.5">
                      <span>{nextEvent.location && <>{nextEvent.location}, </>}{nextEvent.city}</span>
                      {nextEvent.address && <span className="text-muted text-xs">{nextEvent.address}</span>}
                    </dd>
                  </div>
                </dl>
                {/* Kartenvorschau */}
                <div className="map-preview-wrap">
                  <iframe
                    title="Standort"
                    width="100%"
                    height="160"
                    className="map-preview-iframe"
                    referrerPolicy="no-referrer-when-downgrade"
                    src={`https://maps.google.com/maps?q=${encodeURIComponent(`${nextEvent.location}, ${nextEvent.address}, ${nextEvent.city}`)}&output=embed&z=15`}
                  />
                </div>
                <a
                  href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${nextEvent.location}, ${nextEvent.address}, ${nextEvent.city}`)}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-accent-purple text-xs flex items-center gap-1 hover:underline mb-4 w-fit"
                >
                  <ExternalLink size={11} aria-hidden="true" />
                  {t('events.mapsOpen')}
                </a>
                <div className="next-event-countdown">
                  <p className="text-xs text-muted uppercase tracking-wider mb-3 flex items-center gap-1">
                    <Clock size={11} aria-hidden="true" />
                    {t('home.countdownLabel')}
                  </p>
                  <CountdownTimer targetDate={nextEvent.date} />
                </div>
                {nextEvent.ticketUrl ? (
                  <a href={nextEvent.ticketUrl} target="_blank" rel="noopener noreferrer" className="btn-primary mt-4 inline-flex">
                    {t('home.tickets')}
                  </a>
                ) : nextEvent.entryFee ? (
                  <div className="mt-4">
                    <p className="text-sm font-semibold section-title">Eintritt: {nextEvent.entryFee.toFixed(2)} €</p>
                    <p className="text-xs text-muted">Kinder unter 16 Jahren frei</p>
                  </div>
                ) : null}
                {nextEvent.partners && nextEvent.partners.length > 0 && (
                  <div className="mt-5 pt-4 border-t border-theme">
                    <p className="text-xs text-muted uppercase tracking-wider mb-3">{t('events.partner')}</p>
                    <div className="flex flex-wrap gap-3 items-center">
                      {nextEvent.partners.map((p, i) =>
                        p.logoUrl ? (
                          p.website ? (
                            <a key={i} href={p.website} target="_blank" rel="noopener noreferrer" aria-label={p.name}>
                              <img src={p.logoUrl} alt={p.name} className="h-10 w-auto max-w-[120px] object-contain opacity-80 hover:opacity-100 transition-opacity" />
                            </a>
                          ) : (
                            <img key={i} src={p.logoUrl} alt={p.name} className="h-10 w-auto max-w-[120px] object-contain opacity-80" />
                          )
                        ) : null
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </section>
      )}

      {moreEvents.length > 0 && (
        <>
          <div className="section-divider" />
          <section className="max-w-6xl mx-auto px-4 py-16" aria-labelledby="events-heading">
            <div className="flex items-center justify-between mb-8 flex-wrap gap-4">
              <h2 id="events-heading" className="font-display text-3xl font-bold section-title flex items-center gap-2">
                <Sparkles size={24} className="text-accent-gold" aria-hidden="true" />
                {t('home.upcomingEvents')}
              </h2>
              <Link to="/events" className="btn-outline text-sm hidden md:inline-flex items-center gap-1">
                {t('home.allEventsLink')} <ChevronRight size={14} aria-hidden="true" />
              </Link>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {moreEvents.map((event: TCGEvent) => (
                <EventCard key={event.id} event={event} />
              ))}
            </div>
            <div className="text-center mt-6">
              <Link to="/events" className="btn-outline text-sm">{t('home.allEvents')}</Link>
            </div>
          </section>
        </>
      )}

      <div className="section-divider" />

      {videos.length > 0 && (
        <section className="max-w-6xl mx-auto px-4 py-16" aria-labelledby="yt-heading">
          <div className="flex items-center justify-between mb-8 flex-wrap gap-4">
            <div>
              <h2 id="yt-heading" className="font-display text-3xl font-bold section-title flex items-center gap-2">
                <YTIcon size={24} className="text-red-500" />
                {t('home.ourVideos')}
              </h2>
              <p className="text-secondary mt-1 text-sm">{t('home.videosub')}</p>
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {videos.map((v) => (
              <div key={v.id} className="card rounded-2xl overflow-hidden">
                <div className="yt-embed-wrap">
                  <iframe
                    src={`https://www.youtube-nocookie.com/embed/${v.id}`}
                    title={v.title}
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                    allowFullScreen
                  />
                </div>
                <p className="p-3 text-sm font-medium section-title truncate">{v.title}</p>
              </div>
            ))}
          </div>
        </section>
      )}

      <div className="section-divider" />

      <section className="max-w-6xl mx-auto px-4 py-16" aria-labelledby="artwork-heading">
        <div className="text-center mb-10">
          <h2 id="artwork-heading" className="font-display text-3xl font-bold section-title flex items-center justify-center gap-2 mb-2">
            <Palette size={24} className="text-accent-pink" aria-hidden="true" />
            {t('home.artworks')}
          </h2>
          <p className="text-secondary max-w-xl mx-auto text-sm">{t('home.artworksub')}</p>
        </div>

        {artworks.length === 0 ? (
          <div className="card rounded-2xl p-10 text-center text-muted mb-8">
            <Palette size={40} className="mx-auto mb-3 opacity-30" aria-hidden="true" />
            <p>{t('home.checkBack')}</p>
          </div>
        ) : (
          <>
            <div className="relative">
              {/* Prev */}
              {artworks.length > 3 && (
                <button type="button" onClick={() => navigate(-1)} aria-label={t('artwork.prevArrow')}
                  className="absolute left-0 top-1/2 -translate-y-1/2 z-10 icon-btn bg-bg-surface border border-theme shadow-lg -translate-x-2">
                  <ChevronLeft size={20} aria-hidden="true" />
                </button>
              )}

              <div className="art-slider-wrap">
                {[-1, 0, 1].map((offset, slotIdx) => {
                  const idx = (artIdx + offset + artworks.length) % artworks.length
                  const art = artworks[idx]
                  const isCenter = offset === 0
                  const isFlipping = flipping.includes(slotIdx)
                  return (
                    <div
                      key={slotIdx}
                      className={`art-card-scene ${isCenter ? 'art-card-center' : 'art-card-side'}`}
                      onClick={() => !isCenter && navigate(offset as 1 | -1)}
                    >
                      <div className={`art-card-inner${isFlipping ? ' is-flipping' : ''}`}>
                        <div className="art-card-front">
                          <img src={art.image_url} alt={art.title} className="art-card-img" />
                          <div className="art-card-label">{art.title}</div>
                        </div>
                        <div className="art-card-back">
                          <img src="/logo.jpg" alt="ShinyFam" className="art-card-back-logo" />
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>

              {/* Next */}
              {artworks.length > 3 && (
                <button type="button" onClick={() => navigate(1)} aria-label={t('artwork.nextArrow')}
                  className="absolute right-0 top-1/2 -translate-y-1/2 z-10 icon-btn bg-bg-surface border border-theme shadow-lg translate-x-2">
                  <ChevronRight size={20} aria-hidden="true" />
                </button>
              )}
            </div>

            {/* Dots */}
            <div className="art-slider-dots mb-8">
              {artworks.map((_, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => goTo(i)}
                  aria-label={`Kunstwerk ${i + 1}`}
                  className={`art-slider-dot${i === artIdx ? ' active' : ''}`}
                />
              ))}
            </div>
          </>
        )}

        <div className="text-center">
          <Link to="/artwork" className="btn-primary">
            {t('home.artworkBtn')}
          </Link>
        </div>
      </section>

    </div>
  )
}
