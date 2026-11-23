import React, { useState, useEffect } from 'react';
import type { Position } from '../../types';
import { X, Tag, Info, Check } from 'lucide-react';

interface LvAliasModalProps {
  isOpen: boolean;
  position: Position | null;
  mode: 'alias' | 'info';
  onClose: () => void;
  onSave: (positionId: string, updates: Partial<Position>) => Promise<void>;
}

export const LvAliasModal: React.FC<LvAliasModalProps> = ({
  isOpen,
  position,
  mode,
  onClose,
  onSave
}) => {
  const [aliasTitle, setAliasTitle] = useState('');
  const [monteurInfo, setMonteurInfo] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (position && isOpen) {
      setAliasTitle(position.aliasTitle || '');
      setMonteurInfo(position.monteurInfo || '');
    }
  }, [position, isOpen]);

  if (!isOpen || !position) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      await onSave(position.id, {
        aliasTitle: aliasTitle.trim() || null,
        monteurInfo: monteurInfo.trim() || null
      });
      onClose();
    } catch (err: any) {
      alert('Fehler beim Speichern: ' + (err.message || err));
    } finally {
      setIsSubmitting(false);
    }
  };

  const isAliasMode = mode === 'alias';

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[70] flex items-center justify-center p-4">
      <div className="bg-white w-full max-w-lg rounded-2xl shadow-2xl border border-slate-200 overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className={`px-6 py-4 text-white flex items-center justify-between ${
          isAliasMode ? 'bg-blue-600' : 'bg-amber-600'
        }`}>
          <div className="flex items-center space-x-2">
            {isAliasMode ? <Tag className="w-5 h-5 text-blue-200" /> : <Info className="w-5 h-5 text-amber-200" />}
            <h3 className="text-base font-bold">
              {isAliasMode ? 'Monteur-Alias pflegen' : 'Montagehinweis / Zusatzinfo'}
            </h3>
          </div>
          <button type="button" onClick={onClose} className="p-1 rounded-lg hover:bg-white/20 text-white">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Position Context */}
        <div className="px-6 py-3 bg-slate-50 border-b border-slate-200 text-xs">
          <span className="font-mono font-bold text-slate-800 mr-2">
            {position.displayCode || position.posNr}
          </span>
          <span className="text-slate-600 font-medium">
            {position.officialTitle || position.shortText}
          </span>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4 text-xs text-slate-700">
          <div>
            <label className="block font-bold text-slate-800 mb-1 flex items-center space-x-1">
              <Tag className="w-3.5 h-3.5 text-blue-600" />
              <span>Verständlicher Monteur-Name (Alias)</span>
            </label>
            <input
              type="text"
              autoFocus={isAliasMode}
              placeholder="z. B. Wandtiefspül-WC Geberit inkl. Schallschutz"
              value={aliasTitle}
              onChange={(e) => setAliasTitle(e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs focus:outline-none focus:border-blue-500 font-medium"
            />
            <p className="text-[11px] text-slate-500 mt-1">
              Wird in der Monteur-App fett hervorgehoben. Der offizielle GAEB-Text bleibt 1:1 darunter erhalten.
            </p>
          </div>

          <div>
            <label className="block font-bold text-slate-800 mb-1 flex items-center space-x-1">
              <Info className="w-3.5 h-3.5 text-amber-600" />
              <span>Zusatzinfo / Montagehinweis für Monteure</span>
            </label>
            <textarea
              rows={3}
              autoFocus={!isAliasMode}
              placeholder="z. B. Sanpress Edelstahl, Schellen und Schallschutz sind in Position enthalten"
              value={monteurInfo}
              onChange={(e) => setMonteurInfo(e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs focus:outline-none focus:border-amber-500 resize-none"
            />
          </div>

          <div className="pt-3 border-t border-slate-200 flex justify-end space-x-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 border border-slate-300 rounded-xl text-xs font-semibold text-slate-700 hover:bg-slate-50"
            >
              Abbrechen
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-5 py-2 bg-[#3B82C4] hover:bg-[#2B6EB0] text-white rounded-xl text-xs font-bold shadow-md shadow-blue-500/20 flex items-center space-x-1.5 disabled:opacity-50"
            >
              <Check className="w-4 h-4" />
              <span>{isSubmitting ? 'Speichert...' : 'Übernehmen'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
