import React from 'react';
import { Package, CheckCircle, TrendingUp, TrendingDown } from 'lucide-react';

interface MaterialStatsCardsProps {
  totalItems: number;
  exactItems: number;
  overItems: number;
  underItems: number;
}

export const MaterialStatsCards: React.FC<MaterialStatsCardsProps> = ({
  totalItems,
  exactItems,
  overItems,
  underItems
}) => {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex items-center justify-between">
        <div>
          <p className="text-xs font-medium text-slate-500">Gesamt LV-Positionen</p>
          <p className="text-2xl font-bold text-slate-800">{totalItems}</p>
        </div>
        <div className="w-10 h-10 rounded-lg bg-blue-50 text-[#3B82C4] flex items-center justify-center">
          <Package className="w-5 h-5" />
        </div>
      </div>

      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex items-center justify-between">
        <div>
          <p className="text-xs font-medium text-slate-500">Punktgenau / Planmäßig</p>
          <p className="text-2xl font-bold text-slate-700">{exactItems}</p>
        </div>
        <div className="w-10 h-10 rounded-lg bg-slate-100 text-slate-600 flex items-center justify-center">
          <CheckCircle className="w-5 h-5" />
        </div>
      </div>

      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex items-center justify-between">
        <div>
          <p className="text-xs font-medium text-slate-500">Mehrverbrauch (Abweichung)</p>
          <p className="text-2xl font-bold text-rose-600">{overItems}</p>
        </div>
        <div className="w-10 h-10 rounded-lg bg-rose-50 text-rose-600 flex items-center justify-center">
          <TrendingUp className="w-5 h-5" />
        </div>
      </div>

      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex items-center justify-between">
        <div>
          <p className="text-xs font-medium text-slate-500">Minderverbrauch / Ersparnis</p>
          <p className="text-2xl font-bold text-[#2FA36B]">{underItems}</p>
        </div>
        <div className="w-10 h-10 rounded-lg bg-emerald-50 text-[#2FA36B] flex items-center justify-center">
          <TrendingDown className="w-5 h-5" />
        </div>
      </div>
    </div>
  );
};
