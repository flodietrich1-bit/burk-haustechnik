import { Link } from 'react-router-dom';
import {
  FileSpreadsheet,
  Layers,
  Smartphone,
  CheckCircle,
  FileCheck2,
  TrendingUp,
  Building2,
  ShieldCheck,
  Zap,
  ArrowRight,
  ExternalLink,
  Users2,
  Clock,
  Sparkles,
  ChevronRight,
  Database
} from 'lucide-react';
import { MarketingNavbar } from '../../components/public/MarketingNavbar';
import { MarketingFooter } from '../../components/public/MarketingFooter';
import { ContactForm } from '../../components/public/ContactForm';

export function LandingPage() {
  return (
    <div className="min-h-screen bg-[#FDFCFE] text-[#1F1A4D]">
      <MarketingNavbar />

      {/* HERO SECTION */}
      <section className="relative overflow-hidden bg-gradient-to-b from-[#F7F4FD] via-[#FAF8FE] to-white pb-20 pt-16 sm:pb-28 sm:pt-24 lg:pb-32">
        <div className="absolute inset-0 pointer-events-none opacity-40">
          <div className="absolute -left-20 top-10 h-72 w-72 rounded-full bg-[#7437D9]/15 blur-3xl" />
          <div className="absolute right-0 top-32 h-96 w-96 rounded-full bg-[#3B82C4]/15 blur-3xl" />
        </div>

        <div className="relative mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="text-center">
            {/* Top Badge */}
            <div className="inline-flex items-center gap-2 rounded-full border border-[#DCD5EC] bg-white px-4 py-1.5 text-xs font-semibold text-[#6B2BD8] shadow-sm">
              <Sparkles className="h-3.5 w-3.5 text-[#7437D9]" />
              <span>Digitales VOB-Aufmaß & TGA-Baustellenbilanz</span>
            </div>

            {/* Main Headline */}
            <h1 className="mx-auto mt-6 max-w-4xl text-4xl font-extrabold tracking-tight sm:text-6xl lg:text-7xl">
              VOB-konformes Aufmaß in Rekordzeit.{' '}
              <span className="bg-gradient-to-r from-[#7437D9] via-[#8E51ED] to-[#3B82C4] bg-clip-text text-transparent">
                Vom CAD-Plan bis zur Schlussrechnung.
              </span>
            </h1>

            {/* Subtitle */}
            <p className="mx-auto mt-6 max-w-2xl text-lg leading-relaxed text-[#5F5A77] sm:text-xl">
              Keine Zettelwirtschaft, kein Excel-Chaos und keine Abrechnungsstreitigkeiten mehr. P12 - Aufmaß
              verbindet GAEB-Leistungsverzeichnisse, digitale CAD-Baupläne und mobile Baustellen-Erfassung in einer
              durchgängigen B2B-Plattform.
            </p>

            {/* CTA Buttons */}
            <div className="mt-10 flex flex-col items-center justify-center gap-4 sm:flex-row">
              <a
                href="#kontakt"
                className="flex h-13 w-full items-center justify-center gap-2 rounded-2xl bg-[#7437D9] px-7 text-sm font-bold text-white shadow-[0_12px_24px_-8px_rgba(116,55,217,0.5)] transition hover:bg-[#6228be] sm:w-auto"
              >
                <span>Demo anfragen</span>
                <ArrowRight className="h-4 w-4" />
              </a>

              <Link
                to="/login"
                className="flex h-13 w-full items-center justify-center gap-2 rounded-2xl border border-[#D5CEE8] bg-white px-7 text-sm font-bold text-[#1F1A4D] shadow-sm transition hover:bg-[#F7F5FC] sm:w-auto"
              >
                <span>Zum Cockpit-Login</span>
                <ChevronRight className="h-4 w-4 text-[#7437D9]" />
              </Link>
            </div>

            {/* Highlights Pills */}
            <div className="mt-14 flex flex-wrap items-center justify-center gap-2.5 sm:gap-4 text-xs font-semibold text-[#544E6E]">
              <span className="flex items-center gap-1.5 rounded-full border border-[#E4DEF2] bg-white/80 px-3 py-1.5 shadow-2xs">
                <CheckCircle className="h-3.5 w-3.5 text-[#2FA36B]" /> GAEB XML / D83 / X81
              </span>
              <span className="flex items-center gap-1.5 rounded-full border border-[#E4DEF2] bg-white/80 px-3 py-1.5 shadow-2xs">
                <CheckCircle className="h-3.5 w-3.5 text-[#2FA36B]" /> CAD 2D/3D & DWG-Viewer
              </span>
              <span className="flex items-center gap-1.5 rounded-full border border-[#E4DEF2] bg-white/80 px-3 py-1.5 shadow-2xs">
                <CheckCircle className="h-3.5 w-3.5 text-[#2FA36B]" /> Offline Monteur-App (TTApp)
              </span>
              <span className="flex items-center gap-1.5 rounded-full border border-[#E4DEF2] bg-white/80 px-3 py-1.5 shadow-2xs">
                <CheckCircle className="h-3.5 w-3.5 text-[#2FA36B]" /> 100% DSGVO-konform (EU-Cloud)
              </span>
            </div>
          </div>
        </div>
      </section>

      {/* CORE PRODUCT FEATURES */}
      <section id="produkt" className="scroll-mt-24 py-20 sm:py-28 bg-white border-y border-[#EAE5F4]">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="text-center">
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-[#7437D9]">
              Unser Produkt
            </p>
            <h2 className="mt-3 text-3xl font-extrabold tracking-tight sm:text-4xl lg:text-5xl">
              Durchgängige Wertschöpfung vom Angebot bis zur Abnahme
            </h2>
            <p className="mx-auto mt-4 max-w-2xl text-base text-[#68647D]">
              Entwickelt, um die typischen Soll-Ist-Konflikte zwischen Baustelle, Bauleitung und kaufmännischer
              Abrechnung dauerhaft zu lösen.
            </p>
          </div>

          <div className="mt-16 grid grid-cols-1 gap-8 md:grid-cols-2 lg:grid-cols-3">
            {/* Feature 1 */}
            <div className="group rounded-3xl border border-[#EAE5F4] bg-[#FAF8FE] p-8 transition hover:border-[#7437D9]/40 hover:bg-white hover:shadow-xl">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#7437D9]/10 text-[#7437D9] transition group-hover:bg-[#7437D9] group-hover:text-white">
                <FileSpreadsheet className="h-6 w-6" />
              </div>
              <h3 className="mt-6 text-xl font-bold">1. GAEB-Import & Struktur</h3>
              <p className="mt-3 text-sm leading-relaxed text-[#68647D]">
                Importiere Leistungsverzeichnisse in den Standards GAEB 90, GAEB 2000 und GAEB XML (.d83, .x81).
                Alle Positionen, Mengengerüste, Einheiten und Soll-Werte stehen sofort digital bereit.
              </p>
            </div>

            {/* Feature 2 */}
            <div className="group rounded-3xl border border-[#EAE5F4] bg-[#FAF8FE] p-8 transition hover:border-[#7437D9]/40 hover:bg-white hover:shadow-xl">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#3B82C4]/10 text-[#3B82C4] transition group-hover:bg-[#3B82C4] group-hover:text-white">
                <Layers className="h-6 w-6" />
              </div>
              <h3 className="mt-6 text-xl font-bold">2. CAD & DWG-Planviewer</h3>
              <p className="mt-3 text-sm leading-relaxed text-[#68647D]">
                Lade Ausführungspläne (.dwg, .dxf) direkt hoch. Das System erkennt automatisch Geschosse und
                Raumstrukturen. Bauteile und Messpunkte lassen sich exakt verorten.
              </p>
            </div>

            {/* Feature 3 */}
            <div className="group rounded-3xl border border-[#EAE5F4] bg-[#FAF8FE] p-8 transition hover:border-[#7437D9]/40 hover:bg-white hover:shadow-xl">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#2FA36B]/10 text-[#2FA36B] transition group-hover:bg-[#2FA36B] group-hover:text-white">
                <Smartphone className="h-6 w-6" />
              </div>
              <h3 className="mt-6 text-xl font-bold">3. Mobile Monteur-App (TTApp)</h3>
              <p className="mt-3 text-sm leading-relaxed text-[#68647D]">
                Deine Monteure erfassen eingebaute Mengen direkt vor Ort auf dem Smartphone oder Tablet – mit Fotos,
                Offline-Speicherung und sekundenschneller Synchronisation ins Büro.
              </p>
            </div>

            {/* Feature 4 */}
            <div className="group rounded-3xl border border-[#EAE5F4] bg-[#FAF8FE] p-8 transition hover:border-[#7437D9]/40 hover:bg-white hover:shadow-xl">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#7437D9]/10 text-[#7437D9] transition group-hover:bg-[#7437D9] group-hover:text-white">
                <FileCheck2 className="h-6 w-6" />
              </div>
              <h3 className="mt-6 text-xl font-bold">4. VOB-Raumabschluss</h3>
              <p className="mt-3 text-sm leading-relaxed text-[#68647D]">
                Raum für Raum sauber abschließen. Das System berechnet das exakte Mengen-Delta zwischen Ausschreibung
                und tatsächlichem Einbau für eine lückenlose Dokumentation.
              </p>
            </div>

            {/* Feature 5 */}
            <div className="group rounded-3xl border border-[#EAE5F4] bg-[#FAF8FE] p-8 transition hover:border-[#7437D9]/40 hover:bg-white hover:shadow-xl">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#E54D42]/10 text-[#E54D42] transition group-hover:bg-[#E54D42] group-hover:text-white">
                <TrendingUp className="h-6 w-6" />
              </div>
              <h3 className="mt-6 text-xl font-bold">5. Nachtragsmanagement</h3>
              <p className="mt-3 text-sm leading-relaxed text-[#68647D]">
                Mehr- und Mindermengen werden sofort sichtbar. Nachträge können direkt vom Bauleiter angestoßen und
                kaufmännisch freigegeben werden, bevor unbezahlte Mehrarbeit entsteht.
              </p>
            </div>

            {/* Feature 6 */}
            <div className="group rounded-3xl border border-[#EAE5F4] bg-[#FAF8FE] p-8 transition hover:border-[#7437D9]/40 hover:bg-white hover:shadow-xl">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#8E51ED]/10 text-[#8E51ED] transition group-hover:bg-[#8E51ED] group-hover:text-white">
                <Zap className="h-6 w-6" />
              </div>
              <h3 className="mt-6 text-xl font-bold">6. Baustellenbilanz per Klick</h3>
              <p className="mt-3 text-sm leading-relaxed text-[#68647D]">
                Erstelle prüffähige Aufmaßblätter als druckfertige DIN A4 PDF und detaillierte Excel-Exportdateien für
                den Auftraggeber oder die interne Nachkalkulation.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* VORTEILE SECTION */}
      <section id="vorteile" className="scroll-mt-24 py-20 sm:py-28 bg-[#F7F5FC]">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 items-center gap-12 lg:grid-cols-2">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.2em] text-[#7437D9]">
                Konkreter Nutzen im Alltag
              </p>
              <h2 className="mt-3 text-3xl font-extrabold tracking-tight sm:text-4xl">
                Warum führende TGA-Betriebe auf P12 - Aufmaß setzen
              </h2>
              <p className="mt-4 text-base leading-relaxed text-[#68647D]">
                Herkömmliches Aufmaß kostet Bauleiter und Monteure unzählige Arbeitsstunden und birgt enormes
                Risiko für Honorarverluste. P12 - Aufmaß schafft Transparenz und spart bares Geld.
              </p>

              <div className="mt-8 space-y-4">
                <div className="flex items-start gap-4 rounded-2xl bg-white p-4 shadow-2xs">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#2FA36B]/15 text-[#2FA36B]">
                    <Clock className="h-5 w-5" />
                  </div>
                  <div>
                    <h4 className="font-bold">Bis zu 70% Zeitersparnis bei der Abrechnung</h4>
                    <p className="mt-1 text-sm text-[#68647D]">
                      Mengen müssen nicht mehrfach manuell aus Zetteln in Excel abgetippt werden.
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-4 rounded-2xl bg-white p-4 shadow-2xs">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#7437D9]/15 text-[#7437D9]">
                    <ShieldCheck className="h-5 w-5" />
                  </div>
                  <div>
                    <h4 className="font-bold">Keine strittigen Mengen & lückenlose Fotobeweise</h4>
                    <p className="mt-1 text-sm text-[#68647D]">
                      Jedes Aufmaß ist raum- und bauteilbezogen mit Zeitstempel und Bilddokumentation belegt.
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-4 rounded-2xl bg-white p-4 shadow-2xs">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#3B82C4]/15 text-[#3B82C4]">
                    <Users2 className="h-5 w-5" />
                  </div>
                  <div>
                    <h4 className="font-bold">Echte Zusammenarbeit zwischen Baustelle & Büro</h4>
                    <p className="mt-1 text-sm text-[#68647D]">
                      Bauleiter, Projektleiter und Monteure arbeiten rollenbasiert im selben Datensatz.
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Visual Callout Box */}
            <div className="rounded-3xl border border-[#E0D8EE] bg-white p-8 shadow-xl lg:p-10">
              <div className="flex items-center gap-3">
                <div className="h-3 w-3 rounded-full bg-red-400" />
                <div className="h-3 w-3 rounded-full bg-amber-400" />
                <div className="h-3 w-3 rounded-full bg-green-400" />
                <span className="ml-2 font-mono text-xs text-[#8E8A9F]">P12 Aufmaß Cockpit Live-Übersicht</span>
              </div>

              <div className="mt-6 rounded-2xl border border-[#EAE5F4] bg-[#FBF9FE] p-6">
                <div className="flex items-center justify-between border-b border-[#EAE5F4] pb-4">
                  <div>
                    <p className="text-xs font-semibold text-[#8E8A9F]">Beispiel-Projekt</p>
                    <p className="font-bold text-[#1F1A4D]">Hallenbad Weingarten – TGA Sanitär</p>
                  </div>
                  <span className="rounded-full bg-[#2FA36B]/15 px-3 py-1 text-xs font-bold text-[#2FA36B]">
                    98.4% Erfasst
                  </span>
                </div>

                <div className="mt-4 space-y-3 text-sm">
                  <div className="flex items-center justify-between">
                    <span className="text-[#68647D]">GAEB-Sollmenge (X81):</span>
                    <span className="font-bold">1.420 m Rohrleitung</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-[#68647D]">Montiert & bestätigt:</span>
                    <span className="font-bold text-[#2FA36B]">1.398 m</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-[#68647D]">Nachtrags-Delta:</span>
                    <span className="font-bold text-[#7437D9]">+42 m (geprüft)</span>
                  </div>
                </div>

                <div className="mt-5 rounded-xl bg-white p-3.5 border border-[#EAE5F4] text-xs text-[#524C6D]">
                  ✓ Aufmaßblatt DIN A4 generiert und kaufmännisch freigegeben.
                </div>
              </div>

              <div className="mt-6 text-center">
                <a
                  href="#kontakt"
                  className="inline-flex items-center gap-2 text-sm font-bold text-[#7437D9] hover:underline"
                >
                  <span>Möchtest du sehen, wie das in deinem Betrieb aussieht?</span>
                  <ArrowRight className="h-4 w-4" />
                </a>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* DIE VERBINDUNG ZU P12 VENTURES (P12V.de) */}
      <section id="p12-ventures" className="scroll-mt-24 py-20 sm:py-28 bg-[#1B1542] text-white">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="rounded-3xl border border-[#3C346B] bg-[#231C54] p-8 sm:p-12 lg:p-16">
            <div className="grid grid-cols-1 items-center gap-10 lg:grid-cols-12">
              <div className="lg:col-span-8">
                <div className="inline-flex items-center gap-2 rounded-full border border-[#524888] bg-[#2B2366] px-3.5 py-1 text-xs font-semibold text-[#C49BFF]">
                  <Building2 className="h-3.5 w-3.5" />
                  <span>Plattform & Venture Studio</span>
                </div>

                <h2 className="mt-4 text-3xl font-extrabold tracking-tight sm:text-4xl text-white">
                  P12 - Aufmaß ist eine spezialisierte Plattform der P12 Ventures GmbH
                </h2>

                <p className="mt-4 text-base leading-relaxed text-[#DDD5EF]">
                  Hinter P12 - Aufmaß steht die <strong>P12 Ventures GmbH</strong> (
                  <a
                    href="https://p12v.de"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="underline text-white font-semibold hover:text-[#C49BFF]"
                  >
                    p12v.de
                  </a>
                  ) unter der Leitung von Geschäftsführer <strong>Peter Suhayda</strong>. P12 Ventures baut,
                  finanziert und skaliert hochspezialisierte Softwarelösungen für den Mittelstand, Handwerksunternehmen
                  und die Bauwirtschaft.
                </p>

                <p className="mt-3 text-base leading-relaxed text-[#BDB4D8]">
                  Unsere Philosophie verbindet tiefe Branchenkenntnis im Handwerk mit moderner Cloud-Technologie,
                  höchsten Sicherheitsstandards und intuitiver Bedienbarkeit auf der Baustelle.
                </p>

                <div className="mt-8 flex flex-wrap items-center gap-4">
                  <a
                    href="https://p12v.de"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 rounded-xl bg-white px-5 py-3 text-sm font-bold text-[#1B1542] transition hover:bg-[#F0EBFA]"
                  >
                    <span>P12 Ventures auf p12v.de entdecken</span>
                    <ExternalLink className="h-4 w-4" />
                  </a>

                  <Link
                    to="/impressum"
                    className="inline-flex items-center gap-2 rounded-xl border border-[#4C4282] px-5 py-3 text-sm font-semibold text-[#DDD5EF] transition hover:border-white hover:text-white"
                  >
                    <span>Impressum & Unternehmensdaten</span>
                  </Link>
                </div>
              </div>

              <div className="lg:col-span-4">
                <div className="rounded-2xl border border-[#3E3572] bg-[#18133D] p-6 text-sm text-[#DDD5EF] space-y-4">
                  <h4 className="font-bold text-white text-base">Unternehmensfakten</h4>
                  <div className="border-t border-[#2D2659] pt-3">
                    <p className="text-xs text-[#9C94C0]">Betreiberin der Plattform</p>
                    <p className="font-semibold text-white">P12 Ventures GmbH</p>
                  </div>
                  <div className="border-t border-[#2D2659] pt-3">
                    <p className="text-xs text-[#9C94C0]">Geschäftsführung</p>
                    <p className="font-semibold text-white">Peter Suhayda</p>
                  </div>
                  <div className="border-t border-[#2D2659] pt-3">
                    <p className="text-xs text-[#9C94C0]">Sitz & Register</p>
                    <p className="font-semibold text-white">Pölitzstraße 12, 04155 Leipzig</p>
                    <p className="text-xs text-[#9C94C0] mt-0.5">Amtsgericht Leipzig · HRB 42438</p>
                  </div>
                  <div className="border-t border-[#2D2659] pt-3">
                    <p className="text-xs text-[#9C94C0]">Digitalisierungsfokus</p>
                    <p className="font-semibold text-white">TGA, Handwerk, SaaS & B2B-Plattformen</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ÜBER UNS SECTION */}
      <section id="ueber-uns" className="scroll-mt-24 py-20 sm:py-28 bg-white">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-3xl text-center">
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-[#7437D9]">Über uns</p>
            <h2 className="mt-3 text-3xl font-extrabold tracking-tight sm:text-4xl">
              Entstanden aus den echten Schmerzpunkten der Baustelle
            </h2>
            <p className="mt-4 text-base leading-relaxed text-[#68647D]">
              P12 - Aufmaß wurde nicht am Reißbrett eines Konzerns erfunden, sondern im intensiven Austausch mit
              Projektleitern, TGA-Fachbetrieben und Monteuren direkt vor Ort.
            </p>
          </div>

          <div className="mt-14 grid grid-cols-1 gap-8 md:grid-cols-3">
            <div className="rounded-3xl border border-[#EAE5F4] bg-[#FAF8FE] p-7 text-center">
              <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-[#7437D9]/10 text-[#7437D9]">
                <Users2 className="h-7 w-7" />
              </div>
              <h3 className="mt-5 text-lg font-bold">Praxisnah entwickelt</h3>
              <p className="mt-2 text-sm text-[#68647D]">
                Gemeinsam mit Haustechnik-Unternehmen getestet und für den echten Baustellenalltag optimiert.
              </p>
            </div>

            <div className="rounded-3xl border border-[#EAE5F4] bg-[#FAF8FE] p-7 text-center">
              <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-[#2FA36B]/10 text-[#2FA36B]">
                <Database className="h-7 w-7" />
              </div>
              <h3 className="mt-5 text-lg font-bold">Mandanten-Architektur</h3>
              <p className="mt-2 text-sm text-[#68647D]">
                Jeder Handwerksbetrieb erhält seinen isolierten, sicheren Firmenbereich mit eigenem Branding und
                Rollenmodell.
              </p>
            </div>

            <div className="rounded-3xl border border-[#EAE5F4] bg-[#FAF8FE] p-7 text-center">
              <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-[#3B82C4]/10 text-[#3B82C4]">
                <ShieldCheck className="h-7 w-7" />
              </div>
              <h3 className="mt-5 text-lg font-bold">Sicherheit & DSGVO</h3>
              <p className="mt-2 text-sm text-[#68647D]">
                Gehostet auf europäischen Servern, SSL-verschlüsselt und konform mit den strengsten Vorgaben der DSGVO.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* KONTAKT SECTION MIT FORMULAR */}
      <section id="kontakt" className="scroll-mt-24 py-20 sm:py-28 bg-[#F7F5FC] border-t border-[#EAE5F4]">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 gap-12 lg:grid-cols-12">
            <div className="lg:col-span-5">
              <p className="text-xs font-bold uppercase tracking-[0.2em] text-[#7437D9]">Kontakt & Beratung</p>
              <h2 className="mt-3 text-3xl font-extrabold tracking-tight sm:text-4xl">
                Bereit für ein einfacheres Aufmaß?
              </h2>
              <p className="mt-4 text-base leading-relaxed text-[#68647D]">
                Lass uns unverbindlich darüber sprechen, wie P12 - Aufmaß deine Baustellenprozesse beschleunigen
                kann. Gerne richten wir einen Testzugang für dein Unternehmen ein.
              </p>

              <div className="mt-8 space-y-4 text-sm text-[#494463]">
                <div className="rounded-2xl border border-[#EAE5F4] bg-white p-4 shadow-2xs">
                  <h4 className="font-bold text-[#1F1A4D]">Direkter Ansprechpartner:</h4>
                  <p className="mt-1 text-[#68647D]">Peter Suhayda (Geschäftsführer)</p>
                  <p className="mt-1">
                    E-Mail:{' '}
                    <a href="mailto:info@p12-aufmass.de" className="font-semibold text-[#7437D9] hover:underline">
                      info@p12-aufmass.de
                    </a>
                  </p>
                </div>

                <div className="rounded-2xl border border-[#EAE5F4] bg-white p-4 shadow-2xs">
                  <h4 className="font-bold text-[#1F1A4D]">Postanschrift:</h4>
                  <p className="mt-1 text-[#68647D]">
                    P12 Ventures GmbH<br />
                    Pölitzstraße 12<br />
                    04155 Leipzig
                  </p>
                </div>
              </div>
            </div>

            <div className="lg:col-span-7">
              <ContactForm />
            </div>
          </div>
        </div>
      </section>

      <MarketingFooter />
    </div>
  );
}
