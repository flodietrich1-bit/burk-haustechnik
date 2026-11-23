import React, { useState, useEffect } from 'react';
import type { Position } from '../../types';
import { X, ShieldAlert, Check } from 'lucide-react';

interface LvOriginalEditModalProps {
  isOpen: boolean;
  position: Position | null;
  onClose: () => void;
  onSave: (positionId: string, updates: Partial<Position>) => Promise<void>;
}

export const LvOriginalEditModal: React.FC<LvOriginalEditModalProps> = ({
  isOpen,
  position,
  onClose,
  onSave
}) => {
  const [officialTitle, setOfficialTitle] = useState('');
  const [qty, setQty] = useState<number>(0);
  const [qu, setQu] = useState('Stk');
  const [unitPriceVK, setUnitPriceVK] = useState<number>(0);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (position && isOpen) {
      setOfficialTitle(position.officialTitle || position.shortText || '');
      setQty(Number(position.qty) || 0);
      setQu(position.qu || 'Stk');
      setUnitPriceVK(Number(position.unitPriceVK ?? position.unitPrice ?? 0));
    }
  }, [position, isOpen]);

  if (!isOpen || !position) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!officialTitle.trim()) return;
    setIsSubmitting(true);
    try {
      await onSave(position.id, {
        officialTitle: officialTitle.trim(),
        qty: Number(qty) || 0,
        qu: qu.trim() || 'Stk',
        unitPriceVK: Number(unitPriceVK) || 0,
        unitPrice: Number(unitPriceVK) || 0
      });
      onClose();
    } catch (err: any) {
      alert('Fehler beim Aktualisieren: ' + (err.message || err));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[70] flex items-center justify-center p-4">
      <div className="bg-white w-full max-w-lg rounded-2xl shadow-2xl border border-slate-200 overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="px-6 py-4 bg-purple-900 text-white flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <ShieldAlert className="w-5 h-5 text-purple-300" />
            <h3 className="text-base font-bold">
              Originaltext & Stammdaten bearbeiten: {position.displayCode || position.posNr}
            </h3>
          </div>
          <button type="button" onClick={onClose} className="p-1 rounded-lg hover:bg-white/20 text-white">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Warning Alert */}
        <div className="p-4 bg-purple-50 border-b border-purple-100 flex items-start space-x-3 text-xs text-purple-900">
          <ShieldAlert className="w-4 h-4 text-purple-700 shrink-0 mt-0.5" />
          <p>
            <strong>Achtung Rechnungsstellung:</strong> Der offizielle Text wird unverändert 1:1 in
            Schlussrechnungen und Aufmaß-Protokolle übernommen. Passen Sie diesen nur an, wenn die
            ursprüngliche GAEB-Datei Tipp- oder Formatfehler enthielt.
          </p>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4 text-xs text-slate-700">
          <div>
            <label className="block font-bold text-slate-800 mb-1">
              Offizielle Bezeichnung (GAEB / Rechnungs-Kurztext)
            </label>
            <textarea
              rows={3}
              required
              value={officialTitle}
              onChange={(e) => setOfficialTitle(e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs focus:outline-none focus:border-purple-600 resize-none font-medium"
            />
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block font-bold text-slate-800 mb-1">LV-Planmenge</label>
              <input
                type="number"
                step="any"
                min="0"
                value={qty}
                onChange={(e) => setQty(parseFloat(e.target.value) || 0)}
                className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs focus:outline-none focus:border-purple-600"
              />
            </div>
            <div>
              <label className="block font-bold text-slate-800 mb-1">Einheit</label>
              <input
                type="text"
                value={qu}
                onChange={(e) => setQu(e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs focus:outline-none focus:border-purple-600"
              />
            </div>
            <div>
              <label className="block font-bold text-slate-800 mb-1">VK-Preis (€)</label>
              <input
                type="number"
                step="0.01"
                min="0"
                value={unitPriceVK}
                onChange={(e) => setUnitPriceVK(parseFloat(e.target.value) || 0)}
                className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs focus:outline-none focus:border-purple-600"
              />
            </div>
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
              className="px-5 py-2 bg-purple-700 hover:bg-purple-800 text-white rounded-xl text-xs font-bold shadow-md shadow-purple-700/20 flex items-center space-x-1.5 disabled:opacity-50"
            >
              <Check className="w-4 h-4" />
              <span>{isSubmitting ? 'Speichert...' : 'Originaldaten sichern'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
