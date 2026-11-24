import React, { useState, useMemo } from 'react';
import type { Position, User, Project, MeasurementSection } from '../../types';
import { 
  Plus, 
  FileSpreadsheet, 
  Search, 
  ChevronDown, 
  ChevronRight,
  Download
} from 'lucide-react';
import { LvPositionRow } from './LvPositionRow';
import { LvPositionModal } from './LvPositionModal';
import { LvOriginalEditModal } from './LvOriginalEditModal';
import { LvAliasModal } from './LvAliasModal';
import { LvExcelImportModal } from './LvExcelImportModal';
import { CommercialDeltaBar } from './CommercialDeltaBar';
import { BillingExportModal } from '../export/BillingExportModal';
import { addCustomPosition, updatePositionFields, togglePositionCancelled } from '../../services/lvPositionService';
import { savePositionsBatch } from '../../services/firestoreService';

interface LvEditorTableProps {
  projectId: string;
  positions: Position[];
  currentUser: User | null;
  project?: Project | null;
  sections?: MeasurementSection[];
  searchTerm?: string;
}

export const LvEditorTable: React.FC<LvEditorTableProps> = ({
  projectId,
  positions,
  currentUser,
  project = null,
  sections = [],
  searchTerm: externalSearch = ''
}) => {
  const [internalSearch, setInternalSearch] = useState('');
  const [filterChip, setFilterChip] = useState<'all' | 'original' | 'custom' | 'deviations'>('all');
  const [orderStatusFilter, setOrderStatusFilter] = useState<'all' | 'OPEN' | 'ORDERED' | 'DELIVERED'>('all');
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

  const canEditCommercial = useMemo(() => {
    if (!currentUser) return true;
    const r = currentUser.role;
    return r === 'admin' || r === 'kaufmaennisch' || r === 'projektleiter' || r === 'bauleiter';
  }, [currentUser]);

  const activeSearch = (externalSearch || internalSearch).trim().toLowerCase();

  // Filtered & Grouped
  const filteredPositions = useMemo(() => {
    return positions.filter(pos => {
      if (filterChip === 'original' && pos.sourceType === 'CUSTOM_ADDED') return false;
      if (filterChip === 'custom' && pos.sourceType !== 'CUSTOM_ADDED') return false;
      if (filterChip === 'deviations' && (pos.installedQty || 0) <= (pos.qty || 0)) return false;
      if (orderStatusFilter !== 'all' && (pos.orderStatus || 'OPEN') !== orderStatusFilter) return false;

      if (activeSearch) {
        const code = (pos.displayCode || pos.posNr).toLowerCase();
        const title = (pos.officialTitle || pos.shortText || '').toLowerCase();
        const alias = (pos.aliasTitle || '').toLowerCase();
        const group = (pos.tradeCategory || pos.group || '').toLowerCase();
        return code.includes(activeSearch) || title.includes(activeSearch) || alias.includes(activeSearch) || group.includes(activeSearch);
      }
      return true;
    });
  }, [positions, filterChip, orderStatusFilter, activeSearch]);

  const grouped = useMemo(() => {
    const groups: { [trade: string]: Position[] } = {};
    filteredPositions.forEach(p => {
      const g = p.tradeCategory || p.group || 'Allgemeine Positionen';
      if (!groups[g]) groups[g] = [];
      groups[g].push(p);
    });
    Object.keys(groups).forEach(g => {
      groups[g].sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0));
    });
    return groups;
  }, [filteredPositions]);

  const handleSaveNew = async (data: any, insertAfter?: Position) => {
    await addCustomPosition(projectId, positions, data, insertAfter);
  };

  const handleUpdateFields = async (positionId: string, updates: Partial<Position>) => {
    await updatePositionFields(projectId, positionId, positions, updates);
  };

  const handleExcelImport = async (newPositions: Partial<Position>[]) => {
    await savePositionsBatch(projectId, newPositions);
  };

  return (
    <div className="space-y-4">
      {/* 1. Kaufmännische Delta-Bilanz */}
      <CommercialDeltaBar positions={positions} canViewCommercial={canEditCommercial} />

      {/* 2. Top Action & Filter Bar */}
      <div className="bg-white p-3.5 rounded-2xl border border-slate-200 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative w-56">
            <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
            <input
              type="text"
              placeholder="Positionen filtern..."
              value={internalSearch}
              onChange={(e) => setInternalSearch(e.target.value)}
              className="w-full pl-9 pr-3 py-1.5 border border-slate-200 rounded-xl text-xs focus:outline-none focus:border-[#3B82C4]"
            />
          </div>

          {/* Type Chips */}
          <div className="flex items-center space-x-1 border border-slate-200 p-0.5 rounded-xl bg-slate-50 text-[11px] font-semibold">
            {(['all', 'original', 'custom', 'deviations'] as const).map(chip => (
              <button
                key={chip}
                type="button"
                onClick={() => setFilterChip(chip)}
                className={`px-2.5 py-1 rounded-lg transition-all ${filterChip === chip ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-800'}`}
              >
                {chip === 'all' ? `Alle (${positions.length})` : chip === 'original' ? 'Original-LV' : chip === 'custom' ? 'Ergänzt' : 'Mehrung'}
              </button>
            ))}
          </div>

          {/* Order Status Filter for Kaufleute */}
          {canEditCommercial && (
            <select
              value={orderStatusFilter}
              onChange={(e) => setOrderStatusFilter(e.target.value as any)}
              className="text-[11px] font-bold px-2 py-1 rounded-xl border border-slate-200 bg-slate-50 text-slate-700 focus:outline-none"
            >
              <option value="all">Alle Bestell-Status</option>
              <option value="OPEN">Offen (zu bestellen)</option>
              <option value="ORDERED">Bestellt</option>
              <option value="DELIVERED">Geliefert</option>
            </select>
          )}
        </div>

        {/* Action Buttons */}
        <div className="flex items-center space-x-2 shrink-0">
          <button
            type="button"
            onClick={() => setIsExportModalOpen(true)}
            className="px-3.5 py-1.5 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold shadow-sm flex items-center space-x-1.5 transition-colors"
          >
            <Download className="w-3.5 h-3.5 text-blue-400" />
            <span>Aufmaß-Export (Excel/PDF)</span>
          </button>
          <button
            type="button"
            onClick={() => setIsExcelModalOpen(true)}
            className="px-3 py-1.5 border border-slate-300 hover:bg-slate-50 text-slate-700 rounded-xl text-xs font-bold flex items-center space-x-1.5 transition-colors"
          >
            <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600" />
            <span>Excel-Abgleich</span>
          </button>
          <button
            type="button"
            onClick={() => {
              setInsertAfterTarget(undefined);
              setDefaultTradeTarget(undefined);
              setIsAddModalOpen(true);
            }}
            className="px-3.5 py-1.5 bg-[#3B82C4] hover:bg-[#2B6EB0] text-white rounded-xl text-xs font-bold shadow-md shadow-blue-500/20 flex items-center space-x-1.5 transition-all"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Position</span>
          </button>
        </div>
      </div>

      {/* 3. Grouped Table View */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        {Object.keys(grouped).length === 0 ? (
          <div className="p-12 text-center text-slate-500 text-xs">Keine Positionen entsprechen den Filterkriterien.</div>
        ) : (
          <div className="divide-y divide-slate-200">
            {Object.entries(grouped).map(([trade, items]) => {
              const isCollapsed = Boolean(collapsedGroups[trade]);
              return (
                <div key={trade} className="overflow-x-auto">
                  <div className="bg-slate-50 px-4 py-2 flex items-center justify-between border-b border-slate-200 select-none">
                    <button
                      type="button"
                      onClick={() => setCollapsedGroups(p => ({ ...p, [trade]: !p[trade] }))}
                      className="flex items-center space-x-2 text-xs font-black text-slate-800 hover:text-[#3B82C4]"
                    >
                      {isCollapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                      <span className="uppercase">{trade}</span>
                      <span className="text-slate-400 font-normal">({items.length})</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => { setInsertAfterTarget(undefined); setDefaultTradeTarget(trade); setIsAddModalOpen(true); }}
                      className="text-[11px] font-bold text-emerald-700 hover:bg-emerald-50 px-2 py-0.5 rounded-lg flex items-center space-x-1"
                    >
                      <Plus className="w-3 h-3" />
                      <span>In {trade} hinzufügen</span>
                    </button>
                  </div>

                  {!isCollapsed && (
                    <table className="w-full text-left">
                      <thead className="bg-slate-100/50 text-slate-500 text-[10px] uppercase font-bold border-b border-slate-200">
                        <tr>
                          <th className="py-2 px-3 w-28">Pos-Nr & Typ</th>
                          <th className="py-2 px-3">Bezeichnung & Monteurhinweis</th>
                          <th className="py-2 px-3 w-24 text-right">Menge</th>
                          <th className="py-2 px-3 w-28 text-right">VK-Preis</th>
                          <th className="py-2 px-3 w-28">Bestellstatus</th>
                          <th className="py-2 px-3 w-36 text-right">Aktionen</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {items.map(pos => (
                          <LvPositionRow
                            key={pos.id}
                            position={pos}
                            canEditCommercial={canEditCommercial}
                            onOpenAlias={(p) => { setAliasModalPos(p); setAliasModalMode('alias'); }}
                            onOpenInfo={(p) => { setAliasModalPos(p); setAliasModalMode('info'); }}
                            onInsertBelow={(p) => { setInsertAfterTarget(p); setDefaultTradeTarget(p.tradeCategory || p.group); setIsAddModalOpen(true); }}
                            onToggleCancel={(p) => togglePositionCancelled(projectId, p.id, positions)}
                            onUpdateStatus={(id, status) => handleUpdateFields(id, { orderStatus: status })}
                            onUpdatePrice={(id, price) => handleUpdateFields(id, { unitPriceVK: price, unitPrice: price })}
                          />
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Modals */}
      <LvPositionModal
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        onSave={handleSaveNew}
        existingPositions={positions}
        insertAfterPosition={insertAfterTarget}
        defaultTradeCategory={defaultTradeTarget}
      />
      <LvAliasModal
        isOpen={Boolean(aliasModalPos)}
        position={aliasModalPos}
        mode={aliasModalMode}
        onClose={() => setAliasModalPos(null)}
        onSave={handleUpdateFields}
      />
      <LvOriginalEditModal
        isOpen={Boolean(editOriginalPos)}
        position={editOriginalPos}
        onClose={() => setEditOriginalPos(null)}
        onSave={handleUpdateFields}
      />
      <LvExcelImportModal
        isOpen={isExcelModalOpen}
        onClose={() => setIsExcelModalOpen(false)}
        onImport={handleExcelImport}
        existingPositions={positions}
      />
      {project && (
        <BillingExportModal
          isOpen={isExportModalOpen}
          onClose={() => setIsExportModalOpen(false)}
          project={project}
          positions={positions}
          sections={sections}
          currentUser={currentUser}
        />
      )}
    </div>
  );
};
