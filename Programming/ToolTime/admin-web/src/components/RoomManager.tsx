import React, { useState, useEffect } from 'react';
import type { Room, Position, Booking, RoomMaterialRequirement, PlanDocument, PlanLevel } from '../types';
import { 
  Plus, 
  Globe, 
  Package, 
  ChevronDown, 
  ChevronUp, 
  Compass, 
  X, 
  CheckCircle2, 
  BarChart2,
  Camera,
  Eye,
  ChevronLeft,
  ChevronRight,
  Download,
  Unlock,
  Layers,
  FileText,
  Trash2,
  UploadCloud,
  Filter,
  Map
} from 'lucide-react';
import { 
  saveRoom, 
  completeRoom, 
  listenToPlans, 
  uploadPlanFile, 
  savePlan, 
  updatePlanFloor,
  deletePlan,
  isRoomMatch 
} from '../services/firestoreService';
import { RoomDetailModal } from './RoomDetailModal';
import { WebPlanViewerModal } from './WebPlanViewerModal';
import { CircularProgress } from './CircularProgress';
import { generateTranslations, parseDwgFile, detectLevelFromFilename } from '../services/dwgParser';

interface RoomManagerProps {
  projectId: string;
  projectName?: string;
  rooms: Room[];
  positions: Position[];
  bookings?: Booking[];
}

export const RoomManager: React.FC<RoomManagerProps> = ({ projectId, projectName, rooms, positions, bookings = [] }) => {
  const [plans, setPlans] = useState<PlanDocument[]>([]);
  const [selectedLevelFilter, setSelectedLevelFilter] = useState<string>('all');
  const [isAddPlanOpen, setIsAddPlanOpen] = useState<boolean>(false);
  const [newPlanFile, setNewPlanFile] = useState<File | null>(null);
  const [newPlanLevel, setNewPlanLevel] = useState<PlanLevel>('UG');
  const [isUploadingPlan, setIsUploadingPlan] = useState<boolean>(false);

  const [isAddOpen, setIsAddOpen] = useState(false);
  const [expandedRoomId, setExpandedRoomId] = useState<string | null>(null);
  const [selectedRoomIdForDetail, setSelectedRoomIdForDetail] = useState<string | null>(null);

  // CAD / Ausführungsplan Modal State
  const [isPlanViewerOpen, setIsPlanViewerOpen] = useState<boolean>(false);
  const [activePlanForViewer, setActivePlanForViewer] = useState<PlanDocument | null>(null);
  const [activeRoomForViewer, setActiveRoomForViewer] = useState<Room | null>(null);

  const handleOpenPlanForRoom = (room: Room) => {
    // 1. Suche nach Plan für dieselbe Etage (z. B. 'EG', 'OG', 'UG')
    const roomFloor = room.floor || 'EG';
    let matchingPlan = plans.find(p => (p.floor || p.level) === roomFloor);
    // 2. Falls nicht exakt matcht, nimm den ersten verfügbaren Plan
    if (!matchingPlan && plans.length > 0) {
      matchingPlan = plans[0];
    }
    setActivePlanForViewer(matchingPlan || null);
    setActiveRoomForViewer(room);
    setIsPlanViewerOpen(true);
  };

  const handleOpenPlanForFloor = (floor: string) => {
    let matchingPlan = floor !== 'all' ? plans.find(p => (p.floor || p.level) === floor) : null;
    if (!matchingPlan && plans.length > 0) {
      matchingPlan = plans[0];
    }
    setActivePlanForViewer(matchingPlan || null);
    setActiveRoomForViewer(null);
    setIsPlanViewerOpen(true);
  };

  useEffect(() => {
    if (!projectId) return;
    const unsub = listenToPlans(projectId, setPlans);
    return () => unsub();
  }, [projectId]);

  const selectedRoomForDetail = rooms.find(r => r.id === selectedRoomIdForDetail) || null;

  // Fullscreen Photo Lightbox Gallery State
  const [selectedGallery, setSelectedGallery] = useState<{
    roomTitle: string;
    photos: string[];
    currentIndex: number;
  } | null>(null);

  useEffect(() => {
    if (!selectedGallery) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setSelectedGallery(null);
      } else if (e.key === 'ArrowLeft' && selectedGallery.photos.length > 0) {
        setSelectedGallery(prev => prev ? {
          ...prev,
          currentIndex: (prev.currentIndex - 1 + prev.photos.length) % prev.photos.length
        } : null);
      } else if (e.key === 'ArrowRight' && selectedGallery.photos.length > 0) {
        setSelectedGallery(prev => prev ? {
          ...prev,
          currentIndex: (prev.currentIndex + 1) % prev.photos.length
        } : null);
      }
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [selectedGallery]);

  // Assign Material Modal State
  const [assigningRoom, setAssigningRoom] = useState<Room | null>(null);
  const [selectedPosId, setSelectedPosId] = useState<string>('');
  const [plannedQty, setPlannedQty] = useState<number>(1);

  const [newRoom, setNewRoom] = useState<Partial<Room>>({
    name: '',
    code: '',
    floor: 'EG',
    translations: { ro: '', pl: '', hr: '' }
  });

  const handleCreate = async () => {
    if (!newRoom.name || !newRoom.code) return;
    const roomId = `room_${Date.now()}`;
    const autoTrans = generateTranslations(newRoom.name);
    const roomToSave: Room = {
      id: roomId,
      name: newRoom.name,
      code: newRoom.code,
      floor: newRoom.floor || 'EG',
      source: 'manual',
      translations: {
        ro: newRoom.translations?.ro || autoTrans.ro,
        pl: newRoom.translations?.pl || autoTrans.pl,
        hr: newRoom.translations?.hr || autoTrans.hr
      },
      materials: []
    };

    await saveRoom(projectId, roomToSave);
    setIsAddOpen(false);
    setNewRoom({ name: '', code: '', floor: 'EG', translations: { ro: '', pl: '', hr: '' } });
  };


  const handleOpenAssignModal = (room: Room) => {
    setAssigningRoom(room);
    if (positions.length > 0) {
      setSelectedPosId(positions[0].id);
      setPlannedQty(1);
    }
  };

  const handleAddMaterialToRoom = async () => {
    if (!assigningRoom || !selectedPosId) return;
    const targetPos = positions.find(p => p.id === selectedPosId);
    if (!targetPos) return;

    const currentMaterials = assigningRoom.materials || [];
    const exists = currentMaterials.find(m => m.positionId === selectedPosId);

    let updatedMaterials: RoomMaterialRequirement[] = [];
    if (exists) {
      updatedMaterials = currentMaterials.map(m => 
        m.positionId === selectedPosId ? { ...m, plannedQty: m.plannedQty + plannedQty } : m
      );
    } else {
      updatedMaterials = [
        ...currentMaterials,
        {
          positionId: targetPos.id,
          posNr: targetPos.posNr,
          shortText: targetPos.shortText,
          plannedQty: plannedQty,
          qu: targetPos.qu,
          group: targetPos.group
        }
      ];
    }

    const updatedRoom: Room = {
      ...assigningRoom,
      materials: updatedMaterials
    };

    await saveRoom(projectId, updatedRoom);
    setAssigningRoom(null);
  };

  const handleRemoveMaterialFromRoom = async (room: Room, positionId: string) => {
    const updatedMaterials = (room.materials || []).filter(m => m.positionId !== positionId);
    const updatedRoom: Room = {
      ...room,
      materials: updatedMaterials
    };
    await saveRoom(projectId, updatedRoom);
  };

  const getRoomPhotos = (r: Room): string[] => {
    const list: string[] = [];
    const isValidWebPhoto = (url: unknown): url is string =>
      typeof url === 'string' &&
      url.trim().length > 0 &&
      !url.startsWith('file://') &&
      (url.startsWith('http://') || url.startsWith('https://') || url.startsWith('data:image/'));

    // 1. From r.photos
    if (Array.isArray(r.photos)) {
      r.photos.forEach(p => {
        if (isValidWebPhoto(p) && !list.includes(p)) {
          list.push(p);
        }
      });
    }

    // 2. From bookings matching this room (by id or code or roomName)
    const matching = bookings.filter(b => isRoomMatch(r, b));

    matching.forEach(b => {
      if (Array.isArray(b.photoUrls)) {
        b.photoUrls.forEach(url => {
          if (isValidWebPhoto(url) && !list.includes(url)) list.push(url);
        });
      }
      if (Array.isArray((b as any).photos)) {
        (b as any).photos.forEach((p: any) => {
          if (isValidWebPhoto(p) && !list.includes(p)) list.push(p);
        });
      }
    });

    return list;
  };

  const getRoomInfo = (r: Room) => {
    const roomBookings = bookings.filter(b => isRoomMatch(r, b));
    const hasCompletionBooking = roomBookings.some(b => b.type === 'room_completion' || (b as any).itemId === 'room_completion');
    const isExplicitlyUnlocked = r.isCompleted === false || r.status === 'in_progress';
    const isCompleted = !isExplicitlyUnlocked && (r.status === 'completed' || r.isCompleted === true || (r.pct === 100) || hasCompletionBooking);
    
    let calculatedPercent = (r as any).pct ?? (r as any).progressPercent ?? 0;
    if (calculatedPercent === 0 && Array.isArray(r.materials) && r.materials.length > 0) {
      let totPlanned = 0;
      let totInstalled = 0;
      r.materials.forEach(m => {
        const p = Number(m.plannedQty || 0);
        const inst = Number(m.actualQty ?? (m as any).installedQty ?? 0);
        if (p > 0) {
          totPlanned += p;
          totInstalled += Math.min(p, inst);
        }
      });
      if (totPlanned > 0 && totInstalled > 0) {
        calculatedPercent = Math.min(100, Math.round((totInstalled / totPlanned) * 100));
      }
    }

    const roomPercent = isCompleted ? 100 : calculatedPercent;
    const photos = getRoomPhotos(r);
    return { isCompleted, roomPercent, roomBookings, photos };
  };

  const handleToggleRoomCompletion = async (room: Room, isCompleted: boolean) => {
    try {
      await completeRoom(projectId, room.id, isCompleted);
    } catch (err) {
      console.error('Error toggling room completion:', err);
    }
  };

  const handleUploadAdditionalPlan = async () => {
    if (!newPlanFile || !projectId) return;
    setIsUploadingPlan(true);

    try {
      const planId = `plan_${Date.now()}`;
      const ext = newPlanFile.name.toLowerCase().endsWith('.pdf') ? 'pdf' : (newPlanFile.name.toLowerCase().endsWith('.dxf') ? 'dxf' : 'dwg');

      const { downloadUrl, storagePath } = await uploadPlanFile(projectId, planId, newPlanFile);

      let detectedCount = 0;
      let vectorData: any = undefined;
      let detectedLayers: string[] = [];

      if (ext === 'dwg' || ext === 'dxf') {
        const parsed = await parseDwgFile(newPlanFile, positions, newPlanLevel, planId);
        detectedCount = parsed.rooms.length;
        vectorData = parsed.vectorData;
        detectedLayers = parsed.detectedLayers;
        for (const r of parsed.rooms) {
          await saveRoom(projectId, r);
        }
      }

      const rawBase = newPlanFile.name.replace(/\.[^/.]+$/, '').replace(/[_-]+/g, ' ').trim();
      const planName = rawBase.toLowerCase().includes('montageplan')
        ? rawBase
        : `Montageplan ${newPlanLevel} (${rawBase})`;

      const planDoc: PlanDocument = {
        id: planId,
        projectId,
        name: planName,
        fileName: newPlanFile.name,
        originalFileName: newPlanFile.name,
        floor: newPlanLevel,
        level: newPlanLevel,
        dwgUrl: downloadUrl,
        pdfUrl: downloadUrl,
        downloadUrl,
        storagePath,
        status: 'ready' as const,
        fileType: ext,
        size: newPlanFile.size,
        uploadedAt: new Date().toISOString(),
        createdAt: new Date().toISOString(),
        detectedRoomsCount: detectedCount,
        detectedLayers,
        vectorData
      };

      await savePlan(projectId, planDoc);
      setIsAddPlanOpen(false);
      setNewPlanFile(null);
    } catch (err: any) {
      alert('Fehler beim Hochladen des Plans: ' + (err.message || err));
    } finally {
      setIsUploadingPlan(false);
    }
  };

  const handleDeletePlan = async (planId: string, planName: string) => {
    if (window.confirm(`Plan "${planName}" wirklich aus dem Vorhaben entfernen?`)) {
      await deletePlan(projectId, planId);
    }
  };

  const handlePlanFloorChange = async (planId: string, newFloor: PlanLevel) => {
    await updatePlanFloor(projectId, planId, newFloor);
  };

  // Calculate Progress Metrics for the Status Pie Chart
  const totalRooms = rooms.length;
  const completedRooms = rooms.filter(r => getRoomInfo(r).isCompleted).length;
  const inProgressRooms = rooms.filter(r => !getRoomInfo(r).isCompleted && getRoomInfo(r).roomPercent > 0).length;
  const plannedRooms = rooms.filter(r => !getRoomInfo(r).isCompleted && getRoomInfo(r).roomPercent === 0).length;

  const totalProgressPercent = totalRooms > 0 
    ? Math.round(rooms.reduce((sum, r) => sum + getRoomInfo(r).roomPercent, 0) / totalRooms)
    : 0;

  // Filter rooms by building level
  const filteredRooms = rooms.filter(r => {
    if (selectedLevelFilter === 'all') return true;
    return r.floor === selectedLevelFilter;
  });

  const availableFloors = Array.from(new Set(rooms.map(r => r.floor || 'EG')));

  return (
    <div className="space-y-6">
      {/* Header Bar */}
      <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-bold text-slate-900">Raum- & Baustellen-Konfigurator</h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Örtlichkeiten der Verbauung: Räume aus DWG-Plan oder manuell angelegt mit hinterlegten LV-Materialien
          </p>
        </div>
        <div className="flex items-center space-x-2.5 self-start sm:self-auto">
          <button
            onClick={() => setIsAddPlanOpen(true)}
            className="flex items-center space-x-2 bg-slate-800 hover:bg-slate-900 text-white px-3.5 py-2.5 rounded-xl text-xs font-bold shadow-sm transition-all hover:scale-[1.02] active:scale-[0.98]"
          >
            <Compass className="w-4 h-4 text-[#3B82C4]" />
            <span>Plan hochladen (.dwg / .dxf / .pdf)</span>
          </button>
          <button
            onClick={() => setIsAddOpen(true)}
            className="flex items-center space-x-2 bg-[#3B82C4] hover:bg-[#2B6EB0] text-white px-4 py-2.5 rounded-xl text-xs font-bold shadow-md shadow-blue-500/20 transition-all hover:scale-[1.02] active:scale-[0.98]"
          >
            <Plus className="w-4 h-4" />
            <span>Raum manuell anlegen</span>
          </button>
        </div>
      </div>

      {/* Zugehörige Ausführungs- & Montagepläne Card */}
      {plans.length > 0 && (
        <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm space-y-3">
          <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
            <div className="flex items-center space-x-2">
              <Layers className="w-4 h-4 text-[#3B82C4]" />
              <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                Hinterlegte Ausführungs- & Montagepläne ({plans.length})
              </h3>
            </div>
            <button
              onClick={() => setIsAddPlanOpen(true)}
              className="text-xs text-[#3B82C4] font-bold hover:underline flex items-center space-x-1"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Weiteren Plan ergänzen</span>
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {plans.map(plan => {
              const formatSize = (bytes: number) => {
                if (bytes < 1024) return `${bytes} B`;
                if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
                return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
              };

              return (
                <div 
                  key={plan.id}
                  className="bg-slate-50 border border-slate-200/90 rounded-xl p-3 flex items-center justify-between gap-3 hover:border-blue-300 transition-colors"
                >
                  <div className="flex items-center space-x-2.5 min-w-0">
                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 font-bold text-xs ${
                      plan.fileType === 'pdf' ? 'bg-rose-100 text-rose-700' : 'bg-blue-100 text-[#3B82C4]'
                    }`}>
                      {plan.fileType === 'pdf' ? <FileText className="w-4 h-4" /> : <Compass className="w-4 h-4" />}
                    </div>

                    <div className="min-w-0">
                      <span className="text-xs font-bold text-slate-800 truncate block" title={plan.name || plan.fileName}>
                        {plan.name || plan.fileName}
                      </span>
                      <div className="flex flex-wrap items-center gap-1.5 text-[10.5px] text-slate-500 mt-1">
                        {/* Dropdown zur manuellen Korrektur der Geschoss-Zuordnung */}
                        <select
                          value={plan.floor || plan.level || 'Sonstiges'}
                          onChange={(e) => handlePlanFloorChange(plan.id, e.target.value as PlanLevel)}
                          className="font-bold text-[10.5px] text-blue-700 bg-blue-50/90 hover:bg-blue-100/90 px-2 py-0.5 rounded border border-blue-200 cursor-pointer focus:outline-none focus:ring-1 focus:ring-blue-400"
                          title="Geschoss-Zuordnung manuell anpassen"
                        >
                          <option value="UG">UG (Untergeschoss)</option>
                          <option value="EG">EG (Erdgeschoss)</option>
                          <option value="OG">OG (Obergeschoss)</option>
                          <option value="DG">DG (Dachgeschoss)</option>
                          <option value="Strangschema">Strangschema</option>
                          <option value="Sonstiges">Sonstiges</option>
                        </select>

                        <span>{formatSize(plan.size || plan.pdfSize || plan.dwgSize || 0)}</span>

                        {/* Verarbeitungsstatus: Upload -> Konvertierung -> PDF bereit */}
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${
                          plan.status === 'ready' 
                            ? 'text-emerald-700 bg-emerald-50 border-emerald-200' 
                            : plan.status === 'processing' 
                            ? 'text-amber-700 bg-amber-50 border-amber-200 animate-pulse' 
                            : 'text-red-700 bg-red-50 border-red-200'
                        }`}>
                          {plan.status === 'ready' ? '✓ PDF bereit' : plan.status === 'processing' ? '⏳ In Konvertierung...' : '⚠️ Fehler'}
                        </span>

                        {plan.detectedRoomsCount !== undefined && plan.detectedRoomsCount > 0 && (
                          <span className="text-emerald-700 font-semibold">• {plan.detectedRoomsCount} Räume</span>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center space-x-1 shrink-0">
                    {(plan.pdfUrl || plan.downloadUrl) && !(plan.pdfUrl || plan.downloadUrl)?.startsWith('file://') && (
                      <a
                        href={plan.pdfUrl || plan.downloadUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="p-1.5 text-slate-400 hover:text-[#3B82C4] hover:bg-white rounded-lg transition-colors flex items-center space-x-1 text-xs"
                        title="Vektorisiertes PDF ansehen"
                      >
                        <FileText className="w-3.5 h-3.5" />
                        <span className="text-[10px] font-bold">PDF</span>
                      </a>
                    )}
                    {(plan.dwgUrl || plan.downloadUrl) && !(plan.dwgUrl || plan.downloadUrl)?.startsWith('file://') && (
                      <a
                        href={plan.dwgUrl || plan.downloadUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="p-1.5 text-slate-400 hover:text-[#3B82C4] hover:bg-white rounded-lg transition-colors flex items-center space-x-1 text-xs"
                        title="Original-DWG herunterladen"
                        download
                      >
                        <Download className="w-3.5 h-3.5" />
                        <span className="text-[10px] font-bold">DWG</span>
                      </a>
                    )}
                    <button
                      type="button"
                      onClick={() => handleDeletePlan(plan.id, plan.fileName)}
                      className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-white rounded-lg transition-colors"
                      title="Plan entfernen"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Project Room Progress & Status Pie Chart Card (0% Rot -> 100% Grün) */}
      <div className="bg-white rounded-2xl border border-slate-200 p-5 sm:p-6 shadow-sm flex flex-col md:flex-row items-center justify-between gap-6">
        {/* Left: Circular Progress Pie Chart with 0% Red -> 100% Green Gradient */}
        <div className="flex items-center space-x-5">
          <CircularProgress
            percentage={totalProgressPercent}
            size={110}
            strokeWidth={11}
            sublabel="Gesamt"
          />

          <div className="space-y-1">
            <div className="flex items-center space-x-2">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
                Baustellen-Fortschritt
              </span>
              <span className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full ${
                totalProgressPercent >= 80 
                  ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                  : totalProgressPercent >= 40 
                  ? 'bg-amber-100 text-amber-800 border border-amber-300'
                  : 'bg-red-100 text-red-800 border border-red-300'
              }`}>
                {totalProgressPercent >= 100 ? 'Vollständig abgeschlossen' : totalProgressPercent >= 40 ? 'In Ausführung' : 'Startphase'}
              </span>
            </div>
            <h3 className="text-xl font-black text-slate-900 tracking-tight">
              {completedRooms} von {totalRooms} Räumen fertiggestellt (100%)
            </h3>
            <p className="text-xs text-slate-500">
              Durchschnittlicher Fertigstellungsgrad aller Räume & Örtlichkeiten im Projekt
            </p>
          </div>
        </div>

        {/* Right: Quick Stats Breakdown */}
        <div className="grid grid-cols-3 gap-3 w-full md:w-auto shrink-0 text-center">
          <div className="bg-emerald-50 border border-emerald-200 px-4 py-3 rounded-xl shadow-xs">
            <span className="text-[10px] font-bold text-emerald-700 uppercase tracking-wider block">
              Fertig (100%)
            </span>
            <span className="text-xl font-black text-emerald-800 block mt-0.5">
              {completedRooms}
            </span>
            <span className="text-[10px] text-emerald-600">Räume abgenommen</span>
          </div>

          <div className="bg-blue-50 border border-blue-200 px-4 py-3 rounded-xl shadow-xs">
            <span className="text-[10px] font-bold text-blue-700 uppercase tracking-wider block">
              In Montage
            </span>
            <span className="text-xl font-black text-[#3B82C4] block mt-0.5">
              {inProgressRooms}
            </span>
            <span className="text-[10px] text-blue-600">aktiv in Arbeit</span>
          </div>

          <div className="bg-slate-50 border border-slate-200 px-4 py-3 rounded-xl shadow-xs">
            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">
              Geplant
            </span>
            <span className="text-xl font-black text-slate-700 block mt-0.5">
              {plannedRooms}
            </span>
            <span className="text-[10px] text-slate-500">noch offen</span>
          </div>
        </div>
      </div>

      {/* Floor / Level Filter Bar & CAD Plan Trigger */}
      {(availableFloors.length > 1 || plans.length > 0) && (
        <div className="flex flex-wrap items-center justify-between gap-2 pb-1 text-xs">
          <div className="flex items-center space-x-2 overflow-x-auto">
            {availableFloors.length > 1 && (
              <>
                <span className="font-bold text-slate-500 flex items-center space-x-1 shrink-0">
                  <Filter className="w-3.5 h-3.5" />
                  <span>Etage / Ebene filtern:</span>
                </span>
                <button
                  type="button"
                  onClick={() => setSelectedLevelFilter('all')}
                  className={`px-3 py-1.5 rounded-lg font-bold transition-all shrink-0 ${
                    selectedLevelFilter === 'all'
                      ? 'bg-[#3B82C4] text-white shadow-xs'
                      : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'
                  }`}
                >
                  Alle ({rooms.length})
                </button>
                {availableFloors.map(floor => {
                  const count = rooms.filter(r => r.floor === floor).length;
                  return (
                    <button
                      key={floor}
                      type="button"
                      onClick={() => setSelectedLevelFilter(floor)}
                      className={`px-3 py-1.5 rounded-lg font-bold transition-all shrink-0 ${
                        selectedLevelFilter === floor
                          ? 'bg-[#3B82C4] text-white shadow-xs'
                          : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'
                      }`}
                    >
                      {floor} ({count})
                    </button>
                  );
                })}
              </>
            )}
          </div>

          {plans.length > 0 && (
            <div className="shrink-0 ml-auto">
              <button
                type="button"
                onClick={() => handleOpenPlanForFloor(selectedLevelFilter)}
                className="px-3 py-1.5 rounded-lg font-bold transition-all flex items-center space-x-1.5 bg-blue-50 border border-blue-200 text-[#3B82C4] hover:bg-blue-100 hover:border-[#3B82C4]/40 shadow-xs cursor-pointer"
                title="Ausführungsplan im interaktiven CAD-Viewer öffnen"
              >
                <Map className="w-3.5 h-3.5 text-[#3B82C4]" />
                <span>{selectedLevelFilter === 'all' ? 'CAD-Plan öffnen' : `Plan ${selectedLevelFilter} öffnen`}</span>
              </button>
            </div>
          )}
        </div>
      )}

      {/* Room Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {filteredRooms.map((room) => {
          const isExpanded = expandedRoomId === room.id;
          const materialCount = room.materials?.length || 0;
          const isDwg = room.source === 'dwg';
          const { isCompleted, roomPercent, photos } = getRoomInfo(room);
          // Resolve Monteur Name and Language
          const matchingBookings = bookings.filter(b => isRoomMatch(room, b));
          const latestBooking = matchingBookings[matchingBookings.length - 1];
          const monteurName = room.completedBy || (room as any).lastUpdatedBy || (latestBooking && latestBooking.createdBy) || 'Stefan Maier';
          const rawLang = (room as any).lastMonteurLanguage || (room as any).monteurLanguage || (latestBooking as any)?.language || 'de';
          const languageDisplay = rawLang.toLowerCase() === 'ro' ? '🇷🇴 RO' : rawLang.toLowerCase() === 'pl' ? '🇵🇱 PL' : rawLang.toLowerCase() === 'hr' ? '🇭🇷 HR' : '🇩🇪 DE';


          return (
            <div 
              key={room.id} 
              className="bg-white rounded-xl border border-slate-200 shadow-sm p-5 space-y-4 hover:border-[#3B82C4]/40 transition-colors flex flex-col justify-between"
            >
              <div className="space-y-3">
                {/* Top Badge, Circular Progress (Delete-Icon entfernt) */}
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-start space-x-3 min-w-0 flex-1">
                    {/* Icon Box: Größer, damit EG-101, EG-102 etc. nicht abgeschnitten werden */}
                    <div className="min-w-[64px] h-12 rounded-xl bg-slate-100 text-slate-800 flex items-center justify-center font-mono font-black text-xs shrink-0 border border-slate-200 shadow-xs px-2.5">
                      {room.code || 'RAUM'}
                    </div>

                    <div className="min-w-0 flex-1 space-y-1">
                      {/* Zeile 1: Titel, Fertig/In-Arbeit Badge und Monteur-Name in Grau */}
                      <div className="flex items-center flex-wrap gap-2">
                        <h3 className="font-bold text-slate-900 text-sm sm:text-base leading-tight">
                          {room.name}
                        </h3>
                        {plans.length > 0 && (
                          <button
                            type="button"
                            onClick={() => handleOpenPlanForRoom(room)}
                            className="p-1 text-slate-400 hover:text-[#3B82C4] hover:bg-blue-50 rounded-md transition-colors cursor-pointer"
                            title={`AutoCAD-Plan für ${room.name} (${room.floor || 'EG'}) anzeigen`}
                          >
                            <Map className="w-3.5 h-3.5" />
                          </button>
                        )}
                        {isCompleted ? (
                          <div className="flex items-center space-x-1.5 shrink-0">
                            <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-300 px-2 py-0.5 rounded-full flex items-center space-x-1">
                              <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                              <span>100% Fertig</span>
                            </span>
                            <span className="text-xs text-slate-400 font-medium">
                              · {monteurName}
                            </span>
                          </div>
                        ) : roomPercent > 0 ? (
                          <div className="flex items-center space-x-1.5 shrink-0">
                            <span className="text-[10px] font-bold text-blue-700 bg-blue-50 border border-blue-200 px-2 py-0.5 rounded-full">
                              {roomPercent}% in Montage
                            </span>
                            <span className="text-xs text-slate-400 font-medium">
                              · {monteurName}
                            </span>
                          </div>
                        ) : null}
                      </div>

                      {/* Zeile 2 (Darunter): Etage, Name des Monteurs, Sprache des Monteurs, Plan-Typ */}
                      <div className="flex flex-wrap items-center gap-1.5 text-[10.5px] text-slate-500 pt-0.5">
                        <span className="font-semibold bg-slate-100 px-2 py-0.5 rounded border border-slate-200/60">
                          Etage: {room.floor || 'EG'}
                        </span>
                        <span className="bg-slate-50 border border-slate-200 px-2 py-0.5 rounded flex items-center space-x-1">
                          <span className="text-slate-400">Monteur:</span>
                          <span className="font-semibold text-slate-700">{monteurName}</span>
                        </span>
                        <span className="bg-slate-50 border border-slate-200 px-2 py-0.5 rounded flex items-center space-x-1">
                          <span className="text-slate-400">Sprache:</span>
                          <span className="font-semibold text-slate-700">{languageDisplay}</span>
                        </span>
                        {isDwg ? (
                          <span className="font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-1.5 py-0.5 rounded flex items-center space-x-1">
                            <Compass className="w-2.5 h-2.5" />
                            <span>DWG / DXF</span>
                          </span>
                        ) : (
                          <span className="font-medium text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded">
                            Manuell
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Circular Progress (Kein Delete-Icon mehr) */}
                  <div className="shrink-0 pt-0.5">
                    <CircularProgress
                      percentage={roomPercent}
                      size={44}
                      strokeWidth={4.5}
                      showText={true}
                    />
                  </div>
                </div>

                {/* Assigned Materials Section */}
                <div className="pt-3 border-t border-slate-100 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-700 flex items-center space-x-1.5">
                      <Package className="w-3.5 h-3.5 text-[#3B82C4]" />
                      <span>Hinterlegte Materialien:</span>
                    </span>
                    <span className="text-[11px] font-bold text-[#2FA36B] bg-emerald-50 px-2 py-0.5 rounded">
                      {materialCount} Positionen
                    </span>
                  </div>

                  {materialCount === 0 ? (
                    <p className="text-[11px] text-slate-400 italic">
                      Noch keine Materialien für diesen Raum hinterlegt.
                    </p>
                  ) : (
                    <div className="space-y-1">
                      {/* Show first 2 or all if expanded */}
                      {(isExpanded ? room.materials : room.materials?.slice(0, 2))?.map((mat) => (
                        <div key={mat.positionId} className="p-1.5 bg-slate-50 rounded border border-slate-200 text-xs flex items-center justify-between">
                          <div className="truncate mr-2">
                            <span className="font-mono font-bold text-[#3B82C4] mr-1.5">{mat.posNr}</span>
                            <span className="text-slate-700">{mat.shortText}</span>
                          </div>
                          <div className="flex items-center space-x-1.5 shrink-0">
                            <span className="font-bold text-slate-800 bg-white px-1.5 py-0.5 rounded border border-slate-200 text-[10px]">
                              {mat.plannedQty} {mat.qu}
                            </span>
                            <button
                              onClick={() => handleRemoveMaterialFromRoom(room, mat.positionId)}
                              className="text-slate-400 hover:text-red-500 p-0.5"
                              title="Material aus Raum entfernen"
                            >
                              <X className="w-3 h-3" />
                            </button>
                          </div>
                        </div>
                      ))}

                      {materialCount > 2 && (
                        <button
                          onClick={() => setExpandedRoomId(isExpanded ? null : room.id)}
                          className="text-[11px] text-[#3B82C4] font-semibold hover:underline flex items-center space-x-1 pt-0.5"
                        >
                          <span>{isExpanded ? 'Weniger anzeigen' : `+ ${materialCount - 2} weitere Materialien anzeigen`}</span>
                          {isExpanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                        </button>
                      )}
                    </div>
                  )}
                </div>

                {/* Proof Photos Thumbnail Section - Direkt unter den hinterlegten Materialien */}
                {photos && photos.length > 0 && (
                  <div className="pt-2.5 border-t border-slate-100">
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="text-xs font-bold text-slate-700 flex items-center space-x-1.5">
                        <Camera className="w-3.5 h-3.5 text-[#3B82C4]" />
                        <span>Beweisfotos & Montage-Doku:</span>
                      </span>
                      <span className="text-[10px] font-bold text-[#3B82C4] bg-blue-50 px-2 py-0.5 rounded">
                        {photos.length} {photos.length === 1 ? 'Foto' : 'Fotos'}
                      </span>
                    </div>

                    <div className="flex items-center gap-2 overflow-x-auto pb-1 pt-0.5 scrollbar-thin">
                      {photos.map((photoUrl, pIdx) => (
                        <button
                          key={pIdx}
                          type="button"
                          onClick={() => setSelectedGallery({
                            roomTitle: `${room.name} (${room.code || 'Raum'})`,
                            photos,
                            currentIndex: pIdx,
                          })}
                          className="group relative w-14 h-14 rounded-lg overflow-hidden border border-slate-200 hover:border-[#3B82C4] shadow-xs shrink-0 focus:outline-none focus:ring-2 focus:ring-[#3B82C4]/40 transition-all hover:scale-105 bg-slate-100"
                          title={`Foto ${pIdx + 1} vergrößern`}
                        >
                          <img
                            src={photoUrl}
                            alt={`Beweisfoto ${pIdx + 1} - ${room.name}`}
                            className="w-full h-full object-cover transition-transform group-hover:scale-110"
                            loading="lazy"
                          />
                          <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                            <Eye className="w-4 h-4 text-white drop-shadow" />
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Actions: Room Detail / Delta & Add Material */}
              <div className="pt-3 border-t border-slate-100 space-y-2">
                {isCompleted && (
                  <button
                    type="button"
                    onClick={() => handleToggleRoomCompletion(room, false)}
                    className="w-full flex items-center justify-center space-x-1.5 bg-amber-50 hover:bg-amber-100 border border-amber-300 text-amber-800 py-2 rounded-xl text-xs font-bold transition-all shadow-xs"
                    title="Raum für Monteure wieder freischalten (auf nicht fertig / in Arbeit setzen)"
                  >
                    <Unlock className="w-3.5 h-3.5 text-amber-600" />
                    <span>Raum freischalten (auf „nicht fertig“ setzen)</span>
                  </button>
                )}

                <div className={plans.length > 0 ? "grid grid-cols-2 gap-2" : "w-full"}>
                  {plans.length > 0 && (
                    <button
                      type="button"
                      onClick={() => handleOpenPlanForRoom(room)}
                      className="flex items-center justify-center space-x-1.5 bg-blue-50 hover:bg-blue-100 text-[#3B82C4] border border-blue-200/80 py-2 rounded-xl text-xs font-bold transition-all shadow-xs cursor-pointer"
                      title={`AutoCAD-Plan für ${room.name} (${room.floor || 'EG'}) anzeigen`}
                    >
                      <Map className="w-3.5 h-3.5 text-[#3B82C4]" />
                      <span>Plan ansehen</span>
                    </button>
                  )}

                  <button
                    type="button"
                    onClick={() => setSelectedRoomIdForDetail(room.id)}
                    className="w-full flex items-center justify-center space-x-1.5 bg-[#1C2A3B] hover:bg-slate-800 text-white py-2 rounded-xl text-xs font-bold shadow-sm transition-all hover:scale-[1.01] active:scale-[0.99] cursor-pointer"
                    title="Mengen-Delta & VOB-Aufmaß ansehen"
                  >
                    <BarChart2 className="w-3.5 h-3.5 text-[#3B82C4]" />
                    <span>Aufmaß / Delta</span>
                  </button>
                </div>

                <button
                  onClick={() => handleOpenAssignModal(room)}
                  className="w-full flex items-center justify-center space-x-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 py-1.5 rounded-lg text-xs font-semibold transition-colors"
                >
                  <Plus className="w-3.5 h-3.5 text-[#3B82C4]" />
                  <span>Material zuweisen</span>
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* Modal: Material zu Raum zuweisen */}
      {assigningRoom && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <h3 className="text-base font-bold text-slate-800">
                  Material für Raum "{assigningRoom.name}" hinterlegen
                </h3>
                <p className="text-xs text-slate-400">{assigningRoom.code} ({assigningRoom.floor})</p>
              </div>
              <button onClick={() => setAssigningRoom(null)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="block text-slate-700 font-semibold mb-1">
                  LV-Position auswählen ({positions.length} verfügbar):
                </label>
                <select
                  value={selectedPosId}
                  onChange={(e) => setSelectedPosId(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#3B82C4]"
                >
                  {positions.map(p => (
                    <option key={p.id} value={p.id}>
                      {p.posNr} – {p.shortText} ({p.qty} {p.qu})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-slate-700 font-semibold mb-1">
                  Geplante Menge für diesen Raum:
                </label>
                <div className="flex items-center space-x-2">
                  <input
                    type="number"
                    min="1"
                    value={plannedQty}
                    onChange={(e) => setPlannedQty(Math.max(1, parseFloat(e.target.value) || 1))}
                    className="w-32 px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-800 font-bold focus:outline-none focus:ring-2 focus:ring-[#3B82C4]"
                  />
                  <span className="text-xs font-semibold text-slate-600">
                    {positions.find(p => p.id === selectedPosId)?.qu || 'Stk'}
                  </span>
                </div>
              </div>
            </div>

            <div className="flex justify-end space-x-3 pt-3 border-t border-slate-100">
              <button
                onClick={() => setAssigningRoom(null)}
                className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-800"
              >
                Abbrechen
              </button>
              <button
                onClick={handleAddMaterialToRoom}
                className="bg-[#3B82C4] hover:bg-[#2B6EB0] text-white px-5 py-2 rounded-xl text-xs font-semibold shadow-md"
              >
                Zuordnung speichern
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add Room Modal (Manual) */}
      {isAddOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4">
            <h3 className="text-base font-bold text-slate-800">Neuen Raum manuell anlegen</h3>
            <p className="text-xs text-slate-500">Für Projekte ohne DWG-Plandaten</p>
            
            <div className="space-y-3 text-xs">
              <div>
                <label className="block text-slate-600 font-semibold mb-1">Raumname (DE)</label>
                <input
                  type="text"
                  placeholder="z.B. Duschen Herren"
                  value={newRoom.name}
                  onChange={(e) => setNewRoom({ ...newRoom, name: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#3B82C4]"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-600 font-semibold mb-1">Raum-Code</label>
                  <input
                    type="text"
                    placeholder="z.B. EG-103"
                    value={newRoom.code}
                    onChange={(e) => setNewRoom({ ...newRoom, code: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#3B82C4]"
                  />
                </div>
                <div>
                  <label className="block text-slate-600 font-semibold mb-1">Etage</label>
                  <select
                    value={newRoom.floor}
                    onChange={(e) => setNewRoom({ ...newRoom, floor: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#3B82C4]"
                  >
                    <option value="UG">UG (Untergeschoss)</option>
                    <option value="EG">EG (Erdgeschoss)</option>
                    <option value="OG">OG (Obergeschoss)</option>
                    <option value="DG">DG (Dachgeschoss)</option>
                  </select>
                </div>
              </div>

              <div className="pt-2 space-y-2 border-t border-slate-100">
                <span className="font-semibold text-slate-700 flex items-center space-x-1">
                  <Globe className="w-3.5 h-3.5 text-[#3B82C4]" />
                  <span>Monteur-Sprachen (Optional)</span>
                </span>
                
                <input
                  type="text"
                  placeholder="Rumänisch (RO)"
                  value={newRoom.translations?.ro}
                  onChange={(e) => setNewRoom({
                    ...newRoom,
                    translations: { ...newRoom.translations, ro: e.target.value }
                  })}
                  className="w-full px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg"
                />
                <input
                  type="text"
                  placeholder="Polnisch (PL)"
                  value={newRoom.translations?.pl}
                  onChange={(e) => setNewRoom({
                    ...newRoom,
                    translations: { ...newRoom.translations, pl: e.target.value }
                  })}
                  className="w-full px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg"
                />
                <input
                  type="text"
                  placeholder="Kroatisch (HR)"
                  value={newRoom.translations?.hr}
                  onChange={(e) => setNewRoom({
                    ...newRoom,
                    translations: { ...newRoom.translations, hr: e.target.value }
                  })}
                  className="w-full px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg"
                />
              </div>
            </div>

            <div className="flex justify-end space-x-3 pt-4">
              <button
                onClick={() => setIsAddOpen(false)}
                className="px-4 py-2 text-xs font-semibold text-slate-600"
              >
                Abbrechen
              </button>
              <button
                onClick={handleCreate}
                className="bg-[#3B82C4] hover:bg-[#2B6EB0] text-white px-5 py-2 rounded-xl text-xs font-semibold"
              >
                Speichern
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Room Detail & VOB Aufmaß Modal */}
      <RoomDetailModal
        projectId={projectId}
        projectName={projectName || 'Hallenbad Weingarten'}
        room={selectedRoomForDetail}
        positions={positions}
        bookings={bookings}
        photos={selectedRoomForDetail ? getRoomPhotos(selectedRoomForDetail) : []}
        isOpen={!!selectedRoomForDetail}
        onClose={() => setSelectedRoomIdForDetail(null)}
      />

      {/* CAD / Ausführungsplan Viewer Modal */}
      <WebPlanViewerModal
        isOpen={isPlanViewerOpen}
        onClose={() => {
          setIsPlanViewerOpen(false);
          setActiveRoomForViewer(null);
          setActivePlanForViewer(null);
        }}
        plan={activePlanForViewer}
        initialRoom={activeRoomForViewer}
        projectName={projectName || 'Bauvorhaben'}
        rooms={rooms}
      />

      {/* Lightbox / Fullscreen Gallery Modal */}
      {selectedGallery && selectedGallery.photos.length > 0 && (
        <div 
          className="fixed inset-0 z-50 bg-black/90 backdrop-blur-md flex flex-col items-center justify-between p-4 sm:p-6 animate-in fade-in duration-200 select-none"
          onClick={() => setSelectedGallery(null)}
        >
          {/* Header */}
          <div 
            className="w-full max-w-5xl flex items-center justify-between text-white py-2 px-3 z-10"
            onClick={(e) => e.stopPropagation()}
          >
            <div>
              <h3 className="font-bold text-base sm:text-lg flex items-center space-x-2">
                <Camera className="w-5 h-5 text-[#3B82C4]" />
                <span>{selectedGallery.roomTitle}</span>
              </h3>
              <p className="text-xs text-slate-300">
                Beweisfoto {selectedGallery.currentIndex + 1} von {selectedGallery.photos.length}
              </p>
            </div>
            
            <div className="flex items-center space-x-2">
              {typeof selectedGallery.photos[selectedGallery.currentIndex] === 'string' && !selectedGallery.photos[selectedGallery.currentIndex].startsWith('file://') && (
                <a
                  href={selectedGallery.photos[selectedGallery.currentIndex]}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="p-2 rounded-xl bg-white/10 hover:bg-white/20 text-white transition-colors"
                  title="Im neuen Tab öffnen / herunterladen"
                  download
                >
                  <Download className="w-4 h-4" />
                </a>
              )}
              <button
                onClick={() => setSelectedGallery(null)}
                className="p-2 rounded-xl bg-white/10 hover:bg-white/20 text-white transition-colors"
                title="Schließen (Esc)"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Main Photo with Prev / Next Navigation */}
          <div 
            className="relative flex-1 w-full max-w-5xl flex items-center justify-center p-2 my-auto"
            onClick={(e) => e.stopPropagation()}
          >
            {selectedGallery.photos.length > 1 && (
              <button
                onClick={() => setSelectedGallery(prev => prev ? {
                  ...prev,
                  currentIndex: (prev.currentIndex - 1 + prev.photos.length) % prev.photos.length
                } : null)}
                className="absolute left-2 sm:left-4 z-10 p-3 rounded-full bg-black/60 hover:bg-black/80 text-white border border-white/20 shadow-lg backdrop-blur-sm transition-transform hover:scale-110 active:scale-95"
                title="Vorheriges Bild (Pfeiltaste links)"
              >
                <ChevronLeft className="w-6 h-6" />
              </button>
            )}

            <div className="max-h-[75vh] max-w-full flex items-center justify-center rounded-2xl overflow-hidden shadow-2xl bg-black/40">
              {typeof selectedGallery.photos[selectedGallery.currentIndex] === 'string' && !selectedGallery.photos[selectedGallery.currentIndex].startsWith('file://') ? (
                <img
                  src={selectedGallery.photos[selectedGallery.currentIndex]}
                  alt={`Beweisfoto ${selectedGallery.currentIndex + 1}`}
                  className="max-h-[75vh] max-w-full object-contain rounded-xl"
                />
              ) : (
                <div className="p-8 text-center bg-slate-900 text-white rounded-xl max-w-md">
                  <Camera className="w-12 h-12 text-[#3B82C4] mx-auto mb-3" />
                  <h4 className="font-bold text-base">Foto auf Monteur-Smartphone erfasst</h4>
                  <p className="text-xs text-slate-400 mt-2 font-mono break-all">{selectedGallery.photos[selectedGallery.currentIndex]}</p>
                </div>
              )}
            </div>

            {selectedGallery.photos.length > 1 && (
              <button
                onClick={() => setSelectedGallery(prev => prev ? {
                  ...prev,
                  currentIndex: (prev.currentIndex + 1) % prev.photos.length
                } : null)}
                className="absolute right-2 sm:right-4 z-10 p-3 rounded-full bg-black/60 hover:bg-black/80 text-white border border-white/20 shadow-lg backdrop-blur-sm transition-transform hover:scale-110 active:scale-95"
                title="Nächstes Bild (Pfeiltaste rechts)"
              >
                <ChevronRight className="w-6 h-6" />
              </button>
            )}
          </div>

          {/* Bottom Thumbnails Strip */}
          {selectedGallery.photos.length > 1 && (
            <div 
              className="w-full max-w-3xl flex items-center justify-center gap-2 overflow-x-auto py-2 px-4 z-10 scrollbar-thin"
              onClick={(e) => e.stopPropagation()}
            >
              {selectedGallery.photos.map((p, idx) => (
                <button
                  key={idx}
                  onClick={() => setSelectedGallery(prev => prev ? { ...prev, currentIndex: idx } : null)}
                  className={`w-14 h-14 rounded-lg overflow-hidden border-2 transition-all shrink-0 ${
                    idx === selectedGallery.currentIndex
                      ? 'border-[#3B82C4] scale-105 shadow-md shadow-blue-500/30'
                      : 'border-white/20 opacity-50 hover:opacity-100 hover:border-white/60'
                  }`}
                >
                  <img src={p} alt={`Thumbnail ${idx + 1}`} className="w-full h-full object-cover" />
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Modal: Weiteren Plan hochladen */}
      {isAddPlanOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <h3 className="text-base font-bold text-slate-800">
                  Ausführungsplan hochladen
                </h3>
                <p className="text-xs text-slate-500">
                  .DWG, .DXF oder .PDF zu diesem Bauvorhaben hinzufügen
                </p>
              </div>
              <button onClick={() => { setIsAddPlanOpen(false); setNewPlanFile(null); }} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3.5 text-xs">
              <div>
                <label className="block text-slate-700 font-semibold mb-1">
                  Plandatei auswählen:
                </label>
                <input
                  type="file"
                  accept=".dwg,.dxf,.pdf"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) {
                      setNewPlanFile(file);
                      setNewPlanLevel(detectLevelFromFilename(file.name));
                    }
                  }}
                  className="w-full text-xs text-slate-600 file:mr-3 file:py-2 file:px-3 file:rounded-xl file:border-0 file:text-xs file:font-bold file:bg-blue-50 file:text-[#3B82C4] hover:file:bg-blue-100 cursor-pointer"
                />
              </div>

              {newPlanFile && (
                <div>
                  <label className="block text-slate-700 font-semibold mb-1">
                    Ebene / Typ des Plans:
                  </label>
                  <select
                    value={newPlanLevel}
                    onChange={(e) => setNewPlanLevel(e.target.value as PlanLevel)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-800 font-semibold focus:outline-none focus:ring-2 focus:ring-[#3B82C4]"
                  >
                    <option value="UG">UG (Untergeschoss)</option>
                    <option value="EG">EG (Erdgeschoss)</option>
                    <option value="OG">OG (Obergeschoss)</option>
                    <option value="DG">DG (Dachgeschoss)</option>
                    <option value="Strangschema">Strangschema / Isometrie</option>
                    <option value="Sonstiges">Sonstiges</option>
                  </select>
                </div>
              )}
            </div>

            <div className="flex justify-end space-x-3 pt-3 border-t border-slate-100">
              <button
                onClick={() => { setIsAddPlanOpen(false); setNewPlanFile(null); }}
                className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-800"
              >
                Abbrechen
              </button>
              <button
                onClick={handleUploadAdditionalPlan}
                disabled={!newPlanFile || isUploadingPlan}
                className="bg-[#3B82C4] hover:bg-[#2B6EB0] disabled:opacity-50 text-white px-5 py-2 rounded-xl text-xs font-semibold shadow-md flex items-center space-x-1.5"
              >
                {isUploadingPlan ? (
                  <span>Lade hoch & verarbeite...</span>
                ) : (
                  <>
                    <UploadCloud className="w-4 h-4" />
                    <span>Plan speichern</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
