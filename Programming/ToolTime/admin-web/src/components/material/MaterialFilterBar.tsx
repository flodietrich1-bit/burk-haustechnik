import React from 'react';
import { Filter, Edit3, Check, Plus, FileSpreadsheet, Download, Trash2 } from 'lucide-react';

export type SourceFilterType = 'all' | 'original' | 'custom';

interface MaterialFilterBarProps {
  groups: string[];
  selectedGroup: string;
  setSelectedGroup: (group: string) => void;
  selectedStatus: string;
  setSelectedStatus: (status: string) => void;
  sourceFilter: SourceFilterType;
  setSourceFilter: (filter: SourceFilterType) => void;
  sourceCounts: { all: number; original: number; custom: number };
  onlyInstalled: boolean;
  setOnlyInstalled: (val: boolean) => void;
  totalFilteredCount: number;
  totalPositionsCount: number;
  totalValue: number;
  isEditMode: boolean;
  setIsEditMode: (val: boolean | ((prev: boolean) => boolean)) => void;
  onOpenAddModal: () => void;
  onOpenExcelModal: () => void;
  onOpenExportModal: () => void;
  onDeleteCustom?: () => void;
  canEditCommercial: boolean;
}

export const MaterialFilterBar: React.FC<MaterialFilterBarProps> = ({
  groups,
  selectedGroup,
  setSelectedGroup,
  selectedStatus,
  setSelectedStatus,
  sourceFilter,
  setSourceFilter,
  sourceCounts,
  onlyInstalled,
  setOnlyInstalled,
  totalFilteredCount,
  totalPositionsCount,
  totalValue,
  isEditMode,
  setIsEditMode,
  onOpenAddModal,
  onOpenExcelModal,
  onOpenExportModal,
  onDeleteCustom,
  canEditCommercial
}) => {
  return (
    <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm space-y-3">
      {/* Upper Row: Filter Controls & Edit Button */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        {/* Source Filter Chips */}
        <div className="flex flex-wrap items-center gap-1.5 p-1 bg-slate-100/80 rounded-xl border border-slate-200">
          <button
            type="button"
            onClick={() => setSourceFilter('all')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
              sourceFilter === 'all'
                ? 'bg-white text-slate-800 shadow-sm'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Alle Materialien ({sourceCounts.all})
          </button>
          <button
            type="button"
            onClick={() => setSourceFilter('original')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
              sourceFilter === 'original'
                ? 'bg-white text-slate-800 shadow-sm'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Nur Original-LV ({sourceCounts.original})
          </button>
          <button
            type="button"
            onClick={() => setSourceFilter('custom')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center space-x-1.5 ${
              sourceFilter === 'custom'
                ? 'bg-rose-50 text-rose-700 border border-rose-300 shadow-sm'
                : 'text-slate-600 hover:text-rose-700'
            }`}
          >
            <span className="w-2 h-2 rounded-full bg-rose-500 shrink-0" />
            <span>Nicht im LV / Ergänzt ({sourceCounts.custom})</span>
          </button>

          {sourceCounts.custom > 0 && canEditCommercial && onDeleteCustom && (
            <button
              type="button"
              onClick={onDeleteCustom}
              className="px-2.5 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 rounded-lg text-xs font-bold flex items-center space-x-1.5 transition-colors cursor-pointer"
              title="Alle nicht im LV enthaltenen Positionen löschen und auf Original-LV zurücksetzen"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Nicht-LV bereinigen ({sourceCounts.custom})</span>
            </button>
          )}
        </div>

        {/* Right: Edit Mode Button & Quick Actions */}
        <div className="flex flex-wrap items-center gap-2">
          {isEditMode && canEditCommercial && (
            <>
              <button
                type="button"
                onClick={onOpenExportModal}
                className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-bold flex items-center space-x-1.5 transition-colors border border-slate-300"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Export</span>
              </button>
              <button
                type="button"
                onClick={onOpenExcelModal}
                className="px-3 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 rounded-lg text-xs font-bold flex items-center space-x-1.5 transition-colors border border-emerald-300"
              >
                <FileSpreadsheet className="w-3.5 h-3.5" />
                <span>Excel-Abgleich</span>
              </button>
              <button
                type="button"
                onClick={onOpenAddModal}
                className="px-3 py-1.5 bg-[#3B82C4] hover:bg-[#2d6fa8] text-white rounded-lg text-xs font-bold flex items-center space-x-1.5 shadow-sm transition-colors"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Position</span>
              </button>
            </>
          )}

          <button
            type="button"
            onClick={() => setIsEditMode(prev => !prev)}
            className={`px-4 py-2 rounded-xl text-xs font-bold flex items-center space-x-2 transition-all ${
              isEditMode
                ? 'bg-amber-600 hover:bg-amber-700 text-white shadow-md ring-2 ring-amber-300'
                : 'bg-white hover:bg-slate-50 text-slate-700 border border-slate-300 shadow-sm'
            }`}
          >
            {isEditMode ? (
              <>
                <Check className="w-4 h-4" />
                <span>Editiermodus beenden</span>
              </>
            ) : (
              <>
                <Edit3 className="w-4 h-4 text-[#3B82C4]" />
                <span>Materialliste editieren</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Lower Row: Trade, Status, Radio & Summary Values */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 pt-2 border-t border-slate-100">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center space-x-1.5 text-xs font-semibold text-slate-600">
            <Filter className="w-3.5 h-3.5 text-[#3B82C4]" />
            <span>Gewerk:</span>
          </div>
          <select
            value={selectedGroup}
            onChange={(e) => setSelectedGroup(e.target.value)}
            className="px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-medium text-slate-700 focus:outline-none focus:ring-2 focus:ring-[#3B82C4]"
          >
            <option value="all">Alle Gewerke ({groups.length})</option>
            {groups.map(g => (
              <option key={g} value={g}>{g}</option>
            ))}
          </select>

          <div className="flex items-center space-x-1.5 text-xs font-semibold text-slate-600 ml-1">
            <span>Status:</span>
          </div>
          <select
            value={selectedStatus}
            onChange={(e) => setSelectedStatus(e.target.value)}
            className="px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-medium text-slate-700 focus:outline-none focus:ring-2 focus:ring-[#3B82C4]"
          >
            <option value="all">Alle Status</option>
            <option value="over">Nur Mehrverbrauch (+ Rot)</option>
            <option value="under">Nur Minderverbrauch (- Grün)</option>
            <option value="exact">Nur Punktgenau (Planmäßig)</option>
            <option value="partial">In Montage (Teilverbaut)</option>
            <option value="completed">Vollständig verbaut</option>
            <option value="open">Noch offen</option>
            <option value="cancelled">Nur Gestrichene (Entfallen)</option>
          </select>

          {/* Radio Button: Nur verbaute Teile */}
          <div className="flex items-center space-x-3 bg-slate-50 border border-slate-200 px-3 py-1.5 rounded-lg text-xs font-semibold text-slate-700 ml-1">
            <label className="flex items-center space-x-1.5 cursor-pointer hover:text-slate-900">
              <input
                type="radio"
                name="pos_installed_filter"
                value="all"
                checked={!onlyInstalled}
                onChange={() => setOnlyInstalled(false)}
                className="w-3.5 h-3.5 text-[#3B82C4] focus:ring-[#3B82C4] cursor-pointer"
              />
              <span>Alle Teile</span>
            </label>
            <label className="flex items-center space-x-1.5 cursor-pointer hover:text-slate-900">
              <input
                type="radio"
                name="pos_installed_filter"
                value="installed"
                checked={onlyInstalled}
                onChange={() => setOnlyInstalled(true)}
                className="w-3.5 h-3.5 text-[#3B82C4] focus:ring-[#3B82C4] cursor-pointer"
              />
              <span>Nur verbaute Teile</span>
            </label>
          </div>
        </div>

        <div className="flex items-center space-x-4 text-xs text-slate-500 font-medium">
          {totalValue > 0 && (
            <span className="hidden sm:inline text-slate-600">
              Verbauter Wert: <strong className="text-slate-900">{totalValue.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €</strong>
            </span>
          )}
          <span>
            Zeige <span className="font-bold text-slate-800">{totalFilteredCount}</span> von <span className="font-bold text-slate-800">{totalPositionsCount}</span> Positionen
          </span>
        </div>
      </div>
    </div>
  );
};
