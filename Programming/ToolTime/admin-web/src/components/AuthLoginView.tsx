import { useState, type FormEvent } from 'react';
import { AlertCircle, ArrowRight, ClipboardCheck, FileText, FolderKanban, LockKeyhole, Mail } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useAuth } from '../auth/AuthProvider';
import './AuthLoginView.css';

const features = [
  { icon: FolderKanban, title: 'Projekte im Blick', text: 'Pläne, Beteiligte und Fortschritt an einem Ort.' },
  { icon: ClipboardCheck, title: 'Aufmaß digital erfassen', text: 'Mengen und Leistungen direkt im Projekt dokumentieren.' },
  { icon: FileText, title: 'Ergebnisse weitergeben', text: 'Aufmaße und Auswertungen für die weitere Bearbeitung bereitstellen.' },
];

export function AuthLoginView() {
  const { login } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault(); setBusy(true); setError('');
    try { await login(email, password); }
    catch (loginError) {
      const code = typeof loginError === 'object' && loginError && 'code' in loginError ? String(loginError.code) : '';
      setError(code === 'auth/network-request-failed' ? 'Der Auth-Dienst ist nicht erreichbar. Bitte prüfe den lokalen Server auf Port 9099 und versuche es erneut.' : 'Anmeldung fehlgeschlagen. Bitte E-Mail und Passwort prüfen.');
    }
    finally { setBusy(false); }
  }

  return <main className="p12-login min-h-screen bg-[#F7F5FC] text-[#1F1A4D] lg:grid lg:grid-cols-2">
    <section className="p12-login-panel flex min-h-[620px] flex-col px-6 py-7 sm:px-10 lg:min-h-screen lg:px-[clamp(2.5rem,6vw,7rem)] lg:py-10">
      <img src="/p12-aufmass-logo.svg" alt="P12 Aufmaß" className="p12-login-logo h-auto w-[220px] max-w-full sm:w-[260px]" />
      <div className="p12-login-content mx-auto flex w-full max-w-[440px] flex-1 flex-col justify-center py-12 lg:py-16">
        <div className="mb-9">
          <p className="mb-4 text-xs font-bold uppercase tracking-[0.2em] text-[#7437D9]">Willkommen zurück</p>
          <h1 className="text-4xl font-semibold tracking-tight sm:text-[2.75rem]">Bei P12 Aufmaß anmelden</h1>
          <p className="mt-4 max-w-sm text-base leading-7 text-[#68647D]">Melde dich an und arbeite an deinen Projekten, Aufmaßen und Auswertungen weiter.</p>
        </div>
        <form onSubmit={submit} className="p12-login-form rounded-[28px] border border-[#EAE5F4] bg-white p-6 shadow-[0_22px_65px_-36px_rgba(31,26,77,0.35)] sm:p-8">
          {error && <div role="alert" className="flex gap-3 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700"><AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />{error}</div>}
          <label className="block"><span className="text-sm font-semibold">E-Mail-Adresse</span><span className="mt-2 flex h-12 items-center gap-3 rounded-xl border border-[#DDD8E9] bg-white px-4 transition focus-within:border-[#7437D9] focus-within:ring-2 focus-within:ring-[#7437D9]/15"><Mail aria-hidden="true" className="h-4 w-4 shrink-0 text-[#89859D]"/><input className="min-w-0 flex-1 bg-transparent text-[#1F1A4D] outline-none placeholder:text-[#A7A3B4]" type="email" autoComplete="username" placeholder="name@firma.de" value={email} onChange={e => setEmail(e.target.value)} required /></span></label>
          <label className="block"><span className="text-sm font-semibold">Passwort</span><span className="mt-2 flex h-12 items-center gap-3 rounded-xl border border-[#DDD8E9] bg-white px-4 transition focus-within:border-[#7437D9] focus-within:ring-2 focus-within:ring-[#7437D9]/15"><LockKeyhole aria-hidden="true" className="h-4 w-4 shrink-0 text-[#89859D]"/><input className="min-w-0 flex-1 bg-transparent text-[#1F1A4D] outline-none placeholder:text-[#A7A3B4]" type="password" autoComplete="current-password" placeholder="Dein Passwort" value={password} onChange={e => setPassword(e.target.value)} required /></span></label>
          <button disabled={busy} className="flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-[#7437D9] px-4 font-semibold text-white transition hover:bg-[#6026BC] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#7437D9] disabled:cursor-wait disabled:opacity-60">{busy ? 'Anmeldung läuft …' : 'Anmelden'}{!busy && <ArrowRight aria-hidden="true" className="h-4 w-4"/>}</button>
        </form>
        <p className="mt-6 text-center text-sm text-[#777389]">Du hast einen Aktivierungscode? <Link to="/invite" className="font-semibold text-[#7437D9] underline underline-offset-2">Einladung annehmen</Link></p>
      </div>
      <p className="text-xs text-[#89859D]">© P12 Aufmaß</p>
    </section>
    <aside className="p12-login-info relative isolate overflow-hidden bg-[#1F1A4D] px-6 py-16 text-white sm:px-10 lg:flex lg:min-h-screen lg:items-center lg:px-[clamp(2.5rem,6vw,7rem)]" aria-label="Über P12 Aufmaß">
      <div aria-hidden="true" className="pointer-events-none absolute -right-32 -top-32 -z-10 h-[480px] w-[480px] rounded-full bg-[#7636DC]/45 blur-[100px]"/>
      <div aria-hidden="true" className="pointer-events-none absolute -bottom-48 -left-40 -z-10 h-[480px] w-[480px] rounded-full bg-[#9D5CF5]/30 blur-[110px]"/>
      <div className="mx-auto w-full max-w-[550px]">
        <p className="mb-6 inline-flex rounded-full border border-white/20 bg-white/10 px-4 py-2 text-xs font-semibold uppercase tracking-[0.16em] text-[#D9C5FF]">Das digitale Aufmaß für Bauprojekte</p>
        <h2 className="max-w-xl text-4xl font-light leading-[1.12] tracking-tight sm:text-5xl xl:text-6xl">Vom Plan bis zum <span className="font-semibold text-[#B98AFF]">fertigen Aufmaß.</span></h2>
        <p className="mt-6 max-w-lg text-base leading-8 text-[#D3CEE7]">P12 Aufmaß verbindet Projektorganisation, digitale Erfassung und nachvollziehbare Auswertungen. So arbeiten Büro, Bauleitung und Monteure auf einer gemeinsamen Grundlage.</p>
        <div className="mt-10 grid gap-5 sm:grid-cols-3 lg:grid-cols-1 xl:grid-cols-3">
          {features.map(({ icon: Icon, title, text }) => <div key={title} className="rounded-2xl border border-white/15 bg-white/[0.07] p-5 backdrop-blur-sm"><Icon aria-hidden="true" className="mb-5 h-6 w-6 text-[#B98AFF]"/><h3 className="font-semibold">{title}</h3><p className="mt-2 text-sm leading-6 text-[#D3CEE7]">{text}</p></div>)}
        </div>
      </div>
    </aside>
  </main>;
}
