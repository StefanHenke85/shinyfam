import { Heart, Star, Users, Sparkles } from 'lucide-react'
import { useTheme } from '../contexts/ThemeContext'

export default function UeberUns() {
  const { t } = useTheme()

  return (
    <div className="max-w-3xl mx-auto px-4 py-8 pt-24">

      <div className="text-center mb-12">
        <h1 className="font-display text-4xl md:text-5xl font-black text-primary flex items-center justify-center gap-3 mb-4">
          <Sparkles size={36} className="text-accent-purple" />
          {t('about.title')}
        </h1>
        <p className="text-secondary text-lg max-w-xl mx-auto">
          {t('about.intro')}
        </p>
      </div>

      <div className="card rounded-2xl p-8 mb-6">
        <div className="flex items-center gap-3 mb-4">
          <Heart size={20} className="text-accent-pink" />
          <h2 className="font-display text-xl font-bold text-primary">{t('about.s1.title')}</h2>
        </div>
        <p className="text-secondary leading-relaxed mb-4">{t('about.s1.p1')}</p>
        <p className="text-secondary leading-relaxed mb-4">{t('about.s1.p2')}</p>
        <p className="text-primary font-semibold text-lg">{t('about.s1.p3')}</p>
      </div>

      <div className="card rounded-2xl p-8 mb-6">
        <div className="flex items-center gap-3 mb-4">
          <Users size={20} className="text-accent-purple" />
          <h2 className="font-display text-xl font-bold text-primary">{t('about.s2.title')}</h2>
        </div>
        <p className="text-secondary leading-relaxed">{t('about.s2.p1')}</p>
      </div>

      <div className="card rounded-2xl p-8 mb-6 border border-accent-purple/20 bg-accent-purple/5">
        <div className="flex items-center gap-3 mb-4">
          <Star size={20} className="text-accent-purple" />
          <h2 className="font-display text-xl font-bold text-primary">{t('about.s3.title')}</h2>
        </div>
        <p className="text-secondary leading-relaxed">
          {t('about.s3.p1')}{' '}
          <span className="text-accent-purple font-semibold">{t('about.s3.highlight')}</span>
        </p>
      </div>

      <div className="card rounded-2xl p-8 mb-6">
        <div className="flex items-center gap-3 mb-4">
          <Sparkles size={20} className="text-accent-pink" />
          <h2 className="font-display text-xl font-bold text-primary">{t('about.s4.title')}</h2>
        </div>
        <p className="text-secondary leading-relaxed mb-4">{t('about.s4.p1')}</p>
        <p className="text-secondary leading-relaxed mb-4">{t('about.s4.p2')}</p>
        <div className="border-t border-theme pt-4 mt-4">
          <p className="text-primary font-medium mb-2">{t('about.s4.new')}</p>
          <p className="text-secondary leading-relaxed">{t('about.s4.p3')}</p>
        </div>
      </div>

      <div className="text-center py-8">
        <p className="text-secondary text-lg leading-relaxed max-w-xl mx-auto mb-2">
          {t('about.closing1')}
        </p>
        <p className="text-primary font-semibold text-xl mb-6">
          {t('about.closing2')}
        </p>
        <p className="text-secondary">
          {t('about.closing3')}{' '}
          <span className="font-display font-black gradient-text text-2xl">Shiny Fam.</span>
        </p>
      </div>

    </div>
  )
}
