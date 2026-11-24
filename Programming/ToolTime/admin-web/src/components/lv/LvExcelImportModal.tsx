import React, { useState } from 'react';
import * as XLSX from 'xlsx';
import type { Position } from '../../types';
import { X, UploadCloud, FileSpreadsheet, CheckCircle2, AlertCircle, RefreshCw, Trash2, Info } from 'lucide-react';
import { cleanShortText } from '../../services/gaebParser';
import { normalizeExcelPosNr } from '../../services/lvPositionService';

interface LvExcelImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  onImport: (positions: Partial<Position>[]) => Promise<void>;
  existingPositions: Position[];
  onCleanCustom?: () => Promise<void> | void;
}

/**
 * Extracts 1-based row indices of cells with strikethrough formatting from the XLSX ZIP container
 */
function getStruckRowIndices(cfb: any): Set<number> {
  const struckRows = new Set<number>();
  try {
    const stylesEntry = cfb.FileIndex.find((f: any) => f.name && f.name.endsWith('styles.xml'));
    const sheetEntry = cfb.FileIndex.find((f: any) => f.name && (f.name.endsWith('sheet1.xml') || f.name.endsWith('sheet.xml')));
    if (!stylesEntry || !sheetEntry) return struckRows;

    const dec = new TextDecoder('utf-8');
    const stylesXml = dec.decode(stylesEntry.content);
    const sheetXml = dec.decode(sheetEntry.content);

    const fontTags = stylesXml.split('</font>');
    const strikeFontIds = new Set<number>();
    fontTags.forEach((f, idx) => {
      if (f.includes('<strike') || f.includes('<strike/>')) strikeFontIds.add(idx);
    });

    const xfTags = stylesXml.split('</xf>');
    const strikeXfIds = new Set<number>();
    xfTags.forEach((xf, idx) => {
      const match = xf.match(/fontId="(\d+)"/);
      if (match && strikeFontIds.has(parseInt(match[1], 10))) strikeXfIds.add(idx);
    });

    const cellMatches = sheetXml.match(/<c r="([A-Z]+)(\d+)"[^>]*s="(\d+)"/g) || [];
    cellMatches.forEach(c => {
      const m = c.match(/r="([A-Z]+)(\d+)"[^>]*s="(\d+)"/);
      if (m && strikeXfIds.has(parseInt(m[3], 10))) {
        // If column A, B or C is struck through, mark row as struck
        if (['A', 'B', 'C'].includes(m[1])) {
          struckRows.add(parseInt(m[2], 10));
        }
      }
    });
  } catch (err) {
    console.warn('Could not inspect cell strikethrough styles:', err);
  }
  return struckRows;
}

export const LvExcelImportModal: React.FC<LvExcelImportModalProps> = ({
  isOpen,
  onClose,
  onImport,
  existingPositions,
  onCleanCustom
}) => {
  const [fileName, setFileName] = useState('');
  const [parsedRows, setParsedRows] = useState<Partial<Position>[]>([]);
  const [matchedCount, setMatchedCount] = useState(0);
  const [newCount, setNewCount] = useState(0);
  const [skippedCount, setSkippedCount] = useState(0);
  const [errorMsg, setErrorMsg] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);

  const customPositionsCount = existingPositions.filter(p => p.sourceType === 'CUSTOM_ADDED').length;

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

      // Check struck-through rows via XLSX.CFB
      let struckRows = new Set<number>();
      try {
        if (XLSX.CFB) {
          const cfb = XLSX.CFB.read(new Uint8Array(buffer), { type: 'buffer' });
          struckRows = getStruckRowIndices(cfb);
        }
      } catch (err) {
        console.warn('Error reading CFB styles:', err);
      }

      // Detect header columns
      let headerRowIndex = 0;
      let posCol = 0, textCol = 1, qtyCol = 2, quCol = 3, priceCol = 4, deliveredCol = -1, groupCol = -1;

      for (let r = 0; r < Math.min(rawRows.length, 12); r++) {
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
          deliveredCol = row.findIndex(c => c.includes('bestellt') || c.includes('geliefert'));
          groupCol = row.findIndex(c => c.includes('gewerk') || c.includes('gruppe') || c.includes('titel'));
          break;
        }
      }

      const results: Partial<Position>[] = [];
      let currentGroup = 'Allgemeine Positionen';
      let matched = 0;
      let newlyAdded = 0;
      let skipped = 0;

      // Build quick lookup maps for existing positions (original GAEB)
      const existingByCode = new Map<string, Position>();
      const existingByTitle = new Map<string, Position>();
      existingPositions.forEach(p => {
        const code = (p.displayCode || p.posNr || '').trim();
        if (code) {
          existingByCode.set(code, p);
          existingByCode.set(normalizeExcelPosNr(code), p);
        }
        const title = cleanShortText(p.officialTitle || p.shortText || '').toLowerCase().trim();
        if (title) existingByTitle.set(title, p);
      });

      for (let r = headerRowIndex + 1; r < rawRows.length; r++) {
        const excelRowNum = r + 1;
        const row = rawRows[r];
        if (!row || row.length === 0) {
          skipped++;
          continue;
        }

        // 1. Skip struck-through rows
        if (struckRows.has(excelRowNum)) {
          skipped++;
          continue;
        }

        const rawPos = posCol >= 0 && row[posCol] !== undefined ? String(row[posCol]).trim() : '';
        const rawText = textCol >= 0 && row[textCol] !== undefined ? String(row[textCol]).trim() : '';
        const rawQtyStr = qtyCol >= 0 && row[qtyCol] !== undefined ? String(row[qtyCol]).trim().replace(',', '.') : '';
        const rawQu = quCol >= 0 && row[quCol] !== undefined ? String(row[quCol]).trim() : 'Stk';
        const rawPriceStr = priceCol >= 0 && row[priceCol] !== undefined ? String(row[priceCol]).trim().replace(',', '.') : '0';
        const rawDeliveredStr = deliveredCol >= 0 && row[deliveredCol] !== undefined ? String(row[deliveredCol]).trim().replace(',', '.') : '';
        const rawGroup = groupCol >= 0 && row[groupCol] !== undefined ? String(row[groupCol]).trim() : '';

        const qty = parseFloat(rawQtyStr) || 0;
        const unitPriceVK = parseFloat(rawPriceStr) || 0;
        const deliveredQty = parseFloat(rawDeliveredStr) || 0;

        // 2. Skip comment/instruction rows starting with ***
        if (rawText.startsWith('***')) {
          skipped++;
          continue;
        }

        const isPosPattern = /^\d+(\.\d+)*/.test(rawPos);

        // 3. Skip rows with NO piece count AND NO valid position number
        if (!isPosPattern && qty <= 0) {
          // Check if this row is a Trade / Gewerk header
          const lower = rawText.toLowerCase();
          if (
            rawText &&
            !lower.includes('summe') &&
            !lower.includes('datum') &&
            !lower.includes('unterschrift') &&
            !lower.includes('nachträge') &&
            lower !== 'beschreibung'
          ) {
            currentGroup = rawText;
          }
          skipped++;
          continue;
        }

        // Skip rows with noise in PosNr column (like "Summe:", "Datum / Unterschrift...")
        if (!isPosPattern && (rawPos.includes(':') || rawPos.toLowerCase().includes('summe'))) {
          skipped++;
          continue;
        }

        if (rawGroup) currentGroup = rawGroup;

        const normalizedPos = normalizeExcelPosNr(rawPos || '');
        const cleanTitle = cleanShortText(rawText);

        // 4. Intelligent Matching against existing project positions
        const existing = existingByCode.get(normalizedPos) ||
                         existingByCode.get(rawPos) ||
                         (cleanTitle ? existingByTitle.get(cleanTitle.toLowerCase()) : undefined);

        if (existing) {
          // MATCHED with existing LV position!
          matched++;
          const targetQty = qty > 0 ? qty : (Number(existing.qty) || 1);
          const finalDelivered = deliveredQty > 0 ? deliveredQty : existing.deliveredQty;
          const status = (deliveredQty > 0 && deliveredQty >= targetQty)
            ? 'DELIVERED'
            : (deliveredQty > 0 ? 'ORDERED' : (existing.orderStatus || 'OPEN'));

          results.push({
            id: existing.id,
            posNr: existing.posNr,
            displayCode: existing.displayCode || existing.posNr,
            originalCode: existing.originalCode || existing.posNr,
            sortOrder: existing.sortOrder,
            sourceType: existing.sourceType || 'ORIGINAL_GAEB',
            group: existing.group || existing.tradeCategory || currentGroup,
            tradeCategory: existing.tradeCategory || existing.group || currentGroup,
            officialTitle: existing.officialTitle || cleanTitle,
            shortText: existing.shortText || cleanTitle,
            aliasTitle: existing.aliasTitle || null,
            monteurInfo: existing.monteurInfo || null,
            qty: targetQty,
            qu: rawQu && rawQu !== 'Stk.' ? (rawQu === 'lfm' || rawQu === 'm' ? 'LFM' : rawQu) : (existing.qu || 'Stk'),
            deliveredQty: finalDelivered,
            unitPrice: unitPriceVK > 0 ? unitPriceVK : (existing.unitPrice || 0),
            unitPriceVK: unitPriceVK > 0 ? unitPriceVK : (existing.unitPriceVK || existing.unitPrice || 0),
            orderStatus: status as any,
            status: existing.status || 'open',
            updatedAt: new Date().toISOString()
          });
        } else {
          // Genuine new position / Nachtrag (e.g. 4.0000.1 -> 04.00.1)
          newlyAdded++;
          const posId = `pos_custom_${normalizedPos.replace(/[^a-zA-Z0-9_-]/g, '_')}_${Date.now()}`;
          const quNorm = rawQu.toLowerCase() === 'lfm' || rawQu.toLowerCase() === 'm' ? 'LFM' : (rawQu || 'Stk');
          const finalQty = qty > 0 ? qty : 1;

          results.push({
            id: posId,
            posNr: normalizedPos,
            displayCode: normalizedPos,
            originalCode: normalizedPos,
            sortOrder: (results.length + 1) * 10,
            sourceType: 'CUSTOM_ADDED',
            group: currentGroup,
            tradeCategory: currentGroup,
            officialTitle: cleanTitle || `Position ${normalizedPos}`,
            shortText: cleanTitle || `Position ${normalizedPos}`,
            aliasTitle: null,
            monteurInfo: null,
            qty: finalQty,
            qu: quNorm,
            deliveredQty: deliveredQty > 0 ? deliveredQty : finalQty,
            unitPrice: unitPriceVK,
            unitPriceVK: unitPriceVK,
            orderStatus: (deliveredQty > 0 ? 'ORDERED' : 'OPEN') as any,
            status: 'open',
            updatedAt: new Date().toISOString()
          });
        }
      }

      setParsedRows(results);
      setMatchedCount(matched);
      setNewCount(newlyAdded);
      setSkippedCount(skipped);
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
      <div className="bg-white w-full max-w-xl rounded-2xl shadow-2xl border border-slate-200 overflow-hidden animate-in fade-in zoom-in-95 duration-150 flex flex-col max-h-[92vh]">
        <div className="px-6 py-4 bg-emerald-800 text-white flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <FileSpreadsheet className="w-5 h-5 text-emerald-300" />
            <h3 className="text-base font-bold">Excel-LV &amp; VK-Preise abgleichen</h3>
          </div>
          <button type="button" onClick={onClose} className="p-1 rounded-lg hover:bg-white/20 text-white cursor-pointer">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 overflow-y-auto space-y-4 text-xs text-slate-700">
          {/* Notice if custom positions exist */}
          {customPositionsCount > 0 && onCleanCustom && (
            <div className="p-3 bg-amber-50 rounded-xl border border-amber-200 flex items-center justify-between">
              <div className="flex items-center space-x-2 text-amber-900">
                <Info className="w-4 h-4 text-amber-600 shrink-0" />
                <span>
                  Aktuell sind <strong>{customPositionsCount}</strong> nicht im LV enthaltene Positionen im Projekt.
                </span>
              </div>
              <button
                type="button"
                onClick={async () => {
                  if (window.confirm(`Möchten Sie alle ${customPositionsCount} nicht im LV enthaltenen Positionen jetzt löschen?`)) {
                    await onCleanCustom();
                  }
                }}
                className="px-2.5 py-1 bg-amber-100 hover:bg-amber-200 text-amber-900 rounded-lg font-bold text-[11px] flex items-center space-x-1 shrink-0 cursor-pointer"
              >
                <Trash2 className="w-3 h-3" />
                <span>Jetzt bereinigen</span>
              </button>
            </div>
          )}

          <p className="text-slate-600 leading-relaxed">
            Laden Sie Ihre Excel-Kalkulationsdatei hoch. Nummernformate (z. B. <code>4.00001</code> $\rightarrow$ <code>04.01</code>) 
            werden automatisch normalisiert, durchgestrichene Zeilen und Hinweistexte werden ignoriert.
          </p>

          <label className="border-2 border-dashed border-slate-300 hover:border-emerald-500 hover:bg-emerald-50/30 rounded-xl p-6 flex flex-col items-center justify-center cursor-pointer transition-colors">
            <UploadCloud className="w-8 h-8 text-slate-400 mb-2" />
            <span className="font-bold text-slate-800">Excel-Datei (.xlsx, .xls) auswählen</span>
            <span className="text-[11px] text-slate-400 mt-0.5">oder per Drag &amp; Drop hier ablegen</span>
            <input type="file" accept=".xlsx,.xls,.csv" onChange={handleFileChange} className="hidden" />
          </label>

          {fileName && (
            <div className="p-3.5 bg-emerald-50 rounded-xl border border-emerald-200 space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                  <span className="font-bold text-slate-800">{fileName}</span>
                </div>
                <span className="font-bold text-emerald-700">{parsedRows.length} Positionen bereit</span>
              </div>

              <div className="flex flex-wrap items-center gap-2 pt-1 border-t border-emerald-100 text-[11px]">
                <span className="bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded font-bold">
                  ✓ {matchedCount} im Original-LV gematcht
                </span>
                {newCount > 0 && (
                  <span className="bg-blue-100 text-blue-800 px-2 py-0.5 rounded font-bold">
                    + {newCount} echte Nachträge
                  </span>
                )}
                {skippedCount > 0 && (
                  <span className="bg-slate-100 text-slate-600 px-2 py-0.5 rounded font-medium">
                    {skippedCount} Hinweistexte/durchgestrichene Zeilen ignoriert
                  </span>
                )}
              </div>
            </div>
          )}

          {errorMsg && (
            <div className="p-3 bg-red-50 rounded-xl border border-red-200 flex items-center space-x-2 text-red-700">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {parsedRows.length > 0 && (
            <div className="border border-slate-200 rounded-xl overflow-hidden max-h-52 overflow-y-auto">
              <table className="w-full text-left text-[11px]">
                <thead className="bg-slate-50 text-slate-500 uppercase sticky top-0 border-b border-slate-200 font-bold">
                  <tr>
                    <th className="py-2 px-3">Pos</th>
                    <th className="py-2 px-3">Status</th>
                    <th className="py-2 px-3">Bezeichnung</th>
                    <th className="py-2 px-3 text-right">Menge</th>
                    <th className="py-2 px-3 text-right">VK-Preis</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {parsedRows.slice(0, 30).map((row, idx) => {
                    const isMatched = row.sourceType === 'ORIGINAL_GAEB';
                    return (
                      <tr key={idx} className="hover:bg-slate-50">
                        <td className="py-1.5 px-3 font-mono font-bold">{row.displayCode}</td>
                        <td className="py-1.5 px-3">
                          <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
                            isMatched ? 'bg-emerald-100 text-emerald-800' : 'bg-blue-100 text-blue-800'
                          }`}>
                            {isMatched ? 'LV-Match' : 'Nachtrag'}
                          </span>
                        </td>
                        <td className="py-1.5 px-3 truncate max-w-xs">{row.officialTitle}</td>
                        <td className="py-1.5 px-3 text-right">{row.qty} {row.qu}</td>
                        <td className="py-1.5 px-3 text-right font-semibold">
                          {row.unitPriceVK ? `${Number(row.unitPriceVK).toFixed(2)} €` : '-'}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          <div className="pt-3 border-t border-slate-200 flex justify-end space-x-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 border border-slate-300 rounded-xl text-xs font-semibold text-slate-700 hover:bg-slate-50 cursor-pointer"
            >
              Abbrechen
            </button>
            <button
              type="button"
              disabled={parsedRows.length === 0 || isProcessing}
              onClick={handleExecuteImport}
              className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold shadow-md shadow-emerald-600/20 flex items-center space-x-1.5 disabled:opacity-50 cursor-pointer"
            >
              <RefreshCw className={`w-4 h-4 ${isProcessing ? 'animate-spin' : ''}`} />
              <span>{isProcessing ? 'Wird eingespielt...' : `${parsedRows.length} Positionen abgleichen`}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
