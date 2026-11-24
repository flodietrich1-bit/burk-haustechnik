import React, { useState, useEffect, useMemo } from 'react';
import type { Position, MeasurementSection, User, AufmassDocument } from '../../types';
import { FileSpreadsheet, Plus } from 'lucide-react';
import { subscribeMeasurementSections } from '../../services/measurementSectionService';
import { listenToAufmasse } from '../../services/aufmassService';
import { MeasurementSectionCard } from './MeasurementSectionCard';
import { NewMeasurementSectionModal } from './NewMeasurementSectionModal';

interface MeasurementSectionsViewProps {
  projectId: string;
  projectName?: string;
  positions: Position[];
  currentUser: User | null;
}

export const MeasurementSectionsView: React.FC<MeasurementSectionsViewProps> = ({
  projectId,
  positions,
  currentUser
}) => {
  const [sections, setSections] = useState<MeasurementSection[]>([]);
  const [aufmasse, setAufmasse] = useState<AufmassDocument[]>([]);
  const [expandedSectionIds, setExpandedSectionIds] = useState<Record<string, boolean>>({});
  const [selectedPhoto, setSelectedPhoto] = useState<string | null>(null);
  const [isNewModalOpen, setIsNewModalOpen] = useState(false);
  const [statusFilter, setStatusFilter] = useState<'all' | 'pending' | 'included'>('all');

  useEffect(() => {
    const unsub = subscribeMeasurementSections(projectId, (list) => {
      setSections(list);
      if (list.length > 0 && Object.keys(expandedSectionIds).length === 0) {
        setExpandedSectionIds({ [list[0].id]: true });
      }
    });
    return () => unsub();
  }, [projectId]);

  useEffect(() => {
    if (!projectId) return;
    return listenToAufmasse(projectId, setAufmasse);
  }, [projectId]);

  const includedSectionIds = useMemo(() => {
    const ids = new Set<string>();
    aufmasse.forEach(a => {
      (a.roomsData || []).forEach(r => {
        if (r.roomId) ids.add(r.roomId);
      });
    });
    return ids;
  }, [aufmasse]);

  const toggleExpand = (id: string) => {
    setExpandedSectionIds(prev => ({ ...prev, [id]: !prev[id] }));
  };

  const filtered = sections.filter(s => {
    if (statusFilter === 'all') return true;
    const isIncluded = includedSectionIds.has(s.id);
    return statusFilter === 'included' ? isIncluded : !isIncluded;
  });

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center space-x-2">
            <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 uppercase">
              LV-Aufmaß Modus
            </span>
            <span className="text-xs text-slate-400">• Keine Räume erforderlich</span>
          </div>
          <h2 className="text-xl font-black text-slate-900 tracking-tight mt-1">
            Eingereichte Aufmaß-Abschnitte (Warenkörbe)
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Chronologische Liste aller eingereichten Abschnitte mit Fotos. Noch nicht erfasste Abschnitte fließen automatisch ins nächste Aufmaß ein.
          </p>
        </div>

        <div className="flex items-center space-x-2 shrink-0">
          <div className="flex items-center space-x-1 border border-slate-200 p-0.5 rounded-xl bg-slate-50 text-[11px] font-semibold">
            <button
              type="button"
              onClick={() => setStatusFilter('all')}
              className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer ${statusFilter === 'all' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-800'}`}
            >
              Alle ({sections.length})
            </button>
            <button
              type="button"
              onClick={() => setStatusFilter('pending')}
              className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer ${statusFilter === 'pending' ? 'bg-white text-amber-700 shadow-sm' : 'text-slate-500 hover:text-slate-800'}`}
            >
              Noch nicht im Aufmaß ({sections.filter(s => !includedSectionIds.has(s.id)).length})
            </button>
            <button
              type="button"
              onClick={() => setStatusFilter('included')}
              className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer ${statusFilter === 'included' ? 'bg-white text-emerald-700 shadow-sm' : 'text-slate-500 hover:text-slate-800'}`}
            >
              Im Aufmaß erfasst ({sections.filter(s => includedSectionIds.has(s.id)).length})
            </button>
          </div>

          <button
            type="button"
            onClick={() => setIsNewModalOpen(true)}
            className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold shadow-md shadow-emerald-600/20 flex items-center space-x-1.5 transition-all cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Abschnitt erfassen</span>
          </button>
        </div>
      </div>

      {/* Sections List */}
      {filtered.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center text-slate-500 text-xs shadow-sm">
          <FileSpreadsheet className="w-10 h-10 text-slate-300 mx-auto mb-2" />
          <p className="font-semibold text-slate-700">Keine Aufmaß-Abschnitte vorhanden</p>
          <p className="text-slate-400 mt-1 max-w-sm mx-auto">
            Sobald Monteure Aufmaß-Warenkörbe in der App abschließen oder Sie manuell einen erfassen, erscheinen sie hier.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {filtered.map(section => (
            <MeasurementSectionCard
              key={section.id}
              section={section}
              positions={positions}
              isExpanded={Boolean(expandedSectionIds[section.id])}
              isIncludedInAufmass={includedSectionIds.has(section.id)}
              onToggleExpand={() => toggleExpand(section.id)}
              onSelectPhoto={(url) => setSelectedPhoto(url)}
            />
          ))}
        </div>
      )}

      {/* Lightbox Modal */}
      {selectedPhoto && (
        <div 
          onClick={() => setSelectedPhoto(null)}
          className="fixed inset-0 bg-black/80 z-[80] flex items-center justify-center p-4 backdrop-blur-sm"
        >
          <div className="max-w-3xl max-h-[90vh] rounded-2xl overflow-hidden bg-black shadow-2xl relative">
            <img src={selectedPhoto} alt="Aufmaß-Foto" className="max-w-full max-h-[85vh] object-contain mx-auto" />
            <button
              type="button"
              onClick={() => setSelectedPhoto(null)}
              className="absolute top-3 right-3 text-white bg-black/50 hover:bg-black/80 p-2 rounded-full text-xs font-bold"
            >
              ✕ Schließen
            </button>
          </div>
        </div>
      )}

      {/* New Section Modal */}
      <NewMeasurementSectionModal
        isOpen={isNewModalOpen}
        onClose={() => setIsNewModalOpen(false)}
        projectId={projectId}
        positions={positions}
        currentUser={currentUser}
      />
    </div>
  );
};
