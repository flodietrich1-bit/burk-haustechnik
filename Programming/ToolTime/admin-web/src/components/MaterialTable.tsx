import React, { useState, useMemo } from 'react';
import type { Position, Booking, Room, User, Project, MeasurementSection } from '../types';
import { ChevronDown, ChevronRight, Plus } from 'lucide-react';
import { useMaterialMetrics } from './material/useMaterialMetrics';
import { MaterialStatsCards } from './material/MaterialStatsCards';
import { MaterialFilterBar, type SourceFilterType } from './material/MaterialFilterBar';
import { MaterialBalanceRow } from './material/MaterialBalanceRow';
import { MaterialTableModals } from './material/MaterialTableModals';
import { addCustomPosition, updatePositionFields } from '../services/lvPositionService';
import { savePositionsBatch } from '../services/firestoreService';

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

  const getPositionMetrics = useMaterialMetrics(rooms, bookings);

  const canEditCommercial = useMemo(() => {
    if (!currentUser) return true;
    const r = currentUser.role;
    return r === 'admin' || r === 'kaufmaennisch' || r === 'projektleiter' || r === 'bauleiter';
  }, [currentUser]);

  // Unique groups from data
  const groups = useMemo(() => {
    const set = new Set<string>();
    positions.forEach(p => {
      const g = p.tradeCategory || p.group;
      if (g) set.add(g);
    });
    return Array.from(set);
  }, [positions]);

  // Source Counts (Alle, Nur Original, Nicht im LV)
  const sourceCounts = useMemo(() => {
    let original = 0;
    let custom = 0;
    positions.forEach(p => {
      if (p.sourceType === 'CUSTOM_ADDED') custom++;
      else original++;
    });
    return { all: positions.length, original, custom };
  }, [positions]);

  // Filtered positions
  const filteredPositions = useMemo(() => {
    return positions.filter(p => {
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

      return true;
    });
  }, [positions, searchTerm, sourceFilter, selectedGroup, selectedStatus, onlyInstalled, getPositionMetrics]);

  // Grouped by Trade
  const groupedPositions = useMemo(() => {
    const map: { [trade: string]: Position[] } = {};
    filteredPositions.forEach(p => {
      const g = p.tradeCategory || p.group || 'Allgemeine Positionen';
      if (!map[g]) map[g] = [];
      map[g].push(p);
    });
    Object.keys(map).forEach(g => {
      map[g].sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0));
    });
    return map;
  }, [filteredPositions]);

  // Totals & KPI Metrics
  const exactItems = useMemo(() => positions.filter(p => {
    const m = getPositionMetrics(p);
    return m.isCompleted && m.delta === 0 && m.installed > 0;
  }).length, [positions, getPositionMetrics]);

  const overItems = useMemo(() => positions.filter(p => getPositionMetrics(p).deviationType === 'over').length, [positions, getPositionMetrics]);
  const underItems = useMemo(() => positions.filter(p => getPositionMetrics(p).deviationType === 'under').length, [positions, getPositionMetrics]);
  const totalValue = useMemo(() => {
    return positions.reduce((acc, p) => acc + (getPositionMetrics(p).installed * (p.unitPriceVK ?? p.unitPrice ?? 0)), 0);
  }, [positions, getPositionMetrics]);

  const handleUpdateFields = async (positionId: string, updates: Partial<Position>) => {
    if (!projectId) return;
    await updatePositionFields(projectId, positionId, positions, updates);
  };

  return (
    <div className="space-y-5">
      {/* KPI Stat Cards */}
      <MaterialStatsCards
        totalItems={positions.length}
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
        totalPositionsCount={positions.length}
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
        canEditCommercial={canEditCommercial}
      />

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
                {isEditMode && <th className="py-3 px-3 w-36 text-right">Aktionen</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-xs">
              {filteredPositions.length === 0 ? (
                <tr>
                  <td colSpan={isEditMode ? 11 : 10} className="py-12 text-center text-slate-400">
                    Keine Positionen für diesen Filter gefunden.
                  </td>
                </tr>
              ) : (
                Object.entries(groupedPositions).map(([grp, items]) => {
                  const isCollapsed = collapsedGroups[grp];
                  return (
                    <React.Fragment key={grp}>
                      <tr className="bg-slate-100/90 border-t border-b border-slate-200 font-bold text-slate-700 text-xs">
                        <td colSpan={isEditMode ? 11 : 10} className="py-2 px-3">
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
                          onEditOriginal={(p) => setEditOriginalPos(p)}
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
          if (projectId) {
            await savePositionsBatch(projectId, imported);
            setIsExcelModalOpen(false);
          }
        }}
        isExportOpen={isExportModalOpen}
        onCloseExport={() => setIsExportModalOpen(false)}
      />
    </div>
  );
};
