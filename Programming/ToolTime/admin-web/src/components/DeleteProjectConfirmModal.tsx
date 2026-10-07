import React from 'react';
import { AlertTriangle, Loader2 } from 'lucide-react';

interface DeleteProjectConfirmModalProps {
  isOpen: boolean;
  projectName: string;
  isDeleting: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export const DeleteProjectConfirmModal: React.FC<DeleteProjectConfirmModalProps> = ({
  isOpen,
  projectName,
  isDeleting,
  onConfirm,
  onCancel
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div 
        className="bg-white rounded-3xl p-6 sm:p-8 max-w-md w-full shadow-2xl border border-slate-200 animate-in zoom-in-95 duration-200"
        role="dialog"
        aria-modal="true"
      >
        <div className="w-14 h-14 rounded-2xl bg-rose-50 border border-rose-200 text-rose-600 flex items-center justify-center mx-auto mb-4 shadow-xs">
          <AlertTriangle className="w-7 h-7" />
        </div>

        <h3 className="text-xl font-black text-slate-900 text-center tracking-tight">
          Projekt löschen
        </h3>

        <p className="text-sm font-bold text-slate-800 text-center mt-3">
          Bist du sicher, dass du dieses Projekt komplett löschen willst?
        </p>

        {projectName && (
          <div className="mt-3.5 p-3.5 bg-slate-50 border border-slate-200 rounded-2xl text-center">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
              Betroffenes Bauvorhaben
            </span>
            <span className="text-sm font-extrabold text-slate-900 block truncate mt-0.5">
              {projectName}
            </span>
          </div>
        )}

        <p className="text-xs text-slate-500 text-center mt-3 leading-relaxed">
          Dieses Bauvorhaben und alle zugehörigen Daten (Leistungsverzeichnis, Pläne, Räume, Buchungen) werden unwiderruflich gelöscht. Monteure in der App können dieses Projekt anschließend nicht mehr aufrufen.
        </p>

        <div className="mt-6 flex items-center space-x-3">
          <button
            type="button"
            onClick={onCancel}
            disabled={isDeleting}
            className="flex-1 py-3 px-4 rounded-xl text-xs font-bold text-slate-700 bg-slate-100 hover:bg-slate-200 transition-colors cursor-pointer disabled:opacity-50"
          >
            Abbrechen
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={isDeleting}
            className="flex-1 py-3 px-4 rounded-xl text-xs font-bold text-white bg-rose-600 hover:bg-rose-700 shadow-lg shadow-rose-600/25 transition-all cursor-pointer flex items-center justify-center space-x-2 disabled:opacity-50"
          >
            {isDeleting ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Wird gelöscht...</span>
              </>
            ) : (
              <span>Ja</span>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
