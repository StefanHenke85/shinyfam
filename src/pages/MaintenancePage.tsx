export default function MaintenancePage() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-4 text-center"
      style={{ background: 'var(--bg-base)' }}>
      <img src="/logo.jpg" alt="ShinyFam" className="h-24 w-24 rounded-2xl object-cover mb-6 shadow-xl" />
      <h1 className="font-display text-4xl font-black section-title mb-3">Wir sind im Aufbau</h1>
      <p className="text-secondary text-lg max-w-md mb-2">
        Unsere Seite wird gerade fertiggestellt und geht bald online.
      </p>
      <p className="text-muted text-base mb-8">
        Ab dem <span className="font-semibold section-title">1. April 2026</span> sind wir für euch da!
      </p>
      <div className="flex flex-col sm:flex-row gap-3 items-center">
        <a
          href="https://www.instagram.com/shinyfam_heike/"
          target="_blank"
          rel="noopener noreferrer"
          className="btn-primary"
        >
          Instagram
        </a>
        <a
          href="https://wa.me/4915165788495"
          target="_blank"
          rel="noopener noreferrer"
          className="btn-secondary"
        >
          WhatsApp
        </a>
      </div>
      <p className="text-muted text-xs mt-10 opacity-60">ShinyFam · Pokémon &amp; TCG</p>
    </div>
  )
}
