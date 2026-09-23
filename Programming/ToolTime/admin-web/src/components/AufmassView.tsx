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
  Check
} from 'lucide-react';
import { 
  listenToAufmasse, 
  saveAufmassDocument, 
  deleteAufmassDocument, 
  calculateAufmassSnapshot 
} from '../services/aufmassService';
import { exportAufmassToExcel } from '../services/excelExporter';

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

  // Create Modal State
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [dateTo, setDateTo] = useState<string>(() => new Date().toISOString().slice(0, 10));
  const [customDateFrom, setCustomDateFrom] = useState<string>('');
  const [creatorName, setCreatorName] = useState<string>(currentUser?.name || 'Florian Burk');
  const [notes, setNotes] = useState<string>('');
  const [isSaving, setIsSaving] = useState(false);

  // 1. Listen to Aufmasse from Firestore
  useEffect(() => {
    if (!projectId) return;
    const unsub = listenToAufmasse(projectId, setAufmasse);
    return () => unsub();
  }, [projectId]);

  // Keep selectedAufmass updated if changed in list
  useEffect(() => {
    if (selectedAufmass) {
      const fresh = aufmasse.find(a => a.id === selectedAufmass.id);
      if (fresh) setSelectedAufmass(fresh);
    }
  }, [aufmasse, selectedAufmass]);

  // 2. Automatically derive dateFrom:
  // Bis-Datum des letzten Aufmaßes, oder Startdatum des Projekts / früheste Buchung
  const derivedDateFrom = useMemo(() => {
    if (aufmasse.length > 0) {
      // Sort by dateTo descending
      const sorted = [...aufmasse].sort((a, b) => b.dateTo.localeCompare(a.dateTo));
      return sorted[0].dateTo;
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
  }, [aufmasse, project?.startDate, bookings]);

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
        notes
      );

      await saveAufmassDocument(projectId, snapshot);
      setIsCreateModalOpen(false);
      setSelectedAufmass(snapshot);
      setDetailTab('summary');
    } catch (err: any) {
      console.error('Error creating Aufmass snapshot:', err);
    } finally {
      setIsSaving(false);
    }
  };

  // Delete Aufmass
  const handleDeleteAufmass = async (aufmassId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (window.confirm('Möchten Sie dieses Aufmaß wirklich löschen?')) {
      if (selectedAufmass?.id === aufmassId) {
        setSelectedAufmass(null);
      }
      await deleteAufmassDocument(projectId, aufmassId);
    }
  };

  // Export current selected or a list item
  const handleExport = (aufmass: AufmassDocument, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    exportAufmassToExcel(aufmass);
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
    if (!searchTerm.trim()) return selectedAufmass.roomsData;
    const term = searchTerm.toLowerCase();
    return selectedAufmass.roomsData.filter(r => 
      r.roomName.toLowerCase().includes(term) ||
      r.roomCode.toLowerCase().includes(term) ||
      r.floor.toLowerCase().includes(term) ||
      r.positions.some(p => p.shortText.toLowerCase().includes(term) || p.posNr.toLowerCase().includes(term))
    );
  }, [selectedAufmass, searchTerm]);

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
              className="p-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 transition-colors"
              title="Zurück zur Übersicht"
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
              <p className="text-xs text-slate-500 mt-1 flex items-center space-x-3">
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

          <div className="flex items-center space-x-3">
            <button
              onClick={() => handleExport(selectedAufmass)}
              className="flex items-center space-x-2 bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-xl text-xs font-bold shadow-sm transition-all"
            >
              <Download className="w-4 h-4" />
              <span>Excel Export (.xlsx)</span>
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
              className={`flex items-center space-x-2 px-4 py-2 rounded-lg text-xs font-bold transition-all ${
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
              className={`flex items-center space-x-2 px-4 py-2 rounded-lg text-xs font-bold transition-all ${
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
                <span className="text-sm font-black text-slate-900">
                  {selectedAufmass.totalPeriodVolume.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €
                </span>
              </div>
            )}
          </div>
        </div>

        {/* TAB 1: GESAMTANSICHT */}
        {detailTab === 'summary' && (
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-slate-50 text-slate-500 text-[11px] font-semibold uppercase border-b border-slate-200">
                    <th className="py-3 px-4 w-24">Pos-Nr</th>
                    <th className="py-3 px-4">Material / Leistungsbeschreibung</th>
                    <th className="py-3 px-4 w-24 text-right">Plan (Gesamt)</th>
                    <th className="py-3 px-4 w-32 text-right">Verbaut im Zeitraum</th>
                    <th className="py-3 px-4 w-32 text-right">Kumuliert bis Stichtag</th>
                    <th className="py-3 px-4 w-20 text-center">Einheit</th>
                    <th className="py-3 px-4 w-28 text-right">Einzelpreis</th>
                    <th className="py-3 px-4 w-32 text-right">Abrechnung (€)</th>
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
                        <td className="py-3 px-4 font-mono font-bold text-[#3B82C4]">
                          {item.posNr}
                        </td>
                        <td className="py-3 px-4">
                          <div className="font-semibold text-slate-900">{item.shortText}</div>
                          {item.group && (
                            <div className="text-[11px] text-slate-400 mt-0.5">{item.group}</div>
                          )}
                        </td>
                        <td className="py-3 px-4 text-right font-medium text-slate-600">
                          {item.plannedQty}
                        </td>
                        <td className="py-3 px-4 text-right font-bold text-blue-600 bg-blue-50/30">
                          {item.periodInstalledQty > 0 ? (
                            <span>{item.periodInstalledQty}</span>
                          ) : (
                            <span className="text-slate-400 font-normal">–</span>
                          )}
                        </td>
                        <td className="py-3 px-4 text-right font-bold text-slate-900">
                          {item.totalInstalledUpToDate}
                        </td>
                        <td className="py-3 px-4 text-center font-medium text-slate-500">
                          {item.qu}
                        </td>
                        <td className="py-3 px-4 text-right font-mono text-slate-600">
                          {item.unitPrice > 0 ? `${item.unitPrice.toFixed(2)} €` : '-'}
                        </td>
                        <td className="py-3 px-4 text-right font-mono font-bold text-slate-900">
                          {item.totalCost > 0 ? `${item.totalCost.toFixed(2)} €` : '-'}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* TAB 2: RAUMANSICHT */}
        {detailTab === 'rooms' && (
          <div className="space-y-6">
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

                    {/* Room Positions Table */}
                    <div className="overflow-x-auto">
                      <table className="w-full text-left border-collapse text-xs">
                        <thead>
                          <tr className="bg-slate-100/70 text-slate-500 text-[11px] font-semibold uppercase border-b border-slate-200">
                            <th className="py-2.5 px-4 w-24">Pos-Nr</th>
                            <th className="py-2.5 px-4">Materialbezeichnung</th>
                            <th className="py-2.5 px-4 w-24 text-right">Plan</th>
                            <th className="py-2.5 px-4 w-32 text-right">Im Zeitraum</th>
                            <th className="py-2.5 px-4 w-32 text-right">Kumuliert</th>
                            <th className="py-2.5 px-4 w-28 text-center">Status / Delta</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {room.positions.length === 0 ? (
                            <tr>
                              <td colSpan={6} className="py-4 text-center text-slate-400">
                                Keine Positionen für diesen Raum erfasst.
                              </td>
                            </tr>
                          ) : (
                            room.positions.map((pos) => {
                              return (
                                <React.Fragment key={pos.positionId}>
                                  <tr className={`hover:bg-slate-50/80 transition-colors ${
                                    pos.isOverconsumption ? 'bg-red-50/20' : (pos.isExtraPosition ? 'bg-purple-50/20' : '')
                                  }`}>
                                    <td className="py-3 px-4 font-mono font-bold text-[#3B82C4]">
                                      {pos.posNr}
                                    </td>
                                    <td className="py-3 px-4">
                                      <div className="font-semibold text-slate-900 flex items-center space-x-2">
                                        <span>{pos.shortText}</span>
                                        {pos.isExtraPosition && (
                                          <span className="text-[10px] font-bold bg-purple-100 text-purple-700 border border-purple-200 px-1.5 py-0.2 rounded">
                                            Zusatzposition
                                          </span>
                                        )}
                                      </div>
                                    </td>
                                    <td className="py-3 px-4 text-right font-medium text-slate-600">
                                      {pos.plannedQty} {pos.qu}
                                    </td>
                                    <td className="py-3 px-4 text-right font-bold text-blue-600 bg-blue-50/30">
                                      {pos.installedInPeriod > 0 ? `${pos.installedInPeriod} ${pos.qu}` : <span className="text-slate-400 font-normal">–</span>}
                                    </td>
                                    <td className="py-3 px-4 text-right font-bold text-slate-900">
                                      {pos.totalInstalledToDate} {pos.qu}
                                    </td>
                                    <td className="py-3 px-4 text-center">
                                      {pos.isOverconsumption ? (
                                        <span className="inline-flex items-center space-x-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-red-100 text-red-700 border border-red-200">
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
                                  </tr>

                                  {/* Dedicated Reason Callout Row directly underneath if excess or extra */}
                                  {(pos.isOverconsumption || pos.isExtraPosition) && (
                                    <tr className="bg-red-50/30 border-b border-red-100/60">
                                      <td className="py-1.5 px-4 font-mono text-[10px] text-red-600"></td>
                                      <td colSpan={5} className="py-1.5 px-4 text-xs text-red-800">
                                        <div className="flex items-center space-x-2">
                                          <span className="font-bold text-[11px] uppercase tracking-wider text-red-700 flex items-center space-x-1">
                                            <AlertTriangle className="w-3.5 h-3.5 text-red-600" />
                                            <span>Begründung / Hinweis:</span>
                                          </span>
                                          <span className="italic font-medium text-slate-700">
                                            {pos.reason || 'Mehrbedarf vom Monteur erfasst (ohne gesonderte Notiz)'}
                                          </span>
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
                );
              })
            )}
          </div>
        )}
      </div>
    );
  }

  // ---------------------------------------------------------------------------
  // VIEW: LISTENANSICHT (Historie aller Aufmaße)
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
              <h2 className="text-xl font-black text-slate-900">Aufmaß erstellen & Historie</h2>
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
            className="inline-flex items-center space-x-2 bg-[#3B82C4] hover:bg-blue-600 text-white px-4 py-2 rounded-xl text-xs font-bold shadow-sm transition-all"
          >
            <Plus className="w-4 h-4" />
            <span>Jetzt erstes Aufmaß erstellen</span>
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {aufmasse.map((aufmass) => (
            <div
              key={aufmass.id}
              onClick={() => setSelectedAufmass(aufmass)}
              className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm hover:border-[#3B82C4] hover:shadow-md transition-all cursor-pointer flex flex-col justify-between group"
            >
              <div className="space-y-4">
                {/* Header Badge */}
                <div className="flex items-start justify-between">
                  <span className="font-mono text-xs font-bold bg-[#3B82C4] text-white px-2.5 py-0.5 rounded shadow-xs">
                    {aufmass.aufmassNumber}
                  </span>
                  <div className="flex items-center space-x-1">
                    <button
                      onClick={(e) => handleExport(aufmass, e)}
                      className="p-1.5 text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors"
                      title="Excel-Export (.xlsx)"
                    >
                      <Download className="w-4 h-4" />
                    </button>
                    <button
                      onClick={(e) => handleDeleteAufmass(aufmass.id, e)}
                      className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                      title="Aufmaß löschen"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {/* Date Interval */}
                <div>
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                    Aufmaß-Zeitraum
                  </span>
                  <h4 className="text-base font-black text-slate-900 mt-0.5 flex items-center space-x-1.5">
                    <Calendar className="w-4 h-4 text-[#3B82C4]" />
                    <span>
                      {new Date(aufmass.dateFrom).toLocaleDateString('de-DE')} – {new Date(aufmass.dateTo).toLocaleDateString('de-DE')}
                    </span>
                  </h4>
                </div>

                {/* Metrics */}
                <div className="grid grid-cols-2 gap-2 pt-2 border-t border-slate-100 text-xs">
                  <div>
                    <span className="text-[10px] text-slate-400 block">Positionen</span>
                    <span className="font-bold text-slate-700">{aufmass.summaryItems.length} erfasst</span>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-400 block">Räume</span>
                    <span className="font-bold text-slate-700">{aufmass.roomsData.length} aufgeschlüsselt</span>
                  </div>
                </div>

                {aufmass.notes && (
                  <p className="text-xs text-slate-500 italic line-clamp-2 bg-slate-50 p-2 rounded-lg">
                    {aufmass.notes}
                  </p>
                )}
              </div>

              {/* Card Footer */}
              <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-xs">
                <span className="text-[11px] text-slate-400">
                  {new Date(aufmass.createdAt).toLocaleDateString('de-DE')} ({aufmass.createdBy})
                </span>
                <span className="text-[#3B82C4] font-bold flex items-center space-x-1 group-hover:translate-x-1 transition-transform">
                  <span>Öffnen</span>
                  <Eye className="w-3.5 h-3.5" />
                </span>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* MODAL: Neues Aufmaß erstellen */}
      {isCreateModalOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-lg rounded-2xl shadow-2xl border border-slate-200 overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            {/* Modal Header */}
            <div className="bg-[#1C2A3B] text-white p-5 flex items-center justify-between">
              <div className="flex items-center space-x-2.5">
                <FileSpreadsheet className="w-5 h-5 text-[#3B82C4]" />
                <h3 className="font-bold text-base">Neues Aufmaß erstellen</h3>
              </div>
              <button
                onClick={() => setIsCreateModalOpen(false)}
                className="text-slate-400 hover:text-white p-1 rounded-lg transition-colors"
              >
                ✕
              </button>
            </div>

            {/* Modal Form */}
            <form onSubmit={handleCreateSubmit} className="p-6 space-y-4 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Stichtag (Bis-Datum) *
                </label>
                <input
                  type="date"
                  required
                  value={dateTo}
                  onChange={(e) => setDateTo(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#3B82C4]"
                />
                <span className="text-[11px] text-slate-400 mt-1 block">
                  Alle bis zu diesem Datum verbauten Materialien werden abgerechnet.
                </span>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Von-Datum (Beginn des Intervalls) *
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
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-semibold transition-colors"
                >
                  Abbrechen
                </button>
                <button
                  type="submit"
                  disabled={isSaving}
                  className="px-5 py-2 bg-[#3B82C4] hover:bg-blue-600 text-white rounded-xl font-bold shadow-md shadow-blue-500/20 transition-all flex items-center space-x-2"
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
