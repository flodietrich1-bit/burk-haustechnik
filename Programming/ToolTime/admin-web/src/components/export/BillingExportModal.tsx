import React, { useState } from 'react';
import type { Position, Project, MeasurementSection, User } from '../../types';
import { X, FileSpreadsheet, FileText, Download, ShieldCheck, DollarSign } from 'lucide-react';
import { exportBillingToExcel, exportBillingToPdf } from '../../services/billingExportService';

interface BillingExportModalProps {
  isOpen: boolean;
  onClose: () => void;
  project: Project;
  positions: Position[];
  sections?: MeasurementSection[];
  currentUser: User | null;
}

export const BillingExportModal: React.FC<BillingExportModalProps> = ({
  isOpen,
  onClose,
  project,
  positions,
  sections = [],
  currentUser
}) => {
  const [format, setFormat] = useState<'excel' | 'pdf'>('excel');
  const [docType, setDocType] = useState<'Abschlagsrechnung' | 'Schlussrechnung' | 'Geprüftes Aufmaß'>('Geprüftes Aufmaß');
  const [includePrices, setIncludePrices] = useState(true);

  if (!isOpen) return null;

  const canViewPrices = currentUser?.role === 'admin' || 
                        currentUser?.role === 'kaufmaennisch' || 
                        currentUser?.role === 'projektleiter' || 
                        currentUser?.role === 'bauleiter';

  const handleExport = () => {
    const opts = {
      project,
      positions,
      sections,
      includePrices: canViewPrices && includePrices,
      documentType: docType
    };

    if (format === 'excel') {
      exportBillingToExcel(opts);
    } else {
      exportBillingToPdf(opts);
    }
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[70] flex items-center justify-center p-4">
      <div className="bg-white w-full max-w-lg rounded-2xl shadow-2xl border border-slate-200 overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="px-6 py-4 bg-slate-900 text-white flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <Download className="w-5 h-5 text-blue-400" />
            <h3 className="text-base font-bold">Aufmaß- & Rechnungs-Export</h3>
          </div>
          <button type="button" onClick={onClose} className="p-1 rounded-lg hover:bg-white/20 text-white">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Notice: Official GAEB Title enforcement */}
        <div className="p-4 bg-blue-50/80 border-b border-blue-100 flex items-start space-x-3 text-xs text-blue-900">
          <ShieldCheck className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
          <p>
            <strong>Garantierte Rechnungs-Konformität:</strong> Der Export nutzt zwingend die unveränderlichen
            Originaltexte (<code>officialTitle</code>) aus der GAEB, damit die Buchhaltung 1:1 abrechnen kann.
          </p>
        </div>

        {/* Body Form */}
        <div className="p-6 space-y-5 text-xs text-slate-700">
          {/* Format Selection */}
          <div>
            <label className="block font-bold text-slate-800 mb-2">Export-Format wählen</label>
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setFormat('excel')}
                className={`p-3 rounded-xl border-2 flex items-center space-x-3 transition-all ${
                  format === 'excel'
                    ? 'border-emerald-500 bg-emerald-50/50 text-emerald-900 font-bold'
                    : 'border-slate-200 hover:border-slate-300 text-slate-600'
                }`}
              >
                <FileSpreadsheet className={`w-5 h-5 ${format === 'excel' ? 'text-emerald-600' : 'text-slate-400'}`} />
                <div className="text-left">
                  <div className="text-xs">Excel-Arbeitsmappe</div>
                  <div className="text-[10px] text-slate-400 font-normal">.xlsx mit Formeln & Tabs</div>
                </div>
              </button>

              <button
                type="button"
                onClick={() => setFormat('pdf')}
                className={`p-3 rounded-xl border-2 flex items-center space-x-3 transition-all ${
                  format === 'pdf'
                    ? 'border-rose-500 bg-rose-50/50 text-rose-900 font-bold'
                    : 'border-slate-200 hover:border-slate-300 text-slate-600'
                }`}
              >
                <FileText className={`w-5 h-5 ${format === 'pdf' ? 'text-rose-600' : 'text-slate-400'}`} />
                <div className="text-left">
                  <div className="text-xs">PDF-Dokument</div>
                  <div className="text-[10px] text-slate-400 font-normal">Druckfertiges Rechnungsaufmaß</div>
                </div>
              </button>
            </div>
          </div>

          {/* Document Type Selection */}
          <div>
            <label className="block font-bold text-slate-800 mb-2">Zweck des Aufmaßes</label>
            <div className="grid grid-cols-3 gap-2">
              {(['Geprüftes Aufmaß', 'Abschlagsrechnung', 'Schlussrechnung'] as const).map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setDocType(t)}
                  className={`py-2 px-3 rounded-xl border text-xs font-semibold transition-all ${
                    docType === t
                      ? 'border-[#3B82C4] bg-blue-50 text-blue-800'
                      : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                  }`}
                >
                  {t}
                </button>
              ))}
            </div>
          </div>

          {/* Price Toggle - Role-protected */}
          {canViewPrices && (
            <div className="pt-2 border-t border-slate-100">
              <label className="flex items-center space-x-2.5 cursor-pointer">
                <input
                  type="checkbox"
                  checked={includePrices}
                  onChange={(e) => setIncludePrices(e.target.checked)}
                  className="rounded text-[#3B82C4] focus:ring-0"
                />
                <span className="font-bold text-slate-800 flex items-center space-x-1">
                  <DollarSign className="w-3.5 h-3.5 text-emerald-600" />
                  <span>Mit VK-Preisen & Gesamtsummen exportieren</span>
                </span>
              </label>
              <p className="text-[11px] text-slate-400 ml-6 mt-0.5">
                Für Monteure automatisch ausgeblendet. Kaufleute und Projektleiter können die Beträge mit exportieren.
              </p>
            </div>
          )}

          {/* Summary Details */}
          <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 space-y-1 text-[11px] text-slate-500">
            <div><strong>Projekt:</strong> {project.name} ({project.projectNumber})</div>
            <div><strong>Umfang:</strong> {positions.length} Positionen {sections.length > 0 ? `• ${sections.length} Abschnitte` : ''}</div>
            <div><strong>Abrechnungsmodus:</strong> {project.measurementMode === 'LV_BASED' ? 'LV-basiert' : 'Raumbasiert'}</div>
          </div>

          {/* Footer */}
          <div className="pt-2 border-t border-slate-200 flex justify-end space-x-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 border border-slate-300 rounded-xl text-xs font-semibold text-slate-700 hover:bg-slate-50"
            >
              Abbrechen
            </button>
            <button
              type="button"
              onClick={handleExport}
              className="px-5 py-2 bg-[#3B82C4] hover:bg-[#2B6EB0] text-white rounded-xl text-xs font-bold shadow-md shadow-blue-500/20 flex items-center space-x-1.5 transition-all"
            >
              <Download className="w-4 h-4" />
              <span>{format === 'excel' ? 'Excel herunterladen' : 'PDF erstellen'}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
