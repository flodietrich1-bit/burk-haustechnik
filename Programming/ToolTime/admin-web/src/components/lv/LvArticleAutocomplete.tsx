import React, { useState } from 'react';
import type { CatalogArticle } from '../../types';
import { Search } from 'lucide-react';
import { searchCatalogArticles } from '../../services/catalogArticleService';

interface LvArticleAutocompleteProps {
  catalogArticles: CatalogArticle[];
  onSelectArticle: (article: CatalogArticle) => void;
}

export const LvArticleAutocomplete: React.FC<LvArticleAutocompleteProps> = ({
  catalogArticles,
  onSelectArticle
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [showSuggestions, setShowSuggestions] = useState(false);

  const suggestions = searchCatalogArticles(searchTerm, catalogArticles);

  const handleSelect = (art: CatalogArticle) => {
    onSelectArticle(art);
    setSearchTerm('');
    setShowSuggestions(false);
  };

  return (
    <div className="relative">
      <label className="block font-bold text-slate-800 mb-1">
        Artikel-Vorschlag suchen (Autocomplete)
      </label>
      <div className="relative">
        <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
        <input
          type="text"
          placeholder="Suche nach Geberit WC, Hansgrohe Armatur, Rohr..."
          value={searchTerm}
          onChange={(e) => {
            setSearchTerm(e.target.value);
            setShowSuggestions(true);
          }}
          onFocus={() => setShowSuggestions(true)}
          className="w-full pl-9 pr-4 py-2 border border-slate-300 rounded-xl text-xs focus:outline-none focus:border-emerald-500"
        />
      </div>

      {showSuggestions && suggestions.length > 0 && (
        <div className="absolute left-0 right-0 top-full mt-1 bg-white border border-slate-200 rounded-xl shadow-xl z-20 max-h-48 overflow-y-auto divide-y divide-slate-100">
          {suggestions.map((art) => (
            <button
              key={art.id}
              type="button"
              onClick={() => handleSelect(art)}
              className="w-full text-left px-3 py-2 hover:bg-emerald-50/70 transition-colors flex items-start justify-between group"
            >
              <div>
                <p className="font-bold text-slate-900">{art.title}</p>
                {art.aliasTitle && (
                  <p className="text-[11px] text-emerald-700 font-medium">Alias: {art.aliasTitle}</p>
                )}
                {art.monteurInfo && (
                  <p className="text-[10px] text-slate-500 italic">{art.monteurInfo}</p>
                )}
              </div>
              <span className="text-[10px] text-slate-400 group-hover:text-emerald-700 shrink-0 ml-2">
                {art.qu} • {art.defaultUnitPriceVK ? `${art.defaultUnitPriceVK} €` : ''}
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
};
