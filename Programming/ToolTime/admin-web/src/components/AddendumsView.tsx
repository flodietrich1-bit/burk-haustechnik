import React from 'react';
import type { Addendum } from '../types';
import { AlertCircle, CheckCircle, XCircle, User, MapPin } from 'lucide-react';
import { updateAddendumStatus } from '../services/firestoreService';

interface AddendumsViewProps {
  addendums: Addendum[];
}

export const AddendumsView: React.FC<AddendumsViewProps> = ({ addendums }) => {
  const handleApprove = async (id: string) => {
    await updateAddendumStatus(id, 'approved');
  };

  const handleReject = async (id: string) => {
    await updateAddendumStatus(id, 'rejected');
  };

  return (
    <div className="space-y-6">
      <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold text-slate-800">Nachträge & "Material Unklar"</h2>
          <p className="text-xs text-slate-500">
            Freigabe von ungeplantem Material oder Klärungen durch Bauleiter
          </p>
        </div>
      </div>

      <div className="space-y-4">
        {addendums.length === 0 ? (
          <div className="bg-white p-8 text-center rounded-xl border border-slate-200 text-slate-400 text-xs">
            Keine offenen Nachträge vorhanden. Alles im Zeit- und Mengensoll!
          </div>
        ) : (
          addendums.map((add) => {
            const isPending = add.status === 'pending';
            const isApproved = add.status === 'approved';
            const isRejected = add.status === 'rejected';

            return (
              <div key={add.id} className="bg-white rounded-xl border border-slate-200 shadow-sm p-5 space-y-4">
                <div className="flex items-start justify-between">
                  <div className="flex items-center space-x-3">
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center font-bold text-sm ${
                      isApproved ? 'bg-emerald-50 text-emerald-600' : isRejected ? 'bg-red-50 text-red-600' : 'bg-amber-50 text-amber-600'
                    }`}>
                      <AlertCircle className="w-5 h-5" />
                    </div>
                    <div>
                      <h4 className="font-bold text-slate-800 text-sm">{add.title}</h4>
                      <div className="flex items-center space-x-3 text-xs text-slate-400 mt-0.5">
                        <span className="flex items-center space-x-1">
                          <User className="w-3.5 h-3.5" />
                          <span>{add.requestedBy}</span>
                        </span>
                        <span className="flex items-center space-x-1 text-[#3B82C4]">
                          <MapPin className="w-3.5 h-3.5" />
                          <span>{add.roomName || add.roomId}</span>
                        </span>
                      </div>
                    </div>
                  </div>

                  <span className={`px-3 py-1 rounded-full text-xs font-bold ${
                    isApproved ? 'bg-emerald-100 text-emerald-800' : isRejected ? 'bg-red-100 text-red-800' : 'bg-amber-100 text-amber-800'
                  }`}>
                    {isApproved ? 'Freigegeben' : isRejected ? 'Abgelehnt' : 'Ausstehend'}
                  </span>
                </div>

                <div className="bg-slate-50 p-3 rounded-lg border border-slate-100 space-y-1 text-xs">
                  <p className="text-slate-700">{add.description}</p>
                  <div className="font-semibold text-slate-800 pt-1">
                    Anforderung: <span className="text-[#3B82C4] font-bold">{add.quantity} {add.qu}</span>
                  </div>
                </div>

                {isPending && (
                  <div className="flex justify-end space-x-3 pt-2">
                    <button
                      onClick={() => handleReject(add.id)}
                      className="flex items-center space-x-1.5 px-3 py-1.5 bg-red-50 hover:bg-red-100 text-red-700 rounded-lg text-xs font-semibold transition-colors"
                    >
                      <XCircle className="w-4 h-4" />
                      <span>Ablehnen</span>
                    </button>
                    <button
                      onClick={() => handleApprove(add.id)}
                      className="flex items-center space-x-1.5 px-4 py-1.5 bg-[#2FA36B] hover:bg-[#258757] text-white rounded-lg text-xs font-semibold transition-colors shadow-sm"
                    >
                      <CheckCircle className="w-4 h-4" />
                      <span>Freigeben</span>
                    </button>
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
