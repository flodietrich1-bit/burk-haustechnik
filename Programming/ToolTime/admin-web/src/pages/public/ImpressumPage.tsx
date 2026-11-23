import { Link } from 'react-router-dom';
import { ArrowLeft, Building2, MapPin, Mail, User } from 'lucide-react';
import { MarketingNavbar } from '../../components/public/MarketingNavbar';
import { MarketingFooter } from '../../components/public/MarketingFooter';

export function ImpressumPage() {
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
              <Building2 className="h-6 w-6" />
            </div>
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.2em] text-[#7437D9]">Rechtliche Angaben</p>
              <h1 className="text-3xl font-extrabold sm:text-4xl">Impressum</h1>
            </div>
          </div>
          <p className="mt-2 text-sm text-[#68647D]">Angaben gemäß § 5 TMG / § 18 Abs. 2 MStV</p>

          <div className="mt-10 grid grid-cols-1 gap-6 sm:grid-cols-2">
            {/* Anbieter */}
            <div className="rounded-3xl border border-[#EAE5F4] bg-white p-7 shadow-xs">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#7437D9]/10 text-[#7437D9]">
                  <Building2 className="h-5 w-5" />
                </div>
                <h2 className="text-lg font-bold">Diensteanbieter</h2>
              </div>
              <div className="mt-4 space-y-1.5 text-sm text-[#494463]">
                <p className="font-bold text-base text-[#1F1A4D]">P12 Ventures GmbH</p>
                <p className="text-xs text-[#68647D]">
                  Betreiberin der SaaS-Plattform <strong>P12 - Aufmaß</strong> (<a href="https://p12-aufmass.de" className="text-[#7437D9] hover:underline">p12-aufmass.de</a>)
                </p>
                <p className="pt-2">Vertreten durch den Geschäftsführer:</p>
                <p className="font-semibold text-[#1F1A4D]">Peter Suhayda</p>
              </div>
            </div>

            {/* Sitz & Register */}
            <div className="rounded-3xl border border-[#EAE5F4] bg-white p-7 shadow-xs">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#7437D9]/10 text-[#7437D9]">
                  <MapPin className="h-5 w-5" />
                </div>
                <h2 className="text-lg font-bold">Sitz & Register</h2>
              </div>
              <div className="mt-4 space-y-1.5 text-sm text-[#494463]">
                <p className="font-semibold text-[#1F1A4D]">Pölitzstraße 12</p>
                <p>04155 Leipzig</p>
                <p>Deutschland</p>
                <div className="mt-3 border-t border-[#EAE5F4] pt-2.5 text-xs text-[#68647D] space-y-1">
                  <p>Registergericht: <strong className="text-[#1F1A4D]">Amtsgericht Leipzig</strong></p>
                  <p>Registernummer: <strong className="text-[#1F1A4D]">HRB 42438</strong></p>
                </div>
              </div>
            </div>

            {/* Kontakt */}
            <div className="rounded-3xl border border-[#EAE5F4] bg-white p-7 shadow-xs">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#7437D9]/10 text-[#7437D9]">
                  <Mail className="h-5 w-5" />
                </div>
                <h2 className="text-lg font-bold">Kontakt</h2>
              </div>
              <div className="mt-4 space-y-2 text-sm text-[#494463]">
                <p>
                  E-Mail:{' '}
                  <a href="mailto:info@p12-aufmass.de" className="font-semibold text-[#7437D9] hover:underline">
                    info@p12-aufmass.de
                  </a>
                </p>
                <p>
                  Allgemeine Anfragen:{' '}
                  <a href="mailto:info@p12v.de" className="font-semibold text-[#7437D9] hover:underline">
                    info@p12v.de
                  </a>
                </p>
                <p className="pt-2">
                  Webseiten:{' '}
                  <a href="https://p12-aufmass.de" className="text-[#7437D9] hover:underline">p12-aufmass.de</a> ·{' '}
                  <a href="https://p12v.de" target="_blank" rel="noopener noreferrer" className="text-[#7437D9] hover:underline">p12v.de</a>
                </p>
              </div>
            </div>

            {/* Verantwortlich für den Inhalt */}
            <div className="rounded-3xl border border-[#EAE5F4] bg-white p-7 shadow-xs">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#7437D9]/10 text-[#7437D9]">
                  <User className="h-5 w-5" />
                </div>
                <h2 className="text-lg font-bold">Redaktionell verantwortlich</h2>
              </div>
              <div className="mt-4 space-y-1.5 text-sm text-[#494463]">
                <p className="text-xs text-[#68647D]">Verantwortlich gem. § 18 Abs. 2 MStV:</p>
                <p className="font-semibold text-[#1F1A4D]">Peter Suhayda</p>
                <p>P12 Ventures GmbH</p>
                <p>Pölitzstraße 12</p>
                <p>04155 Leipzig</p>
              </div>
            </div>
          </div>

          {/* Haftungsausschluss / Disclaimer */}
          <div className="mt-10 rounded-3xl border border-[#EAE5F4] bg-[#FAF8FE] p-8 text-sm leading-relaxed text-[#544E6E] space-y-6">
            <div>
              <h3 className="font-bold text-base text-[#1F1A4D]">Haftung für Inhalte</h3>
              <p className="mt-1.5">
                Als Diensteanbieter sind wir gemäß § 7 Abs. 1 TMG für eigene Inhalte auf diesen Seiten nach den
                allgemeinen Gesetzen verantwortlich. Nach §§ 8 bis 10 TMG sind wir als Diensteanbieter jedoch nicht
                verpflichtet, übermittelte oder gespeicherte fremde Informationen zu überwachen oder nach Umständen zu
                forschen, die auf eine rechtswidrige Tätigkeit hinweisen. Verpflichtungen zur Entfernung oder Sperrung
                der Nutzung von Informationen nach den allgemeinen Gesetzen bleiben hiervon unberührt.
              </p>
            </div>

            <div>
              <h3 className="font-bold text-base text-[#1F1A4D]">Haftung für Links</h3>
              <p className="mt-1.5">
                Unser Angebot enthält Links zu externen Websites Dritter, auf deren Inhalte wir keinen Einfluss haben.
                Deshalb können wir für diese fremden Inhalte auch keine Gewähr übernehmen. Für die Inhalte der
                verlinkten Seiten ist stets der jeweilige Anbieter oder Betreiber der Seiten verantwortlich. Die
                verlinkten Seiten wurden zum Zeitpunkt der Verlinkung auf mögliche Rechtsverstöße überprüft.
                Rechtswidrige Inhalte waren zum Zeitpunkt der Verlinkung nicht erkennbar.
              </p>
            </div>

            <div>
              <h3 className="font-bold text-base text-[#1F1A4D]">Urheberrecht</h3>
              <p className="mt-1.5">
                Die durch die Seitenbetreiber erstellten Inhalte und Werke auf diesen Seiten unterliegen dem deutschen
                Urheberrecht. Die Vervielfältigung, Bearbeitung, Verbreitung und jede Art der Verwertung außerhalb der
                Grenzen des Urheberrechtes bedürfen der schriftlichen Zustimmung des jeweiligen Autors bzw. Erstellers.
              </p>
            </div>
          </div>
        </div>
      </main>

      <MarketingFooter />
    </div>
  );
}
