import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { MapPin, Calendar, Tag, Ticket, Clock, ExternalLink, Users } from 'lucide-react'
import { format } from 'date-fns'
import { de, enUS } from 'date-fns/locale'
import type { TCGEvent } from '../types'
import CountdownTimer from './CountdownTimer'
import YouTubeEmbed from './YouTubeEmbed'
import EventInquiryForm from './EventInquiryForm'
import { useTheme } from '../contexts/ThemeContext'

interface Props { event: TCGEvent }

// Online-Ticketverkauf (tickets.mjs): einmal pro Seitenaufruf laden
type ShopEntry = { eventId: string; slug: string; visitorEnabled: boolean; dealerEnabled: boolean; open: boolean }
let shopPromise: Promise<ShopEntry[]> | null = null
function useTicketShop(eventId: string) {
  const [entry, setEntry] = useState<ShopEntry | null>(null)
  useEffect(() => {
    shopPromise ||= fetch('/api/tickets/shop').then(r => r.json()).then(d => (Array.isArray(d) ? d : [])).catch(() => [])
    shopPromise.then(list => setEntry(list.find(e => e.eventId === eventId && e.open) || null))
  }, [eventId])
  return entry
}

export default function EventCard({ event }: Props) {
  const { lang, t } = useTheme()
  const [showInquiry, setShowInquiry] = useState(false)
  const shop = useTicketShop(event.id)
  const eventDate = new Date(event.date)
  const endDate = event.endDate ? new Date(event.endDate) : null
  const isPast = eventDate < new Date()
  const locale = lang === 'de' ? de : enUS

  const mapsQuery = encodeURIComponent(`${event.location}, ${event.address ?? ''}, ${event.city}`)
  const mapsUrl = `https://www.google.com/maps/search/?api=1&query=${mapsQuery}`
  const mapsEmbed = `https://maps.google.com/maps?q=${mapsQuery}&output=embed&z=15`

  return (
    <article
      className={`card card-hover rounded-2xl overflow-hidden${isPast ? ' opacity-60' : ''}`}
      aria-label={`Event: ${event.title}`}
    >
      <div className="h-1.5 bg-gradient-brand" aria-hidden="true" />
      <div className="p-5">
        <div className="flex flex-wrap gap-1.5 mb-3" role="list" aria-label="Kategorien">
          {event.tags.map((tag) => (
            <span key={tag} className="tag" role="listitem">
              <Tag size={10} aria-hidden="true" />{tag}
            </span>
          ))}
          {isPast && <span className="tag tag-muted" role="listitem">{t('events.past.badge')}</span>}
        </div>

        <h3 className="text-lg font-display font-bold section-title mb-3">{event.title}</h3>

        <dl className="flex flex-col gap-1.5 mb-4">
          <div className="flex items-center gap-2 text-secondary text-sm">
            <dt className="sr-only">{t('events.date.label')}</dt>
            <Calendar size={13} className="text-accent-orange shrink-0" aria-hidden="true" />
            <dd>
              {format(eventDate, 'EEEE, dd. MMMM yyyy – HH:mm', { locale })}
              {endDate && <> – {format(endDate, 'HH:mm', { locale })}</>}
              {' '}{t('events.timeUnit')}
            </dd>
          </div>
          {event.schedule && event.schedule.length > 0 && (
            <div className="flex items-start gap-2 text-secondary text-sm">
              <dt className="sr-only">Zeitplan</dt>
              <Clock size={13} className="text-accent-purple shrink-0 mt-0.5" aria-hidden="true" />
              <dd className="flex flex-col gap-0.5">
                {event.schedule.map((day, i) => (
                  <span key={i}><span className="font-medium text-primary">{day.label}:</span> {day.start} – {day.end} Uhr</span>
                ))}
              </dd>
            </div>
          )}
          <div className="flex items-start gap-2 text-secondary text-sm">
            <dt className="sr-only">{t('events.location.label')}</dt>
            <MapPin size={13} className="text-accent-pink shrink-0 mt-0.5" aria-hidden="true" />
            <dd className="flex flex-col gap-0.5">
              <span>{event.location}</span>
              {event.address && <span className="text-muted text-xs">{event.address}, {event.city}</span>}
            </dd>
          </div>
        </dl>

        <div className="map-preview-wrap">
          <iframe
            title="Standort"
            width="100%"
            height="160"
            className="map-preview-iframe"
            referrerPolicy="no-referrer-when-downgrade"
            src={mapsEmbed}
          />
        </div>
        <a
          href={mapsUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="text-accent-purple text-xs flex items-center gap-1 hover:underline mb-4 w-fit"
        >
          <ExternalLink size={11} aria-hidden="true" />
          {t('events.mapsOpen')}
        </a>

        {!isPast && (
          <div className="mb-4">
            <p className="text-xs text-muted uppercase tracking-wider mb-2 flex items-center gap-1">
              <Clock size={10} aria-hidden="true" />
              {t('events.countdown')}
            </p>
            <CountdownTimer targetDate={event.date} />
          </div>
        )}

        <p className="text-secondary text-sm leading-relaxed mb-4">{event.description}</p>

        {event.youtubeVideoId && (
          <div className="mb-4">
            <YouTubeEmbed videoId={event.youtubeVideoId} title={event.title} />
          </div>
        )}

        {/* Partner */}
        {event.partners && event.partners.length > 0 && (
          <div className="mb-4 border-t border-theme pt-3">
            <p className="text-xs text-muted uppercase tracking-wider mb-2">{t('events.partner')}</p>
            <div className="flex flex-wrap gap-3 items-center">
              {event.partners.map((p, i) =>
                p.logoUrl ? (
                  p.website ? (
                    <a key={i} href={p.website} target="_blank" rel="noopener noreferrer" aria-label={p.name}>
                      <img src={p.logoUrl} alt={p.name} className="h-8 w-auto max-w-[80px] object-contain opacity-80 hover:opacity-100 transition-opacity" />
                    </a>
                  ) : (
                    <img key={i} src={p.logoUrl} alt={p.name} className="h-8 w-auto max-w-[80px] object-contain opacity-80" />
                  )
                ) : null
              )}
            </div>
          </div>
        )}

        {!isPast && shop?.visitorEnabled ? (
          <Link to={`/tickets/${shop.slug}`} className="btn-primary text-sm w-full justify-center">
            <Ticket size={14} aria-hidden="true" />
            Tickets online kaufen{event.entryFee ? ` · ${event.entryFee.toFixed(2)} €` : ''}
          </Link>
        ) : event.ticketUrl ? (
          <a href={event.ticketUrl} target="_blank" rel="noopener noreferrer"
            className="btn-primary text-sm w-full justify-center">
            <Ticket size={14} aria-hidden="true" />
            {t('events.tickets')}
          </a>
        ) : event.entryFee ? (
          <div className="text-center py-1">
            <p className="text-sm font-semibold section-title">Eintritt: {event.entryFee.toFixed(2)} €</p>
            <p className="text-xs text-muted">Kinder unter 16 Jahren frei</p>
          </div>
        ) : (
          <p className="text-xs text-muted text-center py-1">{t('events.free')}</p>
        )}

        {!isPast && (
          <>
            {event.maxVendors != null && (
              <div className="mt-3 mb-1">
                <div className="flex items-center justify-between text-xs mb-1">
                  <span className="text-muted flex items-center gap-1"><Users size={11} aria-hidden="true" /> Händlerplätze</span>
                  <span className="font-semibold text-primary">{event.maxVendors} verfügbar</span>
                </div>
                <div className="h-1.5 rounded-full bg-bg-raised overflow-hidden">
                  <div className="h-full rounded-full bg-accent-purple transition-all w-0" />
                </div>
              </div>
            )}
            {shop?.dealerEnabled && (
              <Link to={`/tickets/${shop.slug}`} className="btn-primary text-sm w-full justify-center mt-2 flex items-center gap-2">
                <Users size={13} aria-hidden="true" />
                Händlerstand online buchen
              </Link>
            )}
            <button
              type="button"
              onClick={() => setShowInquiry(v => !v)}
              className="btn-outline text-sm w-full justify-center mt-2 flex items-center gap-2"
            >
              <Users size={13} aria-hidden="true" />
              Als Händler anfragen
            </button>
            {showInquiry && (
              <EventInquiryForm
                eventName={event.title}
                eventDate={event.date}
                eventEndDate={event.endDate}
                priceTiers={event.priceTiers}
                requireDay1WithDay2={event.requireDay1WithDay2}
                onClose={() => setShowInquiry(false)}
              />
            )}
          </>
        )}
      </div>
    </article>
  )
}
