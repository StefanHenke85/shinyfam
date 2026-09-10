import { useState, useEffect } from 'react'
import { CalendarDays, Filter, MapPin, Clock, Users } from 'lucide-react'
import EventCard from '../components/EventCard'
import { useTheme } from '../contexts/ThemeContext'
import type { TCGEvent } from '../types'

export default function Events() {
  const { t } = useTheme()
  const [events, setEvents] = useState<TCGEvent[]>([])
  const [activeTag, setActiveTag] = useState('Alle')
  const [showPast, setShowPast] = useState(false)

  useEffect(() => {
    fetch('/api/events')
      .then(r => r.json())
      .then(data => setEvents(Array.isArray(data) ? data : []))
      .catch(() => {})
  }, [])

  const now = new Date()
  const upcoming = events.filter(e => new Date(e.date) >= now)
  const past = events.filter(e => new Date(e.date) < now)
  const allTags = [t('events.filter.all'), ...Array.from(new Set(events.flatMap(e => e.tags)))]

  const filter = (list: TCGEvent[]) =>
    activeTag === t('events.filter.all') ? list : list.filter(e => e.tags.includes(activeTag))

  return (
    <div className="max-w-6xl mx-auto px-4 py-8 pt-24">
      {/* Schema.org Trade Time + alle dynamischen Events */}
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify({
        "@context": "https://schema.org", "@type": "Event",
        "name": "TCG Trade Time – ShinyFam",
        "description": "TCG Trade Time im Haus der Generationen in Rheinberg — jeden ersten Dienstag im Monat von 17:30 bis 20:30 Uhr.",
        "startDate": "2026-10-06T17:30:00+02:00",
        "eventSchedule": { "@type": "Schedule", "repeatFrequency": "P1M", "byDay": "Tuesday", "byMonthWeek": 1, "startTime": "17:30", "endTime": "20:30", "scheduleTimezone": "Europe/Berlin" },
        "location": { "@type": "Place", "name": "Haus der Generationen (HdG)", "address": { "@type": "PostalAddress", "streetAddress": "Grote Gerd 50", "postalCode": "47495", "addressLocality": "Rheinberg", "addressCountry": "DE" } },
        "organizer": { "@type": "Organization", "name": "ShinyFam", "url": "https://shinyfam.de" },
        "eventAttendanceMode": "https://schema.org/OfflineEventAttendanceMode",
        "eventStatus": "https://schema.org/EventScheduled"
      })}} />
      {upcoming.map(ev => (
        <script key={ev.id} type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify({
          "@context": "https://schema.org", "@type": "Event",
          "name": ev.title, "description": ev.description,
          "startDate": ev.date, ...(ev.endDate ? { "endDate": ev.endDate } : {}),
          "location": { "@type": "Place", "name": ev.location, "address": { "@type": "PostalAddress", "streetAddress": ev.address, "addressLocality": ev.city, "addressCountry": "DE" } },
          "organizer": { "@type": "Organization", "name": "ShinyFam", "url": "https://shinyfam.de" },
          "eventAttendanceMode": "https://schema.org/OfflineEventAttendanceMode",
          "eventStatus": "https://schema.org/EventScheduled",
          "url": "https://shinyfam.de/events",
          ...(ev.imageUrl ? { "image": ev.imageUrl } : {}),
          "offers": { "@type": "Offer", "price": ev.entryFee ?? "0", "priceCurrency": "EUR", "availability": "https://schema.org/InStock" }
        })}} />
      ))}

      <div className="rounded-2xl border border-accent-purple/30 bg-accent-purple/5 p-6 mb-10">
        <div className="flex flex-col md:flex-row items-start gap-6">
          <img
            src="/TradeTime.jpeg"
            alt="TCG Trade Time"
            className="rounded-xl object-cover w-full md:w-56 flex-shrink-0"
          />
          <div className="flex-1">
            <div className="flex items-center gap-3 mb-2">
              <div className="w-10 h-10 rounded-xl bg-accent-purple/20 flex items-center justify-center flex-shrink-0">
                <Users size={20} className="text-accent-purple" />
              </div>
              <h2 className="font-display text-xl font-black text-primary">TCG Trade Time</h2>
            </div>
            <p className="text-secondary text-sm mb-3">Tauscht, checkt und chattet mit uns! Bringt eure Binder mit und trefft andere Sammler aus der Region.</p>
            <div className="flex flex-wrap gap-4 text-sm mb-3">
              <div className="flex items-center gap-1.5 text-secondary">
                <Clock size={14} className="text-accent-purple flex-shrink-0" />
                <span><strong className="text-primary">Am ersten Dienstag im Monat · 17:30 – 20:30 Uhr</strong></span>
              </div>
              <div className="flex items-center gap-1.5 text-secondary">
                <MapPin size={14} className="text-accent-purple flex-shrink-0" />
                <span>Haus der Generationen · Grote Gerd 50 · 47495 Rheinberg</span>
              </div>
            </div>
            <span className="inline-block text-xs px-3 py-1 rounded-full bg-accent-gold/20 text-accent-gold font-semibold">
              Nächster Termin: {(() => {
                const now = new Date()
                const d = new Date(now.getFullYear(), now.getMonth(), 1)
                while (d.getDay() !== 2) d.setDate(d.getDate() + 1)
                if (d <= now) {
                  d.setMonth(d.getMonth() + 1); d.setDate(1)
                  while (d.getDay() !== 2) d.setDate(d.getDate() + 1)
                }
                return d.toLocaleDateString('de-DE', { day: '2-digit', month: 'long', year: 'numeric' })
              })()}
            </span>
          </div>
        </div>
      </div>

      <div className="mb-10">
        <h1 className="font-display text-4xl md:text-5xl font-black text-primary flex items-center gap-3 mb-2">
          <CalendarDays size={36} className="text-accent-gold" />
          {t('events.title')}
        </h1>
        <p className="text-secondary">
          {upcoming.length} {t('events.upcoming').toLowerCase()} · {past.length} {t('events.past').toLowerCase()}
        </p>
      </div>

      {allTags.length > 1 && (
        <div className="flex items-center gap-2 flex-wrap mb-8">
          <Filter size={14} className="text-muted" />
          {allTags.map((tag) => (
            <button
              key={tag}
              type="button"
              onClick={() => setActiveTag(tag)}
              className={`text-sm px-3 py-1 rounded-full border transition-colors ${
                activeTag === tag
                  ? 'bg-accent-purple border-accent-purple text-white'
                  : 'border-white/10 text-secondary hover:border-white/30 hover-primary'
              }`}
            >
              {tag}
            </button>
          ))}
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-12">
        {filter(upcoming).length === 0 ? (
          <div className="col-span-2 text-center py-16 text-muted">
            {t('events.noUpcoming')}
          </div>
        ) : (
          filter(upcoming).map((event) => <EventCard key={event.id} event={event} />)
        )}
      </div>

      {past.length > 0 && (
        <>
          <div className="section-divider mb-6" />
          <button
            type="button"
            onClick={() => setShowPast(!showPast)}
            className="btn-outline text-sm mb-6"
          >
            {showPast ? t('events.hidePast') : `${t('events.showPast')} (${past.length})`}
          </button>
          {showPast && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {filter(past).map((event) => <EventCard key={event.id} event={event} />)}
            </div>
          )}
        </>
      )}

    </div>
  )
}
