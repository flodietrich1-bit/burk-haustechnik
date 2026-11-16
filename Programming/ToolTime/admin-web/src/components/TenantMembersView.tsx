import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { Copy, Plus, Pencil, Trash2, Mail, Phone, Globe, X, User } from 'lucide-react';
import { api } from '../services/apiClient';
import type { Project } from '../types';

type Role = 'admin' | 'bauleiter' | 'kaufmaennisch' | 'monteur';
interface Member { id: string; displayName?: string; email?: string; phone?: string; defaultLanguage?: 'de' | 'ro' | 'pl' | 'hr'; role: Role; status: string; assignedProjectIds?: string[]; }

const languages: Array<{ code: 'de' | 'ro' | 'pl' | 'hr'; label: string; flag: string }> = [
  { code: 'de', label: 'Deutsch', flag: '🇩🇪' },
  { code: 'ro', label: 'Rumänisch (Română)', flag: '🇷🇴' },
  { code: 'pl', label: 'Polnisch (Polski)', flag: '🇵🇱' },
  { code: 'hr', label: 'Kroatisch (Hrvatski)', flag: '🇭🇷' },
];
interface Invitation {
  id: string;
  displayName: string;
  email?: string;
  role: Role;
  defaultLanguage?: 'de' | 'ro' | 'pl' | 'hr';
  status: string;
  emailSent?: boolean;
  emailError?: string | null;
  assignedProjectIds?: string[];
  projectId?: string | null;
  projectName?: string | null;
  createdAt?: string;
  expiresAt?: string;
}
interface InvitationResult { inviteId: string; shortCode: string; qrDataUrl: string; webInviteUrl?: string; pdfBase64: string; emailSent: boolean; emailError?: string | null; }
const roleLabels: Record<Role, string> = { admin: 'Administrator', bauleiter: 'Projektleiter', kaufmaennisch: 'Kaufmann', monteur: 'Monteur' };

export function TenantMembersView({ tenantId, projects }: { tenantId: string; projects: Project[] }) {
  const [members, setMembers] = useState<Member[]>([]);
  const [invitations, setInvitations] = useState<Invitation[]>([]);
  const [modalOpen, setModalOpen] = useState(false);
  const [projectMember, setProjectMember] = useState<Member | null>(null);
  const [editingMember, setEditingMember] = useState<Member | null>(null);
  const [editName, setEditName] = useState('');
  const [editEmail, setEditEmail] = useState('');
  const [editPhone, setEditPhone] = useState('');
  const [editRole, setEditRole] = useState<Role>('monteur');
  const [editStatus, setEditStatus] = useState<string>('active');
  const [editLanguage, setEditLanguage] = useState<'de' | 'ro' | 'pl' | 'hr'>('de');
  const [editProjectIds, setEditProjectIds] = useState<string[]>([]);
  const [inviteLanguage, setInviteLanguage] = useState<'de' | 'ro' | 'pl' | 'hr'>('de');
  const [name, setName] = useState(''); const [email, setEmail] = useState(''); const [role, setRole] = useState<Role>('bauleiter');
  const [selectedProjectId, setSelectedProjectId] = useState<string>('');
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

  function openInviteModal() {
    setResult(null);
    setError('');
    setNotice('');
    setName('');
    setEmail('');
    setRole('bauleiter');
    setInviteLanguage('de');
    if (projects.length === 1) {
      setSelectedProjectId(projects[0].id);
    } else {
      setSelectedProjectId('');
    }
    setModalOpen(true);
  }

  function closeModal() {
    setModalOpen(false);
    setResult(null);
    setName('');
    setEmail('');
    setSelectedProjectId('');
    setInviteLanguage('de');
    setError('');
    setNotice('');
  }

  async function invite(event: FormEvent) {
    event.preventDefault(); setBusy(true); setError(''); setNotice('');
    try {
      const data = await api<InvitationResult>(`/tenants/${tenantId}/invites`, {
        method: 'POST',
        body: JSON.stringify({
          displayName: name.trim(),
          email: email.trim() || undefined,
          role,
          defaultLanguage: role === 'monteur' ? inviteLanguage : undefined,
          assignedProjectIds: selectedProjectId ? [selectedProjectId] : [],
          projectId: selectedProjectId || undefined,
        }),
      });
      setResult(data); setResultRole(role); setResultEmail(email.trim()); await load();
    } catch (e) { setError(e instanceof Error ? `Einladung fehlgeschlagen: ${e.message}` : 'Einladung fehlgeschlagen.'); }
    finally { setBusy(false); }
  }

  async function deleteInvitation(id: string, displayName: string) {
    if (!confirm(`Möchtest du die Einladung für „${displayName}“ wirklich löschen?`)) return;
    setBusy(true); setError(''); setNotice('');
    try {
      await api(`/tenants/${tenantId}/invites/${id}`, { method: 'DELETE' });
      await load();
      setNotice(`Einladung für „${displayName}“ wurde gelöscht.`);
    } catch (e) {
      setError(e instanceof Error ? `Löschen fehlgeschlagen: ${e.message}` : 'Löschen fehlgeschlagen.');
    } finally {
      setBusy(false);
    }
  }
  async function resend(invitation: Invitation) {
    setBusy(true); setError(''); setNotice('');
    try {
      const data = await api<InvitationResult>(`/tenants/${tenantId}/invites/${invitation.id}/resend`, { method: 'POST' });
      setResult(data); setResultRole(invitation.role); setResultEmail(invitation.email || ''); setModalOpen(true); await load();
    } catch (e) { setError(e instanceof Error ? `Neuversand fehlgeschlagen: ${e.message}` : 'Neuversand fehlgeschlagen.'); }
    finally { setBusy(false); }
  }
  function openEditModal(member: Member) {
    setEditingMember(member);
    setEditName(member.displayName || '');
    setEditEmail(member.email || '');
    setEditPhone(member.phone || '');
    setEditRole(member.role);
    setEditStatus(member.status || 'active');
    setEditLanguage(member.defaultLanguage || 'de');
    setEditProjectIds(member.assignedProjectIds || []);
    setError('');
  }

  function closeEditModal() {
    setEditingMember(null);
    setError('');
  }

  async function saveEditedMember(e: FormEvent) {
    e.preventDefault();
    if (!editingMember) return;
    setBusy(true); setError(''); setNotice('');
    try {
      await api(`/tenants/${tenantId}/members/${editingMember.id}`, {
        method: 'PATCH',
        body: JSON.stringify({
          displayName: editName.trim() || undefined,
          email: editEmail.trim() || undefined,
          phone: editPhone.trim() || undefined,
          role: editRole,
          status: editStatus,
          defaultLanguage: editLanguage,
          assignedProjectIds: editProjectIds,
        }),
      });
      await load();
      setEditingMember(null);
      setNotice(`Benutzer „${editName.trim() || editEmail.trim() || 'Benutzer'}“ wurde aktualisiert.`);
    } catch (err: any) {
      setError(err instanceof Error ? `Speichern fehlgeschlagen: ${err.message}` : 'Speichern fehlgeschlagen.');
    } finally {
      setBusy(false);
    }
  }

  async function updateMember(member: Member, changes: Partial<Member>) {
    setBusy(true); setError(''); setNotice('');
    try { await api(`/tenants/${tenantId}/members/${member.id}`, { method: 'PATCH', body: JSON.stringify(changes) }); await load(); setNotice('Mitglied aktualisiert.'); return true; }
    catch (e) { setError(e instanceof Error ? `Änderung fehlgeschlagen: ${e.message}` : 'Änderung fehlgeschlagen.'); return false; }
    finally { setBusy(false); }
  }
  async function deleteMember(member: Member) {
    if (!confirm(`Möchtest du „${member.displayName || member.email || 'Dieses Mitglied'}“ wirklich unwiderruflich löschen? Der Zugang zur App und das Benutzerkonto werden vollständig gelöscht.`)) return;
    setBusy(true); setError(''); setNotice('');
    try {
      await api(`/tenants/${tenantId}/members/${encodeURIComponent(member.id)}`, { method: 'DELETE' });
      await load();
      setNotice(`„${member.displayName || member.email || 'Mitglied'}“ und das zugehörige Benutzerkonto wurden gelöscht.`);
    } catch (e) {
      setError(e instanceof Error && e.message === 'LAST_ADMIN_REQUIRED'
        ? 'Mindestens ein aktiver Administrator muss erhalten bleiben.'
        : e instanceof Error && e.message === 'SELF_REMOVAL_DENIED'
        ? 'Du kannst deinen eigenen Zugang nicht entfernen.'
        : 'Mitglied konnte nicht gelöscht werden.');
    } finally {
      setBusy(false);
    }
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
    <div className="flex flex-wrap items-center justify-between gap-4">
      <div>
        <h1 className="text-2xl font-semibold">Benutzer & Rollen</h1>
        <p className="mt-1 text-sm text-slate-600">Verwalte die Zugänge deiner Firma.</p>
      </div>
      <button
        type="button"
        onClick={openInviteModal}
        className="flex items-center gap-2 rounded-xl bg-[var(--tenant-primary-surface)] px-5 py-3 text-sm font-semibold text-[var(--tenant-primary-text)] cursor-pointer hover:opacity-95 shadow-sm"
      >
        <Plus className="h-4 w-4"/>Benutzer einladen
      </button>
    </div>

    {!modalOpen && error && <p role="alert" className="rounded-xl bg-red-50 p-4 text-sm text-red-700">{error}</p>}
    {!modalOpen && notice && <p role="status" className="rounded-xl bg-emerald-50 p-4 text-sm text-emerald-800">{notice}</p>}

    <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <h2 className="text-lg font-semibold">Mitglieder</h2>
      <div className="mt-4 space-y-4">{members.map(member => {
        const assigned = projects.filter(project => member.assignedProjectIds?.includes(project.id));
        const available = projects.filter(project => !member.assignedProjectIds?.includes(project.id));

        return (
          <div key={member.id} className="rounded-2xl border border-slate-200 p-4 shadow-2xs bg-white space-y-3">
            {/* Top Line: Name, Status, Role, Language Dropdown (Monteur only), Actions */}
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="font-bold text-slate-900 text-base">{member.displayName || member.email || member.id}</h3>
                <span className={`rounded-full px-2.5 py-0.5 text-xs font-bold ${member.status === 'active' ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-100 text-slate-600'}`}>
                  {member.status === 'active' ? 'Aktiv' : 'Inaktiv'}
                </span>
                <span className="rounded-full bg-blue-50 px-2.5 py-0.5 text-xs font-bold text-blue-800">
                  {roleLabels[member.role]}
                </span>

                {/* Dropdown for language ONLY when member is Monteur */}
                {member.role === 'monteur' && (
                  <span className="inline-flex items-center gap-1 rounded-full border border-purple-200 bg-purple-50 px-2 py-0.5 text-xs font-semibold text-purple-900" title="Standard-Sprache der Monteur-App">
                    <Globe className="h-3 w-3 text-purple-600 shrink-0" />
                    <select
                      value={member.defaultLanguage || 'de'}
                      disabled={busy}
                      onChange={event => void updateMember(member, { defaultLanguage: event.target.value as Member['defaultLanguage'] })}
                      className="bg-transparent border-none text-xs font-semibold text-purple-900 cursor-pointer focus:outline-hidden pr-0.5"
                    >
                      {languages.map(l => (
                        <option key={l.code} value={l.code}>{l.flag} {l.label}</option>
                      ))}
                    </select>
                  </span>
                )}
              </div>

              {/* Actions: Bearbeiten, Rolle, Deaktivieren, Löschen */}
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => openEditModal(member)}
                  className="inline-flex items-center gap-1.5 rounded-xl border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 hover:border-slate-400 transition-all cursor-pointer shadow-2xs disabled:opacity-50"
                  title="Benutzerdaten bearbeiten"
                >
                  <Pencil className="h-3.5 w-3.5 text-[#3B82C4]" />
                  <span>Bearbeiten</span>
                </button>
                <select
                  aria-label={`Rolle von ${member.displayName || member.id}`}
                  disabled={busy}
                  value={member.role}
                  onChange={event => void updateMember(member, { role: event.target.value as Role })}
                  className="rounded-xl border border-slate-300 bg-white px-2.5 py-1.5 text-xs cursor-pointer"
                >
                  {Object.entries(roleLabels).map(([key, label]) => <option key={key} value={key}>{label}</option>)}
                </select>
                <button
                  disabled={busy}
                  onClick={() => void updateMember(member, { status: member.status === 'active' ? 'inactive' : 'active' })}
                  className="rounded-xl border border-slate-300 px-2.5 py-1.5 text-xs font-medium hover:bg-slate-50 cursor-pointer disabled:opacity-50"
                >
                  {member.status === 'active' ? 'Deaktivieren' : 'Aktivieren'}
                </button>
                <button
                  disabled={busy}
                  onClick={() => void deleteMember(member)}
                  className="inline-flex items-center gap-1 rounded-xl border border-red-200 bg-red-50 px-2.5 py-1.5 text-xs font-semibold text-red-700 hover:bg-red-100 cursor-pointer disabled:opacity-50"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  <span>Löschen</span>
                </button>
              </div>
            </div>

            {/* Second Line: E-Mail & Phone in one line, and right next to it: Assigned Projects */}
            <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-xs text-slate-600 pt-1.5 border-t border-slate-100">
              <div className="flex items-center gap-1.5">
                <Mail className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                {member.email ? (
                  <a href={`mailto:${member.email}`} className="text-[#3B82C4] hover:underline font-medium">
                    {member.email}
                  </a>
                ) : (
                  <span className="text-slate-400 italic">Keine E-Mail</span>
                )}
              </div>

              <div className="flex items-center gap-1.5">
                <Phone className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                {member.phone ? (
                  <a href={`tel:${member.phone}`} className="text-slate-700 hover:underline">
                    {member.phone}
                  </a>
                ) : (
                  <span className="text-slate-400 italic">Keine Telefonnummer</span>
                )}
              </div>

              {/* Zugeordnete Projekte direkt daneben */}
              <div className="flex flex-wrap items-center gap-1.5 sm:border-l sm:border-slate-200 sm:pl-4">
                <span className="font-semibold text-slate-500">Projekte:</span>
                {member.role === 'admin' ? (
                  <span className="text-slate-400 italic">Alle Projekte (Admin)</span>
                ) : (
                  <>
                    {assigned.map(project => (
                      <span
                        key={project.id}
                        className="inline-flex items-center gap-1 rounded-md border border-blue-200 bg-blue-50 px-2 py-0.5 text-xs font-semibold text-blue-900"
                      >
                        🏢 {project.name}
                        <button
                          type="button"
                          aria-label={`${project.name} entfernen`}
                          disabled={busy}
                          onClick={() =>
                            void updateMember(member, {
                              assignedProjectIds: (member.assignedProjectIds || []).filter(id => id !== project.id),
                            })
                          }
                          className="rounded text-blue-700 hover:text-red-700 cursor-pointer ml-0.5"
                        >
                          ×
                        </button>
                      </span>
                    ))}
                    {available.length > 0 ? (
                      <button
                        type="button"
                        onClick={() => setProjectMember(member)}
                        className="rounded-md border border-dashed border-blue-300 px-2 py-0.5 text-xs font-semibold text-blue-700 hover:bg-blue-50 cursor-pointer"
                      >
                        + Projekt zuordnen
                      </button>
                    ) : (
                      assigned.length === 0 && <span className="text-slate-400 italic">Keinem Projekt zugeordnet</span>
                    )}
                  </>
                )}
              </div>
            </div>
          </div>
        );
      })}{members.length === 0 && <p className="text-sm text-slate-500">Noch keine aktiven Mitglieder.</p>}</div>
    </section>

    {projectMember && <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4" onMouseDown={event => { if (event.target === event.currentTarget) setProjectMember(null); }}><div role="dialog" aria-modal="true" aria-labelledby="project-assignment-title" className="max-h-[85vh] w-full max-w-lg overflow-y-auto rounded-2xl bg-white p-6 shadow-2xl"><div className="flex justify-between gap-3"><h2 id="project-assignment-title" className="text-xl font-semibold">Projekt zuordnen für {projectMember.displayName || projectMember.email}</h2><button onClick={() => setProjectMember(null)}>Schließen</button></div><div className="mt-4 space-y-2">{projects.filter(project => !projectMember.assignedProjectIds?.includes(project.id)).map(project => <button key={project.id} disabled={busy} onClick={async () => { if (await updateMember(projectMember, { assignedProjectIds: [...(projectMember.assignedProjectIds || []), project.id] })) setProjectMember(null); }} className="block w-full rounded-xl border border-slate-200 p-4 text-left hover:bg-blue-50"><strong className="block">{project.name}</strong><span className="text-sm text-slate-500">{project.address || project.location || 'Keine Adresse'} · {project.status}</span></button>)}</div></div></div>}

    {editingMember && (
      <div
        className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4"
        onMouseDown={event => {
          if (event.target === event.currentTarget && !busy) closeEditModal();
        }}
      >
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="edit-member-title"
          className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl bg-white p-6 shadow-2xl"
        >
          <div className="flex items-center justify-between border-b border-slate-100 pb-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#3B82C4]/10 text-[#3B82C4]">
                <User className="h-5 w-5" />
              </div>
              <div>
                <h2 id="edit-member-title" className="text-lg font-bold text-slate-900">
                  Benutzer bearbeiten
                </h2>
                <p className="text-xs text-slate-500">
                  {editingMember.displayName || editingMember.email || editingMember.id}
                </p>
              </div>
            </div>
            <button
              type="button"
              disabled={busy}
              onClick={closeEditModal}
              className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-600 cursor-pointer"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          <form onSubmit={saveEditedMember} className="mt-5 space-y-4">
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1.5">
                Vor- und Nachname
              </label>
              <input
                type="text"
                value={editName}
                onChange={e => setEditName(e.target.value)}
                maxLength={120}
                required
                className="w-full rounded-xl border border-slate-200 px-3.5 py-2.5 text-sm font-medium focus:border-[#3B82C4] focus:outline-hidden"
                placeholder="z. B. Max Mustermann"
              />
            </div>

            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1.5">
                E-Mail-Adresse (Login & Benachrichtigungen)
              </label>
              <div className="relative">
                <Mail className="absolute left-3.5 top-3 h-4 w-4 text-slate-400" />
                <input
                  type="email"
                  value={editEmail}
                  onChange={e => setEditEmail(e.target.value)}
                  maxLength={200}
                  className="w-full rounded-xl border border-slate-200 pl-10 pr-3.5 py-2.5 text-sm font-medium focus:border-[#3B82C4] focus:outline-hidden"
                  placeholder="benutzer@firma.de"
                />
              </div>
              <p className="mt-1 text-[11px] text-slate-400">
                Wird auch für Login und Benachrichtigungs-Mails verwendet.
              </p>
            </div>

            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1.5">
                Telefonnummer
              </label>
              <div className="relative">
                <Phone className="absolute left-3.5 top-3 h-4 w-4 text-slate-400" />
                <input
                  type="tel"
                  value={editPhone}
                  onChange={e => setEditPhone(e.target.value)}
                  maxLength={40}
                  className="w-full rounded-xl border border-slate-200 pl-10 pr-3.5 py-2.5 text-sm font-medium focus:border-[#3B82C4] focus:outline-hidden"
                  placeholder="+49 170 1234567"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1.5">
                  Rolle
                </label>
                <select
                  value={editRole}
                  onChange={e => setEditRole(e.target.value as Role)}
                  className="w-full rounded-xl border border-slate-200 px-3.5 py-2.5 text-sm font-medium bg-white focus:border-[#3B82C4] focus:outline-hidden cursor-pointer"
                >
                  <option value="admin">Administrator</option>
                  <option value="bauleiter">Projektleiter</option>
                  <option value="kaufmaennisch">Kaufmännischer Leiter</option>
                  <option value="monteur">Monteur</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1.5">
                  Status
                </label>
                <select
                  value={editStatus}
                  onChange={e => setEditStatus(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 px-3.5 py-2.5 text-sm font-medium bg-white focus:border-[#3B82C4] focus:outline-hidden cursor-pointer"
                >
                  <option value="active">Aktiv</option>
                  <option value="inactive">Inaktiv</option>
                </select>
              </div>
            </div>

            {editRole === 'monteur' && (
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1.5">
                  <Globe className="inline-block h-3.5 w-3.5 mr-1 text-[#3B82C4]" />
                  Standard-App-Sprache (Monteur-App)
                </label>
                <select
                  value={editLanguage}
                  onChange={e => setEditLanguage(e.target.value as 'de' | 'ro' | 'pl' | 'hr')}
                  className="w-full rounded-xl border border-slate-200 px-3.5 py-2.5 text-sm font-medium bg-white focus:border-[#3B82C4] focus:outline-hidden cursor-pointer"
                >
                  {languages.map(l => (
                    <option key={l.code} value={l.code}>
                      {l.flag} {l.label}
                    </option>
                  ))}
                </select>
                <p className="mt-1 text-[11px] text-slate-400">
                  Die Monteur-App wird bei diesem Benutzer automatisch mit dieser Sprache geladen.
                </p>
              </div>
            )}

            {editRole !== 'admin' && projects.length > 0 && (
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1.5">
                  Zugeordnete Projekte
                </label>
                <div className="space-y-1.5 max-h-36 overflow-y-auto rounded-xl border border-slate-200 p-2.5">
                  {projects.map(p => {
                    const isChecked = editProjectIds.includes(p.id);
                    return (
                      <label
                        key={p.id}
                        className="flex items-center gap-2.5 rounded-lg px-2 py-1.5 text-xs font-medium hover:bg-slate-50 cursor-pointer"
                      >
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={e => {
                            if (e.target.checked) {
                              setEditProjectIds([...editProjectIds, p.id]);
                            } else {
                              setEditProjectIds(editProjectIds.filter(id => id !== p.id));
                            }
                          }}
                          className="h-4 w-4 rounded accent-[#3B82C4]"
                        />
                        <span className="truncate">🏢 {p.name || p.id}</span>
                      </label>
                    );
                  })}
                </div>
              </div>
            )}

            {error && (
              <p role="alert" className="rounded-xl bg-red-50 p-3 text-xs font-medium text-red-700">
                {error}
              </p>
            )}

            <div className="mt-6 flex justify-end gap-2.5 pt-3 border-t border-slate-100">
              <button
                type="button"
                disabled={busy}
                onClick={closeEditModal}
                className="rounded-xl border border-slate-200 px-4 py-2.5 text-xs font-semibold text-slate-600 hover:bg-slate-50 cursor-pointer"
              >
                Abbrechen
              </button>
              <button
                type="submit"
                disabled={busy}
                className="rounded-xl bg-[#3B82C4] px-5 py-2.5 text-xs font-bold text-white hover:bg-[#2B6EB0] disabled:opacity-50 cursor-pointer shadow-sm"
              >
                {busy ? 'Wird gespeichert …' : 'Änderungen speichern'}
              </button>
            </div>
          </form>
        </div>
      </div>
    )}

    <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-lg font-semibold">Einladungshistorie</h2>
          <p className="text-xs text-slate-500">Ausstehende, angenommene und widerrufene Einladungen (angenommene werden nach 30 Tagen automatisch bereinigt).</p>
        </div>
        <span className="text-xs bg-slate-100 text-slate-600 px-2.5 py-1 rounded-full font-bold">
          {invitations.length} {invitations.length === 1 ? 'Eintrag' : 'Einträge'}
        </span>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead className="bg-slate-50 text-xs uppercase text-slate-500 border-y border-slate-100">
            <tr>
              <th className="py-3 px-4">Name / E-Mail</th>
              <th className="py-3 px-3">Rolle</th>
              <th className="py-3 px-3">Projekt</th>
              <th className="py-3 px-3">Status</th>
              <th className="py-3 px-3">Gültig bis</th>
              <th className="py-3 px-4 text-right">Aktionen</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {invitations.map(invitation => {
              const assignedProject = projects.find(p => p.id === invitation.projectId || invitation.assignedProjectIds?.includes(p.id));
              const isPending = invitation.status === 'pending';
              const isRedeemed = invitation.status === 'redeemed';
              const isRevoked = invitation.status === 'revoked';

              return (
                <tr key={invitation.id} className="hover:bg-slate-50/60 transition-colors">
                  <td className="py-3 px-4">
                    <strong className="block text-slate-900">{invitation.displayName}</strong>
                    <span className="text-xs text-slate-500">{invitation.email || 'Ohne E-Mail'}</span>
                  </td>
                  <td className="py-3 px-3 text-xs font-medium text-slate-700">
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-blue-50 px-2.5 py-0.5 text-xs font-bold text-blue-800">
                      {roleLabels[invitation.role]}
                      {invitation.defaultLanguage && (
                        <span title={`App-Sprache: ${languages.find(l => l.code === invitation.defaultLanguage)?.label}`}>
                          {languages.find(l => l.code === invitation.defaultLanguage)?.flag}
                        </span>
                      )}
                    </span>
                  </td>
                  <td className="py-3 px-3 text-xs text-slate-600">
                    {assignedProject ? (
                      <span className="inline-flex items-center gap-1 font-semibold text-blue-900 bg-blue-50/70 border border-blue-200/60 px-2 py-0.5 rounded-md">
                        🏢 {assignedProject.name}
                      </span>
                    ) : invitation.projectName ? (
                      <span className="inline-flex items-center gap-1 font-semibold text-blue-900 bg-blue-50/70 border border-blue-200/60 px-2 py-0.5 rounded-md">
                        🏢 {invitation.projectName}
                      </span>
                    ) : (
                      <span className="text-slate-400">Keinem Projekt</span>
                    )}
                  </td>
                  <td className="py-3 px-3">
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-bold ${
                      isRedeemed ? 'bg-emerald-100 text-emerald-800' :
                      isRevoked ? 'bg-slate-100 text-slate-500' :
                      'bg-amber-100 text-amber-800'
                    }`}>
                      {isRedeemed ? '✓ Angenommen' : isRevoked ? 'Widerrufen' : 'Ausstehend'}
                    </span>
                    {invitation.emailError ? (
                      <span className="block text-[10px] text-red-600 mt-0.5">E-Mail nicht versendet</span>
                    ) : invitation.emailSent ? (
                      <span className="block text-[10px] text-emerald-600 mt-0.5">E-Mail versendet</span>
                    ) : null}
                  </td>
                  <td className="py-3 px-3 text-xs text-slate-500">
                    {invitation.expiresAt ? new Date(invitation.expiresAt).toLocaleDateString('de-DE') : '–'}
                  </td>
                  <td className="py-3 px-4 text-right">
                    <div className="flex items-center justify-end gap-3">
                      {isPending && invitation.email && (
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() => void resend(invitation)}
                          className="cursor-pointer text-xs font-semibold text-[#7E3FE6] hover:underline"
                          title="Einladung erneut per E-Mail versenden"
                        >
                          Erneut einladen
                        </button>
                      )}
                      {isPending && (
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() => void revoke(invitation.id)}
                          className="cursor-pointer text-xs font-semibold text-amber-700 hover:underline"
                          title="Einladung widerrufen"
                        >
                          Widerrufen
                        </button>
                      )}
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => void deleteInvitation(invitation.id, invitation.displayName)}
                        className="cursor-pointer text-xs font-semibold text-red-600 hover:underline"
                        title="Einladung manuell löschen"
                      >
                        Löschen
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {invitations.length === 0 && (
          <p className="text-sm text-slate-500 text-center py-8">Noch keine Einladungen in der Historie.</p>
        )}
      </div>
    </section>

    {modalOpen && <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4" onMouseDown={event => { if (event.target === event.currentTarget && !busy) closeModal(); }}><div role="dialog" aria-modal="true" aria-labelledby="member-invite-title" className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-3xl bg-white p-6 shadow-2xl sm:p-8"><div className="flex items-start justify-between gap-4"><div><h2 id="member-invite-title" className="text-xl font-semibold">{result ? result.emailSent ? 'Einladung versendet' : 'Einladung erstellt' : 'Benutzer einladen'}</h2><p className="mt-1 text-sm text-slate-600">{result ? 'Aktivierungsdaten für die eingeladene Person.' : 'Rolle, Projekt und Kontaktdaten angeben.'}</p></div><button type="button" disabled={busy} onClick={closeModal} className="rounded-xl bg-slate-100 px-3 py-2 text-sm font-semibold cursor-pointer hover:bg-slate-200">Schließen</button></div>
      {result ? <div className="mt-6 space-y-4"><div className="flex flex-wrap items-center gap-4 rounded-xl bg-slate-50 p-4"><img src={result.qrDataUrl} alt="Einladungs-QR-Code" className="h-32 w-32 rounded-lg bg-white"/><div className="min-w-0 flex-1"><p className="text-sm font-semibold">{result.emailSent ? `Einladung an ${resultEmail} versendet` : result.emailError ? 'Einladung erstellt, E-Mail nicht versendet.' : 'Einladung erstellt.'}</p>{resultRole === 'monteur' && <div className="mt-2 flex items-center gap-2"><input aria-label="Aktivierungscode" readOnly value={result.shortCode} onFocus={event => event.currentTarget.select()} className="min-w-0 flex-1 bg-transparent font-mono text-xl font-bold"/><button type="button" onClick={() => void copy(result.shortCode, 'Code')} aria-label="Code kopieren"><Copy className="h-4 w-4"/></button></div>}</div></div>{resultRole !== 'monteur' && <div><label htmlFor="member-invite-link" className="text-sm font-semibold">Aktivierungslink</label><div className="mt-2 flex items-center gap-2"><input id="member-invite-link" readOnly value={result.webInviteUrl || ''} onFocus={event => event.currentTarget.select()} className="min-w-0 flex-1 rounded-lg border border-slate-200 p-2 text-xs"/><button type="button" onClick={() => void copy(result.webInviteUrl || '', 'Link')} aria-label="Link kopieren" className="rounded-lg bg-slate-100 p-2"><Copy className="h-4 w-4"/></button></div></div>}{result.emailError && resultEmail && <button type="button" disabled={busy} onClick={() => void resend({ id: result.inviteId, displayName: name, email: resultEmail, role: resultRole, status: 'pending' })} className="w-full rounded-xl bg-[var(--tenant-primary-surface)] p-3 font-semibold text-[var(--tenant-primary-text)] disabled:opacity-50 cursor-pointer">{busy ? 'Wird gesendet …' : 'Erneut einladen'}</button>}{error && <p role="alert" className="rounded-xl bg-red-50 p-3 text-sm text-red-700">{error}</p>}{notice && <p role="status" className="rounded-xl bg-emerald-50 p-3 text-sm text-emerald-800">{notice}</p>}<button type="button" onClick={downloadPdf} className="text-sm font-semibold text-[var(--tenant-secondary)] hover:underline cursor-pointer">Einladungs-PDF herunterladen</button></div>
      : <form onSubmit={invite} className="mt-6 space-y-5">
          <label className="block text-sm font-semibold">Rolle<select value={role} onChange={event => setRole(event.target.value as Role)} className="mt-2 w-full rounded-xl border border-slate-300 bg-white px-4 py-3 cursor-pointer">{Object.entries(roleLabels).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></label>
          {role === 'monteur' && (
            <label className="block text-sm font-semibold">
              App-Sprache für Monteur
              <select
                value={inviteLanguage}
                onChange={event => setInviteLanguage(event.target.value as 'de' | 'ro' | 'pl' | 'hr')}
                className="mt-2 w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm cursor-pointer"
              >
                {languages.map(l => (
                  <option key={l.code} value={l.code}>
                    {l.flag} {l.label}
                  </option>
                ))}
              </select>
            </label>
          )}
          {projects.length > 0 && (
            <label className="block text-sm font-semibold">Projektzuweisung
              <select
                value={selectedProjectId}
                onChange={event => setSelectedProjectId(event.target.value)}
                className="mt-2 w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm cursor-pointer"
              >
                <option value="">Keinem Projekt zuordnen</option>
                {projects.map(project => (
                  <option key={project.id} value={project.id}>
                    🏢 {project.name || project.id}
                  </option>
                ))}
              </select>
            </label>
          )}
          <label className="block text-sm font-semibold">Vor- und Nachname<input required value={name} onChange={event => setName(event.target.value)} className="mt-2 w-full rounded-xl border border-slate-300 px-4 py-3"/></label>
          <label className="block text-sm font-semibold">E-Mail{role === 'monteur' ? ' (optional)' : ''}<input type="email" required={role !== 'monteur'} value={email} onChange={event => setEmail(event.target.value)} className="mt-2 w-full rounded-xl border border-slate-300 px-4 py-3"/></label>
          {error && <p role="alert" className="rounded-xl bg-red-50 p-3 text-sm text-red-700">{error}</p>}
          <button disabled={busy} className="w-full rounded-xl bg-[var(--tenant-primary-surface)] px-4 py-3 font-semibold text-[var(--tenant-primary-text)] disabled:opacity-50 cursor-pointer">{busy ? 'Einladung wird gesendet …' : 'Jetzt einladen'}</button>
        </form>}
    </div></div>}
  </div>;
}
