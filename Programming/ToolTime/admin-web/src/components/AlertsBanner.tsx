import React, { useState } from 'react';
import type { Alert, Project, Position, Room } from '../types';
import { 
  AlertTriangle, 
  ChevronDown, 
  ChevronUp, 
  User, 
  Clock, 
  Mail, 
  ShoppingCart, 
  CheckCircle2, 
  HelpCircle,
  X,
  ExternalLink
} from 'lucide-react';
import { updateAlertStatus } from '../services/firestoreService';

interface AlertsBannerProps {
  projectId: string;
  alerts: Alert[];
  project: Project | null;
  positions: Position[];
  rooms: Room[];
}

export const AlertsBanner: React.FC<AlertsBannerProps> = ({
  projectId,
  alerts,
  project,
  positions,
  rooms
}) => {
  // 1. Default eingeklappt
  const [isExpanded, setIsExpanded] = useState<boolean>(false);
  const [actionChoices, setActionChoices] = useState<Record<string, 'acknowledge' | 'reorder' | 'clarify'>>({});
  const [isEmailModalOpen, setIsEmailModalOpen] = useState<boolean>(false);
  const [reorderQueue, setReorderQueue] = useState<Alert[]>([]);
  const [isProcessing, setIsProcessing] = useState<boolean>(false);

  const openAlerts = alerts.filter(a => a.status === 'open');

  if (alerts.length === 0) return null;

  const posMap = new Map(positions.map(p => [p.posNr, p]));

  // Calculate project-wide metrics for an alert's position
  const getMetricsForAlert = (alert: Alert) => {
    const pos = posMap.get(alert.materialPos);
    const deliveredQty = pos?.deliveredQty || 0;
    const totalQty = pos?.qty || 0;

    // Remaining needed across all unfinished rooms
    const openRooms = rooms.filter(r => r.status !== 'completed');
    let remainingNeeded = 0;
    for (const r of openRooms) {
      for (const m of r.materials || []) {
        if (m.posNr === alert.materialPos) {
          const actual = m.actualQty ?? 0;
          const planned = m.plannedQty ?? 0;
          if (planned > actual) {
            remainingNeeded += (planned - actual);
          }
        }
      }
    }

    return {
      deliveredQty,
      totalQty,
      remainingNeeded: remainingNeeded > 0 ? remainingNeeded : 0
    };
  };

  const handleSelectRadio = (alertId: string, choice: 'acknowledge' | 'reorder' | 'clarify') => {
    setActionChoices(prev => ({ ...prev, [alertId]: choice }));
  };

  const handleApplyChoices = async () => {
    setIsProcessing(true);
    const itemsToReorder: Alert[] = [];

    try {
      for (const alert of openAlerts) {
        const choice = actionChoices[alert.id] || 'clarify';

        if (choice === 'acknowledge') {
          // Nur bestätigen & schließen
          await updateAlertStatus(
            projectId,
            alert.id,
            'acknowledged',
            'Vom Bauleiter als erledigt bestätigt (kein Nachbestellbedarf)'
          );
        } else if (choice === 'reorder') {
          // Vormerken für E-Mail an kaufmännischen Leiter
          itemsToReorder.push(alert);
        }
        // 'clarify': bleibt unverändert offen
      }

      if (itemsToReorder.length > 0) {
        setReorderQueue(itemsToReorder);
        setIsEmailModalOpen(true);
      }
    } finally {
      setIsProcessing(false);
    }
  };

  const handleConfirmReorders = async () => {
    setIsProcessing(true);
    try {
      for (const item of reorderQueue) {
        await updateAlertStatus(
          projectId,
          item.id,
          'reordered',
          `Nachbestellung an kaufmännische Leitung (${project?.commercialManager || 'Sabine Müller'}) übermittelt`
        );
      }
      setIsEmailModalOpen(false);
      setReorderQueue([]);
    } finally {
      setIsProcessing(false);
    }
  };

  // Generate Mailto body
  const kfmEmail = project?.commercialManagerEmail || 's.mueller@burk-haustechnik.de';
  const mailSubject = encodeURIComponent(`Dringende Material-Nachbestellung: ${project?.name || 'Bauvorhaben'}`);
  const mailLines = [
    `Hallo ${project?.commercialManager || 'Frau Müller'},`,
    '',
    `für das Bauvorhaben "${project?.name || 'Hallenbad Weingarten'}" (${project?.projectNumber || ''}) müssen folgende Positionen nachbestellt werden:`,
    '',
    ...reorderQueue.map(item => 
      `- Pos. ${item.materialPos}: ${item.materialName}\n  Menge: +${item.exceededBy} ${item.qu}\n  Raum: ${item.roomName}\n  Begründung Monteur (${item.monteurName}): "${item.reason}"\n`
    ),
    'Bitte beim zuständigen Großhändler auslösen.',
    '',
    `Mit freundlichen Grüßen,\n${project?.projectManager || 'Florian Buck (Bauleiter)'}\nBurk Haustechnik`
  ];
  const mailBody = encodeURIComponent(mailLines.join('\n'));
  const mailtoHref = `mailto:${kfmEmail}?subject=${mailSubject}&body=${mailBody}`;

  return (
    <>
      <div className="bg-gradient-to-r from-amber-500/10 via-red-500/10 to-amber-500/10 border-2 border-amber-400/80 rounded-2xl p-4 sm:p-5 shadow-lg shadow-amber-500/5 transition-all">
        {/* Banner Header (Toggleable) */}
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500 text-white flex items-center justify-center shadow-md shadow-amber-500/30 shrink-0">
              <AlertTriangle className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h3 className="font-bold text-slate-900 text-sm sm:text-base">
                  Material-Überschreitungen & Monteur-Meldungen
                </h3>
                {openAlerts.length > 0 ? (
                  <span className="bg-red-600 text-white text-xs font-bold px-2.5 py-0.5 rounded-full shadow-sm">
                    {openAlerts.length} offen
                  </span>
                ) : (
                  <span className="bg-emerald-600 text-white text-xs font-bold px-2 py-0.5 rounded-full">
                    Alle erledigt
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-600 mt-0.5">
                {isExpanded 
                  ? 'Bauleiter-Entscheidung: Prüfen Sie Vor-Ort-Bedarf vs. Lagerbestände und veranlassen Sie Nachbestellungen.'
                  : `${openAlerts.length} Posten benötigen Feedback durch die Bauleitung (Klicken zum Aufklappen)`}
              </p>
            </div>
          </div>

          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="flex items-center space-x-1.5 px-3 py-1.5 rounded-xl bg-white/90 hover:bg-white text-slate-700 border border-slate-200 text-xs font-semibold shadow-sm transition-all"
          >
            <span>{isExpanded ? 'Einklappen' : 'Meldungen anzeigen'}</span>
            {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>
        </div>

        {/* Expanded Alert List */}
        {isExpanded && (
          <div className="mt-5 space-y-4 animate-in fade-in duration-150">
            {openAlerts.length === 0 ? (
              <div className="bg-white rounded-xl p-5 text-center border border-slate-200">
                <p className="text-xs text-slate-500 font-medium">
                  Aktuell liegen keine offenen Überschreitungsmeldungen vor.
                </p>
              </div>
            ) : (
              <>
                <div className="space-y-3">
                  {openAlerts.map(alert => {
                    const metrics = getMetricsForAlert(alert);
                    const currentChoice = actionChoices[alert.id] || 'clarify';

                    return (
                      <div 
                        key={alert.id}
                        className="bg-white rounded-xl p-4 border border-amber-300 ring-1 ring-amber-200 shadow-sm space-y-3.5"
                      >
                        {/* Title & Material */}
                        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-2.5">
                          <div className="flex items-center space-x-2">
                            <span className="text-xs font-bold bg-slate-900 text-white px-2.5 py-0.5 rounded-lg">
                              {alert.roomName}
                            </span>
                            <span className="text-xs font-mono font-bold text-[#3B82C4] bg-blue-50 border border-blue-200 px-2 py-0.5 rounded">
                              Pos. {alert.materialPos}
                            </span>
                            <span className="text-xs font-semibold text-slate-900">
                              {alert.materialName}
                            </span>
                          </div>

                          <div className="flex items-center space-x-2 text-[11px] text-slate-500">
                            <User className="w-3.5 h-3.5 text-slate-400" />
                            <span>Monteur: <strong>{alert.monteurName}</strong></span>
                            <span>•</span>
                            <Clock className="w-3.5 h-3.5 text-slate-400" />
                            <span>{new Date(alert.createdAt).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })} Uhr</span>
                          </div>
                        </div>

                        {/* 5 DECISION METRICS CARDS */}
                        <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 text-xs">
                          {/* 1. Geplant im Raum */}
                          <div className="bg-slate-50 p-2 rounded-lg border border-slate-200">
                            <span className="text-[10px] text-slate-400 block uppercase font-bold">1. Geplant (Raum)</span>
                            <span className="font-bold text-slate-800 text-sm">{alert.plannedQty} {alert.qu}</span>
                          </div>

                          {/* 2. Verbaut im Raum */}
                          <div className="bg-slate-50 p-2 rounded-lg border border-slate-200">
                            <span className="text-[10px] text-slate-400 block uppercase font-bold">2. Verbaut (Raum)</span>
                            <span className="font-bold text-slate-800 text-sm">{alert.requestedTotal} {alert.qu}</span>
                          </div>

                          {/* 3. Mehrbedarf */}
                          <div className="bg-red-50 p-2 rounded-lg border border-red-200">
                            <span className="text-[10px] text-red-600 block uppercase font-bold">3. Mehrbedarf</span>
                            <span className="font-bold text-red-700 text-sm">+{alert.exceededBy} {alert.qu}</span>
                          </div>

                          {/* 4. Bereits geliefert (Projekt gesamt) */}
                          <div className="bg-blue-50 p-2 rounded-lg border border-blue-200">
                            <span className="text-[10px] text-blue-600 block uppercase font-bold">4. Bereits geliefert</span>
                            <span className="font-bold text-[#3B82C4] text-sm">{metrics.deliveredQty} / {metrics.totalQty} {alert.qu}</span>
                          </div>

                          {/* 5. Noch benötigt für offene Räume */}
                          <div className="bg-amber-50 p-2 rounded-lg border border-amber-200">
                            <span className="text-[10px] text-amber-700 block uppercase font-bold">5. Restbedarf Räume</span>
                            <span className="font-bold text-amber-900 text-sm">~{metrics.remainingNeeded} {alert.qu}</span>
                          </div>
                        </div>

                        {/* Monteur Reason Quote */}
                        <div className="bg-amber-50/80 border-l-4 border-amber-500 px-3 py-1.5 rounded-r text-xs text-slate-800">
                          <span className="font-semibold text-amber-900">Begründung Monteur:</span> "{alert.reason}"
                        </div>

                        {/* 3 RADIO BUTTON OPTIONS FOR BAULEITER */}
                        <div className="pt-2 border-t border-slate-100 flex flex-wrap items-center justify-between gap-3">
                          <span className="text-xs font-bold text-slate-700">Entscheidung Bauleiter:</span>

                          <div className="flex flex-wrap items-center gap-2 text-xs font-medium">
                            {/* Option 1: Bestätigen */}
                            <label className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-lg border cursor-pointer transition-all ${
                              currentChoice === 'acknowledge'
                                ? 'bg-emerald-50 border-emerald-400 text-emerald-900 font-bold ring-1 ring-emerald-300'
                                : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                            }`}>
                              <input
                                type="radio"
                                name={`action_${alert.id}`}
                                value="acknowledge"
                                checked={currentChoice === 'acknowledge'}
                                onChange={() => handleSelectRadio(alert.id, 'acknowledge')}
                                className="text-emerald-600"
                              />
                              <span>Bestätigen (kein Nachbestellen)</span>
                            </label>

                            {/* Option 2: Nachbestellen */}
                            <label className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-lg border cursor-pointer transition-all ${
                              currentChoice === 'reorder'
                                ? 'bg-blue-50 border-blue-400 text-blue-900 font-bold ring-1 ring-blue-300'
                                : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                            }`}>
                              <input
                                type="radio"
                                name={`action_${alert.id}`}
                                value="reorder"
                                checked={currentChoice === 'reorder'}
                                onChange={() => handleSelectRadio(alert.id, 'reorder')}
                                className="text-[#3B82C4]"
                              />
                              <ShoppingCart className="w-3.5 h-3.5 text-[#3B82C4]" />
                              <span>Nachbestellen (an Kfm. Leitung)</span>
                            </label>

                            {/* Option 3: Klären */}
                            <label className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-lg border cursor-pointer transition-all ${
                              currentChoice === 'clarify'
                                ? 'bg-slate-100 border-slate-400 text-slate-900 font-bold'
                                : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                            }`}>
                              <input
                                type="radio"
                                name={`action_${alert.id}`}
                                value="clarify"
                                checked={currentChoice === 'clarify'}
                                onChange={() => handleSelectRadio(alert.id, 'clarify')}
                                className="text-slate-600"
                              />
                              <HelpCircle className="w-3.5 h-3.5 text-slate-400" />
                              <span>Klären (bleibt offen)</span>
                            </label>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Bottom Action Controls */}
                <div className="flex items-center justify-between pt-2 border-t border-amber-300/60">
                  <span className="text-xs text-slate-600">
                    Gewählte Aktionen werden sofort wirksam. Bei "Nachbestellen" öffnet sich das E-Mail-Fenster.
                  </span>

                  <div className="flex items-center space-x-2">
                    <button
                      onClick={() => setIsExpanded(false)}
                      className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 hover:bg-white/80"
                    >
                      Schließen
                    </button>

                    <button
                      disabled={isProcessing}
                      onClick={handleApplyChoices}
                      className="flex items-center space-x-1.5 bg-[#1C2A3B] hover:bg-slate-800 text-white px-5 py-2 rounded-xl text-xs font-bold shadow-sm transition-all hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50"
                    >
                      <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                      <span>Auswahl anwenden</span>
                    </button>
                  </div>
                </div>
              </>
            )}
          </div>
        )}
      </div>

      {/* MODAL: E-MAIL AN KAUFMÄNNISCHEN LEITER */}
      {isEmailModalOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-2xl w-full p-6 shadow-2xl border border-slate-200 space-y-4 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center space-x-2.5">
                <div className="w-9 h-9 rounded-xl bg-blue-50 text-[#3B82C4] flex items-center justify-center">
                  <Mail className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900">
                    Nachbestellung an Kaufmännische Leitung übermitteln
                  </h3>
                  <p className="text-xs text-slate-500">
                    Empfänger: <strong>{project?.commercialManager || 'Sabine Müller'}</strong> ({kfmEmail})
                  </p>
                </div>
              </div>
              <button onClick={() => setIsEmailModalOpen(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Content Preview */}
            <div className="space-y-3 text-xs">
              <div className="bg-slate-50 rounded-xl p-3 border border-slate-200 space-y-1">
                <span className="font-bold text-slate-700 block text-[11px] uppercase tracking-wider">
                  Zu bestellende Positionen ({reorderQueue.length}):
                </span>
                <div className="space-y-1.5 pt-1">
                  {reorderQueue.map(item => (
                    <div key={item.id} className="p-2 bg-white rounded-lg border border-slate-200 flex items-center justify-between">
                      <div>
                        <span className="font-mono font-bold text-[#3B82C4] mr-2">Pos. {item.materialPos}</span>
                        <span className="font-bold text-slate-800">{item.materialName}</span>
                        <span className="text-slate-500 block text-[11px]">
                          Raum: {item.roomName} • Grund: "{item.reason}"
                        </span>
                      </div>
                      <span className="font-bold text-red-600 bg-red-50 border border-red-200 px-2.5 py-1 rounded text-xs shrink-0">
                        +{item.exceededBy} {item.qu}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Action notice */}
              <p className="text-xs text-slate-500">
                Sie können die E-Mail direkt in Ihrem Mail-Client (Outlook, Thunderbird, Apple Mail) öffnen oder die Nachbestellung im System speichern. Sie erscheint danach im Menüpunkt <strong>Nachbestellungen</strong>.
              </p>
            </div>

            {/* Modal Actions */}
            <div className="flex items-center justify-between pt-3 border-t border-slate-100">
              <a
                href={mailtoHref}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center space-x-1.5 bg-slate-100 hover:bg-slate-200 text-slate-800 px-4 py-2 rounded-xl text-xs font-semibold transition-colors"
              >
                <ExternalLink className="w-3.5 h-3.5 text-[#3B82C4]" />
                <span>In E-Mail-Programm öffnen</span>
              </a>

              <div className="flex items-center space-x-2">
                <button
                  onClick={() => setIsEmailModalOpen(false)}
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-500 hover:text-slate-700"
                >
                  Abbrechen
                </button>
                <button
                  disabled={isProcessing}
                  onClick={handleConfirmReorders}
                  className="flex items-center space-x-2 bg-[#3B82C4] hover:bg-[#2B6EB0] text-white px-5 py-2 rounded-xl text-xs font-bold shadow-md shadow-blue-500/20 transition-all hover:scale-[1.02] active:scale-[0.98]"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  <span>Als nachbestellt markieren & schließen</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
