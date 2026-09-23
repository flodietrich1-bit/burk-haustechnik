import React, { useState } from 'react';
import type { Addendum, Room, Position } from '../types';
import { 
  AlertCircle, 
  CheckCircle, 
  User, 
  MapPin, 
  Clock, 
  Package, 
  HelpCircle, 
  Plus, 
  FileSignature, 
  Calendar,
  Check,
  X
} from 'lucide-react';
import { updateAddendumStatus, createAddendum } from '../services/firestoreService';

interface AddendumsViewProps {
  addendums: Addendum[];
  projectId?: string;
  rooms?: Room[];
  positions?: Position[];
}

export const AddendumsView: React.FC<AddendumsViewProps> = ({ 
  addendums, 
  projectId = '', 
  rooms = [], 
  positions: _positions = [] 
}) => {
  const [categoryFilter, setCategoryFilter] = useState<'all' | 'time' | 'material' | 'unclear'>('all');
  const [statusFilter, setStatusFilter] = useState<'all' | 'pending' | 'approved' | 'rejected'>('all');
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);

  // New Addendum Form State
  const [newType, setNewType] = useState<'stunden' | 'material' | 'unklar'>('material');
  const [newTitle, setNewTitle] = useState('');
  const [newQty, setNewQty] = useState('');
  const [newUnit, setNewUnit] = useState('Stk');
  const [newRoomId, setNewRoomId] = useState('');
  const [newNote, setNewNote] = useState('');
  const [newRequestedBy, setNewRequestedBy] = useState('Bauleiter');

  const handleApprove = async (id: string) => {
    await updateAddendumStatus(id, 'approved', projectId);
  };

  const handleReject = async (id: string) => {
    await updateAddendumStatus(id, 'rejected', projectId);
  };

  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim()) return;

    const selectedRoom = rooms.find(r => r.id === newRoomId);
    await createAddendum(projectId, {
      type: newType,
      title: newTitle.trim(),
      quantity: newQty.trim() || (newType === 'stunden' ? '1 h' : '1'),
      qu: newType === 'stunden' ? 'h' : newUnit,
      roomId: newRoomId || 'allgemein',
      roomName: selectedRoom ? selectedRoom.name : 'Baustelle allgemein',
      note: newNote.trim(),
      requestedBy: newRequestedBy.trim() || 'Bauleiter',
      status: 'pending',
    });

    setIsCreateModalOpen(false);
    setNewTitle('');
    setNewQty('');
    setNewNote('');
  };

  // Classify each addendum into 1 of the 3 requested categories:
  // 1. time: 'stunden' | 'zeit' | 'regie'
  // 2. material: 'material' | 'zusatz'
  // 3. unclear: 'unklar' | isUnclear === true | itemOz === 'UNKLAR'
  const getItemCategory = (item: Addendum): 'time' | 'material' | 'unclear' => {
    const t = (item.type || '').toLowerCase();
    if (t === 'stunden' || t === 'zeit' || t === 'regie' || item.qu === 'h' || item.qu === 'Std') {
      return 'time';
    }
    if (t === 'unklar' || item.isUnclear || item.itemOz === 'UNKLAR') {
      return 'unclear';
    }
    return 'material';
  };

  // Metrics
  const totalCount = addendums.length;
  const timeItems = addendums.filter(a => getItemCategory(a) === 'time');
  const materialItems = addendums.filter(a => getItemCategory(a) === 'material');
  const unclearItems = addendums.filter(a => getItemCategory(a) === 'unclear');

  const openTimeCount = timeItems.filter(a => a.status === 'pending').length;
  const openMaterialCount = materialItems.filter(a => a.status === 'pending').length;
  const openUnclearCount = unclearItems.filter(a => a.status === 'pending').length;

  // Filtered List
  const displayedList = addendums.filter(item => {
    const cat = getItemCategory(item);
    if (categoryFilter !== 'all' && cat !== categoryFilter) return false;
    if (statusFilter !== 'all' && item.status !== statusFilter) return false;
    return true;
  });

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-amber-500 to-amber-600 text-white flex items-center justify-center shadow-md shadow-amber-500/20">
              <AlertCircle className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-slate-900 tracking-tight">
                Mehrbedarf & Unklare Positionen
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Baustellen-Mehraufwände: Mehrstunden/Regie, zusätzliches Material und unklare Bauteile
              </p>
            </div>
          </div>
        </div>

        <button
          onClick={() => setIsCreateModalOpen(true)}
          className="inline-flex items-center space-x-2 bg-[#3B82C4] hover:bg-[#2B6EB0] text-white px-4 py-2.5 rounded-xl text-xs font-bold shadow-sm transition-all hover:scale-[1.02] active:scale-[0.98] self-start md:self-auto"
        >
          <Plus className="w-4 h-4" />
          <span>+ Mehrbedarf erfassen</span>
        </button>
      </div>

      {/* KPI Cards: The 3 Core Categories */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Category 1: Time / Hours */}
        <div 
          onClick={() => setCategoryFilter(categoryFilter === 'time' ? 'all' : 'time')}
          className={`cursor-pointer bg-white rounded-2xl border p-5 shadow-xs transition-all hover:border-amber-400 ${
            categoryFilter === 'time' ? 'ring-2 ring-amber-500 border-amber-500' : 'border-slate-200'
          }`}
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2.5">
              <div className="w-9 h-9 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center font-bold">
                <Clock className="w-5 h-5" />
              </div>
              <div>
                <span className="text-xs font-bold text-slate-800 block">Mehr Zeit / Regie</span>
                <span className="text-[10px] text-slate-400">Verzögerung, Mehraufwand</span>
              </div>
            </div>
            <span className="text-xl font-black text-amber-600">
              {timeItems.length}
            </span>
          </div>
          <div className="mt-3 pt-3 border-t border-slate-100 flex items-center justify-between text-xs">
            <span className="text-slate-500 text-[11px]">Offene Prüfungen:</span>
            <span className="font-bold text-amber-700 bg-amber-50 px-2 py-0.5 rounded-full text-[10px]">
              {openTimeCount} ausstehend
            </span>
          </div>
        </div>

        {/* Category 2: Additional Material */}
        <div 
          onClick={() => setCategoryFilter(categoryFilter === 'material' ? 'all' : 'material')}
          className={`cursor-pointer bg-white rounded-2xl border p-5 shadow-xs transition-all hover:border-blue-400 ${
            categoryFilter === 'material' ? 'ring-2 ring-[#3B82C4] border-[#3B82C4]' : 'border-slate-200'
          }`}
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2.5">
              <div className="w-9 h-9 rounded-xl bg-blue-50 text-[#3B82C4] flex items-center justify-center font-bold">
                <Package className="w-5 h-5" />
              </div>
              <div>
                <span className="text-xs font-bold text-slate-800 block">Anderes Material benötigt</span>
                <span className="text-[10px] text-slate-400">Zusatzmaterial, Mehrbedarf</span>
              </div>
            </div>
            <span className="text-xl font-black text-[#3B82C4]">
              {materialItems.length}
            </span>
          </div>
          <div className="mt-3 pt-3 border-t border-slate-100 flex items-center justify-between text-xs">
            <span className="text-slate-500 text-[11px]">Offene Prüfungen:</span>
            <span className="font-bold text-blue-700 bg-blue-50 px-2 py-0.5 rounded-full text-[10px]">
              {openMaterialCount} ausstehend
            </span>
          </div>
        </div>

        {/* Category 3: Unclear Part Installed */}
        <div 
          onClick={() => setCategoryFilter(categoryFilter === 'unclear' ? 'all' : 'unclear')}
          className={`cursor-pointer bg-white rounded-2xl border p-5 shadow-xs transition-all hover:border-purple-400 ${
            categoryFilter === 'unclear' ? 'ring-2 ring-purple-500 border-purple-500' : 'border-slate-200'
          }`}
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2.5">
              <div className="w-9 h-9 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center font-bold">
                <HelpCircle className="w-5 h-5" />
              </div>
              <div>
                <span className="text-xs font-bold text-slate-800 block">Anderes Teil verbaut (Unklar)</span>
                <span className="text-[10px] text-slate-400">Nicht im ursprünglichen Plan</span>
              </div>
            </div>
            <span className="text-xl font-black text-purple-600">
              {unclearItems.length}
            </span>
          </div>
          <div className="mt-3 pt-3 border-t border-slate-100 flex items-center justify-between text-xs">
            <span className="text-slate-500 text-[11px]">Offene Prüfungen:</span>
            <span className="font-bold text-purple-700 bg-purple-50 px-2 py-0.5 rounded-full text-[10px]">
              {openUnclearCount} ausstehend
            </span>
          </div>
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        {/* Categories */}
        <div className="flex flex-wrap items-center gap-1.5">
          {[
            { id: 'all' as const, label: `Alle Meldungen (${totalCount})` },
            { id: 'time' as const, label: `⏱ Mehr Zeit (${timeItems.length})` },
            { id: 'material' as const, label: `📦 Anderes Material (${materialItems.length})` },
            { id: 'unclear' as const, label: `❓ Unklares Teil (${unclearItems.length})` },
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setCategoryFilter(tab.id)}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all ${
                categoryFilter === tab.id
                  ? 'bg-slate-900 text-white shadow-xs'
                  : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Status Filter */}
        <div className="flex items-center space-x-1.5 bg-slate-100 p-1 rounded-xl">
          {[
            { id: 'all' as const, label: 'Alle Status' },
            { id: 'pending' as const, label: 'Ausstehend' },
            { id: 'approved' as const, label: 'Freigegeben' },
            { id: 'rejected' as const, label: 'Abgelehnt' },
          ].map(s => (
            <button
              key={s.id}
              onClick={() => setStatusFilter(s.id)}
              className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-colors ${
                statusFilter === s.id
                  ? 'bg-white text-slate-800 shadow-xs font-bold'
                  : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              {s.label}
            </button>
          ))}
        </div>
      </div>

      {/* Content Grid: Kacheln */}
      {displayedList.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center space-y-3 shadow-xs">
          <div className="w-12 h-12 rounded-full bg-slate-100 text-slate-400 flex items-center justify-center mx-auto">
            <CheckCircle className="w-6 h-6 text-emerald-500" />
          </div>
          <h3 className="font-bold text-slate-800 text-sm">Keine Einträge für diese Filterauswahl</h3>
          <p className="text-xs text-slate-400 max-w-sm mx-auto">
            Aktuell liegen für diesen Filter keine Mehrbedarfe oder unklaren Positionen vor. Alle Leistungen verlaufen planmäßig.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {displayedList.map(item => {
            const cat = getItemCategory(item);
            const isPending = item.status === 'pending';
            const isApproved = item.status === 'approved';
            const isRejected = item.status === 'rejected';

            // Styling based on category
            const theme = cat === 'time' ? {
              badgeBg: 'bg-amber-50 text-amber-800 border-amber-200',
              icon: Clock,
              iconColor: 'text-amber-600',
              label: '⏱ Mehr Zeit / Regie',
              tagBg: 'bg-amber-50 text-amber-700',
            } : cat === 'unclear' ? {
              badgeBg: 'bg-purple-50 text-purple-800 border-purple-200',
              icon: HelpCircle,
              iconColor: 'text-purple-600',
              label: '❓ Anderes Teil verbaut (Unklar)',
              tagBg: 'bg-purple-50 text-purple-700',
            } : {
              badgeBg: 'bg-blue-50 text-blue-800 border-blue-200',
              icon: Package,
              iconColor: 'text-[#3B82C4]',
              label: '📦 Anderes Material benötigt',
              tagBg: 'bg-blue-50 text-[#3B82C4]',
            };

            const IconComp = theme.icon;

            return (
              <div 
                key={item.id}
                className="bg-white rounded-2xl border border-slate-200 shadow-xs p-5 hover:border-slate-300 transition-all flex flex-col justify-between space-y-4"
              >
                <div className="space-y-3">
                  {/* Top Bar: Category Badge + Status Badge */}
                  <div className="flex items-start justify-between gap-2">
                    <span className={`inline-flex items-center space-x-1.5 px-2.5 py-1 rounded-lg text-xs font-bold border ${theme.badgeBg}`}>
                      <IconComp className={`w-3.5 h-3.5 ${theme.iconColor}`} />
                      <span>{theme.label}</span>
                    </span>

                    <span className={`px-2.5 py-0.5 rounded-full text-[11px] font-bold shrink-0 ${
                      isApproved ? 'bg-emerald-100 text-emerald-800 border border-emerald-200' :
                      isRejected ? 'bg-red-100 text-red-800 border border-red-200' :
                      'bg-amber-100 text-amber-800 border border-amber-200'
                    }`}>
                      {isApproved ? 'Freigegeben' : isRejected ? 'Abgelehnt' : 'Ausstehend'}
                    </span>
                  </div>

                  {/* Title & Quantity Pill */}
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <h4 className="font-bold text-slate-900 text-base leading-snug">
                        {item.title}
                      </h4>
                      {item.description && item.description !== item.title && (
                        <p className="text-xs text-slate-500 mt-0.5">{item.description}</p>
                      )}
                    </div>

                    <div className="text-right shrink-0">
                      <span className="font-mono font-black text-sm text-slate-900 bg-slate-100 px-2.5 py-1 rounded-lg block">
                        {item.quantity} {item.qu && !String(item.quantity).includes(item.qu) ? item.qu : ''}
                      </span>
                    </div>
                  </div>

                  {/* Room & Submitter Meta Info */}
                  <div className="flex flex-wrap items-center gap-3 text-xs text-slate-500 pt-1">
                    <div className="flex items-center space-x-1 text-[#3B82C4] font-medium bg-blue-50/60 px-2 py-0.5 rounded-md">
                      <MapPin className="w-3.5 h-3.5" />
                      <span>{item.roomName || item.roomId || 'Baustelle'}</span>
                    </div>

                    <div className="flex items-center space-x-1 font-medium">
                      <User className="w-3.5 h-3.5 text-slate-400" />
                      <span>{item.requestedBy || 'Monteur'}</span>
                    </div>

                    <div className="flex items-center space-x-1 text-slate-400">
                      <Calendar className="w-3.5 h-3.5" />
                      <span>{item.createdAt ? new Date(item.createdAt).toLocaleDateString('de-DE') : '-'}</span>
                    </div>
                  </div>

                  {/* Monteur Note / Begründung */}
                  {item.note && (
                    <div className="p-3 rounded-xl bg-slate-50 border border-slate-100 text-xs text-slate-700 space-y-1">
                      <span className="font-bold text-[10px] text-slate-400 uppercase tracking-wider block">
                        Begründung / Notiz vom Monteur:
                      </span>
                      <p className="leading-relaxed italic">„{item.note}“</p>
                    </div>
                  )}

                  {/* Special indicator for unclear items */}
                  {cat === 'unclear' && (
                    <div className="flex items-center space-x-2 text-[11px] text-purple-700 bg-purple-50 border border-purple-200 px-3 py-1.5 rounded-xl">
                      <HelpCircle className="w-4 h-4 shrink-0 text-purple-600" />
                      <span>
                        {item.isOrdered
                          ? `Teil ist bereits im Materialstamm vorhanden (Pos. ${item.itemOz || '–'}), war aber nicht diesem Raum zugeordnet.`
                          : 'Neues/Alternatives Fabrikat verbaut, das zuvor nicht in der Planung hinterlegt war.'}
                      </span>
                    </div>
                  )}

                  {/* Signature badge if available */}
                  {item.signature && (
                    <div className="flex items-center space-x-1.5 text-xs text-emerald-700 font-semibold bg-emerald-50 px-2.5 py-1 rounded-lg w-fit">
                      <FileSignature className="w-3.5 h-3.5" />
                      <span>Digital unterschrieben</span>
                    </div>
                  )}
                </div>

                {/* Bottom Actions for Bauleiter / Admin */}
                {isPending ? (
                  <div className="pt-3 border-t border-slate-100 flex items-center justify-end space-x-2">
                    <button
                      onClick={() => handleReject(item.id)}
                      className="flex items-center space-x-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold text-red-700 bg-red-50 hover:bg-red-100 transition-colors"
                      title="Diesen Mehrbedarf ablehnen"
                    >
                      <X className="w-3.5 h-3.5" />
                      <span>Ablehnen</span>
                    </button>

                    <button
                      onClick={() => handleApprove(item.id)}
                      className="flex items-center space-x-1.5 px-4 py-1.5 rounded-xl text-xs font-bold text-white bg-[#2FA36B] hover:bg-[#258757] transition-all shadow-xs hover:scale-[1.02]"
                      title="Diesen Mehrbedarf für die VOB-Abrechnung freigeben"
                    >
                      <Check className="w-3.5 h-3.5" />
                      <span>Freigeben</span>
                    </button>
                  </div>
                ) : (
                  <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-xs text-slate-400">
                    <span>Bearbeitet durch Bauleiter</span>
                    <button
                      onClick={() => updateAddendumStatus(item.id, 'pending', projectId)}
                      className="text-[#3B82C4] hover:underline text-[11px]"
                    >
                      Status zurücksetzen
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Modal: Mehrbedarf manuell erfassen */}
      {isCreateModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-lg w-full p-6 space-y-5 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="font-bold text-base text-slate-900 flex items-center space-x-2">
                <Plus className="w-5 h-5 text-[#3B82C4]" />
                <span>Mehrbedarf / Unklar manuell erfassen</span>
              </h3>
              <button 
                onClick={() => setIsCreateModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 p-1"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateSubmit} className="space-y-4 text-xs">
              {/* Type Selection */}
              <div>
                <label className="font-bold text-slate-700 block mb-1.5">Art des Mehraufwands *</label>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { id: 'material' as const, label: '📦 Material', sub: 'Anderes Material' },
                    { id: 'stunden' as const, label: '⏱ Stunden', sub: 'Mehr Zeit / Regie' },
                    { id: 'unklar' as const, label: '❓ Unklar', sub: 'Nicht im Plan' },
                  ].map(t => (
                    <button
                      type="button"
                      key={t.id}
                      onClick={() => setNewType(t.id)}
                      className={`p-2.5 rounded-xl border text-left transition-all ${
                        newType === t.id
                          ? 'border-[#3B82C4] bg-blue-50 text-[#3B82C4] font-bold'
                          : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                      }`}
                    >
                      <div className="text-xs">{t.label}</div>
                      <div className="text-[10px] text-slate-400">{t.sub}</div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Title / Description */}
              <div>
                <label className="font-bold text-slate-700 block mb-1">
                  {newType === 'stunden' ? 'Tätigkeit / Grund für Mehraufwand *' : 'Material- oder Bauteilbezeichnung *'}
                </label>
                <input
                  type="text"
                  required
                  placeholder={newType === 'stunden' ? 'z. B. Stemmarbeiten Schacht EG' : 'z. B. 3x Bogen 90° DN 100'}
                  value={newTitle}
                  onChange={e => setNewTitle(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#3B82C4]/30"
                />
              </div>

              {/* Quantity & Unit */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-bold text-slate-700 block mb-1">
                    {newType === 'stunden' ? 'Stundenanzahl *' : 'Menge *'}
                  </label>
                  <input
                    type="text"
                    required
                    placeholder={newType === 'stunden' ? 'z. B. 2.5' : 'z. B. 4'}
                    value={newQty}
                    onChange={e => setNewQty(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#3B82C4]/30"
                  />
                </div>

                <div>
                  <label className="font-bold text-slate-700 block mb-1">Einheit</label>
                  {newType === 'stunden' ? (
                    <input
                      type="text"
                      disabled
                      value="Stunden (h)"
                      className="w-full px-3 py-2 bg-slate-100 border border-slate-200 rounded-xl text-slate-500"
                    />
                  ) : (
                    <select
                      value={newUnit}
                      onChange={e => setNewUnit(e.target.value)}
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#3B82C4]/30"
                    >
                      <option value="Stk">Stück (Stk)</option>
                      <option value="m">Meter (m)</option>
                      <option value="m²">Quadratmeter (m²)</option>
                      <option value="kg">Kilogramm (kg)</option>
                      <option value="Psch">Pauschal (Psch)</option>
                    </select>
                  )}
                </div>
              </div>

              {/* Room Assignment */}
              <div>
                <label className="font-bold text-slate-700 block mb-1">Zugehöriger Raum</label>
                <select
                  value={newRoomId}
                  onChange={e => setNewRoomId(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#3B82C4]/30"
                >
                  <option value="">Baustelle allgemein</option>
                  {rooms.map(r => (
                    <option key={r.id} value={r.id}>
                      {r.name} ({r.code || 'Raum'}) - {r.floor}
                    </option>
                  ))}
                </select>
              </div>

              {/* Note / Details */}
              <div>
                <label className="font-bold text-slate-700 block mb-1">Begründung / Zusätzliche Notiz</label>
                <textarea
                  rows={2}
                  placeholder="Details zur Ursache, Baustellenbedingungen oder Notwendigkeit..."
                  value={newNote}
                  onChange={e => setNewNote(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#3B82C4]/30"
                />
              </div>

              {/* Requested By */}
              <div>
                <label className="font-bold text-slate-700 block mb-1">Gemeldet durch</label>
                <input
                  type="text"
                  placeholder="z. B. Florian Buck (Bauleiter)"
                  value={newRequestedBy}
                  onChange={e => setNewRequestedBy(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#3B82C4]/30"
                />
              </div>

              {/* Action Buttons */}
              <div className="pt-2 flex justify-end space-x-2">
                <button
                  type="button"
                  onClick={() => setIsCreateModalOpen(false)}
                  className="px-4 py-2 rounded-xl text-slate-600 hover:bg-slate-100 font-semibold"
                >
                  Abbrechen
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-[#3B82C4] hover:bg-[#2B6EB0] text-white font-bold shadow-sm transition-all"
                >
                  Mehrbedarf anlegen
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
