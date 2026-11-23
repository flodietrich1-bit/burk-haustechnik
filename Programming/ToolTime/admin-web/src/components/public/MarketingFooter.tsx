import { Link } from 'react-router-dom';
import { Building2, Mail, MapPin, ExternalLink, ShieldCheck, FileText, Scale } from 'lucide-react';

export function MarketingFooter() {
  const currentYear = new Date().getFullYear();

  return (
    <footer className="border-t border-[#231B4F] bg-[#140E33] text-white">
      {/* Oberer Footer-Bereich */}
      <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 gap-12 lg:grid-cols-12">
          
          {/* Brand & Mission Spalte */}
          <div className="lg:col-span-5 space-y-5">
            <Link to="/" className="inline-block transition hover:opacity-90">
              <img
                src="/p12-aufmass-logo.svg"
                alt="P12 - Aufmaß"
                className="h-8 w-auto brightness-0 invert"
              />
            </Link>

            <p className="max-w-md text-sm leading-relaxed text-[#BDB8D5]">
              Die spezialisierte B2B-Plattform für digitales, VOB-konformes Aufmaß im Handwerk und in der TGA.
              Verbindet GAEB-Leistungsverzeichnisse, digitale CAD-Baupläne und mobile Baustellenerfassung.
            </p>

            <div className="inline-flex items-center gap-2 rounded-2xl border border-[#342A69] bg-[#1E1747] px-4 py-2.5 text-xs text-[#DDD7F4]">
              <Building2 className="h-4 w-4 text-[#A879F5]" />
              <span>
                Eine Plattform der <strong className="font-semibold text-white">P12 Ventures GmbH</strong>
              </span>
            </div>
          </div>

          {/* Mittlere Spalte: Unser Produkt & Navigation */}
          <div className="lg:col-span-3 space-y-4">
            <h3 className="text-xs font-bold uppercase tracking-widest text-[#A879F5]">Plattform</h3>
            <ul className="space-y-3 text-sm text-[#DDD7F4]">
              <li>
                <a href="/#produkt" className="transition hover:text-white">
                  Unser Produkt
                </a>
              </li>
              <li>
                <a href="/#vorteile" className="transition hover:text-white">
                  Vorteile im Baualltag
                </a>
              </li>
              <li>
                <a href="/#ueber-uns" className="transition hover:text-white">
                  Über uns
                </a>
              </li>
              <li>
                <Link to="/invite" className="transition hover:text-white">
                  Einladungscode aktivieren
                </Link>
              </li>
              <li>
                <Link to="/login" className="transition hover:text-white">
                  Kunden-Login
                </Link>
              </li>
            </ul>
          </div>

          {/* Rechte Spalte: Rechtliches & P12 Ventures */}
          <div className="lg:col-span-4 space-y-4">
            <h3 className="text-xs font-bold uppercase tracking-widest text-[#A879F5]">Rechtliches & Betreiber</h3>
            
            <ul className="space-y-3 text-sm text-[#DDD7F4]">
              <li>
                <Link to="/impressum" className="inline-flex items-center gap-2 transition hover:text-white">
                  <FileText className="h-4 w-4 text-[#A879F5]" />
                  <span>Impressum</span>
                </Link>
              </li>
              <li>
                <Link to="/datenschutz" className="inline-flex items-center gap-2 transition hover:text-white">
                  <ShieldCheck className="h-4 w-4 text-[#A879F5]" />
                  <span>Datenschutz (DSGVO)</span>
                </Link>
              </li>
              <li>
                <Link to="/agb" className="inline-flex items-center gap-2 transition hover:text-white">
                  <Scale className="h-4 w-4 text-[#A879F5]" />
                  <span>Allgemeine Geschäftsbedingungen (AGB)</span>
                </Link>
              </li>
              <li className="pt-1">
                <a
                  href="https://p12v.de"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 font-semibold text-[#C49BFF] transition hover:text-white"
                >
                  <Building2 className="h-4 w-4 text-[#C49BFF]" />
                  <span>P12 Ventures GmbH (p12v.de)</span>
                  <ExternalLink className="h-3.5 w-3.5" />
                </a>
              </li>
            </ul>

            {/* Anschrift Box */}
            <div className="mt-6 rounded-2xl border border-[#2B2258] bg-[#1A1340] p-4 text-xs text-[#A9A3C7] space-y-1.5">
              <div className="flex items-start gap-2">
                <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[#A879F5]" />
                <span>Pölitzstraße 12, 04155 Leipzig</span>
              </div>
              <div className="flex items-center gap-2">
                <Mail className="h-3.5 w-3.5 shrink-0 text-[#A879F5]" />
                <a href="mailto:info@p12-aufmass.de" className="hover:text-white text-[#DDD7F4]">
                  info@p12-aufmass.de
                </a>
              </div>
            </div>
          </div>
        </div>

        {/* Trennlinie & Copyright Zeile */}
        <div className="mt-14 flex flex-col items-center justify-between gap-4 border-t border-[#231B4F] pt-8 text-xs text-[#8F88AE] sm:flex-row">
          <p>
            © {currentYear} <strong>P12 Ventures GmbH</strong> · Plattform P12 - Aufmaß · Alle Rechte vorbehalten.
          </p>
          <p>
            Geschäftsführer: Peter Suhayda · Amtsgericht Leipzig HRB 42438
          </p>
        </div>
      </div>
    </footer>
  );
}
