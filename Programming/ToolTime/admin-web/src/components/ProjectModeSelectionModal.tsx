import React from 'react';
import { LayoutGrid, FileSpreadsheet } from 'lucide-react';

interface ProjectModeSelectionModalProps {
  isOpen: boolean;
  onSelectMode: (mode: 'ROOM_BASED' | 'LV_BASED') => void;
  onCancel: () => void;
}

export const ProjectModeSelectionModal: React.FC<ProjectModeSelectionModalProps> = ({
  isOpen,
  onSelectMode,
  onCancel,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-[60] flex items-center justify-center p-4">
      <div className="bg-white w-full max-w-xl rounded-2xl shadow-2xl border border-slate-200 overflow-hidden animate-in fade-in zoom-in-95 duration-150 flex flex-col">
        {/* Header */}
        <div className="px-6 py-5 bg-gradient-to-r from-slate-900 to-slate-800 text-white flex items-center justify-between">
          <div>
            <h3 className="text-lg font-bold tracking-tight">Architektur-Weiche: Projektabwicklung</h3>
            <p className="text-xs text-slate-300 mt-0.5">
              Verbindliche Festlegung für Aufmaß, Monteur-App und Abrechnung
            </p>
          </div>
        </div>

        {/* Question & Options */}
        <div className="p-6 space-y-4">
          <p className="text-sm font-semibold text-slate-800">
            Wie soll dieses Projekt aufgemessen und abgerechnet werden?
          </p>

          {/* Option 1: ROOM_BASED */}
          <button
            type="button"
            onClick={() => onSelectMode('ROOM_BASED')}
            className="w-full text-left p-4 rounded-xl border-2 border-slate-200 hover:border-[#3B82C4] hover:bg-blue-50/50 transition-all flex items-start space-x-4 group"
          >
            <div className="w-12 h-12 rounded-xl bg-blue-100 text-[#3B82C4] flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
              <LayoutGrid className="w-6 h-6" />
            </div>
            <div className="flex-1">
              <div className="flex items-center justify-between">
                <span className="font-bold text-slate-900 text-sm">
                  Option 1: Nach Räumen / DWG-Plan
                </span>
                <span className="text-[11px] font-semibold uppercase px-2 py-0.5 rounded-full bg-blue-100 text-blue-700">
                  ROOM_BASED
                </span>
              </div>
              <p className="text-xs text-slate-600 mt-1 leading-relaxed">
                Fortschritte und Verbräuche werden raumweise an Etagen und CAD-Plänen erfasst. 
                GAEB-LV-Positionen sind konkreten Räumen zugeordnet.
              </p>
            </div>
          </button>

          {/* Option 2: LV_BASED */}
          <button
            type="button"
            onClick={() => onSelectMode('LV_BASED')}
            className="w-full text-left p-4 rounded-xl border-2 border-slate-200 hover:border-emerald-500 hover:bg-emerald-50/50 transition-all flex items-start space-x-4 group"
          >
            <div className="w-12 h-12 rounded-xl bg-emerald-100 text-emerald-600 flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
              <FileSpreadsheet className="w-6 h-6" />
            </div>
            <div className="flex-1">
              <div className="flex items-center justify-between">
                <span className="font-bold text-slate-900 text-sm">
                  Option 2: Ausschließlich nach Leistungsverzeichnis (LV)
                </span>
                <span className="text-[11px] font-semibold uppercase px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700">
                  LV_BASED
                </span>
              </div>
              <p className="text-xs text-slate-600 mt-1 leading-relaxed">
                Aufmaß erfolgt containerbasiert in Abschnitten (z. B. KW-Warenkörbe). 
                Keine Raum-Erzwingung – das LV bildet die alleinige Grundlage.
              </p>
            </div>
          </button>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 bg-slate-50 border-t border-slate-200 flex justify-end">
          <button
            type="button"
            onClick={onCancel}
            className="px-4 py-2 text-sm font-semibold text-slate-600 hover:text-slate-800"
          >
            Zurück zur Übersicht
          </button>
        </div>
      </div>
    </div>
  );
};
