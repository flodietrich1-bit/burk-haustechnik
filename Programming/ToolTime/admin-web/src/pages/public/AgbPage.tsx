import { Link } from 'react-router-dom';
import { ArrowLeft, FileText } from 'lucide-react';
import { MarketingNavbar } from '../../components/public/MarketingNavbar';
import { MarketingFooter } from '../../components/public/MarketingFooter';

export function AgbPage() {
  return (
    <div className="min-h-screen bg-[#FDFCFE] text-[#1F1A4D]">
      <MarketingNavbar />

      <main className="py-12 sm:py-16">
        <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8">
          <Link
            to="/"
            className="inline-flex items-center gap-2 text-sm font-semibold text-[#7437D9] transition hover:text-[#5E2BB8]"
          >
            <ArrowLeft className="h-4 w-4" />
            <span>Zurück zur Startseite</span>
          </Link>

          <div className="mt-6 flex items-center gap-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#7437D9]/10 text-[#7437D9]">
              <FileText className="h-6 w-6" />
            </div>
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.2em] text-[#7437D9]">Vertragsbedingungen</p>
              <h1 className="text-3xl font-extrabold sm:text-4xl">Allgemeine Geschäftsbedingungen (AGB)</h1>
            </div>
          </div>
          <p className="mt-2 text-sm text-[#68647D]">
            Stand: November 2026 · P12 - Aufmaß – Ein Produkt der P12 Ventures GmbH
          </p>

          <div className="mt-10 space-y-8">
            {/* Präambel */}
            <div className="rounded-3xl border border-[#EAE5F4] bg-white p-7 shadow-xs">
              <h2 className="text-lg font-bold">§ 1 Geltungsbereich und Vertragspartner</h2>
              <div className="mt-3 text-sm leading-relaxed text-[#494463] space-y-2">
                <p>
                  (1) Diese Allgemeinen Geschäftsbedingungen gelten für die Nutzung der cloudbasierten Softwareplattform{' '}
                  <strong>P12 - Aufmaß</strong> (erreichbar unter{' '}
                  <a href="https://p12-aufmass.de" className="text-[#7437D9] hover:underline">
                    p12-aufmass.de
                  </a>
                  ) sowie für alle zugehörigen mobilen Anwendungen und APIs.
                </p>
                <p>
                  (2) Vertragspartnerin und Betreiberin der Plattform ist die <strong>P12 Ventures GmbH</strong>,
                  Pölitzstraße 12, 04155 Leipzig, Amtsgericht Leipzig HRB 42438, vertreten durch den Geschäftsführer
                  Peter Suhayda (nachfolgend „Anbieterin“).
                </p>
                <p>
                  (3) Das Angebot richtet sich ausschließlich an Unternehmer im Sinne des § 14 BGB, juristische Personen
                  des öffentlichen Rechts oder öffentlich-rechtliche Sondervermögen (B2B). Ein Vertragsschluss mit
                  Verbrauchern im Sinne des § 13 BGB ist ausgeschlossen.
                </p>
              </div>
            </div>

            {/* § 2 Leistungen */}
            <div className="rounded-3xl border border-[#EAE5F4] bg-white p-7 shadow-xs">
              <h2 className="text-lg font-bold">§ 2 Leistungsgegenstand & Bereitstellung (SaaS)</h2>
              <div className="mt-3 text-sm leading-relaxed text-[#494463] space-y-2">
                <p>
                  (1) Die Anbieterin stellt dem Kunden den Zugang zu der webbasierten Aufmaß- und Dokumentationssoftware{' '}
                  <strong>P12 - Aufmaß</strong> im Rahmen eines Software-as-a-Service (SaaS)-Modells über das Internet
                  zur Verfügung.
                </p>
                <p>
                  (2) Der genaue Leistungsumfang umfasst je nach gewähltem Tarif u. a.:
                </p>
                <ul className="list-disc pl-6 space-y-1 text-sm text-[#494463]">
                  <li>Import und Verarbeitung von GAEB-Dateien (.d83, .x81, GAEB XML)</li>
                  <li>Hochladen, Visualisieren und Zuordnen von 2D/3D-CAD-Plänen (.dwg, .dxf)</li>
                  <li>Raumweise und bauteilbezogene Mengenerfassung und VOB-konforme Mengenermittlung</li>
                  <li>Bereitstellung der mobilen Monteur-App zur Vor-Ort-Erfassung und Fotodokumentation</li>
                  <li>Exportfunktionen für Aufmaßblätter (DIN A4 PDF) und detaillierte Excel-Bilanzen</li>
                  <li>Nachtrags- und Genehmigungsworkflows zwischen Baustelle und kaufmännischer Leitung</li>
                </ul>
              </div>
            </div>

            {/* § 3 Registrierung */}
            <div className="rounded-3xl border border-[#EAE5F4] bg-white p-7 shadow-xs">
              <h2 className="text-lg font-bold">§ 3 Mandantenkonten, Benutzer & Zugangsdaten</h2>
              <div className="mt-3 text-sm leading-relaxed text-[#494463] space-y-2">
                <p>
                  (1) Für die Nutzung der Plattform wird für das Unternehmen des Kunden ein eigener, isolierter
                  Mandantenbereich eingerichtet. Der Kunde kann innerhalb seines gebuchten Kontingents Zugänge für
                  Mitarbeiter (z. B. Administratoren, Bauleiter, kaufmännische Prüfer, Monteure) vergeben.
                </p>
                <p>
                  (2) Der Kunde verpflichtet sich, Zugangsdaten sorgfältig zu verwahren und vor unbefugtem Zugriff Dritter
                  zu schützen. Mitarbeiter-Zugänge dürfen nicht an Dritte weitergegeben werden.
                </p>
              </div>
            </div>

            {/* § 4 Pflichten & Datensicherheit */}
            <div className="rounded-3xl border border-[#EAE5F4] bg-white p-7 shadow-xs">
              <h2 className="text-lg font-bold">§ 4 Pflichten des Kunden & Datensicherheit</h2>
              <div className="mt-3 text-sm leading-relaxed text-[#494463] space-y-2">
                <p>
                  (1) Der Kunde ist dafür verantwortlich, dass die von ihm in die Plattform hochgeladenen Pläne,
                  Leistungsverzeichnisse und Dokumente frei von Rechten Dritter sind und keine geltenden Gesetze verletzen.
                </p>
                <p>
                  (2) Soweit der Kunde über die Plattform personenbezogene Daten verarbeitet, bleibt er Verantwortlicher im
                  Sinne der DSGVO. Auf Wunsch schließen die Parteien eine separate Vereinbarung zur Auftragsverarbeitung (AVV)
                  gem. Art. 28 DSGVO ab.
                </p>
              </div>
            </div>

            {/* § 5 Urheberrechte */}
            <div className="rounded-3xl border border-[#EAE5F4] bg-white p-7 shadow-xs">
              <h2 className="text-lg font-bold">§ 5 Geistiges Eigentum & Nutzungsrechte</h2>
              <div className="mt-3 text-sm leading-relaxed text-[#494463] space-y-2">
                <p>
                  (1) Sämtliche Rechte an der Software, den Quellcodes, den Datenbankstrukturen, Benutzeroberflächen und
                  Markenzeichen von <strong>P12 - Aufmaß</strong> verbleiben vollumfänglich bei der{' '}
                  <strong>P12 Ventures GmbH</strong>.
                </p>
                <p>
                  (2) Der Kunde erhält für die Dauer des Vertragsverhältnisses ein einfaches, nicht ausschließliches und
                  nicht übertragbares Recht, die Plattform bestimmungsgemäß im Rahmen seines gewerblichen Betriebs zu nutzen.
                </p>
                <p>
                  (3) Alle vom Kunden eingegebenen und erzeugten Projektdaten, Aufmaße, Pläne und Berichte verbleiben im
                  Eigentum des Kunden.
                </p>
              </div>
            </div>

            {/* § 6 Haftung */}
            <div className="rounded-3xl border border-[#EAE5F4] bg-white p-7 shadow-xs">
              <h2 className="text-lg font-bold">§ 6 Haftungsbeschränkung</h2>
              <div className="mt-3 text-sm leading-relaxed text-[#494463] space-y-2">
                <p>
                  (1) Die Anbieterin haftet unbeschränkt bei Vorsatz und grober Fahrlässigkeit, bei der Verletzung des Lebens,
                  des Körpers oder der Gesundheit sowie nach den Vorschriften des Produkthaftungsgesetzes.
                </p>
                <p>
                  (2) Bei leicht fahrlässiger Verletzung einer wesentlichen Vertragspflicht (Kardinalpflicht) ist die Haftung
                  der Anbieterin der Höhe nach auf den bei Vertragsschluss vorhersehbaren, vertragstypischen Schaden begrenzt.
                </p>
                <p>
                  (3) P12 - Aufmaß dient der rechnerischen und organisatorischen Unterstützung. Die fachliche und rechtliche
                  Prüfung von Bauabrechnungen, VOB-Aufmaßen und Schlussrechnungen obliegt stets der eigenverantwortlichen
                  bauleitenden und kaufmännischen Prüfung des Kunden.
                </p>
              </div>
            </div>

            {/* § 7 Gerichtsstand */}
            <div className="rounded-3xl border border-[#EAE5F4] bg-white p-7 shadow-xs">
              <h2 className="text-lg font-bold">§ 7 Schlussbestimmungen & Gerichtsstand</h2>
              <div className="mt-3 text-sm leading-relaxed text-[#494463] space-y-2">
                <p>
                  (1) Es gilt das Recht der Bundesrepublik Deutschland unter Ausschluss des UN-Kaufrechts (CISG).
                </p>
                <p>
                  (2) Ausschließlicher Gerichtsstand für alle Streitigkeiten aus oder im Zusammenhang mit diesem Vertrag ist{' '}
                  <strong>Leipzig</strong>.
                </p>
                <p>
                  (3) Sollten einzelne Bestimmungen dieser AGB unwirksam sein oder werden, so berührt dies die Wirksamkeit der
                  übrigen Bestimmungen nicht.
                </p>
              </div>
            </div>
          </div>
        </div>
      </main>

      <MarketingFooter />
    </div>
  );
}
