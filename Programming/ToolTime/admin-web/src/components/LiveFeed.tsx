import React from 'react';
import type { Booking, Room } from '../types';
import { Activity, Calendar, User, MapPin, Image } from 'lucide-react';

interface LiveFeedProps {
  bookings: Booking[];
  rooms: Room[];
}

export const LiveFeed: React.FC<LiveFeedProps> = ({ bookings, rooms }) => {
  const roomMap = new Map(rooms.map(r => [r.id, r.name]));

  return (
    <div className="space-y-6">
      <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold text-slate-800">Live-Monteursbuchungen</h2>
          <p className="text-xs text-slate-500">
            Echtzeit-Feed aller Materialerfassungen von den Monteuren auf der Baustelle
          </p>
        </div>
        <div className="flex items-center space-x-2 bg-emerald-50 text-emerald-700 px-3 py-1.5 rounded-full text-xs font-semibold">
          <Activity className="w-4 h-4 animate-pulse" />
          <span>Live-Sync Aktiv</span>
        </div>
      </div>

      <div className="space-y-4">
        {bookings.length === 0 ? (
          <div className="bg-white p-8 text-center rounded-xl border border-slate-200 text-slate-400 text-xs">
            Noch keine Monteursbuchungen vorhanden.
          </div>
        ) : (
          bookings.map((booking) => {
            const roomName = roomMap.get(booking.roomId) || booking.roomId;
            const dateStr = new Date(booking.createdAt).toLocaleString('de-DE', {
              day: '2-digit',
              month: '2-digit',
              year: 'numeric',
              hour: '2-digit',
              minute: '2-digit'
            });

            return (
              <div key={booking.id} className="bg-white rounded-xl border border-slate-200 shadow-sm p-5 hover:border-slate-300 transition-colors space-y-3">
                <div className="flex items-start justify-between">
                  <div className="flex items-center space-x-3">
                    <div className="w-10 h-10 rounded-full bg-blue-50 text-[#3B82C4] font-bold text-sm flex items-center justify-center">
                      <User className="w-5 h-5" />
                    </div>
                    <div>
                      <h4 className="font-bold text-slate-800 text-sm">{booking.createdBy}</h4>
                      <div className="flex items-center space-x-3 text-xs text-slate-400 mt-0.5">
                        <span className="flex items-center space-x-1">
                          <Calendar className="w-3.5 h-3.5" />
                          <span>{dateStr} (KW {booking.calendarWeek || 37})</span>
                        </span>
                        <span className="flex items-center space-x-1 text-[#3B82C4]">
                          <MapPin className="w-3.5 h-3.5" />
                          <span className="font-medium">{roomName}</span>
                        </span>
                      </div>
                    </div>
                  </div>

                  <span className="bg-emerald-100 text-emerald-800 text-xs px-2.5 py-1 rounded-full font-bold">
                    +{booking.quantity} {booking.qu || 'Stk'}
                  </span>
                </div>

                <div className="bg-slate-50 p-3 rounded-lg border border-slate-100 space-y-1">
                  <div className="text-xs font-bold text-slate-700">
                    <span className="text-[#3B82C4] font-mono mr-2">{booking.positionNr}</span>
                    {booking.positionName}
                  </div>
                  {booking.note && (
                    <p className="text-xs text-slate-500 italic">"{booking.note}"</p>
                  )}
                </div>

                {/* Optional Photo or Signature preview */}
                {booking.photoUrls && booking.photoUrls.length > 0 && (
                  <div className="flex items-center space-x-2 pt-1">
                    <Image className="w-4 h-4 text-slate-400" />
                    <span className="text-xs text-slate-500">{booking.photoUrls.length} Foto(s) angehängt</span>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};
