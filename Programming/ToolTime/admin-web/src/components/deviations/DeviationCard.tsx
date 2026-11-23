import React from 'react';
import type { UnifiedDeviationItem } from './UnifiedDeviationsView';
import { 
  AlertTriangle, 
  ArrowUpRight, 
  MapPin, 
  Check, 
  FilePlus2 
} from 'lucide-react';

interface DeviationCardProps {
  dev: UnifiedDeviationItem;
  canManage: boolean;
  onAcceptQuantity: (dev: UnifiedDeviationItem) => void;
  onCreateAddendum: (dev: UnifiedDeviationItem) => void;
  onDismiss: (dev: UnifiedDeviationItem) => void;
}

export const DeviationCard: React.FC<DeviationCardProps> = ({
  dev,
  canManage,
  onAcceptQuantity,
  onCreateAddendum,
  onDismiss
}) => {
  return (
    <div className="bg-white rounded-2xl border border-slate-200 p-4 sm:p-5 shadow-sm hover:border-slate-300 transition-colors">
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        {/* Details */}
        <div className="space-y-1.5 flex-1">
          <div className="flex items-center space-x-2">
            {dev.type === 'UNPLANNED_MATERIAL' ? (
              <span className="inline-flex items-center space-x-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800">
                <AlertTriangle className="w-3 h-3 text-amber-600" />
                <span>Nicht im LV</span>
              </span>
            ) : (
              <span className="inline-flex items-center space-x-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-100 text-blue-800">
                <ArrowUpRight className="w-3 h-3 text-blue-600" />
                <span>Mengenmehrung</span>
              </span>
            )}

            <span className="font-mono font-bold text-xs text-slate-800">{dev.posNr}</span>

            {dev.status === 'ACCEPTED_QUANTITY' && (
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800">
                Als Mehrung übernommen
              </span>
            )}
            {dev.status === 'CREATED_ADDENDUM' && (
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-purple-100 text-purple-800">
                Als Nachtrag angelegt
              </span>
            )}
            {dev.status === 'DISMISSED' && (
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-100 text-slate-600">
                Verworfen / Intern
              </span>
            )}
          </div>

          <h3 className="font-bold text-slate-900 text-sm">{dev.title}</h3>

          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-500">
            <span className="flex items-center space-x-1 text-slate-600 font-medium">
              <MapPin className="w-3.5 h-3.5 text-slate-400" />
              <span>{dev.locationLabel}</span>
            </span>
            {dev.monteurName && <span>Monteur: {dev.monteurName}</span>}
            {dev.reason && <span className="italic text-slate-600">„{dev.reason}“</span>}
          </div>
        </div>

        {/* Quantities & Actions */}
        <div className="flex flex-wrap items-center justify-between lg:justify-end gap-4 shrink-0">
          <div className="text-right">
            <div className="text-[11px] text-slate-400">Plan: {dev.plannedQty} {dev.qu}</div>
            <div className="text-sm font-black text-rose-600">
              +{dev.deltaQty} {dev.qu} Mehrverbrauch
            </div>
          </div>

          {/* 3 Action Buttons */}
          {canManage && dev.status === 'OPEN' && (
            <div className="flex items-center space-x-1.5">
              {/* Action 1: Mengenmehrung */}
              <button
                type="button"
                onClick={() => onAcceptQuantity(dev)}
                title="Erhöht die Abrechnungsmenge der bestehenden LV-Position"
                className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold shadow-sm flex items-center space-x-1 transition-all"
              >
                <Check className="w-3.5 h-3.5" />
                <span>Mengenmehrung</span>
              </button>

              {/* Action 2: Nachtrag */}
              <button
                type="button"
                onClick={() => onCreateAddendum(dev)}
                title="Erzeugt eine neue LV-Position als Nachtrag"
                className="px-3 py-1.5 bg-purple-700 hover:bg-purple-800 text-white rounded-xl text-xs font-bold shadow-sm flex items-center space-x-1 transition-all"
              >
                <FilePlus2 className="w-3.5 h-3.5" />
                <span>Als Nachtrag</span>
              </button>

              {/* Action 3: Verwerfen / Intern */}
              <button
                type="button"
                onClick={() => onDismiss(dev)}
                title="Verwerfen / Intern verbuchen (z. B. Bruch/Garantie - taucht nicht im Kundenaufmaß auf)"
                className="px-2.5 py-1.5 border border-slate-300 hover:bg-slate-100 text-slate-600 rounded-xl text-xs font-semibold transition-colors"
              >
                <span>Verwerfen</span>
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
