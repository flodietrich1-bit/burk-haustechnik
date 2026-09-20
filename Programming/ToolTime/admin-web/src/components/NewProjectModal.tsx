import React, { useState } from 'react';
import { 
  X, UploadCloud, FileCode, CheckCircle2, Calendar, MapPin, Building, Wrench, User, ArrowRight,
  Compass, Info, Sparkles, Download, Loader2
} from 'lucide-react';
import { parseGaebFile } from '../services/gaebParser';
import { parseDwgFile } from '../services/dwgParser';
import { createProject } from '../services/firestoreService';
import type { Project, Position, Room } from '../types';

interface NewProjectModalProps {
  isOpen: boolean;
  onClose: () => void;
  onProjectCreated: (newProjectId: string) => void;
}

export const NewProjectModal: React.FC<NewProjectModalProps> = ({
  isOpen,
  onClose,
  onProjectCreated
}) => {
  // GAEB State
  const [gaebFileName, setGaebFileName] = useState<string>('');
  const [parsedPositions, setParsedPositions] = useState<Partial<Position>[]>([]);
  const [gaebStatus, setGaebStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [gaebMessage, setGaebMessage] = useState<string>('');

  // DWG / DXF State
  const [dwgFileObj, setDwgFileObj] = useState<File | null>(null);
  const [dwgFileName, setDwgFileName] = useState<string>('');
  const [dwgRooms, setDwgRooms] = useState<Room[]>([]);
  const [dwgStatus, setDwgStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [dwgMessage, setDwgMessage] = useState<string>('');
  const [dwgFormatInfo, setDwgFormatInfo] = useState<string>('');

  const [loading, setLoading] = useState<boolean>(false);
  const [loadingDemo, setLoadingDemo] = useState<string | null>(null);

  // Form Fields
  const [name, setName] = useState<string>('');
  const [projectNumber, setProjectNumber] = useState<string>('');
  const [trade, setTrade] = useState<string>('Sanitärinstallation');
  const [location, setLocation] = useState<string>('');
  const [address, setAddress] = useState<string>('');
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');
  const [client, setClient] = useState<string>('');
  const [projectManager, setProjectManager] = useState<string>('Florian Buck');
  const [status, setStatus] = useState<'draft' | 'in_progress'>('in_progress');

  if (!isOpen) return null;

  // 1. Handle GAEB Upload
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
        setGaebMessage(`${result.positions.length} LV-Positionen aus ${file.name} extrahiert!`);

        // Prefill Form Fields from GAEB Metadata
        if (result.metadata.projectName) setName(result.metadata.projectName);
        if (result.metadata.projectNumber) setProjectNumber(result.metadata.projectNumber);
        if (result.metadata.trade) setTrade(result.metadata.trade);
        if (result.metadata.location) setLocation(result.metadata.location);
        if (result.metadata.client) setClient(result.metadata.client);
        if (result.metadata.startDate) setStartDate(result.metadata.startDate);
        if (result.metadata.endDate) setEndDate(result.metadata.endDate);

        if (result.metadata.location && !address) {
          setAddress(`Baustelle ${result.metadata.location}`);
        }

        // If DWG/DXF was already loaded, remap materials with newly parsed GAEB positions!
        if (dwgFileObj) {
          const updatedDwg = await parseDwgFile(dwgFileObj, result.positions);
          setDwgRooms(updatedDwg.rooms);
          const totalAssigned = updatedDwg.rooms.reduce((acc, r) => acc + (r.materials?.length || 0), 0);
          setDwgMessage(`${updatedDwg.rooms.length} Räume aus CAD-Plan extrahiert und ${totalAssigned} Materialzuordnungen hinterlegt!`);
        }
      } catch (err: any) {
        setGaebStatus('error');
        setGaebMessage('Fehler beim Einlesen: ' + (err.message || 'Ungültiges Dateiformat.'));
      }
    };

    if (file.name.toLowerCase().endsWith('.d83')) {
      reader.readAsText(file, 'ISO-8859-1');
    } else {
      reader.readAsText(file, 'UTF-8');
    }
  };

  // 2. Handle DWG / DXF Upload
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
      setDwgFormatInfo(result.cadFormat);

      const totalMaterialsAssigned = result.rooms.reduce((acc, r) => acc + (r.materials?.length || 0), 0);
      setDwgMessage(
        `${result.rooms.length} Räume aus CAD-Plan extrahiert und ${totalMaterialsAssigned} Materialzuordnungen hinterlegt!`
      );
    } catch (err: any) {
      setDwgStatus('error');
      setDwgMessage('Fehler beim Analysieren der DWG-Datei: ' + (err.message || 'Format nicht lesbar.'));
    }
  };

  // 3. Load 1-Click Demo Pair
  const loadDemoPair = async (type: 'efh' | 'hallenbad') => {
    setLoadingDemo(type);
    try {
      const gaebUrl = type === 'efh'
        ? '/samples/Sanitaer_Demo_Projekt_EFH_X81.x81'
        : '/samples/24316-044 LV Sanitär HBW.X81';
      const dxfUrl = type === 'efh'
        ? '/samples/Sanitaer_Demo_Projekt_EFH.dxf'
        : '/samples/Hallenbad_Weingarten_Plan.dxf';

      // Load GAEB
      const gaebResp = await fetch(gaebUrl);
      const gaebText = await gaebResp.text();
      const detectedGaebName = gaebUrl.split('/').pop() || 'demo.x81';
      const gaebResult = parseGaebFile(gaebText, detectedGaebName);

      setGaebFileName(detectedGaebName);
      setParsedPositions(gaebResult.positions);
      setGaebStatus('success');
      setGaebMessage(`${gaebResult.positions.length} LV-Positionen geladen!`);

      if (gaebResult.metadata.projectName) setName(gaebResult.metadata.projectName);
      if (gaebResult.metadata.projectNumber) setProjectNumber(gaebResult.metadata.projectNumber);
      if (gaebResult.metadata.trade) setTrade(gaebResult.metadata.trade);
      if (gaebResult.metadata.location) setLocation(gaebResult.metadata.location);
      if (gaebResult.metadata.client) setClient(gaebResult.metadata.client);
      if (gaebResult.metadata.startDate) setStartDate(gaebResult.metadata.startDate);
      if (gaebResult.metadata.endDate) setEndDate(gaebResult.metadata.endDate);
      if (gaebResult.metadata.location) setAddress(`Baustelle ${gaebResult.metadata.location}`);

      // Load DXF
      const dxfResp = await fetch(dxfUrl);
      const dxfBlob = await dxfResp.blob();
      const detectedCadName = dxfUrl.split('/').pop() || 'plan.dxf';
      const cadFile = new File([dxfBlob], detectedCadName, { type: 'application/dxf' });

      setDwgFileObj(cadFile);
      setDwgFileName(detectedCadName);

      const cadResult = await parseDwgFile(cadFile, gaebResult.positions);
      setDwgRooms(cadResult.rooms);
      setDwgStatus('success');
      setDwgFormatInfo(cadResult.cadFormat);

      const totalAssigned = cadResult.rooms.reduce((acc, r) => acc + (r.materials?.length || 0), 0);
      setDwgMessage(
        `${cadResult.rooms.length} Räume aus CAD-Plan extrahiert und ${totalAssigned} Materialzuordnungen hinterlegt!`
      );
    } catch (err: any) {
      console.error('Fehler beim Demo-Laden:', err);
      alert('Fehler beim Laden der Demo-Dateien: ' + err.message);
    } finally {
      setLoadingDemo(null);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    setLoading(true);

    const safeId = name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '') || `prj-${Date.now()}`;

    const hasDwg = dwgRooms.length > 0;

    const newProject: Project = {
      id: safeId,
      name: name.trim(),
      projectNumber: projectNumber.trim() || 'P-' + Math.floor(1000 + Math.random() * 9000),
      trade: trade.trim() || 'Haustechnik',
      client: client.trim() || 'Auftraggeber',
      location: location.trim() || 'Deutschland',
      address: address.trim() || undefined,
      startDate: startDate || undefined,
      endDate: endDate || undefined,
      projectManager: projectManager.trim() || 'Bauleiter',
      status: status,
      currency: 'EUR',
      totalPositions: parsedPositions.length,
      totalDeliveredPercentage: 0,
      hasDwg: hasDwg,
      dwgFileName: hasDwg ? dwgFileName : undefined,
      createdAt: new Date().toISOString()
    };

    // Rooms logic according to user specification:
    // If DWG present: take exact rooms and mapped materials from DWG
    // If only GAEB present: no DWG rooms, Bauleiter creates rooms manually later (or 0 rooms initially)
    let finalRooms: Room[] = [];
    if (hasDwg) {
      finalRooms = dwgRooms.map(r => ({
        ...r,
        id: `${safeId}_${r.id}`
      }));
    }

    try {
      await createProject(newProject, parsedPositions, finalRooms);
      setLoading(false);
      onProjectCreated(newProject.id);
      onClose();
    } catch (err: any) {
      setLoading(false);
      alert('Fehler beim Anlegen: ' + err.message);
    }
  };

  const totalAssignedMaterialsCount = dwgRooms.reduce((sum, r) => sum + (r.materials?.length || 0), 0);

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/70 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl max-w-3xl w-full p-6 sm:p-8 shadow-2xl border border-slate-100 relative my-8 animate-in fade-in zoom-in-95 duration-200">
        
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute right-4 top-4 text-slate-400 hover:text-slate-600 p-1.5 rounded-lg transition-colors"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Modal Header */}
        <div className="flex items-center space-x-3 mb-6">
          <div className="w-12 h-12 rounded-xl bg-gradient-to-tr from-[#3B82C4] to-[#2FA36B] text-white flex items-center justify-center shadow-lg shadow-blue-500/20">
            <Building className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-slate-900">Neues Projekt anlegen</h2>
            <p className="text-xs text-slate-500">
              GAEB-Ausschreibung für Positionen & optionale DWG- / DXF-Datei für automatische Raum- und Materialverortung
            </p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          
          {/* Quick Demo-Files Bar */}
          <div className="bg-gradient-to-r from-blue-50/90 via-emerald-50/70 to-blue-50/90 border border-blue-200/80 rounded-xl p-3.5 shadow-sm">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <span className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                  <Sparkles className="w-4 h-4 text-blue-600 animate-pulse" />
                  Passende Beispieldateien (GAEB & DXF-Pläne)
                </span>
                <p className="text-[11px] text-slate-600 mt-0.5">
                  Sofort mit echten Testdaten ausprobieren oder herunterladen:
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => loadDemoPair('efh')}
                  disabled={loadingDemo !== null}
                  className="px-3 py-1.5 bg-white hover:bg-blue-50 border border-blue-300 rounded-lg text-xs font-bold text-blue-800 shadow-sm flex items-center gap-1.5 transition-all hover:scale-[1.02] active:scale-95 disabled:opacity-50"
                  title="EFH Demo: GAEB X81 + passender DXF-Plan mit 5 Räumen"
                >
                  {loadingDemo === 'efh' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <span>🏡</span>}
                  <span>EFH Demo einfügen</span>
                </button>
                <button
                  type="button"
                  onClick={() => loadDemoPair('hallenbad')}
                  disabled={loadingDemo !== null}
                  className="px-3 py-1.5 bg-white hover:bg-emerald-50 border border-emerald-300 rounded-lg text-xs font-bold text-emerald-800 shadow-sm flex items-center gap-1.5 transition-all hover:scale-[1.02] active:scale-95 disabled:opacity-50"
                  title="Hallenbad Weingarten: 251 GAEB-Positionen + DXF-Plan mit 9 Räumen"
                >
                  {loadingDemo === 'hallenbad' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <span>🏊</span>}
                  <span>Hallenbad Weingarten einfügen</span>
                </button>
              </div>
            </div>

            {/* Direct Download Links */}
            <div className="mt-2.5 pt-2 border-t border-blue-200/50 flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-slate-600">
              <span className="font-semibold text-slate-700 flex items-center gap-1">
                <Download className="w-3 h-3 text-slate-500" />
                Dateien für manuellen Upload herunterladen:
              </span>
              <a 
                href="/samples/Sanitaer_Demo_Projekt_EFH.dxf" 
                download="Sanitaer_Demo_Projekt_EFH.dxf"
                className="text-emerald-700 hover:underline font-medium flex items-center gap-0.5"
              >
                📐 EFH Plan (.dxf)
              </a>
              <a 
                href="/samples/Sanitaer_Demo_Projekt_EFH_X81.x81" 
                download="Sanitaer_Demo_Projekt_EFH_X81.x81"
                className="text-blue-700 hover:underline font-medium flex items-center gap-0.5"
              >
                📄 EFH GAEB (.x81)
              </a>
              <span className="text-slate-300">|</span>
              <a 
                href="/samples/Hallenbad_Weingarten_Plan.dxf" 
                download="Hallenbad_Weingarten_Plan.dxf"
                className="text-emerald-700 hover:underline font-medium flex items-center gap-0.5"
              >
                📐 Hallenbad Plan (.dxf)
              </a>
              <a 
                href="/samples/24316-044 LV Sanitär HBW.X81" 
                download="24316-044 LV Sanitär HBW.X81"
                className="text-blue-700 hover:underline font-medium flex items-center gap-0.5"
              >
                📄 Hallenbad GAEB (.X81)
              </a>
            </div>
          </div>

          {/* Step 1: Two File Upload Sections (1. DWG / DXF & 2. GAEB) */}
          <div className="space-y-3">
            <div className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center space-x-1.5 border-b border-slate-100 pb-2">
              <UploadCloud className="w-4 h-4 text-[#2FA36B]" />
              <span>Schritt 1: Dateien hochladen (1. CAD-Plan für Räume & 2. GAEB für Materialien)</span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              
              {/* File 1: DWG / DXF Upload Box (Räume zuerst) */}
              <div className="bg-slate-50 rounded-xl p-4 border border-slate-200 space-y-2 flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-xs font-bold text-slate-800 flex items-center space-x-1.5">
                      <Compass className="w-4 h-4 text-[#2FA36B]" />
                      <span>1. CAD-Plan (DWG / DXF)</span>
                    </span>
                    <span className="text-[10px] bg-emerald-100 text-emerald-800 font-bold px-2 py-0.5 rounded">
                      Räume & Örtlichkeit
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-500 mb-3">
                    Extrahiert Räume & Einbauorte des Gebäudes (.dwg, .dxf)
                  </p>
                </div>

                <div className="border-2 border-dashed border-slate-300 hover:border-[#2FA36B] rounded-xl p-3 text-center bg-white cursor-pointer relative transition-all">
                  <input
                    type="file"
                    accept=".dwg,.dxf"
                    onChange={handleDwgChange}
                    className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
                  />
                  <Compass className="w-6 h-6 text-slate-400 mx-auto mb-1" />
                  <p className="text-xs font-semibold text-slate-700 truncate">
                    {dwgFileName ? dwgFileName : '1. CAD-Plan auswählen (.dwg, .dxf)'}
                  </p>
                  <p className="text-[10px] text-slate-400">AutoCAD DWG oder offenes DXF-Format</p>
                </div>

                {dwgStatus === 'success' && (
                  <div className="p-2 bg-emerald-50 border border-emerald-200 rounded-lg text-[11px] text-emerald-800 flex items-center space-x-1.5 mt-2">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                    <span className="font-semibold truncate">{dwgMessage}</span>
                  </div>
                )}
                {dwgStatus === 'error' && (
                  <div className="p-2 bg-red-50 border border-red-200 rounded-lg text-[11px] text-red-700 font-medium mt-2">
                    {dwgMessage}
                  </div>
                )}
              </div>

              {/* File 2: GAEB Upload Box (Materialien danach) */}
              <div className="bg-slate-50 rounded-xl p-4 border border-slate-200 space-y-2 flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-xs font-bold text-slate-800 flex items-center space-x-1.5">
                      <FileCode className="w-4 h-4 text-[#3B82C4]" />
                      <span>2. GAEB-Ausschreibung</span>
                    </span>
                    <span className="text-[10px] bg-blue-100 text-blue-800 font-semibold px-2 py-0.5 rounded">
                      LV & Materialien
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-500 mb-3">
                    Liefert alle 250+ LV-Positionen, Mengen, Einheiten & Preise (.X81, .D83, .xml)
                  </p>
                </div>

                <div className="border-2 border-dashed border-slate-300 hover:border-[#3B82C4] rounded-xl p-3 text-center bg-white cursor-pointer relative transition-all">
                  <input
                    type="file"
                    accept=".x81,.d83,.xml,.txt"
                    onChange={handleGaebChange}
                    className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
                  />
                  <FileCode className="w-6 h-6 text-slate-400 mx-auto mb-1" />
                  <p className="text-xs font-semibold text-slate-700 truncate">
                    {gaebFileName ? gaebFileName : '2. GAEB-Datei auswählen (.x81, .d83)'}
                  </p>
                  <p className="text-[10px] text-slate-400">Klicken oder reinziehen</p>
                </div>

                {gaebStatus === 'success' && (
                  <div className="p-2 bg-emerald-50 border border-emerald-200 rounded-lg text-[11px] text-emerald-800 flex items-center space-x-1.5 mt-2">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                    <span className="font-semibold truncate">{gaebMessage}</span>
                  </div>
                )}
                {gaebStatus === 'error' && (
                  <div className="p-2 bg-red-50 border border-red-200 rounded-lg text-[11px] text-red-700 font-medium mt-2">
                    {gaebMessage}
                  </div>
                )}
              </div>

            </div>

            {/* Workflow Logic Explanation Banner */}
            {dwgRooms.length > 0 ? (
              <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl flex items-start space-x-2.5 text-xs text-emerald-900">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                <div>
                  <strong className="font-bold">CAD-Plan aktiv ({dwgFormatInfo}): </strong>
                  Es wurden <strong className="underline">{dwgRooms.length} Räume</strong> erkannt. 
                  Für jeden Raum wurden die passenden Materialien hinterlegt (insgesamt <strong>{totalAssignedMaterialsCount} Zuordnungen</strong>). 
                  Der Monteur sieht später in der App direkt die Materialliste je Raum!
                </div>
              </div>
            ) : (
              <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl flex items-start space-x-2.5 text-xs text-amber-900">
                <Info className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                <div>
                  <strong className="font-bold">Nur GAEB vorhanden (Keine DWG / DXF): </strong>
                  Die Baustellen-Räume werden nicht automatisch aus CAD erzeugt. 
                  Der Bauleiter legt die Räume im Anschluss selbst im <em>Raum-Konfigurator</em> an und ordnet die Materialien manuell zu.
                </div>
              </div>
            )}

            {/* Preview of DWG extracted rooms if present */}
            {dwgRooms.length > 0 && (
              <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 space-y-2">
                <div className="flex items-center justify-between text-[11px] font-bold text-slate-700">
                  <span>Extrahierte Räume & Materialzuordnung:</span>
                  <span className="text-[#2FA36B]">{dwgRooms.length} Räume</span>
                </div>
                <div className="max-h-32 overflow-y-auto divide-y divide-slate-200 text-xs bg-white rounded-lg p-2 border border-slate-200">
                  {dwgRooms.map((room) => (
                    <div key={room.id} className="py-1 flex items-center justify-between">
                      <div className="flex items-center space-x-2">
                        <span className="font-mono font-bold text-slate-700 bg-slate-100 px-1.5 py-0.5 rounded text-[10px]">
                          {room.code}
                        </span>
                        <span className="font-semibold text-slate-800">{room.name}</span>
                        <span className="text-[10px] text-slate-400">({room.floor})</span>
                      </div>
                      <span className="text-[11px] text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded font-medium">
                        {room.materials?.length || 0} Materialien hinterlegt
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Step 2: Project Basics Form */}
          <div className="space-y-4 pt-2">
            <div className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center space-x-1.5 border-b border-slate-100 pb-2">
              <Wrench className="w-4 h-4 text-[#3B82C4]" />
              <span>Schritt 2: Projekt-Basics & Stammdaten</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
              {/* Project Name */}
              <div className="sm:col-span-2">
                <label className="block font-semibold text-slate-700 mb-1">
                  Projektname / Baumaßnahme <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="z.B. Hallenbad Weingarten Sanierung"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#3B82C4]"
                />
              </div>

              {/* Project Number */}
              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Projektnummer / Kennung
                </label>
                <input
                  type="text"
                  placeholder="z.B. 1638 / 24316-044"
                  value={projectNumber}
                  onChange={(e) => setProjectNumber(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#3B82C4]"
                />
              </div>

              {/* Trade (Gewerk) */}
              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Gewerk
                </label>
                <input
                  type="text"
                  placeholder="z.B. Sanitärinstallation oder Heizung"
                  value={trade}
                  onChange={(e) => setTrade(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#3B82C4]"
                />
              </div>

              {/* Location (Ort) */}
              <div>
                <label className="block font-semibold text-slate-700 mb-1 flex items-center space-x-1">
                  <MapPin className="w-3.5 h-3.5 text-slate-400" />
                  <span>Baustellen-Standort (Ort)</span>
                </label>
                <input
                  type="text"
                  placeholder="z.B. Weingarten, Ravensburg, Bavendorf"
                  value={location}
                  onChange={(e) => setLocation(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#3B82C4]"
                />
              </div>

              {/* Exact Address */}
              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Genaue Adresse (Straße, PLZ, Ort)
                </label>
                <input
                  type="text"
                  placeholder="z.B. Brechenmacherstraße 11, 88250 Weingarten"
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#3B82C4]"
                />
              </div>

              {/* Start Date */}
              <div>
                <label className="block font-semibold text-slate-700 mb-1 flex items-center space-x-1">
                  <Calendar className="w-3.5 h-3.5 text-slate-400" />
                  <span>Startdatum (Von wann)</span>
                </label>
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#3B82C4]"
                />
              </div>

              {/* End Date */}
              <div>
                <label className="block font-semibold text-slate-700 mb-1 flex items-center space-x-1">
                  <Calendar className="w-3.5 h-3.5 text-slate-400" />
                  <span>Fertigstellung (Bis wann)</span>
                </label>
                <input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#3B82C4]"
                />
              </div>

              {/* Client */}
              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Auftraggeber / Kunde
                </label>
                <input
                  type="text"
                  placeholder="z.B. Stadt Weingarten"
                  value={client}
                  onChange={(e) => setClient(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#3B82C4]"
                />
              </div>

              {/* Project Manager */}
              <div>
                <label className="block font-semibold text-slate-700 mb-1 flex items-center space-x-1">
                  <User className="w-3.5 h-3.5 text-slate-400" />
                  <span>Zuständiger Bauleiter</span>
                </label>
                <input
                  type="text"
                  placeholder="z.B. Florian Buck"
                  value={projectManager}
                  onChange={(e) => setProjectManager(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#3B82C4]"
                />
              </div>

              {/* Status */}
              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Projektstatus
                </label>
                <select
                  value={status}
                  onChange={(e) => setStatus(e.target.value as 'draft' | 'in_progress')}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#3B82C4]"
                >
                  <option value="in_progress">In Ausführung (Aktiv)</option>
                  <option value="draft">In Planung / Vorbereitung</option>
                </select>
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className="pt-4 border-t border-slate-100 flex items-center justify-between">
            <div className="text-xs text-slate-500">
              {parsedPositions.length > 0 && (
                <span className="font-semibold text-emerald-600 mr-2">
                  ✓ {parsedPositions.length} Positionen
                </span>
              )}
              {dwgRooms.length > 0 && (
                <span className="font-semibold text-blue-600">
                  ✓ {dwgRooms.length} Räume (DWG / DXF)
                </span>
              )}
            </div>

            <div className="flex items-center space-x-3">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-800 transition-colors"
              >
                Abbrechen
              </button>

              <button
                type="submit"
                disabled={loading || !name.trim()}
                className="flex items-center space-x-2 bg-[#3B82C4] hover:bg-[#2B6EB0] disabled:bg-slate-300 text-white px-5 py-2.5 rounded-xl text-xs font-bold transition-all shadow-md shadow-blue-500/20"
              >
                {loading ? (
                  <span>Wird angelegt...</span>
                ) : (
                  <>
                    <span>Projekt anlegen & aktivieren</span>
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>
            </div>
          </div>

        </form>
      </div>
    </div>
  );
};
