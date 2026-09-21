import React, { useState } from 'react';
import { 
  X, 
  UploadCloud, 
  FileCode, 
  CheckCircle2, 
  Building2, 
  ArrowRight, 
  ArrowLeft,
  Compass, 
  HardHat, 
  Briefcase, 
  Wrench, 
  Mail, 
  Check
} from 'lucide-react';
import { parseGaebFile } from '../services/gaebParser';
import { parseDwgFile } from '../services/dwgParser';
import { createProject } from '../services/firestoreService';
import type { Project, Position, Room, User } from '../types';

interface NewProjectModalProps {
  isOpen: boolean;
  onClose: () => void;
  onProjectCreated: (newProjectId: string) => void;
  users: User[];
}

export const NewProjectModal: React.FC<NewProjectModalProps> = ({
  isOpen,
  onClose,
  onProjectCreated,
  users
}) => {
  const [currentStep, setCurrentStep] = useState<1 | 2 | 3>(1);

  // Step 1: Stammdaten
  const [name, setName] = useState<string>('');
  const [projectNumber, setProjectNumber] = useState<string>('');
  const [trade, setTrade] = useState<string>('Sanitärinstallation');
  const [location, setLocation] = useState<string>('');
  const [address, setAddress] = useState<string>('');
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');

  // Step 2: Beteiligte & Leitung
  const [client, setClient] = useState<string>('');
  const [projectManagerId, setProjectManagerId] = useState<string>('');
  const [projectManager, setProjectManager] = useState<string>('Florian Buck');
  const [projectManagerEmail, setProjectManagerEmail] = useState<string>('f.buck@burk-haustechnik.de');
  const [commercialManagerId, setCommercialManagerId] = useState<string>('');
  const [commercialManager, setCommercialManager] = useState<string>('Sabine Müller');
  const [commercialManagerEmail, setCommercialManagerEmail] = useState<string>('s.mueller@burk-haustechnik.de');
  const [assignedMonteurIds, setAssignedMonteurIds] = useState<string[]>([]);

  // Step 3: GAEB & CAD Files
  const [gaebFileName, setGaebFileName] = useState<string>('');
  const [parsedPositions, setParsedPositions] = useState<Partial<Position>[]>([]);
  const [gaebStatus, setGaebStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [gaebMessage, setGaebMessage] = useState<string>('');

  const [dwgFileObj, setDwgFileObj] = useState<File | null>(null);
  const [dwgFileName, setDwgFileName] = useState<string>('');
  const [dwgRooms, setDwgRooms] = useState<Room[]>([]);
  const [dwgStatus, setDwgStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [dwgMessage, setDwgMessage] = useState<string>('');

  const [loading, setLoading] = useState<boolean>(false);

  if (!isOpen) return null;

  const bauleiterList = users.filter(u => u.role === 'bauleiter' || u.role === 'admin');
  const kfmList = users.filter(u => u.role === 'kaufmaennisch' || u.role === 'admin');
  const monteurList = users.filter(u => u.role === 'monteur');

  const handleSelectBauleiter = (userId: string) => {
    setProjectManagerId(userId);
    const found = users.find(u => u.id === userId);
    if (found) {
      setProjectManager(found.name);
      setProjectManagerEmail(found.email || '');
    }
  };

  const handleSelectKfm = (userId: string) => {
    setCommercialManagerId(userId);
    const found = users.find(u => u.id === userId);
    if (found) {
      setCommercialManager(found.name);
      setCommercialManagerEmail(found.email || '');
    }
  };

  const handleToggleMonteur = (monteurId: string) => {
    setAssignedMonteurIds(prev => 
      prev.includes(monteurId) ? prev.filter(id => id !== monteurId) : [...prev, monteurId]
    );
  };

  // GAEB Upload
  const handleGaebChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setGaebFileName(file.name);
    setGaebStatus('idle');
    setGaebMessage('');

    const reader = new FileReader();
    reader.onload = async (evt) => {
      try {
        const content = evt.target?.result as string;
        const result = parseGaebFile(content, file.name);

        setParsedPositions(result.positions);
        setGaebStatus('success');
        setGaebMessage(`${result.positions.length} LV-Positionen erfolgreich extrahiert!`);

        // Prefill missing fields from GAEB if user hasn't typed them yet
        if (!name && result.metadata.projectName) setName(result.metadata.projectName);
        if (!projectNumber && result.metadata.projectNumber) setProjectNumber(result.metadata.projectNumber);
        if (!trade && result.metadata.trade) setTrade(result.metadata.trade);
        if (!location && result.metadata.location) setLocation(result.metadata.location);
        if (!client && result.metadata.client) setClient(result.metadata.client);
        if (!startDate && result.metadata.startDate) setStartDate(result.metadata.startDate);
        if (!endDate && result.metadata.endDate) setEndDate(result.metadata.endDate);

        if (dwgFileObj) {
          const updatedDwg = await parseDwgFile(dwgFileObj, result.positions);
          setDwgRooms(updatedDwg.rooms);
          const totalAssigned = updatedDwg.rooms.reduce((acc, r) => acc + (r.materials?.length || 0), 0);
          setDwgMessage(`${updatedDwg.rooms.length} Räume aus CAD-Plan extrahiert (${totalAssigned} Zuordnungen)`);
        }
      } catch (err: any) {
        setGaebStatus('error');
        setGaebMessage('Fehler beim Einlesen: ' + (err.message || 'Ungültiges GAEB-Format'));
      }
    };

    if (file.name.toLowerCase().endsWith('.d83')) {
      reader.readAsText(file, 'ISO-8859-1');
    } else {
      reader.readAsText(file, 'UTF-8');
    }
  };

  // DWG / DXF Upload
  const handleDwgChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setDwgFileObj(file);
    setDwgFileName(file.name);
    setDwgStatus('idle');
    setDwgMessage('');

    try {
      const result = await parseDwgFile(file, parsedPositions);
      setDwgRooms(result.rooms);
      setDwgStatus('success');
      const totalAssigned = result.rooms.reduce((acc, r) => acc + (r.materials?.length || 0), 0);
      setDwgMessage(`${result.rooms.length} Räume & Örtlichkeiten aus ${file.name} extrahiert (${totalAssigned} Positionen zugeordnet)`);
    } catch (err: any) {
      setDwgStatus('error');
      setDwgMessage('Fehler beim CAD-Einlesen: ' + (err.message || 'Format ungültig'));
    }
  };

  // Final Submit
  const handleCreate = async () => {
    if (!name || !startDate) {
      setCurrentStep(1);
      alert('Bitte füllen Sie mindestens den Projektnamen und das Startdatum aus.');
      return;
    }

    setLoading(true);

    try {
      const projectId = `proj_${Date.now()}`;
      const isStarted = new Date(startDate) <= new Date();
      const derivedStatus = isStarted ? 'in_progress' : 'draft';

      const newProject: Project = {
        id: projectId,
        name: name.trim(),
        projectNumber: projectNumber.trim() || 'P-' + Math.floor(1000 + Math.random() * 9000),
        client: client.trim() || 'Direktkunde',
        location: location.trim() || 'Vor Ort',
        address: address.trim() || undefined,
        startDate: startDate || undefined,
        endDate: endDate || undefined,
        trade: trade || 'Sanitärinstallation',
        projectManagerId: projectManagerId || undefined,
        projectManager: projectManager || 'Florian Buck',
        projectManagerEmail: projectManagerEmail || undefined,
        commercialManagerId: commercialManagerId || undefined,
        commercialManager: commercialManager || 'Sabine Müller',
        commercialManagerEmail: commercialManagerEmail || undefined,
        assignedMonteurIds: assignedMonteurIds,
        status: derivedStatus,
        currency: 'EUR',
        totalPositions: parsedPositions.length,
        hasDwg: dwgRooms.length > 0,
        dwgFileName: dwgFileName || undefined,
        createdAt: new Date().toISOString()
      };

      await createProject(newProject, parsedPositions, dwgRooms);
      onProjectCreated(projectId);
      onClose();
    } catch (err) {
      console.error('Error creating project:', err);
      alert('Fehler beim Erstellen des Projekts.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-white w-full max-w-4xl rounded-2xl shadow-2xl border border-slate-200 overflow-hidden my-6 animate-in fade-in zoom-in-95 duration-150 flex flex-col max-h-[92vh]">
        
        {/* Modal Header */}
        <div className="bg-[#1C2A3B] text-white p-5 sm:p-6 flex items-center justify-between border-b border-slate-700">
          <div>
            <span className="text-xs font-bold text-[#3B82C4] uppercase tracking-wider block">
              Neues Bauvorhaben
            </span>
            <h2 className="text-xl sm:text-2xl font-bold text-white tracking-wide">
              Projekt anlegen
            </h2>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* 3-Step Indicator Bar */}
        <div className="bg-slate-50 border-b border-slate-200 px-6 py-3.5 flex items-center justify-between">
          <div className="flex items-center space-x-2 sm:space-x-6 w-full max-w-2xl">
            {/* Step 1 */}
            <div 
              onClick={() => setCurrentStep(1)}
              className={`flex items-center space-x-2 cursor-pointer transition-all ${
                currentStep === 1 ? 'text-[#3B82C4] font-bold' : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              <span className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold ${
                currentStep === 1 ? 'bg-[#3B82C4] text-white' : 'bg-slate-200 text-slate-700'
              }`}>
                1
              </span>
              <span className="text-xs hidden sm:inline">Stammdaten</span>
            </div>

            <div className="h-px bg-slate-300 flex-1" />

            {/* Step 2 */}
            <div 
              onClick={() => {
                if (!name || !startDate) {
                  alert('Bitte zuerst Projektname und Startdatum angeben.');
                  return;
                }
                setCurrentStep(2);
              }}
              className={`flex items-center space-x-2 cursor-pointer transition-all ${
                currentStep === 2 ? 'text-[#3B82C4] font-bold' : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              <span className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold ${
                currentStep === 2 ? 'bg-[#3B82C4] text-white' : 'bg-slate-200 text-slate-700'
              }`}>
                2
              </span>
              <span className="text-xs hidden sm:inline">Beteiligte & Leitung</span>
            </div>

            <div className="h-px bg-slate-300 flex-1" />

            {/* Step 3 */}
            <div 
              onClick={() => {
                if (!name || !startDate) {
                  alert('Bitte zuerst Projektname und Startdatum angeben.');
                  return;
                }
                setCurrentStep(3);
              }}
              className={`flex items-center space-x-2 cursor-pointer transition-all ${
                currentStep === 3 ? 'text-[#3B82C4] font-bold' : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              <span className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold ${
                currentStep === 3 ? 'bg-[#3B82C4] text-white' : 'bg-slate-200 text-slate-700'
              }`}>
                3
              </span>
              <span className="text-xs hidden sm:inline">Pläne & GAEB</span>
            </div>
          </div>

          <span className="text-xs font-semibold text-slate-400">
            Schritt {currentStep} von 3
          </span>
        </div>

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          
          {/* ========================================================= */}
          {/* STEP 1: PROJEKT-STAMMDATEN                                 */}
          {/* ========================================================= */}
          {currentStep === 1 && (
            <div className="space-y-4 animate-in fade-in duration-150">
              <div className="border-b border-slate-100 pb-3">
                <h3 className="font-bold text-slate-900 text-base flex items-center space-x-2">
                  <Building2 className="w-5 h-5 text-[#3B82C4]" />
                  <span>Schritt 1: Projekt-Stammdaten & Baustelle</span>
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Basisinformationen des Vorhabens. Der Projektstatus berechnet sich automatisch über den Projektzeitraum.
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                <div className="md:col-span-2">
                  <label className="block font-bold text-slate-700 mb-1">Projektname / Baumaßnahme *</label>
                  <input
                    type="text"
                    required
                    placeholder="z.B. Hallenbad Weingarten Sanierung oder Neubau Wohnanlage"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 font-semibold focus:outline-none focus:ring-2 focus:ring-[#3B82C4]"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">Projektnummer / Kennung</label>
                  <input
                    type="text"
                    placeholder="z.B. 1638 / 24316-044"
                    value={projectNumber}
                    onChange={(e) => setProjectNumber(e.target.value)}
                    className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 font-mono focus:outline-none focus:ring-2 focus:ring-[#3B82C4]"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">Gewerk</label>
                  <input
                    type="text"
                    placeholder="z.B. Sanitärinstallation, Heizung, Lüftung"
                    value={trade}
                    onChange={(e) => setTrade(e.target.value)}
                    className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#3B82C4]"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">Baustellen-Standort (Ort)</label>
                  <input
                    type="text"
                    placeholder="z.B. Weingarten, Ravensburg, Bavendorf"
                    value={location}
                    onChange={(e) => setLocation(e.target.value)}
                    className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#3B82C4]"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">Genaue Adresse (Straße, PLZ, Ort)</label>
                  <input
                    type="text"
                    placeholder="z.B. Brechenmacherstraße 11, 88250 Weingarten"
                    value={address}
                    onChange={(e) => setAddress(e.target.value)}
                    className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#3B82C4]"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">Startdatum (Beginn der Arbeiten) *</label>
                  <input
                    type="date"
                    required
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#3B82C4]"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">Fertigstellung (optional)</label>
                  <input
                    type="date"
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#3B82C4]"
                  />
                </div>
              </div>
            </div>
          )}

          {/* ========================================================= */}
          {/* STEP 2: BETEILIGTE & LEITUNGEN                             */}
          {/* ========================================================= */}
          {currentStep === 2 && (
            <div className="space-y-5 animate-in fade-in duration-150">
              <div className="border-b border-slate-100 pb-3">
                <h3 className="font-bold text-slate-900 text-base flex items-center space-x-2">
                  <Briefcase className="w-5 h-5 text-[#3B82C4]" />
                  <span>Schritt 2: Beteiligte, Leitungsfunktionen & Monteure</span>
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Wählen Sie die verantwortlichen Personen bequem über das Dropdown aus den hinterlegten Benutzern aus.
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                <div className="md:col-span-2">
                  <label className="block font-bold text-slate-700 mb-1">Auftraggeber / Kunde</label>
                  <input
                    type="text"
                    placeholder="z.B. Stadt Weingarten, Wohnbau GmbH oder Privatkunde"
                    value={client}
                    onChange={(e) => setClient(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 font-semibold focus:outline-none focus:ring-2 focus:ring-[#3B82C4]"
                  />
                </div>

                {/* Bauleiter Dropdown */}
                <div className="space-y-1">
                  <label className="block font-bold text-slate-700 flex items-center space-x-1.5">
                    <HardHat className="w-3.5 h-3.5 text-blue-600" />
                    <span>Zuständiger Bauleiter *</span>
                  </label>
                  <select
                    value={projectManagerId}
                    onChange={(e) => handleSelectBauleiter(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 font-semibold focus:outline-none focus:ring-2 focus:ring-[#3B82C4]"
                  >
                    <option value="">-- Bauleiter auswählen --</option>
                    {bauleiterList.map(u => (
                      <option key={u.id} value={u.id}>
                        {u.name} ({u.role === 'admin' ? 'Eigentümer/Admin' : 'Bauleiter'})
                      </option>
                    ))}
                  </select>
                  {projectManagerEmail && (
                    <div className="text-[11px] text-slate-500 flex items-center space-x-1 pt-0.5">
                      <Mail className="w-3 h-3 text-slate-400" />
                      <span>E-Mail: {projectManagerEmail}</span>
                    </div>
                  )}
                </div>

                {/* Kaufmännischer Leiter Dropdown */}
                <div className="space-y-1">
                  <label className="block font-bold text-slate-700 flex items-center space-x-1.5">
                    <Briefcase className="w-3.5 h-3.5 text-amber-600" />
                    <span>Kaufmännischer Leiter (Nachbestellungen & Freigaben) *</span>
                  </label>
                  <select
                    value={commercialManagerId}
                    onChange={(e) => handleSelectKfm(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 font-semibold focus:outline-none focus:ring-2 focus:ring-[#3B82C4]"
                  >
                    <option value="">-- Kaufmännischen Leiter auswählen --</option>
                    {kfmList.map(u => (
                      <option key={u.id} value={u.id}>
                        {u.name} ({u.role === 'admin' ? 'Eigentümer/Admin' : 'Kaufmännische Leitung'})
                      </option>
                    ))}
                  </select>
                  {commercialManagerEmail && (
                    <div className="text-[11px] text-slate-500 flex items-center space-x-1 pt-0.5">
                      <Mail className="w-3 h-3 text-slate-400" />
                      <span>E-Mail: {commercialManagerEmail}</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Monteure Zuweisen */}
              <div className="space-y-2 pt-2 border-t border-slate-100">
                <div className="flex items-center justify-between">
                  <label className="font-bold text-slate-700 text-xs flex items-center space-x-1.5">
                    <Wrench className="w-3.5 h-3.5 text-emerald-600" />
                    <span>Eingesetzte Monteure für dieses Projekt (Multi-Select)</span>
                  </label>
                  <span className="text-[11px] text-[#3B82C4] font-semibold">
                    {assignedMonteurIds.length} Monteure ausgewählt
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2.5">
                  {monteurList.map(monteur => {
                    const isSelected = assignedMonteurIds.includes(monteur.id);

                    return (
                      <div
                        key={monteur.id}
                        onClick={() => handleToggleMonteur(monteur.id)}
                        className={`p-2.5 rounded-xl border cursor-pointer transition-all flex items-center justify-between ${
                          isSelected
                            ? 'bg-emerald-50 border-emerald-300 ring-1 ring-emerald-200'
                            : 'bg-slate-50 hover:bg-slate-100 border-slate-200'
                        }`}
                      >
                        <div className="space-y-0.5 truncate mr-2">
                          <span className="font-bold text-xs text-slate-900 block truncate">
                            {monteur.name}
                          </span>
                          <span className="text-[10px] text-slate-500 block">
                            PIN: {monteur.pin || '1234'}
                          </span>
                        </div>
                        <div className={`w-4 h-4 rounded flex items-center justify-center border transition-all ${
                          isSelected ? 'bg-emerald-600 border-emerald-600 text-white' : 'border-slate-300 bg-white'
                        }`}>
                          {isSelected && <Check className="w-3 h-3" />}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {/* ========================================================= */}
          {/* STEP 3: PLÄNE & GAEB                                       */}
          {/* ========================================================= */}
          {currentStep === 3 && (
            <div className="space-y-5 animate-in fade-in duration-150">
              <div className="border-b border-slate-100 pb-3">
                <h3 className="font-bold text-slate-900 text-base flex items-center space-x-2">
                  <Compass className="w-5 h-5 text-[#3B82C4]" />
                  <span>Schritt 3: CAD-Plan & GAEB-Ausschreibung hochladen</span>
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Laden Sie die Planungsunterlagen hoch. Sollte keine CAD-Datei vorliegen, genügt die GAEB-Datei.
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* 1. DWG / DXF */}
                <div className={`p-4 rounded-xl border-2 transition-all ${
                  dwgStatus === 'success' ? 'border-emerald-400 bg-emerald-50/40' : 'border-dashed border-slate-300 bg-slate-50'
                }`}>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-bold text-slate-800 flex items-center space-x-1.5">
                      <Compass className="w-4 h-4 text-[#3B82C4]" />
                      <span>1. CAD-Plan (DWG / DXF)</span>
                    </span>
                    <span className="text-[10px] font-bold text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded-full">
                      Räume & Etagen
                    </span>
                  </div>

                  <label className="flex flex-col items-center justify-center p-6 bg-white border border-slate-200 rounded-xl cursor-pointer hover:border-[#3B82C4] transition-all group text-center">
                    <UploadCloud className="w-8 h-8 text-slate-400 group-hover:text-[#3B82C4] mb-2" />
                    <span className="text-xs font-bold text-slate-800 block">
                      {dwgFileName || 'DWG / DXF Datei auswählen'}
                    </span>
                    <span className="text-[10px] text-slate-400 block mt-0.5">
                      AutoCAD .dwg oder offenes DXF
                    </span>
                    <input
                      type="file"
                      accept=".dwg,.dxf"
                      onChange={handleDwgChange}
                      className="hidden"
                    />
                  </label>

                  {dwgMessage && (
                    <p className={`text-xs mt-2 font-medium ${dwgStatus === 'success' ? 'text-emerald-700' : 'text-red-600'}`}>
                      {dwgMessage}
                    </p>
                  )}
                </div>

                {/* 2. GAEB */}
                <div className={`p-4 rounded-xl border-2 transition-all ${
                  gaebStatus === 'success' ? 'border-emerald-400 bg-emerald-50/40' : 'border-dashed border-slate-300 bg-slate-50'
                }`}>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-bold text-slate-800 flex items-center space-x-1.5">
                      <FileCode className="w-4 h-4 text-[#2FA36B]" />
                      <span>2. GAEB-Ausschreibung</span>
                    </span>
                    <span className="text-[10px] font-bold text-blue-700 bg-blue-100 px-2 py-0.5 rounded-full">
                      LV & Materialien
                    </span>
                  </div>

                  <label className="flex flex-col items-center justify-center p-6 bg-white border border-slate-200 rounded-xl cursor-pointer hover:border-[#2FA36B] transition-all group text-center">
                    <UploadCloud className="w-8 h-8 text-slate-400 group-hover:text-[#2FA36B] mb-2" />
                    <span className="text-xs font-bold text-slate-800 block">
                      {gaebFileName || 'GAEB-Datei auswählen'}
                    </span>
                    <span className="text-[10px] text-slate-400 block mt-0.5">
                      .x81, .x83, .xml oder .d83
                    </span>
                    <input
                      type="file"
                      accept=".x81,.x82,.x83,.x84,.x85,.x86,.d83,.xml"
                      onChange={handleGaebChange}
                      className="hidden"
                    />
                  </label>

                  {gaebMessage && (
                    <p className={`text-xs mt-2 font-medium ${gaebStatus === 'success' ? 'text-emerald-700' : 'text-red-600'}`}>
                      {gaebMessage}
                    </p>
                  )}
                </div>
              </div>

              {/* Summary Box */}
              <div className="bg-slate-100 p-4 rounded-xl border border-slate-200 text-xs space-y-1.5">
                <span className="font-bold text-slate-800 block uppercase tracking-wider text-[11px]">
                  Projekt-Zusammenfassung
                </span>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1 text-slate-600">
                  <div>Projekt: <strong className="text-slate-900 block truncate">{name}</strong></div>
                  <div>Bauleiter: <strong className="text-slate-900 block truncate">{projectManager}</strong></div>
                  <div>Kfm. Leitung: <strong className="text-slate-900 block truncate">{commercialManager}</strong></div>
                  <div>Monteure: <strong className="text-slate-900 block">{assignedMonteurIds.length} zugewiesen</strong></div>
                </div>
              </div>
            </div>
          )}

        </div>

        {/* Modal Footer Controls */}
        <div className="p-4 sm:p-5 bg-slate-50 border-t border-slate-200 flex items-center justify-between">
          <div>
            {currentStep > 1 && (
              <button
                type="button"
                onClick={() => setCurrentStep((currentStep - 1) as 1 | 2)}
                className="flex items-center space-x-1.5 px-4 py-2 bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 rounded-xl text-xs font-bold transition-all"
              >
                <ArrowLeft className="w-4 h-4" />
                <span>Zurück</span>
              </button>
            )}
          </div>

          <div className="flex items-center space-x-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-500 hover:text-slate-700"
            >
              Abbrechen
            </button>

            {currentStep < 3 ? (
              <button
                type="button"
                onClick={() => {
                  if (currentStep === 1 && (!name || !startDate)) {
                    alert('Bitte füllen Sie den Projektnamen und das Startdatum aus.');
                    return;
                  }
                  setCurrentStep((currentStep + 1) as 2 | 3);
                }}
                className="flex items-center space-x-2 bg-[#3B82C4] hover:bg-[#2B6EB0] text-white px-5 py-2.5 rounded-xl text-xs font-bold shadow-md shadow-blue-500/20 transition-all hover:scale-[1.02] active:scale-[0.98]"
              >
                <span>Weiter</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            ) : (
              <button
                type="button"
                disabled={loading}
                onClick={handleCreate}
                className="flex items-center space-x-2 bg-[#2FA36B] hover:bg-[#258757] text-white px-6 py-2.5 rounded-xl text-xs font-bold shadow-md shadow-emerald-600/20 transition-all hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50"
              >
                <CheckCircle2 className="w-4 h-4" />
                <span>{loading ? 'Projekt wird erstellt...' : 'Projekt verbindlich anlegen'}</span>
              </button>
            )}
          </div>
        </div>

      </div>
    </div>
  );
};
