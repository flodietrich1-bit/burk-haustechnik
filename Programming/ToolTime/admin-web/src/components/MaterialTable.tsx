import React, { useState, useMemo } from 'react';
import type { Position, Booking, Room, User, Project, MeasurementSection } from '../types';
import { ChevronDown, ChevronRight, Plus, Check, X, AlertTriangle } from 'lucide-react';
import { useMaterialMetrics } from './material/useMaterialMetrics';
import { MaterialStatsCards } from './material/MaterialStatsCards';
import { MaterialFilterBar, type SourceFilterType } from './material/MaterialFilterBar';
import { MaterialBalanceRow } from './material/MaterialBalanceRow';
import { MaterialTableModals } from './material/MaterialTableModals';
import { addCustomPosition, updatePositionFields, togglePositionCancelled, togglePositionMonteurVisibility, comparePositionCodes } from '../services/lvPositionService';
import { savePositionsBatch, deleteCustomPositions } from '../services/firestoreService';

interface MaterialTableProps {
  positions: Position[];
  bookings?: Booking[];
  rooms?: Room[];
  searchTerm: string;
  projectId?: string;
  currentUser?: User | null;
  project?: Project | null;
  sections?: MeasurementSection[];
}

export const MaterialTable: React.FC<MaterialTableProps> = ({ 
  positions, 
  bookings = [], 
  rooms = [], 
  searchTerm,
  projectId = '',
  currentUser = null,
  project = null,
  sections = []
}) => {
  const [isEditMode, setIsEditMode] = useState<boolean>(false);
  const [selectedGroup, setSelectedGroup] = useState<string>('all');
  const [selectedStatus, setSelectedStatus] = useState<string>('all');
  const [sourceFilter, setSourceFilter] = useState<SourceFilterType>('all');
  const [onlyInstalled, setOnlyInstalled] = useState<boolean>(false);
  const [collapsedGroups, setCollapsedGroups] = useState<Record<string, boolean>>({});

  // Modals state
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [insertAfterTarget, setInsertAfterTarget] = useState<Position | undefined>(undefined);
  const [defaultTradeTarget, setDefaultTradeTarget] = useState<string | undefined>(undefined);
  const [aliasModalPos, setAliasModalPos] = useState<Position | null>(null);
  const [aliasModalMode, setAliasModalMode] = useState<'alias' | 'info'>('alias');
  const [editOriginalPos, setEditOriginalPos] = useState<Position | null>(null);
  const [isExcelModalOpen, setIsExcelModalOpen] = useState(false);
  const [isExportModalOpen, setIsExportModalOpen] = useState(false);

  // Staging state for Excel import preview before persisting to Firestore
  const [pendingExcelImports, setPendingExcelImports] = useState<Partial<Position>[] | null>(null);
  const [isSavingExcel, setIsSavingExcel] = useState(false);

  const displayedPositions = useMemo(() => {
    if (!pendingExcelImports) return positions;
    const mergedMap = new Map<string, Position>();
    positions.forEach(p => mergedMap.set(p.id, p));
    pendingExcelImports.forEach(imp => {
      if (!imp.id) return;
      const existing = mergedMap.get(imp.id);
      mergedMap.set(imp.id, { ...(existing || {}), ...imp } as Position);
    });
    return Array.from(mergedMap.values());
  }, [positions, pendingExcelImports]);

  const getPositionMetrics = useMaterialMetrics(rooms, bookings);

  const canEditCommercial = useMemo(() => {
    if (!currentUser) return true;
    const r = currentUser.role;
    return r === 'admin' || r === 'kaufmaennisch' || r === 'projektleiter' || r === 'bauleiter';
  }, [currentUser]);

  // Unique groups from data
  const groups = useMemo(() => {
    const set = new Set<string>();
    displayedPositions.forEach(p => {
      const g = p.tradeCategory || p.group;
      if (g) set.add(g);
    });
    return Array.from(set);
  }, [displayedPositions]);

  // Source Counts (Alle, Nur Original, Nicht im LV)
  const sourceCounts = useMemo(() => {
    let original = 0;
    let custom = 0;
    displayedPositions.forEach(p => {
      if (p.sourceType === 'CUSTOM_ADDED') custom++;
      else original++;
    });
    return { all: displayedPositions.length, original, custom };
  }, [displayedPositions]);

  // Filtered positions
  const filteredPositions = useMemo(() => {
    return displayedPositions.filter(p => {
      if (sourceFilter === 'original' && p.sourceType === 'CUSTOM_ADDED') return false;
      if (sourceFilter === 'custom' && p.sourceType !== 'CUSTOM_ADDED') return false;

      if (searchTerm) {
        const s = searchTerm.toLowerCase();
        const code = (p.displayCode || p.posNr).toLowerCase();
        const title = (p.officialTitle || p.shortText || '').toLowerCase();
        const alias = (p.aliasTitle || '').toLowerCase();
        const grp = (p.tradeCategory || p.group || '').toLowerCase();
        if (!code.includes(s) && !title.includes(s) && !alias.includes(s) && !grp.includes(s)) return false;
      }

      const posGroup = p.tradeCategory || p.group;
      if (selectedGroup !== 'all' && posGroup !== selectedGroup) return false;

      const m = getPositionMetrics(p);
      if (onlyInstalled && m.installed <= 0) return false;

      if (selectedStatus === 'over' && m.deviationType !== 'over') return false;
      if (selectedStatus === 'under' && m.deviationType !== 'under') return false;
      if (selectedStatus === 'exact' && (m.deviationType !== 'exact' || !m.isCompleted)) return false;
      if (selectedStatus === 'partial' && !m.isPartial) return false;
      if (selectedStatus === 'completed' && !m.isCompleted) return false;
      if (selectedStatus === 'open' && !m.isOpen) return false;
      if (selectedStatus === 'cancelled' && !p.isCancelled && p.status !== 'cancelled') return false;

      return true;
    });
  }, [displayedPositions, searchTerm, sourceFilter, selectedGroup, selectedStatus, onlyInstalled, getPositionMetrics]);

  // Grouped by Trade
  const groupedPositions = useMemo(() => {
    const map: { [trade: string]: Position[] } = {};
    filteredPositions.forEach(p => {
      const g = p.tradeCategory || p.group || 'Allgemeine Positionen';
      if (!map[g]) map[g] = [];
      map[g].push(p);
    });
    Object.keys(map).forEach(g => {
      map[g].sort(comparePositionCodes);
    });
    return map;
  }, [filteredPositions]);

  // Totals & KPI Metrics
  const exactItems = useMemo(() => displayedPositions.filter(p => {
    const m = getPositionMetrics(p);
    return m.isCompleted && m.delta === 0 && m.installed > 0;
  }).length, [displayedPositions, getPositionMetrics]);

  const overItems = useMemo(() => displayedPositions.filter(p => getPositionMetrics(p).deviationType === 'over').length, [displayedPositions, getPositionMetrics]);
  const underItems = useMemo(() => displayedPositions.filter(p => getPositionMetrics(p).deviationType === 'under').length, [displayedPositions, getPositionMetrics]);
  const totalValue = useMemo(() => {
    return displayedPositions.reduce((acc, p) => acc + (getPositionMetrics(p).installed * (p.unitPriceVK ?? p.unitPrice ?? 0)), 0);
  }, [displayedPositions, getPositionMetrics]);

  const handleUpdateFields = async (positionId: string, updates: Partial<Position>) => {
    if (!projectId) return;
    await updatePositionFields(projectId, positionId, positions, updates);
  };

  const handleDeleteCustomPositions = async () => {
    if (!projectId || sourceCounts.custom === 0) return;
    if (window.confirm(`Möchten Sie alle ${sourceCounts.custom} nicht im LV enthaltenen Positionen löschen und die Materialbilanz auf das Original-LV (${sourceCounts.original} Positionen) zurücksetzen?`)) {
      await deleteCustomPositions(projectId);
      setSourceFilter('all');
    }
  };

  const handleConfirmExcelImport = async () => {
    if (!projectId || !pendingExcelImports) return;
    setIsSavingExcel(true);
    try {
      await savePositionsBatch(projectId, pendingExcelImports);
      setPendingExcelImports(null);
    } finally {
      setIsSavingExcel(false);
    }
  };

  const handleDiscardExcelImport = () => {
    setPendingExcelImports(null);
  };

  return (
    <div className="space-y-5">
      {/* KPI Stat Cards */}
      <MaterialStatsCards
        totalItems={displayedPositions.length}
        exactItems={exactItems}
        overItems={overItems}
        underItems={underItems}
      />

      {/* Filter Bar with Source Chips & Edit Mode Toggle */}
      <MaterialFilterBar
        groups={groups}
        selectedGroup={selectedGroup}
        setSelectedGroup={setSelectedGroup}
        selectedStatus={selectedStatus}
        setSelectedStatus={setSelectedStatus}
        sourceFilter={sourceFilter}
        setSourceFilter={setSourceFilter}
        sourceCounts={sourceCounts}
        onlyInstalled={onlyInstalled}
        setOnlyInstalled={setOnlyInstalled}
        totalFilteredCount={filteredPositions.length}
        totalPositionsCount={displayedPositions.length}
        totalValue={totalValue}
        isEditMode={isEditMode}
        setIsEditMode={setIsEditMode}
        onOpenAddModal={() => {
          setInsertAfterTarget(undefined);
          setDefaultTradeTarget(undefined);
          setIsAddModalOpen(true);
        }}
        onOpenExcelModal={() => setIsExcelModalOpen(true)}
        onOpenExportModal={() => setIsExportModalOpen(true)}
        onDeleteCustom={pendingExcelImports ? undefined : handleDeleteCustomPositions}
        canEditCommercial={canEditCommercial}
      />

      {/* Excel Import Confirmation Banner (Vorschau-Modus vor endgültigem Speichern) */}
      {pendingExcelImports && (
        <div className="p-4 bg-amber-50 border-2 border-amber-400 rounded-xl shadow-md flex flex-col sm:flex-row sm:items-center justify-between gap-3 animate-in fade-in duration-150">
          <div className="flex items-start sm:items-center space-x-3">
            <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5 sm:mt-0" />
            <div>
              <p className="text-sm font-bold text-amber-950">
                Excel-Abgleich als Vorschau geladen ({pendingExcelImports.length} Positionen aktualisiert/ergänzt)
              </p>
              <p className="text-xs text-amber-800">
                Prüfen Sie die aktualisierte Materialliste unten. Erst nach Bestätigung werden die Änderungen endgültig gespeichert.
              </p>
            </div>
          </div>
          <div className="flex items-center space-x-2.5 shrink-0">
            <button
              type="button"
              disabled={isSavingExcel}
              onClick={handleDiscardExcelImport}
              className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-xl text-xs font-bold shadow-sm flex items-center space-x-1.5 transition-colors disabled:opacity-50 cursor-pointer"
            >
              <X className="w-4 h-4" />
              <span>Änderungen verwerfen</span>
            </button>
            <button
              type="button"
              disabled={isSavingExcel}
              onClick={handleConfirmExcelImport}
              className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold shadow-sm flex items-center space-x-1.5 transition-colors disabled:opacity-50 cursor-pointer"
            >
              <Check className="w-4 h-4" />
              <span>{isSavingExcel ? 'Wird gespeichert...' : 'Aktualisierte Materialliste speichern'}</span>
            </button>
          </div>
        </div>
      )}

      {/* Main Material Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 text-slate-500 text-[11px] font-semibold uppercase border-b border-slate-200">
                <th className="py-3 px-3 w-28">Pos-Nr & Typ</th>
                <th className="py-3 px-3">Gewerk / Beschreibung</th>
                <th className="py-3 px-3 w-24 text-right">Geplant</th>
                <th className="py-3 px-3 w-32 text-center">Abweichung</th>
                <th className="py-3 px-3 w-28 text-right">Verbaut</th>
                <th className="py-3 px-3 w-24 text-right">Offen</th>
                <th className="py-3 px-3 w-24 text-right">Vorrätig</th>
                <th className="py-3 px-3 w-32">Fortschritt</th>
                <th className="py-3 px-3 w-28 text-right">VK-Preis</th>
                <th className="py-3 px-3 w-28 text-center">{isEditMode ? 'Bestellstatus' : 'Status'}</th>
                <th className="py-3 px-3 w-28 text-right">Gesamtpreis</th>
                {isEditMode && <th className="py-3 px-3 w-36 text-right">Aktionen</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-xs">
              {filteredPositions.length === 0 ? (
                <tr>
                  <td colSpan={isEditMode ? 12 : 11} className="py-12 text-center text-slate-400">
                    Keine Positionen für diesen Filter gefunden.
                  </td>
                </tr>
              ) : (
                Object.entries(groupedPositions).map(([grp, items]) => {
                  const isCollapsed = collapsedGroups[grp];
                  return (
                    <React.Fragment key={grp}>
                      <tr className="bg-slate-100/90 border-t border-b border-slate-200 font-bold text-slate-700 text-xs">
                        <td colSpan={isEditMode ? 12 : 11} className="py-2 px-3">
                          <div className="flex items-center justify-between">
                            <button
                              type="button"
                              onClick={() => setCollapsedGroups(prev => ({ ...prev, [grp]: !prev[grp] }))}
                              className="flex items-center space-x-2 text-left hover:text-[#3B82C4] transition-colors"
                            >
                              {isCollapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                              <span className="uppercase tracking-wider">{grp}</span>
                              <span className="text-[11px] font-normal text-slate-500">({items.length})</span>
                            </button>
                            {isEditMode && canEditCommercial && (
                              <button
                                type="button"
                                onClick={() => {
                                  setDefaultTradeTarget(grp);
                                  setInsertAfterTarget(items[items.length - 1]);
                                  setIsAddModalOpen(true);
                                }}
                                className="text-[11px] font-bold text-[#3B82C4] hover:text-[#285d8f] flex items-center space-x-1 px-2 py-0.5 rounded hover:bg-white"
                              >
                                <Plus className="w-3.5 h-3.5" />
                                <span>In {grp} hinzufügen</span>
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                      {!isCollapsed && items.map(pos => (
                        <MaterialBalanceRow
                          key={pos.id}
                          position={pos}
                          metrics={getPositionMetrics(pos)}
                          isEditMode={isEditMode}
                          canEditCommercial={canEditCommercial}
                          onOpenAlias={(p) => { setAliasModalPos(p); setAliasModalMode('alias'); }}
                          onOpenInfo={(p) => { setAliasModalPos(p); setAliasModalMode('info'); }}
                          onInsertBelow={(p) => {
                            setInsertAfterTarget(p);
                            setDefaultTradeTarget(p.tradeCategory || p.group);
                            setIsAddModalOpen(true);
                          }}
                          onToggleCancel={(p) => {
                            if (projectId) togglePositionCancelled(projectId, p.id, positions);
                          }}
                          onToggleMonteurVisibility={(p) => {
                            if (projectId) togglePositionMonteurVisibility(projectId, p.id, positions);
                          }}
                          onUpdateStatus={(posId, status) => handleUpdateFields(posId, { orderStatus: status })}
                          onUpdatePrice={(posId, price) => handleUpdateFields(posId, { unitPriceVK: price })}
                        />
                      ))}
                    </React.Fragment>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* MODALS */}
      <MaterialTableModals
        projectId={projectId}
        positions={positions}
        sections={sections}
        project={project}
        currentUser={currentUser}
        isAddOpen={isAddModalOpen}
        onCloseAdd={() => { setIsAddModalOpen(false); setInsertAfterTarget(undefined); setDefaultTradeTarget(undefined); }}
        onSaveNew={async (data, target) => { if (projectId) await addCustomPosition(projectId, positions, data, target); }}
        insertAfterTarget={insertAfterTarget}
        defaultTradeTarget={defaultTradeTarget}
        aliasModalPos={aliasModalPos}
        aliasModalMode={aliasModalMode}
        onCloseAlias={() => setAliasModalPos(null)}
        onSaveAlias={handleUpdateFields}
        editOriginalPos={editOriginalPos}
        onCloseOriginal={() => setEditOriginalPos(null)}
        onSaveOriginal={handleUpdateFields}
        isExcelOpen={isExcelModalOpen}
        onCloseExcel={() => setIsExcelModalOpen(false)}
        onImportExcel={async (imported) => {
          setPendingExcelImports(imported);
          setIsExcelModalOpen(false);
        }}
        onCleanCustom={pendingExcelImports ? undefined : handleDeleteCustomPositions}
        isExportOpen={isExportModalOpen}
        onCloseExport={() => setIsExportModalOpen(false)}
      />
    </div>
  );
};
