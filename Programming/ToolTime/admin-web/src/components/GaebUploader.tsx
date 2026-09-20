import React, { useState } from 'react';
import { UploadCloud, FileCode, AlertCircle, X, ArrowRight } from 'lucide-react';
import { parseGaebFile } from '../services/gaebParser';
import { savePositionsBatch } from '../services/firestoreService';
import type { Position } from '../types';

interface GaebUploaderProps {
  projectId: string;
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export const GaebUploader: React.FC<GaebUploaderProps> = ({
  projectId,
  isOpen,
  onClose,
  onSuccess
}) => {
  const [file, setFile] = useState<File | null>(null);
  const [previewPositions, setPreviewPositions] = useState<Partial<Position>[]>([]);
  const [projectTitle, setProjectTitle] = useState<string>('');
  const [error, setError] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(false);

  if (!isOpen) return null;

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files?.[0];
    if (!selected) return;
    setFile(selected);
    setError('');

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const content = event.target?.result as string;
        const parsed = parseGaebFile(content, selected.name);
        setPreviewPositions(parsed.positions);
        setProjectTitle(parsed.metadata.projectName || selected.name);
      } catch (err: any) {
        setError(err.message || 'Fehler beim Parsen der GAEB-Datei.');
      }
    };
    reader.readAsText(selected);
  };

  const handleUpload = async () => {
    if (previewPositions.length === 0) return;
    setLoading(true);
    setError('');

    try {
      await savePositionsBatch(projectId, previewPositions);
      setLoading(false);
      onSuccess();
      onClose();
    } catch (err: any) {
      setLoading(false);
      setError('Fehler beim Speichern in Firestore: ' + err.message);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl max-w-xl w-full p-6 shadow-2xl border border-slate-100 relative">
        
        <button
          onClick={onClose}
          className="absolute right-4 top-4 text-slate-400 hover:text-slate-600 p-1 rounded-lg transition-colors"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="flex items-center space-x-3 mb-6">
          <div className="w-10 h-10 rounded-xl bg-blue-50 text-[#3B82C4] flex items-center justify-center">
            <UploadCloud className="w-6 h-6" />
          </div>
          <div>
            <h3 className="text-lg font-bold text-slate-800">GAEB / XML Import</h3>
            <p className="text-xs text-slate-500">Lade Leistungsverzeichnis (.X81 / .D83 / .XML) hoch</p>
          </div>
        </div>

        {/* Upload Zone */}
        <div className="border-2 border-dashed border-slate-200 rounded-xl p-6 text-center bg-slate-50/50 hover:bg-slate-50 transition-colors relative">
          <input
            type="file"
            accept=".x81,.d83,.xml,.txt"
            onChange={handleFileSelect}
            className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
          />
          <FileCode className="w-10 h-10 text-slate-400 mx-auto mb-2" />
          <p className="text-sm font-semibold text-slate-700">
            {file ? file.name : 'Klicke hier oder ziehe eine GAEB-Datei rein'}
          </p>
          <p className="text-xs text-slate-400 mt-1">Unterstützt GAEB XML DA81, DA83 & D83 Formate</p>
        </div>

        {error && (
          <div className="mt-4 p-3 bg-red-50 text-red-700 border border-red-200 rounded-lg text-xs flex items-center space-x-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* Preview Summary */}
        {previewPositions.length > 0 && (
          <div className="mt-6 bg-slate-50 rounded-xl p-4 border border-slate-200 space-y-3">
            <div className="flex justify-between items-center text-xs font-semibold text-slate-700">
              <span>Projekttitel:</span>
              <span className="text-[#3B82C4] truncate max-w-xs">{projectTitle}</span>
            </div>
            <div className="flex justify-between items-center text-xs font-semibold text-slate-700">
              <span>Erkannte LV-Positionen:</span>
              <span className="bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded-full font-bold">
                {previewPositions.length} Positionen
              </span>
            </div>

            {/* Snippet preview */}
            <div className="max-h-36 overflow-y-auto divide-y divide-slate-200 text-xs font-mono bg-white rounded-lg p-2 border border-slate-200">
              {previewPositions.slice(0, 5).map((p, idx) => (
                <div key={idx} className="py-1 flex justify-between text-slate-600">
                  <span className="font-bold text-[#3B82C4]">{p.posNr}</span>
                  <span className="truncate max-w-xs">{p.shortText}</span>
                  <span>{p.qty} {p.qu}</span>
                </div>
              ))}
              {previewPositions.length > 5 && (
                <div className="py-1 text-center text-slate-400 italic font-sans text-[11px]">
                  ... und {previewPositions.length - 5} weitere Positionen
                </div>
              )}
            </div>
          </div>
        )}

        {/* Modal Actions */}
        <div className="mt-6 flex justify-end space-x-3">
          <button
            onClick={onClose}
            className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-800 transition-colors"
          >
            Abbrechen
          </button>
          <button
            onClick={handleUpload}
            disabled={previewPositions.length === 0 || loading}
            className="flex items-center space-x-2 bg-[#3B82C4] hover:bg-[#2B6EB0] disabled:bg-slate-300 text-white px-5 py-2 rounded-xl text-xs font-semibold transition-all shadow-md shadow-blue-500/20"
          >
            {loading ? (
              <span>Speichere in Firestore...</span>
            ) : (
              <>
                <span>In Firestore importieren</span>
                <ArrowRight className="w-4 h-4" />
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
