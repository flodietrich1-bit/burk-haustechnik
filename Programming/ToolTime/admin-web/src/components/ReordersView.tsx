import React, { useState } from 'react';
import type { Alert, Project } from '../types';
import { 
  ShoppingCart, 
  Mail, 
  CheckCircle2, 
  Clock, 
  Check
} from 'lucide-react';
import { updateAlertStatus } from '../services/firestoreService';

interface ReordersViewProps {
  projectId: string;
  projectName: string;
  alerts: Alert[];
  project: Project | null;
}

export const ReordersView: React.FC<ReordersViewProps> = ({
  projectId,
  projectName,
  alerts,
  project
}) => {
  const [filterStatus, setFilterStatus] = useState<'all' | 'reordered' | 'acknowledged'>('all');

  // Filter reordered alerts
  const reorderedAlerts = alerts.filter(a => a.status === 'reordered' || a.actionNote?.includes('Großhändler') || a.actionNote?.includes('Nachbestellung'));

  const displayedList = filterStatus === 'all' 
    ? reorderedAlerts 
    : reorderedAlerts.filter(a => a.status === filterStatus);

  const handleMarkDelivered = async (alertId: string) => {
    await updateAlertStatus(
      projectId, 
      alertId, 
      'acknowledged', 
      'Nachlieferung eingetroffen und am Bauvorhaben verbucht'
    );
  };

  return (
    <div className="space-y-6">
      {/* Header Card */}
      <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div className="flex items-center space-x-3.5">
          <div className="w-12 h-12 rounded-xl bg-gradient-to-tr from-[#3B82C4] to-[#1C2A3B] text-white flex items-center justify-center shadow-md shadow-blue-500/10 shrink-0">
            <ShoppingCart className="w-6 h-6 text-white" />
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <h2 className="text-xl font-bold text-slate-900 tracking-wide">
                Nachbestellungen & Materialbeschaffung
              </h2>
              <span className="bg-blue-100 text-blue-800 text-xs font-bold px-2.5 py-0.5 rounded-full border border-blue-200">
                {reorderedAlerts.length} Positionen
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              Projekt: <strong className="text-slate-800">{projectName}</strong> • Automatisch an die kaufmännische Leitung übermittelte Mehrbedarfe
            </p>
          </div>
        </div>

        {project?.commercialManager && (
          <div className="bg-slate-50 border border-slate-200 px-3.5 py-2 rounded-xl text-xs flex items-center space-x-2.5">
            <Mail className="w-4 h-4 text-[#3B82C4]" />
            <div>
              <span className="text-[10px] text-slate-400 block font-semibold uppercase">Zuständige Kfm. Leitung:</span>
              <span className="font-bold text-slate-800">{project.commercialManager}</span>
              {project.commercialManagerEmail && (
                <span className="text-slate-500 text-[11px] block">{project.commercialManagerEmail}</span>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Filter Tabs */}
      <div className="flex items-center space-x-2">
        {[
          { id: 'all' as const, label: `Alle (${reorderedAlerts.length})` },
          { id: 'reordered' as const, label: `Beim Großhändler (${reorderedAlerts.filter(a => a.status === 'reordered').length})` },
          { id: 'acknowledged' as const, label: `Geliefert / Erledigt (${reorderedAlerts.filter(a => a.status === 'acknowledged').length})` }
        ].map(pill => (
          <button
            key={pill.id}
            onClick={() => setFilterStatus(pill.id)}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold transition-all ${
              filterStatus === pill.id
                ? 'bg-[#1C2A3B] text-white shadow-sm'
                : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
            }`}
          >
            {pill.label}
          </button>
        ))}
      </div>

      {/* Table */}
      <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-100/90 text-slate-700 font-bold border-b border-slate-200 uppercase tracking-wider text-[11px]">
              <tr>
                <th className="py-3.5 px-4">Datum / Zeit</th>
                <th className="py-3.5 px-4">Pos-Nr</th>
                <th className="py-3.5 px-4">Materialbezeichnung</th>
                <th className="py-3.5 px-4">Raum / Bauteil</th>
                <th className="py-3.5 px-4 text-right">Nachbestellte Menge</th>
                <th className="py-3.5 px-4">Begründung des Monteurs</th>
                <th className="py-3.5 px-4">Status / Abwicklung</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {displayedList.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-10 text-center text-slate-400 italic">
                    Bislang liegen keine Nachbestellungen für dieses Bauvorhaben vor.
                  </td>
                </tr>
              ) : (
                displayedList.map(item => {
                  const dateStr = item.reorderedAt || item.updatedAt || item.createdAt;

                  return (
                    <tr key={item.id} className="hover:bg-slate-50/80 transition-colors">
                      {/* Date */}
                      <td className="py-3.5 px-4 whitespace-nowrap text-slate-600">
                        <div className="flex items-center space-x-1.5 font-medium">
                          <Clock className="w-3.5 h-3.5 text-slate-400" />
                          <span>{new Date(dateStr).toLocaleString('de-DE')}</span>
                        </div>
                      </td>

                      {/* Pos-Nr */}
                      <td className="py-3.5 px-4 font-mono font-bold text-[#3B82C4] whitespace-nowrap">
                        {item.materialPos}
                      </td>

                      {/* Material Name */}
                      <td className="py-3.5 px-4 font-semibold text-slate-800 max-w-xs truncate">
                        {item.materialName}
                      </td>

                      {/* Room */}
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        <span className="bg-slate-100 text-slate-800 font-semibold px-2 py-0.5 rounded border border-slate-200">
                          {item.roomName}
                        </span>
                      </td>

                      {/* Quantity */}
                      <td className="py-3.5 px-4 text-right whitespace-nowrap">
                        <span className="font-bold text-red-600 bg-red-50 border border-red-200 px-2 py-0.5 rounded">
                          +{item.exceededBy} {item.qu}
                        </span>
                      </td>

                      {/* Reason */}
                      <td className="py-3.5 px-4 max-w-sm">
                        <div className="bg-amber-50/80 border-l-2 border-amber-400 px-2.5 py-1 rounded-r text-slate-700 text-[11px]">
                          "{item.reason}"
                          <span className="block text-[10px] text-slate-400 mt-0.5">
                            Gemeldet durch: {item.monteurName}
                          </span>
                        </div>
                      </td>

                      {/* Status / Action */}
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        <div className="flex items-center space-x-2">
                          {item.status === 'reordered' ? (
                            <>
                              <span className="inline-flex items-center space-x-1 text-[11px] font-bold bg-blue-100 text-blue-800 border border-blue-200 px-2.5 py-0.5 rounded-full">
                                <ShoppingCart className="w-3 h-3 text-blue-600" />
                                <span>Bei Kfm. Leitung / Großhändler</span>
                              </span>
                              <button
                                onClick={() => handleMarkDelivered(item.id)}
                                className="p-1 text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 rounded"
                                title="Als geliefert markieren"
                              >
                                <Check className="w-4 h-4" />
                              </button>
                            </>
                          ) : (
                            <span className="inline-flex items-center space-x-1 text-[11px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200 px-2.5 py-0.5 rounded-full">
                              <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                              <span>Geliefert & erledigt</span>
                            </span>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
