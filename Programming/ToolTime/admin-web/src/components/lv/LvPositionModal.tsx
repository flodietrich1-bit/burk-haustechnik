import React, { useState, useEffect, useMemo, useRef } from 'react';
import type { Position, CatalogArticle } from '../../types';
import { X, Sparkles, Tag, Info, PlusCircle, Lock, Search } from 'lucide-react';
import { fetchCatalogArticles } from '../../services/catalogArticleService';
import { generateNextCode, generateNextCodeForTrade, suggestUnitForTrade } from '../../services/lvPositionService';

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
  const [qu, setQu] = useState<'Stk' | 'LFM' | string>('Stk');
  const [unitPriceVK, setUnitPriceVK] = useState<number>(0);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(false);

  const suggestDropdownRef = useRef<HTMLDivElement>(null);

  const isTradeLocked = Boolean(defaultTradeCategory || insertAfterPosition);

  // Collect all existing trade names for selection in global mode
  const availableTrades = useMemo(() => {
    const set = new Set<string>();
    existingPositions.forEach(p => {
      const t = (p.tradeCategory || p.group || '').trim();
      if (t) set.add(t);
    });
    return Array.from(set);
  }, [existingPositions]);

  // Combined suggestions: from catalog + distinct existing positions from projects
  const combinedArticles = useMemo(() => {
    const list: CatalogArticle[] = [...catalogArticles];
    const seen = new Set(list.map(a => a.title.toLowerCase().trim()));
    existingPositions.forEach(p => {
      const title = (p.officialTitle || p.shortText || '').trim();
      if (title && !seen.has(title.toLowerCase())) {
        seen.add(title.toLowerCase());
        list.push({
          id: `pos_${p.id}`,
          title,
          aliasTitle: p.aliasTitle || undefined,
          monteurInfo: p.monteurInfo || undefined,
          tradeCategory: p.tradeCategory || p.group || undefined,
          qu: p.qu || 'Stk',
          defaultUnitPriceVK: p.unitPriceVK ?? p.unitPrice ?? undefined
        });
      }
    });
    return list;
  }, [catalogArticles, existingPositions]);

  // Filtered autosuggest list
  const filteredSuggestions = useMemo(() => {
    if (!officialTitle.trim()) return [];
    const q = officialTitle.trim().toLowerCase();
    const lockedTrade = (defaultTradeCategory || insertAfterPosition?.tradeCategory || insertAfterPosition?.group || '').toLowerCase();

    return combinedArticles
      .filter(a => {
        return (
          a.title.toLowerCase().includes(q) ||
          (a.aliasTitle && a.aliasTitle.toLowerCase().includes(q)) ||
          (a.tradeCategory && a.tradeCategory.toLowerCase().includes(q))
        );
      })
      .sort((a, b) => {
        // If locked to a trade, prioritize articles belonging to that trade
        if (isTradeLocked && lockedTrade) {
          const aMatches = (a.tradeCategory || '').toLowerCase() === lockedTrade;
          const bMatches = (b.tradeCategory || '').toLowerCase() === lockedTrade;
          if (aMatches && !bMatches) return -1;
          if (!aMatches && bMatches) return 1;
        }
        return (b.usageCount || 0) - (a.usageCount || 0);
      })
      .slice(0, 8);
  }, [officialTitle, combinedArticles, isTradeLocked, defaultTradeCategory, insertAfterPosition]);

  // Close dropdown on click outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (suggestDropdownRef.current && !suggestDropdownRef.current.contains(e.target as Node)) {
        setShowSuggestions(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Initialize fields on open
  useEffect(() => {
    if (isOpen) {
      fetchCatalogArticles().then(setCatalogArticles).catch(() => {});
      const targetTrade = defaultTradeCategory || insertAfterPosition?.tradeCategory || insertAfterPosition?.group || '';
      const codes = existingPositions.map(p => p.displayCode || p.posNr);

      if (insertAfterPosition) {
        const next = generateNextCode(insertAfterPosition.displayCode || insertAfterPosition.posNr, codes);
        setDisplayCode(next);
        setTradeCategory(targetTrade || 'Allgemein');
        setQu(suggestUnitForTrade(targetTrade));
      } else if (defaultTradeCategory) {
        const next = generateNextCodeForTrade(defaultTradeCategory, existingPositions);
        setDisplayCode(next);
        setTradeCategory(defaultTradeCategory);
        setQu(suggestUnitForTrade(defaultTradeCategory));
      } else {
        // Global mode
        setDisplayCode('');
        setTradeCategory('');
        setQu('Stk');
      }

      setOfficialTitle('');
      setAliasTitle('');
      setMonteurInfo('');
      setQty(1);
      setUnitPriceVK(0);
      setShowSuggestions(false);
    }
  }, [isOpen, insertAfterPosition, defaultTradeCategory, existingPositions]);

  if (!isOpen) return null;

  const handleSelectSuggestion = (art: CatalogArticle) => {
    setOfficialTitle(art.title);
    if (art.aliasTitle) setAliasTitle(art.aliasTitle);
    if (art.monteurInfo) setMonteurInfo(art.monteurInfo);
    if (art.defaultUnitPriceVK) setUnitPriceVK(art.defaultUnitPriceVK);

    // Normalize unit: 'm' -> 'LFM', default 'Stk' or 'LFM'
    const unit = art.qu === 'm' || art.qu === 'LFM' ? 'LFM' : (art.qu === 'Stk' ? 'Stk' : suggestUnitForTrade(art.tradeCategory || tradeCategory, art.title));
    setQu(unit);

    // Trade category assignment
    if (!isTradeLocked) {
      // Global button flow: Auto-recognize trade from article and calculate next code!
      const detectedTrade = art.tradeCategory || availableTrades[0] || 'Allgemein';
      setTradeCategory(detectedTrade);
      setDisplayCode(generateNextCodeForTrade(detectedTrade, existingPositions));
      setQu(suggestUnitForTrade(detectedTrade, art.title));
    }
    // If trade is locked, DO NOT overwrite tradeCategory or displayCode!

    setShowSuggestions(false);
  };

  const handleTradeChange = (newTrade: string) => {
    if (isTradeLocked) return;
    setTradeCategory(newTrade);
    if (newTrade.trim()) {
      setDisplayCode(generateNextCodeForTrade(newTrade, existingPositions));
      setQu(suggestUnitForTrade(newTrade, officialTitle));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!officialTitle.trim()) {
      alert('Bitte geben Sie eine offizielle Bezeichnung an.');
      return;
    }
    const finalTrade = tradeCategory.trim() || defaultTradeCategory || 'Allgemein';
    const finalCode = displayCode.trim() || generateNextCodeForTrade(finalTrade, existingPositions);

    setIsSubmitting(true);
    try {
      await onSave({
        officialTitle: officialTitle.trim(),
        aliasTitle: aliasTitle.trim() || null,
        monteurInfo: monteurInfo.trim() || null,
        displayCode: finalCode,
        tradeCategory: finalTrade,
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
      <div className="bg-white w-full max-w-xl rounded-2xl shadow-2xl border border-slate-200 overflow-hidden animate-in fade-in zoom-in-95 duration-150 flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="px-6 py-4 bg-gradient-to-r from-emerald-700 to-teal-800 text-white flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <Sparkles className="w-5 h-5 text-emerald-300" />
            <h3 className="text-base font-bold">
              {insertAfterPosition 
                ? `Unterposition unter ${insertAfterPosition.displayCode || insertAfterPosition.posNr} einfügen` 
                : isTradeLocked 
                ? `Position in ${tradeCategory || defaultTradeCategory} hinzufügen` 
                : 'Neue LV-Position hinzufügen'}
            </h3>
          </div>
          <button type="button" onClick={onClose} className="p-1 rounded-lg hover:bg-white/20 text-white cursor-pointer">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 overflow-y-auto space-y-4 text-xs text-slate-700">
          {/* 1. Offizielle Bezeichnung mit integriertem Autosuggest */}
          <div className="relative" ref={suggestDropdownRef}>
            <label className="block font-bold text-slate-800 mb-1">
              Offizielle Bezeichnung (GAEB / Rechnung) *
            </label>
            <div className="relative">
              <input
                type="text"
                required
                value={officialTitle}
                onChange={(e) => {
                  setOfficialTitle(e.target.value);
                  setShowSuggestions(true);
                }}
                onFocus={() => {
                  if (officialTitle.trim()) setShowSuggestions(true);
                }}
                placeholder="z. B. Wandtiefspül-WC Renova Nr. 1 oder Viega Sanpress Rohr"
                className="w-full px-3 py-2 pr-8 border border-slate-300 rounded-xl text-xs focus:outline-none focus:border-emerald-500 font-medium"
              />
              <Search className="w-3.5 h-3.5 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            </div>

            {/* Autosuggest Dropdown */}
            {showSuggestions && filteredSuggestions.length > 0 && (
              <div className="absolute left-0 right-0 top-full mt-1 bg-white border border-slate-200 rounded-xl shadow-xl z-30 max-h-56 overflow-y-auto divide-y divide-slate-100 animate-in fade-in duration-100">
                <div className="px-3 py-1.5 bg-slate-50 text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                  Bekannte Artikel &amp; Vorlagen ({filteredSuggestions.length})
                </div>
                {filteredSuggestions.map((art) => (
                  <button
                    key={art.id}
                    type="button"
                    onClick={() => handleSelectSuggestion(art)}
                    className="w-full text-left px-3 py-2 hover:bg-emerald-50/80 transition-colors flex items-start justify-between group cursor-pointer"
                  >
                    <div className="space-y-0.5">
                      <p className="font-bold text-slate-900 group-hover:text-emerald-900">
                        {art.title}
                      </p>
                      {art.aliasTitle && (
                        <p className="text-[11px] text-emerald-700 font-medium flex items-center space-x-1">
                          <Tag className="w-2.5 h-2.5 shrink-0" />
                          <span>Alias: {art.aliasTitle}</span>
                        </p>
                      )}
                      {art.tradeCategory && (
                        <span className="inline-block text-[10px] px-1.5 py-0.2 bg-slate-100 text-slate-600 rounded">
                          Gewerk: {art.tradeCategory}
                        </span>
                      )}
                    </div>
                    <span className="text-[11px] font-mono text-slate-500 group-hover:text-emerald-700 shrink-0 ml-3 self-center">
                      {art.qu === 'm' ? 'LFM' : art.qu || 'Stk'} {art.defaultUnitPriceVK ? `• ${art.defaultUnitPriceVK.toFixed(2)} €` : ''}
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* 2. Monteur-Alias (Zweitname für Baustelle) */}
          <div>
            <label className="block font-bold text-slate-800 mb-1 flex items-center space-x-1">
              <Tag className="w-3.5 h-3.5 text-[#3B82C4]" />
              <span>Monteur-Alias (Wird in Monteur-App fett hervorgehoben)</span>
            </label>
            <input
              type="text"
              value={aliasTitle}
              onChange={(e) => setAliasTitle(e.target.value)}
              placeholder="z. B. Wandtiefspül-WC Geberit (Bleibt dieses Feld leer, gilt offizielle Bezeichnung)"
              className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs focus:outline-none focus:border-[#3B82C4]"
            />
            <p className="text-[10px] text-slate-400 mt-0.5">
              Wird hier nichts eingetragen, sehen Monteure automatisch die offizielle Bezeichnung.
            </p>
          </div>

          {/* 3. Positionsnummer & Gewerk */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block font-bold text-slate-800 mb-1">Positionsnummer (Code)</label>
              <input
                type="text"
                value={displayCode}
                onChange={(e) => setDisplayCode(e.target.value)}
                placeholder="z. B. 02.21"
                className="w-full px-3 py-2 border border-slate-300 rounded-xl font-mono text-xs focus:outline-none focus:border-emerald-500 font-bold bg-white"
              />
            </div>

            <div>
              <label className="block font-bold text-slate-800 mb-1">Gewerk / Kategorie</label>
              {isTradeLocked ? (
                <div className="flex items-center space-x-1.5 px-3 py-2 bg-slate-100 border border-slate-200 rounded-xl text-xs text-slate-700 select-none">
                  <Lock className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                  <span className="font-bold truncate">{tradeCategory || defaultTradeCategory}</span>
                </div>
              ) : (
                <div className="relative">
                  <input
                    type="text"
                    list="available-trades-list"
                    value={tradeCategory}
                    onChange={(e) => handleTradeChange(e.target.value)}
                    placeholder="Gewerk wählen oder eingeben..."
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs focus:outline-none focus:border-emerald-500"
                  />
                  <datalist id="available-trades-list">
                    {availableTrades.map(trade => (
                      <option key={trade} value={trade} />
                    ))}
                  </datalist>
                </div>
              )}
            </div>
          </div>

          {/* 4. Menge, Einheit & VK-Preis */}
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
              <select
                value={qu}
                onChange={(e) => setQu(e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs focus:outline-none focus:border-emerald-500 font-semibold bg-white cursor-pointer"
              >
                <option value="Stk">Stück (Stk)</option>
                <option value="LFM">Laufende Meter (LFM)</option>
                {qu && qu !== 'Stk' && qu !== 'LFM' && (
                  <option value={qu}>{qu}</option>
                )}
              </select>
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

          {/* 5. Zusatzinfo / Montagehinweis */}
          <div>
            <label className="block font-bold text-slate-800 mb-1 flex items-center space-x-1">
              <Info className="w-3.5 h-3.5 text-amber-600" />
              <span>Zusatzinfo / Montagehinweis für Monteur-App (optional)</span>
            </label>
            <textarea
              rows={2}
              value={monteurInfo}
              onChange={(e) => setMonteurInfo(e.target.value)}
              placeholder="z. B. Schellen und Schallschutzmatte sind in Position enthalten"
              className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs focus:outline-none focus:border-amber-500 resize-none"
            />
          </div>

          {/* Modal Actions */}
          <div className="pt-3 border-t border-slate-200 flex justify-end space-x-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 border border-slate-300 rounded-xl text-xs font-semibold text-slate-700 hover:bg-slate-50 cursor-pointer"
            >
              Abbrechen
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold shadow-md shadow-emerald-600/20 flex items-center space-x-1.5 disabled:opacity-50 cursor-pointer"
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
