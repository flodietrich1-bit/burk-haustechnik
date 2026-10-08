import React, { useState, useEffect, useMemo } from 'react';
import type { 
  Project, 
  Position, 
  Room, 
  Booking, 
  Alert, 
  Addendum, 
  User, 
  AufmassDocument 
} from '../types';
import { 
  FileSpreadsheet, 
  Plus, 
  Calendar, 
  Download, 
  ArrowLeft, 
  Clock, 
  MapPin, 
  Layers, 
  CheckCircle2, 
  AlertTriangle, 
  Trash2, 
  Info, 
  Eye, 
  Search,
  Check,
  UserCheck
} from 'lucide-react';
import { 
  listenToAufmasse, 
  saveAufmassDocument, 
  deleteAufmassDocument, 
  calculateAufmassSnapshot 
} from '../services/aufmassService';
import { exportAufmassToExcel, exportAufmassToPdf } from '../services/excelExporter';

interface AufmassViewProps {
  projectId: string;
  project: Project | null;
  positions?: Position[];
  rooms?: Room[];
  bookings?: Booking[];
  alerts?: Alert[];
  addendums?: Addendum[];
  currentUser?: User | null;
}

export const AufmassView: React.FC<AufmassViewProps> = ({
  projectId,
  project,
  positions = [],
  rooms = [],
  bookings = [],
  alerts = [],
  addendums = [],
  currentUser
}) => {
  const [aufmasse, setAufmasse] = useState<AufmassDocument[]>([]);
  const [selectedAufmass, setSelectedAufmass] = useState<AufmassDocument | null>(null);
  const [detailTab, setDetailTab] = useState<'summary' | 'rooms'>('summary');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedRoomFilter, setSelectedRoomFilter] = useState<string>('all');

  // Discard Confirmation Modal State
  const [discardTarget, setDiscardTarget] = useState<AufmassDocument | null>(null);
  const [isDiscarding, setIsDiscarding] = useState(false);

  // Create Modal State
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [dateTo, setDateTo] = useState<string>(() => new Date().toISOString().slice(0, 10));
  const [customDateFrom, setCustomDateFrom] = useState<string>('');
  const [creatorName, setCreatorName] = useState<string>(currentUser?.name || 'Florian Burk');
  const [notes, setNotes] = useState<string>('');
  const [isSaving, setIsSaving] = useState(false);

  // 1. Listen to Aufmasse from Firestore (neueste Stichtage zuerst)
  useEffect(() => {
    if (!projectId) return;
    const unsub = listenToAufmasse(projectId, (list) => {
      const sorted = [...list].sort((a, b) => 
        b.dateTo.localeCompare(a.dateTo) || b.createdAt.localeCompare(a.createdAt)
      );
      setAufmasse(sorted);
    });
    return () => unsub();
  }, [projectId]);

  // Keep selectedAufmass updated if changed in list
  useEffect(() => {
    if (selectedAufmass) {
      const fresh = aufmasse.find(a => a.id === selectedAufmass.id);
      if (fresh) {
        setSelectedAufmass(fresh);
      }
    }
  }, [aufmasse, selectedAufmass]);

  // 2. Automatically derive dateFrom:
  // Bis-Datum des letzten Aufmaßes, oder Startdatum des Projekts / früheste Buchung
  const latestSavedAufmass = useMemo(() => {
    return aufmasse.length > 0 ? aufmasse[0] : null;
  }, [aufmasse]);

  const derivedDateFrom = useMemo(() => {
    if (latestSavedAufmass) {
      return latestSavedAufmass.dateTo;
    }
    if (project?.startDate) {
      return project.startDate;
    }
    // Fallback: earliest booking or 30 days ago
    if (bookings.length > 0) {
      const timestamps = bookings
        .map(b => b.createdAt || b.timestamp)
        .filter(Boolean) as string[];
      if (timestamps.length > 0) {
        timestamps.sort();
        return timestamps[0].slice(0, 10);
      }
    }
    const d = new Date();
    d.setDate(d.getDate() - 30);
    return d.toISOString().slice(0, 10);
  }, [latestSavedAufmass, project?.startDate, bookings]);

  // Handle open create modal
  const handleOpenCreateModal = () => {
    setDateTo(new Date().toISOString().slice(0, 10));
    setCustomDateFrom(derivedDateFrom);
    setCreatorName(currentUser?.name || 'Florian Burk');
    setNotes('');
    setIsCreateModalOpen(true);
  };

  // Submit and create new Aufmass snapshot
  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!dateTo || !customDateFrom) return;

    setIsSaving(true);
    try {
      const snapshot = calculateAufmassSnapshot(
        project,
        positions,
        rooms,
        bookings,
        alerts,
        addendums,
        customDateFrom,
        dateTo,
        creatorName,
        notes,
        latestSavedAufmass
      );

      await saveAufmassDocument(projectId, snapshot);
      setAufmasse(prev => [snapshot, ...prev.filter(a => a.id !== snapshot.id)]);
      setIsCreateModalOpen(false);
      setSelectedAufmass(snapshot);
      setDetailTab('summary');
      setSelectedRoomFilter('all');
    } catch (err: any) {
      console.error('Error creating Aufmass snapshot:', err);
      alert('Fehler beim Speichern des Aufmaßes: ' + (err.message || err));
    } finally {
      setIsSaving(false);
    }
  };

  // Discard Aufmass
  const handleConfirmDiscard = async () => {
    if (!discardTarget) return;
    setIsDiscarding(true);
    try {
      const targetId = discardTarget.id;
      if (selectedAufmass?.id === targetId) {
        setSelectedAufmass(null);
      }
      setAufmasse(prev => prev.filter(a => a.id !== targetId));
      await deleteAufmassDocument(projectId, targetId);
      setDiscardTarget(null);
    } catch (err: any) {
      console.error('Error discarding Aufmass:', err);
      alert('Fehler beim Verwerfen des Aufmaßes: ' + (err.message || err));
    } finally {
      setIsDiscarding(false);
    }
  };

  // Export current selected or a list item
  const handleExport = (aufmass: AufmassDocument, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    exportAufmassToExcel(aufmass);
  };

  const handleExportPdf = (aufmass: AufmassDocument, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    exportAufmassToPdf(aufmass);
  };

  // Filtered Summary in Detail View
  const filteredSummaryItems = useMemo(() => {
    if (!selectedAufmass) return [];
    if (!searchTerm.trim()) return selectedAufmass.summaryItems;
    const term = searchTerm.toLowerCase();
    return selectedAufmass.summaryItems.filter(item => 
      item.posNr.toLowerCase().includes(term) ||
      item.shortText.toLowerCase().includes(term) ||
      (item.group && item.group.toLowerCase().includes(term))
    );
  }, [selectedAufmass, searchTerm]);

  // Filtered Rooms in Detail View
  const filteredRoomsData = useMemo(() => {
    if (!selectedAufmass) return [];
    let list = selectedAufmass.roomsData;
    if (selectedRoomFilter !== 'all') {
      list = list.filter(r => r.roomId === selectedRoomFilter);
    }
    if (!searchTerm.trim()) return list;
    const term = searchTerm.toLowerCase();
    return list.filter(r => 
      r.roomName.toLowerCase().includes(term) ||
      r.roomCode.toLowerCase().includes(term) ||
      r.floor.toLowerCase().includes(term) ||
      r.positions.some(p => p.shortText.toLowerCase().includes(term) || p.posNr.toLowerCase().includes(term))
    );
  }, [selectedAufmass, selectedRoomFilter, searchTerm]);

  // ---------------------------------------------------------------------------
  // VIEW: DETAIL ANSICHT (Betrachtung eines Aufmaßes)
  // ---------------------------------------------------------------------------
  if (selectedAufmass) {
    return (
      <div className="space-y-6">
        
        {/* Top Navigation & Header Bar */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center space-x-3.5">
            <button
              onClick={() => setSelectedAufmass(null)}
              className="p-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 transition-colors cursor-pointer"
              title="Zurück zur Aufmaß-Historie"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div>
              <div className="flex items-center space-x-2.5">
                <span className="font-mono text-xs font-bold bg-[#3B82C4] text-white px-2.5 py-0.5 rounded shadow-xs">
                  {selectedAufmass.aufmassNumber}
                </span>
                <h2 className="text-xl font-black text-slate-900">
                  Aufmaß zum Stichtag {new Date(selectedAufmass.dateTo).toLocaleDateString('de-DE')}
                </h2>
              </div>
              <p className="text-xs text-slate-500 mt-1 flex flex-wrap items-center gap-x-3 gap-y-1">
                <span className="flex items-center space-x-1">
                  <Calendar className="w-3.5 h-3.5 text-slate-400" />
                  <span>
                    Zeitraum: <strong>{new Date(selectedAufmass.dateFrom).toLocaleDateString('de-DE')}</strong> bis <strong>{new Date(selectedAufmass.dateTo).toLocaleDateString('de-DE')}</strong>
                  </span>
                </span>
                <span>•</span>
                <span className="flex items-center space-x-1">
                  <Clock className="w-3.5 h-3.5 text-slate-400" />
                  <span>Erstellt: {new Date(selectedAufmass.createdAt).toLocaleString('de-DE')}</span>
                </span>
                <span>•</span>
                <span>Erfasser: <strong>{selectedAufmass.createdBy}</strong></span>
              </p>
            </div>
          </div>

          {/* Action Buttons Top Right: Excel, PDF, Discard */}
          <div className="flex items-center space-x-2.5">
            <button
              onClick={() => handleExport(selectedAufmass)}
              className="flex items-center space-x-2 bg-emerald-600 hover:bg-emerald-700 text-white px-3.5 py-2 rounded-xl text-xs font-bold shadow-sm transition-all cursor-pointer"
              title="Excel-Export (.xlsx) herunterladen"
            >
              <FileSpreadsheet className="w-4 h-4" />
              <span>Excel Export (.xlsx)</span>
            </button>
            <button
              onClick={() => handleExportPdf(selectedAufmass)}
              className="flex items-center space-x-2 bg-slate-800 hover:bg-slate-900 text-white px-3.5 py-2 rounded-xl text-xs font-bold shadow-sm transition-all cursor-pointer"
              title="Druckfertiges VOB-Aufmaß (PDF) exportieren"
            >
              <Download className="w-4 h-4" />
              <span>PDF Export</span>
            </button>
            <button
              onClick={() => setDiscardTarget(selectedAufmass)}
              className="flex items-center space-x-2 bg-red-50 hover:bg-red-100 text-red-700 border border-red-200 px-3.5 py-2 rounded-xl text-xs font-bold shadow-xs transition-all cursor-pointer"
              title="Aufmaß verwerfen und Deltas für Folgeaufmaß zurücksetzen"
            >
              <Trash2 className="w-4 h-4 text-red-600" />
              <span>Aufmaß verwerfen</span>
            </button>
          </div>
        </div>

        {/* Notes callout if present */}
        {selectedAufmass.notes && (
          <div className="bg-blue-50/70 border border-blue-200 rounded-xl p-3.5 text-xs text-blue-900 flex items-start space-x-2.5">
            <Info className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
            <div>
              <span className="font-bold">Notiz / Aufmaßbemerkung:</span> {selectedAufmass.notes}
            </div>
          </div>
        )}

        {/* View Switcher Tabs & Search Filter */}
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center p-1 bg-slate-100 rounded-xl max-w-fit">
            <button
              onClick={() => setDetailTab('summary')}
              className={`flex items-center space-x-2 px-4 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                detailTab === 'summary'
                  ? 'bg-white text-slate-900 shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Layers className="w-4 h-4 text-[#3B82C4]" />
              <span>Gesamtansicht (Kumuliert)</span>
              <span className="ml-1 text-[10px] bg-slate-200 text-slate-700 px-1.5 py-0.2 rounded-full font-mono">
                {selectedAufmass.summaryItems.length}
              </span>
            </button>

            <button
              onClick={() => setDetailTab('rooms')}
              className={`flex items-center space-x-2 px-4 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                detailTab === 'rooms'
                  ? 'bg-white text-slate-900 shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <MapPin className="w-4 h-4 text-emerald-600" />
              <span>Raumansicht (Aufgeschlüsselt)</span>
              <span className="ml-1 text-[10px] bg-slate-200 text-slate-700 px-1.5 py-0.2 rounded-full font-mono">
                {selectedAufmass.roomsData.length}
              </span>
            </button>
          </div>

          <div className="flex items-center space-x-4">
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Filtern..."
                className="pl-8 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg text-slate-700 focus:outline-none focus:ring-2 focus:ring-[#3B82C4]"
              />
            </div>
            {selectedAufmass.totalPeriodVolume > 0 && (
              <div className="text-right">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                  Abrechnungsvolumen
                </span>
                <span className="text-sm font-black text-slate-900 font-mono">
                  {selectedAufmass.totalPeriodVolume.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €
                </span>
              </div>
            )}
          </div>
        </div>

        {/* TAB 1: GESAMTANSICHT (Feste Breiten & Text-Break) */}
        {detailTab === 'summary' && (
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs table-fixed min-w-[920px]">
                <thead>
                  <tr className="bg-slate-50 text-slate-500 text-[11px] font-semibold uppercase border-b border-slate-200">
                    <th className="py-3 px-3.5 w-28">Pos-Nr</th>
                    <th className="py-3 px-3.5 w-[34%] min-w-[240px]">Material / Leistungsbeschreibung</th>
                    <th className="py-3 px-3.5 w-24 text-right">Plan (Gesamt)</th>
                    <th className="py-3 px-3.5 w-28 text-right">Verbaut im Zeitraum</th>
                    <th className="py-3 px-3.5 w-28 text-right">Kumuliert bis Stichtag</th>
                    <th className="py-3 px-3.5 w-16 text-center">Einheit</th>
                    <th className="py-3 px-3.5 w-24 text-right">Einzelpreis</th>
                    <th className="py-3 px-3.5 w-28 text-right">Abrechnung (€)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredSummaryItems.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="py-8 text-center text-slate-400">
                        Keine Positionen für diesen Filter gefunden.
                      </td>
                    </tr>
                  ) : (
                    filteredSummaryItems.map((item) => (
                      <tr key={item.positionId} className="hover:bg-slate-50/80 transition-colors">
                        <td className="py-3 px-3.5 font-mono font-bold text-[#3B82C4]">
                          {item.posNr}
                        </td>
                        <td className="py-3 px-3.5">
                          <div className="font-semibold text-slate-900 break-words whitespace-normal leading-snug">
                            {item.shortText}
                          </div>
                          {item.group && (
                            <div className="text-[11px] text-slate-400 mt-0.5 break-words">
                              {item.group}
                            </div>
                          )}
                        </td>
                        <td className="py-3 px-3.5 text-right font-medium text-slate-600">
                          {item.plannedQty}
                        </td>
                        <td className="py-3 px-3.5 text-right font-bold text-blue-600 bg-blue-50/30">
                          {item.periodInstalledQty > 0 ? item.periodInstalledQty : <span className="text-slate-400 font-normal">–</span>}
                        </td>
                        <td className="py-3 px-3.5 text-right font-bold text-slate-900">
                          {item.totalInstalledUpToDate}
                        </td>
                        <td className="py-3 px-3.5 text-center text-slate-500 font-medium">
                          {item.qu}
                        </td>
                        <td className="py-3 px-3.5 text-right text-slate-600 font-mono">
                          {item.unitPrice ? `${item.unitPrice.toFixed(2)} €` : '–'}
                        </td>
                        <td className="py-3 px-3.5 text-right font-bold font-mono text-slate-900">
                          {item.totalCost ? `${item.totalCost.toFixed(2)} €` : '–'}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* TAB 2: RAUMANSICHT (Horizontale Raum-Navigation & Feste Breiten) */}
        {detailTab === 'rooms' && (
          <div className="space-y-4">
            
            {/* Horizontal Room Selector Bar */}
            <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-xs flex items-center gap-2 overflow-x-auto">
              <span className="text-xs font-bold text-slate-400 uppercase tracking-wider shrink-0 mr-1 flex items-center space-x-1">
                <MapPin className="w-3.5 h-3.5 text-emerald-600" />
                <span>Räume:</span>
              </span>
              <button
                onClick={() => setSelectedRoomFilter('all')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold shrink-0 transition-all cursor-pointer ${
                  selectedRoomFilter === 'all'
                    ? 'bg-[#3B82C4] text-white shadow-xs'
                    : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                }`}
              >
                Alle Räume ({selectedAufmass.roomsData.length})
              </button>
              {selectedAufmass.roomsData.map(r => {
                const isActive = selectedRoomFilter === r.roomId;
                const hasIssues = r.positions.some(p => p.isOverconsumption);
                return (
                  <button
                    key={r.roomId}
                    onClick={() => setSelectedRoomFilter(r.roomId)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold shrink-0 transition-all flex items-center space-x-1.5 cursor-pointer ${
                      isActive
                        ? 'bg-[#3B82C4] text-white shadow-xs'
                        : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                    }`}
                  >
                    <span>{r.roomCode} {r.roomName}</span>
                    {hasIssues && (
                      <span className={`w-2 h-2 rounded-full ${isActive ? 'bg-amber-300' : 'bg-red-500'}`} />
                    )}
                  </button>
                );
              })}
            </div>

            {filteredRoomsData.length === 0 ? (
              <div className="bg-white rounded-xl border border-slate-200 p-8 text-center text-slate-400">
                Keine Räume für diesen Filter gefunden.
              </div>
            ) : (
              filteredRoomsData.map((room) => {
                const roomOverconsumptionCount = room.positions.filter(p => p.isOverconsumption).length;
                const roomExtraPositionsCount = room.positions.filter(p => p.isExtraPosition).length;

                return (
                  <div key={room.roomId} className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                    {/* Room Header */}
                    <div className="bg-slate-50 p-4 border-b border-slate-200 flex flex-wrap items-center justify-between gap-3">
                      <div className="flex items-center space-x-2.5">
                        <span className="font-mono text-xs font-bold bg-[#3B82C4] text-white px-2.5 py-0.5 rounded">
                          {room.roomCode}
                        </span>
                        <h3 className="font-bold text-slate-900 text-sm">
                          {room.roomName}
                        </h3>
                        <span className="text-xs text-slate-400">
                          (Etage: {room.floor})
                        </span>
                        {room.isCompleted ? (
                          <span className="inline-flex items-center space-x-1 text-[10px] font-bold text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded-full">
                            <Check className="w-3 h-3 text-emerald-600" />
                            <span>100% Abgeschlossen</span>
                          </span>
                        ) : (
                          <span className="text-[10px] font-medium text-amber-700 bg-amber-50 px-2 py-0.5 rounded-full border border-amber-200">
                            In Montage
                          </span>
                        )}
                      </div>

                      <div className="flex items-center space-x-2 text-xs">
                        {roomOverconsumptionCount > 0 && (
                          <span className="inline-flex items-center space-x-1 text-[11px] font-bold text-red-700 bg-red-100 border border-red-200 px-2 py-0.5 rounded-full">
                            <AlertTriangle className="w-3 h-3 text-red-600" />
                            <span>{roomOverconsumptionCount} Mehrverbrauch</span>
                          </span>
                        )}
                        {roomExtraPositionsCount > 0 && (
                          <span className="inline-flex items-center space-x-1 text-[11px] font-bold text-purple-700 bg-purple-100 border border-purple-200 px-2 py-0.5 rounded-full">
                            <span>+{roomExtraPositionsCount} Zusatzpositionen</span>
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Room Positions Table with FIXED column widths and break-words */}
                    <div className="overflow-x-auto">
                      <table className="w-full text-left border-collapse text-xs table-fixed min-w-[950px]">
                        <thead>
                          <tr className="bg-slate-100/70 text-slate-500 text-[11px] font-semibold uppercase border-b border-slate-200">
                            <th className="py-2.5 px-3.5 w-28">Pos-Nr</th>
                            <th className="py-2.5 px-3.5 w-[30%] min-w-[220px]">Materialbezeichnung</th>
                            <th className="py-2.5 px-3.5 w-20 text-right">Plan</th>
                            <th className="py-2.5 px-3.5 w-28 text-right">Im Zeitraum</th>
                            <th className="py-2.5 px-3.5 w-28 text-right">Kumuliert</th>
                            <th className="py-2.5 px-3.5 w-28 text-center">Status / Delta</th>
                            <th className="py-2.5 px-3.5 w-[25%] min-w-[180px]">Hinweis / Begründung</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {room.positions.length === 0 ? (
                            <tr>
                              <td colSpan={7} className="py-4 text-center text-slate-400">
                                Keine Positionen für diesen Raum erfasst.
                              </td>
                            </tr>
                          ) : (
                            room.positions.map((pos) => (
                              <tr key={pos.positionId} className={`hover:bg-slate-50/80 transition-colors ${
                                pos.isOverconsumption ? 'bg-red-50/20' : (pos.isExtraPosition ? 'bg-purple-50/20' : '')
                              }`}>
                                <td className="py-3 px-3.5 font-mono font-bold text-[#3B82C4]">
                                  {pos.posNr}
                                </td>
                                <td className="py-3 px-3.5">
                                  <div className="font-semibold text-slate-900 break-words whitespace-normal leading-snug">
                                    {pos.shortText}
                                  </div>
                                  {pos.isExtraPosition && (
                                    <span className="inline-block mt-0.5 text-[10px] font-bold bg-purple-100 text-purple-700 border border-purple-200 px-1.5 py-0.2 rounded">
                                      Zusatzposition
                                    </span>
                                  )}
                                </td>
                                <td className="py-3 px-3.5 text-right font-medium text-slate-600">
                                  {pos.plannedQty} {pos.qu}
                                </td>
                                <td className="py-3 px-3.5 text-right font-bold text-blue-600 bg-blue-50/30">
                                  {pos.installedInPeriod > 0 ? `${pos.installedInPeriod} ${pos.qu}` : <span className="text-slate-400 font-normal">–</span>}
                                </td>
                                <td className="py-3 px-3.5 text-right font-bold text-slate-900">
                                  {pos.totalInstalledToDate} {pos.qu}
                                </td>
                                <td className="py-3 px-3.5 text-center">
                                  {pos.isOverconsumption ? (
                                    <span className="inline-flex items-center space-x-1 px-2 py-0.5 rounded-full text-[11px] font-bold bg-red-100 text-red-700 border border-red-200">
                                      <span>+{pos.excessQty} {pos.qu}</span>
                                    </span>
                                  ) : pos.isExtraPosition ? (
                                    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-purple-100 text-purple-700 border border-purple-200">
                                      Sonderposten
                                    </span>
                                  ) : (
                                    <span className="text-slate-400 text-[11px]">–</span>
                                  )}
                                </td>
                                <td className="py-3 px-3.5 text-slate-700">
                                  {pos.reason ? (
                                    <div className="text-[11px] break-words whitespace-normal italic">
                                      {pos.reason}
                                    </div>
                                  ) : (
                                    <span className="text-slate-400 text-[11px]">–</span>
                                  )}
                                </td>
                              </tr>
                            ))
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        )}

        {/* Modal: Aufmaß verwerfen Confirmation */}
        {discardTarget && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-xs z-50 flex items-center justify-center p-4">
            <div className="bg-white w-full max-w-md rounded-2xl shadow-2xl border border-slate-200 p-6 space-y-4 animate-in fade-in zoom-in-95 duration-150">
              <div className="flex items-center space-x-3 text-red-600">
                <div className="w-10 h-10 rounded-xl bg-red-100 flex items-center justify-center">
                  <Trash2 className="w-5 h-5 text-red-600" />
                </div>
                <div>
                  <h3 className="font-bold text-slate-900 text-base">Aufmaß verwerfen?</h3>
                  <p className="text-xs text-slate-500 font-mono">{discardTarget.aufmassNumber}</p>
                </div>
              </div>

              <p className="text-xs text-slate-600 leading-relaxed">
                Möchten Sie dieses Aufmaß zum Stichtag <strong>{new Date(discardTarget.dateTo).toLocaleDateString('de-DE')}</strong> wirklich verwerfen?
                <br /><br />
                Alle erfassten Deltas dieses Aufmaßes werden zurückgesetzt. Ein erneutes Aufmaß berechnet die Posten anschließend wieder automatisch ab dem zuvor gespeicherten Aufmaß (oder Projektbeginn).
              </p>

              <div className="flex items-center justify-end space-x-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  disabled={isDiscarding}
                  onClick={() => setDiscardTarget(null)}
                  className="px-4 py-2 rounded-xl text-xs font-bold text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer"
                >
                  Abbrechen
                </button>
                <button
                  type="button"
                  disabled={isDiscarding}
                  onClick={handleConfirmDiscard}
                  className="px-4 py-2 rounded-xl text-xs font-bold bg-red-600 hover:bg-red-700 text-white shadow-md shadow-red-500/20 transition-all flex items-center space-x-1.5 cursor-pointer disabled:opacity-50"
                >
                  {isDiscarding ? (
                    <span>Wird verworfen...</span>
                  ) : (
                    <>
                      <Trash2 className="w-3.5 h-3.5" />
                      <span>Ja, Aufmaß verwerfen</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        )}

      </div>
    );
  }

  // ---------------------------------------------------------------------------
  // VIEW: LISTENANSICHT (Historie aller Aufmaße als Tabelle mit Excel-Export)
  // ---------------------------------------------------------------------------
  return (
    <div className="space-y-6">
      
      {/* Top Banner / Callout Header */}
      <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center space-x-2.5">
            <div className="w-10 h-10 rounded-xl bg-blue-50 text-[#3B82C4] flex items-center justify-center font-bold">
              <FileSpreadsheet className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-xl font-black text-slate-900">Aufmaße & Historie</h2>
              <p className="text-xs text-slate-500">
                Erstelle stichtagsbezogene VOB-Aufmaße mit unveränderlichen Snapshots, Deltas und Excel-Export.
              </p>
            </div>
          </div>
        </div>

        <button
          onClick={handleOpenCreateModal}
          className="flex items-center space-x-2 bg-[#3B82C4] hover:bg-blue-600 text-white px-5 py-2.5 rounded-xl text-xs font-bold shadow-md shadow-blue-500/20 transition-all cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          <span>Neues Aufmaß erstellen</span>
        </button>
      </div>

      {/* Aufmaß Liste */}
      {aufmasse.length === 0 ? (
        <div className="bg-white rounded-2xl border-2 border-dashed border-slate-200 p-12 text-center space-y-4">
          <div className="w-16 h-16 rounded-2xl bg-blue-50 text-[#3B82C4] mx-auto flex items-center justify-center">
            <FileSpreadsheet className="w-8 h-8" />
          </div>
          <div className="space-y-1">
            <h3 className="font-bold text-slate-800 text-base">Noch kein Aufmaß erstellt</h3>
            <p className="text-xs text-slate-500 max-w-md mx-auto">
              Erfasse das erste Zwischen- oder Schlussaufmaß für dieses Projekt. Alle Verbaudaten werden als historisch unveränderlicher Snapshot gespeichert.
            </p>
          </div>
          <button
            onClick={handleOpenCreateModal}
            className="inline-flex items-center space-x-2 bg-[#3B82C4] hover:bg-blue-600 text-white px-4 py-2 rounded-xl text-xs font-bold shadow-sm transition-all cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Jetzt erstes Aufmaß erstellen</span>
          </button>
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="p-4 border-b border-slate-100 flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <FileSpreadsheet className="w-5 h-5 text-[#3B82C4]" />
              <h3 className="font-bold text-slate-900 text-sm">Erstellte Aufmaße ({aufmasse.length})</h3>
            </div>
            <span className="text-xs text-slate-500">
              Neueste Aufmaße oben • Excel-Export direkt in jeder Zeile
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-50 text-slate-500 text-[11px] font-semibold uppercase border-b border-slate-200">
                  <th className="py-3 px-4 w-36">Aufmaß-Nr</th>
                  <th className="py-3 px-4 w-44">Zeitraum / Stichtag</th>
                  <th className="py-3 px-4 w-48">Erfasst von / Wann</th>
                  <th className="py-3 px-4 w-36 text-right">Umfang</th>
                  <th className="py-3 px-4 w-36 text-right">Abrechnungsvolumen</th>
                  <th className="py-3 px-4">Bemerkung</th>
                  <th className="py-3 px-4 w-60 text-center">Aktionen</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {aufmasse.map((aufmass, idx) => (
                  <tr 
                    key={aufmass.id}
                    onClick={() => setSelectedAufmass(aufmass)}
                    className="hover:bg-blue-50/40 transition-colors cursor-pointer group"
                  >
                    {/* Aufmaß-Nr */}
                    <td className="py-3.5 px-4">
                      <span className="font-mono text-xs font-bold bg-[#3B82C4] text-white px-2.5 py-1 rounded shadow-xs inline-block">
                        {aufmass.aufmassNumber}
                      </span>
                      {idx === 0 && (
                        <span className="ml-2 text-[10px] font-bold text-emerald-700 bg-emerald-100 px-1.5 py-0.5 rounded-full border border-emerald-200">
                          Aktuellstes
                        </span>
                      )}
                    </td>

                    {/* Zeitraum / Stichtag */}
                    <td className="py-3.5 px-4 font-medium text-slate-900">
                      <div className="flex items-center space-x-1.5">
                        <Calendar className="w-3.5 h-3.5 text-[#3B82C4] shrink-0" />
                        <span>Stichtag: <strong>{new Date(aufmass.dateTo).toLocaleDateString('de-DE')}</strong></span>
                      </div>
                      <div className="text-[11px] text-slate-500 mt-0.5 pl-5">
                        {new Date(aufmass.dateFrom).toLocaleDateString('de-DE')} – {new Date(aufmass.dateTo).toLocaleDateString('de-DE')}
                      </div>
                    </td>

                    {/* Erfasst von / Wann */}
                    <td className="py-3.5 px-4">
                      <div className="font-semibold text-slate-900 flex items-center space-x-1.5">
                        <UserCheck className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                        <span>{aufmass.createdBy || 'Florian Burk'}</span>
                      </div>
                      <div className="text-[11px] text-slate-500 mt-0.5 flex items-center space-x-1 pl-5">
                        <Clock className="w-3 h-3 text-slate-400" />
                        <span>{new Date(aufmass.createdAt).toLocaleString('de-DE')}</span>
                      </div>
                    </td>

                    {/* Umfang */}
                    <td className="py-3.5 px-4 text-right">
                      <div className="font-bold text-slate-800">
                        {aufmass.summaryItems.length} Positionen
                      </div>
                      <div className="text-[11px] text-slate-500">
                        in {aufmass.roomsData.length} Räumen
                      </div>
                    </td>

                    {/* Abrechnungsvolumen */}
                    <td className="py-3.5 px-4 text-right">
                      <span className="font-bold text-slate-900 font-mono text-xs">
                        {aufmass.totalPeriodVolume > 0 
                          ? `${aufmass.totalPeriodVolume.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €` 
                          : '–'}
                      </span>
                    </td>

                    {/* Bemerkung */}
                    <td className="py-3.5 px-4">
                      {aufmass.notes ? (
                        <span className="text-slate-600 italic line-clamp-2 text-xs">
                          {aufmass.notes}
                        </span>
                      ) : (
                        <span className="text-slate-400 text-xs">–</span>
                      )}
                    </td>

                    {/* Aktionen (Excel Export in jeder Zeile!) */}
                    <td className="py-3.5 px-4 text-center">
                      <div className="flex items-center justify-center space-x-1.5" onClick={(e) => e.stopPropagation()}>
                        <button
                          onClick={(e) => handleExport(aufmass, e)}
                          className="flex items-center space-x-1 bg-emerald-600 hover:bg-emerald-700 text-white px-2.5 py-1.5 rounded-lg text-[11px] font-bold shadow-xs transition-all cursor-pointer"
                          title="Excel Export (.xlsx) herunterladen"
                        >
                          <FileSpreadsheet className="w-3.5 h-3.5" />
                          <span>Excel</span>
                        </button>

                        <button
                          onClick={(e) => handleExportPdf(aufmass, e)}
                          className="flex items-center space-x-1 bg-slate-800 hover:bg-slate-900 text-white px-2 py-1.5 rounded-lg text-[11px] font-bold shadow-xs transition-all cursor-pointer"
                          title="PDF drucken / exportieren"
                        >
                          <Download className="w-3.5 h-3.5" />
                          <span>PDF</span>
                        </button>

                        <button
                          onClick={() => setSelectedAufmass(aufmass)}
                          className="flex items-center space-x-1 bg-blue-50 hover:bg-blue-100 text-[#3B82C4] border border-blue-200 px-2 py-1.5 rounded-lg text-[11px] font-bold transition-all cursor-pointer"
                          title="Aufmaß-Details ansehen"
                        >
                          <Eye className="w-3.5 h-3.5" />
                          <span>Öffnen</span>
                        </button>

                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setDiscardTarget(aufmass);
                          }}
                          className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors cursor-pointer"
                          title="Aufmaß verwerfen"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Modal: Aufmaß verwerfen Confirmation (auch aus Listenansicht) */}
      {discardTarget && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-md rounded-2xl shadow-2xl border border-slate-200 p-6 space-y-4 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center space-x-3 text-red-600">
              <div className="w-10 h-10 rounded-xl bg-red-100 flex items-center justify-center">
                <Trash2 className="w-5 h-5 text-red-600" />
              </div>
              <div>
                <h3 className="font-bold text-slate-900 text-base">Aufmaß verwerfen?</h3>
                <p className="text-xs text-slate-500 font-mono">{discardTarget.aufmassNumber}</p>
              </div>
            </div>

            <p className="text-xs text-slate-600 leading-relaxed">
              Möchten Sie dieses Aufmaß zum Stichtag <strong>{new Date(discardTarget.dateTo).toLocaleDateString('de-DE')}</strong> wirklich verwerfen?
              <br /><br />
              Alle erfassten Deltas dieses Aufmaßes werden gelöscht. Ein neues Aufmaß setzt anschließend wieder automatisch am zuvor gespeicherten Stand an.
            </p>

            <div className="flex items-center justify-end space-x-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                disabled={isDiscarding}
                onClick={() => setDiscardTarget(null)}
                className="px-4 py-2 rounded-xl text-xs font-bold text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer"
              >
                Abbrechen
              </button>
              <button
                type="button"
                disabled={isDiscarding}
                onClick={handleConfirmDiscard}
                className="px-4 py-2 rounded-xl text-xs font-bold bg-red-600 hover:bg-red-700 text-white shadow-md shadow-red-500/20 transition-all flex items-center space-x-1.5 cursor-pointer disabled:opacity-50"
              >
                {isDiscarding ? (
                  <span>Wird verworfen...</span>
                ) : (
                  <>
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Ja, Aufmaß verwerfen</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Neues Aufmaß anlegen */}
      {isCreateModalOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-lg rounded-2xl shadow-2xl border border-slate-200 overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            
            {/* Modal Header */}
            <div className="bg-[#1C2A3B] text-white p-5 flex items-center justify-between">
              <div>
                <span className="text-xs font-bold text-[#3B82C4] uppercase tracking-wider block">
                  VOB Stichtags-Abrechnung
                </span>
                <h3 className="text-lg font-bold text-white mt-0.5">
                  Neues Aufmaß erstellen
                </h3>
              </div>
              <button
                onClick={() => setIsCreateModalOpen(false)}
                className="text-slate-400 hover:text-white transition-colors text-lg cursor-pointer"
              >
                ✕
              </button>
            </div>

            {/* Modal Form */}
            <form onSubmit={handleCreateSubmit} className="p-6 space-y-4 text-xs">
              
              {/* Info if follow-up Aufmaß */}
              {latestSavedAufmass && (
                <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3 text-[11px] text-emerald-800 space-y-0.5">
                  <div className="font-bold flex items-center space-x-1.5">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                    <span>Anschluss-Aufmaß zu {latestSavedAufmass.aufmassNumber}</span>
                  </div>
                  <p>
                    Dieses Aufmaß knüpft nahtlos an das vorherige Aufmaß an (Stichtag: {new Date(latestSavedAufmass.dateTo).toLocaleDateString('de-DE')}). 
                    Die abgerechneten Deltas werden exakt ab dem vorigen Stand berechnet.
                  </p>
                </div>
              )}

              <div className="bg-blue-50 border-2 border-[#3B82C4] rounded-xl p-3">
                <label className="block font-bold text-[#1C2A3B] mb-1">
                  Stichtag der Abrechnung *
                </label>
                <input
                  type="date"
                  required
                  autoFocus
                  value={dateTo}
                  onChange={(e) => setDateTo(e.target.value)}
                  className="w-full px-3 py-2 bg-white border border-[#3B82C4] rounded-xl font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#3B82C4]"
                />
                <span className="text-[11px] text-slate-500 mt-1 block">
                  Vorbelegt mit heutigem Datum. Alle bis zu diesem Stichtag verbauten Materialien werden kumuliert abgerechnet.
                </span>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Beginn des Abrechnungszeitraums (Von-Datum) *
                </label>
                <input
                  type="date"
                  required
                  value={customDateFrom}
                  onChange={(e) => setCustomDateFrom(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#3B82C4]"
                />
                <span className="text-[11px] text-slate-400 mt-1 block">
                  Automatisch aus vorherigem Aufmaß abgeleitet. Bei Bedarf anpassbar.
                </span>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Ersteller / Sachbearbeiter
                </label>
                <input
                  type="text"
                  value={creatorName}
                  onChange={(e) => setCreatorName(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#3B82C4]"
                  placeholder="z. B. Florian Burk"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Notiz / Bemerkung zum Aufmaß
                </label>
                <textarea
                  rows={2}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#3B82C4]"
                  placeholder="z. B. Abschlagsaufmaß Nr. 1 nach Rohinstallation Sanitär"
                />
              </div>

              <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-[11px] text-amber-800 space-y-1">
                <span className="font-bold flex items-center space-x-1">
                  <Info className="w-3.5 h-3.5 text-amber-600" />
                  <span>Unveränderlicher Snapshot</span>
                </span>
                <p>
                  Das Aufmaß friert die aktuellen Verbaumengen zum Stichtag ein. Zukünftige Verbauungen im Projekt ändern dieses Aufmaß nicht.
                </p>
              </div>

              {/* Action Buttons */}
              <div className="pt-3 border-t border-slate-200 flex items-center justify-end space-x-3">
                <button
                  type="button"
                  onClick={() => setIsCreateModalOpen(false)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-semibold transition-colors cursor-pointer"
                >
                  Abbrechen
                </button>
                <button
                  type="submit"
                  disabled={isSaving}
                  className="px-5 py-2 bg-[#3B82C4] hover:bg-blue-600 text-white rounded-xl font-bold shadow-md shadow-blue-500/20 transition-all flex items-center space-x-2 cursor-pointer disabled:opacity-50"
                >
                  {isSaving ? (
                    <span>Wird berechnet...</span>
                  ) : (
                    <>
                      <CheckCircle2 className="w-4 h-4" />
                      <span>Aufmaß jetzt anlegen</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
