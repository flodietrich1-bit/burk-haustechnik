import React, { useState } from 'react';
import type { Position, User, MeasurementSection, MeasurementSectionItem, MeasurementSectionPhoto } from '../../types';
import { X, Plus, Trash2, CheckCircle2, FileSpreadsheet, Camera } from 'lucide-react';
import { saveMeasurementSection, uploadSectionPhoto } from '../../services/measurementSectionService';

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
  const [sectionTitle, setSectionTitle] = useState('');
  const [monteurName, setMonteurName] = useState(currentUser?.name || 'Monteur');
  const [items, setItems] = useState<MeasurementSectionItem[]>([]);
  const [selectedPhotos, setSelectedPhotos] = useState<{ file: File; previewUrl: string }[]>([]);
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

  const handlePhotosSelected = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;
    const added = files.map(file => ({
      file,
      previewUrl: URL.createObjectURL(file)
    }));
    setSelectedPhotos(prev => [...prev, ...added]);
    e.target.value = '';
  };

  const handleRemovePhoto = (index: number) => {
    setSelectedPhotos(prev => {
      const target = prev[index];
      if (target) URL.revokeObjectURL(target.previewUrl);
      return prev.filter((_, i) => i !== index);
    });
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
      const sectionId = `sec_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
      const uploadedPhotos: MeasurementSectionPhoto[] = [];

      for (const entry of selectedPhotos) {
        const url = await uploadSectionPhoto(projectId, sectionId, entry.file);
        uploadedPhotos.push({
          url,
          timestamp: new Date().toISOString(),
          caption: entry.file.name
        });
      }

      const newSection: MeasurementSection = {
        id: sectionId,
        projectId,
        sectionTitle: sectionTitle.trim(),
        createdAt: new Date().toISOString(),
        createdBy: monteurName.trim() || 'Monteur',
        createdByUid: currentUser?.id,
        items,
        photos: uploadedPhotos,
        status: 'SUBMITTED'
      };

      await saveMeasurementSection(projectId, newSection);
      selectedPhotos.forEach(p => URL.revokeObjectURL(p.previewUrl));
      setSectionTitle('');
      setItems([]);
      setSelectedPhotos([]);
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
              placeholder="z. B. Strang A / EG Bad / Technikraum (wo gearbeitet wurde)"
              className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs focus:outline-none focus:border-emerald-500 font-semibold placeholder:text-slate-400 placeholder:font-normal"
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
                  {positions.filter(p => !p.isCancelled && p.status !== 'cancelled' && !p.hiddenForMonteur).map(p => (
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

          {/* Foto-Upload (Aufmaßzettel, Beweisfotos - mehrere möglich) */}
          <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 space-y-2.5">
            <div className="flex items-center justify-between">
              <span className="font-bold text-slate-800 flex items-center space-x-1.5">
                <Camera className="w-4 h-4 text-emerald-600" />
                <span>Fotos &amp; Aufmaßzettel (optional, mehrere möglich)</span>
              </span>
              <label className="px-3 py-1.5 bg-white hover:bg-slate-100 border border-slate-300 rounded-lg text-[11px] font-bold text-slate-700 cursor-pointer flex items-center space-x-1.5 transition-colors">
                <Plus className="w-3.5 h-3.5 text-emerald-600" />
                <span>Fotos auswählen</span>
                <input
                  type="file"
                  accept="image/*"
                  multiple
                  onChange={handlePhotosSelected}
                  className="hidden"
                />
              </label>
            </div>
            {selectedPhotos.length === 0 ? (
              <p className="text-[11px] text-slate-400">
                z. B. Foto vom handschriftlichen Aufmaßzettel sowie 1–2 Beweisfotos der Baustelle.
              </p>
            ) : (
              <div className="grid grid-cols-3 sm:grid-cols-4 gap-2 pt-1">
                {selectedPhotos.map((entry, idx) => (
                  <div key={idx} className="relative group rounded-lg overflow-hidden border border-slate-200 bg-white aspect-square">
                    <img
                      src={entry.previewUrl}
                      alt={entry.file.name}
                      className="w-full h-full object-cover"
                    />
                    <button
                      type="button"
                      onClick={() => handleRemovePhoto(idx)}
                      title="Foto entfernen"
                      className="absolute top-1 right-1 p-1 rounded-full bg-red-600 text-white opacity-90 hover:opacity-100 shadow cursor-pointer"
                    >
                      <X className="w-3 h-3" />
                    </button>
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
