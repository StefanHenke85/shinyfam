import { useState, useEffect } from 'react'
import { CalendarDays, Filter } from 'lucide-react'
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
