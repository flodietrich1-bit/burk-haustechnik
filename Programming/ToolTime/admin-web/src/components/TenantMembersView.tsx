import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { Copy, Plus } from 'lucide-react';
import { api } from '../services/apiClient';
import type { Project } from '../types';

type Role = 'admin' | 'bauleiter' | 'kaufmaennisch' | 'monteur';
interface Member { id: string; displayName?: string; email?: string; role: Role; status: string; assignedProjectIds?: string[]; }
interface Invitation { id: string; displayName: string; email?: string; role: Role; status: string; emailSent?: boolean; emailError?: string | null; }
interface InvitationResult { inviteId: string; shortCode: string; qrDataUrl: string; webInviteUrl?: string; pdfBase64: string; emailSent: boolean; emailError?: string | null; }
const roleLabels: Record<Role, string> = { admin: 'Administrator', bauleiter: 'Bauleiter', kaufmaennisch: 'Kaufmännisch', monteur: 'Monteur' };

export function TenantMembersView({ tenantId, projects }: { tenantId: string; projects: Project[] }) {
  const [members, setMembers] = useState<Member[]>([]);
  const [invitations, setInvitations] = useState<Invitation[]>([]);
  const [modalOpen, setModalOpen] = useState(false);
  const [name, setName] = useState(''); const [email, setEmail] = useState(''); const [role, setRole] = useState<Role>('bauleiter');
  const [result, setResult] = useState<InvitationResult | null>(null);
  const [resultRole, setResultRole] = useState<Role>('bauleiter'); const [resultEmail, setResultEmail] = useState('');
  const [error, setError] = useState(''); const [notice, setNotice] = useState(''); const [busy, setBusy] = useState(false);
  const load = useCallback(async () => {
    try {
      const [nextMembers, nextInvitations] = await Promise.all([api<Member[]>(`/tenants/${tenantId}/members`), api<Invitation[]>(`/tenants/${tenantId}/invites`)]);
      setMembers(nextMembers); setInvitations(nextInvitations);
    } catch { setError('Mitglieder konnten nicht geladen werden.'); }
  }, [tenantId]);
  useEffect(() => { void load(); }, [load]);

  function closeModal() { setModalOpen(false); setResult(null); setName(''); setEmail(''); setError(''); setNotice(''); }
  async function invite(event: FormEvent) {
    event.preventDefault(); setBusy(true); setError(''); setNotice('');
    try {
      const data = await api<InvitationResult>(`/tenants/${tenantId}/invites`, { method: 'POST', body: JSON.stringify({ displayName: name.trim(), email: email.trim() || undefined, role }) });
      setResult(data); setResultRole(role); setResultEmail(email.trim()); await load();
    } catch (e) { setError(e instanceof Error ? `Einladung fehlgeschlagen: ${e.message}` : 'Einladung fehlgeschlagen.'); }
    finally { setBusy(false); }
  }
  async function resend(invitation: Invitation) {
    setBusy(true); setError(''); setNotice('');
    try {
      const data = await api<InvitationResult>(`/tenants/${tenantId}/invites/${invitation.id}/resend`, { method: 'POST' });
      setResult(data); setResultRole(invitation.role); setResultEmail(invitation.email || ''); setModalOpen(true); await load();
    } catch (e) { setError(e instanceof Error ? `Neuversand fehlgeschlagen: ${e.message}` : 'Neuversand fehlgeschlagen.'); }
    finally { setBusy(false); }
  }
  async function updateMember(member: Member, changes: Partial<Pick<Member, 'role' | 'status' | 'assignedProjectIds'>>) {
    setBusy(true); setError(''); setNotice('');
    try { await api(`/tenants/${tenantId}/members/${member.id}`, { method: 'PATCH', body: JSON.stringify(changes) }); await load(); setNotice('Mitglied aktualisiert.'); }
    catch (e) { setError(e instanceof Error ? `Änderung fehlgeschlagen: ${e.message}` : 'Änderung fehlgeschlagen.'); }
    finally { setBusy(false); }
  }
  async function revoke(id: string) {
    setBusy(true); setError('');
    try { await api(`/tenants/${tenantId}/invites/${id}/revoke`, { method: 'POST' }); await load(); }
    catch { setError('Einladung konnte nicht widerrufen werden.'); }
    finally { setBusy(false); }
  }
  async function copy(value: string, label: string) {
    try { await navigator.clipboard.writeText(value); setNotice(`${label} kopiert.`); }
    catch { setError('Kopieren wurde vom Browser blockiert. Bitte den Text im Feld markieren und manuell kopieren.'); }
  }
  function downloadPdf() {
    if (!result) return;
    const bytes = Uint8Array.from(atob(result.pdfBase64), char => char.charCodeAt(0));
    const url = URL.createObjectURL(new Blob([bytes], { type: 'application/pdf' }));
    const link = document.createElement('a'); link.href = url; link.download = 'P12-Aufmass-Einladung.pdf'; link.click(); window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  return <div className="space-y-6">
    <div className="flex flex-wrap items-center justify-between gap-4"><div><h1 className="text-2xl font-semibold">Benutzer & Rollen</h1><p className="mt-1 text-sm text-slate-600">Verwalte die Zugänge deiner Firma.</p></div><button type="button" onClick={() => { setResult(null); setError(''); setNotice(''); setModalOpen(true); }} className="flex items-center gap-2 rounded-xl bg-[var(--tenant-primary-surface)] px-5 py-3 text-sm font-semibold text-[var(--tenant-primary-text)]"><Plus className="h-4 w-4"/>Benutzer einladen</button></div>
    {!modalOpen && error && <p role="alert" className="rounded-xl bg-red-50 p-4 text-sm text-red-700">{error}</p>}
    {!modalOpen && notice && <p role="status" className="rounded-xl bg-emerald-50 p-4 text-sm text-emerald-800">{notice}</p>}
    <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><h2 className="text-lg font-semibold">Mitglieder</h2><div className="mt-4 space-y-4">{members.map(member => <div key={member.id} className="rounded-xl border border-slate-200 p-4"><div className="flex flex-wrap items-start justify-between gap-3"><div><p className="font-semibold">{member.displayName || member.email || member.id}</p><p className="text-xs text-slate-500">{member.email || 'Ohne E-Mail'} · {member.status === 'active' ? 'Aktiv' : 'Inaktiv'}</p></div><div className="flex gap-2"><select aria-label={`Rolle von ${member.displayName || member.id}`} disabled={busy} value={member.role} onChange={e => void updateMember(member, { role: e.target.value as Role })} className="rounded-lg border border-slate-300 bg-white px-2 py-1 text-sm">{Object.entries(roleLabels).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select><button disabled={busy} onClick={() => void updateMember(member, { status: member.status === 'active' ? 'inactive' : 'active' })} className="rounded-lg border border-slate-300 px-2 py-1 text-sm">{member.status === 'active' ? 'Deaktivieren' : 'Aktivieren'}</button></div></div>{projects.length > 0 && member.role !== 'admin' && <div className="mt-3 flex flex-wrap gap-3 text-xs">{projects.map(project => <label key={project.id} className="flex items-center gap-1"><input type="checkbox" checked={member.assignedProjectIds?.includes(project.id) || false} disabled={busy} onChange={e => void updateMember(member, { assignedProjectIds: e.target.checked ? [...(member.assignedProjectIds || []), project.id] : (member.assignedProjectIds || []).filter(id => id !== project.id) })}/>{project.name}</label>)}</div>}</div>)}{members.length === 0 && <p className="text-sm text-slate-500">Noch keine aktiven Mitglieder.</p>}</div></section>
    <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><h2 className="text-lg font-semibold">Einladungen</h2><div className="mt-4 space-y-2">{invitations.map(invitation => <div key={invitation.id} className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 pt-2 text-sm"><span>{invitation.displayName} · {roleLabels[invitation.role]} · {invitation.status}{invitation.emailError ? ' · E-Mail nicht versendet' : invitation.emailSent ? ' · E-Mail versendet' : ''}</span><div className="flex gap-3">{invitation.status === 'pending' && invitation.email && <button disabled={busy} onClick={() => void resend(invitation)} className="text-[var(--tenant-secondary)]">Erneut einladen</button>}{invitation.status === 'pending' && <button disabled={busy} onClick={() => void revoke(invitation.id)} className="text-red-700">Widerrufen</button>}</div></div>)}{invitations.length === 0 && <p className="text-sm text-slate-500">Noch keine Einladungen.</p>}</div></section>
    {modalOpen && <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4" onMouseDown={event => { if (event.target === event.currentTarget && !busy) closeModal(); }}><div role="dialog" aria-modal="true" aria-labelledby="member-invite-title" className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-3xl bg-white p-6 shadow-2xl sm:p-8"><div className="flex items-start justify-between gap-4"><div><h2 id="member-invite-title" className="text-xl font-semibold">{result ? result.emailSent ? 'Einladung versendet' : 'Einladung erstellt' : 'Benutzer einladen'}</h2><p className="mt-1 text-sm text-slate-600">{result ? 'Aktivierungsdaten für die eingeladene Person.' : 'Rolle und Kontaktdaten angeben.'}</p></div><button type="button" disabled={busy} onClick={closeModal} className="rounded-xl bg-slate-100 px-3 py-2 text-sm font-semibold">Schließen</button></div>
      {result ? <div className="mt-6 space-y-4"><div className="flex flex-wrap items-center gap-4 rounded-xl bg-slate-50 p-4"><img src={result.qrDataUrl} alt="Einladungs-QR-Code" className="h-32 w-32 rounded-lg bg-white"/><div className="min-w-0 flex-1"><p className="text-sm font-semibold">{result.emailSent ? `Einladung an ${resultEmail} versendet` : result.emailError ? 'Einladung erstellt, E-Mail nicht versendet.' : 'Einladung erstellt.'}</p>{resultRole === 'monteur' && <div className="mt-2 flex items-center gap-2"><input aria-label="Aktivierungscode" readOnly value={result.shortCode} onFocus={event => event.currentTarget.select()} className="min-w-0 flex-1 bg-transparent font-mono text-xl font-bold"/><button type="button" onClick={() => void copy(result.shortCode, 'Code')} aria-label="Code kopieren"><Copy className="h-4 w-4"/></button></div>}</div></div>{resultRole !== 'monteur' && <div><label htmlFor="member-invite-link" className="text-sm font-semibold">Aktivierungslink</label><div className="mt-2 flex items-center gap-2"><input id="member-invite-link" readOnly value={result.webInviteUrl || ''} onFocus={event => event.currentTarget.select()} className="min-w-0 flex-1 rounded-lg border border-slate-200 p-2 text-xs"/><button type="button" onClick={() => void copy(result.webInviteUrl || '', 'Link')} aria-label="Link kopieren" className="rounded-lg bg-slate-100 p-2"><Copy className="h-4 w-4"/></button></div></div>}{result.emailError && resultEmail && <button type="button" disabled={busy} onClick={() => void resend({ id: result.inviteId, displayName: name, email: resultEmail, role: resultRole, status: 'pending' })} className="w-full rounded-xl bg-[var(--tenant-primary-surface)] p-3 font-semibold text-[var(--tenant-primary-text)] disabled:opacity-50">{busy ? 'Wird gesendet …' : 'Erneut einladen'}</button>}{error && <p role="alert" className="rounded-xl bg-red-50 p-3 text-sm text-red-700">{error}</p>}{notice && <p role="status" className="rounded-xl bg-emerald-50 p-3 text-sm text-emerald-800">{notice}</p>}<button type="button" onClick={downloadPdf} className="text-sm font-semibold text-[var(--tenant-secondary)] hover:underline">Einladungs-PDF herunterladen</button></div>
      : <form onSubmit={invite} className="mt-6 space-y-5"><label className="block text-sm font-semibold">Rolle<select value={role} onChange={event => setRole(event.target.value as Role)} className="mt-2 w-full rounded-xl border border-slate-300 bg-white px-4 py-3">{Object.entries(roleLabels).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></label><label className="block text-sm font-semibold">Vor- und Nachname<input required value={name} onChange={event => setName(event.target.value)} className="mt-2 w-full rounded-xl border border-slate-300 px-4 py-3"/></label><label className="block text-sm font-semibold">E-Mail{role === 'monteur' ? ' (optional)' : ''}<input type="email" required={role !== 'monteur'} value={email} onChange={event => setEmail(event.target.value)} className="mt-2 w-full rounded-xl border border-slate-300 px-4 py-3"/></label>{error && <p role="alert" className="rounded-xl bg-red-50 p-3 text-sm text-red-700">{error}</p>}<button disabled={busy} className="w-full rounded-xl bg-[var(--tenant-primary-surface)] px-4 py-3 font-semibold text-[var(--tenant-primary-text)] disabled:opacity-50">{busy ? 'Einladung wird gesendet …' : 'Jetzt einladen'}</button></form>}</div></div>}
  </div>;
}
