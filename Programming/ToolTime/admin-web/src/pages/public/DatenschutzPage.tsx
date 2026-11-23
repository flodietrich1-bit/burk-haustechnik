import { Link } from 'react-router-dom';
import { ArrowLeft, Shield, Lock, Eye, Trash2, Mail, Server } from 'lucide-react';
import { MarketingNavbar } from '../../components/public/MarketingNavbar';
import { MarketingFooter } from '../../components/public/MarketingFooter';

export function DatenschutzPage() {
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
              <Shield className="h-6 w-6" />
            </div>
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.2em] text-[#7437D9]">Rechtliche Hinweise</p>
              <h1 className="text-3xl font-extrabold sm:text-4xl">Datenschutzerklärung (DSGVO)</h1>
            </div>
          </div>
          <p className="mt-2 text-sm text-[#68647D]">
            Stand: November 2026 · Plattform P12 - Aufmaß betrieben von P12 Ventures GmbH
          </p>

          <div className="mt-10 space-y-8">
            {/* Verantwortlicher */}
            <div className="rounded-3xl border border-[#EAE5F4] bg-white p-7 shadow-xs">
              <h2 className="text-lg font-bold">1. Verantwortliche Stelle gem. Art. 4 Nr. 7 DSGVO</h2>
              <div className="mt-3 text-sm leading-relaxed text-[#494463] space-y-1">
                <p className="font-semibold text-base text-[#1F1A4D]">P12 Ventures GmbH</p>
                <p>Pölitzstraße 12, 04155 Leipzig, Deutschland</p>
                <p>Geschäftsführer: Peter Suhayda</p>
                <p>Registergericht: Amtsgericht Leipzig, HRB 42438</p>
                <p>
                  E-Mail:{' '}
                  <a href="mailto:info@p12-aufmass.de" className="text-[#7437D9] hover:underline">
                    info@p12-aufmass.de
                  </a>{' '}
                  / <a href="mailto:info@p12v.de" className="text-[#7437D9] hover:underline">info@p12v.de</a>
                </p>
              </div>
            </div>

            {/* Grundsätze */}
            <div className="rounded-3xl border border-[#EAE5F4] bg-white p-7 shadow-xs">
              <div className="flex items-center gap-3">
                <Lock className="h-5 w-5 text-[#7437D9]" />
                <h2 className="text-lg font-bold">2. Grundlegendes zum Datenschutz bei P12 - Aufmaß</h2>
              </div>
              <p className="mt-3 text-sm leading-relaxed text-[#494463]">
                Wir verarbeiten personenbezogene Daten unserer Nutzer grundsätzlich nur, soweit dies zur Bereitstellung
                einer funktionsfähigen Website sowie unserer Inhalte und vertraglichen Leistungen erforderlich ist. Die
                Verarbeitung personenbezogener Daten unserer Nutzer erfolgt regelmäßig nur nach Einwilligung des Nutzers
                oder soweit die Verarbeitung durch gesetzliche Vorschriften (insb. Art. 6 Abs. 1 DSGVO) gestattet ist.
              </p>
            </div>

            {/* Datenerfassung auf der Website */}
            <div className="rounded-3xl border border-[#EAE5F4] bg-white p-7 shadow-xs space-y-4">
              <div className="flex items-center gap-3">
                <Server className="h-5 w-5 text-[#7437D9]" />
                <h2 className="text-lg font-bold">3. Hosting & Bereitstellung der Plattform</h2>
              </div>
              <p className="text-sm leading-relaxed text-[#494463]">
                Unsere Webanwendung und Backend-Dienste werden in modernen, nach ISO 27001 zertifizierten Rechenzentren
                innerhalb der Europäischen Union (u. a. Google Cloud Region europe-west / Frankfurt / Eemshaven) gehostet.
                Beim Aufrufen unserer Website erfasst der Webserver automatisch technische Informationen (z. B. IP-Adresse,
                Browsertyp, Betriebssystem, Datum und Uhrzeit der Serveranfrage).
              </p>
              <p className="text-sm leading-relaxed text-[#494463]">
                Rechtsgrundlage hierfür ist Art. 6 Abs. 1 lit. f DSGVO. Das berechtigte Interesse liegt in der technisch
                einwandfreien, sicheren und stabilen Bereitstellung unseres Onlineangebots.
              </p>
            </div>

            {/* Kontaktformular */}
            <div className="rounded-3xl border border-[#EAE5F4] bg-white p-7 shadow-xs space-y-4">
              <div className="flex items-center gap-3">
                <Mail className="h-5 w-5 text-[#7437D9]" />
                <h2 className="text-lg font-bold">4. Kontaktformular und E-Mail-Anfragen</h2>
              </div>
              <p className="text-sm leading-relaxed text-[#494463]">
                Wenn du uns per Kontaktformular oder per E-Mail Anfragen zukommen lässt, werden deine Angaben aus dem
                Anfrageformular inklusive der von dir dort angegebenen Kontaktdaten (Name, geschäftliche E-Mail-Adresse,
                Unternehmen, Telefonnummer und deine Nachricht) zwecks Bearbeitung der Anfrage und für den Fall von
                Anschlussfragen bei uns gespeichert.
              </p>
              <p className="text-sm leading-relaxed text-[#494463]">
                Die Verarbeitung dieser Daten erfolgt auf Grundlage von Art. 6 Abs. 1 lit. b DSGVO, sofern deine Anfrage
                mit der Erfüllung eines Vertrags zusammenhängt oder zur Durchführung vorvertraglicher Maßnahmen erforderlich
                ist. In allen übrigen Fällen beruht die Verarbeitung auf unserem berechtigten Interesse an der effektiven
                Bearbeitung der an uns gerichteten Anfragen (Art. 6 Abs. 1 lit. f DSGVO).
              </p>
            </div>

            {/* Mandantennutzung & Projektverwaltung */}
            <div className="rounded-3xl border border-[#EAE5F4] bg-white p-7 shadow-xs space-y-4">
              <div className="flex items-center gap-3">
                <Eye className="h-5 w-5 text-[#7437D9]" />
                <h2 className="text-lg font-bold">5. Nutzung des B2B-Kundenportals (P12 - Aufmaß Cockpit)</h2>
              </div>
              <p className="text-sm leading-relaxed text-[#494463]">
                Für registrierte Handwerksbetriebe und deren Mitarbeiter (Bauleiter, Monteure, kaufmännische Leiter)
                verarbeiten wir Benutzerstammdaten (E-Mail-Adresse, Benutzername, Firmenzugehörigkeit, Rollenzuweisungen)
                sowie projektbezogene Daten (CAD-Pläne, GAEB-Positionen, verbautes Aufmaß, Fotodokumentationen).
              </p>
              <p className="text-sm leading-relaxed text-[#494463]">
                Jeder Mandant ist durch logische Mandantentrennung auf Datenbank- und Storage-Ebene vollständig von anderen
                Kunden isoliert. Daten werden ausschließlich im Rahmen der Erfüllung des SaaS-Nutzungsvertrags
                (Art. 6 Abs. 1 lit. b DSGVO) verarbeitet.
              </p>
            </div>

            {/* Betroffenenrechte */}
            <div className="rounded-3xl border border-[#EAE5F4] bg-white p-7 shadow-xs space-y-4">
              <div className="flex items-center gap-3">
                <Trash2 className="h-5 w-5 text-[#7437D9]" />
                <h2 className="text-lg font-bold">6. Deine Rechte als betroffene Person</h2>
              </div>
              <p className="text-sm leading-relaxed text-[#494463]">
                Du hast nach den Vorschriften der DSGVO jederzeit folgende Rechte gegenüber der P12 Ventures GmbH:
              </p>
              <ul className="list-disc pl-6 space-y-2 text-sm text-[#494463]">
                <li><strong>Recht auf Auskunft (Art. 15 DSGVO):</strong> Auskunft über deine von uns verarbeiteten personenbezogenen Daten.</li>
                <li><strong>Recht auf Berichtigung (Art. 16 DSGVO):</strong> Berichtigung unrichtiger oder Vervollständigung deiner Daten.</li>
                <li><strong>Recht auf Löschung (Art. 17 DSGVO):</strong> Löschung deiner bei uns gespeicherten personenbezogenen Daten.</li>
                <li><strong>Recht auf Einschränkung der Verarbeitung (Art. 18 DSGVO):</strong> Einschränkung der Datenverarbeitung.</li>
                <li><strong>Recht auf Datenübertragbarkeit (Art. 20 DSGVO):</strong> Erhalt deiner Daten in einem strukturierten, gängigen und maschinenlesbaren Format.</li>
                <li><strong>Widerspruchsrecht (Art. 21 DSGVO):</strong> Widerspruch gegen die Verarbeitung deiner Daten.</li>
              </ul>
              <p className="text-sm leading-relaxed text-[#494463]">
                Zur Ausübung deiner Rechte wende dich bitte an: <a href="mailto:info@p12-aufmass.de" className="font-semibold text-[#7437D9] hover:underline">info@p12-aufmass.de</a>.
              </p>
            </div>
          </div>
        </div>
      </main>

      <MarketingFooter />
    </div>
  );
}
