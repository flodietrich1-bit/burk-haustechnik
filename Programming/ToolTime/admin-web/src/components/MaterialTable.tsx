import React, { useState, useMemo } from 'react';
import type { Position, Booking, Room } from '../types';
import { Package, CheckCircle, TrendingUp, TrendingDown, Filter } from 'lucide-react';
import { getMaterialActualQty } from '../services/firestoreService';

interface MaterialTableProps {
  positions: Position[];
  bookings?: Booking[];
  rooms?: Room[];
  searchTerm: string;
}

export const MaterialTable: React.FC<MaterialTableProps> = ({ positions, bookings = [], rooms = [], searchTerm }) => {
  const [selectedGroup, setSelectedGroup] = useState<string>('all');
  const [selectedStatus, setSelectedStatus] = useState<string>('all');

  const getPositionMetrics = useMemo(() => {
    return (pos: Position) => {
      let roomInstalled = 0;
      let totalPlannedInRooms = 0;
      let remainingNeeded = 0;
      let hasRoomMatches = false;

      rooms.forEach(r => {
        const isUnlocked = r.isCompleted === false || r.status === 'in_progress';
        const isDone = !isUnlocked && (r.status === 'completed' || r.isCompleted === true || ((r as any).pct === 100));

        (r.materials || []).forEach(m => {
          const isMatch = 
            (m.positionId && m.positionId === pos.id) ||
            (m.posNr && m.posNr === pos.posNr) ||
            (m.shortText && pos.shortText && m.shortText.trim().toLowerCase() === pos.shortText.trim().toLowerCase());

          if (isMatch) {
            hasRoomMatches = true;
            const pl = Number(m.plannedQty) || 0;
            const act = getMaterialActualQty(m, r, bookings);
            roomInstalled += act;
            totalPlannedInRooms += pl;

            if (!isDone) {
              remainingNeeded += Math.max(0, pl - act);
            }
          }
        });
      });

      // Also check if there are direct bookings on this position that weren't counted in rooms
      let standaloneBookingQty = 0;
      if (!hasRoomMatches && bookings.length > 0) {
        bookings.forEach(b => {
          const posId = b.positionId || (b as any).itemId;
          const posNr = b.positionNr || (b as any).itemOz;
          if (posId === pos.id || (posNr && posNr === pos.posNr)) {
            standaloneBookingQty += Number(b.quantity) || 0;
          }
        });
      }

      const installed = hasRoomMatches ? roomInstalled : Math.max(Number(pos.installedQty) || 0, standaloneBookingQty);
      const planned = Number(pos.qty) || totalPlannedInRooms;
      const rest = hasRoomMatches ? remainingNeeded : Math.max(0, planned - installed);
      
      // Delta: Verbaut - Geplant (positiv = Mehrverbrauch, negativ = Minderverbrauch)
      const delta = installed - planned;
      const deviationType: 'over' | 'under' | 'exact' = delta > 0 ? 'over' : (delta < 0 ? 'under' : 'exact');

      // Fortschritt in % (0 - 100)
      const percent = planned > 0 
        ? Math.min(100, Math.max(0, Math.round((installed / planned) * 100))) 
        : (installed > 0 ? 100 : 0);

      const isCompleted = (planned > 0 && installed >= planned) || (rest === 0 && installed > 0);
      const isPartial = installed > 0 && !isCompleted;
      const isOpen = installed === 0;

      return {
        planned,
        installed,
        delta,
        rest,
        deviationType,
        percent,
        isCompleted,
        isPartial,
        isOpen
      };
    };
  }, [rooms, bookings]);

  // Unique groups from data
  const groups = useMemo(() => {
    const set = new Set<string>();
    positions.forEach(p => p.group && set.add(p.group));
    return Array.from(set);
  }, [positions]);

  // Filtered positions
  const filteredPositions = useMemo(() => {
    return positions.filter(p => {
      const matchesSearch = 
        !searchTerm || 
        p.posNr.toLowerCase().includes(searchTerm.toLowerCase()) ||
        p.shortText.toLowerCase().includes(searchTerm.toLowerCase()) ||
        p.group.toLowerCase().includes(searchTerm.toLowerCase());

      const matchesGroup = selectedGroup === 'all' || p.group === selectedGroup;

      const m = getPositionMetrics(p);
      const matchesStatus = 
        selectedStatus === 'all' ||
        (selectedStatus === 'over' && m.deviationType === 'over') ||
        (selectedStatus === 'under' && m.deviationType === 'under') ||
        (selectedStatus === 'exact' && m.deviationType === 'exact') ||
        (selectedStatus === 'completed' && m.isCompleted) ||
        (selectedStatus === 'partial' && m.isPartial) ||
        (selectedStatus === 'open' && m.isOpen);

      return matchesSearch && matchesGroup && matchesStatus;
    });
  }, [positions, searchTerm, selectedGroup, selectedStatus, getPositionMetrics]);

  // Totals & KPI Metrics
  const totalItems = positions.length;
  const exactItems = positions.filter(p => getPositionMetrics(p).deviationType === 'exact' && getPositionMetrics(p).installed > 0).length;
  const overItems = positions.filter(p => getPositionMetrics(p).deviationType === 'over').length;
  const underItems = positions.filter(p => getPositionMetrics(p).deviationType === 'under' && getPositionMetrics(p).isCompleted).length;
  const totalValue = positions.reduce((acc, p) => acc + (getPositionMetrics(p).installed * (p.unitPrice || 0)), 0);

  return (
    <div className="space-y-6">
      
      {/* Top Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-xs font-medium text-slate-500">Gesamt LV-Positionen</p>
            <p className="text-2xl font-bold text-slate-800">{totalItems}</p>
          </div>
          <div className="w-10 h-10 rounded-lg bg-blue-50 text-[#3B82C4] flex items-center justify-center">
            <Package className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-xs font-medium text-slate-500">Punktgenau / Planmäßig</p>
            <p className="text-2xl font-bold text-slate-700">{exactItems}</p>
          </div>
          <div className="w-10 h-10 rounded-lg bg-slate-100 text-slate-600 flex items-center justify-center">
            <CheckCircle className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-xs font-medium text-slate-500">Mehrverbrauch (Abweichung)</p>
            <p className="text-2xl font-bold text-rose-600">{overItems}</p>
          </div>
          <div className="w-10 h-10 rounded-lg bg-rose-50 text-rose-600 flex items-center justify-center">
            <TrendingUp className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-xs font-medium text-slate-500">Minderverbrauch / Ersparnis</p>
            <p className="text-2xl font-bold text-[#2FA36B]">{underItems}</p>
          </div>
          <div className="w-10 h-10 rounded-lg bg-emerald-50 text-[#2FA36B] flex items-center justify-center">
            <TrendingDown className="w-5 h-5" />
          </div>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center space-x-2 text-xs font-semibold text-slate-600">
            <Filter className="w-4 h-4 text-[#3B82C4]" />
            <span>Gewerk:</span>
          </div>
          <select
            value={selectedGroup}
            onChange={(e) => setSelectedGroup(e.target.value)}
            className="px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-medium text-slate-700 focus:outline-none focus:ring-2 focus:ring-[#3B82C4]"
          >
            <option value="all">Alle Titel / Gewerke ({groups.length})</option>
            {groups.map(g => (
              <option key={g} value={g}>{g}</option>
            ))}
          </select>

          <div className="flex items-center space-x-2 text-xs font-semibold text-slate-600 ml-2">
            <span>Filter / Status:</span>
          </div>
          <select
            value={selectedStatus}
            onChange={(e) => setSelectedStatus(e.target.value)}
            className="px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-medium text-slate-700 focus:outline-none focus:ring-2 focus:ring-[#3B82C4]"
          >
            <option value="all">Alle Positionen</option>
            <option value="over">Nur Mehrverbrauch (+ Rot)</option>
            <option value="under">Nur Minderverbrauch (- Grün)</option>
            <option value="exact">Nur Punktgenau (Planmäßig)</option>
            <option value="partial">In Montage (Teilverbaut)</option>
            <option value="completed">Vollständig verbaut</option>
            <option value="open">Noch offen</option>
          </select>
        </div>

        <div className="flex items-center space-x-4 text-xs text-slate-500 font-medium">
          {totalValue > 0 && (
            <span className="hidden sm:inline text-slate-600">
              Verbauter Wert: <strong className="text-slate-900">{totalValue.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €</strong>
            </span>
          )}
          <span>
            Zeige <span className="font-bold text-slate-800">{filteredPositions.length}</span> von <span className="font-bold text-slate-800">{positions.length}</span> Positionen
          </span>
        </div>
      </div>

      {/* Main Material Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 text-slate-500 text-[11px] font-semibold uppercase border-b border-slate-200">
                <th className="py-3 px-4 w-20">Pos-Nr</th>
                <th className="py-3 px-4">Gewerk / Beschreibung</th>
                <th className="py-3 px-4 w-24 text-right">Geplant</th>
                <th className="py-3 px-4 w-28 text-center">Abweichung</th>
                <th className="py-3 px-4 w-28 text-right">Gesamt Verbaut</th>
                <th className="py-3 px-4 w-24 text-right">Noch offen</th>
                <th className="py-3 px-4 w-36">Fortschritt</th>
                <th className="py-3 px-4 w-24 text-right">Einzelpreis</th>
                <th className="py-3 px-4 w-28 text-center">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-xs">
              {filteredPositions.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-8 text-center text-slate-400">
                    Keine LV-Positionen für diesen Filter gefunden.
                  </td>
                </tr>
              ) : (
                filteredPositions.map((pos) => {
                  const m = getPositionMetrics(pos);

                  // Dynamic color transition from Red (1%) through Amber to Green (100%)
                  const currentHue = Math.min(142, Math.max(0, Math.round((m.percent / 100) * 142)));
                  const progressColor = m.percent === 100 
                    ? '#10B981' 
                    : (m.percent === 0 ? '#E2E8F0' : `hsl(${currentHue}, 85%, 44%)`);

                  return (
                    <tr key={pos.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="py-3 px-4 font-mono font-bold text-[#3B82C4]">
                        {pos.posNr}
                      </td>
                      <td className="py-3 px-4">
                        <div className="font-semibold text-slate-800 line-clamp-1">{pos.shortText}</div>
                        <div className="text-[11px] text-slate-400 flex items-center space-x-2 mt-0.5">
                          <span>{pos.group}</span>
                          {pos.isCutMaterial && (
                            <span className="bg-blue-100 text-blue-700 text-[10px] px-1.5 py-0.2 rounded font-medium">
                              Verschnitt (m)
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="py-3 px-4 text-right font-medium text-slate-700">
                        {m.planned} {pos.qu}
                      </td>
                      <td className="py-3 px-4 text-center">
                        {m.delta > 0 ? (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-bold bg-rose-100 text-rose-700 border border-rose-200">
                            +{m.delta} {pos.qu}
                          </span>
                        ) : m.delta < 0 ? (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
                            {m.delta} {pos.qu}
                          </span>
                        ) : (
                          <span className="text-slate-400 font-mono text-[11px]">–</span>
                        )}
                      </td>
                      <td className="py-3 px-4 text-right font-bold text-slate-900">
                        {m.installed} {pos.qu}
                      </td>
                      <td className="py-3 px-4 text-right font-semibold text-slate-600">
                        {m.rest > 0 ? `${m.rest} ${pos.qu}` : <span className="text-slate-400">–</span>}
                      </td>
                      <td className="py-3 px-4">
                        <div className="space-y-1">
                          <div className="flex justify-between text-[10px] text-slate-900 font-black">
                            <span>{m.percent}%</span>
                          </div>
                          <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                            <div
                              className="h-full rounded-full transition-all duration-500"
                              style={{ 
                                width: `${m.percent}%`,
                                backgroundColor: progressColor
                              }}
                            />
                          </div>
                        </div>
                      </td>
                      <td className="py-3 px-4 text-right text-slate-600 font-mono">
                        {pos.unitPrice ? `${pos.unitPrice.toFixed(2)} €` : '-'}
                      </td>
                      <td className="py-3 px-4 text-center">
                        {m.delta > 0 ? (
                          <span className="inline-flex items-center space-x-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-rose-100 text-rose-800 border border-rose-200">
                            <TrendingUp className="w-3 h-3" />
                            <span>Mehrverbrauch</span>
                          </span>
                        ) : m.delta < 0 && m.isCompleted ? (
                          <span className="inline-flex items-center space-x-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
                            <TrendingDown className="w-3 h-3" />
                            <span>Ersparnis</span>
                          </span>
                        ) : m.isCompleted ? (
                          <span className="inline-flex items-center space-x-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-700 border border-slate-200">
                            <CheckCircle className="w-3 h-3 text-[#2FA36B]" />
                            <span>Punktgenau</span>
                          </span>
                        ) : m.isPartial ? (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-amber-50 text-amber-700 border border-amber-200">
                            In Montage
                          </span>
                        ) : (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium bg-slate-50 text-slate-500 border border-slate-200">
                            Offen
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

