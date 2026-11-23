import React, { useMemo } from 'react';
import type { Position } from '../../types';
import { DollarSign, TrendingUp, Sparkles, CheckCircle2 } from 'lucide-react';

interface CommercialDeltaBarProps {
  positions: Position[];
  canViewCommercial: boolean;
}

export const CommercialDeltaBar: React.FC<CommercialDeltaBarProps> = ({
  positions,
  canViewCommercial
}) => {
  const metrics = useMemo(() => {
    let originalSum = 0;
    let addendumSum = 0;
    let currentInstalledSum = 0;
    let openOrdersCount = 0;

    positions.forEach(p => {
      const isOriginal = p.sourceType !== 'CUSTOM_ADDED';
      const planQty = Number(p.qty) || 0;
      const installedQty = Number(p.installedQty) || 0;
      const price = Number(p.unitPriceVK ?? p.unitPrice ?? 0);

      if (isOriginal) {
        originalSum += planQty * price;
        // Check for overconsumption on original items
        if (installedQty > planQty) {
          addendumSum += (installedQty - planQty) * price;
        }
      } else {
        // Custom added item (Nachtrag / Wunsch-LV)
        addendumSum += planQty * price;
        if (p.orderStatus === 'OPEN' || !p.orderStatus) {
          openOrdersCount++;
        }
      }

      currentInstalledSum += installedQty * price;
    });

    const projectedTotal = originalSum + addendumSum;

    return {
      originalSum,
      addendumSum,
      currentInstalledSum,
      projectedTotal,
      openOrdersCount
    };
  }, [positions]);

  if (!canViewCommercial) return null;

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
      {/* 1. Ursprüngliche Auftragssumme */}
      <div className="bg-white p-3.5 rounded-2xl border border-slate-200 shadow-sm flex items-center justify-between">
        <div>
          <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
            Auftragssumme (Original-LV)
          </p>
          <p className="text-lg font-black text-slate-900 mt-0.5">
            {metrics.originalSum.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €
          </p>
          <p className="text-[10px] text-slate-400 mt-0.5">Basis aus GAEB-Leistungsverzeichnis</p>
        </div>
        <div className="w-9 h-9 rounded-xl bg-slate-100 text-slate-600 flex items-center justify-center shrink-0">
          <DollarSign className="w-4 h-4" />
        </div>
      </div>

      {/* 2. Nachträge & Mehrungen */}
      <div className="bg-white p-3.5 rounded-2xl border border-slate-200 shadow-sm flex items-center justify-between">
        <div>
          <p className="text-[11px] font-semibold text-purple-700 uppercase tracking-wider">
            Nachträge & Mehrungen
          </p>
          <p className="text-lg font-black text-purple-900 mt-0.5">
            +{metrics.addendumSum.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €
          </p>
          <p className="text-[10px] text-purple-600 mt-0.5">
            {metrics.openOrdersCount > 0 ? `${metrics.openOrdersCount} Sonderartikel noch zu bestellen` : 'Alle Positionen bestellt'}
          </p>
        </div>
        <div className="w-9 h-9 rounded-xl bg-purple-100 text-purple-700 flex items-center justify-center shrink-0">
          <Sparkles className="w-4 h-4" />
        </div>
      </div>

      {/* 3. Aktueller Leistungsstand */}
      <div className="bg-white p-3.5 rounded-2xl border border-slate-200 shadow-sm flex items-center justify-between">
        <div>
          <p className="text-[11px] font-semibold text-blue-700 uppercase tracking-wider">
            Aktueller Leistungsstand
          </p>
          <p className="text-lg font-black text-blue-900 mt-0.5">
            {metrics.currentInstalledSum.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €
          </p>
          <p className="text-[10px] text-blue-600 mt-0.5">Aufgemessen & verbaut (Ist-Menge × VK)</p>
        </div>
        <div className="w-9 h-9 rounded-xl bg-blue-100 text-[#3B82C4] flex items-center justify-center shrink-0">
          <TrendingUp className="w-4 h-4" />
        </div>
      </div>

      {/* 4. Hochrechnung Gesamt */}
      <div className="bg-white p-3.5 rounded-2xl border border-slate-200 shadow-sm flex items-center justify-between">
        <div>
          <p className="text-[11px] font-semibold text-emerald-700 uppercase tracking-wider">
            Gesamtvolumen (Prognose)
          </p>
          <p className="text-lg font-black text-emerald-900 mt-0.5">
            {metrics.projectedTotal.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €
          </p>
          <p className="text-[10px] text-emerald-600 mt-0.5">Original + freigegebene Nachträge</p>
        </div>
        <div className="w-9 h-9 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0">
          <CheckCircle2 className="w-4 h-4" />
        </div>
      </div>
    </div>
  );
};
