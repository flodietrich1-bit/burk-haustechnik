import React, { useState } from 'react';
import * as XLSX from 'xlsx';
import type { Position } from '../../types';
import { X, UploadCloud, FileSpreadsheet, CheckCircle2, AlertCircle, RefreshCw } from 'lucide-react';
import { cleanShortText } from '../../services/gaebParser';

interface LvExcelImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  onImport: (positions: Partial<Position>[]) => Promise<void>;
  existingPositions: Position[];
}

export const LvExcelImportModal: React.FC<LvExcelImportModalProps> = ({
  isOpen,
  onClose,
  onImport,
  existingPositions
}) => {
  const [fileName, setFileName] = useState('');
  const [parsedRows, setParsedRows] = useState<Partial<Position>[]>([]);
  const [errorMsg, setErrorMsg] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);

  if (!isOpen) return null;

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setFileName(file.name);
    setErrorMsg('');
    setIsProcessing(true);

    try {
      const buffer = await file.arrayBuffer();
      const workbook = XLSX.read(new Uint8Array(buffer), { type: 'array' });
      const worksheet = workbook.Sheets[workbook.SheetNames[0]];
      const rawRows: any[][] = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: '' });

      if (rawRows.length === 0) {
        throw new Error('Die Excel-Datei enthält keine Zeilen.');
      }

      // Column mapping detection
      let headerRowIndex = 0;
      let posCol = 0, textCol = 1, qtyCol = 2, quCol = 3, priceCol = 4, groupCol = -1;

      for (let r = 0; r < Math.min(rawRows.length, 10); r++) {
        const row = rawRows[r].map((c: any) => String(c).toLowerCase().trim());
        const pIdx = row.findIndex(c => c.includes('oz') || c.includes('pos') || c === 'nr');
        const tIdx = row.findIndex(c => c.includes('text') || c.includes('bezeichnung') || c.includes('artikel'));
        const qIdx = row.findIndex(c => c.includes('menge') || c.includes('qty'));

        if (tIdx !== -1 && (pIdx !== -1 || qIdx !== -1)) {
          headerRowIndex = r;
          posCol = pIdx >= 0 ? pIdx : 0;
          textCol = tIdx;
          qtyCol = qIdx >= 0 ? qIdx : 2;
          quCol = row.findIndex(c => c.includes('einheit') || c.includes('me') || c.includes('qu'));
          priceCol = row.findIndex(c => c.includes('preis') || c.includes('ep') || c.includes('vk'));
          groupCol = row.findIndex(c => c.includes('gewerk') || c.includes('gruppe') || c.includes('titel'));
          break;
        }
      }

      const results: Partial<Position>[] = [];
      let currentGroup = 'Allgemeine Positionen';

      for (let r = headerRowIndex + 1; r < rawRows.length; r++) {
        const row = rawRows[r];
        if (!row || row.length === 0) continue;

        const rawPos = posCol >= 0 && row[posCol] !== undefined ? String(row[posCol]).trim() : '';
        const rawText = textCol >= 0 && row[textCol] !== undefined ? String(row[textCol]).trim() : '';
        const rawQty = qtyCol >= 0 && row[qtyCol] !== undefined ? String(row[qtyCol]).trim().replace(',', '.') : '';
        const rawQu = quCol >= 0 && row[quCol] !== undefined ? String(row[quCol]).trim() : 'Stk';
        const rawPrice = priceCol >= 0 && row[priceCol] !== undefined ? String(row[priceCol]).trim().replace(',', '.') : '0';
        const rawGroup = groupCol >= 0 && row[groupCol] !== undefined ? String(row[groupCol]).trim() : '';

        if (!rawText && !rawPos) continue;
        if (rawGroup) currentGroup = rawGroup;

        const posNr = rawPos || `01.${String(results.length + 1).padStart(2, '0')}`;
        const qty = parseFloat(rawQty) || 1;
        const unitPriceVK = parseFloat(rawPrice) || 0;
        const shortText = cleanShortText(rawText) || `Position ${posNr}`;
        const group = rawGroup || currentGroup;

        // Check if existing position matches posNr
        const existing = existingPositions.find(p => (p.displayCode || p.posNr) === posNr);

        results.push({
          id: existing ? existing.id : `pos_${posNr.replace(/[^a-zA-Z0-9_-]/g, '_')}`,
          posNr,
          displayCode: posNr,
          originalCode: existing?.originalCode || posNr,
          sortOrder: existing?.sortOrder ?? (results.length + 1) * 10,
          sourceType: existing?.sourceType || 'CUSTOM_ADDED',
          group,
          tradeCategory: group,
          officialTitle: existing?.officialTitle || shortText,
          shortText: existing?.aliasTitle || shortText,
          aliasTitle: existing?.aliasTitle || null,
          monteurInfo: existing?.monteurInfo || null,
          qty,
          qu: rawQu || 'Stk',
          deliveredQty: existing?.deliveredQty ?? qty,
          unitPrice: unitPriceVK,
          unitPriceVK: unitPriceVK,
          orderStatus: existing?.orderStatus || 'OPEN',
          status: existing?.status || 'open',
          updatedAt: new Date().toISOString()
        });
      }

      setParsedRows(results);
    } catch (err: any) {
      setErrorMsg(err.message || 'Fehler beim Parsen der Excel-Datei');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleExecuteImport = async () => {
    if (parsedRows.length === 0) return;
    setIsProcessing(true);
    try {
      await onImport(parsedRows);
      onClose();
    } catch (err: any) {
      setErrorMsg(err.message || 'Fehler beim Speichern der Positionen');
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[70] flex items-center justify-center p-4">
      <div className="bg-white w-full max-w-xl rounded-2xl shadow-2xl border border-slate-200 overflow-hidden animate-in fade-in zoom-in-95 duration-150 flex flex-col max-h-[90vh]">
        <div className="px-6 py-4 bg-emerald-800 text-white flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <FileSpreadsheet className="w-5 h-5 text-emerald-300" />
            <h3 className="text-base font-bold">Excel-LV & VK-Preise abgleichen</h3>
          </div>
          <button type="button" onClick={onClose} className="p-1 rounded-lg hover:bg-white/20 text-white">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 overflow-y-auto space-y-4 text-xs text-slate-700">
          <p className="text-slate-600 leading-relaxed">
            Importieren Sie eine Excel-Liste (z. B. aus Sigmaringen oder einem Kalkulationsprogramm).
            Spalten für Positionsnummer, Bezeichnung, Menge, Einheit und VK-Preis werden automatisch erkannt.
          </p>

          <label className="border-2 border-dashed border-slate-300 hover:border-emerald-500 hover:bg-emerald-50/30 rounded-xl p-6 flex flex-col items-center justify-center cursor-pointer transition-colors">
            <UploadCloud className="w-8 h-8 text-slate-400 mb-2" />
            <span className="font-bold text-slate-800">Excel-Datei (.xlsx, .xls, .csv) auswählen</span>
            <span className="text-[11px] text-slate-400 mt-0.5">oder per Drag & Drop hier ablegen</span>
            <input type="file" accept=".xlsx,.xls,.csv" onChange={handleFileChange} className="hidden" />
          </label>

          {fileName && (
            <div className="p-3 bg-emerald-50 rounded-xl border border-emerald-200 flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                <span className="font-semibold text-slate-800">{fileName}</span>
              </div>
              <span className="font-bold text-emerald-700">{parsedRows.length} Positionen erkannt</span>
            </div>
          )}

          {errorMsg && (
            <div className="p-3 bg-red-50 rounded-xl border border-red-200 flex items-center space-x-2 text-red-700">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {parsedRows.length > 0 && (
            <div className="border border-slate-200 rounded-xl overflow-hidden max-h-48 overflow-y-auto">
              <table className="w-full text-left text-[11px]">
                <thead className="bg-slate-50 text-slate-500 uppercase sticky top-0 border-b border-slate-200">
                  <tr>
                    <th className="py-2 px-3">Pos</th>
                    <th className="py-2 px-3">Bezeichnung</th>
                    <th className="py-2 px-3 text-right">Menge</th>
                    <th className="py-2 px-3 text-right">VK-Preis</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {parsedRows.slice(0, 15).map((row, idx) => (
                    <tr key={idx} className="hover:bg-slate-50">
                      <td className="py-1.5 px-3 font-mono font-bold">{row.displayCode}</td>
                      <td className="py-1.5 px-3 truncate max-w-xs">{row.officialTitle}</td>
                      <td className="py-1.5 px-3 text-right">{row.qty} {row.qu}</td>
                      <td className="py-1.5 px-3 text-right">{row.unitPriceVK ? `${row.unitPriceVK} €` : '-'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <div className="pt-3 border-t border-slate-200 flex justify-end space-x-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 border border-slate-300 rounded-xl text-xs font-semibold text-slate-700 hover:bg-slate-50"
            >
              Abbrechen
            </button>
            <button
              type="button"
              disabled={parsedRows.length === 0 || isProcessing}
              onClick={handleExecuteImport}
              className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold shadow-md shadow-emerald-600/20 flex items-center space-x-1.5 disabled:opacity-50"
            >
              <RefreshCw className={`w-4 h-4 ${isProcessing ? 'animate-spin' : ''}`} />
              <span>{isProcessing ? 'Wird importiert...' : `${parsedRows.length} Positionen einspielen`}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
