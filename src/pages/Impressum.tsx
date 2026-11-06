export default function Impressum() {
  return (
    <div className="page-wrapper">
      <div className="max-w-2xl mx-auto px-4 py-12 pt-28">
        <h1 className="font-display text-4xl font-black section-title mb-2">Impressum</h1>
        <p className="text-secondary text-sm mb-8">Angaben gemäß § 5 TMG</p>

        <div className="flex flex-col gap-6">

          <section className="card rounded-2xl p-6">
            <h2 className="font-display font-bold text-lg section-title mb-3">Verantwortlich für den Inhalt</h2>
            <p className="text-secondary text-sm leading-relaxed">
              Heike Karg<br />
              Bönninghardter Straße 72<br />
              46519 Alpen<br />
              Deutschland
            </p>
          </section>

          <section className="card rounded-2xl p-6">
            <h2 className="font-display font-bold text-lg section-title mb-3">Technische Umsetzung</h2>
            <p className="text-secondary text-sm leading-relaxed">
              Stefan Henke<br />
              Xantener Straße 39<br />
              47495 Rheinberg<br />
              Deutschland
            </p>
          </section>

          <section className="card rounded-2xl p-6">
            <h2 className="font-display font-bold text-lg section-title mb-3">Umsatzsteuer</h2>
            <p className="text-secondary text-sm leading-relaxed">
              Gemäß § 19 UStG wird keine Umsatzsteuer berechnet (Kleinunternehmerregelung).
            </p>
          </section>

          <section className="card rounded-2xl p-6">
            <h2 className="font-display font-bold text-lg section-title mb-3">Kontakt</h2>
            <p className="text-secondary text-sm leading-relaxed">
              E-Mail:{' '}
              <a href="mailto:info@shinyfam.de" className="text-accent-purple hover-primary underline">
                info@shinyfam.de
              </a><br />
              Instagram:{' '}
              <a href="https://instagram.com/shiny.fam.tcg" target="_blank" rel="noopener noreferrer" className="text-accent-purple hover-primary underline">
                @shiny.fam.tcg
              </a>
            </p>
          </section>

          <section className="card rounded-2xl p-6">
            <h2 className="font-display font-bold text-lg section-title mb-3">Hosting</h2>
            <p className="text-secondary text-sm leading-relaxed">
              Diese Website wird auf Servern von{' '}
              <strong className="section-title">IONOS SE</strong> betrieben.<br />
              IONOS SE, Elgendorfer Str. 57, 56410 Montabaur, Deutschland.<br />
              Domain registriert über <strong className="section-title">domaincheck.de</strong>.
            </p>
          </section>

          <section className="card rounded-2xl p-6">
            <h2 className="font-display font-bold text-lg section-title mb-3">Hinweis zu YouTube-Inhalten</h2>
            <p className="text-secondary text-sm leading-relaxed">
              Videos werden erst geladen, wenn du aktiv auf „Abspielen" klickst.
              Erst dann stellt dein Browser eine Verbindung zu YouTube her
              (Google LLC, 1600 Amphitheatre Parkway, Mountain View, CA 94043, USA).
              Weitere Informationen findest du in der{' '}
              <a href="https://policies.google.com/privacy" target="_blank" rel="noopener noreferrer" className="text-accent-purple underline">
                Datenschutzerklärung von Google
              </a>.
            </p>
          </section>

          <section className="card rounded-2xl p-6">
            <h2 className="font-display font-bold text-lg section-title mb-3">Haftungsausschluss</h2>
            <p className="text-secondary text-sm leading-relaxed mb-3">
              <strong className="section-title">Haftung für Inhalte:</strong>{' '}
              Die Inhalte dieser Website wurden mit größter Sorgfalt erstellt. Für die Richtigkeit,
              Vollständigkeit und Aktualität der Inhalte können wir jedoch keine Gewähr übernehmen.
            </p>
            <p className="text-secondary text-sm leading-relaxed">
              <strong className="section-title">Haftung für Links:</strong>{' '}
              Unser Angebot enthält Links zu externen Websites Dritter. Auf deren Inhalte haben wir keinen
              Einfluss und übernehmen daher keine Gewähr. Für die Inhalte der verlinkten Seiten ist stets
              der jeweilige Anbieter verantwortlich.
            </p>
          </section>

          <section className="card rounded-2xl p-6">
            <h2 className="font-display font-bold text-lg section-title mb-3">Urheberrecht</h2>
            <p className="text-secondary text-sm leading-relaxed">
              Die durch die Seitenbetreiber erstellten Inhalte und Werke auf dieser Website unterliegen
              dem deutschen Urheberrecht. Die Vervielfältigung, Bearbeitung, Verbreitung und jede Art der
              Verwertung außerhalb der Grenzen des Urheberrechtes bedürfen der schriftlichen Zustimmung
              des jeweiligen Autors bzw. Erstellers.
            </p>
          </section>

        </div>
      </div>
    </div>
  )
}
