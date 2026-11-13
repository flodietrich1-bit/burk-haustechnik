import { useEffect, useState, type FormEvent } from 'react';
import { Building2, LogOut, Mail, Phone, Plus, Users } from 'lucide-react';
import { Link } from 'react-router-dom';
import { getDownloadURL, ref } from 'firebase/storage';
import { collection, doc, getDocs, runTransaction, serverTimestamp } from 'firebase/firestore';
import { useAuth } from '../auth/AuthProvider';
import { auth, db, storage } from '../firebase';
import { api } from '../services/apiClient';

interface Tenant { id: string; name: string; status: string; branding?: { logoPath?: string | null; logoZoom?: number }; company?: { contactName?: string; phone?: string; email?: string }; counters?: { activeUsers?: number; inactiveUsers?: number; activeProjects?: number; inactiveProjects?: number }; }

function publicSlugForName(value: string) {
  return value.trim().toLowerCase()
    .replace(/ä/g, 'ae').replace(/ö/g, 'oe').replace(/ü/g, 'ue').replace(/ß/g, 'ss')
    .normalize('NFKD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 60) || 'firma';
}

async function createTenantInFirestore(input: { name: string; contactName: string; phone: string; email: string; primaryColor: string; secondaryColor: string }) {
  const uid = auth.currentUser?.uid;
  if (!uid) throw new Error('Bitte melde dich erneut an.');
  const base = publicSlugForName(input.name);
  const reserved = new Set(['admin', 'invite', 'login', 't', 'api']);
  const slug = reserved.has(base) ? `${base}-${crypto.randomUUID().slice(0, 8)}` : base;
  const tenantId = await runTransaction(db, async transaction => {
    const preferredRef = doc(db, 'tenants', slug);
    const preferred = await transaction.get(preferredRef);
    const id = preferred.exists() ? `${base.slice(0, 49)}-${crypto.randomUUID().slice(0, 8)}` : slug;
    const tenantRef = doc(db, 'tenants', id);
    if (preferred.exists() && (await transaction.get(tenantRef)).exists()) throw new Error('Der Firmenname ist bereits vergeben. Bitte versuche es erneut.');
    transaction.set(tenantRef, {
      name: input.name.trim(), slug: id, publicSlug: id, status: 'active',
      branding: { primaryColor: input.primaryColor, secondaryColor: input.secondaryColor, logoPath: null, logoZoom: 1, logoVersion: 0 },
      company: { legalName: input.name.trim(), contactName: input.contactName.trim(), phone: input.phone.trim(), email: input.email.trim() },
      counters: { activeUsers: 0, projects: 0 }, createdBy: uid,
      createdAt: serverTimestamp(), updatedAt: serverTimestamp(),
    });
    return id;
  });
  return tenantId;
}

export function TenantAdminPage() {
  const { logout } = useAuth();
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [logoUrls, setLogoUrls] = useState<Record<string, string>>({});
  const [showForm, setShowForm] = useState(false);
  const [showArchived, setShowArchived] = useState(false);
  const [name, setName] = useState('');
  const [contactName, setContactName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [primaryColor, setPrimaryColor] = useState('#7E3FE6');
  const [secondaryColor, setSecondaryColor] = useState('#1F1A4D');
  const [error, setError] = useState('');
  const load = async () => {
    try {
      const data = await api<Tenant[]>('/tenants');
      if (!Array.isArray(data)) throw new Error('INVALID_TENANT_RESPONSE');
      setTenants(data);
      setError('');
    } catch {
      try {
        const snapshot = await getDocs(collection(db, 'tenants'));
        setTenants(snapshot.docs.map(item => ({ id: item.id, ...item.data() }) as Tenant));
        setError('Die Verwaltung ist derzeit eingeschränkt. Firmendaten werden direkt aus Firestore angezeigt.');
      } catch {
        setError('Firmen konnten nicht geladen werden. Bitte melde dich erneut an.');
      }
    }
  };
  useEffect(() => { void load(); }, []);
  useEffect(() => {
    let active = true;
    setLogoUrls({});
    if (storage) tenants.forEach(tenant => {
      if (!tenant.branding?.logoPath) return;
      void getDownloadURL(ref(storage, tenant.branding.logoPath))
        .then(url => { if (active) setLogoUrls(current => ({ ...current, [tenant.id]: url })); })
        .catch(() => {});
    });
    return () => { active = false; };
  }, [tenants]);

  async function create(event: FormEvent) {
    event.preventDefault(); setError('');
    try {
      try {
        await api('/tenants', { method: 'POST', body: JSON.stringify({ name, primaryColor, secondaryColor, company: { legalName: name, contactName, phone, email } }) });
      } catch (apiError) {
        if (!(apiError instanceof Error) || apiError.name !== 'ApiConnectionError') throw apiError;
        await createTenantInFirestore({ name, contactName, phone, email, primaryColor, secondaryColor });
      }
      setShowForm(false); setName(''); setContactName(''); setPhone(''); setEmail(''); await load();
    } catch (e) { setError(e instanceof Error ? e.message : 'Firma konnte nicht angelegt werden.'); }
  }

  const visible = tenants.filter(tenant => showArchived || tenant.status !== 'archived');
  return <div className="min-h-screen bg-[#F7F4FD] text-[#1F1A4D]">
    <header className="border-b border-[#EBE6F4] bg-white"><div className="mx-auto flex h-20 max-w-[1440px] items-center justify-between gap-4 px-4 sm:px-6"><div className="flex min-w-0 items-center gap-4"><img src="/p12-aufmass-logo.svg" alt="P12 Aufmaß" className="h-auto w-44 max-w-[42vw] sm:w-56"/><span className="hidden border-l border-[#E7E0F2] pl-4 text-sm font-medium text-[#6B6481] sm:inline">P12 Ventures</span></div><button onClick={logout} className="flex shrink-0 items-center gap-2 rounded-xl bg-[#F2EBFF] px-3 py-2 text-sm font-semibold text-[#1F1A4D] hover:bg-[#E7D8FF]"><LogOut className="h-4 w-4"/>Abmelden</button></div></header>
    <main className="mx-auto max-w-[1440px] space-y-6 p-4 sm:p-6">
      <div className="flex flex-wrap items-center justify-between gap-4"><div><p className="text-xs font-bold uppercase tracking-[0.18em] text-[#7E3FE6]">Administration</p><h1 className="mt-1 text-3xl font-semibold">Firmenverwaltung</h1><p className="mt-1 text-sm text-[#756E88]">Firmen und Zugänge verwalten.</p></div><button onClick={() => setShowForm(true)} className="flex items-center gap-2 rounded-xl bg-[#7E3FE6] px-5 py-3 text-sm font-semibold text-white hover:bg-[#6B2BD8]"><Plus className="h-4 w-4"/>Neue Firma</button></div>
      {error && <div role="alert" className="rounded-xl bg-red-50 p-4 text-sm text-red-700">{error}</div>}
      {showForm && <form onSubmit={create} className="grid gap-4 rounded-3xl bg-white p-6 shadow-[0_16px_45px_-35px_#1F1A4D] sm:grid-cols-2"><h2 className="text-xl font-semibold sm:col-span-2">Neue Firma anlegen</h2><input className="rounded-xl border border-[#E8E2F0] px-4 py-3" placeholder="Firmenname" value={name} onChange={e=>setName(e.target.value)} required/><input className="rounded-xl border border-[#E8E2F0] px-4 py-3" placeholder="Ansprechpartner" value={contactName} onChange={e=>setContactName(e.target.value)} required/><input type="tel" className="rounded-xl border border-[#E8E2F0] px-4 py-3" placeholder="Telefon" value={phone} onChange={e=>setPhone(e.target.value)} required/><input type="email" className="rounded-xl border border-[#E8E2F0] px-4 py-3" placeholder="E-Mail" value={email} onChange={e=>setEmail(e.target.value)} required/><label className="flex items-center gap-3 text-sm">Primärfarbe <input type="color" value={primaryColor} onChange={e=>setPrimaryColor(e.target.value)} className="h-10 w-14 cursor-pointer rounded-xl"/></label><label className="flex items-center gap-3 text-sm">Sekundärfarbe <input type="color" value={secondaryColor} onChange={e=>setSecondaryColor(e.target.value)} className="h-10 w-14 cursor-pointer rounded-xl"/></label><div className="flex gap-3 sm:col-span-2"><button className="rounded-xl bg-[#7E3FE6] px-5 py-3 font-semibold text-white">Firma anlegen</button><button type="button" onClick={()=>setShowForm(false)} className="rounded-xl bg-[#F2EBFF] px-5 py-3">Abbrechen</button></div></form>}
      <label className="flex w-fit cursor-pointer items-center gap-3 text-sm text-[#625C76]"><input type="checkbox" checked={showArchived} onChange={e=>setShowArchived(e.target.checked)} className="accent-[#7E3FE6]"/>Archivierte Firmen anzeigen</label>
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">{visible.map(tenant => {
        const logoUrl = logoUrls[tenant.id] || (import.meta.env.VITE_USE_FIREBASE_EMULATORS === 'true' && tenant.id === 'p12' ? '/favicon.svg' : '');
        return <Link key={tenant.id} to={`/admin/tenants/${tenant.id}`} className="rounded-3xl bg-white p-5 shadow-[0_14px_35px_-30px_#1F1A4D] transition hover:shadow-[0_18px_40px_-25px_#1F1A4D]"><div className="flex items-start justify-between gap-3"><div className="flex min-w-0 items-start gap-3"><span className="flex h-7 w-7 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-[#F2EBFF] text-[#7E3FE6]">{logoUrl ? <img src={logoUrl} alt="" className="h-full w-full object-contain" style={{ transform: `scale(${tenant.branding?.logoZoom || 1})` }}/> : <Building2 className="h-4 w-4"/>}</span><div className="min-w-0"><h2 className="truncate text-lg font-semibold">{tenant.name}</h2><p className="mt-1 text-sm text-[#625C76]">{tenant.company?.contactName || 'Ansprechpartner fehlt'}</p></div></div><span className={`rounded-full px-3 py-1 text-xs font-semibold ${tenant.status==='active'?'bg-emerald-50 text-emerald-700':'bg-[#F2EBFF] text-[#625C76]'}`}>{tenant.status==='active'?'Aktiv':'Archiviert'}</span></div><div className="mt-4 space-y-2 text-sm text-[#625C76]">{tenant.company?.phone && <p className="flex items-center gap-2"><Phone className="h-4 w-4"/>{tenant.company.phone}</p>}{tenant.company?.email && <p className="flex items-center gap-2"><Mail className="h-4 w-4"/><span className="truncate">{tenant.company.email}</span></p>}</div><div className="mt-5 grid grid-cols-2 gap-y-2 border-t border-[#F1EDF7] pt-4 text-xs"><span className="flex items-center gap-1"><Users className="h-4 w-4"/>Benutzer</span><span className="text-right">{tenant.counters?.activeUsers || 0} aktiv · {tenant.counters?.inactiveUsers || 0} inaktiv</span><span>Projekte</span><span className="text-right">{tenant.counters?.activeProjects || 0} aktiv · {tenant.counters?.inactiveProjects || 0} inaktiv</span></div></Link>;
      })}</div>
    </main>
  </div>;
}
