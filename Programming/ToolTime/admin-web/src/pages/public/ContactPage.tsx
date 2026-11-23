import { Link } from 'react-router-dom';
import { ArrowLeft, Mail, Building2, Sparkles } from 'lucide-react';
import { MarketingNavbar } from '../../components/public/MarketingNavbar';
import { MarketingFooter } from '../../components/public/MarketingFooter';
import { ContactForm } from '../../components/public/ContactForm';

export function ContactPage() {
  return (
    <div className="min-h-screen bg-[#FDFCFE] text-[#1F1A4D]">
      <MarketingNavbar />

      <main className="py-12 sm:py-20">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <Link
            to="/"
            className="inline-flex items-center gap-2 text-sm font-semibold text-[#7437D9] transition hover:text-[#5E2BB8]"
          >
            <ArrowLeft className="h-4 w-4" />
            <span>Zurück zur Startseite</span>
          </Link>

          <div className="mt-8 text-center max-w-2xl mx-auto">
            <div className="inline-flex items-center gap-2 rounded-full border border-[#DCD5EC] bg-white px-3.5 py-1 text-xs font-semibold text-[#6B2BD8]">
              <Sparkles className="h-3 w-3" />
              <span>Wir beraten dich gerne</span>
            </div>
            <h1 className="mt-4 text-3xl font-extrabold sm:text-5xl">Sprich mit unserem Team</h1>
            <p className="mt-3 text-base text-[#68647D]">
              Du möchtest P12 - Aufmaß in deinem Handwerksbetrieb testen oder hast Fragen zu Schnittstellen und
              Einsatzmöglichkeiten? Wir sind gerne persönlich für dich da.
            </p>
          </div>

          <div className="mt-14 grid grid-cols-1 gap-12 lg:grid-cols-12">
            {/* Info Column */}
            <div className="lg:col-span-5 space-y-6">
              <div className="rounded-3xl border border-[#EAE5F4] bg-white p-7 shadow-xs">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#7437D9]/10 text-[#7437D9]">
                    <Building2 className="h-5 w-5" />
                  </div>
                  <h2 className="text-lg font-bold">Unternehmenssitz</h2>
                </div>
                <div className="mt-4 space-y-1 text-sm text-[#494463]">
                  <p className="font-bold text-base text-[#1F1A4D]">P12 Ventures GmbH</p>
                  <p>Plattform P12 - Aufmaß</p>
                  <p>Pölitzstraße 12</p>
                  <p>04155 Leipzig · Deutschland</p>
                  <p className="text-xs text-[#8E8A9F] pt-2">Amtsgericht Leipzig · HRB 42438</p>
                </div>
              </div>

              <div className="rounded-3xl border border-[#EAE5F4] bg-white p-7 shadow-xs">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#7437D9]/10 text-[#7437D9]">
                    <Mail className="h-5 w-5" />
                  </div>
                  <h2 className="text-lg font-bold">E-Mail-Kontakt</h2>
                </div>
                <div className="mt-4 space-y-2 text-sm text-[#494463]">
                  <div>
                    <span className="text-xs text-[#8E8A9F] block">Produkt & Support:</span>
                    <a href="mailto:info@p12-aufmass.de" className="font-semibold text-[#7437D9] hover:underline">
                      info@p12-aufmass.de
                    </a>
                  </div>
                  <div>
                    <span className="text-xs text-[#8E8A9F] block">P12 Ventures GmbH:</span>
                    <a href="mailto:info@p12v.de" className="font-semibold text-[#7437D9] hover:underline">
                      info@p12v.de
                    </a>
                  </div>
                </div>
              </div>

              <div className="rounded-3xl border border-[#EAE5F4] bg-[#FAF8FE] p-7 text-sm text-[#544E6E]">
                <h3 className="font-bold text-[#1F1A4D]">Direkter Ansprechpartner</h3>
                <p className="mt-1">
                  Geschäftsführer: <strong>Peter Suhayda</strong>
                </p>
                <p className="mt-2 text-xs text-[#7B7692] leading-relaxed">
                  Gerne führen wir eine individuelle 20-minütige Online-Demo durch und zeigen, wie eure GAEB-Dateien und
                  Pläne direkt verarbeitet werden.
                </p>
              </div>
            </div>

            {/* Form Column */}
            <div className="lg:col-span-7">
              <ContactForm />
            </div>
          </div>
        </div>
      </main>

      <MarketingFooter />
    </div>
  );
}
