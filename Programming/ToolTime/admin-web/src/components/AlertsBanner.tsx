import React, { useState } from 'react';
import type { Alert } from '../types';
import { 
  AlertTriangle, 
  ShoppingCart, 
  FileText, 
  CheckCircle2, 
  ChevronDown, 
  ChevronUp, 
  Clock, 
  User, 
  Archive,
  ArrowRight
} from 'lucide-react';
import { updateAlertStatus } from '../services/firestoreService';

interface AlertsBannerProps {
  projectId: string;
  alerts: Alert[];
}

export const AlertsBanner: React.FC<AlertsBannerProps> = ({ projectId, alerts }) => {
  const [isExpanded, setIsExpanded] = useState<boolean>(true);
  const [filterMode, setFilterMode] = useState<'open' | 'history'>('open');
  const [processingId, setProcessingId] = useState<string | null>(null);

  const openAlerts = alerts.filter(a => a.status === 'open');
  const historyAlerts = alerts.filter(a => a.status !== 'open');
  const displayedAlerts = filterMode === 'open' ? openAlerts : historyAlerts;

  if (alerts.length === 0) {
    return null;
  }

  const handleAction = async (
    alertId: string, 
    status: 'open' | 'reordered' | 'billed' | 'acknowledged',
    note: string
  ) => {
    setProcessingId(alertId);
    try {
      await updateAlertStatus(projectId, alertId, status, note);
    } finally {
      setProcessingId(null);
    }
  };

  return (
    <div className="bg-gradient-to-r from-amber-500/10 via-red-500/10 to-amber-500/10 border-2 border-amber-400/80 rounded-2xl p-4 sm:p-5 shadow-lg shadow-amber-500/5 transition-all">
      {/* Banner Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 rounded-xl bg-amber-500 text-white flex items-center justify-center shadow-md shadow-amber-500/30 shrink-0 animate-pulse">
            <AlertTriangle className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <h3 className="font-bold text-slate-900 text-sm sm:text-base">
                Material-Überschreitungen & Monteur-Meldungen
              </h3>
              {openAlerts.length > 0 ? (
                <span className="bg-red-600 text-white text-xs font-black px-2.5 py-0.5 rounded-full shadow-sm animate-bounce">
                  {openAlerts.length} AKUT
                </span>
              ) : (
                <span className="bg-emerald-600 text-white text-xs font-bold px-2 py-0.5 rounded-full">
                  Alle erledigt
                </span>
              )}
            </div>
            <p className="text-xs text-slate-600 mt-0.5">
              Echtzeit-Meldungen von der Baustelle: Mehrverbrauch über geplanter Raum-Menge
            </p>
          </div>
        </div>

        <div className="flex items-center space-x-2">
          {/* Toggle History / Open */}
          <div className="flex bg-white/80 p-0.5 rounded-lg border border-slate-200 text-xs font-semibold">
            <button
              onClick={() => setFilterMode('open')}
              className={`px-3 py-1 rounded-md transition-all ${
                filterMode === 'open' 
                  ? 'bg-amber-500 text-white shadow-sm' 
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Offen ({openAlerts.length})
            </button>
            <button
              onClick={() => setFilterMode('history')}
              className={`px-3 py-1 rounded-md transition-all ${
                filterMode === 'history' 
                  ? 'bg-slate-800 text-white shadow-sm' 
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Historie ({historyAlerts.length})
            </button>
          </div>

          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="p-1.5 rounded-lg bg-white/80 hover:bg-white text-slate-700 border border-slate-200 transition-all"
            title={isExpanded ? 'Einklappen' : 'Ausklappen'}
          >
            {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {/* Alert List */}
      {isExpanded && (
        <div className="mt-4 space-y-3">
          {displayedAlerts.length === 0 ? (
            <div className="bg-white/90 rounded-xl p-4 text-center border border-slate-200">
              <p className="text-xs text-slate-500 font-medium">
                {filterMode === 'open' 
                  ? 'Aktuell liegen keine offenen Überschreitungsmeldungen vor.' 
                  : 'Noch keine bearbeiteten Meldungen archiviert.'}
              </p>
            </div>
          ) : (
            displayedAlerts.map(alert => {
              const isProcessing = processingId === alert.id;

              return (
                <div 
                  key={alert.id}
                  className={`bg-white rounded-xl p-4 border shadow-sm transition-all flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 ${
                    alert.status === 'open' 
                      ? 'border-amber-300 ring-1 ring-amber-200' 
                      : 'border-slate-200 bg-slate-50/70'
                  }`}
                >
                  {/* Left: Alert Information */}
                  <div className="space-y-1.5 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-xs font-bold bg-slate-900 text-white px-2.5 py-0.5 rounded-lg">
                        {alert.roomName}
                      </span>
                      <span className="text-xs font-mono font-bold text-[#3B82C4] bg-blue-50 border border-blue-200 px-2 py-0.5 rounded">
                        Pos. {alert.materialPos}
                      </span>
                      <span className="text-xs font-semibold text-slate-800">
                        {alert.materialName}
                      </span>
                      {alert.status !== 'open' && (
                        <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${
                          alert.status === 'reordered' 
                            ? 'bg-blue-100 text-blue-800 border border-blue-300' 
                            : alert.status === 'billed'
                            ? 'bg-purple-100 text-purple-800 border border-purple-300'
                            : 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                        }`}>
                          {alert.status === 'reordered' && '🛒 Bei Großhändler nachbestellt'}
                          {alert.status === 'billed' && '📄 Für VOB-Kundenaufmaß erfasst'}
                          {alert.status === 'acknowledged' && '✓ Vom Bauleiter bestätigt'}
                        </span>
                      )}
                    </div>

                    {/* Quantity badges */}
                    <div className="flex flex-wrap items-center gap-3 text-xs">
                      <div className="text-slate-600">
                        Geplant: <strong className="text-slate-900">{alert.plannedQty} {alert.qu}</strong>
                      </div>
                      <ArrowRight className="w-3 h-3 text-slate-400" />
                      <div className="text-slate-600">
                        Benötigt/Verbaut: <strong className="text-slate-900">{alert.requestedTotal} {alert.qu}</strong>
                      </div>
                      <div className="bg-red-100 text-red-700 font-bold px-2 py-0.5 rounded border border-red-200 text-xs">
                        +{alert.exceededBy} {alert.qu} Mehrbedarf
                      </div>
                    </div>

                    {/* Monteur Reason Quote */}
                    <div className="bg-amber-50 border-l-4 border-amber-500 px-3 py-1.5 rounded-r text-xs text-slate-800">
                      <span className="font-semibold text-amber-900">Begründung Monteur:</span> "{alert.reason}"
                    </div>

                    {/* Meta Footer */}
                    <div className="flex flex-wrap items-center gap-4 text-[11px] text-slate-500 pt-0.5">
                      <span className="flex items-center space-x-1">
                        <User className="w-3 h-3 text-slate-400" />
                        <span>Gemeldet von: <strong>{alert.monteurName}</strong></span>
                      </span>
                      <span className="flex items-center space-x-1">
                        <Clock className="w-3 h-3 text-slate-400" />
                        <span>{new Date(alert.createdAt).toLocaleString('de-DE')}</span>
                      </span>
                      {alert.actionNote && (
                        <span className="text-slate-600 italic">
                          Hinweis: {alert.actionNote}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Right: Bauleiter Actions */}
                  {alert.status === 'open' ? (
                    <div className="flex flex-wrap lg:flex-nowrap items-center gap-2 shrink-0">
                      {/* Action 1: Nachbestellung */}
                      <button
                        disabled={isProcessing}
                        onClick={() => handleAction(
                          alert.id, 
                          'reordered', 
                          `Zur Nachbestellung beim Großhändler vorgemerkt (${alert.exceededBy} ${alert.qu})`
                        )}
                        className="flex items-center space-x-1.5 bg-[#3B82C4] hover:bg-[#2B6EB0] text-white px-3 py-2 rounded-lg text-xs font-semibold shadow-sm transition-all hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50"
                        title="Material wird beim Großhändler nachbestellt"
                      >
                        <ShoppingCart className="w-3.5 h-3.5" />
                        <span>Zur Nachbestellung</span>
                      </button>

                      {/* Action 2: Sonderposten VOB Kundenrechnung */}
                      <button
                        disabled={isProcessing}
                        onClick={() => handleAction(
                          alert.id, 
                          'billed', 
                          `Als VOB-Sonderposten für ToolTime Kundenrechnung erfasst (${alert.exceededBy} ${alert.qu})`
                        )}
                        className="flex items-center space-x-1.5 bg-purple-600 hover:bg-purple-700 text-white px-3 py-2 rounded-lg text-xs font-semibold shadow-sm transition-all hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50"
                        title="Mehrverbrauch dem Auftraggeber über Aufmaß in Rechnung stellen"
                      >
                        <FileText className="w-3.5 h-3.5" />
                        <span>Als Sonderposten erfassen</span>
                      </button>

                      {/* Action 3: Bestätigen / Erledigt */}
                      <button
                        disabled={isProcessing}
                        onClick={() => handleAction(
                          alert.id, 
                          'acknowledged', 
                          'Vom Bauleiter geprüft und zur Kenntnis genommen'
                        )}
                        className="flex items-center space-x-1.5 bg-slate-800 hover:bg-slate-900 text-white px-3 py-2 rounded-lg text-xs font-semibold shadow-sm transition-all hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50"
                        title="Zur Kenntnis genommen und archiviert"
                      >
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                        <span>Bestätigen</span>
                      </button>
                    </div>
                  ) : (
                    <div className="flex items-center space-x-2 shrink-0">
                      <button
                        onClick={() => handleAction(alert.id, 'open', '')}
                        className="text-xs text-slate-500 hover:text-slate-700 flex items-center space-x-1 underline"
                      >
                        <Archive className="w-3 h-3" />
                        <span>Wieder öffnen</span>
                      </button>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      )}
    </div>
  );
};
