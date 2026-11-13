import { useCallback, useEffect, useState, useRef, type FormEvent, type ReactNode } from 'react';
import { ArrowLeft, Ban, Building2, Camera, Check, Copy, ImageUp, Mail, Pencil, Plus, RefreshCw, Save, Trash2, Users } from 'lucide-react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { getDownloadURL, ref, uploadBytesResumable, type UploadTask } from 'firebase/storage';
import { collection, doc, getDoc, getDocs } from 'firebase/firestore';
import { db, storage } from '../firebase';
import { api } from '../services/apiClient';

type Role = 'admin' | 'bauleiter' | 'kaufmaennisch' | 'monteur';
interface Company { legalName?: string; street?: string; postalCode?: string; city?: string; country?: string; phone?: string; email?: string; website?: string; billingSameAsContact?: boolean; billingName?: string; billingEmail?: string; billingPhone?: string; vatId?: string; contactName?: string; }
interface Tenant { id: string; name: string; slug: string; publicSlug?: string; status: string; company?: Company; branding?: { primaryColor?: string; secondaryColor?: string; logoPath?: string | null; logoZoom?: number }; }
interface Member { id: string; displayName?: string; email?: string; role?: Role; status?: string; }
interface Invite { id: string; displayName: string; email?: string; role: Role; status: string; emailSent?: boolean; emailError?: string | null; expiresAt?: string; }
interface InviteResult { inviteId: string; qrToken: string; shortCode: string; qrDataUrl: string; webInviteUrl?: string; pdfBase64: string; emailSent: boolean; emailError?: string | null; }

const roles: Array<{ id: Role; label: string; help: string }> = [
  { id: 'admin', label: 'Administratoren', help: 'Firma, Benutzer und Projekte verwalten' },
  { id: 'bauleiter', label: 'Bauleiter', help: 'Projekte koordinieren und freigeben' },
  { id: 'kaufmaennisch', label: 'Kaufmann', help: 'Auswertungen und Nachträge bearbeiten' },
  { id: 'monteur', label: 'Monteure', help: 'Zugewiesene Projekte mobil bearbeiten' },
];
const roleNames: Record<Role, string> = { admin: 'Administrator', bauleiter: 'Bauleiter', kaufmaennisch: 'Kaufmann', monteur: 'Monteur' };

export function TenantDetailPage() {
  const { tenantId = '' } = useParams();
  const navigate = useNavigate();
  const [tenant, setTenant] = useState<Tenant | null>(null); const [members, setMembers] = useState<Member[]>([]); const [invites, setInvites] = useState<Invite[]>([]);
  const [inviteRole, setInviteRole] = useState<Role | null>(null); const [result, setResult] = useState<InviteResult | null>(null); const [inviteNotice, setInviteNotice] = useState('');
  const [displayName, setName] = useState(''); const [email, setEmail] = useState(''); const [error, setError] = useState(''); const [notice, setNotice] = useState(''); const [busy, setBusy] = useState(false);
  const [company, setCompany] = useState<Company>({}); const [primaryColor, setPrimaryColor] = useState('#7E3FE6'); const [secondaryColor, setSecondaryColor] = useState('#1F1A4D'); const [logoZoom, setLogoZoom] = useState(1); const [logoFile, setLogoFile] = useState<File | null>(null); const [logoPreview, setLogoPreview] = useState(''); const [savedLogoUrl, setSavedLogoUrl] = useState(''); const [logoLoadError, setLogoLoadError] = useState(false);
  const [editCompany, setEditCompany] = useState(false);
  const [editLogo, setEditLogo] = useState(false);
  const [editMember, setEditMember] = useState<Member | null>(null);
  const [memberName, setMemberName] = useState('');
  const [memberRole, setMemberRole] = useState<Role>('monteur');
  const [memberStatus, setMemberStatus] = useState('active');
  const logoUploadRef = useRef<UploadTask | null>(null);
  const logoCancelledRef = useRef(false);
  useEffect(() => () => { if (logoPreview) URL.revokeObjectURL(logoPreview); }, [logoPreview]);
  useEffect(() => {
    const path = tenant?.branding?.logoPath;
    if (!path) { setSavedLogoUrl(''); setLogoLoadError(false); return; }
    let active = true;
    getDownloadURL(ref(storage, path)).then(url => { if (active) { setSavedLogoUrl(url); setLogoLoadError(false); } }).catch(() => { if (active) { setSavedLogoUrl(''); setLogoLoadError(true); } });
    return () => { active = false; };
  }, [tenant?.branding?.logoPath]);

  const load = useCallback(async () => {
    try {
      const [tenantData, memberData, inviteData] = await Promise.all([api<Tenant>(`/tenants/${tenantId}`), api<Member[]>(`/tenants/${tenantId}/members`), api<Invite[]>(`/tenants/${tenantId}/invites`)]);
      setTenant(tenantData); setMembers(memberData); setInvites(inviteData); setCompany(tenantData.company || {}); setPrimaryColor(tenantData.branding?.primaryColor || '#7E3FE6'); setSecondaryColor(tenantData.branding?.secondaryColor || '#1F1A4D'); setLogoZoom(tenantData.branding?.logoZoom || 1);
    } catch {
      try {
        const [tenantSnap, memberSnap] = await Promise.all([
          getDoc(doc(db, 'tenants', tenantId)),
          getDocs(collection(db, 'tenants', tenantId, 'members')),
        ]);
        if (!tenantSnap.exists()) throw new Error('TENANT_NOT_FOUND');
        const tenantData = { id: tenantSnap.id, ...tenantSnap.data() } as Tenant;
        setTenant(tenantData);
        setMembers(memberSnap.docs.map(item => ({ id: item.id, ...item.data() }) as Member));
        setInvites([]);
        setCompany(tenantData.company || {});
        setPrimaryColor(tenantData.branding?.primaryColor || '#7E3FE6');
        setSecondaryColor(tenantData.branding?.secondaryColor || '#1F1A4D');
        setLogoZoom(tenantData.branding?.logoZoom || 1);
        setError('Die Bearbeitung ist derzeit eingeschränkt. Firmendaten werden direkt aus Firestore angezeigt.');
      } catch (loadError) {
        setError(message(loadError, 'Daten konnten nicht geladen werden.'));
      }
    }
  }, [tenantId]);
  useEffect(() => { void load(); }, [load]);

  async function saveTenant(options: { company?: Company; branding?: { primaryColor?: string; secondaryColor?: string; logoZoom?: number; logoPath?: string | null }; logoFile?: File | null } = {}) {
    if (!tenant) return; setBusy(true); setError(''); setNotice(''); logoCancelledRef.current = false;
    try {
      let logoPath = tenant.branding?.logoPath || null;
      if (options.logoFile) {
        logoPath = `tenants/${tenantId}/branding/logo-${Date.now()}-${options.logoFile.name.replace(/[^a-zA-Z0-9._-]/g, '')}`;
        const upload = uploadBytesResumable(ref(storage, logoPath), options.logoFile, { contentType: options.logoFile.type });
        logoUploadRef.current = upload;
        await new Promise<void>((resolve, reject) => {
          const timer = window.setTimeout(() => { upload.cancel(); reject(new Error('Logo-Upload dauert zu lange. Bitte Verbindung prüfen und erneut versuchen.')); }, 60000);
          upload.on('state_changed', undefined, error => { window.clearTimeout(timer); reject(error); }, () => { window.clearTimeout(timer); resolve(); });
        });
        logoUploadRef.current = null;
        if (logoCancelledRef.current) return;
      }
      const body: { company?: Company; branding?: { primaryColor?: string; secondaryColor?: string; logoZoom?: number; logoPath?: string | null } } = {};
      if (options.company) body.company = options.company;
      if (options.branding || options.logoFile) body.branding = { ...options.branding, ...(options.logoFile ? { logoPath } : {}) };
      await api(`/tenants/${tenantId}`, { method: 'PATCH', body: JSON.stringify(body) });
      if (options.logoFile && logoPath) { void getDownloadURL(ref(storage, logoPath)).then(url => { setSavedLogoUrl(url); setLogoLoadError(false); }).catch(() => setLogoLoadError(true)); }
      if (options.company) { setCompany(options.company); setEditCompany(false); }
      if (options.logoFile) { setLogoFile(null); setLogoPreview(''); }
      if (options.logoFile || options.branding?.logoZoom !== undefined) setEditLogo(false);
      setNotice('Änderungen gespeichert.'); await load();
    } catch (saveError) { if (!logoCancelledRef.current) setError(message(saveError, 'Speichern fehlgeschlagen.')); } finally { logoUploadRef.current = null; setBusy(false); }
  }
  async function setStatus(status: 'active' | 'archived') {
    if (!confirm(status === 'archived' ? 'Firma archivieren? Daten bleiben erhalten, der Zugriff wird gesperrt.' : 'Firma wieder aktivieren?')) return;
    setBusy(true); setError(''); try { await api(`/tenants/${tenantId}`, { method: 'PATCH', body: JSON.stringify({ status }) }); await load(); } catch (statusError) { setError(message(statusError, 'Status konnte nicht geändert werden.')); } finally { setBusy(false); }
  }
  async function deleteTenant() {
    if (!tenant || !confirm(`„${tenant.name}“ endgültig löschen? Alle Projekte, Mitglieder und Dateien dieser Firma werden entfernt.`)) return;
    if (prompt('Zum Bestätigen bitte LÖSCHEN eingeben:') !== 'LÖSCHEN') return;
    setBusy(true); setError('');
    try { await api(`/tenants/${tenantId}`, { method: 'DELETE' }); navigate('/admin/tenants'); }
    catch (e) { setError(message(e, 'Firma konnte nicht gelöscht werden.')); setBusy(false); }
  }
  function openMember(member: Member) {
    setEditMember(member); setMemberName(member.displayName || ''); setMemberRole(member.role || 'monteur'); setMemberStatus(member.status || 'active'); setError('');
  }
  async function saveMember(event: FormEvent) {
    event.preventDefault(); if (!editMember) return;
    setBusy(true); setError(''); setNotice('');
    try {
      await api(`/tenants/${tenantId}/members/${encodeURIComponent(editMember.id)}`, { method: 'PATCH', body: JSON.stringify({ displayName: memberName.trim(), role: memberRole, status: memberStatus }) });
      setEditMember(null); await load(); setNotice('Mitglied aktualisiert.');
    } catch (e) { setError(e instanceof Error && e.message === 'LAST_ADMIN_REQUIRED' ? 'Mindestens ein aktiver Administrator muss erhalten bleiben.' : message(e, 'Mitglied konnte nicht gespeichert werden.')); }
    finally { setBusy(false); }
  }
  async function deleteMember(member: Member) {
    if (!confirm(`„${member.displayName || member.email || 'Dieses Mitglied'}“ aus dieser Firma entfernen? Der Zugang zu dieser Firma wird entzogen.`)) return;
    setBusy(true); setError(''); setNotice('');
    try {
      await api(`/tenants/${tenantId}/members/${encodeURIComponent(member.id)}`, { method: 'DELETE' });
      await load(); setNotice('Mitglied aus der Firma entfernt.');
    } catch (e) { setError(e instanceof Error && e.message === 'LAST_ADMIN_REQUIRED' ? 'Mindestens ein aktiver Administrator muss erhalten bleiben. Lade zuerst einen weiteren Administrator ein.' : e instanceof Error && e.message === 'SELF_REMOVAL_DENIED' ? 'Du kannst deinen eigenen Firmenzugang hier nicht entfernen.' : message(e, 'Mitglied konnte nicht entfernt werden.')); }
    finally { setBusy(false); }
  }
  function closeLogo() {
    logoCancelledRef.current = true; logoUploadRef.current?.cancel(); setBusy(false);
    setEditLogo(false); setLogoFile(null); setLogoPreview(''); setLogoZoom(tenant?.branding?.logoZoom || 1); setError('');
  }
  const hasAdmin = members.some(member => member.role === 'admin' && member.status === 'active') || invites.some(item => item.role === 'admin' && item.status === 'pending' && Boolean(item.expiresAt && new Date(item.expiresAt) > new Date()));
  function openInvite(role: Role = 'admin', name = '', contactEmail = '') {
    setInviteRole(hasAdmin ? role : 'admin'); setName(name); setEmail(contactEmail); setResult(null); setInviteNotice(''); setError('');
  }
  function closeInvite() { setInviteRole(null); setResult(null); setName(''); setEmail(''); setInviteNotice(''); setError(''); }
  async function invite(event: FormEvent) {
    event.preventDefault(); if (!inviteRole) return; setBusy(true); setError('');
    try { const data = await api<InviteResult>(`/tenants/${tenantId}/invites`, { method: 'POST', body: JSON.stringify({ displayName, email: email || undefined, role: inviteRole }) }); setResult(data); setInviteNotice(''); await load(); }
    catch (inviteError) { setError(message(inviteError, 'Einladung konnte nicht erstellt werden.')); } finally { setBusy(false); }
  }
  async function revoke(id: string) { try { await api(`/tenants/${tenantId}/invites/${id}/revoke`, { method: 'POST' }); await load(); } catch (e) { setError(message(e, 'Widerrufen fehlgeschlagen.')); } }
  async function resend(id: string) { setBusy(true); setError(''); try { const data = await api<InviteResult>(`/tenants/${tenantId}/invites/${id}/resend`, { method: 'POST' }); const item = invites.find(invite => invite.id === id); setInviteRole(item?.role || inviteRole || 'admin'); setName(item?.displayName || displayName); setEmail(item?.email || email); setResult(data); setInviteNotice(''); await load(); } catch (e) { setError(message(e, 'Neuversand fehlgeschlagen.')); } finally { setBusy(false); } }
  function invitePdf(): Blob | null { if (!result) return null; const bytes = Uint8Array.from(atob(result.pdfBase64), char => char.charCodeAt(0)); return new Blob([bytes], { type: 'application/pdf' }); }
  function downloadPdf() { const pdf = invitePdf(); if (!pdf) return; const url = URL.createObjectURL(pdf); const anchor = document.createElement('a'); anchor.href = url; anchor.download = 'P12-Aufmass-Einladung.pdf'; anchor.click(); window.setTimeout(() => URL.revokeObjectURL(url), 1000); }
  function activationLink() { const companyPath = encodeURIComponent((tenant?.publicSlug || tenant?.slug || tenantId).toUpperCase()); return result ? result.webInviteUrl || `${window.location.origin}/${companyPath}/invite?token=${encodeURIComponent(result.qrToken)}&Firma=${companyPath}` : ''; }
  async function copyInviteText(value: string, label: string) {
    const field = document.createElement('textarea');
    field.value = value; field.setAttribute('readonly', ''); field.style.position = 'fixed'; field.style.opacity = '0';
    document.body.appendChild(field);
    let copied = false;
    try { field.focus(); field.select(); copied = document.execCommand('copy'); }
    catch { copied = false; }
    finally { field.remove(); }
    if (copied) { setInviteNotice(`${label} kopiert.`); return; }
    try { await navigator.clipboard.writeText(value); setInviteNotice(`${label} kopiert.`); }
    catch { setInviteNotice('Kopieren wurde vom Browser blockiert. Bitte den Text im Feld markieren und manuell kopieren.'); }
  }
  const field = (key: Exclude<keyof Company, 'billingSameAsContact'>, placeholder: string, type = 'text') => {
    const linked = company.billingSameAsContact && key.startsWith('billing');
    const linkedKey: 'contactName' | 'email' | 'phone' = key === 'billingName' ? 'contactName' : key === 'billingEmail' ? 'email' : 'phone';
    return <input type={type} disabled={linked} className="rounded-xl border border-[#EBE4F6] bg-[#F7F4FD] px-3 py-2.5 text-sm outline-none focus:border-[#7E3FE6] focus:bg-white disabled:opacity-60" placeholder={placeholder} value={(linked ? company[linkedKey] : company[key]) || ''} onChange={e => setCompany(current => ({ ...current, [key]: e.target.value }))}/>;
  };
  const visibleLogo = logoPreview || savedLogoUrl;

  return <div className="min-h-screen bg-[#F7F4FD]">
    <header className="border-b border-[#EBE6F4] bg-white"><div className="mx-auto flex h-20 max-w-[1440px] items-center justify-between gap-4 px-4 sm:px-6"><div className="flex min-w-0 items-center gap-4"><img src="/p12-aufmass-logo.svg" alt="P12 Aufmaß" className="h-auto w-44 max-w-[42vw] sm:w-56"/><span className="hidden border-l border-[#E7E0F2] pl-4 text-sm font-medium text-[#6B6481] sm:inline">P12 Ventures</span></div><Link to={`/t/${tenantId}`} className="shrink-0 rounded-xl bg-[#7E3FE6] px-3 py-2 text-xs font-semibold text-white hover:bg-[#6B2BD8] sm:px-4">Projekt-Cockpit öffnen</Link></div></header>
    <main className="mx-auto max-w-[1440px] space-y-6 p-6">
      <Link to="/admin/tenants" className="inline-flex items-center gap-2 text-sm font-semibold text-[#6B6481] hover:text-[#1F1A4D]"><ArrowLeft className="h-4 w-4"/>Firmenverwaltung</Link>
      <section className="flex flex-wrap items-center justify-between gap-4 rounded-3xl bg-white p-6 shadow-sm">
        <div className="flex items-center gap-4"><button type="button" onClick={()=>setEditLogo(true)} aria-label="Firmenlogo bearbeiten" title="Firmenlogo bearbeiten" className="relative flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-[#F2EBFF] text-[#7E3FE6] transition hover:bg-[#E7D8FF] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#7E3FE6]"><span className="absolute inset-0 flex items-center justify-center overflow-hidden rounded-2xl p-1">{visibleLogo ? <img src={visibleLogo} alt="" className="max-h-full max-w-full object-contain" style={{ transform: `scale(${logoZoom})` }}/> : <Camera className="h-6 w-6"/>}</span><Pencil className="absolute -bottom-1 -right-1 h-5 w-5 rounded-full bg-[#7E3FE6] p-1 text-white"/></button><div><div className="flex flex-wrap items-center gap-2"><h1 className="text-2xl font-semibold text-[#1F1A4D]">{tenant?.name || tenantId}</h1><Status status={tenant?.status}/></div><p className="text-sm text-[#6B6481]">{members.length} Benutzer</p></div></div>
        <div className="flex flex-wrap items-center gap-x-8 gap-y-4">
          <div className="flex flex-wrap items-center gap-5"><label className="flex items-center gap-2 text-xs font-semibold">Primärfarbe<input aria-label="Primärfarbe" type="color" value={primaryColor} onChange={e=>setPrimaryColor(e.target.value)} onBlur={()=>void saveTenant({branding:{primaryColor}})} className="admin-color-picker h-10 w-10 cursor-pointer rounded-full"/></label><label className="flex items-center gap-2 text-xs font-semibold">Sekundärfarbe<input aria-label="Sekundärfarbe" type="color" value={secondaryColor} onChange={e=>setSecondaryColor(e.target.value)} onBlur={()=>void saveTenant({branding:{secondaryColor}})} className="admin-color-picker h-10 w-10 cursor-pointer rounded-full"/></label></div>
          <div className="flex flex-wrap items-center gap-3"><button disabled={busy} onClick={() => void setStatus(tenant?.status === 'archived' ? 'active' : 'archived')} className="rounded-xl bg-[#F2EBFF] px-4 py-2 text-xs font-semibold text-[#1F1A4D] hover:bg-[#E7D8FF]">{tenant?.status === 'archived' ? 'Firma wiederherstellen' : 'Firma archivieren'}</button><button disabled={busy} onClick={()=>void deleteTenant()} className="flex items-center gap-2 rounded-xl bg-red-50 px-4 py-2 text-xs font-semibold text-red-700 hover:bg-red-100"><Trash2 className="h-4 w-4"/>Firma löschen</button></div>
        </div>
      </section>
      {error && <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm font-semibold text-red-700">{error}</div>}{notice && <div className="flex gap-2 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm font-semibold text-emerald-700"><Check className="h-4 w-4"/>{notice}</div>}
      <div>
        <section className="rounded-[22px] bg-white px-7 pb-12 pt-8 shadow-[0_10px_30px_-22px_#1F1A4D33] sm:px-10 sm:pb-16 sm:pt-10 lg:px-12">
          <div className="flex flex-wrap items-start justify-between gap-4"><Heading icon={Building2} title="Firmendaten" text="Allgemeine Angaben und Ansprechpartner"/><button onClick={()=>setEditCompany(true)} className="flex items-center gap-2 rounded-xl bg-[#F2EBFF] px-4 py-2 text-sm font-semibold text-[#7E3FE6] hover:bg-[#E7D8FF]"><Pencil className="h-4 w-4"/>Bearbeiten</button></div>
          <div className="mt-6 grid gap-x-16 gap-y-12 md:grid-cols-2 lg:mt-8 lg:gap-y-14">
            <InfoGroup title="Unternehmen"><InfoRow label="Firmenname" value={company.legalName || tenant?.name} onEdit={()=>setEditCompany(true)}/><InfoRow label="Webseite" value={company.website} onEdit={()=>setEditCompany(true)} website/><InfoRow label="USt-IdNr." value={company.vatId} onEdit={()=>setEditCompany(true)}/></InfoGroup>
            <InfoGroup title="Anschrift"><InfoRow label="Straße" value={company.street} onEdit={()=>setEditCompany(true)}/><InfoRow label="PLZ / Ort" value={[company.postalCode,company.city].filter(Boolean).join(' ')} onEdit={()=>setEditCompany(true)}/><InfoRow label="Land" value={company.country} onEdit={()=>setEditCompany(true)}/></InfoGroup>
            <InfoGroup title="Genereller Kontakt" action={<button type="button" onClick={()=>openInvite('admin', company.contactName, company.email)} className="inline-flex items-center gap-1 rounded-lg bg-[#F2EBFF] px-2.5 py-1 text-xs font-semibold text-[#7E3FE6] hover:bg-[#E7D8FF]"><Plus className="h-3.5 w-3.5"/>Einladen</button>}><InfoRow label="Name" value={company.contactName} onEdit={()=>setEditCompany(true)}/><InfoRow label="E-Mail" value={company.email} onEdit={()=>setEditCompany(true)}/><InfoRow label="Telefon" value={company.phone} onEdit={()=>setEditCompany(true)}/></InfoGroup>
            <InfoGroup title="Rechnungskontakt" action={<button type="button" onClick={()=>openInvite('admin', company.billingSameAsContact ? company.contactName : company.billingName, company.billingSameAsContact ? company.email : company.billingEmail)} className="inline-flex items-center gap-1 rounded-lg bg-[#F2EBFF] px-2.5 py-1 text-xs font-semibold text-[#7E3FE6] hover:bg-[#E7D8FF]"><Plus className="h-3.5 w-3.5"/>Einladen</button>}><InfoRow label="Name" value={company.billingSameAsContact ? company.contactName : company.billingName} onEdit={()=>setEditCompany(true)}/><InfoRow label="E-Mail" value={company.billingSameAsContact ? company.email : company.billingEmail} onEdit={()=>setEditCompany(true)}/><InfoRow label="Telefon" value={company.billingSameAsContact ? company.phone : company.billingPhone} onEdit={()=>setEditCompany(true)}/></InfoGroup>
          </div>
        </section>
      </div>
      <section>
        <Heading icon={Users} title="Benutzer und Rollen" text="Mitglieder werden erst nach Einlösung ihrer Einladung als Benutzer angezeigt."/>
        {!hasAdmin && <p className="mt-3 rounded-xl bg-[#F2EBFF] p-3 text-sm text-[#1F1A4D]">Lade zuerst einen Administrator ein. Danach kannst du weitere Rollen vergeben.</p>}
        <div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {roles.map(group => <div key={group.id} className="rounded-3xl bg-white p-4 shadow-sm">
            <div className="flex items-start justify-between gap-3"><div><h3 className="font-black text-[#1F1A4D]">{group.label}</h3><p className="mt-1 text-[11px] leading-4 text-[#89839B]">{group.help}</p></div><button type="button" onClick={()=>openInvite(group.id)} aria-label={`${roleNames[group.id]} einladen`} title={hasAdmin || group.id==='admin' ? `${roleNames[group.id]} einladen` : 'Zuerst Administrator einladen'} className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[#7E3FE6] text-white hover:bg-[#6B2BD8]"><Plus className="h-4 w-4"/></button></div>
            <div className="mt-4 space-y-2">{members.filter(m=>m.role===group.id).map(m=><div key={m.id} className="flex items-center justify-between gap-2 rounded-xl bg-[#F7F4FD] p-3"><div className="min-w-0"><p className="truncate text-sm font-bold">{m.displayName || m.email || 'Unbenannter Benutzer'}</p><p className="mt-0.5 truncate text-[11px] text-[#6B6481]">{m.email || 'ohne E-Mail'} · {m.status === 'active' ? 'aktiv' : 'inaktiv'}</p></div><div className="flex shrink-0 gap-1"><button type="button" disabled={busy} onClick={()=>openMember(m)} aria-label={`${m.displayName || 'Mitglied'} bearbeiten`} title="Bearbeiten" className="rounded-lg p-1.5 text-[#7E3FE6] hover:bg-[#E7D8FF] disabled:opacity-50"><Pencil className="h-4 w-4"/></button><button type="button" disabled={busy} onClick={()=>void deleteMember(m)} aria-label={`${m.displayName || 'Mitglied'} entfernen`} title="Aus Firma entfernen" className="rounded-lg p-1.5 text-red-600 hover:bg-red-50 disabled:opacity-50"><Trash2 className="h-4 w-4"/></button></div></div>)}{!members.some(m=>m.role===group.id) && <p className="py-4 text-center text-xs text-[#89839B]">Noch niemand zugeordnet</p>}</div>
          </div>)}
        </div>
      </section>
      {editMember && <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#1F1A4D]/55 p-4" onMouseDown={e=>{if(e.target===e.currentTarget && !busy) setEditMember(null);}}><form onSubmit={saveMember} role="dialog" aria-modal="true" aria-labelledby="member-dialog-title" className="w-full max-w-md rounded-3xl bg-white p-6 shadow-2xl"><div className="mb-5 flex items-center justify-between gap-3"><h2 id="member-dialog-title" className="text-xl font-semibold text-[#1F1A4D]">Mitglied bearbeiten</h2><button type="button" disabled={busy} onClick={()=>setEditMember(null)} className="rounded-xl bg-[#F2EBFF] px-3 py-2 text-sm font-semibold">Schließen</button></div><div className="space-y-4"><label className="block text-sm font-semibold">Name<input required maxLength={120} value={memberName} onChange={e=>setMemberName(e.target.value)} className="mt-2 w-full rounded-xl border border-[#E8E2F0] px-4 py-3"/></label><div className="text-sm"><span className="font-semibold">E-Mail</span><p className="mt-1 text-[#6B6481]">{editMember.email || 'Keine E-Mail hinterlegt'}</p></div><label className="block text-sm font-semibold">Rolle<select value={memberRole} onChange={e=>setMemberRole(e.target.value as Role)} className="mt-2 w-full rounded-xl border border-[#E8E2F0] bg-white px-4 py-3">{roles.map(item=><option key={item.id} value={item.id}>{roleNames[item.id]}</option>)}</select></label><label className="block text-sm font-semibold">Status<select value={memberStatus} onChange={e=>setMemberStatus(e.target.value)} className="mt-2 w-full rounded-xl border border-[#E8E2F0] bg-white px-4 py-3"><option value="active">Aktiv</option><option value="inactive">Inaktiv</option></select></label></div>{error && <p role="alert" className="mt-4 rounded-xl bg-red-50 p-3 text-sm text-red-700">{error}</p>}<button disabled={busy} className="mt-6 w-full rounded-xl bg-[#7E3FE6] px-4 py-3 font-semibold text-white disabled:opacity-50">{busy ? 'Speichern …' : 'Änderungen speichern'}</button></form></div>}
      {editLogo && <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#1F1A4D]/55 p-4" onMouseDown={e=>{if(e.target===e.currentTarget) closeLogo();}}><div role="dialog" aria-modal="true" aria-labelledby="logo-dialog-title" className="w-full max-w-lg rounded-3xl bg-white p-6 shadow-2xl"><div className="mb-5 flex items-start justify-between gap-4"><div><h2 id="logo-dialog-title" className="text-xl font-semibold text-[#1F1A4D]">Firmenlogo</h2><p className="mt-1 text-sm text-[#6B6481]">So erscheint das Logo neben dem Firmennamen.</p></div><button type="button" onClick={closeLogo} className="rounded-xl bg-[#F2EBFF] px-3 py-2 text-sm font-semibold text-[#1F1A4D]">Schließen</button></div><div className="rounded-2xl bg-[#F7F4FD] p-6"><div className="mx-auto flex h-56 w-56 items-center justify-center overflow-hidden rounded-[32px] bg-white p-4 outline-2 outline-dashed outline-[#7E3FE6]">{visibleLogo ? <img src={visibleLogo} alt="Vorschau Firmenlogo" className="max-h-full max-w-full object-contain" style={{transform:`scale(${logoZoom})`}}/> : <span className="px-4 text-center text-sm text-[#89839B]">Noch kein Logo ausgewählt</span>}</div><p className="mt-4 text-center text-xs text-[#6B6481]">Die gestrichelte Linie zeigt den sichtbaren Ausschnitt. Alles außerhalb wird abgeschnitten. Vorschau 4× vergrößert.</p></div><label className="mt-5 flex cursor-pointer items-center justify-center gap-2 rounded-xl bg-[#F2EBFF] px-4 py-3 text-sm font-semibold text-[#7E3FE6]"><ImageUp className="h-4 w-4"/>Logo auswählen<input type="file" accept="image/png,image/jpeg,image/svg+xml,image/webp" className="hidden" onChange={e=>{const file=e.target.files?.[0];if(file){setLogoFile(file);setLogoPreview(URL.createObjectURL(file));setLogoZoom(1);}}}/></label><label className="mt-5 block text-sm font-medium text-[#1F1A4D]">Logo-Zoom: {Math.round(logoZoom*100)} %<input type="range" min="0.5" max="3" step="0.05" value={logoZoom} onChange={e=>setLogoZoom(Number(e.target.value))} className="mt-2 w-full accent-[#7E3FE6]"/></label>{logoLoadError && !logoPreview && <p className="mt-3 text-sm text-amber-700">Das gespeicherte Logo konnte nicht geladen werden. Bitte erneut auswählen.</p>}{error && <p role="alert" className="mt-3 rounded-xl bg-red-50 p-3 text-sm text-red-700">{error}</p>}<button type="button" disabled={busy || (!logoFile && logoZoom === (tenant?.branding?.logoZoom || 1))} onClick={()=>void saveTenant({logoFile,branding:{logoZoom}})} className="mt-5 w-full rounded-xl bg-[#7E3FE6] px-4 py-3 text-sm font-semibold text-white hover:bg-[#6B2BD8] disabled:opacity-50">{busy ? 'Speichern …' : 'Logo und Größe speichern'}</button></div></div>}
      {editCompany && <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#1F1A4D]/50 p-4"><form onSubmit={e=>{e.preventDefault();void saveTenant({company});}} className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-3xl bg-white p-6 shadow-2xl"><div className="mb-5 flex items-center justify-between"><h2 className="text-xl font-semibold text-[#1F1A4D]">Firmendaten bearbeiten</h2><button type="button" onClick={()=>setEditCompany(false)} className="rounded-xl px-3 py-2 text-sm text-[#6B6481] hover:bg-[#F2EBFF]">Schließen</button></div><div className="space-y-5"><fieldset className="grid gap-3 sm:grid-cols-2"><legend className="mb-3 font-semibold">Firma</legend>{field('legalName','Firmenname')}{field('street','Straße und Hausnummer')}{field('postalCode','PLZ')}{field('city','Ort')}{field('country','Land')}{field('website','Webseite')}{field('vatId','USt-IdNr.')}</fieldset><fieldset className="grid gap-3 sm:grid-cols-2"><legend className="mb-3 font-semibold">Firmenkontakt</legend>{field('contactName','Ansprechpartner')}{field('email','E-Mail','email')}{field('phone','Telefon','tel')}</fieldset><fieldset className="grid gap-3 sm:grid-cols-2"><legend className="mb-3 font-semibold">Rechnungskontakt</legend><label className="flex items-center gap-2 rounded-xl bg-[#F2EBFF] px-3 py-2 text-sm font-medium sm:col-span-2"><input type="checkbox" checked={company.billingSameAsContact || false} onChange={e=>setCompany(current=>({...current,billingSameAsContact:e.target.checked}))} className="h-4 w-4 accent-[#7E3FE6]"/>Gleich wie Firmenkontakt</label>{field('billingName','Name')}{field('billingEmail','E-Mail','email')}{field('billingPhone','Telefon','tel')}</fieldset></div><button disabled={busy} className="mt-5 flex w-full items-center justify-center gap-2 rounded-xl bg-[#7E3FE6] py-3 text-sm font-semibold text-white"><Save className="h-4 w-4"/>Änderungen speichern</button></form></div>}
      {inviteRole && <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#1F1A4D]/60 p-4" onMouseDown={e=>{if(e.target===e.currentTarget && !busy) closeInvite();}}><div role="dialog" aria-modal="true" aria-labelledby="invite-dialog-title" className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-3xl bg-white p-6 shadow-2xl sm:p-8"><div className="mb-6 flex items-start justify-between gap-4"><div><h2 id="invite-dialog-title" className="text-xl font-semibold text-[#1F1A4D]">{result ? result.emailSent ? 'Einladung versendet' : 'Einladung erstellt' : 'Person einladen'}</h2><p className="mt-1 text-sm text-[#6B6481]">{result ? 'Aktivierungsdaten für die eingeladene Person.' : 'Wähle die Rolle und ergänze die Kontaktdaten.'}</p></div><button type="button" disabled={busy} onClick={closeInvite} className="rounded-xl bg-[#F2EBFF] px-3 py-2 text-sm font-semibold text-[#1F1A4D]">Schließen</button></div>{result ? <div className="space-y-5">
        <div className="flex flex-wrap items-center gap-5 rounded-2xl bg-[#F7F4FD] p-5">
          <img src={result.qrDataUrl} alt="Einladungs-QR-Code" className="h-36 w-36 rounded-xl bg-white"/>
          <div className="min-w-0 flex-1">
            {inviteRole === 'monteur' ? <><label htmlFor="invite-short-code" className="text-xs font-bold uppercase text-[#7E3FE6]">Aktivierungscode</label><div className="mt-2 flex items-center gap-2"><input id="invite-short-code" readOnly value={result.shortCode} onFocus={event => event.currentTarget.select()} className="min-w-0 flex-1 bg-transparent font-mono text-2xl font-bold text-[#1F1A4D] outline-none"/><button type="button" onClick={() => void copyInviteText(result.shortCode, 'Code')} aria-label="Aktivierungscode kopieren" className="rounded-lg bg-white p-2 text-[#7E3FE6] hover:bg-[#EBE2FA]"><Copy className="h-4 w-4"/></button></div></> : <p className="font-semibold text-[#1F1A4D]">{email ? `Einladung für ${email}` : 'Aktivierungslink bereit'}</p>}
            <p className="mt-2 text-sm text-[#625C76]">{result.emailSent ? 'Die E-Mail wurde direkt über P12 Aufmaß versendet.' : result.emailError ? 'Einladung erstellt, E-Mail nicht versendet. Du kannst sie erneut senden.' : 'Einladung erstellt. Gib Code oder PDF an die Person weiter.'}</p>
          </div>
        </div>
        {inviteRole !== 'monteur' && <div className="rounded-xl border border-[#E8E2F0] p-4">
          <label htmlFor="invite-activation-link" className="text-sm font-semibold text-[#1F1A4D]">Aktivierungslink</label>
          <p className="mt-1 text-xs text-[#625C76]">Im privaten Browserfenster öffnen oder der eingeladenen Person weitergeben.</p>
          <div className="mt-3 flex items-center gap-2">
            <input id="invite-activation-link" readOnly value={activationLink()} onFocus={event => event.currentTarget.select()} className="min-w-0 flex-1 rounded-lg border border-[#E8E2F0] px-3 py-2 text-xs text-[#625C76]"/>
            <button type="button" onClick={() => void copyInviteText(activationLink(), 'Aktivierungslink')} aria-label="Aktivierungslink kopieren" className="rounded-lg bg-[#F2EBFF] p-2.5 text-[#7E3FE6] hover:bg-[#E7D8FF]"><Copy className="h-4 w-4"/></button>
          </div>
        </div>}
        {result.emailError && email && <button type="button" disabled={busy} onClick={() => void resend(result.inviteId)} className="w-full rounded-xl bg-[#7E3FE6] px-4 py-3 text-sm font-semibold text-white disabled:opacity-50">{busy ? 'Wird gesendet …' : 'Erneut einladen'}</button>}
        {error && <p role="alert" className="rounded-xl bg-red-50 p-3 text-sm text-red-700">{error}</p>}
        {inviteNotice && <p role="status" className="rounded-xl bg-[#F2EBFF] p-3 text-sm text-[#1F1A4D]">{inviteNotice}</p>}
        <button type="button" onClick={downloadPdf} className="text-sm font-semibold text-[#7E3FE6] hover:underline">Einladungs-PDF herunterladen</button>
      </div> : <form onSubmit={invite} className="space-y-5">{!hasAdmin && <p className="rounded-xl bg-[#F2EBFF] p-3 text-sm text-[#1F1A4D]">Für diese Firma muss zuerst ein Administrator eingeladen werden.</p>}<label className="block text-sm font-semibold text-[#1F1A4D]">Rolle<select value={inviteRole} onChange={e=>setInviteRole(e.target.value as Role)} className="mt-2 w-full rounded-xl border border-[#E8E2F0] bg-white px-4 py-3">{roles.map(role=><option key={role.id} value={role.id} disabled={!hasAdmin && role.id!=='admin'}>{roleNames[role.id]}</option>)}</select></label><label className="block text-sm font-semibold text-[#1F1A4D]">Vor- und Nachname<input className="mt-2 w-full rounded-xl border border-[#E8E2F0] px-4 py-3" value={displayName} onChange={e=>setName(e.target.value)} required/></label><label className="block text-sm font-semibold text-[#1F1A4D]">E-Mail{inviteRole==='monteur' && ' (optional)'}<input type="email" className="mt-2 w-full rounded-xl border border-[#E8E2F0] px-4 py-3" value={email} onChange={e=>setEmail(e.target.value)} required={inviteRole!=='monteur'}/></label>{error && <p role="alert" className="rounded-xl bg-red-50 p-3 text-sm text-red-700">{error}</p>}<button disabled={busy} className="w-full rounded-xl bg-[#7E3FE6] px-5 py-3 text-sm font-semibold text-white hover:bg-[#6B2BD8] disabled:opacity-50">{busy ? 'Einladung wird gesendet …' : 'Jetzt einladen'}</button></form>}</div></div>}
      <section className="overflow-hidden rounded-3xl bg-white shadow-sm"><div className="border-b p-5"><Heading icon={Mail} title="Einladungen" text="Ausstehende, eingelöste und widerrufene Einladungen"/></div><div className="overflow-x-auto"><table className="w-full text-sm"><thead className="bg-[#F7F4FD] text-left text-xs uppercase text-[#6B6481]"><tr><th className="p-4">Name</th><th>Rolle</th><th>Status</th><th>Gültig bis</th><th/></tr></thead><tbody>{invites.map(item=><tr key={item.id} className="border-t"><td className="p-4"><b>{item.displayName}</b><br/><span className="text-xs text-[#6B6481]">{item.email || 'ohne E-Mail'}</span></td><td>{roleNames[item.role]}</td><td>{item.status}</td><td>{item.expiresAt ? new Date(item.expiresAt).toLocaleString('de-DE') : '–'}</td><td><div className="flex gap-3">{item.status !== 'redeemed' && <><button onClick={()=>void resend(item.id)} title="Neu senden"><RefreshCw className="h-4 w-4"/></button><button onClick={()=>void revoke(item.id)} title="Widerrufen" className="text-red-600"><Ban className="h-4 w-4"/></button></>}</div></td></tr>)}</tbody></table>{!invites.length && <p className="p-8 text-center text-sm text-[#89839B]">Noch keine Einladungen vorhanden.</p>}</div></section>
    </main>
  </div>;
}

function Heading({ icon: Icon, title, text }: { icon: typeof Building2; title: string; text: string }) { return <div className="flex items-start gap-3"><div className="rounded-xl bg-[#F2EBFF] p-3 text-[#7E3FE6]"><Icon className="h-5 w-5"/></div><div><h2 className="text-lg font-semibold text-[#1F1A4D]">{title}</h2><p className="text-sm text-[#6B6481]">{text}</p></div></div>; }
function InfoGroup({ title, children, action }: { title: string; children: ReactNode; action?: ReactNode }) { return <div className="min-w-0 border-t border-[#DED3EF] pt-6"><div className="mb-5 flex min-h-7 items-center justify-between gap-3"><h3 className="text-xs font-bold uppercase tracking-wide text-[#7E3FE6]">{title}</h3>{action}</div><div className="space-y-4">{children}</div></div>; }
function InfoRow({ label, value, onEdit, website = false }: { label: string; value?: string; onEdit: () => void; website?: boolean }) {
  const url = website && value ? (/^https?:\/\//i.test(value) ? value : `https://${value}`) : '';
  return <div className="grid min-w-0 grid-cols-[7.5rem_minmax(0,1fr)] items-start gap-x-2 text-sm"><span className="text-[#6B6481]">{label}</span><span className="min-w-0 break-words">{value ? website ? <a href={url} target="_blank" rel="noopener noreferrer" className="font-semibold text-[#7E3FE6] hover:underline">{value}</a> : <span className="font-semibold text-[#1F1A4D]">{value}</span> : <span className="text-[#6B6481]">Nicht hinterlegt <button type="button" onClick={onEdit} className="ml-2 font-semibold text-[#7E3FE6] hover:underline">Ergänzen</button></span>}</span></div>;
}
function Status({ status }: { status?: string }) { const active=status==='active'; return <span className={`rounded-full px-2 py-1 text-[10px] font-bold uppercase ${active?'bg-emerald-100 text-emerald-700':'bg-[#F2EBFF] text-[#625C76]'}`}>{active?'Aktiv':'Archiviert'}</span>; }
function message(error: unknown, fallback: string) { return error instanceof Error ? `${fallback} (${error.message})` : fallback; }
