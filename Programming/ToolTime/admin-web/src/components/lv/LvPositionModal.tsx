import React, { useState, useEffect } from 'react';
import type { Position, CatalogArticle } from '../../types';
import { X, Sparkles, Tag, Info, PlusCircle } from 'lucide-react';
import { fetchCatalogArticles } from '../../services/catalogArticleService';
import { generateNextCode } from '../../services/lvPositionService';
import { LvArticleAutocomplete } from './LvArticleAutocomplete';

interface LvPositionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (data: {
    officialTitle: string;
    aliasTitle?: string | null;
    monteurInfo?: string | null;
    displayCode?: string;
    tradeCategory: string;
    qty: number;
    qu: string;
    unitPriceVK?: number | null;
    orderStatus?: 'OPEN' | 'ORDERED' | 'DELIVERED';
  }, insertAfter?: Position) => Promise<void>;
  existingPositions: Position[];
  insertAfterPosition?: Position;
  defaultTradeCategory?: string;
}

export const LvPositionModal: React.FC<LvPositionModalProps> = ({
  isOpen,
  onClose,
  onSave,
  existingPositions,
  insertAfterPosition,
  defaultTradeCategory
}) => {
  const [catalogArticles, setCatalogArticles] = useState<CatalogArticle[]>([]);
  const [displayCode, setDisplayCode] = useState('');
  const [officialTitle, setOfficialTitle] = useState('');
  const [aliasTitle, setAliasTitle] = useState('');
  const [monteurInfo, setMonteurInfo] = useState('');
  const [tradeCategory, setTradeCategory] = useState('');
  const [qty, setQty] = useState<number>(1);
  const [qu, setQu] = useState('Stk');
  const [unitPriceVK, setUnitPriceVK] = useState<number>(0);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (isOpen) {
      fetchCatalogArticles().then(setCatalogArticles);
      const codes = existingPositions.map(p => p.displayCode || p.posNr);
      if (insertAfterPosition) {
        const next = generateNextCode(insertAfterPosition.displayCode || insertAfterPosition.posNr, codes);
        setDisplayCode(next);
        setTradeCategory(insertAfterPosition.tradeCategory || insertAfterPosition.group || defaultTradeCategory || 'Allgemein');
      } else {
        setDisplayCode(`99.${String(existingPositions.length + 1).padStart(2, '0')}`);
        setTradeCategory(defaultTradeCategory || 'Allgemein');
      }
      setOfficialTitle('');
      setAliasTitle('');
      setMonteurInfo('');
      setQty(1);
      setQu('Stk');
      setUnitPriceVK(0);
    }
  }, [isOpen, insertAfterPosition, defaultTradeCategory]);

  if (!isOpen) return null;

  const handleSelectArticle = (art: CatalogArticle) => {
    setOfficialTitle(art.title);
    if (art.aliasTitle) setAliasTitle(art.aliasTitle);
    if (art.monteurInfo) setMonteurInfo(art.monteurInfo);
    if (art.qu) setQu(art.qu);
    if (art.defaultUnitPriceVK) setUnitPriceVK(art.defaultUnitPriceVK);
    if (art.tradeCategory && !tradeCategory) setTradeCategory(art.tradeCategory);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!officialTitle.trim()) {
      alert('Bitte geben Sie mindestens eine Bezeichnung / einen Titel an.');
      return;
    }
    setIsSubmitting(true);
    try {
      await onSave({
        officialTitle: officialTitle.trim(),
        aliasTitle: aliasTitle.trim() || null,
        monteurInfo: monteurInfo.trim() || null,
        displayCode: displayCode.trim() || undefined,
        tradeCategory: tradeCategory.trim() || 'Allgemein',
        qty: Number(qty) || 1,
        qu: qu.trim() || 'Stk',
        unitPriceVK: Number(unitPriceVK) || 0,
        orderStatus: 'OPEN'
      }, insertAfterPosition);
      onClose();
    } catch (err: any) {
      alert('Fehler beim Speichern der Position: ' + (err.message || err));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[70] flex items-center justify-center p-4">
      <div className="bg-white w-full max-w-xl rounded-2xl shadow-2xl border border-slate-200 overflow-hidden animate-in fade-in zoom-in-95 duration-150 flex flex-col max-h-[90vh]">
        <div className="px-6 py-4 bg-gradient-to-r from-emerald-700 to-teal-800 text-white flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <Sparkles className="w-5 h-5 text-emerald-300" />
            <h3 className="text-base font-bold">
              {insertAfterPosition 
                ? `Unterposition unter ${insertAfterPosition.displayCode || insertAfterPosition.posNr} einfügen` 
                : 'Neue LV-Position hinzufügen'}
            </h3>
          </div>
          <button type="button" onClick={onClose} className="p-1 rounded-lg hover:bg-white/20 text-white">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 overflow-y-auto space-y-4 text-xs text-slate-700">
          <LvArticleAutocomplete
            catalogArticles={catalogArticles}
            onSelectArticle={handleSelectArticle}
          />

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block font-bold text-slate-800 mb-1">Positionsnummer (Code)</label>
              <input
                type="text"
                value={displayCode}
                onChange={(e) => setDisplayCode(e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-xl font-mono text-xs focus:outline-none focus:border-emerald-500 font-bold"
              />
            </div>
            <div>
              <label className="block font-bold text-slate-800 mb-1">Gewerk / Kategorie</label>
              <input
                type="text"
                value={tradeCategory}
                onChange={(e) => setTradeCategory(e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs focus:outline-none focus:border-emerald-500"
              />
            </div>
          </div>

          <div>
            <label className="block font-bold text-slate-800 mb-1">
              Offizielle Bezeichnung (GAEB / Rechnung) *
            </label>
            <input
              type="text"
              required
              value={officialTitle}
              onChange={(e) => setOfficialTitle(e.target.value)}
              placeholder="z. B. Wandtiefspül-WC Renova Nr. 1"
              className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs focus:outline-none focus:border-emerald-500"
            />
          </div>

          <div>
            <label className="block font-bold text-slate-800 mb-1 flex items-center space-x-1">
              <Tag className="w-3.5 h-3.5 text-[#3B82C4]" />
              <span>Monteur-Alias (Wird in App fett hervorgehoben)</span>
            </label>
            <input
              type="text"
              value={aliasTitle}
              onChange={(e) => setAliasTitle(e.target.value)}
              placeholder="z. B. Wandtiefspül-WC Geberit inkl. Schallschutz"
              className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs focus:outline-none focus:border-[#3B82C4]"
            />
          </div>

          <div>
            <label className="block font-bold text-slate-800 mb-1 flex items-center space-x-1">
              <Info className="w-3.5 h-3.5 text-amber-600" />
              <span>Zusatzinfo / Montagehinweis für Monteur-App</span>
            </label>
            <textarea
              rows={2}
              value={monteurInfo}
              onChange={(e) => setMonteurInfo(e.target.value)}
              placeholder="z. B. Schellen und Schallschutzmatte sind in Position enthalten"
              className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs focus:outline-none focus:border-amber-500 resize-none"
            />
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block font-bold text-slate-800 mb-1">Menge</label>
              <input
                type="number"
                step="any"
                min="0"
                value={qty}
                onChange={(e) => setQty(parseFloat(e.target.value) || 0)}
                className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs focus:outline-none focus:border-emerald-500"
              />
            </div>
            <div>
              <label className="block font-bold text-slate-800 mb-1">Einheit</label>
              <input
                type="text"
                value={qu}
                onChange={(e) => setQu(e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs focus:outline-none focus:border-emerald-500"
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
                className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs focus:outline-none focus:border-emerald-500"
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
              className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold shadow-md shadow-emerald-600/20 flex items-center space-x-1.5 disabled:opacity-50"
            >
              <PlusCircle className="w-4 h-4" />
              <span>{isSubmitting ? 'Wird gespeichert...' : 'Position anlegen'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
