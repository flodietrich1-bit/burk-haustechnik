import React, { useState, useEffect } from 'react';
import type { Project, User } from '../types';
import { 
  Settings, 
  Save, 
  Building2, 
  HardHat, 
  Briefcase, 
  Wrench, 
  CheckCircle2, 
  Mail, 
  Check,
  Trash2
} from 'lucide-react';
import { updateProjectDetails, deleteProject } from '../services/firestoreService';

interface ProjectSettingsViewProps {
  project: Project | null;
  users: User[];
}

export const ProjectSettingsView: React.FC<ProjectSettingsViewProps> = ({ project, users }) => {
  const [form, setForm] = useState<Partial<Project>>({});
  const [isSaved, setIsSaved] = useState<boolean>(false);
  const [isSaving, setIsSaving] = useState<boolean>(false);

  useEffect(() => {
    if (project) {
      setForm({ ...project });
    }
  }, [project]);

  if (!project) {
    return (
      <div className="bg-white rounded-2xl border border-slate-200 p-8 text-center text-slate-500">
        Kein aktives Projekt ausgewählt.
      </div>
    );
  }

  const bauleiterUsers = users.filter(u => u.role === 'bauleiter' || u.role === 'admin');
  const kfmUsers = users.filter(u => u.role === 'kaufmaennisch' || u.role === 'admin');
  const monteurUsers = users.filter(u => u.role === 'monteur');

  const handleBauleiterChange = (userId: string) => {
    const selected = users.find(u => u.id === userId);
    setForm(prev => ({
      ...prev,
      projectManagerId: userId,
      projectManager: selected?.name || '',
      projectManagerEmail: selected?.email || ''
    }));
  };

  const handleKfmChange = (userId: string) => {
    const selected = users.find(u => u.id === userId);
    setForm(prev => ({
      ...prev,
      commercialManagerId: userId,
      commercialManager: selected?.name || '',
      commercialManagerEmail: selected?.email || ''
    }));
  };

  const handleToggleMonteur = (monteurId: string) => {
    const current = form.assignedMonteurIds || [];
    const exists = current.includes(monteurId);
    const updated = exists 
      ? current.filter(id => id !== monteurId) 
      : [...current, monteurId];
    
    setForm(prev => ({ ...prev, assignedMonteurIds: updated }));
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    try {
      await updateProjectDetails(project.id, form);
      setIsSaved(true);
      setTimeout(() => setIsSaved(false), 3000);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-6 max-w-5xl">
      {/* Header Card */}
      <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm flex items-center justify-between">
        <div className="flex items-center space-x-3.5">
          <div className="w-12 h-12 rounded-xl bg-[#1C2A3B] text-white flex items-center justify-center shadow-md shadow-slate-900/10 shrink-0">
            <Settings className="w-6 h-6 text-[#3B82C4]" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-slate-900 tracking-wide">
              Projekteinstellungen: {project.name}
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Anpassen von Stammdaten, Bauleitung, kaufmännischer Leitung und zugewiesenen Monteuren
            </p>
          </div>
        </div>

        {isSaved && (
          <div className="flex items-center space-x-1.5 text-xs font-bold text-emerald-700 bg-emerald-50 border border-emerald-300 px-3 py-1.5 rounded-xl animate-in fade-in">
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
            <span>Erfolgreich gespeichert!</span>
          </div>
        )}
      </div>

      <form onSubmit={handleSave} className="space-y-6">
        {/* Section 1: Stammdaten */}
        <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm space-y-4">
          <h3 className="font-bold text-slate-900 text-sm flex items-center space-x-2 border-b border-slate-100 pb-3">
            <Building2 className="w-4 h-4 text-[#3B82C4]" />
            <span>1. Projekt-Stammdaten</span>
          </h3>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
            <div className="md:col-span-2">
              <label className="block font-bold text-slate-700 mb-1">Projektname / Baumaßnahme *</label>
              <input
                type="text"
                required
                value={form.name || ''}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 font-medium focus:outline-none focus:ring-2 focus:ring-[#3B82C4]"
              />
            </div>

            <div>
              <label className="block font-bold text-slate-700 mb-1">Projektnummer / Kennung</label>
              <input
                type="text"
                value={form.projectNumber || ''}
                onChange={(e) => setForm({ ...form, projectNumber: e.target.value })}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 font-mono focus:outline-none focus:ring-2 focus:ring-[#3B82C4]"
              />
            </div>

            <div>
              <label className="block font-bold text-slate-700 mb-1">Gewerk</label>
              <input
                type="text"
                value={form.trade || ''}
                onChange={(e) => setForm({ ...form, trade: e.target.value })}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#3B82C4]"
              />
            </div>

            <div>
              <label className="block font-bold text-slate-700 mb-1">Baustellen-Standort (Ort)</label>
              <input
                type="text"
                value={form.location || ''}
                onChange={(e) => setForm({ ...form, location: e.target.value })}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#3B82C4]"
              />
            </div>

            <div>
              <label className="block font-bold text-slate-700 mb-1">Genaue Adresse (Straße, PLZ, Ort)</label>
              <input
                type="text"
                value={form.address || ''}
                onChange={(e) => setForm({ ...form, address: e.target.value })}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#3B82C4]"
              />
            </div>

            <div>
              <label className="block font-bold text-slate-700 mb-1">Startdatum *</label>
              <input
                type="date"
                required
                value={form.startDate || ''}
                onChange={(e) => setForm({ ...form, startDate: e.target.value })}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#3B82C4]"
              />
            </div>

            <div>
              <label className="block font-bold text-slate-700 mb-1">Fertigstellung (optional)</label>
              <input
                type="date"
                value={form.endDate || ''}
                onChange={(e) => setForm({ ...form, endDate: e.target.value })}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#3B82C4]"
              />
            </div>
          </div>
        </div>

        {/* Section 2: Beteiligte & Leitung */}
        <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm space-y-4">
          <h3 className="font-bold text-slate-900 text-sm flex items-center space-x-2 border-b border-slate-100 pb-3">
            <Briefcase className="w-4 h-4 text-[#3B82C4]" />
            <span>2. Beteiligte & Leitungsfunktionen (Auswahl via Dropdown)</span>
          </h3>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
            <div className="md:col-span-2">
              <label className="block font-bold text-slate-700 mb-1">Auftraggeber / Kunde</label>
              <input
                type="text"
                value={form.client || ''}
                onChange={(e) => setForm({ ...form, client: e.target.value })}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#3B82C4]"
              />
            </div>

            {/* Zuständiger Bauleiter Dropdown */}
            <div className="space-y-1">
              <label className="block font-bold text-slate-700 flex items-center space-x-1.5">
                <HardHat className="w-3.5 h-3.5 text-blue-600" />
                <span>Zuständiger Bauleiter *</span>
              </label>
              <select
                value={form.projectManagerId || ''}
                onChange={(e) => handleBauleiterChange(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 font-semibold focus:outline-none focus:ring-2 focus:ring-[#3B82C4]"
              >
                <option value="">-- Bauleiter auswählen --</option>
                {bauleiterUsers.map(u => (
                  <option key={u.id} value={u.id}>
                    {u.name} ({u.role === 'admin' ? 'Eigentümer/Admin' : 'Bauleiter'})
                  </option>
                ))}
              </select>
              {form.projectManagerEmail && (
                <div className="text-[11px] text-slate-500 flex items-center space-x-1 pt-0.5">
                  <Mail className="w-3 h-3 text-slate-400" />
                  <span>E-Mail: {form.projectManagerEmail}</span>
                </div>
              )}
            </div>

            {/* Kaufmännischer Leiter Dropdown */}
            <div className="space-y-1">
              <label className="block font-bold text-slate-700 flex items-center space-x-1.5">
                <Briefcase className="w-3.5 h-3.5 text-amber-600" />
                <span>Kaufmännischer Leiter (Nachbestellungen & Abrechnung) *</span>
              </label>
              <select
                value={form.commercialManagerId || ''}
                onChange={(e) => handleKfmChange(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 font-semibold focus:outline-none focus:ring-2 focus:ring-[#3B82C4]"
              >
                <option value="">-- Kaufmännischen Leiter auswählen --</option>
                {kfmUsers.map(u => (
                  <option key={u.id} value={u.id}>
                    {u.name} ({u.role === 'admin' ? 'Eigentümer/Admin' : 'Kaufmännische Leitung'})
                  </option>
                ))}
              </select>
              {form.commercialManagerEmail && (
                <div className="text-[11px] text-slate-500 flex items-center space-x-1 pt-0.5">
                  <Mail className="w-3 h-3 text-slate-400" />
                  <span>E-Mail für Nachbestellungen: {form.commercialManagerEmail}</span>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Section 3: Zugewiesene Monteure */}
        <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <h3 className="font-bold text-slate-900 text-sm flex items-center space-x-2">
              <Wrench className="w-4 h-4 text-emerald-600" />
              <span>3. Auf dieser Baustelle eingesetzte Monteure</span>
            </h3>
            <span className="text-xs font-semibold text-[#3B82C4] bg-blue-50 px-2.5 py-0.5 rounded-full border border-blue-200">
              {(form.assignedMonteurIds || []).length} Monteure zugeordnet
            </span>
          </div>

          <p className="text-xs text-slate-500">
            Wählen Sie die Monteure aus, die für dieses Projekt autorisiert sind und in der App Zugriff auf die Räume und Buchungen haben:
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 pt-1">
            {monteurUsers.map(monteur => {
              const isAssigned = (form.assignedMonteurIds || []).includes(monteur.id);

              return (
                <div
                  key={monteur.id}
                  onClick={() => handleToggleMonteur(monteur.id)}
                  className={`p-3 rounded-xl border cursor-pointer transition-all flex items-center justify-between ${
                    isAssigned
                      ? 'bg-emerald-50 border-emerald-300 ring-1 ring-emerald-200'
                      : 'bg-slate-50 hover:bg-slate-100 border-slate-200'
                  }`}
                >
                  <div className="space-y-0.5 truncate mr-2">
                    <span className="font-bold text-xs text-slate-900 block truncate">
                      {monteur.name}
                    </span>
                    <span className="text-[10px] text-slate-500 block">
                      PIN: {monteur.pin || '1234'} • {monteur.email || 'Keine Mail'}
                    </span>
                  </div>

                  <div className={`w-5 h-5 rounded-md flex items-center justify-center border transition-all ${
                    isAssigned ? 'bg-emerald-600 border-emerald-600 text-white' : 'border-slate-300 bg-white'
                  }`}>
                    {isAssigned && <Check className="w-3.5 h-3.5" />}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Submit Bar */}
        <div className="flex justify-end pt-2">
          <button
            type="submit"
            disabled={isSaving}
            className="flex items-center space-x-2 bg-[#3B82C4] hover:bg-[#2B6EB0] text-white px-6 py-2.5 rounded-xl text-xs font-bold shadow-md shadow-blue-500/20 transition-all hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50"
          >
            <Save className="w-4 h-4" />
            <span>{isSaving ? 'Speichere...' : 'Projekteinstellungen speichern'}</span>
          </button>
        </div>
      </form>

      {/* Danger Zone: Delete Project */}
      <div className="bg-red-50/60 border border-red-200 rounded-2xl p-6">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <h4 className="text-sm font-bold text-red-900">Projekt unwiderruflich löschen</h4>
            <p className="text-xs text-red-700/80 mt-0.5">
              Entfernt das Bauvorhaben, alle zugehörigen Räume, Buchungen und LV-Positionen.
            </p>
          </div>
          <button
            type="button"
            onClick={async () => {
              if (window.confirm(`Möchten Sie das Projekt "${project.name}" wirklich unwiderruflich löschen?`)) {
                await deleteProject(project.id);
              }
            }}
            className="flex items-center space-x-2 bg-red-600 hover:bg-red-700 text-white px-4 py-2.5 rounded-xl text-xs font-bold shadow-sm transition-all hover:scale-[1.02] shrink-0"
          >
            <Trash2 className="w-4 h-4" />
            <span>Projekt löschen</span>
          </button>
        </div>
      </div>
    </div>
  );
};
