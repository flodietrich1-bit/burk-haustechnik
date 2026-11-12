import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { onAuthStateChanged, signInWithEmailAndPassword, signOut, type User as FirebaseUser } from 'firebase/auth';
import { auth } from '../firebase';

interface AuthState {
  user: FirebaseUser | null;
  platformRole: string | null;
  loading: boolean;
  error: string | null;
  login(email: string, password: string): Promise<void>;
  logout(): Promise<void>;
  token(): Promise<string>;
}

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<FirebaseUser | null>(null);
  const [platformRole, setPlatformRole] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    const startupTimeout = window.setTimeout(() => {
      if (active) { setError('Die Anmeldung dauert zu lange. Bitte lade die Seite neu. Falls das Problem bleibt, prüfe den lokalen Auth-Dienst auf Port 9099.'); setLoading(false); }
    }, 8000);
    const unsubscribe = onAuthStateChanged(auth, async nextUser => {
      if (!active) return;
      setUser(nextUser);
      setError(null);
      try {
        const claims = nextUser ? await Promise.race([
          nextUser.getIdTokenResult(),
          new Promise<never>((_, reject) => window.setTimeout(() => reject(new Error('AUTH_TIMEOUT')), 8000)),
        ]) : null;
        if (active) setPlatformRole(claims ? String(claims.claims.platformRole || '') || null : null);
      } catch {
        if (active) setError('Die Sitzung konnte nicht geprüft werden. Bitte lade die Seite neu und prüfe bei Bedarf den lokalen Auth-Dienst auf Port 9099.');
      } finally {
        window.clearTimeout(startupTimeout);
        if (active) setLoading(false);
      }
    }, () => {
      if (active) { setError('Die Anmeldung ist nicht erreichbar. Bitte prüfe den lokalen Auth-Dienst auf Port 9099 und lade die Seite neu.'); setLoading(false); }
    });
    return () => { active = false; window.clearTimeout(startupTimeout); unsubscribe(); };
  }, []);

  const value = useMemo<AuthState>(() => ({
    user, platformRole, loading, error,
    login: async (email, password) => { await signInWithEmailAndPassword(auth, email.trim(), password); },
    logout: async () => { await signOut(auth); },
    token: async () => {
      if (!auth.currentUser) throw new Error('AUTH_REQUIRED');
      return auth.currentUser.getIdToken();
    },
  }), [user, platformRole, loading, error]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const value = useContext(AuthContext);
  if (!value) throw new Error('useAuth must be used inside AuthProvider');
  return value;
}
