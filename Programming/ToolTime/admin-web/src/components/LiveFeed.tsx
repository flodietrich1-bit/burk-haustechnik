import React, { useState, useMemo } from 'react';
import type { Booking, Room, Position } from '../types';
import { 
  Activity, User, MapPin, Search, AlertTriangle, CheckCircle2, Clock, Package, X, Eye
} from 'lucide-react';

interface LiveFeedProps {
  bookings: Booking[];
  rooms: Room[];
  positions?: Position[];
}

export const LiveFeed: React.FC<LiveFeedProps> = ({ bookings, rooms, positions = [] }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState<'all' | 'alert' | 'regular' | 'completion'>('all');
  const [selectedImage, setSelectedImage] = useState<string | null>(null);

  // Quick lookup maps
  const roomMap = useMemo(() => new Map(rooms.map(r => [r.id, r])), [rooms]);
  const roomCodeMap = useMemo(() => new Map(rooms.map(r => [r.code, r])), [rooms]);
  const posMap = useMemo(() => new Map(positions.map(p => [p.posNr, p])), [positions]);
  const posIdMap = useMemo(() => new Map(positions.map(p => [p.id, p])), [positions]);

  // Sort bookings newest first
  const sortedBookings = useMemo(() => {
    return [...bookings].sort((a, b) => {
      const timeA = new Date(a.timestamp || a.createdAt || (a as any).syncedAt || 0).getTime() || 0;
      const timeB = new Date(b.timestamp || b.createdAt || (b as any).syncedAt || 0).getTime() || 0;
      return timeB - timeA;
    });
  }, [bookings]);

  // Filtered bookings
  const filteredBookings = useMemo(() => {
    return sortedBookings.filter(b => {
      const isAlert = b.type === 'over_consumption_alert' || (b as any).isAlert || (b as any).requestedTotal !== undefined;
      const isCompletion = b.type === 'room_completion' || (b as any).itemId === 'room_completion';

      if (filterType === 'alert' && !isAlert) return false;
      if (filterType === 'completion' && !isCompletion) return false;
      if (filterType === 'regular' && (isAlert || isCompletion)) return false;

      if (!searchTerm.trim()) return true;
      const term = searchTerm.toLowerCase();

      const r = roomMap.get(b.roomId) || roomCodeMap.get(b.roomId);
      const roomMatch = (r?.name && r.name.toLowerCase().includes(term)) ||
                        (r?.code && r.code.toLowerCase().includes(term)) ||
                        (b.roomName && b.roomName.toLowerCase().includes(term));

      const posNr = b.positionNr || (b as any).itemOz || '';
      const posName = b.positionName || (b as any).itemText || '';
      const matMatch = posNr.toLowerCase().includes(term) || posName.toLowerCase().includes(term);

      const monteurMatch = b.createdBy && b.createdBy.toLowerCase().includes(term);
      const noteMatch = ((b.note || '') + ' ' + ((b as any).reason || '')).toLowerCase().includes(term);

      return roomMatch || matMatch || monteurMatch || noteMatch;
    });
  }, [sortedBookings, filterType, searchTerm, roomMap, roomCodeMap]);

  const alertCount = bookings.filter(b => b.type === 'over_consumption_alert' || (b as any).isAlert).length;
  const completionCount = bookings.filter(b => b.type === 'room_completion' || (b as any).itemId === 'room_completion').length;

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-xl bg-blue-50 text-[#3B82C4] flex items-center justify-center font-bold">
              <Activity className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-slate-900 tracking-tight">
                Live-Monteursbuchungen & Bautagebuch
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Echtzeit-Protokoll: Welcher Monteur hat wann, in welchem Raum und welche Mengen verbaut?
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center space-x-3 shrink-0">
          <div className="flex items-center space-x-2 bg-emerald-50 text-emerald-700 border border-emerald-200 px-3 py-1.5 rounded-full text-xs font-semibold">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            <span>Firestore Live-Sync Aktiv</span>
          </div>
        </div>
      </div>

      {/* Filter & Search Bar */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => setFilterType('all')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
              filterType === 'all'
                ? 'bg-[#3B82C4] text-white shadow-xs'
                : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
            }`}
          >
            Alle Erfassungen ({bookings.length})
          </button>

          <button
            onClick={() => setFilterType('alert')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center space-x-1.5 cursor-pointer ${
              filterType === 'alert'
                ? 'bg-red-600 text-white shadow-xs'
                : 'bg-red-50 hover:bg-red-100 text-red-700 border border-red-200'
            }`}
          >
            <AlertTriangle className="w-3.5 h-3.5" />
            <span>Mehrverbrauch & Warnungen ({alertCount})</span>
          </button>

          {completionCount > 0 && (
            <button
              onClick={() => setFilterType('completion')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center space-x-1.5 cursor-pointer ${
                filterType === 'completion'
                  ? 'bg-emerald-600 text-white shadow-xs'
                  : 'bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200'
              }`}
            >
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span>Raumabschlüsse ({completionCount})</span>
            </button>
          )}

          <button
            onClick={() => setFilterType('regular')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
              filterType === 'regular'
                ? 'bg-slate-800 text-white shadow-xs'
                : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
            }`}
          >
            Standard-Verbau
          </button>
        </div>

        <div className="flex items-center space-x-3">
          <div className="relative">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Monteur, Raum, Pos oder Material suchen..."
              className="pl-8 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg text-slate-700 focus:outline-none focus:ring-2 focus:ring-[#3B82C4] w-64"
            />
          </div>
          <span className="text-xs text-slate-400 font-medium">
            {filteredBookings.length} Einträge
          </span>
        </div>
      </div>

      {/* Bookings Stream List */}
      <div className="space-y-3.5">
        {filteredBookings.length === 0 ? (
          <div className="bg-white p-12 text-center rounded-2xl border-2 border-dashed border-slate-200 text-slate-400 text-xs space-y-2">
            <Package className="w-8 h-8 text-slate-300 mx-auto" />
            <p className="font-semibold text-slate-600">Keine Monteursbuchungen für diese Kriterien gefunden.</p>
            <p className="text-slate-400">Buchungen von der Baustelle erscheinen hier automatisch live.</p>
          </div>
        ) : (
          filteredBookings.map((booking) => {
            const room = roomMap.get(booking.roomId) || 
                         roomCodeMap.get(booking.roomId) || 
                         rooms.find(r => booking.roomName && r.name.toLowerCase() === booking.roomName.toLowerCase());

            const pos = posMap.get(booking.positionNr || (booking as any).itemOz) || 
                        posIdMap.get(booking.positionId || (booking as any).itemId);

            const posNr = booking.positionNr || (booking as any).itemOz || pos?.posNr || '–';
            const matName = booking.positionName || (booking as any).itemText || pos?.shortText || 'Material verbaut';
            const reasonOrNote = ((booking as any).reason || booking.note || '').trim();

            const isAlert = booking.type === 'over_consumption_alert' || (booking as any).isAlert || (booking as any).requestedTotal !== undefined;
            const isCompletion = booking.type === 'room_completion' || (booking as any).itemId === 'room_completion';

            const rawDate = booking.timestamp || booking.createdAt || (booking as any).syncedAt;
            const dateStr = rawDate 
              ? new Date(rawDate).toLocaleString('de-DE', {
                  day: '2-digit',
                  month: '2-digit',
                  year: 'numeric',
                  hour: '2-digit',
                  minute: '2-digit'
                })
              : '–';

            const photos = (booking.photoUrls || (booking as any).photoUris || []).filter(Boolean);

            return (
              <div 
                key={booking.id} 
                className={`bg-white rounded-2xl border p-5 shadow-xs transition-all hover:shadow-md space-y-3.5 ${
                  isAlert 
                    ? 'border-red-300 bg-red-50/15 ring-1 ring-red-200/50' 
                    : isCompletion
                      ? 'border-emerald-300 bg-emerald-50/10 ring-1 ring-emerald-200/50'
                      : 'border-slate-200'
                }`}
              >
                {/* Top Row: Monteur, Date/Time, Room, Quantity Badge */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
                  {/* Monteur & Meta */}
                  <div className="flex items-center space-x-3">
                    <div className={`w-10 h-10 rounded-xl font-bold flex items-center justify-center shrink-0 ${
                      isAlert 
                        ? 'bg-red-100 text-red-700' 
                        : isCompletion 
                          ? 'bg-emerald-100 text-emerald-700' 
                          : 'bg-blue-50 text-[#3B82C4]'
                    }`}>
                      {isAlert ? <AlertTriangle className="w-5 h-5" /> : <User className="w-5 h-5" />}
                    </div>

                    <div>
                      <div className="flex items-center space-x-2">
                        <span className="font-bold text-slate-900 text-sm">
                          {booking.createdBy || 'Monteur'}
                        </span>
                        {isAlert && (
                          <span className="text-[10px] font-black uppercase tracking-wider text-red-700 bg-red-100 border border-red-200 px-2 py-0.5 rounded-full">
                            Mehrverbrauch
                          </span>
                        )}
                        {isCompletion && (
                          <span className="text-[10px] font-black uppercase tracking-wider text-emerald-700 bg-emerald-100 border border-emerald-200 px-2 py-0.5 rounded-full">
                            Raumabschluss 100%
                          </span>
                        )}
                      </div>

                      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-400 mt-0.5">
                        <span className="flex items-center space-x-1 font-mono text-slate-600">
                          <Clock className="w-3.5 h-3.5 text-slate-400" />
                          <span>{dateStr} Uhr</span>
                          {booking.calendarWeek && (
                            <span className="text-slate-400 font-sans ml-0.5">(KW {booking.calendarWeek})</span>
                          )}
                        </span>

                        <span>•</span>

                        <span className="flex items-center space-x-1 text-[#3B82C4] font-medium">
                          <MapPin className="w-3.5 h-3.5 shrink-0" />
                          <span>
                            {room ? `${room.name} (${room.code || 'Raum'})` : (booking.roomName || 'Baustelle')}
                          </span>
                          {room?.floor && (
                            <span className="text-slate-400 font-normal">[{room.floor}]</span>
                          )}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Quantity & Delta Badge */}
                  <div className="flex items-center space-x-2 self-start sm:self-center">
                    <span className={`text-xs px-3 py-1 rounded-xl font-mono font-black shadow-2xs ${
                      isAlert 
                        ? 'bg-red-600 text-white' 
                        : isCompletion 
                          ? 'bg-emerald-600 text-white' 
                          : 'bg-emerald-100 text-emerald-800'
                    }`}>
                      +{booking.quantity} {booking.qu || pos?.qu || 'Stk'}
                    </span>
                  </div>
                </div>

                {/* Middle Row: Exact Material Position & Description */}
                <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div className="space-y-0.5">
                    <div className="flex items-center space-x-2 text-xs">
                      <span className="font-mono font-bold text-[#3B82C4] bg-blue-50 px-2 py-0.5 rounded border border-blue-100">
                        Pos. {posNr}
                      </span>
                      <span className="font-bold text-slate-900 text-sm">
                        {matName}
                      </span>
                    </div>

                    {isAlert && ((booking as any).plannedQty || (booking as any).requestedTotal) && (
                      <p className="text-[11px] text-slate-500 font-mono pt-0.5">
                        Plan-Menge für Raum: {(booking as any).plannedQty || 1} {booking.qu || 'Stk'} • Neuer Ist-Stand: {(booking as any).requestedTotal || (((booking as any).plannedQty || 1) + booking.quantity)} {booking.qu || 'Stk'}
                      </p>
                    )}
                  </div>
                </div>

                {/* Reason / Monteur Note Box if present */}
                {reasonOrNote && (
                  <div className={`p-3 rounded-xl text-xs space-y-1 ${
                    isAlert 
                      ? 'bg-amber-50/90 border border-amber-200 text-amber-950' 
                      : 'bg-slate-50 border border-slate-100 text-slate-700'
                  }`}>
                    <div className="flex items-center space-x-1.5 font-bold text-[10px] uppercase tracking-wider text-slate-500">
                      {isAlert && <AlertTriangle className="w-3 h-3 text-amber-600" />}
                      <span>{isAlert ? 'Grund für Mehrverbrauch / Abweichung:' : 'Notiz vom Monteur:'}</span>
                    </div>
                    <p className="italic leading-relaxed font-medium">„{reasonOrNote}“</p>
                  </div>
                )}

                {/* Photos if attached */}
                {photos.length > 0 && (
                  <div className="space-y-1.5 pt-1">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                      Vor-Ort Fotobelege ({photos.length})
                    </span>
                    <div className="flex flex-wrap gap-2">
                      {photos.map((url: string, pIdx: number) => (
                        <div 
                          key={pIdx} 
                          onClick={() => setSelectedImage(url)}
                          className="w-16 h-16 rounded-xl border border-slate-200 overflow-hidden cursor-pointer hover:opacity-80 transition-opacity bg-slate-100 shadow-2xs relative group"
                        >
                          <img 
                            src={url} 
                            alt={`Beleg ${pIdx + 1}`} 
                            className="w-full h-full object-cover"
                            loading="lazy"
                          />
                          <div className="absolute inset-0 bg-black/30 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity text-white">
                            <Eye className="w-4 h-4" />
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

      {/* Fullscreen Photo Modal */}
      {selectedImage && (
        <div 
          onClick={() => setSelectedImage(null)}
          className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4 backdrop-blur-xs animate-in fade-in duration-150 cursor-pointer"
        >
          <div className="relative max-w-4xl max-h-[90vh] bg-slate-900 rounded-2xl overflow-hidden shadow-2xl p-2" onClick={e => e.stopPropagation()}>
            <button
              onClick={() => setSelectedImage(null)}
              className="absolute top-4 right-4 p-2 rounded-full bg-black/60 text-white hover:bg-black transition-colors z-10 cursor-pointer"
              title="Schließen"
            >
              <X className="w-5 h-5" />
            </button>
            <img 
              src={selectedImage} 
              alt="Baustellen-Beleg Großansicht" 
              className="max-h-[85vh] w-auto mx-auto object-contain rounded-xl"
            />
          </div>
        </div>
      )}
    </div>
  );
};
