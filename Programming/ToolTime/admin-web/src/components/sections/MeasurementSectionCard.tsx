import React from 'react';
import type { Position, MeasurementSection } from '../../types';
import { 
  CheckCircle2, 
  Clock, 
  User as UserIcon, 
  Calendar, 
  ChevronDown, 
  ChevronRight, 
  Image, 
  AlertTriangle 
} from 'lucide-react';

interface MeasurementSectionCardProps {
  section: MeasurementSection;
  positions: Position[];
  isExpanded: boolean;
  canApprove: boolean;
  onToggleExpand: () => void;
  onApprove: (id: string) => void;
  onSelectPhoto: (url: string) => void;
}

export const MeasurementSectionCard: React.FC<MeasurementSectionCardProps> = ({
  section,
  positions,
  isExpanded,
  canApprove,
  onToggleExpand,
  onApprove,
  onSelectPhoto
}) => {
  const isApproved = section.status === 'APPROVED';

  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
      {/* Header Row */}
      <div 
        onClick={onToggleExpand}
        className="p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 cursor-pointer hover:bg-slate-50/70 transition-colors"
      >
        <div className="flex items-start space-x-3">
          <button type="button" className="p-1 text-slate-400 hover:text-slate-700 mt-0.5">
            {isExpanded ? <ChevronDown className="w-5 h-5 text-[#3B82C4]" /> : <ChevronRight className="w-5 h-5" />}
          </button>
          <div>
            <div className="flex items-center space-x-2">
              <h3 className="text-sm font-bold text-slate-900">{section.sectionTitle}</h3>
              {isApproved ? (
                <span className="inline-flex items-center space-x-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800">
                  <CheckCircle2 className="w-3 h-3" />
                  <span>Freigegeben</span>
                </span>
              ) : (
                <span className="inline-flex items-center space-x-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-100 text-blue-800">
                  <Clock className="w-3 h-3" />
                  <span>Eingereicht (Prüfung)</span>
                </span>
              )}
            </div>
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-400 mt-1">
              <span className="flex items-center space-x-1">
                <UserIcon className="w-3.5 h-3.5" />
                <span>{section.createdBy}</span>
              </span>
              <span className="flex items-center space-x-1">
                <Calendar className="w-3.5 h-3.5" />
                <span>{new Date(section.createdAt).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</span>
              </span>
              <span>• {section.items?.length || 0} Positionen verbucht</span>
              {section.photos?.length > 0 && <span>• {section.photos.length} Fotos</span>}
            </div>
          </div>
        </div>

        <div className="flex items-center space-x-2 self-end sm:self-auto" onClick={(e) => e.stopPropagation()}>
          {!isApproved && canApprove && (
            <button
              type="button"
              onClick={() => onApprove(section.id)}
              className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold shadow-md shadow-emerald-600/20 flex items-center space-x-1.5 transition-all"
            >
              <CheckCircle2 className="w-4 h-4" />
              <span>Abschnitt freigeben</span>
            </button>
          )}
          {isApproved && (
            <span className="text-[11px] text-emerald-700 font-medium">
              Geprüft von {section.approvedBy || 'Projektleiter'}
            </span>
          )}
        </div>
      </div>

      {/* Expanded Details */}
      {isExpanded && (
        <div className="border-t border-slate-100 p-4 sm:p-5 bg-slate-50/50 space-y-4">
          {/* Positions Table */}
          <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-100 text-slate-500 uppercase text-[10px] font-bold tracking-wider">
                <tr>
                  <th className="py-2.5 px-3 w-28">Pos-Nr</th>
                  <th className="py-2.5 px-3">Bezeichnung</th>
                  <th className="py-2.5 px-3 w-24 text-right">Verbaute Menge</th>
                  <th className="py-2.5 px-3 w-32">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-700">
                {(section.items || []).map((item, idx) => {
                  const matchedPos = positions.find(p => p.id === item.lvItemId || p.posNr === item.posNr);
                  const displayCode = item.posNr || matchedPos?.displayCode || matchedPos?.posNr || '-';
                  const title = item.customDescription || matchedPos?.aliasTitle || matchedPos?.officialTitle || matchedPos?.shortText || 'Unbekannte Position';

                  return (
                    <tr key={idx} className="hover:bg-slate-50">
                      <td className="py-2 px-3 font-mono font-bold text-slate-800">{displayCode}</td>
                      <td className="py-2 px-3 font-medium">
                        {title}
                        {item.isUnplannedMaterial && (
                          <span className="ml-2 inline-flex items-center space-x-1 px-1.5 py-0.5 bg-amber-100 text-amber-800 rounded text-[10px] font-bold">
                            <AlertTriangle className="w-2.5 h-2.5" />
                            <span>Nicht im LV</span>
                          </span>
                        )}
                      </td>
                      <td className="py-2 px-3 text-right font-bold text-slate-900">
                        {item.quantity} {item.qu || matchedPos?.qu || 'Stk'}
                      </td>
                      <td className="py-2 px-3">
                        <span className="text-[11px] text-slate-500">Erfasst</span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Photos Gallery */}
          {section.photos && section.photos.length > 0 && (
            <div className="space-y-2">
              <h4 className="text-xs font-bold text-slate-800 flex items-center space-x-1.5">
                <Image className="w-3.5 h-3.5 text-blue-600" />
                <span>Dokumentationsfotos ({section.photos.length})</span>
              </h4>
              <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
                {section.photos.map((p, pIdx) => (
                  <button
                    key={pIdx}
                    type="button"
                    onClick={() => onSelectPhoto(p.url)}
                    className="aspect-square rounded-xl border border-slate-200 overflow-hidden relative group hover:scale-105 transition-transform shadow-sm"
                  >
                    <img src={p.url} alt="Foto" className="w-full h-full object-cover" />
                    <div className="absolute inset-0 bg-black/30 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white text-[10px]">
                      Großansicht
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
