import { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Menu, X, ArrowRight, LogIn, Sparkles, KeyRound } from 'lucide-react';
import { useAuth } from '../../auth/AuthProvider';

export function MarketingNavbar() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const { user } = useAuth();
  const location = useLocation();

  const isHome = location.pathname === '/';

  function scrollToSection(id: string) {
    setMobileMenuOpen(false);
    if (!isHome) {
      window.location.href = `/#${id}`;
      return;
    }
    const el = document.getElementById(id);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth' });
    }
  }

  return (
    <header className="sticky top-0 z-50 border-b border-[#EAE5F4] bg-white/95 backdrop-blur-md transition">
      <div className="mx-auto flex h-20 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
        
        {/* Brand Logo mit dezentem Subtitle darunter */}
        <div className="flex flex-col justify-center">
          <Link to="/" className="group flex flex-col items-start transition">
            <img src="/p12-aufmass-logo.svg" alt="P12 - Aufmaß" className="h-7 w-auto sm:h-8" />
            <span className="mt-0.5 text-[11px] font-medium tracking-tight text-[#797394] transition group-hover:text-[#6B2BD8]">
              Eine Plattform der <strong className="font-semibold text-[#544D73]">P12 Ventures GmbH (p12v.de)</strong>
            </span>
          </Link>
        </div>

        {/* Desktop Nav Links: Unser Produkt, Vorteile, Über uns, P12 Ventures (kein Kontakt im Header) */}
        <nav className="hidden items-center gap-8 text-sm font-semibold text-[#1F1A4D] lg:flex">
          <button
            type="button"
            onClick={() => scrollToSection('produkt')}
            className="cursor-pointer transition hover:text-[#7437D9]"
          >
            Unser Produkt
          </button>
          <button
            type="button"
            onClick={() => scrollToSection('vorteile')}
            className="cursor-pointer transition hover:text-[#7437D9]"
          >
            Vorteile
          </button>
          <button
            type="button"
            onClick={() => scrollToSection('ueber-uns')}
            className="cursor-pointer transition hover:text-[#7437D9]"
          >
            Über uns
          </button>
          <button
            type="button"
            onClick={() => scrollToSection('p12-ventures')}
            className="cursor-pointer transition hover:text-[#7437D9]"
          >
            P12 Ventures
          </button>
        </nav>

        {/* Rechte Seite: 2 schöne, konsistent gestylte Buttons */}
        <div className="hidden items-center gap-3 md:flex">
          {/* Button 1: Einladung aktivieren */}
          <Link
            to="/invite"
            className="inline-flex h-10 items-center justify-center gap-1.5 rounded-xl border border-[#DDD5EF] bg-white px-4 text-xs font-semibold text-[#1F1A4D] shadow-2xs transition hover:border-[#7437D9] hover:bg-[#F9F7FD] hover:text-[#7437D9]"
          >
            <KeyRound className="h-3.5 w-3.5 text-[#8E8A9F]" />
            <span>Einladung aktivieren</span>
          </Link>

          {/* Button 2: Login / Cockpit */}
          {user ? (
            <Link
              to="/t/p12"
              className="inline-flex h-10 items-center justify-center gap-2 rounded-xl bg-[#7437D9] px-5 text-xs font-bold text-white shadow-[0_4px_14px_0_rgba(116,55,217,0.35)] transition hover:bg-[#6228be] hover:shadow-[0_6px_20px_rgba(116,55,217,0.45)]"
            >
              <Sparkles className="h-3.5 w-3.5" />
              <span>Zum Cockpit</span>
            </Link>
          ) : (
            <Link
              to="/login"
              className="inline-flex h-10 items-center justify-center gap-2 rounded-xl bg-[#7437D9] px-5 text-xs font-bold text-white shadow-[0_4px_14px_0_rgba(116,55,217,0.35)] transition hover:bg-[#6228be] hover:shadow-[0_6px_20px_rgba(116,55,217,0.45)]"
            >
              <LogIn className="h-3.5 w-3.5" />
              <span>Login</span>
            </Link>
          )}
        </div>

        {/* Mobile Menü Button */}
        <div className="flex items-center gap-2 md:hidden">
          <Link
            to={user ? "/t/p12" : "/login"}
            className="rounded-lg bg-[#7437D9] px-3 py-1.5 text-xs font-semibold text-white"
          >
            {user ? "Cockpit" : "Login"}
          </Link>
          <button
            type="button"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="rounded-xl p-2 text-[#1F1A4D] hover:bg-[#F7F5FC]"
            aria-label="Navigation öffnen"
          >
            {mobileMenuOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
          </button>
        </div>
      </div>

      {/* Mobile Drawer */}
      {mobileMenuOpen && (
        <div className="border-b border-[#EAE5F4] bg-white px-4 py-6 shadow-xl md:hidden">
          <nav className="flex flex-col gap-4 text-base font-semibold text-[#1F1A4D]">
            <button
              type="button"
              onClick={() => scrollToSection('produkt')}
              className="text-left py-1 hover:text-[#7437D9]"
            >
              Unser Produkt
            </button>
            <button
              type="button"
              onClick={() => scrollToSection('vorteile')}
              className="text-left py-1 hover:text-[#7437D9]"
            >
              Vorteile
            </button>
            <button
              type="button"
              onClick={() => scrollToSection('ueber-uns')}
              className="text-left py-1 hover:text-[#7437D9]"
            >
              Über uns
            </button>
            <button
              type="button"
              onClick={() => scrollToSection('p12-ventures')}
              className="text-left py-1 hover:text-[#7437D9]"
            >
              P12 Ventures
            </button>
            <div className="mt-4 flex flex-col gap-2.5 border-t border-[#EAE5F4] pt-4">
              <Link
                to="/invite"
                onClick={() => setMobileMenuOpen(false)}
                className="flex items-center justify-center gap-2 rounded-xl border border-[#DDD5EF] bg-white py-2.5 text-sm font-semibold text-[#1F1A4D]"
              >
                <KeyRound className="h-4 w-4 text-[#8E8A9F]" />
                <span>Einladung aktivieren</span>
              </Link>
              <Link
                to={user ? "/t/p12" : "/login"}
                onClick={() => setMobileMenuOpen(false)}
                className="flex items-center justify-center gap-2 rounded-xl bg-[#7437D9] py-2.5 text-sm font-semibold text-white"
              >
                <span>{user ? "Direkt zum Cockpit" : "Zum Login"}</span>
                <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
          </nav>
        </div>
      )}
    </header>
  );
}
