import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { readableTextColor } from '../types/branding';
import { api } from '../services/apiClient';
import type { Project } from '../types';

type Role = 'admin' | 'bauleiter' | 'kaufmaennisch' | 'monteur';
interface Member { id: string; displayName?: string; email?: string; role: Role; status: string; assignedProjectIds?: string[]; }
interface Invitation { id: string; displayName: string; email?: string; role: Role; status: string; expiresAt?: string; }
interface InvitationResult { shortCode: string; qrToken: string; qrDataUrl: string; pdfBase64: string; emailSent: boolean; }
const roleLabels: Record<Role, string> = { admin: 'Administrator', bauleiter: 'Bauleiter', kaufmaennisch: 'Kaufmännisch', monteur: 'Monteur' };

export function TenantMembersView({ tenantId, projects, primaryColor }: { tenantId: string; projects: Project[]; primaryColor: string }) {
  const [members, setMembers] = useState<Member[]>([]);
  const [invitations, setInvitations] = useState<Invitation[]>([]);
  const [name, setName] = useState(''); const [email, setEmail] = useState(''); const [role, setRole] = useState<Role>('bauleiter');
  const [result, setResult] = useState<InvitationResult | null>(null); const [resultRole, setResultRole] = useState<Role>('bauleiter');
  const [error, setError] = useState(''); const [notice, setNotice] = useState(''); const [busy, setBusy] = useState(false);
  const load = useCallback(async () => {
    try {
      const [nextMembers, nextInvitations] = await Promise.all([
        api<Member[]>(`/tenants/${tenantId}/members`), api<Invitation[]>(`/tenants/${tenantId}/invites`),
      ]);
      setMembers(nextMembers); setInvitations(nextInvitations);
    } catch { setError('Mitglieder konnten nicht geladen werden.'); }
  }, [tenantId]);
  useEffect(() => { void load(); }, [load]);

  async function invite(event: FormEvent) {
    event.preventDefault(); setBusy(true); setError(''); setNotice('');
    try {
      const data = await api<InvitationResult>(`/tenants/${tenantId}/invites`, { method: 'POST', body: JSON.stringify({ displayName: name.trim(), email: email.trim() || undefined, role }) });
      setResult(data); setResultRole(role); setName(''); setEmail(''); await load();
    } catch (e) { setError(e instanceof Error ? `Einladung fehlgeschlagen: ${e.message}` : 'Einladung fehlgeschlagen.'); }
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
  function downloadPdf() {
    if (!result) return;
    const bytes = Uint8Array.from(atob(result.pdfBase64), char => char.charCodeAt(0));
    const url = URL.createObjectURL(new Blob([bytes], { type: 'application/pdf' }));
    const link = document.createElement('a'); link.href = url; link.download = 'P12-Aufmass-Einladung.pdf'; link.click(); URL.revokeObjectURL(url);
  }

  return <div className="space-y-6">
    <div><h1 className="text-2xl font-semibold">Benutzer & Rollen</h1><p className="mt-1 text-sm text-slate-600">Verwalte die Zugänge deiner Firma und lade weitere Personen ein.</p></div>
    {error && <p role="alert" className="rounded-xl bg-red-50 p-4 text-sm text-red-700">{error}</p>}
    {notice && <p className="rounded-xl bg-emerald-50 p-4 text-sm text-emerald-800">{notice}</p>}
    <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <h2 className="text-lg font-semibold">Person einladen</h2>
      <form onSubmit={invite} className="mt-4 grid gap-3 sm:grid-cols-2">
        <label className="text-sm font-medium">Name<input required value={name} onChange={e => setName(e.target.value)} className="mt-1 block w-full rounded-xl border border-slate-300 px-3 py-2" /></label>
        <label className="text-sm font-medium">E-Mail{role === 'monteur' ? ' (optional)' : ''}<input required={role !== 'monteur'} type="email" value={email} onChange={e => setEmail(e.target.value)} className="mt-1 block w-full rounded-xl border border-slate-300 px-3 py-2" /></label>
        <label className="text-sm font-medium">Rolle<select value={role} onChange={e => setRole(e.target.value as Role)} className="mt-1 block w-full rounded-xl border border-slate-300 bg-white px-3 py-2">{Object.entries(roleLabels).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></label>
        <button disabled={busy} className="self-end rounded-xl bg-[var(--tenant-primary)] px-4 py-2.5 font-semibold disabled:opacity-50" style={{ color: readableTextColor(primaryColor) }}>Einladung erstellen</button>
      </form>
      {result && <div className="mt-5 rounded-xl border border-slate-200 bg-slate-50 p-4"><p className="font-semibold">Einladung erstellt · {result.shortCode}</p><p className="mt-1 text-xs text-slate-600">{result.emailSent ? 'E-Mail wurde versendet.' : 'E-Mail-Versand ist nicht eingerichtet. Gib den Link oder Code selbst weiter.'}</p><div className="mt-3 flex flex-wrap gap-3 text-sm font-semibold">{resultRole !== 'monteur' && <button type="button" onClick={() => void navigator.clipboard.writeText(`${window.location.origin}/invite?token=${encodeURIComponent(result.qrToken)}`)} className="text-[var(--tenant-primary)]">Web-Link kopieren</button>}<button type="button" onClick={() => void navigator.clipboard.writeText(result.shortCode)} className="text-[var(--tenant-primary)]">Code kopieren</button><button type="button" onClick={downloadPdf} className="text-[var(--tenant-primary)]">PDF herunterladen</button></div></div>}
    </section>
    <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><h2 className="text-lg font-semibold">Mitglieder</h2><div className="mt-4 space-y-4">{members.map(member => <div key={member.id} className="rounded-xl border border-slate-200 p-4"><div className="flex flex-wrap items-start justify-between gap-3"><div><p className="font-semibold">{member.displayName || member.email || member.id}</p><p className="text-xs text-slate-500">{member.email || 'Ohne E-Mail'} · {member.status === 'active' ? 'Aktiv' : 'Inaktiv'}</p></div><div className="flex gap-2"><select aria-label={`Rolle von ${member.displayName || member.id}`} disabled={busy} value={member.role} onChange={e => void updateMember(member, { role: e.target.value as Role })} className="rounded-lg border border-slate-300 bg-white px-2 py-1 text-sm">{Object.entries(roleLabels).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select><button disabled={busy} onClick={() => void updateMember(member, { status: member.status === 'active' ? 'inactive' : 'active' })} className="rounded-lg border border-slate-300 px-2 py-1 text-sm">{member.status === 'active' ? 'Deaktivieren' : 'Aktivieren'}</button></div></div>{projects.length > 0 && member.role !== 'admin' && <div className="mt-3 flex flex-wrap gap-3 text-xs">{projects.map(project => <label key={project.id} className="flex items-center gap-1"><input type="checkbox" checked={member.assignedProjectIds?.includes(project.id) || false} disabled={busy} onChange={e => void updateMember(member, { assignedProjectIds: e.target.checked ? [...(member.assignedProjectIds || []), project.id] : (member.assignedProjectIds || []).filter(id => id !== project.id) })}/>{project.name}</label>)}</div>}</div>)}{members.length === 0 && <p className="text-sm text-slate-500">Noch keine aktiven Mitglieder.</p>}</div></section>
    <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><h2 className="text-lg font-semibold">Einladungen</h2><div className="mt-4 space-y-2">{invitations.map(invitation => <div key={invitation.id} className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 pt-2 text-sm"><span>{invitation.displayName} · {roleLabels[invitation.role]} · {invitation.status}</span>{invitation.status === 'pending' && <button disabled={busy} onClick={() => void revoke(invitation.id)} className="text-red-700">Widerrufen</button>}</div>)}{invitations.length === 0 && <p className="text-sm text-slate-500">Noch keine Einladungen.</p>}</div></section>
  </div>;
}
