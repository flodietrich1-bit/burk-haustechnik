import React, { useState } from 'react';
import type { Alert, Project, Room, Position, Booking, PlanDeviationItem } from '../types';
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
  PackageCheck
} from 'lucide-react';
import { createAlert } from '../services/firestoreService';

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
  const [selectedForReorder, setSelectedForReorder] = useState<PlanDeviationItem | null>(null);
  const [mailSubject, setMailSubject] = useState('');
  const [mailBody, setMailBody] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);

  // Position quick-lookup
  const posMap = new Map(positions.map(p => [p.posNr, p]));

  // Index bookings by room and material
  const roomBookingsMap = new Map<string, Map<string, number>>();
  (bookings || []).forEach(b => {
    if (!b.roomId) return;
    const rId = b.roomId;
    if (!roomBookingsMap.has(rId)) {
      roomBookingsMap.set(rId, new Map());
    }
    const map = roomBookingsMap.get(rId)!;
    const qty = Number(b.quantity) || 0;
    const pId = b.positionId || (b as any).itemId;
    const pNr = b.positionNr || (b as any).itemOz;

    if (pId && pId !== 'room_completion' && pId !== 'photo_doc') {
      map.set(pId, (map.get(pId) || 0) + qty);
    }
    if (pNr && pNr !== 'FERTIG' && pNr !== 'DOKU') {
      map.set(pNr, (map.get(pNr) || 0) + qty);
    }
  });

  // Calculate deviations across all rooms & materials
  const allDeviations: PlanDeviationItem[] = [];

  (rooms || []).forEach(room => {
    const roomBookings = roomBookingsMap.get(room.id) || new Map<string, number>();
    const hasCompletionBooking = (bookings || []).some(b => b.roomId === room.id && (b.type === 'room_completion' || (b as any).itemId === 'room_completion'));
    const isCompleted = room.status === 'completed' || room.isCompleted || (room.pct === 100) || hasCompletionBooking;

    (room.materials || []).forEach(m => {
      const planned = Number(m.plannedQty) || 0;

      // Direct bookings for this material in this room
      const fromBookings = Math.max(
        roomBookings.get(m.positionId) || 0,
        roomBookings.get(m.posNr) || 0
      );

      let actual = 0;
      if (m.actualQty !== undefined && m.actualQty !== null) {
        actual = Number(m.actualQty);
      } else if (fromBookings > 0) {
        actual = fromBookings;
      } else if (isCompleted) {
        actual = planned;
      }

      if (fromBookings > actual) {
        actual = fromBookings;
      }

      const diff = actual - planned;

      // Check if an alert already exists in Firestore for this item
      const matchingAlert = alerts.find(a => 
        (a.roomId === room.id || a.roomName === room.name) && 
        (a.materialPos === m.posNr || a.materialName === m.shortText)
      );

      // RULE 1: MEHRVERBRAUCH (actual > planned) -> KOMMT SOFORT (auch bei unfertigen Räumen)
      if (diff > 0) {
        allDeviations.push({
          id: `dev_over_${room.id}_${m.posNr}`,
          roomId: room.id,
          roomName: room.name,
          roomCode: room.code,
          floor: room.floor,
          positionId: m.positionId,
          posNr: m.posNr,
          materialName: m.shortText,
          qu: m.qu || 'Stk',
          unitPrice: m.unitPrice || posMap.get(m.posNr)?.unitPrice || 0,
          plannedQty: planned,
          actualQty: actual,
          deltaQty: diff,
          deviationType: 'overconsumption',
          isRoomCompleted: isCompleted,
          status: matchingAlert ? matchingAlert.status : 'open',
          reorderedAt: matchingAlert?.reorderedAt || matchingAlert?.updatedAt,
          actionNote: matchingAlert?.actionNote,
        });
      }

      // RULE 2: MINDERVERBRAUCH (actual < planned) -> NUR wenn Raum fertiggemeldet ist!
      else if (diff < 0 && isCompleted) {
        allDeviations.push({
          id: `dev_under_${room.id}_${m.posNr}`,
          roomId: room.id,
          roomName: room.name,
          roomCode: room.code,
          floor: room.floor,
          positionId: m.positionId,
          posNr: m.posNr,
          materialName: m.shortText,
          qu: m.qu || 'Stk',
          unitPrice: m.unitPrice || posMap.get(m.posNr)?.unitPrice || 0,
          plannedQty: planned,
          actualQty: actual,
          deltaQty: diff, // negative number
          deviationType: 'underconsumption',
          isRoomCompleted: true,
          status: 'acknowledged',
          actionNote: 'Raum 100% fertiggestellt - Minderverbrauch als Lager-Retoure verbucht',
        });
      }
    });
  });

  // Also include any standalone alerts from Firestore not tied to direct room materials
  alerts.forEach(a => {
    if (a.status === 'reordered' && !allDeviations.some(d => d.posNr === a.materialPos && (d.roomId === a.roomId || d.roomName === a.roomName))) {
      allDeviations.push({
        id: a.id,
        roomId: a.roomId || 'allgemein',
        roomName: a.roomName || 'Baustelle',
        posNr: a.materialPos || '–',
        materialName: a.materialName || 'Nachbestellte Position',
        qu: a.qu || 'Stk',
        unitPrice: 0,
        plannedQty: 0,
        actualQty: a.exceededBy || 0,
        deltaQty: a.exceededBy || 0,
        deviationType: 'overconsumption',
        isRoomCompleted: false,
        status: a.status,
        reorderedAt: a.reorderedAt || a.updatedAt,
        actionNote: a.actionNote,
      });
    }
  });

  // KPI Metrics
  const overItems = allDeviations.filter(d => d.deviationType === 'overconsumption');
  const acuteOverItems = overItems.filter(d => d.status === 'open');
  const underItems = allDeviations.filter(d => d.deviationType === 'underconsumption');
  const reorderedItems = allDeviations.filter(d => d.status === 'reordered');

  // Filtered List
  const displayedList = allDeviations.filter(item => {
    if (filterType === 'over') return item.deviationType === 'overconsumption';
    if (filterType === 'under') return item.deviationType === 'underconsumption';
    if (filterType === 'reordered') return item.status === 'reordered';
    return true;
  });

  // Open Reorder Modal
  const handleOpenReorderModal = (item: PlanDeviationItem) => {
    setSelectedForReorder(item);
    const mgrName = project?.commercialManager || 'Sabine Müller';
    const proj = projectName || 'Bauvorhaben';
    
    setMailSubject(`Dringende Nachbestellung: ${proj} - Raum ${item.roomName} (${item.posNr})`);
    setMailBody(
`Hallo ${mgrName},

auf der Baustelle "${proj}" ist im Raum "${item.roomName} (${item.roomCode || 'Raum'})" ein Mehrverbrauch aufgetreten:

• Position: ${item.posNr} - ${item.materialName}
• Geplant (Soll): ${item.plannedQty} ${item.qu}
• Bisher verbaut (Ist): ${item.actualQty} ${item.qu}
• Dringender Mehrbedarf: +${item.deltaQty} ${item.qu}

Bitte veranlassen Sie die Nachbestellung beim Großhändler, damit die Montage ohne Verzug fortgeführt werden kann.

Mit freundlichen Grüßen
Bauleitung Burk Haustechnik`
    );
  };

  const handleConfirmReorder = async () => {
    if (!selectedForReorder) return;
    setIsProcessing(true);

    try {
      const alertId = `alert_${selectedForReorder.roomId}_${selectedForReorder.posNr}`;
      const now = new Date().toISOString();

      await createAlert(projectId, {
        id: alertId,
        projectId,
        roomId: selectedForReorder.roomId,
        roomName: selectedForReorder.roomName,
        materialPos: selectedForReorder.posNr,
        materialName: selectedForReorder.materialName,
        qu: selectedForReorder.qu,
        plannedQty: selectedForReorder.plannedQty,
        requestedTotal: selectedForReorder.actualQty,
        exceededBy: selectedForReorder.deltaQty,
        monteurName: 'Bauleiter',
        reason: `Mehrverbrauch (+${selectedForReorder.deltaQty} ${selectedForReorder.qu}) vom Bauleiter an kaufmännische Leitung (${project?.commercialManager || 'Sabine Müller'}) übermittelt`,
        status: 'reordered',
        createdAt: now,
        updatedAt: now,
        reorderedAt: now,
        actionNote: `Nachbestellung beim Großhändler veranlasst (${new Date().toLocaleDateString('de-DE')})`
      });

      // Also trigger native mail client if supported
      const recipient = project?.commercialManagerEmail || '';
      const mailtoUrl = `mailto:${encodeURIComponent(recipient)}?subject=${encodeURIComponent(mailSubject)}&body=${encodeURIComponent(mailBody)}`;
      window.open(mailtoUrl, '_blank');

      setSelectedForReorder(null);
    } finally {
      setIsProcessing(false);
    }
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
                Planabweichungen & Nachbestellungen
              </h2>
              <span className="bg-blue-100 text-blue-800 text-xs font-bold px-2.5 py-0.5 rounded-full border border-blue-200">
                {allDeviations.length} Abweichungen
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              Projekt: <strong className="text-slate-800">{projectName}</strong> • Automatische Raum-Soll/Ist-Überwachung & Nachbestellungen an Kfm. Leitung
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
        {/* KPI 1: Acute Overconsumption (Sofortiger Nachbestellbedarf) */}
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
                <span className="text-xs font-bold text-slate-800 block">Mehrverbrauch (Sofort)</span>
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

        {/* KPI 2: Completed Underconsumption (Minderverbrauch / Retouren) */}
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
                <span className="text-xs font-bold text-slate-800 block">Minderverbrauch / Retouren</span>
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

        {/* KPI 3: Reordered Items (Beim Großhändler bestellt) */}
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
                <span className="text-xs font-bold text-slate-800 block">Beim Großhändler</span>
                <span className="text-[10px] text-slate-400">Nachbestellung übermittelt</span>
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
      <div className="flex items-center space-x-2">
        {[
          { id: 'all' as const, label: `Alle Planabweichungen (${allDeviations.length})` },
          { id: 'over' as const, label: `🚨 Mehrverbrauch / Nachbestellung (${overItems.length})` },
          { id: 'under' as const, label: `🟢 Minderverbrauch / Retouren (${underItems.length})` },
          { id: 'reordered' as const, label: `✉️ Beim Großhändler bestellt (${reorderedItems.length})` },
        ].map(pill => (
          <button
            key={pill.id}
            onClick={() => setFilterType(pill.id)}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold transition-all ${
              filterType === pill.id
                ? 'bg-[#1C2A3B] text-white shadow-xs'
                : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
            }`}
          >
            {pill.label}
          </button>
        ))}
      </div>

      {/* Main Cards List */}
      {displayedList.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center space-y-3 shadow-xs">
          <div className="w-12 h-12 rounded-full bg-slate-100 text-slate-400 flex items-center justify-center mx-auto">
            <CheckCircle2 className="w-6 h-6 text-emerald-500" />
          </div>
          <h3 className="font-bold text-slate-800 text-sm">Keine Planabweichungen vorhanden</h3>
          <p className="text-xs text-slate-400 max-w-md mx-auto">
            Für die ausgewählte Ansicht wurden keine Soll/Ist-Abweichungen festgestellt. Alle verbauten Materialien stimmen punktgenau mit der Planung überein.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {displayedList.map(item => {
            const isOver = item.deviationType === 'overconsumption';
            const isReordered = item.status === 'reordered';

            return (
              <div
                key={item.id}
                className={`bg-white rounded-2xl border p-5 shadow-xs transition-all flex flex-col justify-between space-y-4 ${
                  isOver && !isReordered
                    ? 'border-red-200 hover:border-red-400 bg-red-50/10'
                    : isReordered
                    ? 'border-blue-200 hover:border-blue-400'
                    : 'border-emerald-200 hover:border-emerald-400 bg-emerald-50/10'
                }`}
              >
                <div className="space-y-3">
                  {/* Top Badges */}
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
                          <span>Minderverbrauch / Retoure</span>
                        </span>
                      )}

                      <span className="text-[10px] font-bold bg-slate-100 text-slate-700 px-2 py-0.5 rounded">
                        Pos. {item.posNr}
                      </span>
                    </div>

                    {isReordered ? (
                      <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-blue-100 text-blue-800 border border-blue-200 flex items-center space-x-1">
                        <Check className="w-3 h-3 text-blue-600" />
                        <span>Bestellt</span>
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

                  {/* Material Name & Room Tag */}
                  <div>
                    <h4 className="font-bold text-slate-900 text-base leading-snug">
                      {item.materialName}
                    </h4>
                    <div className="flex items-center space-x-2 text-xs text-slate-500 mt-1">
                      <span className="flex items-center space-x-1 text-[#3B82C4] font-semibold bg-blue-50 px-2 py-0.5 rounded">
                        <MapPin className="w-3.5 h-3.5" />
                        <span>{item.roomName} ({item.roomCode || 'Raum'})</span>
                      </span>
                      {item.floor && (
                        <span className="text-slate-400">Etage: {item.floor}</span>
                      )}
                      {item.isRoomCompleted && (
                        <span className="text-emerald-700 font-bold bg-emerald-50 px-1.5 py-0.5 rounded text-[10px]">
                          ✓ 100% Fertig
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Metrics Box (Soll vs. Ist Vergleich) */}
                  <div className="grid grid-cols-3 gap-2 p-3 bg-slate-50 rounded-xl border border-slate-100 text-center">
                    <div>
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                        Geplant (Soll)
                      </span>
                      <span className="text-sm font-black text-slate-700 block mt-0.5">
                        {item.plannedQty} {item.qu}
                      </span>
                    </div>

                    <div>
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                        Verbaut (Ist)
                      </span>
                      <span className="text-sm font-black text-slate-900 block mt-0.5">
                        {item.actualQty} {item.qu}
                      </span>
                    </div>

                    <div>
                      <span className="text-[10px] font-bold uppercase tracking-wider block text-slate-400">
                        {isOver ? 'Mehrbedarf' : 'Ersparnis'}
                      </span>
                      <span className={`text-sm font-black block mt-0.5 ${
                        isOver ? 'text-red-600' : 'text-emerald-600'
                      }`}>
                        {isOver ? `+${item.deltaQty}` : `${item.deltaQty}`} {item.qu}
                      </span>
                    </div>
                  </div>

                  {/* Explanatory notes */}
                  {item.actionNote && (
                    <p className="text-xs text-slate-500 italic bg-white p-2 rounded-lg border border-slate-100">
                      ℹ️ {item.actionNote}
                    </p>
                  )}
                  {item.reorderedAt && (
                    <div className="flex items-center space-x-1.5 text-[11px] text-blue-700 font-medium">
                      <Clock className="w-3.5 h-3.5 text-blue-500" />
                      <span>Bestellung am {new Date(item.reorderedAt).toLocaleString('de-DE')} an Kfm. Leitung übermittelt</span>
                    </div>
                  )}
                </div>

                {/* Bottom Action: Nachbestellung melden */}
                {isOver && (
                  <div className="pt-3 border-t border-slate-100 flex items-center justify-between">
                    <span className="text-[11px] text-slate-400">
                      {isReordered ? 'Nachbestellung bereits aktiv' : 'Sofortige Weiterleitung möglich'}
                    </span>

                    <button
                      onClick={() => handleOpenReorderModal(item)}
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
                  </div>
                )}

                {!isOver && (
                  <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-xs text-emerald-700">
                    <span className="font-medium text-[11px]">
                      ✓ Automatisch in VOB-Mengenabzug & Schlussrechnung berücksichtigt
                    </span>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Modal: Nachbestellung an Kaufmännische Leitung übermitteln */}
      {selectedForReorder && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-xl w-full p-6 space-y-5 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center space-x-2">
                <Send className="w-5 h-5 text-red-600" />
                <h3 className="font-bold text-base text-slate-900">
                  Material-Nachbestellung an Kfm. Leitung melden
                </h3>
              </div>
              <button
                onClick={() => setSelectedForReorder(null)}
                className="text-slate-400 hover:text-slate-600 p-1"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4 text-xs">
              <div className="p-3 bg-red-50 border border-red-200 rounded-xl space-y-1">
                <div className="font-bold text-red-900 flex items-center justify-between">
                  <span>{selectedForReorder.materialName}</span>
                  <span className="font-mono text-xs text-red-700 font-black">
                    +{selectedForReorder.deltaQty} {selectedForReorder.qu} Mehrbedarf
                  </span>
                </div>
                <div className="text-red-700 text-[11px]">
                  Raum: <strong>{selectedForReorder.roomName} ({selectedForReorder.roomCode})</strong> • Pos-Nr: <strong>{selectedForReorder.posNr}</strong>
                </div>
              </div>

              {/* Recipient */}
              <div>
                <label className="font-bold text-slate-700 block mb-1">Empfänger (Kaufmännische Leitung / Einkauf) *</label>
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
                <label className="font-bold text-slate-700 block mb-1">Nachrichtentext *</label>
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
                  onClick={() => setSelectedForReorder(null)}
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
                  <span>Nachbestellung speichern &amp; absenden</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
