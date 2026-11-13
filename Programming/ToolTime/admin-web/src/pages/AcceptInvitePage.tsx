import { useEffect, useState, type FormEvent } from 'react';
import { createUserWithEmailAndPassword, signInWithEmailAndPassword, signOut } from 'firebase/auth';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../auth/AuthProvider';
import { auth } from '../firebase';
import { api } from '../services/apiClient';
import { brandBackgroundColor, brandTextAccentColor, readableTextColor, type PublicTenantBranding } from '../types/branding';
import { BrandLogo } from '../components/BrandLogo';

export function AcceptInvitePage({ branding }: { branding?: PublicTenantBranding } = {}) {
  const { user, platformRole } = useAuth();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const [code, setCode] = useState(params.get('code') || '');
  const token = params.get('token') || '';
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [passwordConfirm, setPasswordConfirm] = useState('');
  const [accountExists, setAccountExists] = useState(false);
  const [step, setStep] = useState<'identify' | 'password'>('identify');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const signedInAsInvitee = Boolean(user?.email && user.email.toLowerCase() === email.trim().toLowerCase() && platformRole !== 'superadmin');
  const payload = token ? { qrToken: token } : { code: code.trim() };

  useEffect(() => {
    if (!token) return;
    let active = true;
    setBusy(true);
    api<{ accountExists: boolean; email: string }>('/public/invites/validate-web', {
      method: 'POST', body: JSON.stringify({ qrToken: token, ...(branding ? { tenantSlug: branding.slug } : {}) }),
    }).then(result => {
      if (!active) return;
      setEmail(result.email); setAccountExists(result.accountExists); setStep('password'); setError('');
    }).catch(() => { if (active) setError('Dieser Aktivierungslink ist ungültig, abgelaufen oder wurde bereits verwendet.'); })
      .finally(() => { if (active) setBusy(false); });
    return () => { active = false; };
  }, [token, branding?.slug]);

  async function validate(event: FormEvent) {
    event.preventDefault(); setBusy(true); setError('');
    try {
      if (user && !signedInAsInvitee) {
        setError('Bitte melde dich zuerst vom aktuellen Konto ab, um diese Einladung anzunehmen.');
        return;
      }
      const result = await api<{ accountExists: boolean; email: string }>('/public/invites/validate-web', {
        method: 'POST', body: JSON.stringify({ ...payload, email: email.trim(), ...(branding ? { tenantSlug: branding.slug } : {}) }),
      });
      setEmail(result.email); setAccountExists(result.accountExists);
      setStep('password');
    } catch (e) {
      const reason = e instanceof Error ? e.message : '';
      setError(reason.includes('INVITE_INVALID') ? 'E-Mail-Adresse und Aktivierungscode passen nicht zusammen, oder die Einladung ist abgelaufen.' : reason.includes('HTTP_429') ? 'Zu viele Versuche. Bitte versuche es später erneut.' : 'Die Einladung konnte nicht geprüft werden. Bitte versuche es erneut.');
    } finally { setBusy(false); }
  }

  async function accept(event: FormEvent) {
    event.preventDefault(); setError('');
    if (!accountExists && !signedInAsInvitee && password !== passwordConfirm) {
      setError('Die beiden Passwörter stimmen nicht überein.');
      return;
    }
    setBusy(true);
    try {
      if (auth.currentUser && !signedInAsInvitee) {
        setError('Bitte melde dich zuerst vom aktuellen Konto ab, um diese Einladung anzunehmen.');
        return;
      }
      if (!auth.currentUser) {
        if (accountExists) await signInWithEmailAndPassword(auth, email.trim(), password);
        else await createUserWithEmailAndPassword(auth, email.trim(), password);
      }
      const result = await api<{ tenantId: string }>('/public/invites/redeem-web', {
        method: 'POST', body: JSON.stringify({ ...payload, ...(branding ? { tenantSlug: branding.slug } : {}) }),
      });
      navigate(`/t/${result.tenantId}`, { replace: true });
    } catch (e) {
      const reason = e instanceof Error ? e.message : '';
      setError(reason.includes('INVITE_EMAIL_MISMATCH') ? 'Diese Einladung gehört zu einer anderen E-Mail-Adresse.' : reason.includes('INVITE_INVALID') ? 'Die Einladung ist ungültig, abgelaufen oder bereits eingelöst.' : reason.includes('auth/email-already-in-use') ? 'Für diese E-Mail besteht bereits ein Konto. Bitte gehe zurück und prüfe die Einladung erneut.' : reason.includes('auth/invalid-credential') || reason.includes('auth/wrong-password') ? 'Das Passwort ist nicht korrekt.' : 'Aktivierung fehlgeschlagen. Bitte versuche es erneut.');
    } finally { setBusy(false); }
  }

  return <main className="min-h-screen bg-[#F8F9FC] px-4 py-12 text-slate-800">
    <div className="mx-auto max-w-md rounded-3xl border border-slate-200 bg-white p-7 shadow-sm sm:p-9">
      <div className="mb-8">{branding ? <BrandLogo branding={branding}/> : <img src="/p12-aufmass-logo.svg" alt="P12 Aufmaß" className="w-48" />}</div>
      <h1 className="text-2xl font-semibold">{branding ? `Einladung von ${branding.name}` : 'Firmeneinladung annehmen'}</h1>
      <p className="mt-2 text-sm leading-6 text-slate-600">{step === 'identify' ? token ? 'Dein Aktivierungslink wird geprüft. Danach legst du dein Passwort fest.' : 'Gib die eingeladene E-Mail-Adresse und deinen Aktivierungscode ein. Danach legst du dein Passwort fest.' : accountExists ? 'Für diese E-Mail-Adresse besteht bereits ein Konto. Melde dich mit deinem Passwort an.' : 'Lege jetzt das Passwort für dein neues Konto fest.'}</p>
      {user && <div className="mt-5 flex items-center justify-between gap-3 rounded-xl bg-slate-50 p-3 text-sm"><span>Angemeldet als <b>{user.email}</b></span><button type="button" onClick={() => void signOut(auth)} style={{ color: brandTextAccentColor(branding?.primaryColor || '#7437D9') }} className="font-semibold text-violet-700">Abmelden</button></div>}
      {step === 'identify' ? <form onSubmit={validate} className="mt-6 space-y-4">
        {!token && <label className="block text-sm font-semibold">E-Mail-Adresse<input type="email" autoComplete="email" value={email} onChange={e => setEmail(e.target.value)} required className="mt-2 w-full rounded-xl border border-slate-300 px-4 py-3" placeholder="name@firma.de" /></label>}
        {!token && <label className="block text-sm font-semibold">Aktivierungscode<input value={code} onChange={e => setCode(e.target.value)} required className="mt-2 w-full rounded-xl border border-slate-300 px-4 py-3 font-mono uppercase" placeholder="AB-CDEF" /></label>}
        {token && <p className="rounded-xl bg-violet-50 p-3 text-sm text-violet-900">Mit diesem Link brauchst du keinen zusätzlichen Aktivierungscode.</p>}
        {error && <p role="alert" className="rounded-xl bg-red-50 p-3 text-sm text-red-700">{error}</p>}
        <button disabled={busy} style={branding ? { backgroundColor: brandBackgroundColor(branding.primaryColor), color: readableTextColor(branding.primaryColor) } : undefined} className="w-full rounded-xl bg-violet-700 px-4 py-3 font-semibold text-white disabled:opacity-50">{busy ? 'Einladung wird geprüft …' : 'Weiter'}</button>
      </form> : <form onSubmit={accept} className="mt-6 space-y-4">
        <p className="rounded-xl bg-slate-50 p-3 text-sm">Einladung für <b>{email.trim()}</b> bestätigt.</p>
        {!signedInAsInvitee && <label className="block text-sm font-semibold">{accountExists ? 'Passwort' : 'Passwort festlegen'}<input type="password" autoComplete={accountExists ? 'current-password' : 'new-password'} minLength={6} value={password} onChange={e => setPassword(e.target.value)} required className="mt-2 w-full rounded-xl border border-slate-300 px-4 py-3" /></label>}
        {!accountExists && !signedInAsInvitee && <label className="block text-sm font-semibold">Passwort wiederholen<input type="password" autoComplete="new-password" minLength={6} value={passwordConfirm} onChange={e => setPasswordConfirm(e.target.value)} required className="mt-2 w-full rounded-xl border border-slate-300 px-4 py-3" /></label>}
        {error && <p role="alert" className="rounded-xl bg-red-50 p-3 text-sm text-red-700">{error}</p>}
        <button disabled={busy} style={branding ? { backgroundColor: brandBackgroundColor(branding.primaryColor), color: readableTextColor(branding.primaryColor) } : undefined} className="w-full rounded-xl bg-violet-700 px-4 py-3 font-semibold text-white disabled:opacity-50">{busy ? 'Aktivierung läuft …' : 'Konto aktivieren'}</button>
        {!token && <button type="button" disabled={busy} onClick={() => { setStep('identify'); setPassword(''); setPasswordConfirm(''); setError(''); }} style={{ color: brandTextAccentColor(branding?.primaryColor || '#7437D9') }} className="w-full text-sm font-semibold text-violet-700">E-Mail oder Code ändern</button>}
      </form>}
      <p className="mt-5 text-xs text-slate-500">Die Einladung ist einmalig und sieben Tage gültig. Behandle {token ? 'den Link' : 'den Code'} vertraulich.</p>
    </div>
  </main>;
}
