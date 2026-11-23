import React from 'react';
import type { Position } from '../../types';
import type { PositionMetrics } from './useMaterialMetrics';
import { 
  TrendingUp, 
  TrendingDown, 
  CheckCircle, 
  Info, 
  Tag, 
  MessageSquarePlus, 
  Plus, 
  FileEdit,
  ShieldCheck,
  Sparkles
} from 'lucide-react';

interface MaterialBalanceRowProps {
  position: Position;
  metrics: PositionMetrics;
  isEditMode: boolean;
  canEditCommercial: boolean;
  onOpenAlias: (pos: Position) => void;
  onOpenInfo: (pos: Position) => void;
  onInsertBelow: (pos: Position) => void;
  onEditOriginal: (pos: Position) => void;
  onUpdateStatus: (posId: string, status: 'OPEN' | 'ORDERED' | 'DELIVERED') => void;
  onUpdatePrice: (posId: string, price: number) => void;
}

export const MaterialBalanceRow: React.FC<MaterialBalanceRowProps> = ({
  position,
  metrics: m,
  isEditMode,
  canEditCommercial,
  onOpenAlias,
  onOpenInfo,
  onInsertBelow,
  onEditOriginal,
  onUpdateStatus,
  onUpdatePrice
}) => {
  const isCustom = position.sourceType === 'CUSTOM_ADDED';
  const displayCode = position.displayCode || position.posNr;
  const officialTitle = position.officialTitle || position.shortText;
  const aliasTitle = position.aliasTitle;
  const monteurInfo = position.monteurInfo;
  const orderStatus = position.orderStatus || 'OPEN';

  const currentHue = Math.min(142, Math.max(0, Math.round((m.percent / 100) * 142)));
  const progressColor = m.percent === 100 ? '#10B981' : (m.percent === 0 ? '#E2E8F0' : `hsl(${currentHue}, 85%, 44%)`);
  const rowCustomClass = isCustom ? 'bg-rose-50/50 hover:bg-rose-50/80 border-l-4 border-l-rose-500' : 'hover:bg-slate-50/80 border-l-4 border-l-transparent';
  const unitPrice = (position.unitPriceVK ?? position.unitPrice);

  return (
    <tr className={`transition-colors text-xs ${rowCustomClass}`}>
      {/* 1. Pos-Nr & Badges (Rot hervorgehoben für hinzukommende Posten) */}
      <td className="py-3 px-3 align-top font-mono font-bold whitespace-nowrap">
        <div className="flex flex-col space-y-1">
          <span className={isCustom ? 'text-rose-700 font-extrabold' : 'text-[#3B82C4]'}>
            {displayCode}
          </span>
          <div className="flex flex-wrap gap-1">
            {isCustom ? (
              <span className="inline-flex items-center space-x-1 px-1.5 py-0.5 rounded text-[10px] font-bold bg-rose-100 text-rose-700 border border-rose-300">
                <Sparkles className="w-2.5 h-2.5 text-rose-600" />
                <span>Nicht im LV</span>
              </span>
            ) : (
              <span className="inline-flex items-center space-x-1 px-1.5 py-0.5 rounded text-[10px] font-semibold bg-slate-100 text-slate-600 border border-slate-200">
                <ShieldCheck className="w-2.5 h-2.5 text-slate-500" />
                <span>Original-LV</span>
              </span>
            )}
            {(position.isAddendum || position.group === 'Nachträge') && (
              <span className="bg-amber-100 text-amber-900 border border-amber-300 text-[9px] font-bold px-1.5 py-0.2 rounded">
                Nachtrag
              </span>
            )}
          </div>
        </div>
      </td>

      {/* 2. Gewerk / Beschreibung */}
      <td className="py-3 px-3 align-top">
        <div className="space-y-1 max-w-sm xl:max-w-md">
          {aliasTitle ? (
            <div>
              <p className="font-bold text-slate-900 text-[13px] leading-snug">{aliasTitle}</p>
              <p className="text-[11px] text-slate-400 mt-0.5 flex items-center space-x-1 truncate">
                <span className="font-medium text-slate-500">Original:</span>
                <span>{officialTitle}</span>
              </p>
            </div>
          ) : (
            <p className="font-semibold text-slate-800 text-[13px] leading-snug">{officialTitle}</p>
          )}

          <div className="text-[11px] text-slate-400 flex flex-wrap items-center gap-1.5">
            <span>{position.tradeCategory || position.group}</span>
            {position.isCutMaterial && (
              <span className="bg-blue-100 text-blue-700 text-[10px] px-1.5 py-0.2 rounded font-medium">Verschnitt (m)</span>
            )}
          </div>

          {monteurInfo && (
            <div className="inline-flex items-center space-x-1 px-2 py-0.5 bg-amber-50 text-amber-800 rounded border border-amber-200 text-[11px]">
              <Info className="w-3 h-3 text-amber-600 shrink-0" />
              <span>{monteurInfo}</span>
            </div>
          )}
        </div>
      </td>

      {/* 3. Geplant (Soll) */}
      <td className="py-3 px-3 align-top text-right font-medium text-slate-700 whitespace-nowrap">
        {m.planned} {position.qu}
      </td>

      {/* 4. Abweichung bisher */}
      <td className="py-3 px-3 align-top text-center whitespace-nowrap">
        {m.delta > 0 ? (
          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-bold bg-rose-100 text-rose-700 border border-rose-200">
            +{m.delta} {position.qu}
          </span>
        ) : m.delta < 0 ? (
          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
            {m.delta} {position.qu}
          </span>
        ) : (
          <span className="text-slate-400 font-mono text-[11px]">–</span>
        )}
      </td>

      {/* 5. Gesamt Verbaut (Ist) */}
      <td className="py-3 px-3 align-top text-right font-bold text-slate-900 whitespace-nowrap">
        {m.installed} {position.qu}
      </td>

      {/* 6. Noch offen */}
      <td className="py-3 px-3 align-top text-right font-semibold text-slate-600 whitespace-nowrap">
        {m.rest > 0 ? `${m.rest} ${position.qu}` : <span className="text-slate-400">–</span>}
      </td>

      {/* 7. Vorrätig */}
      <td className="py-3 px-3 align-top text-right font-bold whitespace-nowrap">
        <span className={m.stock < m.rest ? 'text-amber-600' : 'text-slate-700'}>{m.stock} {position.qu}</span>
      </td>

      {/* 8. Fortschritt */}
      <td className="py-3 px-3 align-top min-w-[110px]">
        <div className="space-y-1">
          <div className="flex justify-between text-[10px] text-slate-900 font-black"><span>{m.percent}%</span></div>
          <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
            <div className="h-full rounded-full transition-all duration-500" style={{ width: `${m.percent}%`, backgroundColor: progressColor }} />
          </div>
        </div>
      </td>

      {/* 9. Einzelpreis */}
      <td className="py-3 px-3 align-top text-right whitespace-nowrap">
        {isEditMode && canEditCommercial ? (
          <div className="inline-flex items-center space-x-1 justify-end">
            <input
              type="number"
              step="0.01"
              defaultValue={unitPrice ?? 0}
              onBlur={(e) => onUpdatePrice(position.id, parseFloat(e.target.value) || 0)}
              className="w-18 px-1.5 py-0.5 border border-slate-300 rounded text-right text-xs font-semibold focus:outline-none focus:border-[#3B82C4]"
            />
            <span className="text-slate-400 text-[11px]">€</span>
          </div>
        ) : (
          <span className="font-mono text-slate-700">{unitPrice !== undefined && unitPrice !== null ? `${unitPrice.toFixed(2)} €` : '-'}</span>
        )}
      </td>

      {/* 10. Status / Bestellstatus */}
      <td className="py-3 px-3 align-top text-center whitespace-nowrap">
        {isEditMode && canEditCommercial ? (
          <select
            value={orderStatus}
            onChange={(e) => onUpdateStatus(position.id, e.target.value as any)}
            className={`text-[11px] font-bold px-2 py-1 rounded-lg border focus:outline-none ${
              orderStatus === 'DELIVERED' ? 'bg-emerald-50 text-emerald-700 border-emerald-300' : orderStatus === 'ORDERED' ? 'bg-blue-50 text-blue-700 border-blue-300' : 'bg-slate-50 text-slate-600 border-slate-200'
            }`}
          >
            <option value="OPEN">Offen</option>
            <option value="ORDERED">Bestellt</option>
            <option value="DELIVERED">Geliefert</option>
          </select>
        ) : (
          <div>
            {m.delta > 0 ? (
              <span className="inline-flex items-center space-x-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-rose-100 text-rose-800 border border-rose-200">
                <TrendingUp className="w-3 h-3" /><span>Mehrverbrauch</span>
              </span>
            ) : m.deviationType === 'under' ? (
              <span className="inline-flex items-center space-x-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
                <TrendingDown className="w-3 h-3" /><span>Ersparnis</span>
              </span>
            ) : m.isCompleted ? (
              <span className="inline-flex items-center space-x-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-700 border border-slate-200">
                <CheckCircle className="w-3 h-3 text-[#2FA36B]" /><span>Punktgenau</span>
              </span>
            ) : m.isPartial ? (
              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-amber-50 text-amber-700 border border-amber-200">In Montage</span>
            ) : (
              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium bg-slate-50 text-slate-500 border border-slate-200">Offen</span>
            )}
          </div>
        )}
      </td>

      {/* 11. Aktionen (Im Editiermodus sichtbar) */}
      {isEditMode && (
        <td className="py-3 px-3 align-top text-right whitespace-nowrap">
          <div className="flex items-center justify-end space-x-1">
            <button
              type="button"
              title="Alias / Monteur-Name hinterlegen"
              onClick={() => onOpenAlias(position)}
              className="p-1.5 rounded-lg border border-slate-200 text-slate-600 hover:text-[#3B82C4] hover:bg-blue-50 transition-colors"
            >
              <Tag className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              title="+ Zusatzinfo / Montagehinweis"
              onClick={() => onOpenInfo(position)}
              className="p-1.5 rounded-lg border border-slate-200 text-slate-600 hover:text-amber-600 hover:bg-amber-50 transition-colors"
            >
              <MessageSquarePlus className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              title="Zeile darunter einfügen"
              onClick={() => onInsertBelow(position)}
              className="p-1.5 rounded-lg border border-slate-200 text-slate-600 hover:text-emerald-600 hover:bg-emerald-50 transition-colors"
            >
              <Plus className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              title="Originaltext / Position bearbeiten"
              onClick={() => onEditOriginal(position)}
              className="p-1.5 rounded-lg border border-slate-200 text-slate-600 hover:text-purple-600 hover:bg-purple-50 transition-colors"
            >
              <FileEdit className="w-3.5 h-3.5" />
            </button>
          </div>
        </td>
      )}
    </tr>
  );
};
