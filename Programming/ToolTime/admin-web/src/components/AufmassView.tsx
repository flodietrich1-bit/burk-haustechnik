import React, { useState, useEffect, useMemo } from 'react';
import type { 
  Project, 
  Position, 
  Room, 
  Booking, 
  Alert, 
  Addendum, 
  User, 
  AufmassDocument,
  AufmassRoomPosition
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
  UserCheck,
  Pencil,
  Mail
} from 'lucide-react';
import { 
  listenToAufmasse, 
  saveAufmassDocument, 
  deleteAufmassDocument, 
  calculateAufmassSnapshot,
  updateAufmassPositionReason,
  getAufmassRoomPercent
} from '../services/aufmassService';
import { exportAufmassToExcel, exportAufmassToPdf, downloadAufmassPdf } from '../services/excelExporter';

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
  const [detailTab, setDetailTab] = useState<'summary' | 'rooms'>('rooms');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedRoomFilter, setSelectedRoomFilter] = useState<string>('all');
  const onlyInstalled = true;

  // Discard Confirmation Modal State
  const [discardTarget, setDiscardTarget] = useState<AufmassDocument | null>(null);
  const [isDiscarding, setIsDiscarding] = useState(false);

  // Edit Reason Modal State
  const [editReasonModal, setEditReasonModal] = useState<{
    roomId: string;
    roomName: string;
    positionId: string;
    posNr: string;
    shortText: string;
    currentReason: string;
    currentCausedBy: string;
  } | null>(null);
  const [editReasonText, setEditReasonText] = useState('');
  const [editCausedBy, setEditCausedBy] = useState('Monteur');
  const [isSavingReason, setIsSavingReason] = useState(false);

  // Email Sent Status Modal State
  const [emailSentModal, setEmailSentModal] = useState<{
    aufmass: AufmassDocument;
    managerEmail: string;
    managerFirstName: string;
    subject: string;
    body: string;
    mailtoUrl: string;
  } | null>(null);

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
    if (project?.createdAt) {
      return project.createdAt.slice(0, 10);
    }
    return new Date().toISOString().slice(0, 10);
  }, [latestSavedAufmass, project?.startDate, project?.createdAt]);

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
      setDetailTab('rooms');
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

  // Send Aufmaß to commercial manager via Email with prefilled text and auto-download of Excel & PDF
  const handleSendAufmassEmail = async (aufmass: AufmassDocument, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();

    // 1. Prepare Email Metadata
    const managerFirstName = (project?.commercialManager || 'Andreas').trim().split(/\s+/)[0];
    const managerEmail = project?.commercialManagerEmail || 'andreas@burk-haustechnik.de';
    const pName = project?.name || 'Bauvorhaben';
    const dateFromStr = new Date(aufmass.dateFrom).toLocaleDateString('de-DE');
    const dateToStr = new Date(aufmass.dateTo).toLocaleDateString('de-DE');

    const totalPositionsCount = aufmass.summaryItems.length;
    const roomsCount = aufmass.roomsData.length;
    const specialCount = aufmass.roomsData.reduce((acc, r) => acc + (r.specialPositions?.length || 0), 0);

    const subject = `Aufmaß ${aufmass.aufmassNumber} (${pName}) – Zeitraum ${dateFromStr} bis ${dateToStr}`;

    const body = `Hallo ${managerFirstName},

anbei erhältst du das Aufmaß zur kaufmännischen Abrechnung und Prüfung:

• Bauvorhaben: ${pName}
• Aufmaß-Nummer: ${aufmass.aufmassNumber}
• Abrechnungszeitraum: ${dateFromStr} bis ${dateToStr}
• Erfasst von: ${aufmass.createdBy || 'Bauleitung'}
• Verbaute Positionen: ${totalPositionsCount}
• Bearbeitete Räume: ${roomsCount}
${specialCount > 0 ? `• Davon Sonderposten: ${specialCount}\n` : ''}${aufmass.notes ? `• Bemerkung: ${aufmass.notes}\n` : ''}
Beide Dateien (Excel-Report und PDF-Aufmaß) sind an diese E-Mail angehängt.

Bitte prüfe das Aufmaß und veranlasse die Abrechnung / Abschlagsrechnung.

Viele Grüße,
${aufmass.createdBy || 'Bauleitung'}`;

    const mailtoUrl = `mailto:${encodeURIComponent(managerEmail)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;

    // 2. OPEN EMAIL PROGRAM IMMEDIATELY USING NATIVE LINK
    // We execute this immediately to preserve user gesture context so the OS mail client opens without popup blocker interference:
    const mailLink = document.createElement('a');
    mailLink.href = mailtoUrl;
    document.body.appendChild(mailLink);
    mailLink.click();
    document.body.removeChild(mailLink);

    // 3. Download both Excel and PDF files
    exportAufmassToExcel(aufmass);
    try {
      await downloadAufmassPdf(aufmass);
    } catch (err) {
      console.warn('PDF download error:', err);
    }

    // 4. Open status & guidance modal
    setEmailSentModal({
      aufmass,
      managerEmail,
      managerFirstName,
      subject,
      body,
      mailtoUrl
    });
  };

  // Open modal to edit reason and originator for a special position
  const handleOpenEditReason = (roomId: string, roomName: string, pos: AufmassRoomPosition) => {
    setEditReasonModal({
      roomId,
      roomName,
      positionId: pos.positionId || pos.posNr,
      posNr: pos.posNr,
      shortText: pos.shortText,
      currentReason: pos.reason || '',
      currentCausedBy: pos.causedBy || 'Monteur'
    });
    setEditReasonText(pos.reason || '');
    setEditCausedBy(pos.causedBy || 'Monteur');
  };

  // Save updated reason and originator
  const handleSaveReason = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editReasonModal || !selectedAufmass) return;
    setIsSavingReason(true);
    try {
      const updated = await updateAufmassPositionReason(
        projectId,
        selectedAufmass.id,
        editReasonModal.roomId,
        editReasonModal.positionId,
        editReasonText,
        editCausedBy
      );
      if (updated) {
        setSelectedAufmass(updated);
        setAufmasse(prev => prev.map(a => a.id === updated.id ? updated : a));
      } else {
        const updatePos = (p: AufmassRoomPosition) => {
          if (p.positionId === editReasonModal.positionId || p.posNr === editReasonModal.positionId) {
            return { ...p, reason: editReasonText, causedBy: editCausedBy };
          }
          return p;
        };
        const updatedRoomsData = selectedAufmass.roomsData.map(r => {
          if (r.roomId !== editReasonModal.roomId) return r;
          return {
            ...r,
            positions: r.positions.map(updatePos),
            plannedPositions: r.plannedPositions?.map(updatePos),
            specialPositions: r.specialPositions?.map(updatePos)
          };
        });
        const updatedDoc = { ...selectedAufmass, roomsData: updatedRoomsData };
        setSelectedAufmass(updatedDoc);
        setAufmasse(prev => prev.map(a => a.id === updatedDoc.id ? updatedDoc : a));
      }
      setEditReasonModal(null);
    } catch (err: any) {
      console.error('Error saving reason:', err);
      alert('Fehler beim Speichern der Begründung: ' + (err.message || err));
    } finally {
      setIsSavingReason(false);
    }
  };

  // Live preview snapshot when creating a new Aufmaß
  const previewSnapshot = useMemo(() => {
    if (!isCreateModalOpen || !dateTo || !customDateFrom) return null;
    try {
      return calculateAufmassSnapshot(
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
    } catch (e) {
      console.error('Error calculating preview snapshot:', e);
      return null;
    }
  }, [isCreateModalOpen, project, positions, rooms, bookings, alerts, addendums, customDateFrom, dateTo, creatorName, notes, latestSavedAufmass]);

  // Filtered Summary in Detail View
  const filteredSummaryItems = useMemo(() => {
    if (!selectedAufmass) return [];
    let items = selectedAufmass.summaryItems;
    if (onlyInstalled) {
      items = items.filter(item => (Number(item.totalInstalledUpToDate) || 0) > 0 || (Number(item.periodInstalledQty) || 0) > 0);
    }
    if (!searchTerm.trim()) return items;
    const term = searchTerm.toLowerCase();
    return items.filter(item => 
      item.posNr.toLowerCase().includes(term) ||
      item.shortText.toLowerCase().includes(term) ||
      (item.group && item.group.toLowerCase().includes(term))
    );
  }, [selectedAufmass, searchTerm, onlyInstalled]);

  // Filtered Rooms in Detail View
  const filteredRoomsData = useMemo(() => {
    if (!selectedAufmass) return [];
    let list = selectedAufmass.roomsData;
    if (selectedRoomFilter !== 'all') {
      list = list.filter(r => r.roomId === selectedRoomFilter);
    }
    if (onlyInstalled) {
      const isInstalled = (p: AufmassRoomPosition) => (Number(p.totalInstalledToDate) || 0) > 0 || (Number(p.installedInPeriod) || 0) > 0;
      list = list.map(r => ({
        ...r,
        positions: r.positions.filter(isInstalled),
        plannedPositions: (r.plannedPositions || []).filter(isInstalled),
        specialPositions: (r.specialPositions || []).filter(isInstalled)
      })).filter(r => r.positions.length > 0 || (r.plannedPositions && r.plannedPositions.length > 0) || (r.specialPositions && r.specialPositions.length > 0));
    }
    if (!searchTerm.trim()) return list;
    const term = searchTerm.toLowerCase();
    return list.filter(r => 
      r.roomName.toLowerCase().includes(term) ||
      r.roomCode.toLowerCase().includes(term) ||
      r.floor.toLowerCase().includes(term) ||
      r.positions.some(p => p.shortText.toLowerCase().includes(term) || p.posNr.toLowerCase().includes(term)) ||
      (r.specialPositions && r.specialPositions.some(p => p.shortText.toLowerCase().includes(term) || p.posNr.toLowerCase().includes(term) || (p.reason && p.reason.toLowerCase().includes(term))))
    );
  }, [selectedAufmass, selectedRoomFilter, searchTerm, onlyInstalled]);

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

          {/* Action Buttons Top Right: Send, Excel, PDF, Discard */}
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => handleSendAufmassEmail(selectedAufmass)}
              className="flex items-center space-x-2 bg-[#3B82C4] hover:bg-[#2B6EB0] text-white px-3.5 py-2 rounded-xl text-xs font-bold shadow-sm transition-all hover:scale-[1.01] active:scale-[0.99] cursor-pointer"
              title="Aufmaß per E-Mail an kfm. Leitung versenden (Excel & PDF werden generiert)"
            >
              <Mail className="w-4 h-4" />
              <span>Aufmaß verschicken</span>
            </button>
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
                {filteredSummaryItems.length}
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
                {filteredRoomsData.length}
              </span>
            </button>
          </div>

          <div className="flex flex-wrap items-center gap-3">
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
                const pct = getAufmassRoomPercent(r);
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
                    <span className={`text-[10px] ${isActive ? 'text-blue-100 font-extrabold' : 'text-slate-600 font-bold'}`}>
                      {pct}%
                    </span>
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
                const plannedList = (room.plannedPositions && room.plannedPositions.length > 0)
                  ? room.plannedPositions
                  : room.positions.filter(p => !p.isOverconsumption && !p.isExtraPosition && ((Number(p.totalInstalledToDate) || 0) > 0 || (Number(p.installedInPeriod) || 0) > 0));

                const specialList = (room.specialPositions && room.specialPositions.length > 0)
                  ? room.specialPositions
                  : room.positions.filter(p => (p.isOverconsumption || p.isExtraPosition) && ((Number(p.totalInstalledToDate) || 0) > 0 || (Number(p.installedInPeriod) || 0) > 0));

                const term = searchTerm.toLowerCase().trim();
                const displayedPlanned = term
                  ? plannedList.filter(p => p.shortText.toLowerCase().includes(term) || p.posNr.toLowerCase().includes(term))
                  : plannedList;

                const displayedSpecial = term
                  ? specialList.filter(p => p.shortText.toLowerCase().includes(term) || p.posNr.toLowerCase().includes(term) || (p.reason && p.reason.toLowerCase().includes(term)) || (p.causedBy && p.causedBy.toLowerCase().includes(term)))
                  : specialList;

                const pct = getAufmassRoomPercent(room);

                return (
                  <div key={room.roomId} className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden space-y-0">
                    {/* Room Header */}
                    <div className="bg-slate-50 p-4 border-b border-slate-200 flex flex-wrap items-center justify-between gap-3">
                      <div className="flex items-center space-x-2.5">
                        <span className="font-mono text-xs font-bold bg-[#3B82C4] text-white px-2.5 py-0.5 rounded">
                          {room.roomCode}
                        </span>
                        <h3 className="font-bold text-slate-900 text-sm">
                          {room.roomName}
                        </h3>
                        <span className="inline-flex items-center text-xs font-bold text-slate-900 bg-slate-200/90 border border-slate-300 px-2.5 py-0.5 rounded-md shadow-xs">
                          <strong>{pct}% fertiggestellt</strong>
                        </span>
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
                        <span className="inline-flex items-center space-x-1 text-[11px] font-bold text-emerald-800 bg-emerald-50 border border-emerald-200 px-2.5 py-0.5 rounded-full">
                          <span>{plannedList.length} Planmäßig verbaut</span>
                        </span>
                        {specialList.length > 0 && (
                          <span className="inline-flex items-center space-x-1 text-[11px] font-bold text-amber-800 bg-amber-100 border border-amber-200 px-2.5 py-0.5 rounded-full">
                            <AlertTriangle className="w-3 h-3 text-amber-600" />
                            <span>{specialList.length} Sonderposten</span>
                          </span>
                        )}
                      </div>
                    </div>

                    {/* SECTION 1: Planmäßig verbaut (laut Plan) */}
                    <div className="border-b border-slate-200">
                      <div className="bg-slate-100/80 px-4 py-2 border-b border-slate-200 flex items-center justify-between">
                        <div className="flex items-center space-x-2">
                          <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                          <span className="font-bold text-xs text-slate-800 uppercase tracking-wide">
                            1. Planmäßig verbaut (laut Plan)
                          </span>
                        </div>
                        <span className="text-[11px] font-bold text-slate-600 bg-white border border-slate-200 px-2 py-0.5 rounded-full">
                          {displayedPlanned.length} Positionen
                        </span>
                      </div>

                      {displayedPlanned.length === 0 ? (
                        <div className="py-4 text-center text-xs text-slate-400 italic">
                          Keine planmäßigen Positionen in diesem Raum verbaut.
                        </div>
                      ) : (
                        <div className="overflow-x-auto">
                          <table className="w-full text-left border-collapse text-xs table-fixed min-w-[850px]">
                            <thead>
                              <tr className="bg-slate-50 text-slate-500 text-[11px] font-semibold uppercase border-b border-slate-200">
                                <th className="py-2 px-3.5 w-28">Pos-Nr</th>
                                <th className="py-2 px-3.5 w-[38%] min-w-[220px]">Materialbezeichnung</th>
                                <th className="py-2 px-3.5 w-24 text-right">Plan (Raum)</th>
                                <th className="py-2 px-3.5 w-28 text-right">Im Zeitraum</th>
                                <th className="py-2 px-3.5 w-28 text-right">Kumuliert verbaut</th>
                                <th className="py-2 px-3.5 w-16 text-center">Einheit</th>
                                <th className="py-2 px-3.5 w-28 text-center">Status</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                              {displayedPlanned.map((pos) => (
                                <tr key={`planned_${pos.positionId || pos.posNr}`} className="hover:bg-slate-50/80 transition-colors">
                                  <td className="py-2.5 px-3.5 font-mono font-bold text-[#3B82C4]">
                                    {pos.posNr}
                                  </td>
                                  <td className="py-2.5 px-3.5">
                                    <div className="font-semibold text-slate-900 break-words whitespace-normal leading-snug">
                                      {pos.shortText}
                                    </div>
                                  </td>
                                  <td className="py-2.5 px-3.5 text-right font-medium text-slate-600">
                                    {pos.plannedQty}
                                  </td>
                                  <td className="py-2.5 px-3.5 text-right font-bold text-blue-600 bg-blue-50/20">
                                    {pos.installedInPeriod > 0 ? `${pos.installedInPeriod}` : <span className="text-slate-400 font-normal">–</span>}
                                  </td>
                                  <td className="py-2.5 px-3.5 text-right font-bold text-slate-900">
                                    {pos.totalInstalledToDate}
                                  </td>
                                  <td className="py-2.5 px-3.5 text-center text-slate-500">
                                    {pos.qu}
                                  </td>
                                  <td className="py-2.5 px-3.5 text-center">
                                    {pos.totalInstalledToDate >= pos.plannedQty ? (
                                      <span className="inline-flex items-center space-x-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-700 border border-emerald-200">
                                        <Check className="w-3 h-3 text-emerald-600" />
                                        <span>100% Plan</span>
                                      </span>
                                    ) : (
                                      <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-blue-50 text-blue-700 border border-blue-200">
                                        Teilverbau
                                      </span>
                                    )}
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </div>

                    {/* SECTION 2: Sonderposten (Zusätzlich verbaut) */}
                    <div>
                      <div className="bg-amber-50/70 px-4 py-2 border-b border-amber-200/70 flex items-center justify-between">
                        <div className="flex items-center space-x-2">
                          <AlertTriangle className="w-4 h-4 text-amber-600" />
                          <span className="font-bold text-xs text-amber-900 uppercase tracking-wide">
                            2. Sonderposten (Zusätzlich verbaut / Mehrverbrauch)
                          </span>
                        </div>
                        <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full border ${
                          displayedSpecial.length > 0
                            ? 'bg-amber-100 text-amber-800 border-amber-300'
                            : 'bg-white text-slate-500 border-slate-200'
                        }`}>
                          {displayedSpecial.length} Sonderposten
                        </span>
                      </div>

                      {displayedSpecial.length === 0 ? (
                        <div className="py-3.5 bg-slate-50/40 text-center text-xs text-slate-400 italic">
                          Keine Sonderposten oder Mehrverbräuche in diesem Raum.
                        </div>
                      ) : (
                        <div className="overflow-x-auto">
                          <table className="w-full text-left border-collapse text-xs table-fixed min-w-[950px]">
                            <thead>
                              <tr className="bg-amber-50/30 text-amber-900 text-[11px] font-semibold uppercase border-b border-amber-200/50">
                                <th className="py-2 px-3.5 w-28">Pos-Nr</th>
                                <th className="py-2 px-3.5 w-[26%] min-w-[200px]">Materialbezeichnung</th>
                                <th className="py-2 px-3.5 w-28 text-center">Art</th>
                                <th className="py-2 px-3.5 w-24 text-right">Im Zeitraum</th>
                                <th className="py-2 px-3.5 w-24 text-right">Zusätzlich</th>
                                <th className="py-2 px-3.5 w-28 text-center">Verursacher</th>
                                <th className="py-2 px-3.5 w-[30%] min-w-[220px]">Begründung & Korrektur</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-amber-100/60 bg-amber-50/10">
                              {displayedSpecial.map((pos) => {
                                const causedBy = pos.causedBy || 'Monteur';
                                const causedBadgeClass = 
                                  causedBy === 'Monteur' ? 'bg-slate-100 text-slate-800 border-slate-300' :
                                  causedBy === 'Kunde' ? 'bg-orange-100 text-orange-800 border-orange-300' :
                                  causedBy === 'Architekt' ? 'bg-purple-100 text-purple-800 border-purple-300' :
                                  'bg-blue-100 text-blue-800 border-blue-300';

                                return (
                                  <tr key={`special_${pos.positionId || pos.posNr}`} className="hover:bg-amber-50/40 transition-colors">
                                    <td className="py-3 px-3.5 font-mono font-bold text-[#3B82C4]">
                                      {pos.posNr}
                                    </td>
                                    <td className="py-3 px-3.5">
                                      <div className="font-semibold text-slate-900 break-words whitespace-normal leading-snug">
                                        {pos.shortText}
                                      </div>
                                    </td>
                                    <td className="py-3 px-3.5 text-center">
                                      {pos.specialType === 'mehrverbrauch' ? (
                                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-red-100 text-red-700 border border-red-200">
                                          Mehrverbrauch
                                        </span>
                                      ) : pos.specialType === 'zusatzmaterial' ? (
                                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-purple-100 text-purple-700 border border-purple-200">
                                          Zusatzmaterial
                                        </span>
                                      ) : (
                                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800 border border-amber-200">
                                          Sonderposten
                                        </span>
                                      )}
                                    </td>
                                    <td className="py-3 px-3.5 text-right font-medium text-slate-700">
                                      {pos.installedInPeriod > 0 ? `+${pos.installedInPeriod} ${pos.qu}` : <span className="text-slate-400 font-normal">–</span>}
                                    </td>
                                    <td className="py-3 px-3.5 text-right font-bold text-red-600">
                                      +{pos.excessQty || pos.totalInstalledToDate} {pos.qu}
                                    </td>
                                    <td className="py-3 px-3.5 text-center">
                                      <span className={`inline-block px-2 py-0.5 rounded-md text-[10px] font-bold border ${causedBadgeClass}`}>
                                        {causedBy}
                                      </span>
                                    </td>
                                    <td className="py-3 px-3.5">
                                      <div className="flex items-center justify-between gap-2">
                                        <div className="text-[11px] text-slate-800 break-words whitespace-normal leading-snug">
                                          {pos.reason ? (
                                            <span className="italic">„{pos.reason}“</span>
                                          ) : (
                                            <span className="text-slate-400 italic">Keine Begründung angegeben</span>
                                          )}
                                        </div>
                                        <button
                                          type="button"
                                          onClick={() => handleOpenEditReason(room.roomId, room.roomName, pos)}
                                          className="inline-flex items-center space-x-1 px-2 py-1 rounded-lg text-[10px] font-bold bg-blue-50 text-[#3B82C4] hover:bg-blue-100 hover:text-blue-700 border border-blue-200 transition-colors shrink-0 cursor-pointer shadow-2xs"
                                          title="Begründung und Verursacher bearbeiten"
                                        >
                                          <Pencil className="w-3 h-3" />
                                          <span>Bearbeiten</span>
                                        </button>
                                      </div>
                                    </td>
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        </div>
                      )}
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

        {/* Modal: Sonderposten-Begründung bearbeiten */}
        {editReasonModal && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-xs z-50 flex items-center justify-center p-4">
            <div className="bg-white w-full max-w-lg rounded-2xl shadow-2xl border border-slate-200 overflow-hidden animate-in fade-in zoom-in-95 duration-150">
              <div className="bg-[#1C2A3B] text-white p-5 flex items-center justify-between">
                <div>
                  <span className="text-xs font-bold text-[#3B82C4] uppercase tracking-wider block">
                    Aufmaß-Korrektur & VOB-Dokumentation
                  </span>
                  <h3 className="text-base font-bold text-white mt-0.5">
                    Begründung & Verursacher bearbeiten
                  </h3>
                </div>
                <button
                  type="button"
                  onClick={() => setEditReasonModal(null)}
                  className="text-slate-400 hover:text-white transition-colors text-lg cursor-pointer"
                >
                  ✕
                </button>
              </div>

              <form onSubmit={handleSaveReason} className="p-6 space-y-4 text-xs">
                {/* Position / Raum Details */}
                <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 space-y-1">
                  <div className="flex items-center justify-between text-slate-500 text-[11px]">
                    <span>Raum: <strong className="text-slate-800">{editReasonModal.roomName}</strong></span>
                    <span className="font-mono font-bold text-[#3B82C4]">{editReasonModal.posNr}</span>
                  </div>
                  <div className="font-bold text-slate-900 text-sm">
                    {editReasonModal.shortText}
                  </div>
                </div>

                {/* Verursacher Picker */}
                <div>
                  <label className="block font-semibold text-slate-700 mb-1.5">
                    Verursacher / Auslöser der Abweichung *
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    {[
                      { id: 'Monteur', label: 'Monteur', desc: 'Bruch bei Montage, Verschnitt' },
                      { id: 'Kunde', label: 'Kunde', desc: 'Änderungswunsch Kunde / Bauherr' },
                      { id: 'Architekt', label: 'Architekt', desc: 'Planänderung Architekt / Planer' },
                      { id: 'Bauleitung', label: 'Bauleitung', desc: 'Planungsabweichung / GAEB vs DWG' }
                    ].map(opt => (
                      <button
                        key={opt.id}
                        type="button"
                        onClick={() => setEditCausedBy(opt.id)}
                        className={`p-2.5 rounded-xl border text-left transition-all cursor-pointer ${
                          editCausedBy === opt.id
                            ? 'border-[#3B82C4] bg-blue-50/60 ring-2 ring-blue-500/20'
                            : 'border-slate-200 bg-white hover:bg-slate-50'
                        }`}
                      >
                        <div className="font-bold text-slate-900 text-xs">{opt.label}</div>
                        <div className="text-[10px] text-slate-500 mt-0.5 leading-tight">{opt.desc}</div>
                      </button>
                    ))}
                  </div>
                  <span className="text-[11px] text-slate-400 mt-1 block">
                    Hinweis: Keine Personennamen verwenden – neutrale Rollenbezeichnung nach VOB.
                  </span>
                </div>

                {/* Begründung Textarea */}
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Offizielle Begründung (erscheint auf PDF & Excel) *
                  </label>
                  <textarea
                    rows={3}
                    required
                    value={editReasonText}
                    onChange={(e) => setEditReasonText(e.target.value)}
                    placeholder="z. B. Bruch bei Montage (ersetzt durch Monteur) oder Änderungswunsch Kunde vor Ort..."
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#3B82C4]"
                  />
                  <div className="bg-amber-50/70 border border-amber-200 rounded-lg p-2.5 mt-1.5 text-[11px] text-amber-900 leading-snug">
                    <strong>Tipp:</strong> Monteursnotizen (z. B. auf polnisch wie <em>„złamana rura“</em>) können hier in eine saubere deutsche Begründung (z. B. <em>„Bruch bei Montage, ersetzt“</em>) übersetzt und korrigiert werden.
                  </div>
                </div>

                {/* Actions */}
                <div className="pt-3 border-t border-slate-200 flex items-center justify-end space-x-3">
                  <button
                    type="button"
                    disabled={isSavingReason}
                    onClick={() => setEditReasonModal(null)}
                    className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-semibold transition-colors cursor-pointer"
                  >
                    Abbrechen
                  </button>
                  <button
                    type="submit"
                    disabled={isSavingReason}
                    className="px-5 py-2 bg-[#3B82C4] hover:bg-blue-600 text-white rounded-xl font-bold shadow-md shadow-blue-500/20 transition-all flex items-center space-x-2 cursor-pointer disabled:opacity-50"
                  >
                    {isSavingReason ? (
                      <span>Wird gespeichert...</span>
                    ) : (
                      <>
                        <Check className="w-4 h-4" />
                        <span>Begründung speichern</span>
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
                    onClick={() => {
                      setSelectedAufmass(aufmass);
                      setDetailTab('rooms');
                    }}
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
                        {aufmass.summaryItems.length} verbaute Positionen
                      </div>
                      <div className="text-[11px] text-slate-500">
                        in {aufmass.roomsData.length} bearbeiteten Räumen
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
                          onClick={(e) => handleSendAufmassEmail(aufmass, e)}
                          className="flex items-center space-x-1 bg-[#3B82C4] hover:bg-[#2B6EB0] text-white px-2.5 py-1.5 rounded-lg text-[11px] font-bold shadow-xs transition-all cursor-pointer"
                          title="Aufmaß per E-Mail an kfm. Leitung versenden"
                        >
                          <Mail className="w-3.5 h-3.5" />
                          <span>Aufmaß verschicken</span>
                        </button>

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
                          onClick={() => {
                            setSelectedAufmass(aufmass);
                            setDetailTab('rooms');
                          }}
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
          <div className="bg-white w-full max-w-3xl rounded-2xl shadow-2xl border border-slate-200 overflow-hidden animate-in fade-in zoom-in-95 duration-150 max-h-[92vh] flex flex-col">
            
            {/* Modal Header */}
            <div className="bg-[#1C2A3B] text-white p-5 flex items-center justify-between shrink-0">
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
            <form onSubmit={handleCreateSubmit} className="flex-1 overflow-y-auto p-6 space-y-4 text-xs">
              
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

              {/* Form Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                <div className="bg-blue-50/70 border-2 border-[#3B82C4] rounded-xl p-3">
                  <label className="block font-bold text-[#1C2A3B] mb-1">
                    Stichtag der Abrechnung *
                  </label>
                  <input
                    type="date"
                    required
                    autoFocus
                    value={dateTo}
                    onChange={(e) => setDateTo(e.target.value)}
                    className="w-full px-3 py-1.5 bg-white border border-[#3B82C4] rounded-lg font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#3B82C4]"
                  />
                  <span className="text-[10px] text-slate-500 mt-1 block">
                    Bis zu diesem Tag kumulierte Verbauungen.
                  </span>
                </div>

                <div className="bg-slate-50 border border-slate-200 rounded-xl p-3">
                  <label className="block font-semibold text-slate-700 mb-1">
                    Beginn des Zeitraums (Von-Datum) *
                  </label>
                  <input
                    type="date"
                    required
                    value={customDateFrom}
                    onChange={(e) => setCustomDateFrom(e.target.value)}
                    className="w-full px-3 py-1.5 bg-white border border-slate-200 rounded-lg font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#3B82C4]"
                  />
                  <span className="text-[10px] text-slate-400 mt-1 block">
                    Automatisch abgeleitet aus dem Voraufmaß.
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
                  <input
                    type="text"
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#3B82C4]"
                    placeholder="z. B. Abschlagsaufmaß Nr. 1"
                  />
                </div>
              </div>

              {/* LIVE PREVIEW SECTION */}
              <div className="border border-slate-200 rounded-xl overflow-hidden bg-slate-50/50">
                <div className="p-3 bg-slate-100 border-b border-slate-200 flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center space-x-2">
                    <Eye className="w-4 h-4 text-[#3B82C4]" />
                    <span className="font-bold text-xs text-slate-900">
                      Vorschau des Aufmaßes (wird erfasst)
                    </span>
                  </div>
                  <div className="flex flex-wrap items-center gap-1.5 text-[11px]">
                    <span className="font-bold text-slate-800 bg-white border border-slate-200 px-2 py-0.5 rounded-full">
                      {previewSnapshot?.summaryItems.length || 0} verbaute Positionen
                    </span>
                    <span className="font-medium text-slate-600 bg-white border border-slate-200 px-2 py-0.5 rounded-full">
                      in {previewSnapshot?.roomsData.length || 0} bearbeiteten Räumen
                    </span>
                    {(previewSnapshot?.roomsData.reduce((acc, r) => acc + (r.specialPositions?.length || 0), 0) || 0) > 0 && (
                      <span className="font-bold text-amber-800 bg-amber-100 border border-amber-300 px-2 py-0.5 rounded-full">
                        {previewSnapshot?.roomsData.reduce((acc, r) => acc + (r.specialPositions?.length || 0), 0)} Sonderposten
                      </span>
                    )}
                  </div>
                </div>

                <div className="p-3 max-h-56 overflow-y-auto space-y-3">
                  {!previewSnapshot || previewSnapshot.roomsData.length === 0 ? (
                    <div className="py-6 text-center text-slate-400 italic">
                      Keine verbauten Positionen bis zum Stichtag {new Date(dateTo).toLocaleDateString('de-DE')} vorhanden.
                    </div>
                  ) : (
                    previewSnapshot.roomsData.map(room => {
                      const planned = room.plannedPositions || [];
                      const special = room.specialPositions || [];
                      return (
                        <div key={`preview_${room.roomId}`} className="bg-white rounded-lg border border-slate-200 p-2.5 space-y-2">
                          <div className="flex items-center justify-between text-xs font-bold text-slate-900 border-b border-slate-100 pb-1">
                            <div className="flex items-center space-x-2">
                              <span className="font-mono text-[10px] bg-[#3B82C4] text-white px-1.5 py-0.2 rounded">
                                {room.roomCode}
                              </span>
                              <span>{room.roomName}</span>
                              <span className="text-[10px] font-normal text-slate-400">(Etage: {room.floor})</span>
                            </div>
                            <div className="text-[10px] space-x-2 text-slate-500 font-normal">
                              <span>{planned.length} planmäßig</span>
                              {special.length > 0 && (
                                <span className="text-amber-700 font-bold">• {special.length} Sonderposten</span>
                              )}
                            </div>
                          </div>

                          {/* Planmäßig verbaut */}
                          {planned.length > 0 && (
                            <div className="space-y-0.5">
                              <div className="text-[10px] font-bold text-slate-600 uppercase tracking-wide flex items-center space-x-1">
                                <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                                <span>Planmäßig verbaut ({planned.length})</span>
                              </div>
                              <div className="divide-y divide-slate-100">
                                {planned.map(p => (
                                  <div key={`prev_p_${p.positionId || p.posNr}`} className="flex items-center justify-between py-0.5 text-[11px]">
                                    <div className="flex items-center space-x-1.5 truncate pr-2">
                                      <span className="font-mono text-slate-400 shrink-0 text-[10px]">{p.posNr}</span>
                                      <span className="text-slate-800 truncate">{p.shortText}</span>
                                    </div>
                                    <div className="font-bold text-slate-900 shrink-0">
                                      {p.totalInstalledToDate} {p.qu}
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}

                          {/* Sonderposten */}
                          {special.length > 0 && (
                            <div className="space-y-0.5 pt-1 border-t border-slate-100">
                              <div className="text-[10px] font-bold text-amber-800 uppercase tracking-wide flex items-center space-x-1">
                                <AlertTriangle className="w-3 h-3 text-amber-600" />
                                <span>Sonderposten ({special.length})</span>
                              </div>
                              <div className="divide-y divide-amber-100/60 bg-amber-50/20 rounded p-1.5">
                                {special.map(p => (
                                  <div key={`prev_s_${p.positionId || p.posNr}`} className="py-0.5 text-[11px] space-y-0.5">
                                    <div className="flex items-center justify-between">
                                      <div className="flex items-center space-x-1.5 truncate pr-2">
                                        <span className="font-mono text-slate-400 shrink-0 text-[10px]">{p.posNr}</span>
                                        <span className="text-slate-800 font-semibold truncate">{p.shortText}</span>
                                      </div>
                                      <div className="font-bold text-red-600 shrink-0">
                                        +{p.excessQty || p.totalInstalledToDate} {p.qu}
                                      </div>
                                    </div>
                                    <div className="flex items-center space-x-2 text-[10px] text-slate-500">
                                      <span className="bg-slate-100 text-slate-700 px-1.5 py-0.2 rounded font-bold">
                                        {p.causedBy || 'Monteur'}
                                      </span>
                                      {p.reason && (
                                        <span className="italic text-slate-600 truncate">
                                          {p.reason}
                                        </span>
                                      )}
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })
                  )}
                </div>
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
              <div className="pt-3 border-t border-slate-200 flex items-center justify-end space-x-3 shrink-0">
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

      {/* Modal: E-Mail verschickt & Dateien heruntergeladen */}
      {emailSentModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-lg rounded-2xl shadow-2xl border border-slate-200 p-6 space-y-4 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center space-x-3 text-[#3B82C4]">
              <div className="w-12 h-12 rounded-xl bg-blue-50 border border-blue-200 flex items-center justify-center text-[#3B82C4]">
                <Mail className="w-6 h-6" />
              </div>
              <div>
                <h3 className="font-bold text-slate-900 text-base">Aufmaß per E-Mail versenden</h3>
                <p className="text-xs text-slate-500">
                  Empfänger: <strong>{emailSentModal.managerFirstName} ({emailSentModal.managerEmail})</strong>
                </p>
              </div>
            </div>

            <div className="space-y-2.5 text-xs text-slate-700 bg-slate-50 border border-slate-200 rounded-xl p-3.5">
              <div className="flex items-center space-x-2 text-emerald-700 font-bold">
                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                <span>E-Mail-Programm aufgerufen & Dateien bereitgestellt:</span>
              </div>
              <ul className="pl-6 list-disc space-y-1 text-slate-600">
                <li><span className="font-semibold text-slate-800">Excel-Datei (.xlsx)</span> im Download-Ordner</li>
                <li><span className="font-semibold text-slate-800">PDF-Aufmaß (.pdf)</span> im Download-Ordner</li>
              </ul>
              <p className="text-[11px] text-slate-500 pt-1 border-t border-slate-200">
                💡 <strong>Hinweis zum Anhang:</strong> Aus Sicherheitsgründen dürfen Web-Browser Dateien nicht direkt in Desktop-Mailprogramme einfügen. Ziehe die beiden heruntergeladenen Dateien einfach kurz per Drag & Drop in die geöffnete E-Mail.
              </p>
            </div>

            <div className="space-y-1.5">
              <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">
                Vorbereiteter E-Mail-Text:
              </span>
              <pre className="p-2.5 bg-slate-100 border border-slate-200 rounded-lg text-[10.5px] text-slate-800 whitespace-pre-wrap font-sans max-h-36 overflow-y-auto leading-relaxed">
                {emailSentModal.body}
              </pre>
            </div>

            <div className="flex items-center justify-between pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => {
                  navigator.clipboard.writeText(emailSentModal.body);
                  alert('E-Mail-Text in Zwischenablage kopiert!');
                }}
                className="px-3 py-1.5 rounded-lg text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 transition-colors cursor-pointer"
              >
                Text kopieren
              </button>

              <div className="flex items-center space-x-2">
                <button
                  type="button"
                  onClick={() => {
                    const mailLink = document.createElement('a');
                    mailLink.href = emailSentModal.mailtoUrl;
                    document.body.appendChild(mailLink);
                    mailLink.click();
                    document.body.removeChild(mailLink);
                  }}
                  className="px-3.5 py-2 rounded-xl text-xs font-bold text-[#3B82C4] bg-blue-50 hover:bg-blue-100 border border-blue-200 transition-all cursor-pointer"
                >
                  E-Mail erneut öffnen
                </button>
                <button
                  type="button"
                  onClick={() => setEmailSentModal(null)}
                  className="px-4 py-2 rounded-xl text-xs font-bold bg-[#1C2A3B] hover:bg-slate-900 text-white shadow-xs transition-all cursor-pointer"
                >
                  Fertig
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
