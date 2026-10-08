import React, { useState } from 'react';
import type { User, UserRole, Project } from '../types';
import { 
  Users, 
  Plus, 
  KeyRound, 
  Check, 
  X, 
  ShieldCheck, 
  HardHat, 
  Briefcase, 
  Wrench,
  Mail,
  Phone,
  Edit2
} from 'lucide-react';
import { saveUser, updateUserPin } from '../services/firestoreService';

interface UserManagementViewProps {
  users: User[];
  projects: Project[];
}

export const UserManagementView: React.FC<UserManagementViewProps> = ({ users, projects }) => {
  const [roleFilter, setRoleFilter] = useState<string>('all');
  const [isAddModalOpen, setIsAddModalOpen] = useState<boolean>(false);
  const [editingPinUserId, setEditingPinUserId] = useState<string | null>(null);
  const [newPinVal, setNewPinVal] = useState<string>('');

  // New user form state
  const [newUser, setNewUser] = useState<Partial<User>>({
    name: '',
    role: 'monteur',
    email: '',
    phone: '',
    pin: '',
    defaultLanguage: 'de',
    status: 'active'
  });

  const handleUpdateLanguage = async (user: User, lang: 'de' | 'ro' | 'pl' | 'hr') => {
    const updated: User = { ...user, defaultLanguage: lang };
    await saveUser(updated);
  };

  const isPL = (u: User) => u.role === 'projektleiter' || u.role === 'bauleiter';
  const filteredUsers = users.filter(u => {
    if (roleFilter === 'all') return true;
    if (roleFilter === 'projektleiter') return isPL(u);
    return u.role === roleFilter;
  });

  // Track which user's project assignment is being edited
  const [editingProjectUserId, setEditingProjectUserId] = useState<string | null>(null);
  const [editingProjectIds, setEditingProjectIds] = useState<string[]>([]);

  const handleStartEditProjects = (user: User) => {
    setEditingProjectUserId(user.id);
    setEditingProjectIds(user.assignedProjectIds || []);
  };

  const handleToggleProject = (pId: string) => {
    setEditingProjectIds(prev =>
      prev.includes(pId) ? prev.filter(id => id !== pId) : [...prev, pId]
    );
  };

  const handleSaveProjects = async (user: User) => {
    const updated: User = { ...user, assignedProjectIds: editingProjectIds };
    await saveUser(updated);
    setEditingProjectUserId(null);
  };

  const handleSaveNewUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newUser.name) return;

    const userToSave: User = {
      id: `user_${Date.now()}`,
      name: newUser.name,
      role: newUser.role as UserRole || 'monteur',
      email: newUser.email || undefined,
      phone: newUser.phone || undefined,
      pin: newUser.role === 'monteur' ? (newUser.pin || '1234') : undefined,
      defaultLanguage: newUser.defaultLanguage || 'de',
      status: 'active',
      createdAt: new Date().toISOString()
    };

    await saveUser(userToSave);
    setIsAddModalOpen(false);
    setNewUser({
      name: '',
      role: 'monteur',
      email: '',
      phone: '',
      pin: '',
      defaultLanguage: 'de',
      status: 'active'
    });
  };

  const handleStartEditPin = (user: User) => {
    setEditingPinUserId(user.id);
    setNewPinVal(user.pin || '1234');
  };

  const handleSavePin = async (userId: string) => {
    if (!newPinVal || newPinVal.length < 4) {
      alert('Die PIN muss mindestens 4 Ziffern enthalten.');
      return;
    }
    await updateUserPin(userId, newPinVal);
    setEditingPinUserId(null);
  };

  const getRoleBadge = (role: UserRole) => {
    switch (role) {
      case 'admin':
        return (
          <span className="inline-flex items-center space-x-1 text-xs font-bold bg-purple-100 text-purple-800 border border-purple-300 px-2.5 py-0.5 rounded-full">
            <ShieldCheck className="w-3.5 h-3.5 text-purple-600" />
            <span>Eigentümer / Admin</span>
          </span>
        );
      case 'projektleiter':
      case 'bauleiter':
        return (
          <span className="inline-flex items-center space-x-1 text-xs font-bold bg-blue-100 text-blue-800 border border-blue-300 px-2.5 py-0.5 rounded-full">
            <HardHat className="w-3.5 h-3.5 text-blue-600" />
            <span>Projektleiter</span>
          </span>
        );
      case 'kaufmaennisch':
        return (
          <span className="inline-flex items-center space-x-1 text-xs font-bold bg-amber-100 text-amber-900 border border-amber-300 px-2.5 py-0.5 rounded-full">
            <Briefcase className="w-3.5 h-3.5 text-amber-600" />
            <span>Kaufmann / Kauffrau</span>
          </span>
        );
      case 'monteur':
        return (
          <span className="inline-flex items-center space-x-1 text-xs font-bold bg-emerald-100 text-emerald-800 border border-emerald-300 px-2.5 py-0.5 rounded-full">
            <Wrench className="w-3.5 h-3.5 text-emerald-600" />
            <span>Monteur</span>
          </span>
        );
    }
  };

  const projectMap = new Map(projects.map(p => [p.id, p.name]));

  return (
    <div className="space-y-6">
      {/* Top Header Card */}
      <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div className="flex items-center space-x-3.5">
          <div className="w-12 h-12 rounded-xl bg-[#1C2A3B] text-white flex items-center justify-center shadow-md shadow-slate-900/10 shrink-0">
            <Users className="w-6 h-6 text-[#3B82C4]" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-slate-900 tracking-wide">
              Benutzer- & Rollenverwaltung
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Zentrale Verwaltung von Eigentümern, Projektleitern, Kaufleuten und Monteuren inkl. App-PINs
            </p>
          </div>
        </div>

        <button
          onClick={() => setIsAddModalOpen(true)}
          className="flex items-center space-x-2 bg-[#3B82C4] hover:bg-[#2B6EB0] text-white px-4 py-2.5 rounded-xl text-xs font-bold shadow-md shadow-blue-500/20 transition-all hover:scale-[1.02] active:scale-[0.98]"
        >
          <Plus className="w-4 h-4" />
          <span>Neuen Benutzer anlegen</span>
        </button>
      </div>

      {/* Role Filter Tabs */}
      <div className="flex flex-wrap items-center gap-2">
        {[
          { id: 'all', label: `Alle (${users.length})` },
          { id: 'admin', label: `Admins / Eigentümer (${users.filter(u => u.role === 'admin').length})` },
          { id: 'projektleiter', label: `Projektleiter (${users.filter(isPL).length})` },
          { id: 'kaufmaennisch', label: `Kaufmann / Kauffrau (${users.filter(u => u.role === 'kaufmaennisch').length})` },
          { id: 'monteur', label: `Monteure (${users.filter(u => u.role === 'monteur').length})` }
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => setRoleFilter(tab.id)}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold transition-all ${
              roleFilter === tab.id
                ? 'bg-[#1C2A3B] text-white shadow-sm'
                : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Users Table */}
      <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-100/90 text-slate-700 font-bold border-b border-slate-200 uppercase tracking-wider text-[11px]">
              <tr>
                <th className="py-3.5 px-4">Mitarbeiter / Name</th>
                <th className="py-3.5 px-4">Rolle</th>
                <th className="py-3.5 px-4">Kontakt</th>
                <th className="py-3.5 px-4">App-PIN (Monteur)</th>
                <th className="py-3.5 px-4">App-Sprache</th>
                <th className="py-3.5 px-4">Zugewiesene Projekte</th>
                <th className="py-3.5 px-4">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredUsers.map(user => {
                const isEditingPin = editingPinUserId === user.id;

                return (
                  <tr key={user.id} className="hover:bg-slate-50/80 transition-colors">
                    {/* Name */}
                    <td className="py-3.5 px-4 whitespace-nowrap">
                      <div className="flex items-center space-x-3">
                        <div className="w-8 h-8 rounded-full bg-slate-200 text-slate-700 font-bold text-xs flex items-center justify-center">
                          {user.name.slice(0, 2).toUpperCase()}
                        </div>
                        <div>
                          <span className="font-bold text-slate-900 block text-sm">
                            {user.name}
                          </span>
                          {user.defaultLanguage && (
                            <span className="text-[10px] text-slate-400">
                              App-Sprache: {user.defaultLanguage.toUpperCase()}
                            </span>
                          )}
                        </div>
                      </div>
                    </td>

                    {/* Role */}
                    <td className="py-3.5 px-4 whitespace-nowrap">
                      {getRoleBadge(user.role)}
                    </td>

                    {/* Contact */}
                    <td className="py-3.5 px-4 whitespace-nowrap">
                      <div className="space-y-0.5">
                        {user.email && (
                          <div className="flex items-center space-x-1.5 text-slate-600">
                            <Mail className="w-3 h-3 text-slate-400" />
                            <span>{user.email}</span>
                          </div>
                        )}
                        {user.phone && (
                          <div className="flex items-center space-x-1.5 text-slate-500 text-[11px]">
                            <Phone className="w-3 h-3 text-slate-400" />
                            <span>{user.phone}</span>
                          </div>
                        )}
                      </div>
                    </td>

                    {/* App PIN */}
                    <td className="py-3.5 px-4 whitespace-nowrap">
                      {user.role === 'monteur' ? (
                        isEditingPin ? (
                          <div className="flex items-center space-x-1.5">
                            <input
                              type="text"
                              maxLength={6}
                              value={newPinVal}
                              onChange={(e) => setNewPinVal(e.target.value.replace(/\D/g, ''))}
                              className="w-16 px-2 py-1 text-center font-mono font-bold text-sm bg-white border border-[#3B82C4] rounded-lg text-slate-900 shadow-inner"
                              autoFocus
                            />
                            <button
                              onClick={() => handleSavePin(user.id)}
                              className="p-1 bg-emerald-600 text-white rounded hover:bg-emerald-700"
                              title="PIN speichern"
                            >
                              <Check className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => setEditingPinUserId(null)}
                              className="p-1 bg-slate-200 text-slate-600 rounded hover:bg-slate-300"
                              title="Abbrechen"
                            >
                              <X className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        ) : (
                          <div className="flex items-center space-x-2">
                            <span className="font-mono font-bold text-slate-800 bg-slate-100 border border-slate-200 px-2 py-0.5 rounded text-xs tracking-wider flex items-center space-x-1">
                              <KeyRound className="w-3 h-3 text-amber-600" />
                              <span>{user.pin || '1234'}</span>
                            </span>
                            <button
                              onClick={() => handleStartEditPin(user)}
                              className="text-slate-400 hover:text-[#3B82C4] p-1 transition-colors"
                              title="PIN ändern"
                            >
                              <Edit2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        )
                      ) : (
                        <span className="text-slate-400 italic text-[11px]">-</span>
                      )}
                    </td>

                    {/* App-Sprache */}
                    <td className="py-3.5 px-4 whitespace-nowrap">
                      <select
                        value={user.defaultLanguage || 'de'}
                        onChange={(e) => handleUpdateLanguage(user, e.target.value as any)}
                        className="bg-slate-50 hover:bg-slate-100 border border-slate-200 text-xs font-semibold rounded-lg px-2 py-1 text-slate-800 cursor-pointer focus:ring-1 focus:ring-[#3B82C4] focus:outline-none"
                        title="Standardsprache für die Monteur-App"
                      >
                        <option value="de">🇩🇪 Deutsch</option>
                        <option value="ro">🇷🇴 Română</option>
                        <option value="pl">🇵🇱 Polski</option>
                        <option value="hr">🇭🇷 Hrvatski</option>
                      </select>
                    </td>

                    {/* Assigned Projects */}
                    <td className="py-3.5 px-4">
                      {user.role === 'monteur' ? (
                        editingProjectUserId === user.id ? (
                          <div className="space-y-1.5">
                            {projects.length === 0 ? (
                              <span className="text-slate-400 italic text-[11px]">Keine Projekte vorhanden</span>
                            ) : (
                              projects.map(p => (
                                <label key={p.id} className="flex items-center space-x-2 cursor-pointer text-[11px]">
                                  <input
                                    type="checkbox"
                                    checked={editingProjectIds.includes(p.id)}
                                    onChange={() => handleToggleProject(p.id)}
                                    className="accent-[#3B82C4]"
                                  />
                                  <span className="text-slate-700 font-medium truncate max-w-[140px]">{p.name || p.id}</span>
                                </label>
                              ))
                            )}
                            <div className="flex items-center space-x-1.5 mt-1.5">
                              <button
                                onClick={() => handleSaveProjects(user)}
                                className="p-1 bg-emerald-600 text-white rounded hover:bg-emerald-700"
                                title="Speichern"
                              >
                                <Check className="w-3.5 h-3.5" />
                              </button>
                              <button
                                onClick={() => setEditingProjectUserId(null)}
                                className="p-1 bg-slate-200 text-slate-600 rounded hover:bg-slate-300"
                                title="Abbrechen"
                              >
                                <X className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </div>
                        ) : (
                          <div className="flex items-start space-x-2">
                            <div className="flex flex-wrap gap-1 flex-1">
                              {user.assignedProjectIds && user.assignedProjectIds.length > 0 ? (
                                user.assignedProjectIds.map(pId => (
                                  <span
                                    key={pId}
                                    className="bg-slate-100 text-slate-700 font-medium px-2 py-0.5 rounded text-[11px] border border-slate-200"
                                  >
                                    {projectMap.get(pId) || pId}
                                  </span>
                                ))
                              ) : (
                                <span className="text-slate-400 text-[11px] italic">Alle Projekte (Standard)</span>
                              )}
                            </div>
                            <button
                              onClick={() => handleStartEditProjects(user)}
                              className="text-slate-400 hover:text-[#3B82C4] p-1 transition-colors shrink-0"
                              title="Projekt-Zuweisung ändern"
                            >
                              <Edit2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        )
                      ) : (
                        <span className="text-slate-400 text-[11px] italic">-</span>
                      )}
                    </td>

                    {/* Status */}
                    <td className="py-3.5 px-4 whitespace-nowrap">
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800">
                        Aktiv
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal: Neuen Benutzer anlegen */}
      {isAddModalOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200 space-y-4 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center space-x-2">
                <Users className="w-5 h-5 text-[#3B82C4]" />
                <h3 className="text-base font-bold text-slate-900">Neuen Benutzer anlegen</h3>
              </div>
              <button onClick={() => setIsAddModalOpen(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveNewUser} className="space-y-3.5 text-xs">
              <div>
                <label className="block font-bold text-slate-700 mb-1">Name & Nachname *</label>
                <input
                  type="text"
                  required
                  placeholder="z.B. Florian Buck oder Ion Popescu"
                  value={newUser.name}
                  onChange={(e) => setNewUser({ ...newUser, name: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#3B82C4]"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Rolle im Unternehmen *</label>
                <select
                  value={newUser.role}
                  onChange={(e) => setNewUser({ ...newUser, role: e.target.value as UserRole })}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 font-medium focus:outline-none focus:ring-2 focus:ring-[#3B82C4]"
                >
                  <option value="monteur">Monteur (Baustelle / App)</option>
                  <option value="projektleiter">Projektleiter (Projekt- & Baustellenleitung)</option>
                  <option value="kaufmaennisch">Kaufmann / Kauffrau (Bestellungen & Rechnungen)</option>
                  <option value="admin">Eigentümer / Admin</option>
                </select>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Bevorzugte App-Sprache (Monteur-App) *</label>
                <select
                  value={newUser.defaultLanguage || 'de'}
                  onChange={(e) => setNewUser({ ...newUser, defaultLanguage: e.target.value as any })}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 font-medium focus:outline-none focus:ring-2 focus:ring-[#3B82C4]"
                >
                  <option value="de">🇩🇪 Deutsch (Standard)</option>
                  <option value="ro">🇷🇴 Rumänisch (Română)</option>
                  <option value="pl">🇵🇱 Polnisch (Polski)</option>
                  <option value="hr">🇭🇷 Kroatisch (Hrvatski)</option>
                </select>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">E-Mail-Adresse</label>
                <input
                  type="email"
                  placeholder="z.B. mitarbeiter@burk-haustechnik.de"
                  value={newUser.email}
                  onChange={(e) => setNewUser({ ...newUser, email: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#3B82C4]"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Telefon / Mobilnummer</label>
                <input
                  type="tel"
                  placeholder="z.B. +49 171 1234567"
                  value={newUser.phone}
                  onChange={(e) => setNewUser({ ...newUser, phone: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#3B82C4]"
                />
              </div>

              {newUser.role === 'monteur' && (
                <div className="bg-amber-50 p-3 rounded-xl border border-amber-200 space-y-1">
                  <label className="block font-bold text-amber-900">4-stellige App-PIN für Monteur *</label>
                  <input
                    type="text"
                    maxLength={6}
                    placeholder="1234"
                    value={newUser.pin}
                    onChange={(e) => setNewUser({ ...newUser, pin: e.target.value.replace(/\D/g, '') })}
                    className="w-full px-3 py-2 bg-white border border-amber-300 rounded-lg text-slate-900 font-mono font-bold text-sm tracking-widest text-center"
                  />
                  <p className="text-[10px] text-amber-700">
                    Diese PIN wird vom Monteur beim Öffnen der mobilen App auf der Baustelle eingegeben.
                  </p>
                </div>
              )}

              <div className="flex justify-end space-x-2.5 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(false)}
                  className="px-4 py-2 rounded-xl text-slate-600 hover:bg-slate-100 font-semibold"
                >
                  Abbrechen
                </button>
                <button
                  type="submit"
                  className="bg-[#3B82C4] hover:bg-[#2B6EB0] text-white px-5 py-2 rounded-xl font-bold shadow-md shadow-blue-500/20"
                >
                  Benutzer speichern
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
