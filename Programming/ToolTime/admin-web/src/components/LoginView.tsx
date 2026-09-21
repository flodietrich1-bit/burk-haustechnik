import React, { useState } from 'react';
import { Wrench, Lock, Mail, Eye, EyeOff, ShieldCheck, HardHat, AlertCircle } from 'lucide-react';
import type { User } from '../types';
import { getLocalUsers } from '../services/firestoreService';

interface LoginViewProps {
  users: User[];
  onLogin: (user: User) => void;
}

export const LoginView: React.FC<LoginViewProps> = ({ users, onLogin }) => {
  const [email, setEmail] = useState<string>('');
  const [password, setPassword] = useState<string>('');
  const [showPassword, setShowPassword] = useState<boolean>(false);
  const [error, setError] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(false);

  const userList = users && users.length > 0 ? users : getLocalUsers();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    const cleanEmail = email.trim().toLowerCase();
    if (!cleanEmail || !password) {
      setError('Bitte geben Sie E-Mail und Passwort ein.');
      return;
    }

    setLoading(true);

    // Find user by email
    const user = userList.find(u => (u.email || '').toLowerCase() === cleanEmail);

    if (!user) {
      setLoading(false);
      setError('Kein Benutzer mit dieser E-Mail-Adresse gefunden.');
      return;
    }

    // Check role: Only admin and bauleiter allowed in cockpit
    if (user.role !== 'admin' && user.role !== 'bauleiter') {
      setLoading(false);
      setError('Zugriff verweigert: Dieser Zugang ist ausschließlich für Eigentümer/Admin und Bauleiter freigeschaltet.');
      return;
    }

    // Verify password
    const expectedPassword = user.password || (user.role === 'admin' ? 'Admin2026!' : 'Bauleiter2026!');
    if (password !== expectedPassword) {
      setLoading(false);
      setError('Das eingegebene Passwort ist nicht korrekt.');
      return;
    }

    setLoading(false);
    onLogin(user);
  };

  const handleQuickLogin = (demoEmail: string, demoPass: string) => {
    setEmail(demoEmail);
    setPassword(demoPass);
    setError('');

    const user = userList.find(u => (u.email || '').toLowerCase() === demoEmail.toLowerCase());
    if (user) {
      onLogin(user);
    }
  };

  return (
    <div className="min-h-screen bg-slate-900 flex flex-col justify-center py-12 sm:px-6 lg:px-8 px-4 antialiased selection:bg-[#3B82C4] selection:text-white">
      <div className="sm:mx-auto sm:w-full sm:max-w-md text-center">
        {/* Logo Badge */}
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-tr from-[#3B82C4] to-[#2FA36B] shadow-xl shadow-blue-500/20 mb-4 ring-4 ring-slate-800">
          <Wrench className="w-8 h-8 text-white" />
        </div>

        <div className="flex items-center justify-center space-x-2 mb-1">
          <span className="text-2xl font-black tracking-wider text-white">BURK</span>
          <span className="text-xs bg-[#3B82C4] text-white px-2.5 py-0.5 rounded-full font-bold uppercase tracking-wider">
            TOOL-TIME
          </span>
        </div>
        <h1 className="text-lg font-bold text-slate-300">
          Cockpit-Anmeldung für Bauleitung & Eigentümer
        </h1>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
        <div className="bg-slate-800/90 border border-slate-700/80 py-8 px-6 shadow-2xl rounded-3xl sm:px-10 backdrop-blur-xl">
          <form className="space-y-5" onSubmit={handleSubmit}>
            {error && (
              <div className="bg-red-500/10 border border-red-500/30 rounded-2xl p-3.5 flex items-start space-x-3 text-red-300 text-xs font-medium animate-in fade-in duration-150">
                <AlertCircle className="w-4 h-4 shrink-0 text-red-400 mt-0.5" />
                <span className="leading-relaxed">{error}</span>
              </div>
            )}

            {/* Email Field */}
            <div>
              <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-2">
                E-Mail-Adresse
              </label>
              <div className="relative rounded-xl shadow-sm">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                  <Mail className="w-4 h-4" />
                </div>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="name@burk-haustechnik.de"
                  className="block w-full pl-10 pr-3 py-3 bg-slate-900/80 border border-slate-700 rounded-xl text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-[#3B82C4] focus:border-transparent transition-all"
                />
              </div>
            </div>

            {/* Password Field */}
            <div>
              <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-2">
                Passwort
              </label>
              <div className="relative rounded-xl shadow-sm">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                  <Lock className="w-4 h-4" />
                </div>
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••••••"
                  className="block w-full pl-10 pr-10 py-3 bg-slate-900/80 border border-slate-700 rounded-xl text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-[#3B82C4] focus:border-transparent transition-all"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-slate-400 hover:text-white transition-colors"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {/* Submit Button */}
            <div className="pt-1">
              <button
                type="submit"
                disabled={loading}
                className="w-full flex justify-center items-center space-x-2 py-3.5 px-4 border border-transparent rounded-xl text-sm font-bold text-white bg-gradient-to-r from-[#3B82C4] to-[#2B6EB0] hover:from-[#3273AF] hover:to-[#22578C] shadow-lg shadow-blue-500/25 transition-all hover:scale-[1.01] active:scale-[0.99] disabled:opacity-50"
              >
                <span>{loading ? 'Prüfe Anmeldedaten...' : 'Im Cockpit anmelden'}</span>
              </button>
            </div>
          </form>

          {/* Quick Login Samples Section */}
          <div className="mt-8 pt-6 border-t border-slate-700/80 space-y-3">
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block text-center">
              Schnellauswahl für Test & Vorführung:
            </span>

            <div className="grid grid-cols-1 gap-2.5">
              {/* Admin Demo Button */}
              <button
                type="button"
                onClick={() => handleQuickLogin('f.burk@burk-haustechnik.de', 'Admin2026!')}
                className="w-full flex items-center justify-between p-3 rounded-xl bg-slate-900/90 border border-slate-700 hover:border-blue-500/60 hover:bg-slate-900 text-left transition-all group cursor-pointer"
              >
                <div className="flex items-center space-x-3">
                  <div className="w-8 h-8 rounded-lg bg-blue-500/20 text-[#3B82C4] flex items-center justify-center shrink-0">
                    <ShieldCheck className="w-4 h-4" />
                  </div>
                  <div>
                    <span className="text-xs font-bold text-white block group-hover:text-[#3B82C4] transition-colors">
                      Eigentümer / Admin: Florian Burk
                    </span>
                    <span className="text-[11px] text-slate-400 block font-mono">
                      f.burk@burk-haustechnik.de • PW: Admin2026!
                    </span>
                  </div>
                </div>
                <span className="text-[10px] font-bold bg-blue-500/20 text-blue-300 border border-blue-500/30 px-2 py-0.5 rounded-full shrink-0">
                  Sieht alles
                </span>
              </button>

              {/* Bauleiter Demo Button */}
              <button
                type="button"
                onClick={() => handleQuickLogin('f.buck@burk-haustechnik.de', 'Bauleiter2026!')}
                className="w-full flex items-center justify-between p-3 rounded-xl bg-slate-900/90 border border-slate-700 hover:border-amber-500/60 hover:bg-slate-900 text-left transition-all group cursor-pointer"
              >
                <div className="flex items-center space-x-3">
                  <div className="w-8 h-8 rounded-lg bg-amber-500/20 text-amber-400 flex items-center justify-center shrink-0">
                    <HardHat className="w-4 h-4" />
                  </div>
                  <div>
                    <span className="text-xs font-bold text-white block group-hover:text-amber-400 transition-colors">
                      Bauleiter: Florian Buck
                    </span>
                    <span className="text-[11px] text-slate-400 block font-mono">
                      f.buck@burk-haustechnik.de • PW: Bauleiter2026!
                    </span>
                  </div>
                </div>
                <span className="text-[10px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30 px-2 py-0.5 rounded-full shrink-0">
                  Eigene Projekte
                </span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
