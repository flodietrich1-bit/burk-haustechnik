import React, { useState } from 'react';
import type { Room, Position, RoomMaterialRequirement } from '../types';
import { Plus, Globe, Trash2, Package, ChevronDown, ChevronUp, Compass, X, CheckCircle2, BarChart2 } from 'lucide-react';
import { saveRoom, deleteRoom } from '../services/firestoreService';
import { RoomDetailModal } from './RoomDetailModal';
import { CircularProgress } from './CircularProgress';

interface RoomManagerProps {
  projectId: string;
  projectName?: string;
  rooms: Room[];
  positions: Position[];
}

export const RoomManager: React.FC<RoomManagerProps> = ({ projectId, projectName, rooms, positions }) => {
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [expandedRoomId, setExpandedRoomId] = useState<string | null>(null);
  const [selectedRoomIdForDetail, setSelectedRoomIdForDetail] = useState<string | null>(null);

  const selectedRoomForDetail = rooms.find(r => r.id === selectedRoomIdForDetail) || null;

  // Assign Material Modal State
  const [assigningRoom, setAssigningRoom] = useState<Room | null>(null);
  const [selectedPosId, setSelectedPosId] = useState<string>('');
  const [plannedQty, setPlannedQty] = useState<number>(1);

  const [newRoom, setNewRoom] = useState<Partial<Room>>({
    name: '',
    code: '',
    floor: 'EG',
    translations: { ro: '', pl: '', hr: '' }
  });

  const handleCreate = async () => {
    if (!newRoom.name || !newRoom.code) return;
    const roomId = `room_${Date.now()}`;
    const roomToSave: Room = {
      id: roomId,
      name: newRoom.name,
      code: newRoom.code,
      floor: newRoom.floor || 'EG',
      source: 'manual',
      translations: {
        ro: newRoom.translations?.ro || newRoom.name,
        pl: newRoom.translations?.pl || newRoom.name,
        hr: newRoom.translations?.hr || newRoom.name
      },
      materials: []
    };

    await saveRoom(projectId, roomToSave);
    setIsAddOpen(false);
    setNewRoom({ name: '', code: '', floor: 'EG', translations: { ro: '', pl: '', hr: '' } });
  };

  const handleDelete = async (roomId: string) => {
    if (confirm('Raum wirklich löschen?')) {
      await deleteRoom(projectId, roomId);
    }
  };

  const handleOpenAssignModal = (room: Room) => {
    setAssigningRoom(room);
    if (positions.length > 0) {
      setSelectedPosId(positions[0].id);
      setPlannedQty(1);
    }
  };

  const handleAddMaterialToRoom = async () => {
    if (!assigningRoom || !selectedPosId) return;
    const targetPos = positions.find(p => p.id === selectedPosId);
    if (!targetPos) return;

    const currentMaterials = assigningRoom.materials || [];
    const exists = currentMaterials.find(m => m.positionId === selectedPosId);

    let updatedMaterials: RoomMaterialRequirement[] = [];
    if (exists) {
      updatedMaterials = currentMaterials.map(m => 
        m.positionId === selectedPosId ? { ...m, plannedQty: m.plannedQty + plannedQty } : m
      );
    } else {
      updatedMaterials = [
        ...currentMaterials,
        {
          positionId: targetPos.id,
          posNr: targetPos.posNr,
          shortText: targetPos.shortText,
          plannedQty: plannedQty,
          qu: targetPos.qu,
          group: targetPos.group
        }
      ];
    }

    const updatedRoom: Room = {
      ...assigningRoom,
      materials: updatedMaterials
    };

    await saveRoom(projectId, updatedRoom);
    setAssigningRoom(null);
  };

  const handleRemoveMaterialFromRoom = async (room: Room, positionId: string) => {
    const updatedMaterials = (room.materials || []).filter(m => m.positionId !== positionId);
    const updatedRoom: Room = {
      ...room,
      materials: updatedMaterials
    };
    await saveRoom(projectId, updatedRoom);
  };

  // Calculate Progress Metrics for the Status Pie Chart
  const totalRooms = rooms.length;
  const completedRooms = rooms.filter(r => r.status === 'completed').length;
  const inProgressRooms = rooms.filter(r => r.status !== 'completed' && (r.progressPercent || 0) > 0).length;
  const plannedRooms = rooms.filter(r => r.status !== 'completed' && (!r.progressPercent || r.progressPercent === 0)).length;

  const totalProgressPercent = totalRooms > 0 
    ? Math.round(rooms.reduce((sum, r) => sum + (r.status === 'completed' ? 100 : (r.progressPercent || 0)), 0) / totalRooms)
    : 0;

  return (
    <div className="space-y-6">
      {/* Header Bar */}
      <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-bold text-slate-900">Raum- & Baustellen-Konfigurator</h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Örtlichkeiten der Verbauung: Räume aus DWG-Plan oder manuell angelegt mit hinterlegten LV-Materialien
          </p>
        </div>
        <button
          onClick={() => setIsAddOpen(true)}
          className="flex items-center space-x-2 bg-[#3B82C4] hover:bg-[#2B6EB0] text-white px-4 py-2.5 rounded-xl text-xs font-bold shadow-md shadow-blue-500/20 transition-all hover:scale-[1.02] active:scale-[0.98] self-start sm:self-auto"
        >
          <Plus className="w-4 h-4" />
          <span>Raum manuell anlegen</span>
        </button>
      </div>

      {/* Project Room Progress & Status Pie Chart Card (0% Rot -> 100% Grün) */}
      <div className="bg-white rounded-2xl border border-slate-200 p-5 sm:p-6 shadow-sm flex flex-col md:flex-row items-center justify-between gap-6">
        {/* Left: Circular Progress Pie Chart with 0% Red -> 100% Green Gradient */}
        <div className="flex items-center space-x-5">
          <CircularProgress
            percentage={totalProgressPercent}
            size={110}
            strokeWidth={11}
            sublabel="Gesamt"
          />

          <div className="space-y-1">
            <div className="flex items-center space-x-2">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
                Baustellen-Fortschritt
              </span>
              <span className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full ${
                totalProgressPercent >= 80 
                  ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                  : totalProgressPercent >= 40 
                  ? 'bg-amber-100 text-amber-800 border border-amber-300'
                  : 'bg-red-100 text-red-800 border border-red-300'
              }`}>
                {totalProgressPercent >= 100 ? 'Vollständig abgeschlossen' : totalProgressPercent >= 40 ? 'In Ausführung' : 'Startphase'}
              </span>
            </div>
            <h3 className="text-xl font-black text-slate-900 tracking-tight">
              {completedRooms} von {totalRooms} Räumen fertiggestellt (100%)
            </h3>
            <p className="text-xs text-slate-500">
              Durchschnittlicher Fertigstellungsgrad aller Räume & Örtlichkeiten im Projekt
            </p>
          </div>
        </div>

        {/* Right: Quick Stats Breakdown */}
        <div className="grid grid-cols-3 gap-3 w-full md:w-auto shrink-0 text-center">
          <div className="bg-emerald-50 border border-emerald-200 px-4 py-3 rounded-xl shadow-xs">
            <span className="text-[10px] font-bold text-emerald-700 uppercase tracking-wider block">
              Fertig (100%)
            </span>
            <span className="text-xl font-black text-emerald-800 block mt-0.5">
              {completedRooms}
            </span>
            <span className="text-[10px] text-emerald-600">Räume abgenommen</span>
          </div>

          <div className="bg-blue-50 border border-blue-200 px-4 py-3 rounded-xl shadow-xs">
            <span className="text-[10px] font-bold text-blue-700 uppercase tracking-wider block">
              In Montage
            </span>
            <span className="text-xl font-black text-[#3B82C4] block mt-0.5">
              {inProgressRooms}
            </span>
            <span className="text-[10px] text-blue-600">aktiv in Arbeit</span>
          </div>

          <div className="bg-slate-50 border border-slate-200 px-4 py-3 rounded-xl shadow-xs">
            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">
              Geplant
            </span>
            <span className="text-xl font-black text-slate-700 block mt-0.5">
              {plannedRooms}
            </span>
            <span className="text-[10px] text-slate-500">noch offen</span>
          </div>
        </div>
      </div>

      {/* Room Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {rooms.map((room) => {
          const isExpanded = expandedRoomId === room.id;
          const materialCount = room.materials?.length || 0;
          const isDwg = room.source === 'dwg';
          const roomPercent = room.status === 'completed' ? 100 : (room.progressPercent || 0);

          return (
            <div 
              key={room.id} 
              className="bg-white rounded-xl border border-slate-200 shadow-sm p-5 space-y-4 hover:border-[#3B82C4]/40 transition-colors flex flex-col justify-between"
            >
              <div className="space-y-3">
                {/* Top Badge, Circular Progress & Delete */}
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center space-x-3 truncate">
                    <div className="w-10 h-10 rounded-lg bg-slate-100 text-slate-700 flex items-center justify-center font-mono font-bold text-xs shrink-0">
                      {room.code}
                    </div>
                    <div className="truncate">
                      <div className="flex items-center space-x-2">
                        <h3 className="font-bold text-slate-900 text-sm leading-tight truncate">{room.name}</h3>
                        {room.status === 'completed' && (
                          <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-300 px-2 py-0.5 rounded-full flex items-center space-x-1 shrink-0">
                            <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                            <span>100% Fertig</span>
                          </span>
                        )}
                      </div>
                      <div className="flex flex-wrap items-center gap-1.5 mt-1">
                        <span className="text-[10px] font-semibold text-slate-500 bg-slate-100 px-2 py-0.2 rounded">
                          Etage: {room.floor}
                        </span>
                        {isDwg ? (
                          <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-1.5 py-0.2 rounded flex items-center space-x-1">
                            <Compass className="w-2.5 h-2.5" />
                            <span>DWG / DXF</span>
                          </span>
                        ) : (
                          <span className="text-[10px] font-medium text-slate-500 bg-slate-100 px-1.5 py-0.2 rounded">
                            Manuell
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Circular Progress & Delete */}
                  <div className="flex items-center space-x-2 shrink-0">
                    <CircularProgress
                      percentage={roomPercent}
                      size={44}
                      strokeWidth={4.5}
                      showText={true}
                    />

                    <button
                      onClick={() => handleDelete(room.id)}
                      className="text-slate-300 hover:text-red-500 transition-colors p-1"
                      title="Raum löschen"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {/* Multi-language Badges */}
                <div className="pt-2 border-t border-slate-100 space-y-1 text-xs">
                  <div className="flex items-center justify-between text-slate-500">
                    <span className="flex items-center space-x-1">
                      <span>🇷🇴 RO:</span>
                      <span className="font-medium text-slate-700">{room.translations.ro || room.name}</span>
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-slate-500">
                    <span className="flex items-center space-x-1">
                      <span>🇵🇱 PL:</span>
                      <span className="font-medium text-slate-700">{room.translations.pl || room.name}</span>
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-slate-500">
                    <span className="flex items-center space-x-1">
                      <span>🇭🇷 HR:</span>
                      <span className="font-medium text-slate-700">{room.translations.hr || room.name}</span>
                    </span>
                  </div>
                </div>

                {/* Assigned Materials Section */}
                <div className="pt-3 border-t border-slate-100 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-700 flex items-center space-x-1.5">
                      <Package className="w-3.5 h-3.5 text-[#3B82C4]" />
                      <span>Hinterlegte Materialien:</span>
                    </span>
                    <span className="text-[11px] font-bold text-[#2FA36B] bg-emerald-50 px-2 py-0.5 rounded">
                      {materialCount} Positionen
                    </span>
                  </div>

                  {materialCount === 0 ? (
                    <p className="text-[11px] text-slate-400 italic">
                      Noch keine Materialien für diesen Raum hinterlegt.
                    </p>
                  ) : (
                    <div className="space-y-1">
                      {/* Show first 2 or all if expanded */}
                      {(isExpanded ? room.materials : room.materials?.slice(0, 2))?.map((mat) => (
                        <div key={mat.positionId} className="p-1.5 bg-slate-50 rounded border border-slate-200 text-xs flex items-center justify-between">
                          <div className="truncate mr-2">
                            <span className="font-mono font-bold text-[#3B82C4] mr-1.5">{mat.posNr}</span>
                            <span className="text-slate-700">{mat.shortText}</span>
                          </div>
                          <div className="flex items-center space-x-1.5 shrink-0">
                            <span className="font-bold text-slate-800 bg-white px-1.5 py-0.5 rounded border border-slate-200 text-[10px]">
                              {mat.plannedQty} {mat.qu}
                            </span>
                            <button
                              onClick={() => handleRemoveMaterialFromRoom(room, mat.positionId)}
                              className="text-slate-400 hover:text-red-500 p-0.5"
                              title="Material aus Raum entfernen"
                            >
                              <X className="w-3 h-3" />
                            </button>
                          </div>
                        </div>
                      ))}

                      {materialCount > 2 && (
                        <button
                          onClick={() => setExpandedRoomId(isExpanded ? null : room.id)}
                          className="text-[11px] text-[#3B82C4] font-semibold hover:underline flex items-center space-x-1 pt-0.5"
                        >
                          <span>{isExpanded ? 'Weniger anzeigen' : `+ ${materialCount - 2} weitere Materialien anzeigen`}</span>
                          {isExpanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                        </button>
                      )}
                    </div>
                  )}
                </div>
              </div>

              {/* Actions: Room Detail / Delta & Add Material */}
              <div className="pt-3 border-t border-slate-100 space-y-2">
                <button
                  onClick={() => setSelectedRoomIdForDetail(room.id)}
                  className="w-full flex items-center justify-center space-x-2 bg-[#1C2A3B] hover:bg-slate-800 text-white py-2 rounded-xl text-xs font-bold shadow-sm transition-all hover:scale-[1.01] active:scale-[0.99]"
                >
                  <BarChart2 className="w-3.5 h-3.5 text-[#3B82C4]" />
                  <span>Mengen-Delta & VOB-Aufmaß</span>
                </button>

                <button
                  onClick={() => handleOpenAssignModal(room)}
                  className="w-full flex items-center justify-center space-x-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 py-1.5 rounded-lg text-xs font-semibold transition-colors"
                >
                  <Plus className="w-3.5 h-3.5 text-[#3B82C4]" />
                  <span>Material zuweisen</span>
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* Modal: Material zu Raum zuweisen */}
      {assigningRoom && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <h3 className="text-base font-bold text-slate-800">
                  Material für Raum "{assigningRoom.name}" hinterlegen
                </h3>
                <p className="text-xs text-slate-400">{assigningRoom.code} ({assigningRoom.floor})</p>
              </div>
              <button onClick={() => setAssigningRoom(null)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="block text-slate-700 font-semibold mb-1">
                  LV-Position auswählen ({positions.length} verfügbar):
                </label>
                <select
                  value={selectedPosId}
                  onChange={(e) => setSelectedPosId(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#3B82C4]"
                >
                  {positions.map(p => (
                    <option key={p.id} value={p.id}>
                      {p.posNr} – {p.shortText} ({p.qty} {p.qu})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-slate-700 font-semibold mb-1">
                  Geplante Menge für diesen Raum:
                </label>
                <div className="flex items-center space-x-2">
                  <input
                    type="number"
                    min="1"
                    value={plannedQty}
                    onChange={(e) => setPlannedQty(Math.max(1, parseFloat(e.target.value) || 1))}
                    className="w-32 px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-800 font-bold focus:outline-none focus:ring-2 focus:ring-[#3B82C4]"
                  />
                  <span className="text-xs font-semibold text-slate-600">
                    {positions.find(p => p.id === selectedPosId)?.qu || 'Stk'}
                  </span>
                </div>
              </div>
            </div>

            <div className="flex justify-end space-x-3 pt-3 border-t border-slate-100">
              <button
                onClick={() => setAssigningRoom(null)}
                className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-800"
              >
                Abbrechen
              </button>
              <button
                onClick={handleAddMaterialToRoom}
                className="bg-[#3B82C4] hover:bg-[#2B6EB0] text-white px-5 py-2 rounded-xl text-xs font-semibold shadow-md"
              >
                Zuordnung speichern
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add Room Modal (Manual) */}
      {isAddOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4">
            <h3 className="text-base font-bold text-slate-800">Neuen Raum manuell anlegen</h3>
            <p className="text-xs text-slate-500">Für Projekte ohne DWG-Plandaten</p>
            
            <div className="space-y-3 text-xs">
              <div>
                <label className="block text-slate-600 font-semibold mb-1">Raumname (DE)</label>
                <input
                  type="text"
                  placeholder="z.B. Duschen Herren"
                  value={newRoom.name}
                  onChange={(e) => setNewRoom({ ...newRoom, name: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#3B82C4]"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-600 font-semibold mb-1">Raum-Code</label>
                  <input
                    type="text"
                    placeholder="z.B. EG-103"
                    value={newRoom.code}
                    onChange={(e) => setNewRoom({ ...newRoom, code: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#3B82C4]"
                  />
                </div>
                <div>
                  <label className="block text-slate-600 font-semibold mb-1">Etage</label>
                  <select
                    value={newRoom.floor}
                    onChange={(e) => setNewRoom({ ...newRoom, floor: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#3B82C4]"
                  >
                    <option value="UG">UG (Untergeschoss)</option>
                    <option value="EG">EG (Erdgeschoss)</option>
                    <option value="OG">OG (Obergeschoss)</option>
                    <option value="DG">DG (Dachgeschoss)</option>
                  </select>
                </div>
              </div>

              <div className="pt-2 space-y-2 border-t border-slate-100">
                <span className="font-semibold text-slate-700 flex items-center space-x-1">
                  <Globe className="w-3.5 h-3.5 text-[#3B82C4]" />
                  <span>Monteur-Sprachen (Optional)</span>
                </span>
                
                <input
                  type="text"
                  placeholder="Rumänisch (RO)"
                  value={newRoom.translations?.ro}
                  onChange={(e) => setNewRoom({
                    ...newRoom,
                    translations: { ...newRoom.translations, ro: e.target.value }
                  })}
                  className="w-full px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg"
                />
                <input
                  type="text"
                  placeholder="Polnisch (PL)"
                  value={newRoom.translations?.pl}
                  onChange={(e) => setNewRoom({
                    ...newRoom,
                    translations: { ...newRoom.translations, pl: e.target.value }
                  })}
                  className="w-full px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg"
                />
                <input
                  type="text"
                  placeholder="Kroatisch (HR)"
                  value={newRoom.translations?.hr}
                  onChange={(e) => setNewRoom({
                    ...newRoom,
                    translations: { ...newRoom.translations, hr: e.target.value }
                  })}
                  className="w-full px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg"
                />
              </div>
            </div>

            <div className="flex justify-end space-x-3 pt-4">
              <button
                onClick={() => setIsAddOpen(false)}
                className="px-4 py-2 text-xs font-semibold text-slate-600"
              >
                Abbrechen
              </button>
              <button
                onClick={handleCreate}
                className="bg-[#3B82C4] hover:bg-[#2B6EB0] text-white px-5 py-2 rounded-xl text-xs font-semibold"
              >
                Speichern
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Room Detail & VOB Aufmaß Modal */}
      <RoomDetailModal
        projectId={projectId}
        projectName={projectName || 'Hallenbad Weingarten'}
        room={selectedRoomForDetail}
        positions={positions}
        isOpen={!!selectedRoomForDetail}
        onClose={() => setSelectedRoomIdForDetail(null)}
      />
    </div>
  );
};
