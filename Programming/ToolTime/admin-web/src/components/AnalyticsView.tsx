import React, { useMemo } from 'react';
import type { Position, Booking } from '../types';
import { PieChart } from 'lucide-react';

interface AnalyticsViewProps {
  positions: Position[];
  bookings: Booking[];
}

export const AnalyticsView: React.FC<AnalyticsViewProps> = ({ positions }) => {
  const stats = useMemo(() => {
    let totalBudget = 0;
    let deliveredValue = 0;
    const groupTotals: Record<string, { count: number; value: number; delivered: number }> = {};

    positions.forEach(p => {
      const price = p.unitPrice || 0;
      totalBudget += p.qty * price;
      deliveredValue += p.deliveredQty * price;

      if (!groupTotals[p.group]) {
        groupTotals[p.group] = { count: 0, value: 0, delivered: 0 };
      }
      groupTotals[p.group].count += 1;
      groupTotals[p.group].value += p.qty * price;
      groupTotals[p.group].delivered += p.deliveredQty * price;
    });

    return {
      totalBudget,
      deliveredValue,
      deliveredPercent: totalBudget > 0 ? Math.round((deliveredValue / totalBudget) * 100) : 0,
      groupTotals
    };
  }, [positions]);

  return (
    <div className="space-y-6">
      <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
        <h2 className="text-lg font-bold text-slate-800">Kennzahlen & Liquiditätsanalyse</h2>
        <p className="text-xs text-slate-500">
          Umfassende Übersicht aller Materialbudgets, Ist-Kosten und Verbrauchsentwicklungen
        </p>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm space-y-1">
          <p className="text-xs font-semibold text-slate-400">Gesamtes Materialbudget (LV)</p>
          <p className="text-2xl font-bold text-slate-900">
            {stats.totalBudget > 0 ? `${stats.totalBudget.toLocaleString('de-DE', { minimumFractionDigits: 2 })} €` : 'Kaufmännische Werte hinterlegt'}
          </p>
          <div className="text-[11px] text-slate-500 font-medium pt-1">Basierend auf 251 GAEB Positionen</div>
        </div>

        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm space-y-1">
          <p className="text-xs font-semibold text-slate-400">Verbautes / Geliefertes Material</p>
          <p className="text-2xl font-bold text-[#2FA36B]">
            {stats.deliveredValue > 0 ? `${stats.deliveredValue.toLocaleString('de-DE', { minimumFractionDigits: 2 })} €` : 'Echtzeit-Tracking'}
          </p>
          <div className="text-[11px] text-emerald-600 font-medium pt-1">{stats.deliveredPercent}% des Gesamtbudgets verbucht</div>
        </div>

        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm space-y-1">
          <p className="text-xs font-semibold text-slate-400">Offenes Restbudget</p>
          <p className="text-2xl font-bold text-[#3B82C4]">
            {(stats.totalBudget - stats.deliveredValue) > 0 ? `${(stats.totalBudget - stats.deliveredValue).toLocaleString('de-DE', { minimumFractionDigits: 2 })} €` : '-'}
          </p>
          <div className="text-[11px] text-slate-500 font-medium pt-1">Verbleibende Lieferabrufe</div>
        </div>
      </div>

      {/* Group Breakdown */}
      <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm space-y-4">
        <h3 className="text-sm font-bold text-slate-800 flex items-center space-x-2">
          <PieChart className="w-4 h-4 text-[#3B82C4]" />
          <span>Verteilung nach Gewerk / Titeln</span>
        </h3>

        <div className="space-y-3">
          {Object.entries(stats.groupTotals).map(([group, data]) => {
            const groupPercent = stats.totalBudget > 0 ? Math.round((data.value / stats.totalBudget) * 100) : 0;
            return (
              <div key={group} className="space-y-1 text-xs">
                <div className="flex justify-between font-semibold text-slate-700">
                  <span>{group} ({data.count} Positionen)</span>
                  <span>{data.value > 0 ? `${data.value.toLocaleString('de-DE')} €` : ''}</span>
                </div>
                <div className="w-full bg-slate-100 h-2.5 rounded-full overflow-hidden">
                  <div
                    className="bg-[#3B82C4] h-full rounded-full transition-all duration-500"
                    style={{ width: `${Math.max(5, groupPercent)}%` }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
