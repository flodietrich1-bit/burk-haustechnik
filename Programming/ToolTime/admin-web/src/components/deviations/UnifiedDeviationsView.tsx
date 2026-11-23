import React, { useState, useMemo, useEffect } from 'react';
import type { Position, Project, Room, Booking, Alert, User, MeasurementSection } from '../../types';
import { CheckCircle2 } from 'lucide-react';
import { getMaterialActualQty } from '../../services/firestoreService';
import { addCustomPosition } from '../../services/lvPositionService';
import { savePositionsBatch } from '../../services/firestoreService';
import { subscribeMeasurementSections } from '../../services/measurementSectionService';
import { DeviationCard } from './DeviationCard';

export interface UnifiedDeviationItem {
  id: string;
  type: 'OVERCONSUMPTION' | 'UNPLANNED_MATERIAL';
  posNr: string;
  title: string;
  locationLabel: string;
  plannedQty: number;
  actualQty: number;
  deltaQty: number;
  qu: string;
  reason?: string;
  monteurName?: string;
  timestamp?: string;
  status: 'OPEN' | 'ACCEPTED_QUANTITY' | 'CREATED_ADDENDUM' | 'DISMISSED';
  positionId?: string;
}

interface UnifiedDeviationsViewProps {
  projectId: string;
  project: Project | null;
  positions: Position[];
  rooms?: Room[];
  bookings?: Booking[];
  alerts?: Alert[];
  currentUser: User | null;
}

export const UnifiedDeviationsView: React.FC<UnifiedDeviationsViewProps> = ({
  projectId,
  project,
  positions,
  rooms = [],
  bookings = [],
  alerts = [],
  currentUser
}) => {
  const [sections, setSections] = useState<MeasurementSection[]>([]);
  const [actionStatusMap, setActionStatusMap] = useState<Record<string, 'ACCEPTED_QUANTITY' | 'CREATED_ADDENDUM' | 'DISMISSED'>>({});
  const [filterType, setFilterType] = useState<'all' | 'open' | 'resolved'>('open');

  useEffect(() => {
    const unsub = subscribeMeasurementSections(projectId, setSections);
    return () => unsub();
  }, [projectId]);

  const isLvMode = project?.measurementMode === 'LV_BASED';

  // Gather all deviations
  const deviations = useMemo(() => {
    const list: UnifiedDeviationItem[] = [];

    // 1. Room-based deviations
    if (!isLvMode && rooms.length > 0) {
      rooms.forEach(room => {
        (room.materials || []).forEach(m => {
          const act = getMaterialActualQty(m, room, bookings);
          const pl = Number(m.plannedQty) || 0;
          const diff = act - pl;
          if (diff > 0) {
            const devId = `room_${room.id}_${m.posNr || m.positionId}`;
            list.push({
              id: devId,
              type: 'OVERCONSUMPTION',
              posNr: m.posNr,
              title: m.shortText,
              locationLabel: room.name || room.code || 'Raum',
              plannedQty: pl,
              actualQty: act,
              deltaQty: diff,
              qu: m.qu || 'Stk',
              reason: m.notes || 'Mehrverbrauch im Raum verbaut',
              monteurName: room.completedBy,
              timestamp: room.completedAt || room.updatedAt,
              status: actionStatusMap[devId] || 'OPEN',
              positionId: m.positionId
            });
          }
        });
      });
    }

    // 2. LV Section-based deviations
    if (sections.length > 0) {
      sections.forEach(sec => {
        (sec.items || []).forEach((item, idx) => {
          if (item.isUnplannedMaterial) {
            const devId = `sec_unpl_${sec.id}_${idx}`;
            list.push({
              id: devId,
              type: 'UNPLANNED_MATERIAL',
              posNr: 'Nicht im LV',
              title: item.customDescription || item.shortText || 'Außerplanmäßiges Material',
              locationLabel: sec.sectionTitle,
              plannedQty: 0,
              actualQty: item.quantity,
              deltaQty: item.quantity,
              qu: item.qu || 'Stk',
              reason: 'Vom Monteur als außerplanmäßig gemeldet',
              monteurName: sec.createdBy,
              timestamp: sec.createdAt,
              status: actionStatusMap[devId] || 'OPEN',
              positionId: item.lvItemId
            });
          }
        });
      });
    }

    // 3. Alerts for overconsumption & unplanned items
    alerts.forEach(alert => {
      const devId = `alert_${alert.id}`;
      if (!list.some(d => d.id === devId)) {
        list.push({
          id: devId,
          type: alert.materialPos === 'Nicht im LV' ? 'UNPLANNED_MATERIAL' : 'OVERCONSUMPTION',
          posNr: alert.materialPos || '-',
          title: alert.materialName,
          locationLabel: alert.roomName || 'Baustelle',
          plannedQty: alert.plannedQty,
          actualQty: alert.requestedTotal,
          deltaQty: alert.exceededBy || (alert.requestedTotal - alert.plannedQty),
          qu: alert.qu || 'Stk',
          reason: alert.reason,
          monteurName: alert.monteurName,
          timestamp: alert.createdAt,
          status: actionStatusMap[devId] || 'OPEN',
          positionId: alert.materialId
        });
      }
    });

    return list;
  }, [rooms, sections, alerts, bookings, isLvMode, actionStatusMap]);

  // Action 1: Als Mengenmehrung übernehmen
  const handleAcceptQuantity = async (dev: UnifiedDeviationItem) => {
    try {
      const pos = positions.find(p => p.id === dev.positionId || (p.displayCode || p.posNr) === dev.posNr);
      if (pos) {
        const newQty = (pos.qty || 0) + dev.deltaQty;
        await savePositionsBatch(projectId, [{
          ...pos,
          qty: newQty,
          deliveredQty: Math.max(pos.deliveredQty || 0, newQty)
        }]);
      }
      setActionStatusMap(prev => ({ ...prev, [dev.id]: 'ACCEPTED_QUANTITY' }));
    } catch (err: any) {
      alert('Fehler beim Übernehmen: ' + (err.message || err));
    }
  };

  // Action 2: Als Nachtrag anlegen
  const handleCreateAddendum = async (dev: UnifiedDeviationItem) => {
    try {
      const trade = positions.find(p => p.id === dev.positionId)?.tradeCategory || 'Nachträge & Sonderleistungen';
      await addCustomPosition(projectId, positions, {
        officialTitle: `Nachtrag: ${dev.title}`,
        aliasTitle: dev.title,
        monteurInfo: `Erstellt aus Abweichung (${dev.locationLabel}): ${dev.reason || ''}`,
        tradeCategory: trade,
        qty: dev.deltaQty,
        qu: dev.qu,
        unitPriceVK: 0
      });
      setActionStatusMap(prev => ({ ...prev, [dev.id]: 'CREATED_ADDENDUM' }));
    } catch (err: any) {
      alert('Fehler beim Anlegen des Nachtrags: ' + (err.message || err));
    }
  };

  // Action 3: Verwerfen / Intern verbuchen
  const handleDismiss = (dev: UnifiedDeviationItem) => {
    setActionStatusMap(prev => ({ ...prev, [dev.id]: 'DISMISSED' }));
  };

  const filteredDeviations = deviations.filter(d => {
    if (filterType === 'open') return d.status === 'OPEN';
    if (filterType === 'resolved') return d.status !== 'OPEN';
    return true;
  });

  const canManage = currentUser?.role === 'admin' || currentUser?.role === 'projektleiter' || currentUser?.role === 'bauleiter';

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center space-x-2">
            <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-blue-100 text-blue-800 uppercase">
              Zentraler Abweichungs-Pool
            </span>
            <span className="text-xs text-slate-400">
              {isLvMode ? '• Aus LV-Aufmaß-Abschnitten' : '• Aus Etagen- & Raum-Aufmaßen'}
            </span>
          </div>
          <h2 className="text-xl font-black text-slate-900 tracking-tight mt-1">
            Abweichungen & Projektleiter-Freigabe
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Mengenmehrungen und außerplanmäßige Materialien klassifizieren und verbindlich abrechnen.
          </p>
        </div>

        <div className="flex items-center space-x-1 border border-slate-200 p-0.5 rounded-xl bg-slate-50 text-[11px] font-semibold">
          <button
            type="button"
            onClick={() => setFilterType('open')}
            className={`px-3 py-1.5 rounded-lg transition-all ${filterType === 'open' ? 'bg-white text-blue-700 shadow-sm' : 'text-slate-500 hover:text-slate-800'}`}
          >
            Offen ({deviations.filter(d => d.status === 'OPEN').length})
          </button>
          <button
            type="button"
            onClick={() => setFilterType('resolved')}
            className={`px-3 py-1.5 rounded-lg transition-all ${filterType === 'resolved' ? 'bg-white text-emerald-700 shadow-sm' : 'text-slate-500 hover:text-slate-800'}`}
          >
            Bearbeitet ({deviations.filter(d => d.status !== 'OPEN').length})
          </button>
          <button
            type="button"
            onClick={() => setFilterType('all')}
            className={`px-3 py-1.5 rounded-lg transition-all ${filterType === 'all' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-800'}`}
          >
            Alle ({deviations.length})
          </button>
        </div>
      </div>

      {/* Deviations List */}
      {filteredDeviations.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center text-slate-500 text-xs shadow-sm">
          <CheckCircle2 className="w-10 h-10 text-emerald-500 mx-auto mb-2" />
          <p className="font-semibold text-slate-800">Keine offenen Abweichungen</p>
          <p className="text-slate-400 mt-1 max-w-sm mx-auto">
            Alle Soll-Ist-Mengen liegen im Plan und es wurden keine ungeklärten Materialien gemeldet.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredDeviations.map(dev => (
            <DeviationCard
              key={dev.id}
              dev={dev}
              canManage={canManage}
              onAcceptQuantity={handleAcceptQuantity}
              onCreateAddendum={handleCreateAddendum}
              onDismiss={handleDismiss}
            />
          ))}
        </div>
      )}
    </div>
  );
};
