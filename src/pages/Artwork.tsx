import { useState, useEffect } from 'react'
import { Palette, X, Send, CheckCircle } from 'lucide-react'
import { useTheme } from '../contexts/ThemeContext'

interface ArtworkPiece {
  id: string
  title: string
  description: string
  image_url: string
  tags: string[]
  sold: boolean
}

interface FormData {
  name: string
  email: string
  phone: string
  motif: string
  size: string
  message: string
}

const gradients = [
  'from-purple-600 to-pink-500',
  'from-orange-500 to-yellow-400',
  'from-pink-500 to-red-500',
  'from-indigo-500 to-purple-600',
  'from-teal-500 to-cyan-400',
  'from-rose-500 to-orange-400',
]

export default function Artwork() {
  const { t } = useTheme()
  const [artworks, setArtworks] = useState<ArtworkPiece[]>([])
  const [activeTag, setActiveTag] = useState(t('artwork.filterAll'))
  const [lightbox, setLightbox] = useState<ArtworkPiece | null>(null)
  const [submitted, setSubmitted] = useState(false)
  const [form, setForm] = useState<FormData>({
    name: '', email: '', phone: '', motif: '', size: 'A4', message: ''
  })

  useEffect(() => {
    fetch('/api/artworks')
      .then(r => r.json())
      .then(data => {
        if (Array.isArray(data)) {
          setArtworks(data.map(a => ({
            ...a,
            tags: typeof a.tags === 'string' ? a.tags.split(',').map((tag: string) => tag.trim()).filter(Boolean) : (a.tags || []),
            sold: Boolean(a.sold),
          })))
        }
      })
      .catch(() => {})
  }, [])

  const filterAll = t('artwork.filterAll')
  const allTags = [filterAll, ...Array.from(new Set(artworks.flatMap(a => a.tags)))]
  const filtered = activeTag === filterAll ? artworks : artworks.filter(a => a.tags.includes(activeTag))

  const handleSubmit = async (e: React.SyntheticEvent) => {
    e.preventDefault()
    await fetch('/api/orders', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    }).catch(() => {})
    setSubmitted(true)
    setForm({ name: '', email: '', phone: '', motif: '', size: 'A4', message: '' })
  }

  return (
    <div className="max-w-6xl mx-auto px-4 py-8 pt-24">
      <div className="text-center mb-10">
        <h1 className="font-display text-4xl md:text-5xl font-black section-title flex items-center justify-center gap-3 mb-2">
          <Palette size={36} className="text-accent-pink" />
          {t('artwork.title')}
        </h1>
        <p className="text-secondary max-w-xl mx-auto">
          {t('artwork.pageSubtitle')}
        </p>
      </div>

      {artworks.length > 0 && (
        <div className="flex gap-2 flex-wrap justify-center mb-8">
          {allTags.map((tag) => (
            <button
              key={tag}
              type="button"
              onClick={() => setActiveTag(tag)}
              className={`text-sm px-3 py-1 rounded-full border transition-colors ${
                activeTag === tag
                  ? 'bg-accent-pink border-accent-pink text-white'
                  : 'border-theme text-secondary hover:border-accent-pink/50 hover:text-primary'
              }`}
            >
              {tag}
            </button>
          ))}
        </div>
      )}

      {artworks.length === 0 ? (
        <div className="text-center py-16 text-muted">
          <Palette size={48} className="mx-auto mb-4 opacity-30" />
          <p>{t('artwork.comingSoon')}</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-16">
          {filtered.map((piece, i) => (
            <div
              key={piece.id}
              className="relative aspect-square bg-bg-surface border border-theme rounded-2xl overflow-hidden cursor-pointer card-hover group"
              onClick={() => setLightbox(piece)}
            >
              {piece.image_url ? (
                <img src={piece.image_url} alt={piece.title} className="w-full h-full object-cover" />
              ) : (
                <div className={`w-full h-full bg-gradient-to-br ${gradients[i % gradients.length]} opacity-40`} />
              )}

              <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-end p-4">
                <div>
                  <p className="text-white font-semibold">{piece.title}</p>
                  <p className="text-gray-300 text-sm">{piece.description}</p>
                </div>
              </div>

              {piece.sold && (
                <div className="absolute top-2 right-2 bg-red-500/90 text-white text-xs px-2 py-0.5 rounded-full">
                  {t('artwork.sold')}
                </div>
              )}

              {piece.tags.length > 0 && (
                <div className="absolute top-2 left-2 flex gap-1 flex-wrap">
                  <span className="text-xs bg-black/60 text-gray-300 px-2 py-0.5 rounded-full">
                    {piece.tags[0]}
                  </span>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {lightbox && (
        <div
          className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4"
          onClick={() => setLightbox(null)}
        >
          <div
            className="bg-bg-surface border border-theme rounded-2xl max-w-lg w-full p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex justify-between items-start mb-4">
              <h3 className="font-display text-xl font-bold section-title">{lightbox.title}</h3>
              <button onClick={() => setLightbox(null)} className="text-muted hover:text-primary" aria-label={t('artwork.close')}>
                <X size={20} />
              </button>
            </div>
            <div className="aspect-square bg-bg-raised rounded-xl mb-4 overflow-hidden">
              {lightbox.image_url ? (
                <img src={lightbox.image_url} alt={lightbox.title} className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-muted">
                  {t('artwork.noImage')}
                </div>
              )}
            </div>
            <p className="text-secondary text-sm mb-4">{lightbox.description}</p>
            <div className="flex gap-2 flex-wrap mb-4">
              {lightbox.tags.map((tag) => (
                <span key={tag} className="text-xs bg-accent-pink/10 text-accent-pink border border-accent-pink/20 px-2 py-0.5 rounded-full">
                  {tag}
                </span>
              ))}
            </div>
            {!lightbox.sold && (
              <button
                onClick={() => { setLightbox(null); document.getElementById('order-form')?.scrollIntoView({ behavior: 'smooth' }) }}
                className="btn-primary w-full text-center"
              >
                {t('artwork.similar')}
              </button>
            )}
          </div>
        </div>
      )}

      <div className="section-divider mb-16" />

      <div id="order-form" className="max-w-xl mx-auto">
        <div className="text-center mb-8">
          <h2 className="font-display text-3xl font-bold section-title mb-2">{t('artwork.orderTitle')}</h2>
          <p className="text-secondary text-sm">
            {t('artwork.orderDesc')}
          </p>
        </div>

        {submitted ? (
          <div className="bg-bg-surface border border-green-500/20 rounded-2xl p-8 text-center">
            <CheckCircle size={48} className="text-green-400 mx-auto mb-4" />
            <h3 className="section-title font-display text-xl font-bold mb-2">{t('artwork.sentTitle')}</h3>
            <p className="text-secondary text-sm">{t('artwork.sentNote')} ✨</p>
            <button type="button" className="btn-outline mt-4 text-sm" onClick={() => setSubmitted(false)}>
              {t('artwork.newrequest')}
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="bg-bg-surface border border-theme rounded-2xl p-6 flex flex-col gap-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-secondary text-xs mb-1 block">{t('form.name')} *</label>
                <input
                  required
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  className="w-full bg-bg-raised border border-theme rounded-lg px-3 py-2 text-primary text-sm focus:border-accent-purple outline-none transition-colors"
                  placeholder={t('form.name')}
                />
              </div>
              <div>
                <label className="text-secondary text-xs mb-1 block">{t('form.email')} *</label>
                <input
                  required
                  type="email"
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                  className="w-full bg-bg-raised border border-theme rounded-lg px-3 py-2 text-primary text-sm focus:border-accent-purple outline-none transition-colors"
                  placeholder="email@example.com"
                />
              </div>
            </div>
            <div>
              <label className="text-secondary text-xs mb-1 block">{t('form.phone')}</label>
              <input
                value={form.phone}
                onChange={(e) => setForm({ ...form, phone: e.target.value })}
                className="w-full bg-bg-raised border border-theme rounded-lg px-3 py-2 text-primary text-sm focus:border-accent-purple outline-none transition-colors"
                placeholder="+49 ..."
              />
            </div>
            <div>
              <label className="text-secondary text-xs mb-1 block">{t('form.motif')} *</label>
              <input
                required
                value={form.motif}
                onChange={(e) => setForm({ ...form, motif: e.target.value })}
                className="w-full bg-bg-raised border border-theme rounded-lg px-3 py-2 text-primary text-sm focus:border-accent-purple outline-none transition-colors"
                placeholder={t('form.motifph')}
              />
            </div>
            <div>
              <label className="text-secondary text-xs mb-1 block">{t('form.size')}</label>
              <select
                aria-label={t('form.size')}
                value={form.size}
                onChange={(e) => setForm({ ...form, size: e.target.value })}
                className="w-full bg-bg-raised border border-theme rounded-lg px-3 py-2 text-primary text-sm focus:border-accent-purple outline-none transition-colors"
              >
                <option>A6 (Postkarte)</option>
                <option>A5</option>
                <option>A4</option>
                <option>A3</option>
                <option>Digital (PNG)</option>
              </select>
            </div>
            <div>
              <label className="text-secondary text-xs mb-1 block">{t('form.notes')}</label>
              <textarea
                rows={3}
                value={form.message}
                onChange={(e) => setForm({ ...form, message: e.target.value })}
                className="w-full bg-bg-raised border border-theme rounded-lg px-3 py-2 text-primary text-sm focus:border-accent-purple outline-none transition-colors resize-none"
                placeholder={t('form.notesph')}
              />
            </div>
            <button type="submit" className="btn-primary flex items-center justify-center gap-2">
              <Send size={14} />
              {t('artwork.send')}
            </button>
          </form>
        )}
      </div>
    </div>
  )
}
