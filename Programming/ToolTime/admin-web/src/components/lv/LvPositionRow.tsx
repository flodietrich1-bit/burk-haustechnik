import React from 'react';
import type { Position } from '../../types';
import { 
  Tag, 
  MessageSquarePlus, 
  Plus, 
  ShieldCheck, 
  Sparkles, 
  Info, 
  Clock, 
  CheckCircle, 
  Truck,
  Ban,
  Undo2,
  Eye,
  EyeOff
} from 'lucide-react';

interface LvPositionRowProps {
  position: Position;
  canEditCommercial: boolean;
  onOpenAlias: (pos: Position) => void;
  onOpenInfo: (pos: Position) => void;
  onInsertBelow: (pos: Position) => void;
  onToggleCancel: (pos: Position) => void;
  onToggleMonteurVisibility: (pos: Position) => void;
  onUpdateStatus: (posId: string, status: 'OPEN' | 'ORDERED' | 'DELIVERED') => void;
  onUpdatePrice: (posId: string, price: number) => void;
}

export const LvPositionRow: React.FC<LvPositionRowProps> = ({
  position,
  canEditCommercial,
  onOpenAlias,
  onOpenInfo,
  onInsertBelow,
  onToggleCancel,
  onToggleMonteurVisibility,
  onUpdateStatus,
  onUpdatePrice
}) => {
  const isOriginal = position.sourceType !== 'CUSTOM_ADDED';
  const isCancelled = Boolean(position.isCancelled || position.status === 'cancelled');
  const isHiddenForMonteur = Boolean(position.hiddenForMonteur);
  const displayCode = position.displayCode || position.posNr;
  const officialTitle = position.officialTitle || position.shortText;
  const aliasTitle = position.aliasTitle;
  const monteurInfo = position.monteurInfo;
  const orderStatus = position.orderStatus || 'OPEN';

  const rowClass = isCancelled
    ? 'bg-slate-100/70 hover:bg-slate-100/95 transition-colors border-b border-slate-200 text-xs text-slate-500 opacity-60'
    : 'hover:bg-slate-50/80 transition-colors border-b border-slate-100 group text-xs text-slate-700';

  return (
    <tr className={rowClass}>
      {/* 1. Pos-Nr & Badge */}
      <td className="py-3 px-3 align-top font-mono font-bold whitespace-nowrap">
        <div className="flex flex-col space-y-1">
          <span className={isCancelled ? 'line-through text-slate-400' : 'text-slate-800'}>{displayCode}</span>
          <div>
            {isCancelled ? (
              <span className="inline-flex items-center space-x-1 px-1.5 py-0.5 rounded text-[10px] font-bold bg-slate-200 text-slate-600 border border-slate-300">
                <Ban className="w-2.5 h-2.5 text-slate-500" />
                <span>Gestrichen</span>
              </span>
            ) : isOriginal ? (
              <span className="inline-flex items-center space-x-1 px-1.5 py-0.5 rounded text-[10px] font-semibold bg-slate-100 text-slate-600 border border-slate-200">
                <ShieldCheck className="w-2.5 h-2.5 text-slate-500" />
                <span>Original-LV</span>
              </span>
            ) : (
              <span className="inline-flex items-center space-x-1 px-1.5 py-0.5 rounded text-[10px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                <Sparkles className="w-2.5 h-2.5 text-emerald-600" />
                <span>Ergänzt</span>
              </span>
            )}
          </div>
        </div>
      </td>

      {/* 2. Text (Alias bold + Official Title klein + Monteurhinweis) */}
      <td className="py-3 px-3 align-top max-w-md">
        <div className="space-y-1">
          {aliasTitle ? (
            <div>
              <p className={`font-bold text-[13px] leading-snug ${isCancelled ? 'line-through text-slate-400' : 'text-slate-900'}`}>
                {aliasTitle}
              </p>
              <p className="text-[11px] text-slate-400 mt-0.5 flex items-center space-x-1">
                <span className="font-medium text-slate-500">Original:</span>
                <span className={`truncate ${isCancelled ? 'line-through' : ''}`}>{officialTitle}</span>
              </p>
            </div>
          ) : (
            <p className={`font-semibold text-[13px] leading-snug ${isCancelled ? 'line-through text-slate-400' : 'text-slate-800'}`}>
              {officialTitle}
            </p>
          )}

          {monteurInfo && (
            <div className={`inline-flex items-center space-x-1 px-2 py-0.5 rounded border text-[11px] ${
              isCancelled ? 'bg-slate-100 text-slate-400 border-slate-200 line-through' : 'bg-amber-50 text-amber-800 border-amber-200'
            }`}>
              <Info className="w-3 h-3 text-amber-600 shrink-0" />
              <span>{monteurInfo}</span>
            </div>
          )}
        </div>
      </td>

      {/* 3. Menge & Einheit */}
      <td className="py-3 px-3 align-top whitespace-nowrap text-right">
        <span className={`font-bold text-xs ${isCancelled ? 'line-through text-slate-400' : 'text-slate-800'}`}>
          {Number(position.qty).toLocaleString('de-DE')}
        </span>
        <span className={`ml-1 text-[11px] ${isCancelled ? 'line-through text-slate-400' : 'text-slate-500'}`}>{position.qu}</span>
      </td>

      {/* 4. VK-Preis (Kaufmännisch / Projektleiter) */}
      <td className="py-3 px-3 align-top whitespace-nowrap text-right">
        {isCancelled ? (
          <span className="font-mono text-slate-400 line-through text-[11px]">
            {position.unitPriceVK ?? position.unitPrice ?? 0} €
          </span>
        ) : canEditCommercial ? (
          <div className="inline-flex items-center space-x-1 justify-end">
            <input
              type="number"
              step="0.01"
              defaultValue={position.unitPriceVK ?? position.unitPrice ?? 0}
              onBlur={(e) => {
                const val = parseFloat(e.target.value) || 0;
                onUpdatePrice(position.id, val);
              }}
              className="w-20 px-1.5 py-0.5 border border-slate-200 rounded text-right text-xs font-semibold focus:outline-none focus:border-[#3B82C4]"
            />
            <span className="text-slate-400 text-[11px]">€</span>
          </div>
        ) : (
          <span className="text-slate-400 italic text-[11px]">Geschützt</span>
        )}
      </td>

      {/* 5. Bestellstatus */}
      <td className="py-3 px-3 align-top whitespace-nowrap">
        {isCancelled ? (
          <span className="inline-flex items-center space-x-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-slate-200 text-slate-600 border border-slate-300">
            <Ban className="w-3 h-3 text-slate-500" />
            <span>Gestrichen</span>
          </span>
        ) : canEditCommercial ? (
          <select
            value={orderStatus}
            onChange={(e) => onUpdateStatus(position.id, e.target.value as any)}
            className={`text-[11px] font-bold px-2 py-1 rounded-lg border focus:outline-none ${
              orderStatus === 'DELIVERED'
                ? 'bg-emerald-50 text-emerald-700 border-emerald-300'
                : orderStatus === 'ORDERED'
                ? 'bg-blue-50 text-blue-700 border-blue-300'
                : 'bg-slate-50 text-slate-600 border-slate-200'
            }`}
          >
            <option value="OPEN">Offen</option>
            <option value="ORDERED">Bestellt</option>
            <option value="DELIVERED">Geliefert</option>
          </select>
        ) : (
          <span className="inline-flex items-center space-x-1 text-[11px] font-medium text-slate-600">
            {orderStatus === 'DELIVERED' ? (
              <CheckCircle className="w-3.5 h-3.5 text-emerald-600" />
            ) : orderStatus === 'ORDERED' ? (
              <Truck className="w-3.5 h-3.5 text-blue-600" />
            ) : (
              <Clock className="w-3.5 h-3.5 text-slate-400" />
            )}
            <span>{orderStatus === 'DELIVERED' ? 'Geliefert' : orderStatus === 'ORDERED' ? 'Bestellt' : 'Offen'}</span>
          </span>
        )}
      </td>

      {/* 6. Action-Buttons */}
      <td className="py-3 px-3 align-top text-right whitespace-nowrap">
        <div className="flex items-center justify-end space-x-1">
          {/* Button 1: Alias / Monteur-Name */}
          <button
            type="button"
            title="Alias / Monteur-Name hinterlegen"
            onClick={() => onOpenAlias(position)}
            className="p-1.5 rounded-lg border border-slate-200 text-slate-600 hover:text-[#3B82C4] hover:bg-blue-50 hover:border-blue-200 transition-colors cursor-pointer"
          >
            <Tag className="w-3.5 h-3.5" />
          </button>

          {/* Button 2: Zusatzinfo / Montagehinweis */}
          <button
            type="button"
            title="+ Zusatzinfo / Montagehinweis"
            onClick={() => onOpenInfo(position)}
            className="p-1.5 rounded-lg border border-slate-200 text-slate-600 hover:text-amber-600 hover:bg-amber-50 hover:border-amber-200 transition-colors cursor-pointer"
          >
            <MessageSquarePlus className="w-3.5 h-3.5" />
          </button>

          {/* Button 3: Zeile darunter einfügen */}
          <button
            type="button"
            title="Zeile darunter einfügen (z. B. Unterposition)"
            onClick={() => onInsertBelow(position)}
            className="p-1.5 rounded-lg border border-slate-200 text-slate-600 hover:text-emerald-600 hover:bg-emerald-50 hover:border-emerald-200 transition-colors cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
          </button>

          {/* Button 4: Für Monteur ausblenden / einblenden */}
          <button
            type="button"
            title={isHiddenForMonteur ? 'Für Monteur ausgeblendet (klicken zum Einblenden)' : 'Für Monteur sichtbar (klicken zum Ausblenden)'}
            onClick={() => onToggleMonteurVisibility(position)}
            className={`p-1.5 rounded-lg border transition-colors cursor-pointer ${
              isHiddenForMonteur
                ? 'border-slate-300 bg-slate-200/80 text-slate-600 hover:bg-slate-300'
                : 'border-slate-200 text-slate-600 hover:text-[#3B82C4] hover:bg-blue-50 hover:border-blue-200'
            }`}
          >
            {isHiddenForMonteur ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
          </button>

          {/* Button 4: Position streichen / Streichung aufheben */}
          {isCancelled ? (
            <button
              type="button"
              title="Streichung aufheben (wieder aktivieren)"
              onClick={() => onToggleCancel(position)}
              className="p-1.5 rounded-lg border border-amber-300 bg-amber-50 text-amber-700 hover:bg-amber-100 hover:border-amber-400 transition-colors cursor-pointer"
            >
              <Undo2 className="w-3.5 h-3.5" />
            </button>
          ) : (
            <button
              type="button"
              title="Position streichen (entfällt für Monteure)"
              onClick={() => onToggleCancel(position)}
              className="p-1.5 rounded-lg border border-slate-200 text-slate-500 hover:text-rose-600 hover:bg-rose-50 hover:border-rose-200 transition-colors cursor-pointer"
            >
              <Ban className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </td>
    </tr>
  );
};
