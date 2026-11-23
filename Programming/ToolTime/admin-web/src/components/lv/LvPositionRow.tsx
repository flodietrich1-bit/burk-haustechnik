import React from 'react';
import type { Position } from '../../types';
import { 
  Tag, 
  MessageSquarePlus, 
  Plus, 
  FileEdit, 
  ShieldCheck, 
  Sparkles, 
  Info,
  Clock,
  CheckCircle,
  Truck
} from 'lucide-react';

interface LvPositionRowProps {
  position: Position;
  canEditCommercial: boolean;
  onOpenAlias: (pos: Position) => void;
  onOpenInfo: (pos: Position) => void;
  onInsertBelow: (pos: Position) => void;
  onEditOriginal: (pos: Position) => void;
  onUpdateStatus: (posId: string, status: 'OPEN' | 'ORDERED' | 'DELIVERED') => void;
  onUpdatePrice: (posId: string, price: number) => void;
}

export const LvPositionRow: React.FC<LvPositionRowProps> = ({
  position,
  canEditCommercial,
  onOpenAlias,
  onOpenInfo,
  onInsertBelow,
  onEditOriginal,
  onUpdateStatus,
  onUpdatePrice
}) => {
  const isOriginal = position.sourceType !== 'CUSTOM_ADDED';
  const displayCode = position.displayCode || position.posNr;
  const officialTitle = position.officialTitle || position.shortText;
  const aliasTitle = position.aliasTitle;
  const monteurInfo = position.monteurInfo;
  const orderStatus = position.orderStatus || 'OPEN';

  return (
    <tr className="hover:bg-slate-50/80 transition-colors border-b border-slate-100 group text-xs text-slate-700">
      {/* 1. Pos-Nr & Badge */}
      <td className="py-3 px-3 align-top font-mono font-bold text-slate-800 whitespace-nowrap">
        <div className="flex flex-col space-y-1">
          <span>{displayCode}</span>
          <div>
            {isOriginal ? (
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
              <p className="font-bold text-slate-900 text-[13px] leading-snug">
                {aliasTitle}
              </p>
              <p className="text-[11px] text-slate-400 mt-0.5 flex items-center space-x-1">
                <span className="font-medium text-slate-500">Original:</span>
                <span className="truncate">{officialTitle}</span>
              </p>
            </div>
          ) : (
            <p className="font-semibold text-slate-800 text-[13px] leading-snug">
              {officialTitle}
            </p>
          )}

          {monteurInfo && (
            <div className="inline-flex items-center space-x-1 px-2 py-0.5 bg-amber-50 text-amber-800 rounded border border-amber-200 text-[11px]">
              <Info className="w-3 h-3 text-amber-600 shrink-0" />
              <span>{monteurInfo}</span>
            </div>
          )}
        </div>
      </td>

      {/* 3. Menge & Einheit */}
      <td className="py-3 px-3 align-top whitespace-nowrap text-right">
        <span className="font-bold text-slate-800 text-xs">
          {Number(position.qty).toLocaleString('de-DE')}
        </span>
        <span className="text-slate-500 ml-1 text-[11px]">{position.qu}</span>
      </td>

      {/* 4. VK-Preis (Kaufmännisch / Projektleiter) */}
      <td className="py-3 px-3 align-top whitespace-nowrap text-right">
        {canEditCommercial ? (
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
        {canEditCommercial ? (
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
            className="p-1.5 rounded-lg border border-slate-200 text-slate-600 hover:text-[#3B82C4] hover:bg-blue-50 hover:border-blue-200 transition-colors"
          >
            <Tag className="w-3.5 h-3.5" />
          </button>

          {/* Button 2: Zusatzinfo / Montagehinweis */}
          <button
            type="button"
            title="+ Zusatzinfo / Montagehinweis"
            onClick={() => onOpenInfo(position)}
            className="p-1.5 rounded-lg border border-slate-200 text-slate-600 hover:text-amber-600 hover:bg-amber-50 hover:border-amber-200 transition-colors"
          >
            <MessageSquarePlus className="w-3.5 h-3.5" />
          </button>

          {/* Button 3: Zeile darunter einfügen */}
          <button
            type="button"
            title="Zeile darunter einfügen (z. B. Unterposition)"
            onClick={() => onInsertBelow(position)}
            className="p-1.5 rounded-lg border border-slate-200 text-slate-600 hover:text-emerald-600 hover:bg-emerald-50 hover:border-emerald-200 transition-colors"
          >
            <Plus className="w-3.5 h-3.5" />
          </button>

          {/* Button 4: Originaltext / Position bearbeiten (geschützt) */}
          <button
            type="button"
            title="Originaltext / Position bearbeiten (geschützt)"
            onClick={() => onEditOriginal(position)}
            className="p-1.5 rounded-lg border border-slate-200 text-slate-600 hover:text-purple-600 hover:bg-purple-50 hover:border-purple-200 transition-colors"
          >
            <FileEdit className="w-3.5 h-3.5" />
          </button>
        </div>
      </td>
    </tr>
  );
};
