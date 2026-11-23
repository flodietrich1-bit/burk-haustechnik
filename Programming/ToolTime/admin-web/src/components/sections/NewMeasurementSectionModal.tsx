import React, { useState } from 'react';
import type { Position, User, MeasurementSection, MeasurementSectionItem } from '../../types';
import { X, Plus, Trash2, CheckCircle2, FileSpreadsheet } from 'lucide-react';
import { saveMeasurementSection } from '../../services/measurementSectionService';

interface NewMeasurementSectionModalProps {
  isOpen: boolean;
  onClose: () => void;
  projectId: string;
  positions: Position[];
  currentUser: User | null;
}

export const NewMeasurementSectionModal: React.FC<NewMeasurementSectionModalProps> = ({
  isOpen,
  onClose,
  projectId,
  positions,
  currentUser
}) => {
  const [sectionTitle, setSectionTitle] = useState('KW 48 UG Trinkwasserbereitung');
  const [monteurName, setMonteurName] = useState(currentUser?.name || 'Monteur');
  const [items, setItems] = useState<MeasurementSectionItem[]>([]);
  const [selectedPosId, setSelectedPosId] = useState('');
  const [itemQty, setItemQty] = useState<number>(1);
  const [isUnplanned, setIsUnplanned] = useState(false);
  const [unplannedDesc, setUnplannedDesc] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!isOpen) return null;

  const handleAddItem = () => {
    if (isUnplanned) {
      if (!unplannedDesc.trim()) return;
      setItems(prev => [
        ...prev,
        {
          lvItemId: `unplanned_${Date.now()}`,
          posNr: 'Nicht im LV',
          shortText: unplannedDesc.trim(),
          quantity: Number(itemQty) || 1,
          qu: 'Stk',
          isUnplannedMaterial: true,
          customDescription: unplannedDesc.trim()
        }
      ]);
      setUnplannedDesc('');
      setIsUnplanned(false);
      setItemQty(1);
    } else {
      const pos = positions.find(p => p.id === selectedPosId);
      if (!pos) return;
      setItems(prev => [
        ...prev,
        {
          lvItemId: pos.id,
          posNr: pos.displayCode || pos.posNr,
          shortText: pos.aliasTitle || pos.officialTitle || pos.shortText,
          quantity: Number(itemQty) || 1,
          qu: pos.qu,
          isUnplannedMaterial: false
        }
      ]);
      setSelectedPosId('');
      setItemQty(1);
    }
  };

  const handleRemoveItem = (index: number) => {
    setItems(prev => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!sectionTitle.trim()) {
      alert('Bitte geben Sie einen Titel für den Abschnitt ein.');
      return;
    }
    if (items.length === 0) {
      alert('Bitte fügen Sie mindestens eine Position hinzu.');
      return;
    }

    setIsSubmitting(true);
    try {
      const newSection: MeasurementSection = {
        id: `sec_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
        projectId,
        sectionTitle: sectionTitle.trim(),
        createdAt: new Date().toISOString(),
        createdBy: monteurName.trim() || 'Monteur',
        createdByUid: currentUser?.id,
        items,
        photos: [
          {
            url: 'https://images.unsplash.com/photo-1581244277943-fe4a9c777189?w=500&auto=format&fit=crop',
            timestamp: new Date().toISOString(),
            caption: 'Installationsnachweis'
          }
        ],
        status: 'SUBMITTED'
      };

      await saveMeasurementSection(projectId, newSection);
      onClose();
    } catch (err: any) {
      alert('Fehler beim Speichern: ' + (err.message || err));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[70] flex items-center justify-center p-4">
      <div className="bg-white w-full max-w-xl rounded-2xl shadow-2xl border border-slate-200 overflow-hidden animate-in fade-in zoom-in-95 duration-150 flex flex-col max-h-[90vh]">
        <div className="px-6 py-4 bg-emerald-800 text-white flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <FileSpreadsheet className="w-5 h-5 text-emerald-300" />
            <h3 className="text-base font-bold">Neuen Aufmaß-Abschnitt anlegen</h3>
          </div>
          <button type="button" onClick={onClose} className="p-1 rounded-lg hover:bg-white/20 text-white">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 overflow-y-auto space-y-4 text-xs text-slate-700">
          <div>
            <label className="block font-bold text-slate-800 mb-1">
              Bezeichnung des Abschnitts (Pflichtfeld) *
            </label>
            <input
              type="text"
              required
              value={sectionTitle}
              onChange={(e) => setSectionTitle(e.target.value)}
              placeholder="z. B. KW 48 UG Trinkwasserbereitung"
              className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs focus:outline-none focus:border-emerald-500 font-semibold"
            />
          </div>

          <div>
            <label className="block font-bold text-slate-800 mb-1">Erfasser / Monteur</label>
            <input
              type="text"
              required
              value={monteurName}
              onChange={(e) => setMonteurName(e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs focus:outline-none focus:border-emerald-500"
            />
          </div>

          {/* Item Adder */}
          <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 space-y-3">
            <div className="flex items-center justify-between">
              <span className="font-bold text-slate-800">Position zum Abschnitt hinzufügen</span>
              <label className="flex items-center space-x-1.5 cursor-pointer text-amber-700 font-semibold">
                <input
                  type="checkbox"
                  checked={isUnplanned}
                  onChange={(e) => setIsUnplanned(e.target.checked)}
                  className="rounded text-amber-600 focus:ring-0"
                />
                <span className="text-[11px]">Außerplanmäßig (Nicht im LV)</span>
              </label>
            </div>

            {isUnplanned ? (
              <div>
                <input
                  type="text"
                  placeholder="Beschreibung des Zusatzmaterials (z. B. 2x Muffe DN32)"
                  value={unplannedDesc}
                  onChange={(e) => setUnplannedDesc(e.target.value)}
                  className="w-full px-3 py-1.5 border border-amber-300 rounded-xl text-xs focus:outline-none focus:border-amber-500"
                />
              </div>
            ) : (
              <div>
                <select
                  value={selectedPosId}
                  onChange={(e) => setSelectedPosId(e.target.value)}
                  className="w-full px-3 py-1.5 border border-slate-300 rounded-xl text-xs focus:outline-none focus:border-emerald-500"
                >
                  <option value="">Position aus LV wählen...</option>
                  {positions.map(p => (
                    <option key={p.id} value={p.id}>
                      {p.displayCode || p.posNr} - {p.aliasTitle || p.officialTitle || p.shortText} ({p.qu})
                    </option>
                  ))}
                </select>
              </div>
            )}

            <div className="flex items-center space-x-2">
              <div className="flex items-center space-x-1">
                <span className="text-slate-500">Menge:</span>
                <input
                  type="number"
                  step="any"
                  min="0.1"
                  value={itemQty}
                  onChange={(e) => setItemQty(parseFloat(e.target.value) || 1)}
                  className="w-20 px-2 py-1 border border-slate-300 rounded-lg text-xs font-bold"
                />
              </div>
              <button
                type="button"
                onClick={handleAddItem}
                className="px-3 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold flex items-center space-x-1"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Hinzufügen</span>
              </button>
            </div>
          </div>

          {/* Items List */}
          <div>
            <label className="block font-bold text-slate-800 mb-1">
              Erfasste Positionen ({items.length})
            </label>
            {items.length === 0 ? (
              <p className="text-slate-400 italic text-[11px]">Noch keine Positionen hinzugefügt.</p>
            ) : (
              <div className="divide-y divide-slate-100 border border-slate-200 rounded-xl overflow-hidden max-h-40 overflow-y-auto">
                {items.map((item, idx) => (
                  <div key={idx} className="p-2.5 flex items-center justify-between hover:bg-slate-50 text-xs">
                    <div>
                      <span className="font-mono font-bold text-slate-800 mr-2">{item.posNr}</span>
                      <span className="font-medium text-slate-700">{item.shortText}</span>
                      {item.isUnplannedMaterial && (
                        <span className="ml-2 text-[10px] px-1.5 py-0.5 bg-amber-100 text-amber-800 font-bold rounded">
                          Nicht im LV
                        </span>
                      )}
                    </div>
                    <div className="flex items-center space-x-2">
                      <span className="font-bold text-slate-900">{item.quantity} {item.qu}</span>
                      <button
                        type="button"
                        onClick={() => handleRemoveItem(idx)}
                        className="text-red-500 hover:text-red-700 p-1"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Footer Submit */}
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
              disabled={isSubmitting || items.length === 0}
              className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold shadow-md shadow-emerald-600/20 flex items-center space-x-1.5 disabled:opacity-50"
            >
              <CheckCircle2 className="w-4 h-4" />
              <span>{isSubmitting ? 'Wird gespeichert...' : 'Abschnitt einreichen'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
