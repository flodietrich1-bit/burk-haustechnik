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
  counts?: boolean; // zählt zur Netto-Abweichung (Mehrverbrauch sofort, Minderverbrauch nur bei fertigem Raum)
  reason?: string;
  monteurName?: string;
  timestamp?: string;
}

export interface GroupedDeviation {
  id: string;
  posNr: string;
  positionId?: string;
  materialName: string;
  qu: string;
  unitPrice: number;
  rooms: RoomDeviation[];
  netDelta: number; // sum of confirmed diffs across all rooms
  totalPlannedAcrossRooms: number;
  totalActualAcrossRooms: number;
  deviationType: 'over' | 'under' | 'exact';
  status: 'open' | 'reordered' | 'acknowledged';
  reorderedAt?: string;
  actionNote?: string;
  // Project-wide stats
  projectAvailable: number; // tatsächlich verfügbar
  projectNeeded: number;    // laut Plan noch benötigt
  shortage: number;         // Fehlbedarf = max(0, needed - available)
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

    // Helper to resolve why more material was installed in a specific room
    const resolveRoomDeviationReason = (room: Room, m: any) => {
      // 1. Check alerts
      const matchingAlert = alerts.find(a => {
        const isRoom = a.roomId === room.id || a.roomId === room.code || (a.roomName && room.name && a.roomName.toLowerCase() === room.name.toLowerCase());
        if (!isRoom) return false;
        const isPos = (a.materialPos && a.materialPos === m.posNr) || 
                      (a.materialId && a.materialId === m.positionId) ||
                      (a.materialName && m.shortText && a.materialName.toLowerCase() === m.shortText.toLowerCase());
        return isPos && a.reason;
      });

      if (matchingAlert && matchingAlert.reason) {
        return {
          reason: matchingAlert.reason,
          monteurName: matchingAlert.monteurName,
          timestamp: matchingAlert.createdAt
        };
      }

      // 2. Check bookings for this room with an explicit reason or note
      const matchingBooking = bookings.find(b => {
        const isRoom = b.roomId === room.id || b.roomId === room.code || (b.roomName && room.name && b.roomName.toLowerCase() === room.name.toLowerCase());
        if (!isRoom) return false;
        const isPos = (b.positionNr && b.positionNr === m.posNr) || 
                      (b.itemOz && b.itemOz === m.posNr) ||
                      (b.positionId && b.positionId === m.positionId) ||
                      (b.itemId && b.itemId === m.positionId) ||
                      (b.positionName && m.shortText && b.positionName.toLowerCase() === m.shortText.toLowerCase()) ||
                      (b.itemText && m.shortText && b.itemText.toLowerCase() === m.shortText.toLowerCase());
        return isPos && ((b.reason && b.reason.trim().length > 0) || (b.note && b.note.trim().length > 0));
      });

      if (matchingBooking) {
        return {
          reason: (matchingBooking.reason || matchingBooking.note || '').trim(),
          monteurName: matchingBooking.createdBy,
          timestamp: matchingBooking.createdAt || matchingBooking.timestamp
        };
      }

      // 3. Fallback: check room notes
      if (m.notes && m.notes.trim().length > 0) {
        return {
          reason: m.notes.trim(),
          monteurName: undefined,
          timestamp: undefined
        };
      }

      // Check any booking to at least get the Monteur's name
      const anyBooking = bookings.find(b => {
        const isRoom = b.roomId === room.id || b.roomId === room.code || (b.roomName && room.name && b.roomName.toLowerCase() === room.name.toLowerCase());
        if (!isRoom) return false;
        return (b.positionNr && b.positionNr === m.posNr) || 
               (b.itemOz && b.itemOz === m.posNr) ||
               (b.positionId && b.positionId === m.positionId) ||
               (b.itemId && b.itemId === m.positionId) ||
               (b.positionName && m.shortText && b.positionName.toLowerCase() === m.shortText.toLowerCase()) ||
               (b.itemText && m.shortText && b.itemText.toLowerCase() === m.shortText.toLowerCase());
      });

      return {
        reason: undefined,
        monteurName: anyBooking?.createdBy,
        timestamp: anyBooking?.createdAt || anyBooking?.timestamp
      };
    };

    // 1. Scan all rooms and materials
    rooms.forEach(room => {
      const isExplicitlyUnlocked = room.isCompleted === false || room.status === 'in_progress';
      const isCompleted = !isExplicitlyUnlocked && (room.status === 'completed' || room.isCompleted === true || ((room as any).pct === 100));

      (room.materials || []).forEach(m => {
        const planned = Number(m.plannedQty) || 0;
        const actual = getMaterialActualQty(m, room, bookings);
        const diff = actual - planned;

        // RULE:
        // Overconsumption (diff > 0) counts immediately (even in progress).
        // Underconsumption (diff < 0) counts towards savings only when the room is finished;
        // otherwise it is pending (remaining work) and only shown informatively.
        const countsTowardsNet = (diff > 0) || (diff < 0 && isCompleted);

        // Consolidate ALL rooms that use this material (e.g. Wasserrohr in Bad + Küche)
        if (diff !== 0 || countsTowardsNet) {
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

          const devInfo = diff > 0 ? resolveRoomDeviationReason(room, m) : undefined;

          map.get(key)!.rooms.push({
            roomId: room.id,
            roomName: room.name,
            roomCode: room.code || 'Raum',
            floor: room.floor,
            isRoomCompleted: isCompleted,
            plannedQty: planned,
            actualQty: actual,
            diff,
            counts: countsTowardsNet,
            reason: devInfo?.reason,
            monteurName: devInfo?.monteurName,
            timestamp: devInfo?.timestamp
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
              diff: a.exceededBy || 0,
              reason: a.reason,
              monteurName: a.monteurName,
              timestamp: a.createdAt
            }]
          });
        }
      }
    });

    // 3. Transform map into enriched GroupedDeviation list
    const result: GroupedDeviation[] = [];

    map.forEach((entry, key) => {
      // Netto-Abweichung = Summe der bestätigten Abweichungen aller Räume
      // (offene Räume mit Minderverbrauch sind nur Restbedarf, keine Ersparnis)
      const netDelta = entry.rooms.reduce((sum, r) => sum + (r.counts === false ? 0 : r.diff), 0);
      const hasCounting = entry.rooms.some(r => r.counts !== false);
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

      const shortage = Math.max(0, projectNeeded - projectAvailable);

      // Nur Positionen mit bestätigter Abweichung (oder Alert) anzeigen
      if (!hasCounting) return;

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
        projectNeeded,
        shortage
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
      .map(r => {
        const diffStr = r.diff > 0 ? `+${r.diff}` : `${r.diff}`;
        const reasonStr = r.reason ? ` [Grund: ${r.reason}${r.monteurName ? ` (${r.monteurName})` : ''}]` : '';
        return `${r.roomName} (${diffStr} ${group.qu})${reasonStr}`;
      })
      .join(', ');

    return `Hallo ${managerFirstName},

auf der Baustelle "${projectName}" ist für die Position "${group.posNr} - ${group.materialName}" ein Nachbestellbedarf aufgetreten:

• Position: ${group.posNr} - ${group.materialName}
• Nachzubestellende Menge: ${qty} ${group.qu}
• Betroffene Räume: ${roomsSummary}
• Aktueller Projektstand: Tatsächlich verfügbar: ${group.projectAvailable} ${group.qu} • Laut Plan noch benötigt: ${group.projectNeeded} ${group.qu}

Bitte veranlassen Sie zeitnah die Nachbestellung beim Großhändler, damit die Montagearbeiten ohne Unterbrechung fortgeführt werden können.

Mit freundlichen Grüßen
Projektleitung Burk Haustechnik`;
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
        monteurName: 'Projektleiter',
        reason: `Nachbestellung (+${reorderQty} ${selectedGroup.qu}) vom Projektleiter an kaufmännische Leitung (${managerFirstName}) übermittelt`,
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

  // Bulk: alle nicht-handlungsrelevanten Hinweise (kein Fehlbedarf) mit einem Klick schließen
  const noShortageOpen = groupedDeviations.filter(d => d.shortage === 0 && d.status === 'open');

  const handleBulkDismissNoShortage = async () => {
    if (noShortageOpen.length === 0) return;
    if (!window.confirm(`${noShortageOpen.length} Hinweise ohne Fehlbedarf schließen?`)) return;
    setIsProcessing(true);
    try {
      for (const g of noShortageOpen) {
        await handleDismissNotice(g, 'Automatisch geschlossen: Position ohne Fehlbedarf (Bestand ausreichend)');
      }
    } finally {
      setIsProcessing(false);
    }
  };

  const handleDismissNotice = async (group: GroupedDeviation, note?: string) => {
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
      monteurName: 'Projektleiter',
      reason: `Hinweis zur Abweichung ${group.posNr} vom Projektleiter geprüft`,
      status: 'acknowledged',
      createdAt: now,
      updatedAt: now,
      actionNote: note || `Hinweis vom Projektleiter am ${new Date().toLocaleDateString('de-DE')} geschlossen / quittiert`
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
              <span className="text-[10px] text-slate-400 block font-semibold uppercase">Zuständige(r) Kaufmann / Kauffrau:</span>
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

      {/* Bulk action */}
      <div className="flex justify-end">
        <button
          type="button"
          disabled={isProcessing || noShortageOpen.length === 0}
          onClick={handleBulkDismissNoShortage}
          className="inline-flex items-center space-x-1.5 px-3.5 py-2 rounded-xl text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white disabled:opacity-40 disabled:cursor-not-allowed transition-all"
        >
          <CheckCheck className="w-3.5 h-3.5" />
          <span>Hinweise schließen für Positionen ohne Fehlbedarf ({noShortageOpen.length})</span>
        </button>
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
                        <div key={r.roomId} className="py-2 first:pt-1 last:pb-1 space-y-1.5">
                          <div className="flex items-center justify-between text-xs">
                            <div className="flex items-center space-x-1.5 min-w-0">
                              <MapPin className="w-3.5 h-3.5 text-[#3B82C4] shrink-0" />
                              <span className="font-semibold text-slate-800 truncate">
                                {r.roomName} ({r.roomCode})
                              </span>
                              {r.isRoomCompleted ? (
                                <span className="text-[9px] font-bold text-emerald-700 bg-emerald-100/70 px-1.5 py-0.2 rounded shrink-0">
                                  ✓ 100%
                                </span>
                              ) : (
                                <span className="text-[9px] font-medium text-amber-700 bg-amber-50 px-1 py-0.2 rounded shrink-0">
                                  Montage
                                </span>
                              )}
                            </div>

                            <div className="flex items-center space-x-2 font-mono text-xs shrink-0">
                              <span className="text-slate-500">Plan: {r.plannedQty}</span>
                              <span className="text-slate-800 font-bold">Ist: {r.actualQty}</span>
                              <span className={`font-black ${
                                r.diff > 0 ? 'text-red-600 bg-red-100 px-1 rounded' : (r.counts === false ? 'text-amber-700 bg-amber-50 px-1 rounded' : 'text-emerald-700 bg-emerald-100 px-1 rounded')
                              }`}>
                                {r.counts === false ? `offen ${Math.abs(r.diff)}` : (r.diff > 0 ? `+${r.diff}` : `${r.diff}`)} {group.qu}
                              </span>
                            </div>
                          </div>

                          {/* Info direkt unter dem jeweiligen Raum, warum mehr Material verbaut wurde */}
                          {r.diff > 0 && (
                            <div className="ml-5 p-2 bg-amber-50/90 border border-amber-200/90 rounded-lg text-xs text-amber-950 flex items-start space-x-2 shadow-2xs">
                              <AlertTriangle className="w-3.5 h-3.5 text-amber-600 shrink-0 mt-0.5" />
                              <div className="space-y-0.5 flex-1 min-w-0">
                                <div className="text-[11px] leading-snug">
                                  <span className="font-bold text-amber-900 mr-1.5">Grund für Mehrverbrauch:</span>
                                  <span className="font-semibold text-slate-900 break-words">
                                    {r.reason || 'Mehrbedarf bei Montage erfasst (ohne gesonderte Notiz)'}
                                  </span>
                                </div>
                                {(r.monteurName || r.timestamp) && (
                                  <div className="text-[10px] text-slate-500 flex flex-wrap items-center gap-x-2">
                                    {r.monteurName && (
                                      <span>Erfasst von: <strong className="text-slate-700">{r.monteurName}</strong></span>
                                    )}
                                    {r.monteurName && r.timestamp && <span>•</span>}
                                    {r.timestamp && (
                                      <span>{new Date(r.timestamp).toLocaleString('de-DE')}</span>
                                    )}
                                  </div>
                                )}
                              </div>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* 2. Stat: Projektstand (noch verfügbar vs. laut Projektplanung benötigt) */}
                  <div className="grid grid-cols-2 gap-2.5 p-3 bg-blue-50/50 rounded-xl border border-blue-100/80 text-center">
                    <div className="bg-white/80 p-2 rounded-lg border border-blue-200/60 shadow-xs">
                      <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">
                        Tatsächlich verfügbar
                      </span>
                      <span className={`text-base font-black block mt-0.5 ${
                        group.shortage === 0 ? 'text-emerald-700' : 'text-red-600'
                      }`}>
                        {group.projectAvailable} {group.qu}
                      </span>
                      <span className="text-[9px] text-slate-400 block mt-0.5">
                        Lager / Baustellenbestand
                      </span>
                    </div>

                    <div className="bg-white/80 p-2 rounded-lg border border-blue-200/60 shadow-xs">
                      <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">
                        Laut Plan benötigt
                      </span>
                      <span className="text-base font-black text-slate-900 block mt-0.5">
                        {group.projectNeeded} {group.qu}
                      </span>
                      <span className="text-[9px] text-slate-400 block mt-0.5">
                        {group.shortage > 0 ? `Fehlbedarf: ${group.shortage} ${group.qu}` : 'kein Fehlbedarf'}
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
                      <span>{isReordered ? 'Nachbestellung erneut senden' : 'Nachbestellung an Kaufmann / Kauffrau'}</span>
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
                  Material-Nachbestellung an Kaufmann / Kauffrau
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
                  <span>Projektstand: Tatsächlich verfügbar: <strong>{selectedGroup.projectAvailable} {selectedGroup.qu}</strong></span>
                  <span>Laut Plan benötigt: <strong>{selectedGroup.projectNeeded} {selectedGroup.qu}</strong></span>
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
