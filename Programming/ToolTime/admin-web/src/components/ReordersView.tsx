import React, { useState, useMemo } from 'react';
import type { Alert, Project, Room, Position, Booking } from '../types';
import { 
  ShoppingCart, 
  Mail, 
  CheckCircle2, 
  Clock, 
  Check, 
  AlertTriangle, 
  ArrowUpRight, 
  ArrowDownRight, 
  MapPin, 
  Send, 
  X,
  PackageCheck,
  CheckCheck,
  Minus,
  Plus
} from 'lucide-react';
import { createAlert, getMaterialActualQty, addPositionDeliveredQty } from '../services/firestoreService';

export interface RoomDeviation {
  roomId: string;
  roomName: string;
  roomCode: string;
  floor?: string;
  isRoomCompleted: boolean;
  plannedQty: number;
  actualQty: number;
  diff: number; // actual - planned
}

export interface GroupedDeviation {
  id: string;
  posNr: string;
  positionId?: string;
  materialName: string;
  qu: string;
  unitPrice: number;
  rooms: RoomDeviation[];
  netDelta: number; // sum of diffs across all rooms
  totalPlannedAcrossRooms: number;
  totalActualAcrossRooms: number;
  deviationType: 'over' | 'under' | 'exact';
  status: 'open' | 'reordered' | 'acknowledged';
  reorderedAt?: string;
  actionNote?: string;
  // Project-wide stats
  projectAvailable: number; // noch verfügbar
  projectNeeded: number;    // laut Projektplanung benötigt
}

interface ReordersViewProps {
  projectId: string;
  projectName: string;
  rooms?: Room[];
  positions?: Position[];
  bookings?: Booking[];
  alerts?: Alert[];
  project: Project | null;
}

export const ReordersView: React.FC<ReordersViewProps> = ({
  projectId,
  projectName,
  rooms = [],
  positions = [],
  bookings = [],
  alerts = [],
  project
}) => {
  const [filterType, setFilterType] = useState<'all' | 'over' | 'under' | 'reordered'>('all');
  const [selectedGroup, setSelectedGroup] = useState<GroupedDeviation | null>(null);
  const [reorderQty, setReorderQty] = useState<number>(1);
  const [mailSubject, setMailSubject] = useState('');
  const [mailBody, setMailBody] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);

  // Quick lookup for Position by posNr or id
  const posMap = useMemo(() => new Map(positions.map(p => [p.posNr, p])), [positions]);
  const posIdMap = useMemo(() => new Map(positions.map(p => [p.id, p])), [positions]);

  // First name only of commercial manager
  const managerFirstName = useMemo(() => {
    const rawName = project?.commercialManager || 'Sabine Müller';
    return rawName.trim().split(/\s+/)[0] || 'Sabine';
  }, [project?.commercialManager]);

  // Group deviations by product across all rooms
  const groupedDeviations = useMemo(() => {
    const map = new Map<string, {
      posNr: string;
      positionId?: string;
      materialName: string;
      qu: string;
      unitPrice: number;
      rooms: RoomDeviation[];
    }>();

    // 1. Scan all rooms and materials
    rooms.forEach(room => {
      const isExplicitlyUnlocked = room.isCompleted === false || room.status === 'in_progress';
      const isCompleted = !isExplicitlyUnlocked && (room.status === 'completed' || room.isCompleted === true || ((room as any).pct === 100));

      (room.materials || []).forEach(m => {
        const planned = Number(m.plannedQty) || 0;
        const actual = getMaterialActualQty(m, room, bookings);
        const diff = actual - planned;

        // RULE:
        // Overconsumption (diff > 0) shows immediately (even in progress).
        // Underconsumption (diff < 0) only shows when room is completed (100% fertiggestellt).
        const hasRelevantDeviation = (diff > 0) || (diff < 0 && isCompleted);

        if (hasRelevantDeviation) {
          const key = m.posNr || m.positionId || m.shortText;
          if (!map.has(key)) {
            const p = posMap.get(m.posNr) || (m.positionId ? posIdMap.get(m.positionId) : undefined);
            map.set(key, {
              posNr: m.posNr || p?.posNr || '–',
              positionId: m.positionId || p?.id,
              materialName: m.shortText || p?.shortText || 'Material',
              qu: m.qu || p?.qu || 'Stk',
              unitPrice: m.unitPrice || p?.unitPrice || 0,
              rooms: []
            });
          }

          map.get(key)!.rooms.push({
            roomId: room.id,
            roomName: room.name,
            roomCode: room.code || 'Raum',
            floor: room.floor,
            isRoomCompleted: isCompleted,
            plannedQty: planned,
            actualQty: actual,
            diff
          });
        }
      });
    });

    // 2. Also incorporate standalone alerts not already in map
    alerts.forEach(a => {
      if (a.status === 'reordered' || a.status === 'open') {
        const key = a.materialPos || a.materialName;
        if (!map.has(key)) {
          const p = posMap.get(a.materialPos);
          map.set(key, {
            posNr: a.materialPos || '–',
            positionId: a.materialId || p?.id,
            materialName: a.materialName || 'Nachbestellte Position',
            qu: a.qu || p?.qu || 'Stk',
            unitPrice: p?.unitPrice || 0,
            rooms: [{
              roomId: a.roomId || 'allgemein',
              roomName: a.roomName || 'Baustelle',
              roomCode: 'INFO',
              isRoomCompleted: false,
              plannedQty: a.plannedQty || 0,
              actualQty: a.requestedTotal || a.exceededBy || 0,
              diff: a.exceededBy || 0
            }]
          });
        }
      }
    });

    // 3. Transform map into enriched GroupedDeviation list
    const result: GroupedDeviation[] = [];

    map.forEach((entry, key) => {
      const netDelta = entry.rooms.reduce((sum, r) => sum + r.diff, 0);
      const totalPlannedAcrossRooms = entry.rooms.reduce((sum, r) => sum + r.plannedQty, 0);
      const totalActualAcrossRooms = entry.rooms.reduce((sum, r) => sum + r.actualQty, 0);

      // Status resolution across alerts
      const matchingAlerts = alerts.filter(a => 
        (a.materialPos === entry.posNr || a.materialName === entry.materialName)
      );
      const isReordered = matchingAlerts.some(a => a.status === 'reordered');
      const isAcknowledged = matchingAlerts.some(a => a.status === 'acknowledged');
      const status: 'open' | 'reordered' | 'acknowledged' = isReordered 
        ? 'reordered' 
        : (isAcknowledged ? 'acknowledged' : 'open');

      const latestAlert = matchingAlerts[matchingAlerts.length - 1];

      // --- PROJECT-WIDE STATS ---
      const p = posMap.get(entry.posNr) || (entry.positionId ? posIdMap.get(entry.positionId) : undefined);
      
      // A. Delivered / Initial Stock
      const initialDelivered = (p && p.deliveredQty !== undefined) 
        ? Number(p.deliveredQty) 
        : (Number(p?.qty) || totalPlannedAcrossRooms);

      // B. Additional reordered items
      const reordersSum = matchingAlerts
        .filter(a => a.status === 'reordered')
        .reduce((sum, a) => sum + (Number(a.exceededBy) || 0), 0);

      // C. Total Verbaut so far in ALL rooms of the project
      let projectInstalledTotal = 0;
      rooms.forEach(r => {
        (r.materials || []).forEach(m => {
          if (m.posNr === entry.posNr || (entry.positionId && m.positionId === entry.positionId)) {
            projectInstalledTotal += getMaterialActualQty(m, r, bookings);
          }
        });
      });

      // "noch verfügbar" = (geliefert + nachbestellt) - bisher im Projekt verbaut
      const projectAvailable = Math.max(0, (initialDelivered + reordersSum) - projectInstalledTotal);

      // "laut Projektplanung benötigt" = was in noch unfertigen Räumen laut Plan noch fehlt
      let projectNeeded = 0;
      rooms.forEach(r => {
        const isUnlocked = r.isCompleted === false || r.status === 'in_progress';
        const isDone = !isUnlocked && (r.status === 'completed' || r.isCompleted === true || ((r as any).pct === 100));

        if (!isDone) {
          (r.materials || []).forEach(m => {
            if (m.posNr === entry.posNr || (entry.positionId && m.positionId === entry.positionId)) {
              const pl = Number(m.plannedQty) || 0;
              const act = getMaterialActualQty(m, r, bookings);
              const remaining = Math.max(0, pl - act);
              projectNeeded += remaining;
            }
          });
        }
      });

      const deviationType: 'over' | 'under' | 'exact' = netDelta > 0 
        ? 'over' 
        : (netDelta < 0 ? 'under' : 'exact');

      result.push({
        id: `group_${entry.posNr}_${key}`,
        posNr: entry.posNr,
        positionId: entry.positionId,
        materialName: entry.materialName,
        qu: entry.qu,
        unitPrice: entry.unitPrice,
        rooms: entry.rooms,
        netDelta,
        totalPlannedAcrossRooms,
        totalActualAcrossRooms,
        deviationType,
        status,
        reorderedAt: latestAlert?.reorderedAt || latestAlert?.updatedAt,
        actionNote: latestAlert?.actionNote,
        projectAvailable,
        projectNeeded
      });
    });

    return result;
  }, [rooms, positions, bookings, alerts, posMap, posIdMap]);

  // KPI Metrics based on grouped materials
  const overItems = groupedDeviations.filter(d => d.deviationType === 'over');
  const acuteOverItems = overItems.filter(d => d.status === 'open');
  const underItems = groupedDeviations.filter(d => d.deviationType === 'under');
  const reorderedItems = groupedDeviations.filter(d => d.status === 'reordered');

  // Filtered Display List
  const displayedList = useMemo(() => {
    if (filterType === 'over') return groupedDeviations.filter(d => d.deviationType === 'over');
    if (filterType === 'under') return groupedDeviations.filter(d => d.deviationType === 'under');
    if (filterType === 'reordered') return groupedDeviations.filter(d => d.status === 'reordered');
    return groupedDeviations;
  }, [groupedDeviations, filterType]);

  // Helper to generate dynamic email body
  const generateMailText = (group: GroupedDeviation, qty: number) => {
    const roomsSummary = group.rooms
      .map(r => `${r.roomName} (${r.diff > 0 ? '+' : ''}${r.diff} ${group.qu})`)
      .join(', ');

    return `Hallo ${managerFirstName},

auf der Baustelle "${projectName}" ist für die Position "${group.posNr} - ${group.materialName}" ein Nachbestellbedarf aufgetreten:

• Position: ${group.posNr} - ${group.materialName}
• Nachzubestellende Menge: ${qty} ${group.qu}
• Betroffene Räume: ${roomsSummary}
• Aktueller Projektstand: Noch verfügbar: ${group.projectAvailable} ${group.qu} • Laut Planung noch benötigt: ${group.projectNeeded} ${group.qu}

Bitte veranlassen Sie zeitnah die Nachbestellung beim Großhändler, damit die Montagearbeiten ohne Unterbrechung fortgeführt werden können.

Mit freundlichen Grüßen
Bauleitung Burk Haustechnik`;
  };

  const handleOpenReorderModal = (group: GroupedDeviation) => {
    setSelectedGroup(group);
    const initialQty = group.netDelta > 0 
      ? group.netDelta 
      : (group.projectNeeded > group.projectAvailable ? group.projectNeeded - group.projectAvailable : 1);
    
    setReorderQty(initialQty);
    setMailSubject(`Dringende Material-Nachbestellung: ${initialQty} ${group.qu} ${group.materialName} (Pos. ${group.posNr}) - Projekt ${projectName}`);
    setMailBody(generateMailText(group, initialQty));
  };

  const handleChangeQty = (newQty: number) => {
    const val = Math.max(1, newQty);
    setReorderQty(val);
    if (selectedGroup) {
      setMailSubject(`Dringende Material-Nachbestellung: ${val} ${selectedGroup.qu} ${selectedGroup.materialName} (Pos. ${selectedGroup.posNr}) - Projekt ${projectName}`);
      setMailBody(generateMailText(selectedGroup, val));
    }
  };

  const handleConfirmReorder = async () => {
    if (!selectedGroup) return;
    setIsProcessing(true);

    try {
      const alertId = `alert_${selectedGroup.posNr.replace(/[^a-zA-Z0-9]/g, '_')}`;
      const now = new Date().toISOString();

      // 1. Create or update alert in Firestore
      await createAlert(projectId, {
        id: alertId,
        projectId,
        roomId: selectedGroup.rooms[0]?.roomId || 'allgemein',
        roomName: selectedGroup.rooms.map(r => r.roomName).join(', ') || 'Projekt',
        materialPos: selectedGroup.posNr,
        materialName: selectedGroup.materialName,
        qu: selectedGroup.qu,
        plannedQty: selectedGroup.totalPlannedAcrossRooms,
        requestedTotal: selectedGroup.totalActualAcrossRooms,
        exceededBy: reorderQty,
        monteurName: 'Bauleiter',
        reason: `Nachbestellung (+${reorderQty} ${selectedGroup.qu}) vom Bauleiter an kaufmännische Leitung (${managerFirstName}) übermittelt`,
        status: 'reordered',
        createdAt: now,
        updatedAt: now,
        reorderedAt: now,
        actionNote: `Nachbestellung über ${reorderQty} ${selectedGroup.qu} beim Großhändler veranlasst (${new Date().toLocaleDateString('de-DE')})`
      });

      // 2. Immediately add reordered quantity to available stock in project
      await addPositionDeliveredQty(projectId, selectedGroup.positionId || selectedGroup.posNr, reorderQty);

      // 3. Launch native mailto client
      const recipient = project?.commercialManagerEmail || '';
      const mailtoUrl = `mailto:${encodeURIComponent(recipient)}?subject=${encodeURIComponent(mailSubject)}&body=${encodeURIComponent(mailBody)}`;
      window.open(mailtoUrl, '_blank');

      setSelectedGroup(null);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleDismissNotice = async (group: GroupedDeviation) => {
    const alertId = `alert_${group.posNr.replace(/[^a-zA-Z0-9]/g, '_')}`;
    const now = new Date().toISOString();

    await createAlert(projectId, {
      id: alertId,
      projectId,
      roomId: group.rooms[0]?.roomId || 'allgemein',
      roomName: group.rooms.map(r => r.roomName).join(', ') || 'Projekt',
      materialPos: group.posNr,
      materialName: group.materialName,
      qu: group.qu,
      plannedQty: group.totalPlannedAcrossRooms,
      requestedTotal: group.totalActualAcrossRooms,
      exceededBy: group.netDelta,
      monteurName: 'Bauleiter',
      reason: `Hinweis zur Abweichung ${group.posNr} vom Bauleiter geprüft`,
      status: 'acknowledged',
      createdAt: now,
      updatedAt: now,
      actionNote: `Hinweis vom Bauleiter am ${new Date().toLocaleDateString('de-DE')} geschlossen / quittiert`
    });
  };

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center space-x-3.5">
          <div className="w-12 h-12 rounded-xl bg-gradient-to-tr from-[#3B82C4] to-[#1C2A3B] text-white flex items-center justify-center shadow-md shadow-blue-500/10 shrink-0">
            <ShoppingCart className="w-6 h-6 text-white" />
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <h2 className="text-xl font-bold text-slate-900 tracking-wide">
                Abweichungen &amp; Material-Bilanz
              </h2>
              <span className="bg-blue-100 text-blue-800 text-xs font-bold px-2.5 py-0.5 rounded-full border border-blue-200">
                {groupedDeviations.length} Produkte mit Abweichung
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              Projekt: <strong className="text-slate-800">{projectName}</strong> • Produkt-Bündelung über alle Räume mit Projekt-Verfügbarkeit &amp; Nachbestellung
            </p>
          </div>
        </div>

        {project?.commercialManager && (
          <div className="bg-slate-50 border border-slate-200 px-3.5 py-2 rounded-xl text-xs flex items-center space-x-2.5 self-start md:self-auto">
            <Mail className="w-4 h-4 text-[#3B82C4]" />
            <div>
              <span className="text-[10px] text-slate-400 block font-semibold uppercase">Zuständige Kfm. Leitung:</span>
              <span className="font-bold text-slate-800">{project.commercialManager}</span>
              {project.commercialManagerEmail && (
                <span className="text-slate-500 text-[11px] block">{project.commercialManagerEmail}</span>
              )}
            </div>
          </div>
        )}
      </div>

      {/* KPI Cards: The 3 Core Deviation States */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* KPI 1: Acute Overconsumption */}
        <div 
          onClick={() => setFilterType(filterType === 'over' ? 'all' : 'over')}
          className={`cursor-pointer bg-white rounded-2xl border p-5 shadow-xs transition-all hover:border-red-400 ${
            filterType === 'over' ? 'ring-2 ring-red-500 border-red-500' : 'border-slate-200'
          }`}
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2.5">
              <div className="w-9 h-9 rounded-xl bg-red-50 text-red-600 flex items-center justify-center font-bold">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <div>
                <span className="text-xs font-bold text-slate-800 block">Mehrverbrauch (Abweichung)</span>
                <span className="text-[10px] text-slate-400">Verbau &gt; Geplant</span>
              </div>
            </div>
            <span className="text-xl font-black text-red-600">
              {overItems.length}
            </span>
          </div>
          <div className="mt-3 pt-3 border-t border-slate-100 flex items-center justify-between text-xs">
            <span className="text-slate-500 text-[11px]">Akuter Nachbestellbedarf:</span>
            <span className={`font-bold px-2 py-0.5 rounded-full text-[10px] ${
              acuteOverItems.length > 0 ? 'bg-red-100 text-red-800 font-black animate-pulse' : 'bg-slate-100 text-slate-600'
            }`}>
              {acuteOverItems.length} offen
            </span>
          </div>
        </div>

        {/* KPI 2: Completed Underconsumption */}
        <div 
          onClick={() => setFilterType(filterType === 'under' ? 'all' : 'under')}
          className={`cursor-pointer bg-white rounded-2xl border p-5 shadow-xs transition-all hover:border-emerald-400 ${
            filterType === 'under' ? 'ring-2 ring-emerald-500 border-emerald-500' : 'border-slate-200'
          }`}
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2.5">
              <div className="w-9 h-9 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center font-bold">
                <ArrowDownRight className="w-5 h-5" />
              </div>
              <div>
                <span className="text-xs font-bold text-slate-800 block">Minderverbrauch (Abweichung)</span>
                <span className="text-[10px] text-slate-400">Nur fertige Räume (100%)</span>
              </div>
            </div>
            <span className="text-xl font-black text-emerald-600">
              {underItems.length}
            </span>
          </div>
          <div className="mt-3 pt-3 border-t border-slate-100 flex items-center justify-between text-xs">
            <span className="text-slate-500 text-[11px]">Material-Gutschrift / Lager:</span>
            <span className="font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full text-[10px]">
              {underItems.length} Positionen frei
            </span>
          </div>
        </div>

        {/* KPI 3: Reordered Items */}
        <div 
          onClick={() => setFilterType(filterType === 'reordered' ? 'all' : 'reordered')}
          className={`cursor-pointer bg-white rounded-2xl border p-5 shadow-xs transition-all hover:border-blue-400 ${
            filterType === 'reordered' ? 'ring-2 ring-[#3B82C4] border-[#3B82C4]' : 'border-slate-200'
          }`}
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2.5">
              <div className="w-9 h-9 rounded-xl bg-blue-50 text-[#3B82C4] flex items-center justify-center font-bold">
                <PackageCheck className="w-5 h-5" />
              </div>
              <div>
                <span className="text-xs font-bold text-slate-800 block">Beim Großhändler bestellt</span>
                <span className="text-[10px] text-slate-400">Gilt sofort als verfügbar</span>
              </div>
            </div>
            <span className="text-xl font-black text-[#3B82C4]">
              {reorderedItems.length}
            </span>
          </div>
          <div className="mt-3 pt-3 border-t border-slate-100 flex items-center justify-between text-xs">
            <span className="text-slate-500 text-[11px]">Bestellungen in Abwicklung:</span>
            <span className="font-bold text-blue-700 bg-blue-50 px-2 py-0.5 rounded-full text-[10px]">
              {reorderedItems.length} veranlasst
            </span>
          </div>
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="flex items-center space-x-2 overflow-x-auto pb-1">
        {[
          { id: 'all' as const, label: `Alle Abweichungen (${groupedDeviations.length})` },
          { id: 'over' as const, label: `🚨 Mehrverbrauch (${overItems.length})` },
          { id: 'under' as const, label: `🟢 Minderverbrauch (${underItems.length})` },
          { id: 'reordered' as const, label: `✉️ Bestellt (${reorderedItems.length})` },
        ].map(pill => (
          <button
            key={pill.id}
            onClick={() => setFilterType(pill.id)}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-all ${
              filterType === pill.id
                ? 'bg-[#1C2A3B] text-white shadow-xs'
                : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
            }`}
          >
            {pill.label}
          </button>
        ))}
      </div>

      {/* Main Cards List: Grouped by Product */}
      {displayedList.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center space-y-3 shadow-xs">
          <div className="w-12 h-12 rounded-full bg-slate-100 text-slate-400 flex items-center justify-center mx-auto">
            <CheckCircle2 className="w-6 h-6 text-emerald-500" />
          </div>
          <h3 className="font-bold text-slate-800 text-sm">Keine Abweichungen vorhanden</h3>
          <p className="text-xs text-slate-400 max-w-md mx-auto">
            Für die ausgewählte Ansicht wurden keine Soll/Ist-Abweichungen festgestellt. Alle verbauten Materialien stimmen mit der Planung überein.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {displayedList.map(group => {
            const isOver = group.deviationType === 'over';
            const isReordered = group.status === 'reordered';
            const isAcknowledged = group.status === 'acknowledged';

            return (
              <div
                key={group.id}
                className={`bg-white rounded-2xl border p-5 shadow-xs transition-all flex flex-col justify-between space-y-4 ${
                  isOver && !isReordered && !isAcknowledged
                    ? 'border-red-200 hover:border-red-400 bg-red-50/10'
                    : isReordered
                    ? 'border-blue-200 hover:border-blue-400'
                    : isAcknowledged
                    ? 'border-slate-200 hover:border-slate-300 opacity-90'
                    : 'border-emerald-200 hover:border-emerald-400 bg-emerald-50/10'
                }`}
              >
                <div className="space-y-3.5">
                  {/* Top Header Badge */}
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center space-x-2">
                      {isOver ? (
                        <span className="inline-flex items-center space-x-1.5 px-2.5 py-1 rounded-lg text-xs font-bold bg-red-50 text-red-800 border border-red-200">
                          <ArrowUpRight className="w-3.5 h-3.5 text-red-600" />
                          <span>Mehrverbrauch (Abweichung)</span>
                        </span>
                      ) : (
                        <span className="inline-flex items-center space-x-1.5 px-2.5 py-1 rounded-lg text-xs font-bold bg-emerald-50 text-emerald-800 border border-emerald-200">
                          <ArrowDownRight className="w-3.5 h-3.5 text-emerald-600" />
                          <span>Minderverbrauch (Abweichung)</span>
                        </span>
                      )}

                      <span className="text-[10px] font-bold bg-slate-100 text-slate-700 px-2 py-0.5 rounded">
                        Pos. {group.posNr}
                      </span>
                    </div>

                    {isReordered ? (
                      <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-blue-100 text-blue-800 border border-blue-200 flex items-center space-x-1">
                        <Check className="w-3 h-3 text-blue-600" />
                        <span>Bestellt</span>
                      </span>
                    ) : isAcknowledged ? (
                      <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-600 border border-slate-200 flex items-center space-x-1">
                        <CheckCheck className="w-3 h-3 text-slate-500" />
                        <span>Quittiert</span>
                      </span>
                    ) : isOver ? (
                      <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-red-100 text-red-800 border border-red-200 animate-pulse">
                        Akut offen
                      </span>
                    ) : (
                      <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
                        Raum abgeschlossen
                      </span>
                    )}
                  </div>

                  {/* Material Name & Net Delta Highlight */}
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <h4 className="font-bold text-slate-900 text-base leading-snug">
                        {group.materialName}
                      </h4>
                      <span className="text-xs text-slate-400">
                        In {group.rooms.length} {group.rooms.length === 1 ? 'Raum' : 'Räumen'} verbaut
                      </span>
                    </div>

                    <div className="text-right shrink-0">
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                        Netto-Abweichung
                      </span>
                      <span className={`text-base font-black ${
                        isOver ? 'text-red-600' : 'text-emerald-700'
                      }`}>
                        {group.netDelta > 0 ? `+${group.netDelta}` : `${group.netDelta}`} {group.qu}
                      </span>
                    </div>
                  </div>

                  {/* 1. Stat: Affected Rooms List (untereinander) */}
                  <div className="bg-slate-50 p-3 rounded-xl border border-slate-100 space-y-1.5">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
                      Betroffene Räume ({group.rooms.length})
                    </span>
                    <div className="divide-y divide-slate-200/50">
                      {group.rooms.map(r => (
                        <div key={r.roomId} className="flex items-center justify-between py-1.5 text-xs">
                          <div className="flex items-center space-x-1.5">
                            <MapPin className="w-3.5 h-3.5 text-[#3B82C4] shrink-0" />
                            <span className="font-semibold text-slate-800">
                              {r.roomName} ({r.roomCode})
                            </span>
                            {r.isRoomCompleted ? (
                              <span className="text-[9px] font-bold text-emerald-700 bg-emerald-100/70 px-1.5 py-0.2 rounded">
                                ✓ 100%
                              </span>
                            ) : (
                              <span className="text-[9px] font-medium text-amber-700 bg-amber-50 px-1 py-0.2 rounded">
                                Montage
                              </span>
                            )}
                          </div>

                          <div className="flex items-center space-x-2 font-mono text-xs">
                            <span className="text-slate-500">Plan: {r.plannedQty}</span>
                            <span className="text-slate-800 font-bold">Ist: {r.actualQty}</span>
                            <span className={`font-black ${
                              r.diff > 0 ? 'text-red-600 bg-red-100 px-1 rounded' : 'text-emerald-700 bg-emerald-100 px-1 rounded'
                            }`}>
                              {r.diff > 0 ? `+${r.diff}` : `${r.diff}`} {group.qu}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* 2. Stat: Projektstand (noch verfügbar vs. laut Projektplanung benötigt) */}
                  <div className="grid grid-cols-2 gap-2.5 p-3 bg-blue-50/50 rounded-xl border border-blue-100/80 text-center">
                    <div className="bg-white/80 p-2 rounded-lg border border-blue-200/60 shadow-xs">
                      <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">
                        Noch verfügbar
                      </span>
                      <span className={`text-base font-black block mt-0.5 ${
                        group.projectAvailable >= group.projectNeeded ? 'text-emerald-700' : 'text-red-600'
                      }`}>
                        {group.projectAvailable} {group.qu}
                      </span>
                      <span className="text-[9px] text-slate-400 block mt-0.5">
                        Lager / Baustellenbestand
                      </span>
                    </div>

                    <div className="bg-white/80 p-2 rounded-lg border border-blue-200/60 shadow-xs">
                      <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">
                        Laut Planung benötigt
                      </span>
                      <span className="text-base font-black text-slate-900 block mt-0.5">
                        {group.projectNeeded} {group.qu}
                      </span>
                      <span className="text-[9px] text-slate-400 block mt-0.5">
                        in weiteren Räumen
                      </span>
                    </div>
                  </div>

                  {/* Explanatory notes */}
                  {group.actionNote && (
                    <p className="text-xs text-slate-500 italic bg-white p-2 rounded-lg border border-slate-100">
                      ℹ️ {group.actionNote}
                    </p>
                  )}
                  {group.reorderedAt && (
                    <div className="flex items-center space-x-1.5 text-[11px] text-blue-700 font-medium">
                      <Clock className="w-3.5 h-3.5 text-blue-500" />
                      <span>Bestellung am {new Date(group.reorderedAt).toLocaleString('de-DE')} übermittelt</span>
                    </div>
                  )}
                </div>

                {/* Bottom Action Buttons */}
                <div className="pt-3 border-t border-slate-100 flex items-center justify-between gap-2">
                  <button
                    onClick={() => handleDismissNotice(group)}
                    className="px-3 py-1.5 text-xs text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-lg transition-colors font-semibold"
                    title="Hinweis schließen / zur Kenntnis genommen"
                  >
                    Hinweis schließen
                  </button>

                  {isOver ? (
                    <button
                      onClick={() => handleOpenReorderModal(group)}
                      className={`inline-flex items-center space-x-1.5 px-3.5 py-2 rounded-xl text-xs font-bold transition-all shadow-xs ${
                        isReordered
                          ? 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                          : 'bg-red-600 hover:bg-red-700 text-white hover:scale-[1.02]'
                      }`}
                      title="Nachbestellung an kaufmännische Leitung per E-Mail senden"
                    >
                      <Send className="w-3.5 h-3.5" />
                      <span>{isReordered ? 'Nachbestellung erneut senden' : 'Nachbestellung an Kfm. Leitung'}</span>
                    </button>
                  ) : (
                    <button
                      onClick={() => handleOpenReorderModal(group)}
                      className="inline-flex items-center space-x-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold bg-slate-200 hover:bg-slate-300 text-slate-800 transition-all shadow-xs"
                      title="Trotzdem nachbestellen, falls vorab bekannt ist, dass mehr benötigt wird"
                    >
                      <ShoppingCart className="w-3.5 h-3.5 text-slate-600" />
                      <span>Nachbestellen</span>
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Modal: Nachbestellung an Kaufmännische Leitung übermitteln */}
      {selectedGroup && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-xl w-full p-6 space-y-5 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center space-x-2">
                <Send className="w-5 h-5 text-red-600" />
                <h3 className="font-bold text-base text-slate-900">
                  Material-Nachbestellung an Kfm. Leitung
                </h3>
              </div>
              <button
                onClick={() => setSelectedGroup(null)}
                className="text-slate-400 hover:text-slate-600 p-1"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4 text-xs">
              {/* Top Box: Stepper [-] QTY [+] and Product Details */}
              <div className="p-4 bg-red-50 border border-red-200 rounded-xl space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="font-bold text-red-950 text-sm">
                      {selectedGroup.materialName}
                    </h4>
                    <span className="text-red-700 text-xs">
                      Pos-Nr: <strong>{selectedGroup.posNr}</strong>
                    </span>
                  </div>

                  {/* Stepper: [-]  QTY  [+] */}
                  <div className="flex items-center space-x-1.5 bg-white p-1 rounded-xl border border-red-300 shadow-xs">
                    <button
                      type="button"
                      onClick={() => handleChangeQty(reorderQty - (selectedGroup.qu === 'm' ? 1 : 1))}
                      className="w-8 h-8 rounded-lg bg-red-50 hover:bg-red-100 text-red-700 font-bold flex items-center justify-center transition-colors"
                      title="Menge verringern"
                    >
                      <Minus className="w-3.5 h-3.5" />
                    </button>

                    <input
                      type="number"
                      min={1}
                      step={selectedGroup.qu === 'm' ? '1' : '1'}
                      value={reorderQty}
                      onChange={e => handleChangeQty(parseFloat(e.target.value) || 1)}
                      className="w-16 px-1.5 py-1 text-center font-black text-sm bg-white rounded-lg text-red-900 focus:outline-none focus:ring-1 focus:ring-red-500"
                    />

                    <button
                      type="button"
                      onClick={() => handleChangeQty(reorderQty + (selectedGroup.qu === 'm' ? 1 : 1))}
                      className="w-8 h-8 rounded-lg bg-red-50 hover:bg-red-100 text-red-700 font-bold flex items-center justify-center transition-colors"
                      title="Menge erhöhen"
                    >
                      <Plus className="w-3.5 h-3.5" />
                    </button>

                    <span className="font-bold text-red-800 px-2 text-xs">
                      {selectedGroup.qu}
                    </span>
                  </div>
                </div>

                <div className="pt-2 border-t border-red-200/60 flex items-center justify-between text-[11px] text-red-800">
                  <span>Projektstand: Noch verfügbar: <strong>{selectedGroup.projectAvailable} {selectedGroup.qu}</strong></span>
                  <span>Laut Planung benötigt: <strong>{selectedGroup.projectNeeded} {selectedGroup.qu}</strong></span>
                </div>
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
              <div className="pt-2 flex items-center justify-end space-x-3">
                <button
                  type="button"
                  onClick={() => setSelectedGroup(null)}
                  className="px-4 py-2 rounded-xl text-slate-600 hover:bg-slate-100 font-semibold"
                >
                  Abbrechen
                </button>

                <button
                  type="button"
                  disabled={isProcessing}
                  onClick={handleConfirmReorder}
                  className="inline-flex items-center space-x-2 px-5 py-2.5 rounded-xl bg-red-600 hover:bg-red-700 text-white font-bold shadow-md shadow-red-600/20 transition-all hover:scale-[1.02] disabled:opacity-50"
                >
                  <Send className="w-4 h-4" />
                  <span>Nachbestellung speichern &amp; absenden ({reorderQty} {selectedGroup.qu})</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
