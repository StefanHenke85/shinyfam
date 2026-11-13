export default function TicketBedingungen() {
  const sec = 'card rounded-2xl p-6'
  const h = 'font-display font-bold text-lg section-title mb-3'
  const p = 'text-secondary text-sm leading-relaxed'
  return (
    <div className="page-wrapper">
      <div className="max-w-2xl mx-auto px-4 py-12 pt-28">
        <h1 className="font-display text-4xl font-black section-title mb-2">Ticket- und Teilnahmebedingungen</h1>
        <p className="text-secondary text-sm mb-8">für Online-Tickets und Händlerstände bei ShinyFam-Events</p>
        <div className="flex flex-col gap-6">
          <section className={sec}>
            <h2 className={h}>1. Veranstalter</h2>
            <p className={p}>ShinyFam, Heike Karg, Bönninghardter Straße 72, 46519 Alpen, info@shinyfam.de (siehe Impressum).</p>
          </section>
          <section className={sec}>
            <h2 className={h}>2. Bestellung und Bezahlung</h2>
            <p className={p}>
              Mit dem Absenden der Bestellung gibst du ein verbindliches Angebot ab. Bezahlt wird per Überweisung oder PayPal.
              Der Vertrag kommt mit dem Zahlungseingang zustande; danach erhältst du deine Tickets mit QR-Code per E-Mail.
              Geht innerhalb von 7 Tagen (bzw. bis zum Event) keine Zahlung ein, dürfen wir die Bestellung stornieren.
              Alle Preise sind Endpreise; gemäß § 19 UStG wird keine Umsatzsteuer berechnet.
            </p>
          </section>
          <section className={sec}>
            <h2 className={h}>3. Kein Widerrufsrecht</h2>
            <p className={p}>
              Tickets und Standbuchungen betreffen Freizeitveranstaltungen zu einem festen Termin. Ein Widerrufsrecht besteht daher
              nach § 312g Abs. 2 Nr. 9 BGB nicht. Fällt ein Event aus oder wird es durch uns verschoben, erstatten wir den gezahlten Preis
              bzw. das Ticket gilt für den Ersatztermin – du entscheidest.
            </p>
          </section>
          <section className={sec}>
            <h2 className={h}>4. Einlass</h2>
            <p className={p}>
              Jeder QR-Code gilt pro Veranstaltungstag einmal. Bei Weitergabe eines Tickets gilt der erste Scan. Kopierte oder
              veränderte Tickets sind ungültig. Es gilt die Hausordnung der jeweiligen Location.
            </p>
          </section>
          <section className={sec}>
            <h2 className={h}>5. Händlerstände und Unratütox-Gebühr</h2>
            <p className={p}>
              Die gebuchte Standfläche wird dir vor Ort zugewiesen. Für jeden Stand nehmen wir vor Ort eine <strong className="section-title">Unratütox-Gebühr
              (in der Regel 10 €) in bar</strong>. Sie wird nach der Veranstaltung zurückgezahlt, wenn die Standfläche sauber und ordentlich
              hinterlassen wurde (Müll entfernt, Tische und Boden frei). Andernfalls behalten wir die Unratütox-Gebühr für den Reinigungsaufwand ein.
              Bei Nichterscheinen ohne Absage bis 7 Tage vor dem Event wird die Standgebühr nicht erstattet.
            </p>
          </section>
          <section className={sec}>
            <h2 className={h}>6. Haftung</h2>
            <p className={p}>
              Der Besuch der Veranstaltung sowie das Mitbringen von Ware und Wertgegenständen erfolgen auf eigenes Risiko. Für Verlust,
              Diebstahl oder Beschädigung mitgebrachter Ware und Wertgegenstände übernehmen wir keine Haftung. Händler sind für ihren Stand
              und ihre Ware selbst verantwortlich. Unberührt bleibt allein die gesetzlich zwingende Haftung (Vorsatz, grobe Fahrlässigkeit
              sowie Verletzung von Leben, Körper oder Gesundheit).
            </p>
          </section>
        </div>
      </div>
    </div>
  )
}
