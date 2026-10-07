import React, { useState, useEffect, useMemo } from 'react';
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
  Check,
  Sparkles,
  Trash2,
  Layers,
  FileText,
  Loader2,
  UserCheck,
  Phone
} from 'lucide-react';
import { parseLvFile } from '../services/gaebParser';
import { 
  parseMultipleCadFiles, 
  detectLevelFromFilename, 
  type MultiPlanInput 
} from '../services/dwgParser';
import { createProject, uploadPlanFile } from '../services/firestoreService';
import type { Project, Position, Room, User, PlanDocument, PlanLevel } from '../types';

export interface UploadedPlanItem {
  id: string;
  file: File;
  name: string;
  size: number;
  level: PlanLevel;
  fileType: 'dwg' | 'dxf' | 'pdf' | string;
  detectedRoomsCount: number;
  vectorData?: any;
  detectedLayers?: string[];
}

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

  // Step 2: Beteiligte & Leitung (inkl. Vertretung)
  const [client, setClient] = useState<string>('');
  const [projectManagerId, setProjectManagerId] = useState<string>('');
  const [projectManager, setProjectManager] = useState<string>('Florian Buck');
  const [projectManagerEmail, setProjectManagerEmail] = useState<string>('f.buck@burk-haustechnik.de');
  const [deputyProjectManagerId, setDeputyProjectManagerId] = useState<string>('');
  const [deputyProjectManager, setDeputyProjectManager] = useState<string>('');
  const [deputyProjectManagerEmail, setDeputyProjectManagerEmail] = useState<string>('');

  const [commercialManagerId, setCommercialManagerId] = useState<string>('');
  const [commercialManager, setCommercialManager] = useState<string>('Sabine Müller');
  const [commercialManagerEmail, setCommercialManagerEmail] = useState<string>('s.mueller@burk-haustechnik.de');
  const [deputyCommercialManagerId, setDeputyCommercialManagerId] = useState<string>('');
  const [deputyCommercialManager, setDeputyCommercialManager] = useState<string>('');
  const [deputyCommercialManagerEmail, setDeputyCommercialManagerEmail] = useState<string>('');

  const [assignedMonteurIds, setAssignedMonteurIds] = useState<string[]>([]);

  useEffect(() => {
    if (!projectManagerId && users.length > 0) {
      const bl = users.find(u => u.role === 'projektleiter' || u.role === 'bauleiter') || users.find(u => u.name.includes('Buck')) || users[0];
      if (bl) {
        setProjectManagerId(bl.id);
        setProjectManager(bl.name);
        setProjectManagerEmail(bl.email || '');
      }
    }
    if (!commercialManagerId && users.length > 0) {
      const kfm = users.find(u => u.role === 'kaufmaennisch') || users.find(u => u.name.includes('Müller')) || users[0];
      if (kfm) {
        setCommercialManagerId(kfm.id);
        setCommercialManager(kfm.name);
        setCommercialManagerEmail(kfm.email || '');
      }
    }
  }, [users, projectManagerId, commercialManagerId]);

  // Step 3: GAEB / LV & Multi-CAD Plan Files
  const [gaebFileName, setGaebFileName] = useState<string>('');
  const [parsedPositions, setParsedPositions] = useState<Partial<Position>[]>([]);
  const [gaebStatus, setGaebStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [gaebMessage, setGaebMessage] = useState<string>('');

  const [uploadedPlans, setUploadedPlans] = useState<UploadedPlanItem[]>([]);
  const [dwgRooms, setDwgRooms] = useState<Room[]>([]);
  const [dwgStatus, setDwgStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [dwgMessage, setDwgMessage] = useState<string>('');
  const [isDraggingPlans, setIsDraggingPlans] = useState<boolean>(false);
  const [uploadProgress, setUploadProgress] = useState<{ [planId: string]: number }>({});
  const [uploadStatusText, setUploadStatusText] = useState<string>('');

  const [loading, setLoading] = useState<boolean>(false);

  if (!isOpen) return null;

  const bauleiterList = users.filter(u => u.role === 'projektleiter' || u.role === 'bauleiter' || u.role === 'admin');
  const kfmList = users.filter(u => u.role === 'kaufmaennisch' || u.role === 'admin');

  // Deduplicate monteurs strictly by person name
  const monteurList = useMemo(() => {
    const rawMonteurs = users.filter(u => u.role === 'monteur');
    const seen = new Set<string>();
    const deduped: User[] = [];
    for (const m of rawMonteurs) {
      if (!m.name) continue;
      const key = m.name.trim().toLowerCase();
      if (!seen.has(key)) {
        seen.add(key);
        deduped.push(m);
      }
    }
    return deduped;
  }, [users]);

  const handleSelectBauleiter = (userId: string) => {
    setProjectManagerId(userId);
    const found = users.find(u => u.id === userId);
    if (found) {
      setProjectManager(found.name);
      setProjectManagerEmail(found.email || '');
    }
  };

  const handleSelectDeputyBauleiter = (userId: string) => {
    setDeputyProjectManagerId(userId);
    const found = users.find(u => u.id === userId);
    if (found) {
      setDeputyProjectManager(found.name);
      setDeputyProjectManagerEmail(found.email || '');
    } else {
      setDeputyProjectManager('');
      setDeputyProjectManagerEmail('');
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

  const handleSelectDeputyKfm = (userId: string) => {
    setDeputyCommercialManagerId(userId);
    const found = users.find(u => u.id === userId);
    if (found) {
      setDeputyCommercialManager(found.name);
      setDeputyCommercialManagerEmail(found.email || '');
    } else {
      setDeputyCommercialManager('');
      setDeputyCommercialManagerEmail('');
    }
  };

  const handleToggleMonteur = (monteur: User) => {
    const slugId = monteur.name.toLowerCase().replace(/\s+/g, '-');
    setAssignedMonteurIds(prev => {
      const isSelected = prev.includes(monteur.id) || prev.includes(slugId);
      if (isSelected) {
        return prev.filter(id => id !== monteur.id && id !== slugId);
      } else {
        return [...prev.filter(id => id !== slugId), monteur.id];
      }
    });
  };

  // Helper to re-synthesize rooms across all uploaded CAD plans with positions
  const recalculateRooms = async (plans: UploadedPlanItem[], positions: Partial<Position>[]) => {
    const cadPlans: MultiPlanInput[] = plans
      .filter(p => p.fileType === 'dwg' || p.fileType === 'dxf')
      .map(p => ({
        file: p.file,
        level: p.level,
        planId: p.id
      }));

    if (cadPlans.length === 0) {
      setDwgRooms([]);
      setDwgStatus('idle');
      setDwgMessage('');
      return;
    }

    try {
      setDwgStatus('idle');
      const { allRooms, planResults } = await parseMultipleCadFiles(cadPlans, positions);
      setDwgRooms(allRooms);
      setDwgStatus('success');

      // Update detected room counts and vectorData on individual plans
      setUploadedPlans(prev => prev.map(p => {
        const res = planResults.get(p.id);
        return {
          ...p,
          detectedRoomsCount: res ? res.rooms.length : 0,
          vectorData: res?.vectorData,
          detectedLayers: res?.detectedLayers
        };
      }));

      const totalMatched = allRooms.reduce((acc, r) => acc + (r.materials?.length || 0), 0);
      setDwgMessage(`${allRooms.length} Räume aus ${cadPlans.length} Plänen extrahiert (${totalMatched} Positionen zugeordnet)`);
    } catch (err: any) {
      setDwgStatus('error');
      setDwgMessage('Fehler beim Auswerten der Pläne: ' + (err.message || err));
    }
  };

  // Bereich A: GAEB / Excel / CSV Upload
  const handleGaebChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setGaebFileName(file.name);
    setGaebStatus('idle');
    setGaebMessage('Lese Leistungsverzeichnis ein...');

    try {
      const result = await parseLvFile(file);
      setParsedPositions(result.positions);
      setGaebStatus('success');
      setGaebMessage(`${result.positions.length} LV-Positionen erfolgreich extrahiert!`);

      // Prefill missing fields from GAEB / Excel
      if (!name && result.metadata.projectName) setName(result.metadata.projectName);
      if (!projectNumber && result.metadata.projectNumber) setProjectNumber(result.metadata.projectNumber);
      if (!trade && result.metadata.trade) setTrade(result.metadata.trade);
      if (!location && result.metadata.location) setLocation(result.metadata.location);
      if (!client && result.metadata.client) setClient(result.metadata.client);
      if (!startDate && result.metadata.startDate) setStartDate(result.metadata.startDate);
      if (!endDate && result.metadata.endDate) setEndDate(result.metadata.endDate);

      // Re-map with existing plans
      if (uploadedPlans.length > 0) {
        await recalculateRooms(uploadedPlans, result.positions);
      }
    } catch (err: any) {
      setGaebStatus('error');
      setGaebMessage('Fehler beim Einlesen: ' + (err.message || 'Ungültiges Dateiformat'));
    }
  };

  // Bereich B: Montage- & Ausführungspläne Multi-Upload
  const handleAddPlanFiles = async (files: FileList | File[]) => {
    const newItems: UploadedPlanItem[] = [];

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const lower = file.name.toLowerCase();
      const ext = lower.endsWith('.dwg') ? 'dwg' : lower.endsWith('.dxf') ? 'dxf' : lower.endsWith('.pdf') ? 'pdf' : 'dwg';
      const level = detectLevelFromFilename(file.name);
      const planId = `plan_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;

      newItems.push({
        id: planId,
        file,
        name: file.name,
        size: file.size,
        level,
        fileType: ext,
        detectedRoomsCount: 0
      });
    }

    if (newItems.length === 0) return;

    const combined = [...uploadedPlans, ...newItems];
    setUploadedPlans(combined);
    await recalculateRooms(combined, parsedPositions);
  };

  const handlePlanLevelChange = async (planId: string, newLevel: PlanLevel) => {
    const updated = uploadedPlans.map(p => p.id === planId ? { ...p, level: newLevel } : p);
    setUploadedPlans(updated);
    await recalculateRooms(updated, parsedPositions);
  };

  const handleRemovePlan = async (planId: string) => {
    const updated = uploadedPlans.filter(p => p.id !== planId);
    setUploadedPlans(updated);
    await recalculateRooms(updated, parsedPositions);
  };

  // Quick Load EFH Sample files
  const handleLoadEfhSamples = async () => {
    try {
      setLoading(true);
      setUploadStatusText('Lade Musterdaten...');

      // 1. Fetch GAEB
      const gaebRes = await fetch('/samples/Sanitaer_Demo_Projekt_EFH_X81.x81');
      if (!gaebRes.ok) throw new Error('Muster GAEB-Datei nicht im Webspace gefunden');
      const gaebBlob = await gaebRes.blob();
      const gaebFile = new File([gaebBlob], 'Sanitaer_Demo_Projekt_EFH_X81.x81', { type: 'application/xml' });
      const gaebResult = await parseLvFile(gaebFile);
      
      setGaebFileName('Sanitaer_Demo_Projekt_EFH_X81.x81');
      setParsedPositions(gaebResult.positions);
      setGaebStatus('success');
      setGaebMessage(`${gaebResult.positions.length} LV-Positionen erfolgreich extrahiert!`);

      if (!name) setName('Neubau Einfamilienhaus Schneider');
      if (!projectNumber) setProjectNumber('EFH-2026-01');
      if (!trade) setTrade('Sanitärinstallation');
      if (!location) setLocation('Ravensburg');
      if (!address) setAddress('Musterstraße 12, 88212 Ravensburg');
      if (!client) setClient('Familie Schneider');
      if (!startDate) setStartDate(new Date().toISOString().split('T')[0]);

      // 2. Fetch Sample Plans (EFH DXF as EG and Weingarten DXF as UG)
      const dxfRes = await fetch('/samples/Sanitaer_Demo_Projekt_EFH.dxf');
      if (!dxfRes.ok) throw new Error('Muster DXF-Datei nicht im Webspace gefunden');
      const dxfBlob = await dxfRes.blob();
      const dxfFile1 = new File([dxfBlob], 'EFH_Montageplan_EG.dxf', { type: 'application/dxf' });

      const weingartenRes = await fetch('/samples/Hallenbad_Weingarten_Plan.dxf');
      const sampleList: UploadedPlanItem[] = [
        {
          id: `plan_sample_eg_${Date.now()}`,
          file: dxfFile1,
          name: 'EFH_Montageplan_EG.dxf',
          size: dxfFile1.size,
          level: 'EG',
          fileType: 'dxf',
          detectedRoomsCount: 0
        }
      ];

      if (weingartenRes.ok) {
        const wBlob = await weingartenRes.blob();
        const dxfFile2 = new File([wBlob], 'Montageplan_UG_Technik.dxf', { type: 'application/dxf' });
        sampleList.push({
          id: `plan_sample_ug_${Date.now() + 1}`,
          file: dxfFile2,
          name: 'Montageplan_UG_Technik.dxf',
          size: dxfFile2.size,
          level: 'UG',
          fileType: 'dxf',
          detectedRoomsCount: 0
        });
      }

      setUploadedPlans(sampleList);
      await recalculateRooms(sampleList, gaebResult.positions);
    } catch (err: any) {
      alert('Hinweis beim Laden der Musterdaten: ' + (err.message || err));
    } finally {
      setLoading(false);
      setUploadStatusText('');
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

      // 1. Upload plans to Firebase Storage concurrently
      setUploadStatusText(`Lade ${uploadedPlans.length} Pläne nach Firebase Storage hoch...`);
      const planDocuments: PlanDocument[] = await Promise.all(
        uploadedPlans.map(async (plan, i) => {
          const { downloadUrl, storagePath } = await uploadPlanFile(
            projectId,
            plan.id,
            plan.file,
            (pct) => {
              setUploadProgress(prev => ({ ...prev, [plan.id]: pct }));
              setUploadStatusText(`Lade Plan ${i + 1}/${uploadedPlans.length} (${plan.name}): ${pct}%...`);
            }
          );

          const rawBaseName = plan.name.replace(/\.[^/.]+$/, '').replace(/[_-]+/g, ' ').trim();
          const cleanName = rawBaseName.toLowerCase().includes('montageplan')
            ? rawBaseName
            : `Montageplan ${plan.level} (${rawBaseName})`;

          return {
            id: plan.id,
            projectId,
            name: cleanName,
            fileName: plan.name,
            originalFileName: plan.name,
            floor: plan.level,
            level: plan.level,
            dwgUrl: downloadUrl,
            pdfUrl: downloadUrl,
            downloadUrl,
            storagePath,
            status: 'ready' as const,
            fileType: plan.fileType,
            size: plan.size,
            uploadedAt: new Date().toISOString(),
            createdAt: new Date().toISOString(),
            detectedRoomsCount: plan.detectedRoomsCount
          };
        })
      );

      setUploadStatusText(`Speichere ${parsedPositions.length} Positionen & ${dwgRooms.length} Räume in Firestore...`);

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
        deputyProjectManagerId: deputyProjectManagerId || undefined,
        deputyProjectManager: deputyProjectManager || undefined,
        deputyProjectManagerEmail: deputyProjectManagerEmail || undefined,
        commercialManagerId: commercialManagerId || undefined,
        commercialManager: commercialManager || 'Sabine Müller',
        commercialManagerEmail: commercialManagerEmail || undefined,
        deputyCommercialManagerId: deputyCommercialManagerId || undefined,
        deputyCommercialManager: deputyCommercialManager || undefined,
        deputyCommercialManagerEmail: deputyCommercialManagerEmail || undefined,
        assignedMonteurIds: assignedMonteurIds,
        status: derivedStatus,
        currency: 'EUR',
        totalPositions: parsedPositions.length,
        hasDwg: uploadedPlans.length > 0,
        dwgFileName: uploadedPlans[0]?.name || undefined,
        plansCount: planDocuments.length,
        plans: planDocuments,
        createdAt: new Date().toISOString()
      };

      await createProject(newProject, parsedPositions, dwgRooms, planDocuments);
      onProjectCreated(projectId);
      onClose();
    } catch (err: any) {
      console.error('Error creating project:', err);
      alert('Fehler beim Erstellen des Projekts: ' + (err.message || err));
    } finally {
      setLoading(false);
      setUploadStatusText('');
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

                {/* ZEILE 1, LINKS: Zuständiger Projektleiter */}
                <div className="space-y-1">
                  <label className="block font-bold text-slate-700 flex items-center space-x-1.5">
                    <HardHat className="w-3.5 h-3.5 text-blue-600" />
                    <span>Zuständiger Projektleiter *</span>
                  </label>
                  <select
                    value={projectManagerId}
                    onChange={(e) => handleSelectBauleiter(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 font-semibold focus:outline-none focus:ring-2 focus:ring-[#3B82C4]"
                  >
                    <option value="">-- Projektleiter auswählen --</option>
                    {bauleiterList.map(u => (
                      <option key={u.id} value={u.id}>
                        {u.name} ({u.role === 'admin' ? 'Eigentümer/Admin' : 'Projektleiter'})
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

                {/* ZEILE 1, RECHTS: Zuständige Vertretung (Projektleiter) */}
                <div className="space-y-1">
                  <label className="block font-bold text-slate-700 flex items-center space-x-1.5">
                    <UserCheck className="w-3.5 h-3.5 text-blue-500" />
                    <span>Zuständige Vertretung (Projektleiter im Urlaub/Ausfall)</span>
                  </label>
                  <select
                    value={deputyProjectManagerId}
                    onChange={(e) => handleSelectDeputyBauleiter(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 font-semibold focus:outline-none focus:ring-2 focus:ring-[#3B82C4]"
                  >
                    <option value="">-- Keine Vertretung hinterlegt --</option>
                    {bauleiterList.map(u => (
                      <option key={u.id} value={u.id}>
                        {u.name} ({u.role === 'admin' ? 'Eigentümer/Admin' : 'Projektleiter'})
                      </option>
                    ))}
                  </select>
                  {deputyProjectManagerEmail && (
                    <div className="text-[11px] text-slate-500 flex items-center space-x-1 pt-0.5">
                      <Mail className="w-3 h-3 text-slate-400" />
                      <span>Vertretung E-Mail: {deputyProjectManagerEmail}</span>
                    </div>
                  )}
                </div>

                {/* ZEILE 2, LINKS: Zuständiger Kaufmann / Kauffrau */}
                <div className="space-y-1">
                  <label className="block font-bold text-slate-700 flex items-center space-x-1.5">
                    <Briefcase className="w-3.5 h-3.5 text-amber-600" />
                    <span>Zuständiger Kaufmann / Kauffrau *</span>
                  </label>
                  <select
                    value={commercialManagerId}
                    onChange={(e) => handleSelectKfm(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 font-semibold focus:outline-none focus:ring-2 focus:ring-[#3B82C4]"
                  >
                    <option value="">-- Kaufmann / Kauffrau auswählen --</option>
                    {kfmList.map(u => (
                      <option key={u.id} value={u.id}>
                        {u.name} ({u.role === 'admin' ? 'Eigentümer/Admin' : 'Kaufmann / Kauffrau'})
                      </option>
                    ))}
                  </select>
                  {commercialManagerEmail && (
                    <div className="text-[11px] text-slate-500 flex items-center space-x-1 pt-0.5">
                      <Mail className="w-3 h-3 text-slate-400" />
                      <span>E-Mail für Freigaben: {commercialManagerEmail}</span>
                    </div>
                  )}
                </div>

                {/* ZEILE 2, RECHTS: Zuständige Vertretung (Kaufmann / Kauffrau) */}
                <div className="space-y-1">
                  <label className="block font-bold text-slate-700 flex items-center space-x-1.5">
                    <UserCheck className="w-3.5 h-3.5 text-amber-500" />
                    <span>Zuständige Vertretung (Kaufmann / Kauffrau im Urlaub/Ausfall)</span>
                  </label>
                  <select
                    value={deputyCommercialManagerId}
                    onChange={(e) => handleSelectDeputyKfm(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 font-semibold focus:outline-none focus:ring-2 focus:ring-[#3B82C4]"
                  >
                    <option value="">-- Keine Vertretung hinterlegt --</option>
                    {kfmList.map(u => (
                      <option key={u.id} value={u.id}>
                        {u.name} ({u.role === 'admin' ? 'Eigentümer/Admin' : 'Kaufmann / Kauffrau'})
                      </option>
                    ))}
                  </select>
                  {deputyCommercialManagerEmail && (
                    <div className="text-[11px] text-slate-500 flex items-center space-x-1 pt-0.5">
                      <Mail className="w-3 h-3 text-slate-400" />
                      <span>Vertretung E-Mail: {deputyCommercialManagerEmail}</span>
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
                    const slugId = monteur.name.toLowerCase().replace(/\s+/g, '-');
                    const isSelected = assignedMonteurIds.includes(monteur.id) || assignedMonteurIds.includes(slugId);

                    return (
                      <div
                        key={monteur.id}
                        onClick={() => handleToggleMonteur(monteur)}
                        className={`p-2.5 rounded-xl border cursor-pointer transition-all flex items-center justify-between ${
                          isSelected
                            ? 'bg-emerald-50 border-emerald-300 ring-1 ring-emerald-200 shadow-xs'
                            : 'bg-slate-50 hover:bg-slate-100 border-slate-200'
                        }`}
                      >
                        <div className="space-y-0.5 truncate mr-2">
                          <span className="font-bold text-xs text-slate-900 block truncate">
                            {monteur.name}
                          </span>
                          <div className="text-[10px] text-slate-500 flex flex-wrap items-center gap-x-2 gap-y-0.5">
                            <span>PIN: {monteur.pin || '1234'}</span>
                            {monteur.email ? (
                              <span className="text-slate-600 font-medium flex items-center space-x-0.5">
                                <Mail className="w-2.5 h-2.5 text-slate-400 mr-0.5" />
                                <span>{monteur.email}</span>
                              </span>
                            ) : (
                              <span className="text-slate-400">Keine Mail</span>
                            )}
                            {monteur.phone ? (
                              <span className="text-slate-600 font-medium flex items-center space-x-0.5">
                                <Phone className="w-2.5 h-2.5 text-slate-400 mr-0.5" />
                                <span>{monteur.phone}</span>
                              </span>
                            ) : null}
                          </div>
                        </div>
                        <div className={`w-4 h-4 rounded flex items-center justify-center border transition-all shrink-0 ${
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
          {/* STEP 3: BEREICH A (LV) & BEREICH B (PLÄNE)                 */}
          {/* ========================================================= */}
          {currentStep === 3 && (
            <div className="space-y-6 animate-in fade-in duration-150">
              <div className="border-b border-slate-100 pb-3">
                <h3 className="font-bold text-slate-900 text-base flex items-center space-x-2">
                  <Compass className="w-5 h-5 text-[#3B82C4]" />
                  <span>Schritt 3: Leistungsverzeichnis & Ausführungspläne hochladen</span>
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Laden Sie die GAEB/Excel-Ausschreibung und beliebig viele Ausführungs- und Montagepläne (.DWG, .DXF, .PDF) hoch. Die Räume werden automatisch extrahiert und mit den LV-Positionen verknüpft.
                </p>
              </div>

              {/* One-click quick load for demo files */}
              <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-xl p-3.5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-sm">
                <div className="flex items-center space-x-2.5">
                  <div className="w-8 h-8 rounded-lg bg-[#3B82C4]/10 flex items-center justify-center shrink-0">
                    <Sparkles className="w-4 h-4 text-[#3B82C4]" />
                  </div>
                  <div>
                    <span className="text-xs font-bold text-slate-800 block">
                      Muster-Vorhabendaten direkt laden (Multi-Plan Demo)
                    </span>
                    <span className="text-[11px] text-slate-500 block">
                      Lädt automatisch <code className="text-[#3B82C4]">EG-Montageplan.dxf</code>, <code className="text-[#3B82C4]">UG-Technik.dxf</code> & <code className="text-[#2FA36B]">.x81 LV</code>
                    </span>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={handleLoadEfhSamples}
                  disabled={loading}
                  className="inline-flex items-center space-x-1.5 bg-[#3B82C4] hover:bg-[#2B6EB0] text-white text-xs font-bold px-3.5 py-2 rounded-lg shadow-sm transition-all hover:scale-[1.02] shrink-0 self-stretch sm:self-auto justify-center disabled:opacity-50"
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>Musterdaten einlesen</span>
                </button>
              </div>

              {/* Upload Progress Banner if active */}
              {loading && uploadStatusText && (
                <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 text-xs text-blue-800 space-y-2 animate-in fade-in">
                  <div className="flex items-center space-x-2 font-bold">
                    <Loader2 className="w-4 h-4 animate-spin text-[#3B82C4]" />
                    <span>{uploadStatusText}</span>
                  </div>
                  {Object.entries(uploadProgress).map(([pid, pct]) => {
                    const plan = uploadedPlans.find(p => p.id === pid);
                    return (
                      <div key={pid} className="space-y-1">
                        <div className="flex justify-between text-[11px] text-slate-600">
                          <span className="truncate max-w-xs">{plan?.name || pid}</span>
                          <span className="font-mono font-bold">{pct}%</span>
                        </div>
                        <div className="w-full bg-slate-200 rounded-full h-1.5 overflow-hidden">
                          <div 
                            className="bg-[#3B82C4] h-1.5 rounded-full transition-all duration-200" 
                            style={{ width: `${pct}%` }} 
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* ========================================================= */}
              {/* BEREICH A: LEISTUNGSVERZEICHNIS (Single-Upload)           */}
              {/* ========================================================= */}
              <div className="bg-white rounded-xl border border-slate-200 p-4 space-y-3 shadow-xs">
                <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
                  <div className="flex items-center space-x-2">
                    <span className="w-6 h-6 rounded-lg bg-blue-100 text-[#3B82C4] font-bold text-xs flex items-center justify-center">
                      A
                    </span>
                    <div>
                      <h4 className="text-xs font-bold text-slate-900">
                        Bereich A: Leistungsverzeichnis (GAEB / Excel / Datenbasis)
                      </h4>
                      <p className="text-[11px] text-slate-500">
                        Primäre Materialliste (.x81, .x83, .d83, .xml, .xlsx, .csv)
                      </p>
                    </div>
                  </div>

                  {parsedPositions.length > 0 && (
                    <span className="text-[10px] font-bold text-emerald-800 bg-emerald-100 border border-emerald-300 px-2 py-0.5 rounded-full">
                      {parsedPositions.length} LV-Positionen
                    </span>
                  )}
                </div>

                <div className={`p-4 rounded-xl border-2 transition-all ${
                  gaebStatus === 'success' ? 'border-emerald-400 bg-emerald-50/30' : 'border-dashed border-slate-300 bg-slate-50'
                }`}>
                  <label className="flex flex-col items-center justify-center p-4 bg-white border border-slate-200 rounded-xl cursor-pointer hover:border-[#3B82C4] transition-all group text-center">
                    <FileCode className="w-8 h-8 text-slate-400 group-hover:text-[#3B82C4] mb-1.5" />
                    <span className="text-xs font-bold text-slate-800 block">
                      {gaebFileName || 'Leistungsverzeichnis auswählen oder hierher ziehen'}
                    </span>
                    <span className="text-[10px] text-slate-400 block mt-0.5">
                      Unterstützt .x81, .x83, .d83, .xml, .xlsx, .csv
                    </span>
                    <input
                      type="file"
                      accept=".x81,.x82,.x83,.x84,.x85,.x86,.d83,.xml,.xlsx,.xls,.csv"
                      onChange={handleGaebChange}
                      className="hidden"
                    />
                  </label>

                  {gaebMessage && (
                    <p className={`text-xs mt-2 font-medium ${gaebStatus === 'success' ? 'text-emerald-700' : 'text-red-600'}`}>
                      {gaebMessage}
                    </p>
                  )}

                  {/* Position snippet */}
                  {parsedPositions.length > 0 && (
                    <div className="mt-3 bg-white rounded-lg p-2.5 border border-slate-200 text-[11px] font-mono divide-y divide-slate-100 max-h-24 overflow-y-auto">
                      {parsedPositions.slice(0, 3).map((p, idx) => (
                        <div key={idx} className="py-1 flex justify-between text-slate-600">
                          <span className="font-bold text-[#3B82C4]">{p.posNr}</span>
                          <span className="truncate max-w-xs">{p.shortText}</span>
                          <span className="text-slate-500 shrink-0">{p.qty} {p.qu}</span>
                        </div>
                      ))}
                      {parsedPositions.length > 3 && (
                        <div className="py-1 text-center text-slate-400 italic font-sans text-[10px]">
                          + {parsedPositions.length - 3} weitere Positionen
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>

              {/* ========================================================= */}
              {/* BEREICH B: MONTAGE- & AUSFÜHRUNGSPLÄNE (Multi-Upload)     */}
              {/* ========================================================= */}
              <div className="bg-white rounded-xl border border-slate-200 p-4 space-y-3 shadow-xs">
                <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
                  <div className="flex items-center space-x-2">
                    <span className="w-6 h-6 rounded-lg bg-emerald-100 text-emerald-700 font-bold text-xs flex items-center justify-center">
                      B
                    </span>
                    <div>
                      <h4 className="text-xs font-bold text-slate-900">
                        Bereich B: Montage- & Ausführungspläne (Multi-Upload)
                      </h4>
                      <p className="text-[11px] text-slate-500">
                        Mehrere CAD-Pläne für UG, EG, OG, Strangschema etc. (.dwg, .dxf, .pdf)
                      </p>
                    </div>
                  </div>

                  <span className="text-[10px] font-bold text-blue-800 bg-blue-100 border border-blue-300 px-2.5 py-0.5 rounded-full">
                    {uploadedPlans.length} {uploadedPlans.length === 1 ? 'Plan' : 'Pläne'} hinterlegt
                  </span>
                </div>

                {/* Multi-Dropzone */}
                <div 
                  onDragOver={(e) => { e.preventDefault(); setIsDraggingPlans(true); }}
                  onDragLeave={() => setIsDraggingPlans(false)}
                  onDrop={(e) => {
                    e.preventDefault();
                    setIsDraggingPlans(false);
                    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
                      handleAddPlanFiles(e.dataTransfer.files);
                    }
                  }}
                  className={`p-4 rounded-xl border-2 border-dashed transition-all text-center ${
                    isDraggingPlans 
                      ? 'border-[#3B82C4] bg-blue-50/50 scale-[1.01]' 
                      : 'border-slate-300 bg-slate-50 hover:bg-slate-100/60'
                  }`}
                >
                  <label className="flex flex-col items-center justify-center cursor-pointer group py-2">
                    <UploadCloud className="w-8 h-8 text-slate-400 group-hover:text-[#3B82C4] mb-1.5 transition-colors" />
                    <span className="text-xs font-bold text-slate-800 block">
                      Mehrere Plan-Dateien auswählen oder hierher ziehen
                    </span>
                    <span className="text-[10px] text-slate-400 block mt-0.5">
                      AutoCAD (.dwg), DXF (.dxf) oder exportierte Montage-PDFs (.pdf)
                    </span>
                    <input
                      type="file"
                      multiple
                      accept=".dwg,.dxf,.pdf"
                      onChange={(e) => {
                        if (e.target.files && e.target.files.length > 0) {
                          handleAddPlanFiles(e.target.files);
                        }
                      }}
                      className="hidden"
                    />
                  </label>
                </div>

                {/* Uploaded Plans List with Level Dropdowns and Room Counts */}
                {uploadedPlans.length > 0 && (
                  <div className="space-y-2 pt-1">
                    <div className="flex items-center justify-between text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                      <span>Hochgeladene Pläne & Ebenen-Zuordnung:</span>
                      <span>{uploadedPlans.length} Dateien</span>
                    </div>

                    <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
                      {uploadedPlans.map((plan) => {
                        const isCad = plan.fileType === 'dwg' || plan.fileType === 'dxf';
                        const formatSize = (bytes: number) => {
                          if (bytes < 1024) return `${bytes} B`;
                          if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
                          return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
                        };

                        return (
                          <div 
                            key={plan.id}
                            className="bg-white p-3 rounded-xl border border-slate-200 hover:border-slate-300 transition-colors flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-xs"
                          >
                            <div className="flex items-center space-x-3 min-w-0">
                              <div className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 font-bold text-xs ${
                                plan.fileType === 'pdf' 
                                  ? 'bg-rose-100 text-rose-700' 
                                  : 'bg-blue-100 text-[#3B82C4]'
                              }`}>
                                {plan.fileType === 'pdf' ? (
                                  <FileText className="w-5 h-5" />
                                ) : (
                                  <Compass className="w-5 h-5" />
                                )}
                              </div>

                              <div className="min-w-0">
                                <div className="flex items-center space-x-2">
                                  <span className="text-xs font-bold text-slate-800 truncate max-w-xs sm:max-w-sm block">
                                    {plan.name}
                                  </span>
                                  <span className="text-[10px] font-mono text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded uppercase shrink-0">
                                    {plan.fileType}
                                  </span>
                                </div>
                                <div className="flex items-center space-x-2 text-[11px] text-slate-500 mt-0.5">
                                  <span>{formatSize(plan.size)}</span>
                                  <span>•</span>
                                  <span className="text-emerald-700 font-semibold">
                                    {isCad ? `${plan.detectedRoomsCount} Räume extrahiert` : 'Plan-Unterlage'}
                                  </span>
                                </div>
                              </div>
                            </div>

                            <div className="flex items-center space-x-2 shrink-0 self-end sm:self-auto">
                              {/* Ebene / Typ Dropdown */}
                              <div className="flex items-center space-x-1.5">
                                <span className="text-[11px] font-semibold text-slate-500 hidden sm:inline">
                                  Ebene:
                                </span>
                                <select
                                  value={plan.level}
                                  onChange={(e) => handlePlanLevelChange(plan.id, e.target.value as PlanLevel)}
                                  className="text-xs font-semibold bg-slate-50 border border-slate-300 rounded-lg px-2.5 py-1.5 text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#3B82C4]"
                                >
                                  <option value="UG">UG (Untergeschoss)</option>
                                  <option value="EG">EG (Erdgeschoss)</option>
                                  <option value="OG">OG (Obergeschoss)</option>
                                  <option value="DG">DG (Dachgeschoss)</option>
                                  <option value="Strangschema">Strangschema / Isometrie</option>
                                  <option value="Sonstiges">Sonstiges</option>
                                </select>
                              </div>

                              {/* Remove Button */}
                              <button
                                type="button"
                                onClick={() => handleRemovePlan(plan.id)}
                                className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                                title="Plan entfernen"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {dwgMessage && (
                  <p className={`text-xs font-medium pt-1 ${dwgStatus === 'success' ? 'text-emerald-700' : 'text-red-600'}`}>
                    {dwgMessage}
                  </p>
                )}
              </div>

              {/* ========================================================= */}
              {/* VORSCHAU DER SYNTHETISIERTEN RAUMLISTE                     */}
              {/* ========================================================= */}
              {dwgRooms.length > 0 && (
                <div className="bg-slate-50 rounded-xl border border-slate-200 p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="text-xs font-bold text-slate-800 flex items-center space-x-1.5">
                        <Layers className="w-4 h-4 text-[#3B82C4]" />
                        <span>Vorschau: Zusammengestellte Raumliste ({dwgRooms.length} Räume)</span>
                      </h4>
                      <p className="text-[11px] text-slate-500">
                        Synthese aus allen hochgeladenen Plänen mit automatischer LV-Materialzuordnung
                      </p>
                    </div>

                    <span className="text-[10px] font-bold text-emerald-800 bg-emerald-100 border border-emerald-300 px-2 py-0.5 rounded-full">
                      {dwgRooms.reduce((acc, r) => acc + (r.materials?.length || 0), 0)} Positionen zugeordnet
                    </span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2.5 max-h-52 overflow-y-auto pr-1">
                    {dwgRooms.map((room) => {
                      const matCount = room.materials?.length || 0;
                      return (
                        <div 
                          key={room.id}
                          className="bg-white p-2.5 rounded-lg border border-slate-200 shadow-2xs space-y-1"
                        >
                          <div className="flex items-center justify-between">
                            <span className="font-mono font-bold text-[11px] text-[#3B82C4] bg-blue-50 px-1.5 py-0.5 rounded">
                              {room.code}
                            </span>
                            <span className="text-[10px] font-semibold text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded">
                              {room.floor}
                            </span>
                          </div>

                          <span className="text-xs font-bold text-slate-800 block truncate" title={room.name}>
                            {room.name}
                          </span>

                          <div className="flex items-center justify-between text-[10px] text-slate-500 pt-0.5 border-t border-slate-100">
                            <span className="text-emerald-700 font-semibold">
                              {matCount} LV-Positionen
                            </span>
                            {room.sourcePlanFileName && (
                              <span className="truncate max-w-[100px] text-slate-400" title={room.sourcePlanFileName}>
                                {room.sourcePlanFileName}
                              </span>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Summary Box */}
              <div className="bg-slate-100 p-4 rounded-xl border border-slate-200 text-xs space-y-1.5">
                <span className="font-bold text-slate-800 block uppercase tracking-wider text-[11px]">
                  Projekt-Zusammenfassung
                </span>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1 text-slate-600">
                  <div>Projekt: <strong className="text-slate-900 block truncate">{name}</strong></div>
                  <div>Projektleiter: <strong className="text-slate-900 block truncate">{projectManager}</strong></div>
                  <div>LV: <strong className="text-slate-900 block truncate">{parsedPositions.length} Positionen</strong></div>
                  <div>Pläne: <strong className="text-slate-900 block">{uploadedPlans.length} Pläne ({dwgRooms.length} Räume)</strong></div>
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

          <div className="flex items-center space-x-3">
            {loading && uploadStatusText && (
              <div className="flex items-center space-x-2 text-xs font-semibold text-blue-700 bg-blue-50 px-3.5 py-1.5 rounded-xl border border-blue-200 animate-in fade-in">
                <Loader2 className="w-3.5 h-3.5 animate-spin text-[#3B82C4]" />
                <span className="truncate max-w-xs">{uploadStatusText}</span>
              </div>
            )}

            <button
              type="button"
              disabled={loading}
              onClick={onClose}
              className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-500 hover:text-slate-700 disabled:opacity-40"
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
                className="flex items-center space-x-2 bg-[#2FA36B] hover:bg-[#258757] text-white px-6 py-2.5 rounded-xl text-xs font-bold shadow-md shadow-emerald-600/20 transition-all hover:scale-[1.02] active:scale-[0.98] disabled:opacity-60"
              >
                {loading ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <CheckCircle2 className="w-4 h-4" />
                )}
                <span>{loading ? 'Projekt wird erstellt...' : 'Projekt verbindlich anlegen'}</span>
              </button>
            )}
          </div>
        </div>

      </div>
    </div>
  );
};
