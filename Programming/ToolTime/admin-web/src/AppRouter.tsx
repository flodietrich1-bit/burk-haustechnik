import { useEffect, useState } from 'react';
import { Navigate, Route, Routes, useLocation, useParams } from 'react-router-dom';
import { getDownloadURL, ref } from 'firebase/storage';
import { storage } from './firebase';
import type { TenantBranding } from './types/branding';
import { useAuth } from './auth/AuthProvider';
import { AuthLoginView } from './components/AuthLoginView';
import { TenantAdminPage } from './pages/TenantAdminPage';
import { AcceptInvitePage } from './pages/AcceptInvitePage';
import { TenantDetailPage } from './pages/TenantDetailPage';
import App from './App';
import { api } from './services/apiClient';
import { setActiveTenantId } from './services/firestoreService';
import type { User, UserRole } from './types';

interface Membership { tenantId: string; tenantName?: string; displayName?: string; email?: string; role: UserRole; status: string; assignedProjectIds?: string[]; defaultLanguage?: 'de' | 'ro' | 'pl' | 'hr'; }

function TenantCockpit() {
  const { tenantId = '' } = useParams(); const { user, logout } = useAuth();
  const [membership, setMembership] = useState<Membership | null>(null); const [branding, setBranding] = useState<TenantBranding | null>(null); const [loading, setLoading] = useState(true); const [error, setError] = useState('');
  setActiveTenantId(tenantId);
  useEffect(() => {
    let active = true;
    async function load() {
      try {
        const items = await api<Membership[]>('/tenants/memberships/me');
        const member = items.find(item => item.tenantId === tenantId) || null;
        if (active) setMembership(member);
        if (member && member.status === 'active') {
          const tenant = await api<{ name: string; branding?: { logoPath?: string; logoZoom?: number; primaryColor?: string; secondaryColor?: string } }>(`/tenants/${tenantId}`);
          if (active) setBranding({ name: tenant.name, logoUrl: import.meta.env.VITE_USE_FIREBASE_EMULATORS === 'true' && tenantId === 'p12' ? '/favicon.svg' : undefined, logoZoom: tenant.branding?.logoZoom, primaryColor: tenant.branding?.primaryColor || '#7437D9', secondaryColor: tenant.branding?.secondaryColor || '#1F1A4D' });
          if (tenant.branding?.logoPath && storage) {
            void getDownloadURL(ref(storage, tenant.branding.logoPath))
              .then(logoUrl => { if (active) setBranding(current => current ? { ...current, logoUrl } : current); })
              .catch(() => {});
          }
        }
      } catch { if (active) setError('Der Firmenbereich konnte nicht geladen werden. Bitte versuche es erneut.'); }
      finally { if (active) setLoading(false); }
    }
    void load();
    return () => { active = false; };
  }, [tenantId]);
  if (loading) return <div className="min-h-screen flex items-center justify-center">Firmenzugriff wird geprüft …</div>;
  if (error) return <div role="alert" className="p-8 text-red-700">{error}</div>;
  if (!membership || membership.status !== 'active' || !user) return <Navigate to="/admin/tenants" replace/>;
  const cockpitUser: User = { id: user.uid, name: membership.displayName || user.displayName || user.email || 'Benutzer', email: membership.email || user.email || undefined, role: membership.role, status: 'active', assignedProjectIds: membership.assignedProjectIds, defaultLanguage: membership.defaultLanguage };
  return <App authenticatedUser={cockpitUser} tenantId={tenantId} branding={branding} onLogout={() => void logout()}/>;
}

export function AppRouter() {
  const { user, platformRole, loading, error } = useAuth();
  const location = useLocation();
  if (loading) return <div className="min-h-screen flex items-center justify-center">Sitzung wird geprüft …</div>;
  if (error) return <main className="flex min-h-screen items-center justify-center bg-slate-50 p-6"><div role="alert" className="max-w-md rounded-2xl border border-amber-200 bg-white p-6 text-slate-800 shadow-sm"><h1 className="text-lg font-semibold">Anmeldung nicht erreichbar</h1><p className="mt-2 text-sm">{error}</p><button type="button" onClick={() => window.location.reload()} className="mt-4 rounded-xl bg-violet-700 px-4 py-2 text-sm font-semibold text-white">Erneut versuchen</button></div></main>;
  if (location.pathname === '/invite') return <AcceptInvitePage />;
  if (!user) return <AuthLoginView />;
  return <Routes>
    {platformRole === 'superadmin' && <><Route path="/admin/tenants" element={<TenantAdminPage/>}/><Route path="/admin/tenants/:tenantId" element={<TenantDetailPage/>}/></>}
    <Route path="/t/:tenantId/*" element={<TenantCockpit/>}/>
    <Route path="*" element={platformRole === 'superadmin' ? <Navigate to="/admin/tenants" replace/> : <TenantHome/>}/>
  </Routes>;
}


function TenantHome() {
  const [items, setItems] = useState<Membership[]>([]);
  const [error, setError] = useState(''); const [loading, setLoading] = useState(true);
  useEffect(() => { api<Membership[]>('/tenants/memberships/me').then(setItems).catch(() => setError('Firmenzugänge konnten nicht geladen werden.')).finally(() => setLoading(false)); }, []);
  if (error) return <div className="p-8">{error}</div>;
  if (loading) return <div className="p-8">Firmenzugänge werden geladen …</div>;
  if (items.length === 1) return <Navigate to={`/t/${items[0].tenantId}`} replace/>;
  return <main className="mx-auto max-w-xl p-8"><h1 className="text-2xl font-semibold">Meine Firmen</h1>{items.length ? items.map(item => <a className="mt-4 block rounded-xl border bg-white p-4" key={item.tenantId} href={`/t/${item.tenantId}`}>{item.tenantName || item.tenantId}</a>) : <p className="mt-4">Noch kein Firmenzugang. Öffne deinen Einladungslink oder gib den Code unter <a href="/invite" className="text-violet-700 underline">Einladung annehmen</a> ein.</p>}</main>;
}
