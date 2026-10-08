import React, { useState, useMemo } from 'react';
import type { Position, Room, User } from '../types';
import { 
  Scale, 
  Search, 
  TrendingUp, 
  TrendingDown, 
  CheckCircle, 
  AlertTriangle, 
  FileSpreadsheet, 
  ChevronDown, 
  ChevronRight,
  PlusCircle,
  FileCheck,
  Layers,
  ArrowRight
} from 'lucide-react';
import * as XLSX from 'xlsx';
import { createAddendum } from '../services/firestoreService';

interface GaebVsDwgViewProps {
  projectId: string;
  projectName?: string;
  positions: Position[];
  rooms: Room[];
  currentUser?: User | null;
  onNavigateToAddendums?: () => void;
}

interface ComparisonRow {
  pos: Position;
  posNr: string;
  shortText: string;
  group: string;
  qu: string;
  unitPrice: number;
  gaebQty: number;
  dwgQty: number;
  delta: number;
  deltaPercent: number;
  deltaValue: number;
  status: 'over' | 'under' | 'exact' | 'unplanned';
  roomBreakdown: Array<{
    roomId: string;
    roomName: string;
    roomCode?: string;
    floor?: string;
    qty: number;
  }>;
}

export const GaebVsDwgView: React.FC<GaebVsDwgViewProps> = ({
  projectId,
  projectName = 'Projekt',
  positions,
  rooms,
  currentUser,
  onNavigateToAddendums
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedGroup, setSelectedGroup] = useState<string>('all');
  const [selectedStatus, setSelectedStatus] = useState<string>('all');
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());
  const [createdAddendums, setCreatedAddendums] = useState<Set<string>>(new Set());
  const [isCreatingAddendum, setIsCreatingAddendum] = useState<string | null>(null);

  // Toggle room details row
  const toggleRow = (id: string) => {
    setExpandedRows(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  // 1. Calculate comparisons
  const comparisonData: ComparisonRow[] = useMemo(() => {
    return positions.map(pos => {
      const gaebQty = Number(pos.qty) || 0;
      let dwgQty = 0;
      const roomBreakdown: ComparisonRow['roomBreakdown'] = [];

      rooms.forEach(r => {
        (r.materials || []).forEach(m => {
          const isMatch = 
            (m.positionId && m.positionId === pos.id) ||
            (m.posNr && m.posNr === pos.posNr) ||
            (m.shortText && pos.shortText && m.shortText.trim().toLowerCase() === pos.shortText.trim().toLowerCase());

          if (isMatch) {
            const pl = Number(m.plannedQty) || 0;
            dwgQty += pl;
            roomBreakdown.push({
              roomId: r.id,
              roomName: r.name,
              roomCode: r.code,
              floor: r.floor,
              qty: pl
            });
          }
        });
      });

      const delta = dwgQty - gaebQty;
      const deltaPercent = gaebQty > 0 
        ? Math.round((delta / gaebQty) * 100) 
        : (dwgQty > 0 ? 100 : 0);

      const deltaValue = delta * (pos.unitPrice || 0);

      let status: ComparisonRow['status'] = 'exact';
      if (dwgQty === 0) {
        status = 'unplanned';
      } else if (delta > 0) {
        status = 'over';
      } else if (delta < 0) {
        status = 'under';
      } else {
        status = 'exact';
      }

      return {
        pos,
        posNr: pos.posNr,
        shortText: pos.shortText,
        group: pos.group || 'Allgemein',
        qu: pos.qu || 'Stk',
        unitPrice: pos.unitPrice || 0,
        gaebQty,
        dwgQty,
        delta,
        deltaPercent,
        deltaValue,
        status,
        roomBreakdown
      };
    });
  }, [positions, rooms]);

  // Unique groups for filtering
  const groups = useMemo(() => {
    const set = new Set<string>();
    comparisonData.forEach(row => row.group && set.add(row.group));
    return Array.from(set).sort();
  }, [comparisonData]);

  // Overall KPIs
  const kpis = useMemo(() => {
    let overCount = 0;
    let overValue = 0;
    let overQty = 0;

    let underCount = 0;
    let underValue = 0;
    let underQty = 0;

    let exactCount = 0;
    let unplannedCount = 0;

    comparisonData.forEach(row => {
      if (row.status === 'over') {
        overCount++;
        overValue += row.deltaValue;
        overQty += row.delta;
      } else if (row.status === 'under') {
        underCount++;
        underValue += Math.abs(row.deltaValue);
        underQty += Math.abs(row.delta);
      } else if (row.status === 'exact') {
        exactCount++;
      } else if (row.status === 'unplanned') {
        unplannedCount++;
      }
    });

    const totalDeviations = overCount + underCount;

    return {
      totalPositions: comparisonData.length,
      overCount,
      overValue,
      overQty,
      underCount,
      underValue,
      underQty,
      exactCount,
      unplannedCount,
      totalDeviations
    };
  }, [comparisonData]);

  // Filtered rows
  const filteredRows = useMemo(() => {
    return comparisonData.filter(row => {
      // Search filter
      const matchesSearch = 
        !searchTerm ||
        row.posNr.toLowerCase().includes(searchTerm.toLowerCase()) ||
        row.shortText.toLowerCase().includes(searchTerm.toLowerCase()) ||
        row.group.toLowerCase().includes(searchTerm.toLowerCase());

      if (!matchesSearch) return false;

      // Group filter
      if (selectedGroup !== 'all' && row.group !== selectedGroup) return false;

      // Status filter
      if (selectedStatus === 'deviations') {
        return row.status === 'over' || row.status === 'under';
      }
      if (selectedStatus !== 'all' && row.status !== selectedStatus) {
        return false;
      }

      return true;
    });
  }, [comparisonData, searchTerm, selectedGroup, selectedStatus]);

  // Export to Excel
  const handleExportExcel = () => {
    const rows = filteredRows.map(r => ({
      'Pos-Nr': r.posNr,
      'Gewerk / Gruppe': r.group,
      'Kurztext': r.shortText,
      'GAEB Soll (Ausschreibung)': r.gaebQty,
      'DWG Verplant (Montage)': r.dwgQty,
      'Einheit': r.qu,
      'Differenz (Menge)': r.delta,
      'Abweichung (%)': `${r.deltaPercent > 0 ? '+' : ''}${r.deltaPercent}%`,
      'Einzelpreis (€)': r.unitPrice,
      'Finanzielles Delta (€)': Number(r.deltaValue.toFixed(2)),
      'Status': 
        r.status === 'over' ? 'Mehrplanung (Nachtragspotenzial VOB)' :
        r.status === 'under' ? 'Minderplanung' :
        r.status === 'exact' ? 'Punktgenau' : 'Nicht in CAD verplant',
      'Verplante Räume': r.roomBreakdown.map(b => `${b.roomName} (${b.qty} ${r.qu})`).join('; ')
    }));

    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'GAEB vs DWG');
    XLSX.writeFile(wb, `${projectName}_GAEB_vs_DWG_Vergleich.xlsx`);
  };

  // Create Addendum from Overplanning
  const handleCreateAddendumFromRow = async (row: ComparisonRow) => {
    if (isCreatingAddendum || createdAddendums.has(row.pos.id)) return;
    setIsCreatingAddendum(row.pos.id);

    try {
      const addendumTitle = `Mengenmehrung: ${row.shortText} (+${row.delta} ${row.qu})`;
      const roomsText = row.roomBreakdown.map(r => `${r.roomName} (${r.qty} ${row.qu})`).join(', ');
      
      await createAddendum(projectId, {
        title: addendumTitle,
        itemOz: row.posNr,
        materialId: row.pos.id,
        quantity: row.delta,
        qu: row.qu,
        description: `Ausführungsplanung (DWG) erfordert ${row.dwgQty} ${row.qu}, während das Ausschreibungs-LV (GAEB) nur ${row.gaebQty} ${row.qu} vorsah. Aufteilung in Räumen: ${roomsText}.`,
        note: `VOB/B § 2 Mengenmehrung (+${row.deltaPercent}%)`,
        status: 'pending',
        requestedBy: currentUser?.name || 'Bauleiter'
      });

      setCreatedAddendums(prev => new Set(prev).add(row.pos.id));
    } catch (err: any) {
      console.error('Fehler beim Erstellen des Nachtrags:', err);
      alert('Fehler beim Erstellen des Nachtrags: ' + err.message);
    } finally {
      setIsCreatingAddendum(null);
    }
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      {/* 1. Header Banner */}
      <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center space-x-3">
            <div className="p-2.5 bg-blue-50 text-[#3B82C4] rounded-xl border border-blue-100">
              <Scale className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
                GAEB vs. DWG – Soll-Vergleich
                <span className="text-xs px-2.5 py-0.5 rounded-full font-semibold bg-blue-100 text-[#3B82C4]">
                  Ausschreibung vs. Montageplanung
                </span>
              </h1>
              <p className="text-xs text-slate-500 mt-0.5">
                Vergleicht die ausgeschriebenen LV-Mengen (GAEB) mit den tatsächlich in den Räumen verplanten Massen (DWG/CAD).
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-2.5">
            {onNavigateToAddendums && createdAddendums.size > 0 && (
              <button
                onClick={onNavigateToAddendums}
                className="inline-flex items-center space-x-1.5 px-3 py-2 bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-200 rounded-lg text-xs font-semibold transition-colors cursor-pointer shadow-xs"
              >
                <span>Zu Nachträgen ({createdAddendums.size})</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            )}
            <button
              onClick={handleExportExcel}
              className="inline-flex items-center space-x-1.5 px-3 py-2 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 rounded-lg text-xs font-semibold transition-colors cursor-pointer shadow-xs"
            >
              <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
              <span>Excel-Export</span>
            </button>
          </div>
        </div>
      </div>

      {/* 2. KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: Mehrplanung */}
        <div 
          onClick={() => setSelectedStatus(selectedStatus === 'over' ? 'all' : 'over')}
          className={`p-4 rounded-xl border cursor-pointer transition-all ${
            selectedStatus === 'over' 
              ? 'bg-rose-50/80 border-rose-300 ring-2 ring-rose-400/40 shadow-sm' 
              : 'bg-white border-slate-200 hover:border-rose-200 hover:shadow-xs'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
              Mehrplanung in DWG
            </span>
            <div className="p-1.5 bg-rose-100 text-rose-700 rounded-lg">
              <TrendingUp className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2 flex items-baseline space-x-2">
            <span className="text-2xl font-black text-rose-700">
              {kpis.overCount}
            </span>
            <span className="text-xs font-semibold text-rose-600">
              Positionen (+{kpis.overQty} Stk)
            </span>
          </div>
          <div className="mt-2 pt-2 border-t border-slate-100 flex items-center justify-between text-[11px]">
            <span className="text-slate-500">Nachtragspotenzial:</span>
            <span className="font-bold text-slate-900">
              {kpis.overValue.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €
            </span>
          </div>
        </div>

        {/* Card 2: Minderplanung */}
        <div 
          onClick={() => setSelectedStatus(selectedStatus === 'under' ? 'all' : 'under')}
          className={`p-4 rounded-xl border cursor-pointer transition-all ${
            selectedStatus === 'under' 
              ? 'bg-emerald-50/80 border-emerald-300 ring-2 ring-emerald-400/40 shadow-sm' 
              : 'bg-white border-slate-200 hover:border-emerald-200 hover:shadow-xs'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
              Minderplanung in DWG
            </span>
            <div className="p-1.5 bg-emerald-100 text-emerald-800 rounded-lg">
              <TrendingDown className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2 flex items-baseline space-x-2">
            <span className="text-2xl font-black text-emerald-700">
              {kpis.underCount}
            </span>
            <span className="text-xs font-semibold text-emerald-600">
              Positionen (-{kpis.underQty} Stk)
            </span>
          </div>
          <div className="mt-2 pt-2 border-t border-slate-100 flex items-center justify-between text-[11px]">
            <span className="text-slate-500">Ungenutztes LV-Volumen:</span>
            <span className="font-bold text-slate-900">
              {kpis.underValue.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €
            </span>
          </div>
        </div>

        {/* Card 3: Punktgenau */}
        <div 
          onClick={() => setSelectedStatus(selectedStatus === 'exact' ? 'all' : 'exact')}
          className={`p-4 rounded-xl border cursor-pointer transition-all ${
            selectedStatus === 'exact' 
              ? 'bg-blue-50/80 border-blue-300 ring-2 ring-blue-400/40 shadow-sm' 
              : 'bg-white border-slate-200 hover:border-blue-200 hover:shadow-xs'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
              Punktgenau geplant
            </span>
            <div className="p-1.5 bg-blue-100 text-[#3B82C4] rounded-lg">
              <CheckCircle className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2 flex items-baseline space-x-2">
            <span className="text-2xl font-black text-slate-800">
              {kpis.exactCount}
            </span>
            <span className="text-xs font-semibold text-slate-500">
              von {kpis.totalPositions} Positionen
            </span>
          </div>
          <div className="mt-2 pt-2 border-t border-slate-100 flex items-center justify-between text-[11px]">
            <span className="text-slate-500">Planungsstatus:</span>
            <span className="font-bold text-emerald-700">100% deckungsgleich</span>
          </div>
        </div>

        {/* Card 4: Nicht in DWG verplant */}
        <div 
          onClick={() => setSelectedStatus(selectedStatus === 'unplanned' ? 'all' : 'unplanned')}
          className={`p-4 rounded-xl border cursor-pointer transition-all ${
            selectedStatus === 'unplanned' 
              ? 'bg-amber-50/80 border-amber-300 ring-2 ring-amber-400/40 shadow-sm' 
              : 'bg-white border-slate-200 hover:border-amber-200 hover:shadow-xs'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
              Nicht in DWG verplant
            </span>
            <div className="p-1.5 bg-amber-100 text-amber-700 rounded-lg">
              <AlertTriangle className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2 flex items-baseline space-x-2">
            <span className="text-2xl font-black text-amber-700">
              {kpis.unplannedCount}
            </span>
            <span className="text-xs font-semibold text-amber-600">
              ohne Raumzuordnung
            </span>
          </div>
          <div className="mt-2 pt-2 border-t border-slate-100 flex items-center justify-between text-[11px]">
            <span className="text-slate-500">Verplanung:</span>
            <span className="font-bold text-amber-700">0 Stk in Räumen</span>
          </div>
        </div>
      </div>

      {/* 3. Filter & Search Bar */}
      <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-xs space-y-3">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          {/* Search */}
          <div className="relative flex-1 max-w-md">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Pos-Nr, Kurztext oder Gewerk suchen..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-[#3B82C4]"
            />
          </div>

          {/* Group and Status dropdowns */}
          <div className="flex flex-wrap items-center gap-2">
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

            <select
              value={selectedStatus}
              onChange={(e) => setSelectedStatus(e.target.value)}
              className="px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-semibold text-slate-700 focus:outline-none focus:ring-2 focus:ring-[#3B82C4]"
            >
              <option value="all">Alle Positionen ({comparisonData.length})</option>
              <option value="deviations">Nur Abweichungen ({kpis.totalDeviations})</option>
              <option value="over">Nur Mehrplanung ({kpis.overCount})</option>
              <option value="under">Nur Minderplanung ({kpis.underCount})</option>
              <option value="exact">Nur Punktgenau ({kpis.exactCount})</option>
              <option value="unplanned">Nicht in DWG verplant ({kpis.unplannedCount})</option>
            </select>
          </div>
        </div>

        <div className="flex items-center justify-between text-xs text-slate-500 font-medium pt-1 border-t border-slate-100">
          <span>
            Zeige <strong className="text-slate-800">{filteredRows.length}</strong> von <strong className="text-slate-800">{comparisonData.length}</strong> Positionen
          </span>
          {kpis.overValue > 0 && (
            <span className="text-slate-600">
              Gesamtes Nachtragspotenzial: <strong className="text-rose-700 font-bold">{kpis.overValue.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €</strong>
            </span>
          )}
        </div>
      </div>

      {/* 4. Comparison Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 text-slate-500 text-[11px] font-semibold uppercase border-b border-slate-200">
                <th className="py-3 px-3 w-10 text-center"></th>
                <th className="py-3 px-4 w-20">Pos-Nr</th>
                <th className="py-3 px-4">Gewerk / Beschreibung</th>
                <th className="py-3 px-4 w-28 text-right bg-slate-100/50">GAEB (LV-Soll)</th>
                <th className="py-3 px-4 w-28 text-right bg-blue-50/50">DWG (Verplant)</th>
                <th className="py-3 px-4 w-32 text-center">Plan-Differenz</th>
                <th className="py-3 px-4 w-24 text-right">Einzelpreis</th>
                <th className="py-3 px-4 w-28 text-right">Delta (€)</th>
                <th className="py-3 px-4 w-36 text-center">Status / VOB</th>
                <th className="py-3 px-4 w-36 text-right">Aktion</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-xs">
              {filteredRows.length === 0 ? (
                <tr>
                  <td colSpan={10} className="py-10 text-center text-slate-400">
                    Keine Positionen für diesen Filter gefunden.
                  </td>
                </tr>
              ) : (
                filteredRows.map((row) => {
                  const isExpanded = expandedRows.has(row.pos.id);
                  const isAddendumCreated = createdAddendums.has(row.pos.id);

                  return (
                    <React.Fragment key={row.pos.id}>
                      <tr className="hover:bg-slate-50/80 transition-colors">
                        {/* Toggle room details button */}
                        <td className="py-3 px-3 text-center">
                          {row.roomBreakdown.length > 0 ? (
                            <button
                              onClick={() => toggleRow(row.pos.id)}
                              className="p-1 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded cursor-pointer"
                              title="Raum-Aufteilung anzeigen"
                            >
                              {isExpanded ? (
                                <ChevronDown className="w-4 h-4 text-[#3B82C4]" />
                              ) : (
                                <ChevronRight className="w-4 h-4" />
                              )}
                            </button>
                          ) : (
                            <span className="text-slate-300 text-xs">–</span>
                          )}
                        </td>

                        {/* Pos-Nr */}
                        <td className="py-3 px-4 font-mono font-bold text-[#3B82C4]">
                          {row.posNr}
                        </td>

                        {/* Description */}
                        <td className="py-3 px-4">
                          <div className="font-semibold text-slate-800 line-clamp-1">
                            {row.shortText}
                          </div>
                          <div className="text-[11px] text-slate-400 flex items-center space-x-2 mt-0.5">
                            <span>{row.group}</span>
                            {row.roomBreakdown.length > 0 && (
                              <span className="text-[10px] bg-slate-100 text-slate-600 px-1.5 py-0.2 rounded font-medium">
                                In {row.roomBreakdown.length} Räumen
                              </span>
                            )}
                          </div>
                        </td>

                        {/* GAEB Quantity */}
                        <td className="py-3 px-4 text-right font-medium text-slate-700 bg-slate-50/50">
                          {row.gaebQty} {row.qu}
                        </td>

                        {/* DWG Quantity */}
                        <td className="py-3 px-4 text-right font-bold text-slate-900 bg-blue-50/30">
                          {row.dwgQty} {row.qu}
                        </td>

                        {/* Plan-Differenz */}
                        <td className="py-3 px-4 text-center">
                          {row.delta > 0 ? (
                            <span className="inline-flex items-center space-x-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-rose-100 text-rose-700 border border-rose-200">
                              <TrendingUp className="w-3 h-3 shrink-0" />
                              <span>+{row.delta} {row.qu}</span>
                              <span className="text-[10px] font-semibold text-rose-500">
                                (+{row.deltaPercent}%)
                              </span>
                            </span>
                          ) : row.delta < 0 ? (
                            <span className="inline-flex items-center space-x-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
                              <TrendingDown className="w-3 h-3 shrink-0" />
                              <span>{row.delta} {row.qu}</span>
                              <span className="text-[10px] font-semibold text-emerald-600">
                                ({row.deltaPercent}%)
                              </span>
                            </span>
                          ) : row.dwgQty === 0 ? (
                            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium bg-amber-50 text-amber-700 border border-amber-200">
                              Nicht verplant
                            </span>
                          ) : (
                            <span className="inline-flex items-center space-x-1 px-2 py-0.5 rounded-full text-[11px] font-medium bg-slate-100 text-slate-600 border border-slate-200">
                              <CheckCircle className="w-3 h-3 text-[#2FA36B]" />
                              <span>Deckungsgleich</span>
                            </span>
                          )}
                        </td>

                        {/* Einzelpreis */}
                        <td className="py-3 px-4 text-right text-slate-600 font-mono">
                          {row.unitPrice ? `${row.unitPrice.toFixed(2)} €` : '–'}
                        </td>

                        {/* Finanzielles Delta */}
                        <td className="py-3 px-4 text-right font-mono font-bold">
                          {row.deltaValue > 0 ? (
                            <span className="text-rose-700">
                              +{row.deltaValue.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €
                            </span>
                          ) : row.deltaValue < 0 ? (
                            <span className="text-emerald-700">
                              {row.deltaValue.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €
                            </span>
                          ) : (
                            <span className="text-slate-400">–</span>
                          )}
                        </td>

                        {/* Status / VOB Hinweis */}
                        <td className="py-3 px-4 text-center">
                          {row.delta > 0 ? (
                            <span className="inline-flex items-center space-x-1 px-2 py-0.5 rounded-md text-[10px] font-bold bg-amber-100 text-amber-800 border border-amber-300">
                              <AlertTriangle className="w-3 h-3 text-amber-600" />
                              <span>Nachtrag VOB §2</span>
                            </span>
                          ) : row.delta < 0 ? (
                            <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-semibold bg-slate-100 text-slate-600 border border-slate-200">
                              Minderbedarf
                            </span>
                          ) : row.dwgQty === 0 ? (
                            <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-medium bg-slate-50 text-slate-400">
                              Unbelegt
                            </span>
                          ) : (
                            <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                              Planungskonform
                            </span>
                          )}
                        </td>

                        {/* Aktion: Nachtrag anlegen */}
                        <td className="py-3 px-4 text-right">
                          {row.delta > 0 ? (
                            isAddendumCreated ? (
                              <div className="flex items-center justify-end space-x-1.5">
                                <span className="inline-flex items-center space-x-1 text-[11px] font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                                  <FileCheck className="w-3 h-3" />
                                  <span>Vorgemerkt</span>
                                </span>
                                {onNavigateToAddendums && (
                                  <button
                                    onClick={onNavigateToAddendums}
                                    className="p-1 text-amber-600 hover:text-amber-800 hover:bg-amber-50 rounded cursor-pointer"
                                    title="Zu Nachträgen wechseln"
                                  >
                                    <ArrowRight className="w-3.5 h-3.5" />
                                  </button>
                                )}
                              </div>
                            ) : (
                              <button
                                onClick={() => handleCreateAddendumFromRow(row)}
                                disabled={isCreatingAddendum === row.pos.id}
                                className="inline-flex items-center space-x-1 px-2.5 py-1 bg-amber-500 hover:bg-amber-600 text-white rounded-lg text-[11px] font-bold transition-colors cursor-pointer shadow-2xs disabled:opacity-50"
                                title="Mengenmehrung als Nachtragsentwurf anlegen"
                              >
                                <PlusCircle className="w-3.5 h-3.5" />
                                <span>{isCreatingAddendum === row.pos.id ? 'Erstelle...' : 'Nachtrag anlegen'}</span>
                              </button>
                            )
                          ) : (
                            <span className="text-slate-300 text-xs">–</span>
                          )}
                        </td>
                      </tr>

                      {/* Expanded Breakdown Row */}
                      {isExpanded && row.roomBreakdown.length > 0 && (
                        <tr className="bg-blue-50/30 border-y border-blue-100">
                          <td colSpan={10} className="py-3 px-6">
                            <div className="space-y-2">
                              <div className="flex items-center space-x-2 text-[11px] font-bold text-slate-700">
                                <Layers className="w-3.5 h-3.5 text-[#3B82C4]" />
                                <span>Detailaufteilung in den Räumen ({row.roomBreakdown.length} Räume mit insgesamt {row.dwgQty} {row.qu}):</span>
                              </div>
                              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-2">
                                {row.roomBreakdown.map((room, idx) => (
                                  <div 
                                    key={`${room.roomId}_${idx}`}
                                    className="p-2 bg-white rounded-lg border border-blue-200/60 shadow-2xs flex flex-col justify-between"
                                  >
                                    <div className="flex items-center justify-between">
                                      <span className="font-semibold text-slate-800 text-[11px] truncate" title={room.roomName}>
                                        {room.roomName}
                                      </span>
                                      {room.floor && (
                                        <span className="text-[9px] font-bold text-[#3B82C4] bg-blue-50 px-1 py-0.2 rounded border border-blue-100">
                                          {room.floor}
                                        </span>
                                      )}
                                    </div>
                                    <div className="mt-1 text-right">
                                      <span className="text-xs font-black text-slate-900">
                                        {room.qty} {row.qu}
                                      </span>
                                      <span className="text-[10px] text-slate-400 ml-1">geplant</span>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
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
