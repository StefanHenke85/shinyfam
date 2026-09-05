import { useEffect, useState } from 'react'
import { ArrowUp } from 'lucide-react'

export default function ScrollToTopButton() {
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    const onScroll = () => setVisible(window.scrollY > 400)
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  if (!visible) return null

  return (
    <button
      type="button"
      onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
      aria-label="Nach oben scrollen"
      className="fixed bottom-6 right-[5.25rem] z-40 w-12 h-12 rounded-full flex items-center justify-center shadow-lg border border-theme bg-bg-surface text-primary hover:opacity-88 transition-opacity"
    >
      <ArrowUp size={20} aria-hidden="true" />
    </button>
  )
}
