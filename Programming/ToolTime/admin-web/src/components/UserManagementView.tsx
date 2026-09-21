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
    status: 'active'
  });

  const filteredUsers = users.filter(u => {
    if (roleFilter === 'all') return true;
    return u.role === roleFilter;
  });

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
      case 'bauleiter':
        return (
          <span className="inline-flex items-center space-x-1 text-xs font-bold bg-blue-100 text-blue-800 border border-blue-300 px-2.5 py-0.5 rounded-full">
            <HardHat className="w-3.5 h-3.5 text-blue-600" />
            <span>Bauleiter</span>
          </span>
        );
      case 'kaufmaennisch':
        return (
          <span className="inline-flex items-center space-x-1 text-xs font-bold bg-amber-100 text-amber-900 border border-amber-300 px-2.5 py-0.5 rounded-full">
            <Briefcase className="w-3.5 h-3.5 text-amber-600" />
            <span>Kaufmännische Leitung</span>
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
              Zentrale Verwaltung von Eigentümern, Bauleitern, Kaufmännischen Leitern und Monteuren inkl. App-PINs
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
          { id: 'bauleiter', label: `Bauleiter (${users.filter(u => u.role === 'bauleiter').length})` },
          { id: 'kaufmaennisch', label: `Kaufm. Leitung (${users.filter(u => u.role === 'kaufmaennisch').length})` },
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

                    {/* Assigned Projects */}
                    <td className="py-3.5 px-4">
                      {user.assignedProjectIds && user.assignedProjectIds.length > 0 ? (
                        <div className="flex flex-wrap gap-1">
                          {user.assignedProjectIds.map(pId => (
                            <span 
                              key={pId}
                              className="bg-slate-100 text-slate-700 font-medium px-2 py-0.5 rounded text-[11px] border border-slate-200"
                            >
                              {projectMap.get(pId) || pId}
                            </span>
                          ))}
                        </div>
                      ) : (
                        <span className="text-slate-400 text-[11px] italic">Alle Projekte (Standard)</span>
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
                  <option value="bauleiter">Bauleiter (Baustellenleitung)</option>
                  <option value="kaufmaennisch">Kaufmännische Leitung (Bestellungen & Rechnungen)</option>
                  <option value="admin">Eigentümer / Admin</option>
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
