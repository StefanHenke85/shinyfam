import { MapPin, Calendar, Tag, Ticket, Clock, ExternalLink } from 'lucide-react'
import { format } from 'date-fns'
import { de, enUS } from 'date-fns/locale'
import type { TCGEvent } from '../types'
import CountdownTimer from './CountdownTimer'
import YouTubeEmbed from './YouTubeEmbed'
import { useTheme } from '../contexts/ThemeContext'

interface Props { event: TCGEvent }

export default function EventCard({ event }: Props) {
  const { lang, t } = useTheme()
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

        {event.ticketUrl ? (
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
      </div>
    </article>
  )
}
