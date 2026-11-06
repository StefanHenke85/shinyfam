export default function Datenschutz() {
  return (
    <div className="page-wrapper">
      <div className="max-w-2xl mx-auto px-4 py-12 pt-28">
        <h1 className="font-display text-4xl font-black section-title mb-2">Datenschutzerklärung</h1>
        <p className="text-secondary text-sm mb-8">Gemäß DSGVO (EU) 2016/679</p>

        <div className="flex flex-col gap-6">

          <section className="card rounded-2xl p-6">
            <h2 className="font-display font-bold text-lg section-title mb-3">1. Verantwortliche Stelle</h2>
            <p className="text-secondary text-sm leading-relaxed">
              Verantwortlich im Sinne der DSGVO ist:<br /><br />
              Heike Karg<br />
              Bönninghardter Straße 72<br />
              46519 Alpen<br />
              Deutschland<br /><br />
              E-Mail:{' '}
              <a href="mailto:info@shinyfam.de" className="text-accent-purple underline">
                info@shinyfam.de
              </a>
            </p>
          </section>

          <section className="card rounded-2xl p-6">
            <h2 className="font-display font-bold text-lg section-title mb-3">2. Hosting</h2>
            <p className="text-secondary text-sm leading-relaxed">
              Diese Website wird auf Servern von <strong className="section-title">IONOS SE</strong> (Elgendorfer Str. 57, 56410 Montabaur)
              betrieben. Beim Abruf der Website werden automatisch folgende Daten im Server-Logfile gespeichert:
            </p>
            <ul className="text-secondary text-sm leading-relaxed mt-2 ml-4 list-disc space-y-1">
              <li>IP-Adresse des anfragenden Rechners (anonymisiert)</li>
              <li>Datum und Uhrzeit des Zugriffs</li>
              <li>Name und URL der abgerufenen Datei</li>
              <li>Verwendeter Browser und Betriebssystem</li>
            </ul>
            <p className="text-secondary text-sm leading-relaxed mt-3">
              Rechtsgrundlage: Art. 6 Abs. 1 lit. f DSGVO (berechtigtes Interesse am sicheren Betrieb).
              Die Daten werden nach spätestens 7 Tagen gelöscht.
            </p>
          </section>

          <section className="card rounded-2xl p-6">
            <h2 className="font-display font-bold text-lg section-title mb-3">3. Cookies</h2>
            <p className="text-secondary text-sm leading-relaxed mb-3">
              Wir verwenden ausschließlich technisch notwendige Cookies sowie optionale Cookies nach deiner
              Zustimmung. Du kannst deine Einwilligung jederzeit widerrufen, indem du die Seite neu lädst
              und die Cookie-Einstellungen anpasst.
            </p>
            <div className="surface rounded-xl p-4">
              <p className="text-xs font-bold section-title mb-2">Verwendete Cookies / lokaler Speicher:</p>
              <div className="flex flex-col gap-2">
                {[
                  { name: 'shinyfam-theme', zweck: 'Speichert deine Hell-/Dunkel-Einstellung', art: 'Notwendig' },
                  { name: 'shinyfam-cart', zweck: 'Speichert den Warenkorb-Inhalt', art: 'Notwendig' },
                  { name: 'shinyfam-cookie-consent', zweck: 'Speichert deine Cookie-Auswahl', art: 'Notwendig' },
                  { name: 'YouTube (iframe)', zweck: 'Nur bei aktivem Klick auf Videos — Google LLC', art: 'Optional' },
                ].map(c => (
                  <div key={c.name} className="flex flex-wrap gap-x-4 gap-y-0.5 text-xs">
                    <span className="font-mono text-accent-purple">{c.name}</span>
                    <span className="text-secondary flex-1">{c.zweck}</span>
                    <span className={`font-semibold ${c.art === 'Notwendig' ? 'text-accent-orange' : 'text-muted'}`}>{c.art}</span>
                  </div>
                ))}
              </div>
            </div>
          </section>

          <section className="card rounded-2xl p-6">
            <h2 className="font-display font-bold text-lg section-title mb-3">4. YouTube-Videos</h2>
            <p className="text-secondary text-sm leading-relaxed">
              Eingebettete YouTube-Videos werden erst geladen, wenn du aktiv auf „Abspielen" klickst
              (2-Klick-Lösung). Erst dann verbindet sich dein Browser mit Servern von Google LLC
              (YouTube, 1600 Amphitheatre Parkway, Mountain View, CA 94043, USA).
              Google kann dabei Daten erheben und verarbeiten.
              Rechtsgrundlage: Art. 6 Abs. 1 lit. a DSGVO (Einwilligung durch aktives Klicken).<br /><br />
              Mehr:{' '}
              <a href="https://policies.google.com/privacy" target="_blank" rel="noopener noreferrer" className="text-accent-purple underline">
                policies.google.com/privacy
              </a>
            </p>
          </section>

          <section className="card rounded-2xl p-6">
            <h2 className="font-display font-bold text-lg section-title mb-3">5. Kontaktformular / Bestellungen</h2>
            <p className="text-secondary text-sm leading-relaxed">
              Wenn du über unser Formular eine Anfrage oder Bestellung sendest, werden die eingegebenen
              Daten (Name, Adresse, E-Mail, Nachricht) zur Bearbeitung gespeichert.
              Rechtsgrundlage: Art. 6 Abs. 1 lit. b DSGVO (Vertragserfüllung) bzw. lit. a (Einwilligung).
              Die Daten werden nicht an Dritte weitergegeben und nach Abschluss des Vorgangs gelöscht,
              sofern keine gesetzliche Aufbewahrungspflicht besteht.
            </p>
          </section>

          <section className="card rounded-2xl p-6">
            <h2 className="font-display font-bold text-lg section-title mb-3">6. Instagram / Social Media</h2>
            <p className="text-secondary text-sm leading-relaxed">
              Wir verlinken auf unser Instagram-Profil (@shiny.fam.tcg). Beim Klick auf den Link verlässt
              du diese Website. Instagram (Meta Platforms Ireland Ltd.) erhebt dann eigenständig Daten.
              Wir haben auf diese Verarbeitung keinen Einfluss. Mehr:{' '}
              <a href="https://privacycenter.instagram.com/policy" target="_blank" rel="noopener noreferrer" className="text-accent-purple underline">
                privacycenter.instagram.com/policy
              </a>
            </p>
          </section>

          <section className="card rounded-2xl p-6">
            <h2 className="font-display font-bold text-lg section-title mb-3">7. Deine Rechte</h2>
            <p className="text-secondary text-sm leading-relaxed mb-2">
              Du hast jederzeit das Recht auf:
            </p>
            <ul className="text-secondary text-sm leading-relaxed ml-4 list-disc space-y-1">
              <li><strong className="section-title">Auskunft</strong> über deine bei uns gespeicherten Daten (Art. 15 DSGVO)</li>
              <li><strong className="section-title">Berichtigung</strong> unrichtiger Daten (Art. 16 DSGVO)</li>
              <li><strong className="section-title">Löschung</strong> deiner Daten (Art. 17 DSGVO)</li>
              <li><strong className="section-title">Einschränkung</strong> der Verarbeitung (Art. 18 DSGVO)</li>
              <li><strong className="section-title">Widerspruch</strong> gegen die Verarbeitung (Art. 21 DSGVO)</li>
              <li><strong className="section-title">Beschwerde</strong> bei einer Aufsichtsbehörde (Art. 77 DSGVO)</li>
            </ul>
            <p className="text-secondary text-sm leading-relaxed mt-3">
              Anfragen richtest du bitte an:{' '}
              <a href="mailto:info@shinyfam.de" className="text-accent-purple underline">
                info@shinyfam.de
              </a>
            </p>
          </section>

          <p className="text-muted text-xs text-center">Stand: März 2026</p>

        </div>
      </div>
    </div>
  )
}
