import React, { useState, useEffect } from 'react';
import type { Room, Position } from '../types';
import { 
  X, 
  CheckCircle2, 
  RotateCcw, 
  Download, 
  ArrowUpRight, 
  ArrowDownRight, 
  Layers, 
  Check, 
  AlertCircle,
  Camera,
  Eye,
  ChevronLeft,
  ChevronRight
} from 'lucide-react';
import { completeRoom, updateRoomMaterialActual } from '../services/firestoreService';
import { exportRoomVobAufmassToExcel } from '../services/excelExporter';

interface RoomDetailModalProps {
  projectId: string;
  projectName: string;
  room: Room | null;
  positions: Position[];
  photos?: string[];
  isOpen: boolean;
  onClose: () => void;
}

export const RoomDetailModal: React.FC<RoomDetailModalProps> = ({
  projectId,
  projectName,
  room,
  positions,
  photos = [],
  isOpen,
  onClose
}) => {
  const [editingPosId, setEditingPosId] = useState<string | null>(null);
  const [tempActualVal, setTempActualVal] = useState<number>(0);
  const [isUpdatingStatus, setIsUpdatingStatus] = useState<boolean>(false);
  const [activePhotoIdx, setActivePhotoIdx] = useState<number | null>(null);

  useEffect(() => {
    if (activePhotoIdx === null) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setActivePhotoIdx(null);
      else if (e.key === 'ArrowLeft' && photos.length > 0) {
        setActivePhotoIdx(prev => prev !== null ? (prev - 1 + photos.length) % photos.length : 0);
      } else if (e.key === 'ArrowRight' && photos.length > 0) {
        setActivePhotoIdx(prev => prev !== null ? (prev + 1) % photos.length : 0);
      }
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [activePhotoIdx, photos.length]);

  if (!isOpen || !room) return null;

  const posMap = new Map(positions.map(p => [p.id, p]));
  const isCompleted = room.status === 'completed';

  // Calculate totals
  let totalPlannedValue = 0;
  let totalActualValue = 0;
  let totalSavingsValue = 0; // Minderverbrauch (Ersparnis)
  let totalSurchargeValue = 0; // Mehrverbrauch (Sonderposten)

  const materialsWithDelta = (room.materials || []).map(mat => {
    const pos = posMap.get(mat.positionId);
    const unitPrice = mat.unitPrice || pos?.unitPrice || 0;
    const planned = mat.plannedQty || 0;
    const actual = mat.actualQty ?? planned;
    const qtyDelta = planned - actual; // >0 Minderverbrauch (Ersparnis), <0 Mehrverbrauch
    
    const plannedTotal = planned * unitPrice;
    const actualTotal = actual * unitPrice;

    totalPlannedValue += plannedTotal;
    totalActualValue += actualTotal;

    if (qtyDelta > 0) {
      totalSavingsValue += qtyDelta * unitPrice;
    } else if (qtyDelta < 0) {
      totalSurchargeValue += Math.abs(qtyDelta) * unitPrice;
    }

    return {
      ...mat,
      unitPrice,
      actual,
      qtyDelta,
      plannedTotal,
      actualTotal
    };
  });

  const handleToggleCompletion = async () => {
    setIsUpdatingStatus(true);
    try {
      await completeRoom(projectId, room.id, !isCompleted);
    } finally {
      setIsUpdatingStatus(false);
    }
  };

  const handleStartEditActual = (positionId: string, currentActual: number) => {
    setEditingPosId(positionId);
    setTempActualVal(currentActual);
  };

  const handleSaveActual = async (positionId: string) => {
    await updateRoomMaterialActual(projectId, room.id, positionId, tempActualVal);
    setEditingPosId(null);
  };

  const handleExportVob = () => {
    exportRoomVobAufmassToExcel(room, positions, projectName);
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 sm:p-6 overflow-y-auto">
      <div className="bg-white w-full max-w-5xl rounded-2xl shadow-2xl border border-slate-200 overflow-hidden my-8 animate-in fade-in zoom-in-95 duration-150 flex flex-col max-h-[90vh]">
        
        {/* Header */}
        <div className="bg-[#1C2A3B] text-white p-5 sm:p-6 flex items-start justify-between">
          <div className="space-y-1">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-mono text-xs font-bold bg-[#3B82C4] px-2.5 py-0.5 rounded text-white shadow-sm">
                {room.code}
              </span>
              <span className="text-xs text-slate-300 font-semibold bg-slate-800 px-2 py-0.5 rounded">
                Etage: {room.floor}
              </span>
              {isCompleted ? (
                <span className="flex items-center space-x-1.5 text-xs font-bold bg-emerald-500 text-white px-3 py-0.5 rounded-full shadow-sm">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>100% Fertiggestellt</span>
                </span>
              ) : (
                <span className="text-xs font-semibold bg-amber-500/20 text-amber-300 border border-amber-500/40 px-3 py-0.5 rounded-full">
                  In Ausführung ({room.progressPercent || 0}%)
                </span>
              )}
            </div>
            <h2 className="text-xl sm:text-2xl font-bold text-white tracking-wide">
              {room.name}
            </h2>
            <p className="text-xs text-slate-400">
              VOB-Raumabschluss & Mengen-Delta (Soll vs. Ist Vergleich für ToolTime Abrechnung)
            </p>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Action Bar & Metric Cards */}
        <div className="p-5 sm:p-6 bg-slate-50 border-b border-slate-200 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            {/* Completion Button */}
            <div className="flex items-center space-x-2">
              {isCompleted ? (
                <button
                  disabled={isUpdatingStatus}
                  onClick={handleToggleCompletion}
                  className="flex items-center space-x-1.5 bg-slate-200 hover:bg-slate-300 text-slate-700 px-3.5 py-2 rounded-xl text-xs font-bold transition-all disabled:opacity-50"
                  title="Fertigstellung aufheben und wieder in Ausführung versetzen"
                >
                  <RotateCcw className="w-4 h-4 text-slate-500" />
                  <span>Abschluss zurücknehmen</span>
                </button>
              ) : (
                <button
                  disabled={isUpdatingStatus}
                  onClick={handleToggleCompletion}
                  className="flex items-center space-x-2 bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-xl text-xs font-bold shadow-md shadow-emerald-600/20 transition-all hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50"
                  title="Raum als zu 100% fertiggestellt und abgenommen markieren"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  <span>Raum als 100% fertiggestellt markieren</span>
                </button>
              )}

              {room.completedAt && (
                <span className="text-xs text-slate-500">
                  Abgeschlossen am {new Date(room.completedAt).toLocaleDateString('de-DE')} durch {room.completedBy || 'Bauleiter'}
                </span>
              )}
            </div>

            {/* Excel Export Button */}
            <button
              onClick={handleExportVob}
              className="flex items-center space-x-2 bg-[#2FA36B] hover:bg-[#258757] text-white px-4 py-2 rounded-xl text-xs font-bold shadow-sm transition-all hover:scale-[1.02] active:scale-[0.98]"
              title="VOB-konformes Aufmaßblatt als Excel exportieren"
            >
              <Download className="w-4 h-4" />
              <span>VOB-Aufmaß exportieren (Excel)</span>
            </button>
          </div>

          {/* Metric Cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 pt-2">
            <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-sm">
              <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">
                Geplanter Wert (Soll)
              </span>
              <span className="text-lg font-black text-slate-800">
                {totalPlannedValue.toFixed(2)} €
              </span>
            </div>

            <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-sm">
              <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">
                Abrechnungswert (Ist)
              </span>
              <span className="text-lg font-black text-[#3B82C4]">
                {totalActualValue.toFixed(2)} €
              </span>
            </div>

            <div className="bg-emerald-50 p-3.5 rounded-xl border border-emerald-200 shadow-sm">
              <div className="flex items-center space-x-1 text-emerald-700">
                <ArrowDownRight className="w-3.5 h-3.5" />
                <span className="text-[11px] font-bold uppercase tracking-wider">
                  Minderverbrauch (Ersparnis)
                </span>
              </div>
              <span className="text-lg font-black text-emerald-800">
                +{totalSavingsValue.toFixed(2)} €
              </span>
              <span className="text-[10px] text-emerald-600 block mt-0.5">
                Freies Material / Lager-Retoure
              </span>
            </div>

            <div className="bg-amber-50 p-3.5 rounded-xl border border-amber-200 shadow-sm">
              <div className="flex items-center space-x-1 text-amber-700">
                <ArrowUpRight className="w-3.5 h-3.5" />
                <span className="text-[11px] font-bold uppercase tracking-wider">
                  Mehrverbrauch (Sonderposten)
                </span>
              </div>
              <span className="text-lg font-black text-amber-800">
                {totalSurchargeValue > 0 ? `+${totalSurchargeValue.toFixed(2)} €` : '0.00 €'}
              </span>
              <span className="text-[10px] text-amber-600 block mt-0.5">
                VOB-Aufmaß Nachforderung
              </span>
            </div>
          </div>
        </div>

        {/* Beweisfotos & Montage-Dokumentation Section */}
        {photos && photos.length > 0 && (
          <div className="px-5 sm:px-6 py-3.5 bg-white border-b border-slate-200">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-bold text-slate-800 flex items-center space-x-2">
                <Camera className="w-4 h-4 text-[#3B82C4]" />
                <span>Beweisfotos & Montage-Dokumentation ({photos.length})</span>
              </span>
              <span className="text-[11px] text-slate-500 font-medium">Klicken zum Vergrößern</span>
            </div>
            <div className="flex items-center gap-3 overflow-x-auto pb-1 pt-0.5 scrollbar-thin">
              {photos.map((photoUrl, pIdx) => {
                const isDeviceFile = typeof photoUrl === 'string' && photoUrl.startsWith('file://');
                return (
                  <button
                    key={pIdx}
                    type="button"
                    onClick={() => setActivePhotoIdx(pIdx)}
                    className="group relative w-16 h-16 sm:w-20 sm:h-20 rounded-xl overflow-hidden border border-slate-200 hover:border-[#3B82C4] shadow-xs shrink-0 focus:outline-none focus:ring-2 focus:ring-[#3B82C4]/40 transition-all hover:scale-105 bg-slate-100"
                    title={`Beweisfoto ${pIdx + 1} öffnen`}
                  >
                    {!isDeviceFile ? (
                      <img
                        src={photoUrl}
                        alt={`Beweisfoto ${pIdx + 1} - ${room.name}`}
                        className="w-full h-full object-cover transition-transform group-hover:scale-110"
                        loading="lazy"
                      />
                    ) : (
                      <div className="w-full h-full bg-slate-100 flex flex-col items-center justify-center p-1 text-center">
                        <Camera className="w-5 h-5 text-[#3B82C4]" />
                        <span className="text-[9px] font-bold text-slate-600 mt-1">Foto {pIdx + 1}</span>
                      </div>
                    )}
                    <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                      <Eye className="w-5 h-5 text-white drop-shadow" />
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Material Delta Table */}
        <div className="flex-1 overflow-y-auto p-5 sm:p-6">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="font-bold text-slate-900 text-sm flex items-center space-x-2">
              <Layers className="w-4 h-4 text-[#3B82C4]" />
              <span>Soll vs. Ist Materialaufstellung für diesen Raum</span>
            </h3>
            <span className="text-xs text-slate-500">
              {materialsWithDelta.length} Positionen hinterlegt
            </span>
          </div>

          {materialsWithDelta.length === 0 ? (
            <div className="bg-slate-50 border-2 border-dashed border-slate-200 rounded-xl p-8 text-center space-y-2">
              <AlertCircle className="w-8 h-8 text-slate-400 mx-auto" />
              <h4 className="font-bold text-slate-700 text-sm">Keine spezifische CAD-Stückliste vorhanden</h4>
              <p className="text-xs text-slate-500 max-w-md mx-auto">
                Für diesen Raum wurden noch keine spezifischen Positionen zugeordnet (GAEB-Fallback aktiv). 
                Sie können Positionen über den Raum-Manager zuweisen oder den Raum direkt als 100% abgeschlossen markieren.
              </p>
            </div>
          ) : (
            <div className="border border-slate-200 rounded-xl overflow-hidden shadow-sm">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-100/90 text-slate-700 font-bold border-b border-slate-200 uppercase tracking-wider text-[11px]">
                    <tr>
                      <th className="py-3 px-3">Pos-Nr</th>
                      <th className="py-3 px-3">Bezeichnung</th>
                      <th className="py-3 px-3 text-right">Soll (Plan)</th>
                      <th className="py-3 px-3 text-right">Ist (Verbaut)</th>
                      <th className="py-3 px-3">Mengen-Delta</th>
                      <th className="py-3 px-3 text-right">EP (€)</th>
                      <th className="py-3 px-3 text-right">Abrechnung (€)</th>
                      <th className="py-3 px-3 text-right">Kosten-Delta</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {materialsWithDelta.map(mat => {
                      const isEditing = editingPosId === mat.positionId;
                      const hasMinder = mat.qtyDelta > 0;
                      const hasMehr = mat.qtyDelta < 0;

                      return (
                        <tr key={mat.positionId} className="hover:bg-slate-50/80 transition-colors">
                          <td className="py-3 px-3 font-mono font-bold text-[#3B82C4] whitespace-nowrap">
                            {mat.posNr}
                          </td>
                          <td className="py-3 px-3 max-w-xs">
                            <span className="font-semibold text-slate-800 block truncate">
                              {mat.shortText}
                            </span>
                            {mat.group && (
                              <span className="text-[10px] text-slate-400">
                                {mat.group}
                              </span>
                            )}
                          </td>
                          <td className="py-3 px-3 text-right font-medium text-slate-600 whitespace-nowrap">
                            {mat.plannedQty} {mat.qu}
                          </td>
                          
                          {/* Editable Actual Quantity */}
                          <td className="py-3 px-3 text-right whitespace-nowrap">
                            {isEditing ? (
                              <div className="flex items-center justify-end space-x-1">
                                <input
                                  type="number"
                                  step="any"
                                  value={tempActualVal}
                                  onChange={(e) => setTempActualVal(parseFloat(e.target.value) || 0)}
                                  className="w-16 px-1.5 py-0.5 text-right border border-[#3B82C4] rounded font-bold text-slate-800 bg-white"
                                  autoFocus
                                />
                                <button
                                  onClick={() => handleSaveActual(mat.positionId)}
                                  className="p-1 text-emerald-600 hover:bg-emerald-50 rounded"
                                  title="Speichern"
                                >
                                  <Check className="w-3.5 h-3.5" />
                                </button>
                                <button
                                  onClick={() => setEditingPosId(null)}
                                  className="p-1 text-slate-400 hover:bg-slate-100 rounded"
                                  title="Abbrechen"
                                >
                                  <X className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            ) : (
                              <button
                                onClick={() => handleStartEditActual(mat.positionId, mat.actual)}
                                className="font-bold text-slate-900 hover:text-[#3B82C4] hover:underline cursor-pointer px-1 py-0.5 rounded"
                                title="Klicken zum Anpassen der Ist-Menge"
                              >
                                {mat.actual} {mat.qu}
                              </button>
                            )}
                          </td>

                          {/* Mengen-Delta Badge */}
                          <td className="py-3 px-3 whitespace-nowrap">
                            {hasMinder && (
                              <span className="inline-flex items-center space-x-1 text-[11px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-300 px-2 py-0.5 rounded">
                                <span>+{mat.qtyDelta} {mat.qu}</span>
                                <span className="font-normal text-[10px] hidden sm:inline">(Ersparnis)</span>
                              </span>
                            )}
                            {hasMehr && (
                              <span className="inline-flex items-center space-x-1 text-[11px] font-bold bg-red-100 text-red-800 border border-red-300 px-2 py-0.5 rounded">
                                <span>{mat.qtyDelta} {mat.qu}</span>
                                <span className="font-normal text-[10px] hidden sm:inline">(Mehraufwand)</span>
                              </span>
                            )}
                            {!hasMinder && !hasMehr && (
                              <span className="text-[11px] font-medium text-slate-400 bg-slate-100 px-2 py-0.5 rounded">
                                Punktgenau
                              </span>
                            )}
                          </td>

                          <td className="py-3 px-3 text-right font-medium text-slate-600 whitespace-nowrap">
                            {mat.unitPrice > 0 ? `${mat.unitPrice.toFixed(2)} €` : '-'}
                          </td>

                          <td className="py-3 px-3 text-right font-bold text-slate-900 whitespace-nowrap">
                            {mat.actualTotal > 0 ? `${mat.actualTotal.toFixed(2)} €` : '-'}
                          </td>

                          {/* Cost Delta */}
                          <td className="py-3 px-3 text-right font-bold whitespace-nowrap">
                            {mat.unitPrice > 0 ? (
                              hasMinder ? (
                                <span className="text-emerald-600">
                                  -{(mat.qtyDelta * mat.unitPrice).toFixed(2)} €
                                </span>
                              ) : hasMehr ? (
                                <span className="text-red-600">
                                  +{(Math.abs(mat.qtyDelta) * mat.unitPrice).toFixed(2)} €
                                </span>
                              ) : (
                                <span className="text-slate-400">0.00 €</span>
                              )
                            ) : (
                              <span className="text-slate-400">-</span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 sm:p-5 bg-slate-100 border-t border-slate-200 flex items-center justify-between">
          <div className="text-xs text-slate-500">
            {isCompleted ? (
              <span className="text-emerald-700 font-medium">
                ✓ Raumdaten verifiziert. Bereit für ToolTime Aufmaß & Schlussrechnung.
              </span>
            ) : (
              <span>
                Mengen-Änderungen werden direkt in Firestore synchronisiert.
              </span>
            )}
          </div>

          <button
            onClick={onClose}
            className="bg-slate-800 hover:bg-slate-900 text-white px-5 py-2 rounded-xl text-xs font-semibold shadow-sm transition-all"
          >
            Schließen
          </button>
        </div>
      </div>

      {/* Lightbox / Fullscreen Preview Modal */}
      {activePhotoIdx !== null && photos[activePhotoIdx] && (
        <div 
          className="fixed inset-0 z-[60] bg-black/90 backdrop-blur-md flex flex-col items-center justify-between p-4 sm:p-6 animate-in fade-in duration-200 select-none"
          onClick={() => setActivePhotoIdx(null)}
        >
          {/* Header */}
          <div 
            className="w-full max-w-5xl flex items-center justify-between text-white py-2 px-3 z-10"
            onClick={(e) => e.stopPropagation()}
          >
            <div>
              <h3 className="font-bold text-base sm:text-lg flex items-center space-x-2">
                <Camera className="w-5 h-5 text-[#3B82C4]" />
                <span>{room.name} ({room.code || 'Raum'})</span>
              </h3>
              <p className="text-xs text-slate-300">
                Beweisfoto {activePhotoIdx + 1} von {photos.length}
              </p>
            </div>
            
            <div className="flex items-center space-x-2">
              <button
                onClick={() => setActivePhotoIdx(null)}
                className="p-2 rounded-xl bg-white/10 hover:bg-white/20 text-white transition-colors"
                title="Schließen (Esc)"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Main Photo with Prev / Next Navigation */}
          <div 
            className="relative flex-1 w-full max-w-5xl flex items-center justify-center p-2 my-auto"
            onClick={(e) => e.stopPropagation()}
          >
            {photos.length > 1 && (
              <button
                onClick={() => setActivePhotoIdx((activePhotoIdx - 1 + photos.length) % photos.length)}
                className="absolute left-2 sm:left-4 z-10 p-3 rounded-full bg-black/60 hover:bg-black/80 text-white border border-white/20 shadow-lg backdrop-blur-sm transition-transform hover:scale-110 active:scale-95"
                title="Vorheriges Bild (Pfeiltaste links)"
              >
                <ChevronLeft className="w-6 h-6" />
              </button>
            )}

            <div className="max-h-[72vh] max-w-full flex items-center justify-center rounded-2xl overflow-hidden shadow-2xl bg-black/40">
              {typeof photos[activePhotoIdx] === 'string' && !photos[activePhotoIdx].startsWith('file://') ? (
                <img
                  src={photos[activePhotoIdx]}
                  alt={`Beweisfoto ${activePhotoIdx + 1}`}
                  className="max-h-[72vh] max-w-full object-contain rounded-xl"
                />
              ) : (
                <div className="p-8 text-center bg-slate-900 text-white rounded-xl max-w-md">
                  <Camera className="w-12 h-12 text-[#3B82C4] mx-auto mb-3" />
                  <h4 className="font-bold text-base">Foto auf Monteur-Smartphone erfasst</h4>
                  <p className="text-xs text-slate-400 mt-2 font-mono break-all">{photos[activePhotoIdx]}</p>
                </div>
              )}
            </div>

            {photos.length > 1 && (
              <button
                onClick={() => setActivePhotoIdx((activePhotoIdx + 1) % photos.length)}
                className="absolute right-2 sm:right-4 z-10 p-3 rounded-full bg-black/60 hover:bg-black/80 text-white border border-white/20 shadow-lg backdrop-blur-sm transition-transform hover:scale-110 active:scale-95"
                title="Nächstes Bild (Pfeiltaste rechts)"
              >
                <ChevronRight className="w-6 h-6" />
              </button>
            )}
          </div>

          {/* Bottom Thumbnails Strip */}
          {photos.length > 1 && (
            <div 
              className="w-full max-w-3xl flex items-center justify-center gap-2 overflow-x-auto py-2 px-4 z-10 scrollbar-thin"
              onClick={(e) => e.stopPropagation()}
            >
              {photos.map((p, idx) => (
                <button
                  key={idx}
                  onClick={() => setActivePhotoIdx(idx)}
                  className={`w-14 h-14 rounded-lg overflow-hidden border-2 transition-all shrink-0 ${
                    idx === activePhotoIdx
                      ? 'border-[#3B82C4] scale-105 shadow-md shadow-blue-500/30'
                      : 'border-white/20 opacity-50 hover:opacity-100 hover:border-white/60'
                  }`}
                >
                  <img src={p} alt={`Thumbnail ${idx + 1}`} className="w-full h-full object-cover" />
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
