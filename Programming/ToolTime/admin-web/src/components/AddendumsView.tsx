import React, { useState, useMemo } from 'react';
import type { Addendum, Room, Position, Project } from '../types';
import { 
  AlertCircle, 
  CheckCircle, 
  User, 
  MapPin, 
  Clock, 
  Package, 
  HelpCircle, 
  Plus, 
  FileSignature, 
  Calendar,
  Check,
  X,
  Eye,
  CheckCircle2,
  Minus,
  ShoppingCart,
  Send,
  PackageCheck,
  AlertTriangle
} from 'lucide-react';
import { updateAddendumStatus, createAddendum, addPositionDeliveredQty, getMaterialActualQty } from '../services/firestoreService';
import type { Booking } from '../types';

interface AddendumsViewProps {
  addendums: Addendum[];
  projectId?: string;
  project?: Project | null;
  rooms?: Room[];
  positions?: Position[];
  bookings?: Booking[];
}

function getSignatureDetails(sig: any, sigUrl?: string) {
  let imageUrl: string | null = null;
  let paths: string[] = [];

  if (typeof sigUrl === 'string' && (sigUrl.startsWith('http') || sigUrl.startsWith('data:image') || sigUrl.startsWith('blob:'))) {
    imageUrl = sigUrl;
  } else if (typeof sig === 'string' && (sig.startsWith('http') || sig.startsWith('data:image') || sig.startsWith('blob:'))) {
    imageUrl = sig;
  } else if (Array.isArray(sig)) {
    paths = sig.filter(p => typeof p === 'string' && p.trim().length > 0);
  } else if (typeof sig === 'string') {
    const trimmed = sig.trim();
    if (trimmed.startsWith('[') && trimmed.endsWith(']')) {
      try {
        const parsed = JSON.parse(trimmed);
        if (Array.isArray(parsed)) {
          paths = parsed.filter(p => typeof p === 'string' && p.trim().length > 0);
        }
      } catch {}
    } else if (trimmed.startsWith('M') || trimmed.startsWith('m')) {
      paths = [trimmed];
    }
  }

  let viewBox = '0 0 340 120';
  if (paths.length > 0) {
    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
    paths.forEach(p => {
      const nums = p.match(/-?\d+(\.\d+)?/g);
      if (nums && nums.length >= 2) {
        for (let i = 0; i < nums.length; i += 2) {
          const x = parseFloat(nums[i]);
          const y = parseFloat(nums[i + 1]);
          if (!isNaN(x) && !isNaN(y)) {
            if (x < minX) minX = x;
            if (x > maxX) maxX = x;
            if (y < minY) minY = y;
            if (y > maxY) maxY = y;
          }
        }
      }
    });
    if (minX !== Infinity && maxX > minX && maxY > minY) {
      const padX = 16;
      const padY = 14;
      const w = Math.max(80, (maxX - minX) + padX * 2);
      const h = Math.max(50, (maxY - minY) + padY * 2);
      viewBox = `${Math.max(0, minX - padX)} ${Math.max(0, minY - padY)} ${w} ${h}`;
    }
  }

  const hasSignature = Boolean(imageUrl || paths.length > 0 || (sig !== null && sig !== undefined && sig !== false && sig !== ''));
  return { imageUrl, paths, viewBox, hasSignature };
}

function renderSignatureContent(details: ReturnType<typeof getSignatureDetails>, signerName: string) {
  if (details.imageUrl) {
    return (
      <img
        src={details.imageUrl}
        alt="Digitale Unterschrift"
        className="w-full h-full object-contain p-2"
        loading="lazy"
      />
    );
  }
  if (details.paths.length > 0) {
    return (
      <svg viewBox={details.viewBox} className="w-full h-full p-2">
        {details.paths.map((d, idx) => (
          <path
            key={idx}
            d={d}
            stroke="#1A365D"
            strokeWidth="2.8"
            strokeLinecap="round"
            strokeLinejoin="round"
            fill="none"
          />
        ))}
      </svg>
    );
  }
  // Simulated / Authenticated Signature Presentation
  return (
    <div className="relative w-full h-full flex flex-col justify-end p-2.5">
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
        <span className="font-serif italic text-2xl font-bold text-[#1A365D] tracking-wider select-none drop-shadow-xs rotate-[-2deg]">
          {signerName}
        </span>
      </div>
      <div className="flex items-center space-x-2 text-slate-300">
        <span className="text-xs font-black text-slate-400">✕</span>
        <div className="flex-1 h-[1.5px] bg-slate-200 rounded" />
      </div>
    </div>
  );
}

export const AddendumsView: React.FC<AddendumsViewProps> = ({ 
  addendums, 
  projectId = '', 
  project,
  rooms = [], 
  positions = [],
  bookings = []
}) => {
  const [categoryFilter, setCategoryFilter] = useState<'all' | 'time' | 'material' | 'unclear'>('all');
  const [statusFilter, setStatusFilter] = useState<'all' | 'pending' | 'approved' | 'rejected'>('all');
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [hoveredSigId, setHoveredSigId] = useState<string | null>(null);
  const [selectedSignatureItem, setSelectedSignatureItem] = useState<Addendum | null>(null);

  // New Addendum Form State
  const [newType, setNewType] = useState<'stunden' | 'material' | 'unklar'>('material');
  const [newTitle, setNewTitle] = useState('');
  const [newQty, setNewQty] = useState('');
  const [newUnit, setNewUnit] = useState('Stk');
  const [newRoomId, setNewRoomId] = useState('');
  const [newNote, setNewNote] = useState('');
  const [newRequestedBy, setNewRequestedBy] = useState('Bauleiter');

  // Reorder Modal State ("Material Nachbestellen")
  const [reorderItem, setReorderItem] = useState<Addendum | null>(null);
  const [reorderQty, setReorderQty] = useState<number>(1);
  const [mailSubject, setMailSubject] = useState<string>('');
  const [mailBody, setMailBody] = useState<string>('');
  const [isProcessingReorder, setIsProcessingReorder] = useState<boolean>(false);

  // Rejection Modal State ("Ablehnen" mit Begründung)
  const [rejectItem, setRejectItem] = useState<Addendum | null>(null);
  const [rejectReason, setRejectReason] = useState<string>('');
  const [rejectError, setRejectError] = useState<string>('');
  const [isProcessingReject, setIsProcessingReject] = useState<boolean>(false);

  // Fast lookups for positions
  const posMap = useMemo(() => new Map(positions.map(p => [p.posNr, p])), [positions]);
  const posIdMap = useMemo(() => new Map(positions.map(p => [p.id, p])), [positions]);

  // Helper to compute project stock info for any item:
  // "noch verfügbar" vs "laut Projektplanung benötigt"
  const getItemStockInfo = (item: Addendum) => {
    const p = (item.materialId ? posIdMap.get(item.materialId) : undefined) ||
      (item.itemOz ? posMap.get(item.itemOz) : undefined) ||
      positions.find(pos => pos.shortText.trim().toLowerCase() === item.title.trim().toLowerCase());

    const qu = item.qu || p?.qu || 'Stk';

    // 1. Initial stock / delivered
    const initialDelivered = p && p.deliveredQty !== undefined
      ? Number(p.deliveredQty)
      : (Number(p?.qty) || 0);

    // 2. Already installed in all rooms
    let projectInstalledTotal = 0;
    rooms.forEach(r => {
      (r.materials || []).forEach(m => {
        if (
          (p && (m.positionId === p.id || m.posNr === p.posNr)) ||
          m.shortText.trim().toLowerCase() === item.title.trim().toLowerCase() ||
          (item.itemOz && m.posNr === item.itemOz)
        ) {
          projectInstalledTotal += getMaterialActualQty(m, r, bookings);
        }
      });
    });

    // 3. Still needed in unfinished rooms
    let projectNeeded = 0;
    rooms.forEach(r => {
      const isUnlocked = r.isCompleted === false || r.status === 'in_progress';
      const isDone = !isUnlocked && (r.status === 'completed' || r.isCompleted === true || ((r as any).pct === 100));

      if (!isDone) {
        (r.materials || []).forEach(m => {
          if (
            (p && (m.positionId === p.id || m.posNr === p.posNr)) ||
            m.shortText.trim().toLowerCase() === item.title.trim().toLowerCase() ||
            (item.itemOz && m.posNr === item.itemOz)
          ) {
            const pl = Number(m.plannedQty) || 0;
            const act = getMaterialActualQty(m, r, bookings);
            const remaining = Math.max(0, pl - act);
            projectNeeded += remaining;
          }
        });
      }
    });

    const projectAvailable = Math.max(0, initialDelivered - projectInstalledTotal);
    const isSufficient = projectAvailable >= projectNeeded;
    const deficit = Math.max(0, projectNeeded - projectAvailable);

    return {
      projectAvailable,
      projectNeeded,
      isSufficient,
      deficit,
      qu,
      hasPositionMatch: !!p
    };
  };

  const managerFirstName = (project?.commercialManager || 'Sabine').trim().split(/\s+/)[0];

  const generateMailContent = (item: Addendum, qty: number, unit: string) => {
    const pName = project?.name || 'Bauvorhaben';
    const subj = `Nachbestellung erforderlich: ${qty} ${unit} ${item.title} (Projekt ${pName})`;
    const body = `Hallo ${managerFirstName},

für das Bauvorhaben "${pName}" muss folgendes Material dringend nachbestellt werden:

• Material: ${item.title}
• Menge: ${qty} ${unit}
• Raum: ${item.roomName || item.roomId || 'Baustelle'}
• Anforderer: ${item.requestedBy || 'Monteur'}
• Begründung / Notiz: ${item.note || 'Mehrbedarf / ungeplant verbautes Material auf der Baustelle'}

Bitte veranlasse die Nachbestellung zeitnah, damit die Montage vor Ort zügig fortgesetzt werden kann.

Viele Grüße,
Bauleitung`;
    return { subj, body };
  };

  // 1. Direct In-Stock Approval: "Material verfügbar - Freigeben"
  const handleApproveInStock = async (item: Addendum) => {
    const rawQty = typeof item.quantity === 'number' ? item.quantity : parseFloat(String(item.quantity).replace(',', '.')) || 1;
    const unit = item.qu || (typeof item.quantity === 'string' && item.quantity.includes('m') ? 'm' : 'Stk');
    const targetKey = item.materialId || item.itemOz || item.title;

    // Verfügbare Menge erhöht sich entsprechend
    await addPositionDeliveredQty(projectId, targetKey, rawQty, unit);
    await updateAddendumStatus(item.id, 'approved', projectId, {
      approvalType: 'in_stock'
    });
  };

  // 2. Acknowledge Notice: "Hinweis schließen" (für ungeplant verbautes Material)
  const handleAcknowledgeUnclear = async (item: Addendum) => {
    await updateAddendumStatus(item.id, 'approved', projectId, {
      approvalType: 'in_stock'
    });
  };

  // For Regiestunden / Arbeitszeit
  const handleApproveHours = async (item: Addendum) => {
    await updateAddendumStatus(item.id, 'approved', projectId, {
      approvalType: 'in_stock'
    });
  };

  // 2. Open Reorder Modal: "Material Nachbestellen"
  const handleOpenReorderModal = (item: Addendum) => {
    const rawQty = typeof item.quantity === 'number' ? item.quantity : parseFloat(String(item.quantity).replace(',', '.')) || 1;
    const initQty = Math.max(1, rawQty);
    const unit = item.qu || (typeof item.quantity === 'string' && item.quantity.includes('m') ? 'm' : 'Stk');
    const { subj, body } = generateMailContent(item, initQty, unit);

    setReorderItem(item);
    setReorderQty(initQty);
    setMailSubject(subj);
    setMailBody(body);
  };

  const handleChangeReorderQty = (newQty: number) => {
    const unit = reorderItem?.qu || (typeof reorderItem?.quantity === 'string' && reorderItem.quantity.includes('m') ? 'm' : 'Stk');
    const clean = Math.max(1, Math.round(newQty * 10) / 10);
    setReorderQty(clean);

    if (reorderItem) {
      const { subj, body } = generateMailContent(reorderItem, clean, unit);
      setMailSubject(subj);
      setMailBody(body);
    }
  };

  const handleConfirmReorder = async () => {
    if (!reorderItem) return;
    setIsProcessingReorder(true);
    try {
      const unit = reorderItem.qu || (typeof reorderItem.quantity === 'string' && reorderItem.quantity.includes('m') ? 'm' : 'Stk');
      const targetKey = reorderItem.materialId || reorderItem.itemOz || reorderItem.title;

      // Verfügbare Menge erhöht sich entsprechend
      await addPositionDeliveredQty(projectId, targetKey, reorderQty, unit);
      await updateAddendumStatus(reorderItem.id, 'approved', projectId, {
        approvalType: 'reordered',
        reorderedQty: reorderQty,
      });

      setReorderItem(null);
    } catch (err: any) {
      console.warn('Error confirming reorder:', err.message);
    } finally {
      setIsProcessingReorder(false);
    }
  };

  // 3. Confirm Rejection: "Ablehnen" mit Begründung
  const handleConfirmReject = async () => {
    if (!rejectItem) return;
    if (!rejectReason.trim()) {
      setRejectError('Bitte geben Sie einen Grund für die Ablehnung an.');
      return;
    }

    setIsProcessingReject(true);
    try {
      // Nach Klick "abgelehnt", verfügbare Menge ändert sich nicht
      await updateAddendumStatus(rejectItem.id, 'rejected', projectId, {
        rejectionReason: rejectReason.trim(),
      });
      setRejectItem(null);
      setRejectReason('');
      setRejectError('');
    } catch (err: any) {
      console.warn('Error rejecting addendum:', err.message);
    } finally {
      setIsProcessingReject(false);
    }
  };

  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim()) return;

    const selectedRoom = rooms.find(r => r.id === newRoomId);
    await createAddendum(projectId, {
      type: newType,
      title: newTitle.trim(),
      quantity: newQty.trim() || (newType === 'stunden' ? '1 h' : '1'),
      qu: newType === 'stunden' ? 'h' : newUnit,
      roomId: newRoomId || 'allgemein',
      roomName: selectedRoom ? selectedRoom.name : 'Baustelle allgemein',
      note: newNote.trim(),
      requestedBy: newRequestedBy.trim() || 'Bauleiter',
      status: 'pending',
    });

    setIsCreateModalOpen(false);
    setNewTitle('');
    setNewQty('');
    setNewNote('');
  };

  // Classify each addendum into 1 of the 3 requested categories:
  // 1. time: 'stunden' | 'zeit' | 'regie'
  // 2. material: 'material' | 'zusatz'
  // 3. unclear: 'unklar' | isUnclear === true | itemOz === 'UNKLAR'
  const getItemCategory = (item: Addendum): 'time' | 'material' | 'unclear' => {
    const t = (item.type || '').toLowerCase();
    if (t === 'stunden' || t === 'zeit' || t === 'regie' || item.qu === 'h' || item.qu === 'Std') {
      return 'time';
    }
    if (t === 'unklar' || item.isUnclear || item.itemOz === 'UNKLAR') {
      return 'unclear';
    }
    return 'material';
  };

  // Metrics
  const totalCount = addendums.length;
  const timeItems = addendums.filter(a => getItemCategory(a) === 'time');
  const materialItems = addendums.filter(a => getItemCategory(a) === 'material');
  const unclearItems = addendums.filter(a => getItemCategory(a) === 'unclear');

  const openTimeCount = timeItems.filter(a => a.status === 'pending').length;
  const openMaterialCount = materialItems.filter(a => a.status === 'pending').length;
  const openUnclearCount = unclearItems.filter(a => a.status === 'pending').length;

  // Filtered List
  const displayedList = addendums.filter(item => {
    const cat = getItemCategory(item);
    if (categoryFilter !== 'all' && cat !== categoryFilter) return false;
    if (statusFilter !== 'all' && item.status !== statusFilter) return false;
    return true;
  });

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-amber-500 to-amber-600 text-white flex items-center justify-center shadow-md shadow-amber-500/20">
              <AlertCircle className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-slate-900 tracking-tight">
                Mehrbedarf / anders verbaut
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Baustellen-Mehraufwände: Mehrstunden/Regie, zusätzliches Material und ungeplant verbaute Bauteile
              </p>
            </div>
          </div>
        </div>

        <button
          onClick={() => setIsCreateModalOpen(true)}
          className="inline-flex items-center space-x-2 bg-[#3B82C4] hover:bg-[#2B6EB0] text-white px-4 py-2.5 rounded-xl text-xs font-bold shadow-sm transition-all hover:scale-[1.02] active:scale-[0.98] self-start md:self-auto"
        >
          <Plus className="w-4 h-4" />
          <span>+ Mehrbedarf erfassen</span>
        </button>
      </div>

      {/* KPI Cards: The 3 Core Categories */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Category 1: Time / Hours */}
        <div 
          onClick={() => setCategoryFilter(categoryFilter === 'time' ? 'all' : 'time')}
          className={`cursor-pointer bg-white rounded-2xl border p-5 shadow-xs transition-all hover:border-amber-400 ${
            categoryFilter === 'time' ? 'ring-2 ring-amber-500 border-amber-500' : 'border-slate-200'
          }`}
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2.5">
              <div className="w-9 h-9 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center font-bold">
                <Clock className="w-5 h-5" />
              </div>
              <div>
                <span className="text-xs font-bold text-slate-800 block">Mehr Zeit / Regie</span>
                <span className="text-[10px] text-slate-400">Verzögerung, Mehraufwand</span>
              </div>
            </div>
            <span className="text-xl font-black text-amber-600">
              {timeItems.length}
            </span>
          </div>
          <div className="mt-3 pt-3 border-t border-slate-100 flex items-center justify-between text-xs">
            <span className="text-slate-500 text-[11px]">Offene Prüfungen:</span>
            <span className="font-bold text-amber-700 bg-amber-50 px-2 py-0.5 rounded-full text-[10px]">
              {openTimeCount} ausstehend
            </span>
          </div>
        </div>

        {/* Category 2: Additional Material */}
        <div 
          onClick={() => setCategoryFilter(categoryFilter === 'material' ? 'all' : 'material')}
          className={`cursor-pointer bg-white rounded-2xl border p-5 shadow-xs transition-all hover:border-blue-400 ${
            categoryFilter === 'material' ? 'ring-2 ring-[#3B82C4] border-[#3B82C4]' : 'border-slate-200'
          }`}
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2.5">
              <div className="w-9 h-9 rounded-xl bg-blue-50 text-[#3B82C4] flex items-center justify-center font-bold">
                <Package className="w-5 h-5" />
              </div>
              <div>
                <span className="text-xs font-bold text-slate-800 block">Mehr Material angefragt</span>
                <span className="text-[10px] text-slate-400">Zusatzmaterial, Mehrbedarf</span>
              </div>
            </div>
            <span className="text-xl font-black text-[#3B82C4]">
              {materialItems.length}
            </span>
          </div>
          <div className="mt-3 pt-3 border-t border-slate-100 flex items-center justify-between text-xs">
            <span className="text-slate-500 text-[11px]">Offene Prüfungen:</span>
            <span className="font-bold text-blue-700 bg-blue-50 px-2 py-0.5 rounded-full text-[10px]">
              {openMaterialCount} ausstehend
            </span>
          </div>
        </div>

        {/* Category 3: Unplanned Material Installed */}
        <div 
          onClick={() => setCategoryFilter(categoryFilter === 'unclear' ? 'all' : 'unclear')}
          className={`cursor-pointer bg-white rounded-2xl border p-5 shadow-xs transition-all hover:border-purple-400 ${
            categoryFilter === 'unclear' ? 'ring-2 ring-purple-500 border-purple-500' : 'border-slate-200'
          }`}
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2.5">
              <div className="w-9 h-9 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center font-bold">
                <HelpCircle className="w-5 h-5" />
              </div>
              <div>
                <span className="text-xs font-bold text-slate-800 block">Ungeplantes Material verbaut</span>
                <span className="text-[10px] text-slate-400">Nicht im ursprünglichen Plan</span>
              </div>
            </div>
            <span className="text-xl font-black text-purple-600">
              {unclearItems.length}
            </span>
          </div>
          <div className="mt-3 pt-3 border-t border-slate-100 flex items-center justify-between text-xs">
            <span className="text-slate-500 text-[11px]">Offene Prüfungen:</span>
            <span className="font-bold text-purple-700 bg-purple-50 px-2 py-0.5 rounded-full text-[10px]">
              {openUnclearCount} ausstehend
            </span>
          </div>
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        {/* Categories */}
        <div className="flex flex-wrap items-center gap-1.5">
          {[
            { id: 'all' as const, label: `Alle Meldungen (${totalCount})` },
            { id: 'time' as const, label: `⏱ Mehr Zeit (${timeItems.length})` },
            { id: 'material' as const, label: `📦 Mehr Material (${materialItems.length})` },
            { id: 'unclear' as const, label: `❓ Ungeplantes Material (${unclearItems.length})` },
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setCategoryFilter(tab.id)}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all ${
                categoryFilter === tab.id
                  ? 'bg-slate-900 text-white shadow-xs'
                  : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Status Filter */}
        <div className="flex items-center space-x-1.5 bg-slate-100 p-1 rounded-xl">
          {[
            { id: 'all' as const, label: 'Alle Status' },
            { id: 'pending' as const, label: 'Ausstehend' },
            { id: 'approved' as const, label: 'Freigegeben' },
            { id: 'rejected' as const, label: 'Abgelehnt' },
          ].map(s => (
            <button
              key={s.id}
              onClick={() => setStatusFilter(s.id)}
              className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-colors ${
                statusFilter === s.id
                  ? 'bg-white text-slate-800 shadow-xs font-bold'
                  : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              {s.label}
            </button>
          ))}
        </div>
      </div>

      {/* Content Grid: Kacheln */}
      {displayedList.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center space-y-3 shadow-xs">
          <div className="w-12 h-12 rounded-full bg-slate-100 text-slate-400 flex items-center justify-center mx-auto">
            <CheckCircle className="w-6 h-6 text-emerald-500" />
          </div>
          <h3 className="font-bold text-slate-800 text-sm">Keine Einträge für diese Filterauswahl</h3>
          <p className="text-xs text-slate-400 max-w-sm mx-auto">
            Aktuell liegen für diesen Filter keine Mehrbedarfe oder unklaren Positionen vor. Alle Leistungen verlaufen planmäßig.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {displayedList.map(item => {
            const cat = getItemCategory(item);
            const isPending = item.status === 'pending';
            const isApproved = item.status === 'approved';
            const isRejected = item.status === 'rejected';
            const stockInfo = (cat === 'material' || cat === 'unclear') ? getItemStockInfo(item) : null;

            // Styling based on category
            const theme = cat === 'time' ? {
              badgeBg: 'bg-amber-50 text-amber-800 border-amber-200',
              icon: Clock,
              iconColor: 'text-amber-600',
              label: '⏱ Mehr Zeit / Regie',
              tagBg: 'bg-amber-50 text-amber-700',
            } : cat === 'unclear' ? {
              badgeBg: 'bg-purple-50 text-purple-800 border-purple-200',
              icon: HelpCircle,
              iconColor: 'text-purple-600',
              label: '❓ Ungeplantes Material verbaut',
              tagBg: 'bg-purple-50 text-purple-700',
            } : {
              badgeBg: 'bg-blue-50 text-blue-800 border-blue-200',
              icon: Package,
              iconColor: 'text-[#3B82C4]',
              label: '📦 Mehr Material angefragt',
              tagBg: 'bg-blue-50 text-[#3B82C4]',
            };

            const IconComp = theme.icon;

            return (
              <div 
                key={item.id}
                className="bg-white rounded-2xl border border-slate-200 shadow-xs p-5 hover:border-slate-300 transition-all flex flex-col justify-between space-y-4"
              >
                <div className="space-y-3">
                  {/* Top Bar: Category Badge + Status Badge */}
                  <div className="flex items-start justify-between gap-2">
                    <span className={`inline-flex items-center space-x-1.5 px-2.5 py-1 rounded-lg text-xs font-bold border ${theme.badgeBg}`}>
                      <IconComp className={`w-3.5 h-3.5 ${theme.iconColor}`} />
                      <span>{theme.label}</span>
                    </span>

                    <span className={`px-2.5 py-0.5 rounded-full text-[11px] font-bold shrink-0 ${
                      isApproved ? 'bg-emerald-100 text-emerald-800 border border-emerald-200' :
                      isRejected ? 'bg-red-100 text-red-800 border border-red-200' :
                      'bg-amber-100 text-amber-800 border border-amber-200'
                    }`}>
                      {isApproved 
                        ? (item.approvalType === 'reordered' 
                            ? `Freigegeben (Nachbestellt: ${item.reorderedQty || item.quantity})` 
                            : (cat === 'unclear' ? 'Geprüft & Hinweis geschlossen' : 'Freigegeben (Lagerbestand)')) 
                        : isRejected ? 'Abgelehnt' : 'Ausstehend'}
                    </span>
                  </div>

                  {/* Title & Quantity Pill */}
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <h4 className="font-bold text-slate-900 text-base leading-snug">
                        {item.title}
                      </h4>
                      {item.description && item.description !== item.title && (
                        <p className="text-xs text-slate-500 mt-0.5">{item.description}</p>
                      )}
                    </div>

                    <div className="text-right shrink-0">
                      <span className="font-mono font-black text-sm text-slate-900 bg-slate-100 px-2.5 py-1 rounded-lg block">
                        {item.quantity} {item.qu && !String(item.quantity).includes(item.qu) ? item.qu : ''}
                      </span>
                    </div>
                  </div>

                  {/* Room & Submitter Meta Info */}
                  <div className="flex flex-wrap items-center gap-3 text-xs text-slate-500 pt-1">
                    <div className="flex items-center space-x-1 text-[#3B82C4] font-medium bg-blue-50/60 px-2 py-0.5 rounded-md">
                      <MapPin className="w-3.5 h-3.5" />
                      <span>{item.roomName || item.roomId || 'Baustelle'}</span>
                    </div>

                    <div className="flex items-center space-x-1 font-medium">
                      <User className="w-3.5 h-3.5 text-slate-400" />
                      <span>{item.requestedBy || 'Monteur'}</span>
                    </div>

                    <div className="flex items-center space-x-1 text-slate-400">
                      <Calendar className="w-3.5 h-3.5" />
                      <span>{item.createdAt ? new Date(item.createdAt).toLocaleDateString('de-DE') : '-'}</span>
                    </div>
                  </div>

                  {/* Monteur Note / Begründung */}
                  {item.note && (
                    <div className="p-3 rounded-xl bg-slate-50 border border-slate-100 text-xs text-slate-700 space-y-1">
                      <span className="font-bold text-[10px] text-slate-400 uppercase tracking-wider block">
                        Begründung / Notiz vom Monteur:
                      </span>
                      <p className="leading-relaxed italic">„{item.note}“</p>
                    </div>
                  )}

                  {/* Special indicator for unclear items */}
                  {cat === 'unclear' && (
                    <div className="flex items-center space-x-2 text-[11px] text-purple-700 bg-purple-50 border border-purple-200 px-3 py-1.5 rounded-xl">
                      <HelpCircle className="w-4 h-4 shrink-0 text-purple-600" />
                      <span>
                        {item.isOrdered
                          ? `Teil ist bereits im Materialstamm vorhanden (Pos. ${item.itemOz || '–'}), war aber nicht diesem Raum zugeordnet.`
                          : 'Neues/Alternatives Fabrikat verbaut, das zuvor nicht in der Planung hinterlegt war.'}
                      </span>
                    </div>
                  )}

                  {/* Projektweiter Materialbestand & Bedarfsampel (Entscheidungshilfe für Bauleitung) */}
                  {stockInfo && (
                    <div className="p-3 bg-slate-50/80 rounded-xl border border-slate-200 space-y-2">
                      <div className="flex items-center justify-between text-[11px] font-bold text-slate-700">
                        <span className="flex items-center space-x-1">
                          <Package className="w-3.5 h-3.5 text-[#3B82C4]" />
                          <span>Projektweiter Materialbestand</span>
                        </span>
                        {stockInfo.isSufficient ? (
                          <span className="inline-flex items-center space-x-1 text-[10.5px] font-bold text-emerald-800 bg-emerald-100/90 px-2 py-0.5 rounded-full">
                            <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                            <span>Bestand reicht für Restprojekt aus</span>
                          </span>
                        ) : (
                          <span className="inline-flex items-center space-x-1 text-[10.5px] font-bold text-red-800 bg-red-100/90 px-2 py-0.5 rounded-full border border-red-200">
                            <AlertTriangle className="w-3 h-3 text-red-600" />
                            <span>Fehlmenge: {stockInfo.deficit} {stockInfo.qu}</span>
                          </span>
                        )}
                      </div>

                      <div className="grid grid-cols-2 gap-2 text-center">
                        <div className="bg-white p-2 rounded-lg border border-slate-200/80 shadow-2xs">
                          <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">Noch verfügbar</span>
                          <span className={`text-sm font-black block mt-0.5 ${stockInfo.isSufficient ? 'text-emerald-700' : 'text-red-600'}`}>
                            {stockInfo.projectAvailable} {stockInfo.qu}
                          </span>
                          <span className="text-[9px] text-slate-400 block">Lager / Projektbestand</span>
                        </div>
                        <div className="bg-white p-2 rounded-lg border border-slate-200/80 shadow-2xs">
                          <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">Laut Planung benötigt</span>
                          <span className="text-sm font-black text-slate-800 block mt-0.5">
                            {stockInfo.projectNeeded} {stockInfo.qu}
                          </span>
                          <span className="text-[9px] text-slate-400 block">in weiteren Räumen</span>
                        </div>
                      </div>

                      {!stockInfo.isSufficient && (
                        <p className="text-[10.5px] text-red-700 font-medium bg-red-50/80 p-1.5 rounded-md text-center">
                          Achtung: Der verbleibende Bestand reicht nicht für alle weiteren Räume aus! Bitte nachbestellen.
                        </p>
                      )}
                    </div>
                  )}

                  {/* Rejection reason notice if rejected */}
                  {isRejected && item.rejectionReason && (
                    <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-xs text-red-800 space-y-1">
                      <span className="font-bold text-[10.5px] text-red-600 uppercase tracking-wider flex items-center space-x-1">
                        <AlertTriangle className="w-3.5 h-3.5 text-red-500" />
                        <span>Begründung der Ablehnung:</span>
                      </span>
                      <p className="leading-relaxed font-medium italic">„{item.rejectionReason}“</p>
                    </div>
                  )}

                  {/* Signature badge if available with Mouseover Popover & Click Modal */}
                  {(() => {
                    const sigDetails = getSignatureDetails(item.signature, item.signatureUrl);
                    if (!sigDetails.hasSignature) return null;
                    return (
                      <div 
                        className="relative inline-block"
                        onMouseEnter={() => setHoveredSigId(item.id)}
                        onMouseLeave={() => setHoveredSigId(null)}
                      >
                        <button
                          type="button"
                          onClick={() => setSelectedSignatureItem(item)}
                          className="flex items-center space-x-1.5 text-xs text-emerald-700 font-semibold bg-emerald-50 hover:bg-emerald-100 border border-emerald-200/90 px-2.5 py-1 rounded-lg w-fit transition-all cursor-pointer shadow-2xs group"
                          title="Digitale Unterschrift ansehen (Mouseover oder Klick)"
                        >
                          <FileSignature className="w-3.5 h-3.5 text-emerald-600" />
                          <span>Digital unterschrieben</span>
                          <Eye className="w-3 h-3 text-emerald-500 opacity-60 group-hover:opacity-100 transition-opacity ml-0.5" />
                        </button>

                        {/* Mouseover Popover */}
                        {hoveredSigId === item.id && (
                          <div 
                            className="absolute left-0 bottom-full mb-2 z-50 w-72 sm:w-80 bg-white rounded-2xl shadow-xl border border-slate-200 p-3.5 pointer-events-auto animate-in fade-in zoom-in-95 duration-150"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <div className="flex items-center justify-between pb-2 mb-2 border-b border-slate-100">
                              <div className="flex items-center space-x-2">
                                <div className="w-7 h-7 rounded-lg bg-emerald-50 border border-emerald-200 flex items-center justify-center text-emerald-700">
                                  <FileSignature className="w-4 h-4" />
                                </div>
                                <div>
                                  <h5 className="font-bold text-xs text-slate-900 leading-tight">
                                    Digitale Unterschrift
                                  </h5>
                                  <p className="text-[10px] text-slate-500">
                                    Erfasst via Monteur-App
                                  </p>
                                </div>
                              </div>
                              <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full flex items-center space-x-1">
                                <CheckCircle2 className="w-2.5 h-2.5" />
                                <span>Verifiziert</span>
                              </span>
                            </div>

                            {/* Signature Drawing / Canvas Box */}
                            <div className="w-full h-28 bg-[#FAFCFE] border border-slate-200 rounded-xl overflow-hidden relative shadow-2xs flex items-center justify-center">
                              {renderSignatureContent(sigDetails, item.requestedBy || 'Stefan Maier')}
                            </div>

                            {/* Meta & Timestamp */}
                            <div className="pt-2 mt-2 border-t border-slate-100 space-y-1">
                              <div className="flex items-center justify-between text-[11px]">
                                <span className="text-slate-400">Unterzeichner:</span>
                                <span className="font-semibold text-slate-800">{item.requestedBy || 'Monteur'}</span>
                              </div>
                              <div className="flex items-center justify-between text-[11px]">
                                <span className="text-slate-400">Raum:</span>
                                <span className="font-medium text-slate-700">{item.roomName || item.roomId || 'Baustelle'}</span>
                              </div>
                              <div className="flex items-center justify-between text-[11px]">
                                <span className="text-slate-400">Datum & Uhrzeit:</span>
                                <span className="font-mono text-slate-600 text-[10.5px]">
                                  {item.createdAt ? new Date(item.createdAt).toLocaleString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '22.09.2026'}
                                </span>
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })()}
                </div>

                {/* Bottom Actions for Bauleiter / Admin */}
                {isPending ? (
                  <div className="pt-3 border-t border-slate-100 flex flex-wrap items-center justify-end gap-2">
                    {cat === 'unclear' ? (
                      <>
                        <button
                          type="button"
                          onClick={() => handleAcknowledgeUnclear(item)}
                          className="flex items-center space-x-1.5 px-3.5 py-1.5 rounded-xl text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 border border-slate-300 transition-colors"
                          title="Hinweis zur Kenntnis nehmen und schließen (Material war bereits vorhanden)"
                        >
                          <Check className="w-3.5 h-3.5 text-slate-600" />
                          <span>Hinweis schließen</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => handleOpenReorderModal(item)}
                          className="flex items-center space-x-1.5 px-3.5 py-1.5 rounded-xl text-xs font-bold text-white bg-[#3B82C4] hover:bg-[#2B6EB0] transition-all shadow-xs hover:scale-[1.01]"
                          title="Material reicht nicht für Restprojekt – Modal zur Nachbestellung öffnen"
                        >
                          <ShoppingCart className="w-3.5 h-3.5" />
                          <span>Material Nachbestellen</span>
                        </button>
                      </>
                    ) : (
                      <>
                        <button
                          type="button"
                          onClick={() => {
                            setRejectItem(item);
                            setRejectReason('');
                            setRejectError('');
                          }}
                          className="flex items-center space-x-1 px-3 py-1.5 rounded-xl text-xs font-semibold text-red-700 bg-red-50 hover:bg-red-100 border border-red-200 transition-colors"
                          title="Diesen Mehrbedarf ablehnen (Begründung erforderlich)"
                        >
                          <X className="w-3.5 h-3.5" />
                          <span>Ablehnen</span>
                        </button>

                        {cat === 'time' ? (
                          <button
                            type="button"
                            onClick={() => handleApproveHours(item)}
                            className="flex items-center space-x-1.5 px-4 py-1.5 rounded-xl text-xs font-bold text-white bg-[#2FA36B] hover:bg-[#258757] transition-all shadow-xs hover:scale-[1.01]"
                            title="Regiestunden freigeben"
                          >
                            <Check className="w-3.5 h-3.5" />
                            <span>Regiestunden freigeben</span>
                          </button>
                        ) : (
                          <>
                            <button
                              type="button"
                              onClick={() => handleApproveInStock(item)}
                              className="flex items-center space-x-1.5 px-3.5 py-1.5 rounded-xl text-xs font-bold text-white bg-[#2FA36B] hover:bg-[#258757] transition-all shadow-xs hover:scale-[1.01]"
                              title="Material ist im Lager vorhanden und wird zum Verbauen freigegeben (verfügbare Menge erhöht sich)"
                            >
                              <PackageCheck className="w-3.5 h-3.5" />
                              <span>Material verfügbar – Freigeben</span>
                            </button>

                            <button
                              type="button"
                              onClick={() => handleOpenReorderModal(item)}
                              className="flex items-center space-x-1.5 px-3.5 py-1.5 rounded-xl text-xs font-bold text-white bg-[#3B82C4] hover:bg-[#2B6EB0] transition-all shadow-xs hover:scale-[1.01]"
                              title="Material ist nicht mehr im Lager vorhanden – Modal zur Nachbestellung öffnen"
                            >
                              <ShoppingCart className="w-3.5 h-3.5" />
                              <span>Material Nachbestellen</span>
                            </button>
                          </>
                        )}
                      </>
                    )}
                  </div>
                ) : (
                  <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-xs text-slate-400">
                    <span className="font-medium text-slate-600">
                      {isApproved && item.approvalType === 'reordered' && '✓ Nachbestellung veranlasst & freigegeben'}
                      {isApproved && item.approvalType !== 'reordered' && (cat === 'unclear' ? '✓ Geprüft & Hinweis geschlossen' : '✓ Aus Lagerbestand freigegeben')}
                      {isRejected && '✕ Durch Bauleitung abgelehnt'}
                    </span>
                    <button
                      onClick={() => updateAddendumStatus(item.id, 'pending', projectId)}
                      className="text-[#3B82C4] hover:underline text-[11px]"
                    >
                      Status zurücksetzen
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Modal: Mehrbedarf manuell erfassen */}
      {isCreateModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-lg w-full p-6 space-y-5 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="font-bold text-base text-slate-900 flex items-center space-x-2">
                <Plus className="w-5 h-5 text-[#3B82C4]" />
                <span>Mehrbedarf / Unklar manuell erfassen</span>
              </h3>
              <button 
                onClick={() => setIsCreateModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 p-1"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateSubmit} className="space-y-4 text-xs">
              {/* Type Selection */}
              <div>
                <label className="font-bold text-slate-700 block mb-1.5">Art des Mehraufwands *</label>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { id: 'material' as const, label: '📦 Material', sub: 'Anderes Material' },
                    { id: 'stunden' as const, label: '⏱ Stunden', sub: 'Mehr Zeit / Regie' },
                    { id: 'unklar' as const, label: '❓ Unklar', sub: 'Nicht im Plan' },
                  ].map(t => (
                    <button
                      type="button"
                      key={t.id}
                      onClick={() => setNewType(t.id)}
                      className={`p-2.5 rounded-xl border text-left transition-all ${
                        newType === t.id
                          ? 'border-[#3B82C4] bg-blue-50 text-[#3B82C4] font-bold'
                          : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                      }`}
                    >
                      <div className="text-xs">{t.label}</div>
                      <div className="text-[10px] text-slate-400">{t.sub}</div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Title / Description */}
              <div>
                <label className="font-bold text-slate-700 block mb-1">
                  {newType === 'stunden' ? 'Tätigkeit / Grund für Mehraufwand *' : 'Material- oder Bauteilbezeichnung *'}
                </label>
                <input
                  type="text"
                  required
                  placeholder={newType === 'stunden' ? 'z. B. Stemmarbeiten Schacht EG' : 'z. B. 3x Bogen 90° DN 100'}
                  value={newTitle}
                  onChange={e => setNewTitle(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#3B82C4]/30"
                />
              </div>

              {/* Quantity & Unit */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-bold text-slate-700 block mb-1">
                    {newType === 'stunden' ? 'Stundenanzahl *' : 'Menge *'}
                  </label>
                  <input
                    type="text"
                    required
                    placeholder={newType === 'stunden' ? 'z. B. 2.5' : 'z. B. 4'}
                    value={newQty}
                    onChange={e => setNewQty(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#3B82C4]/30"
                  />
                </div>

                <div>
                  <label className="font-bold text-slate-700 block mb-1">Einheit</label>
                  {newType === 'stunden' ? (
                    <input
                      type="text"
                      disabled
                      value="Stunden (h)"
                      className="w-full px-3 py-2 bg-slate-100 border border-slate-200 rounded-xl text-slate-500"
                    />
                  ) : (
                    <select
                      value={newUnit}
                      onChange={e => setNewUnit(e.target.value)}
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#3B82C4]/30"
                    >
                      <option value="Stk">Stück (Stk)</option>
                      <option value="m">Meter (m)</option>
                      <option value="m²">Quadratmeter (m²)</option>
                      <option value="kg">Kilogramm (kg)</option>
                      <option value="Psch">Pauschal (Psch)</option>
                    </select>
                  )}
                </div>
              </div>

              {/* Room Assignment */}
              <div>
                <label className="font-bold text-slate-700 block mb-1">Zugehöriger Raum</label>
                <select
                  value={newRoomId}
                  onChange={e => setNewRoomId(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#3B82C4]/30"
                >
                  <option value="">Baustelle allgemein</option>
                  {rooms.map(r => (
                    <option key={r.id} value={r.id}>
                      {r.name} ({r.code || 'Raum'}) - {r.floor}
                    </option>
                  ))}
                </select>
              </div>

              {/* Note / Details */}
              <div>
                <label className="font-bold text-slate-700 block mb-1">Begründung / Zusätzliche Notiz</label>
                <textarea
                  rows={2}
                  placeholder="Details zur Ursache, Baustellenbedingungen oder Notwendigkeit..."
                  value={newNote}
                  onChange={e => setNewNote(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#3B82C4]/30"
                />
              </div>

              {/* Requested By */}
              <div>
                <label className="font-bold text-slate-700 block mb-1">Gemeldet durch</label>
                <input
                  type="text"
                  placeholder="z. B. Florian Buck (Bauleiter)"
                  value={newRequestedBy}
                  onChange={e => setNewRequestedBy(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#3B82C4]/30"
                />
              </div>

              {/* Action Buttons */}
              <div className="pt-2 flex justify-end space-x-2">
                <button
                  type="button"
                  onClick={() => setIsCreateModalOpen(false)}
                  className="px-4 py-2 rounded-xl text-slate-600 hover:bg-slate-100 font-semibold"
                >
                  Abbrechen
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-[#3B82C4] hover:bg-[#2B6EB0] text-white font-bold shadow-sm transition-all"
                >
                  Mehrbedarf anlegen
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Digitale Unterschrift Detailansicht */}
      {selectedSignatureItem && (() => {
        const sigDetails = getSignatureDetails(selectedSignatureItem.signature, selectedSignatureItem.signatureUrl);
        return (
          <div 
            className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4"
            onClick={() => setSelectedSignatureItem(null)}
          >
            <div 
              className="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-md w-full p-6 space-y-4 animate-in fade-in zoom-in-95 duration-150"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <div className="flex items-center space-x-2.5">
                  <div className="w-9 h-9 rounded-xl bg-emerald-50 border border-emerald-200 flex items-center justify-center text-emerald-700">
                    <FileSignature className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="font-bold text-base text-slate-900">
                      Digitale Unterschrift
                    </h3>
                    <p className="text-xs text-slate-500">
                      Rechtsverbindlich signiert in Monteur-App
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setSelectedSignatureItem(null)}
                  className="text-slate-400 hover:text-slate-600 p-1.5 rounded-lg hover:bg-slate-100"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Title & Info */}
              <div className="bg-slate-50 border border-slate-200/80 rounded-xl p-3 space-y-1">
                <span className="text-[10px] font-bold uppercase text-slate-400">Position / Mehrbedarf:</span>
                <p className="font-bold text-sm text-slate-900">{selectedSignatureItem.title}</p>
                <div className="flex items-center justify-between text-xs text-slate-600 pt-1">
                  <span>Menge: <strong>{selectedSignatureItem.quantity} {selectedSignatureItem.qu || ''}</strong></span>
                  <span>Raum: <strong>{selectedSignatureItem.roomName || selectedSignatureItem.roomId || 'Baustelle'}</strong></span>
                </div>
              </div>

              {/* Large Signature Pad View */}
              <div className="space-y-1">
                <span className="text-xs font-bold text-slate-700">Signatur-Nachweis:</span>
                <div className="w-full h-44 bg-[#FAFCFE] border-2 border-slate-200 rounded-xl overflow-hidden shadow-inner flex items-center justify-center relative">
                  {renderSignatureContent(sigDetails, selectedSignatureItem.requestedBy || 'Stefan Maier')}
                </div>
              </div>

              {/* Verification Details */}
              <div className="bg-emerald-50/70 border border-emerald-200 rounded-xl p-3 space-y-1.5 text-xs">
                <div className="flex items-center justify-between">
                  <span className="text-emerald-800 font-medium">Unterzeichner:</span>
                  <span className="font-bold text-emerald-950">{selectedSignatureItem.requestedBy || 'Monteur'}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-emerald-800 font-medium">Erfasst am:</span>
                  <span className="font-mono text-emerald-950">
                    {selectedSignatureItem.createdAt ? new Date(selectedSignatureItem.createdAt).toLocaleString('de-DE') : '22.09.2026'}
                  </span>
                </div>
                {selectedSignatureItem.note && (
                  <div className="pt-1 border-t border-emerald-200/60 text-emerald-900 italic">
                    „{selectedSignatureItem.note}“
                  </div>
                )}
              </div>

              {/* Footer */}
              <div className="pt-2 flex justify-end">
                <button
                  type="button"
                  onClick={() => setSelectedSignatureItem(null)}
                  className="px-5 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs transition-colors"
                >
                  Schließen
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* Modal: Material Nachbestellen mit Stepper & E-Mail-Entwurf */}
      {reorderItem && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-xl w-full p-6 space-y-4 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center space-x-2">
                <Send className="w-5 h-5 text-[#3B82C4]" />
                <h3 className="font-bold text-base text-slate-900">
                  Material-Nachbestellung an Kfm. Leitung
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setReorderItem(null)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg hover:bg-slate-100"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4 text-xs">
              {/* Top Box: Stepper [-] QTY [+] and Product Details */}
              <div className="p-4 bg-blue-50/70 border border-blue-200 rounded-xl space-y-3">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <h4 className="font-bold text-blue-950 text-sm">
                      {reorderItem.title}
                    </h4>
                    <span className="text-blue-700 text-xs">
                      Raum: <strong>{reorderItem.roomName || reorderItem.roomId || 'Baustelle'}</strong>
                    </span>
                  </div>

                  {/* Stepper: [-]  QTY  [+] */}
                  <div className="flex items-center space-x-1.5 bg-white p-1 rounded-xl border border-blue-300 shadow-xs shrink-0">
                    <button
                      type="button"
                      onClick={() => handleChangeReorderQty(reorderQty - 1)}
                      className="w-8 h-8 rounded-lg bg-blue-50 hover:bg-blue-100 text-blue-700 font-bold flex items-center justify-center transition-colors"
                      title="Menge verringern"
                    >
                      <Minus className="w-3.5 h-3.5" />
                    </button>

                    <input
                      type="number"
                      min={1}
                      value={reorderQty}
                      onChange={e => handleChangeReorderQty(parseFloat(e.target.value) || 1)}
                      className="w-16 px-1.5 py-1 text-center font-black text-sm bg-white rounded-lg text-blue-950 focus:outline-none focus:ring-1 focus:ring-blue-500"
                    />

                    <button
                      type="button"
                      onClick={() => handleChangeReorderQty(reorderQty + 1)}
                      className="w-8 h-8 rounded-lg bg-blue-50 hover:bg-blue-100 text-blue-700 font-bold flex items-center justify-center transition-colors"
                      title="Menge erhöhen"
                    >
                      <Plus className="w-3.5 h-3.5" />
                    </button>

                    <span className="font-bold text-blue-800 px-2 text-xs">
                      {reorderItem.qu || (typeof reorderItem.quantity === 'string' && reorderItem.quantity.includes('m') ? 'm' : 'Stk')}
                    </span>
                  </div>
                </div>

                {reorderItem.note && (
                  <div className="pt-2 border-t border-blue-200/70 text-[11px] text-blue-900 italic">
                    Notiz vom Monteur: „{reorderItem.note}“
                  </div>
                )}
              </div>

              {/* Recipient */}
              <div>
                <label className="font-bold text-slate-700 block mb-1">
                  Empfänger (Kaufmännische Leitung / Einkauf) *
                </label>
                <input
                  type="text"
                  value={project?.commercialManagerEmail ? `${project.commercialManager || 'Kfm. Leitung'} <${project.commercialManagerEmail}>` : 'Einkauf Burk Haustechnik <einkauf@burk-haustechnik.de>'}
                  disabled
                  className="w-full px-3 py-2 bg-slate-100 border border-slate-200 rounded-xl text-slate-600"
                />
              </div>

              {/* Subject */}
              <div>
                <label className="font-bold text-slate-700 block mb-1">Betreffzeile *</label>
                <input
                  type="text"
                  value={mailSubject}
                  onChange={e => setMailSubject(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#3B82C4]/30"
                />
              </div>

              {/* Body */}
              <div>
                <label className="font-bold text-slate-700 block mb-1">
                  Nachrichtentext (Anrede mit Vorname: {managerFirstName}) *
                </label>
                <textarea
                  rows={8}
                  value={mailBody}
                  onChange={e => setMailBody(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-mono text-xs focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#3B82C4]/30"
                />
              </div>

              {/* Action Buttons */}
              <div className="pt-2 flex items-center justify-end space-x-2">
                <button
                  type="button"
                  onClick={() => setReorderItem(null)}
                  className="px-4 py-2 rounded-xl text-slate-600 hover:bg-slate-100 font-semibold"
                >
                  Abbrechen
                </button>

                <button
                  type="button"
                  disabled={isProcessingReorder}
                  onClick={handleConfirmReorder}
                  className="inline-flex items-center space-x-2 px-5 py-2.5 rounded-xl bg-[#3B82C4] hover:bg-[#2B6EB0] text-white font-bold shadow-md shadow-blue-500/20 transition-all hover:scale-[1.01] disabled:opacity-50"
                >
                  <Send className="w-4 h-4" />
                  <span>Bestellung absenden &amp; freigeben ({reorderQty} {reorderItem.qu || (typeof reorderItem.quantity === 'string' && reorderItem.quantity.includes('m') ? 'm' : 'Stk')})</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Mehrbedarf Ablehnen mit Pflicht-Begründung */}
      {rejectItem && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-md w-full p-6 space-y-4 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center space-x-2.5">
                <div className="w-9 h-9 rounded-xl bg-red-50 border border-red-200 flex items-center justify-center text-red-600">
                  <AlertTriangle className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-base text-slate-900">
                    Mehrbedarf ablehnen
                  </h3>
                  <p className="text-xs text-slate-500">
                    Begründung für Monteur &amp; Bauakte erfassen
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setRejectItem(null)}
                className="text-slate-400 hover:text-slate-600 p-1.5 rounded-lg hover:bg-slate-100"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Target Item Summary */}
            <div className="p-3 bg-slate-50 border border-slate-200/80 rounded-xl space-y-1 text-xs">
              <span className="text-[10px] font-bold uppercase text-slate-400">Betroffener Mehrbedarf:</span>
              <p className="font-bold text-sm text-slate-900">{rejectItem.title}</p>
              <div className="flex items-center justify-between text-slate-600 pt-0.5">
                <span>Menge: <strong>{rejectItem.quantity} {rejectItem.qu || ''}</strong></span>
                <span>Raum: <strong>{rejectItem.roomName || rejectItem.roomId || 'Baustelle'}</strong></span>
              </div>
            </div>

            {/* Rejection Reason Form */}
            <div className="space-y-1.5">
              <label className="font-bold text-slate-800 text-xs block">
                Grund für die Ablehnung *
              </label>
              <textarea
                rows={4}
                placeholder="z. B. Material nicht erforderlich / VOB-Planungsfehler / bereits im Vorfeld geliefert..."
                value={rejectReason}
                onChange={e => {
                  setRejectReason(e.target.value);
                  if (rejectError) setRejectError('');
                }}
                className={`w-full px-3 py-2 text-xs bg-slate-50 border rounded-xl focus:bg-white focus:outline-none focus:ring-2 transition-all ${
                  rejectError 
                    ? 'border-red-400 ring-2 ring-red-300/40 bg-red-50/20' 
                    : 'border-slate-200 focus:ring-[#3B82C4]/30'
                }`}
              />
              {rejectError && (
                <p className="text-[11px] font-semibold text-red-600 flex items-center space-x-1">
                  <AlertCircle className="w-3.5 h-3.5" />
                  <span>{rejectError}</span>
                </p>
              )}
            </div>

            {/* Action Buttons */}
            <div className="pt-2 flex items-center justify-end space-x-2 text-xs">
              <button
                type="button"
                onClick={() => setRejectItem(null)}
                className="px-4 py-2 rounded-xl text-slate-600 hover:bg-slate-100 font-semibold"
              >
                Abbrechen
              </button>
              <button
                type="button"
                disabled={isProcessingReject}
                onClick={handleConfirmReject}
                className="px-5 py-2.5 rounded-xl bg-red-600 hover:bg-red-700 text-white font-bold shadow-md shadow-red-600/20 transition-all hover:scale-[1.01] disabled:opacity-50"
              >
                Endgültig ablehnen
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
