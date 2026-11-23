import * as XLSX from 'xlsx';
import { jsPDF } from 'jspdf';
import type { Position, Project, MeasurementSection } from '../types';

export interface BillingExportOptions {
  project: Project;
  positions: Position[];
  sections?: MeasurementSection[];
  includePrices: boolean; // Only accessible for KAUFMANN and PROJEKTLEITER
  documentType?: 'Abschlagsrechnung' | 'Schlussrechnung' | 'Geprüftes Aufmaß';
}

function sanitizeFilename(name: string): string {
  return name.replace(/[^a-zA-Z0-9_-]/g, '_');
}

/**
 * Generates an Excel billing export strictly using officialTitle (never aliasTitle).
 */
export function exportBillingToExcel(options: BillingExportOptions): void {
  const { project, positions, sections = [], includePrices, documentType = 'Geprüftes Aufmaß' } = options;
  const isLvMode = project.measurementMode === 'LV_BASED';

  // Calculate cumulative installed quantities per position from approved sections or installedQty
  const approvedSections = sections.filter(s => s.status === 'APPROVED');
  const sectionQtyMap = new Map<string, number>();
  
  if (isLvMode && approvedSections.length > 0) {
    approvedSections.forEach(sec => {
      (sec.items || []).forEach(item => {
        const key = item.lvItemId || item.posNr || '';
        const prev = sectionQtyMap.get(key) || 0;
        sectionQtyMap.set(key, prev + (Number(item.quantity) || 0));
      });
    });
  }

  // Sort positions by sortOrder and group
  const sorted = [...positions].sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0));

  // Build rows
  const headerRow = [
    'Pos-Nr',
    'Typ',
    'Offizielle Bezeichnung (GAEB / Rechnungs-Kurztext)',
    'Gewerk / Titel',
    'LV-Planmenge',
    'Einheit',
    'Aufgemessene Menge (kumuliert)',
    ...(includePrices ? ['VK-Preis (€)', 'Abrechnungsbetrag netto (€)'] : [])
  ];

  const dataRows: any[][] = [];
  let totalOriginalSum = 0;
  let totalAddendumSum = 0;
  let totalBilledSum = 0;

  sorted.forEach(p => {
    const isOriginal = p.sourceType !== 'CUSTOM_ADDED';
    const typeLabel = isOriginal ? 'Original-LV' : 'Nachtrag / Ergänzt';
    
    // STRICT: Always use officialTitle, NEVER aliasTitle!
    const officialText = p.officialTitle || p.shortText || '';
    const posCode = p.displayCode || p.posNr;
    const trade = p.tradeCategory || p.group || 'Allgemein';
    const planQty = Number(p.qty) || 0;
    const unitPrice = Number(p.unitPriceVK ?? p.unitPrice ?? 0);

    let billedQty = planQty;
    if (isLvMode && approvedSections.length > 0) {
      billedQty = sectionQtyMap.get(p.id) ?? sectionQtyMap.get(p.posNr) ?? (p.installedQty ?? planQty);
    } else if (p.installedQty !== undefined && p.installedQty !== null) {
      billedQty = Number(p.installedQty);
    }

    const rowTotal = billedQty * unitPrice;

    if (isOriginal) {
      totalOriginalSum += planQty * unitPrice;
    } else {
      totalAddendumSum += rowTotal;
    }
    totalBilledSum += rowTotal;

    const row = [
      posCode,
      typeLabel,
      officialText,
      trade,
      planQty,
      p.qu,
      billedQty,
      ...(includePrices ? [unitPrice, rowTotal] : [])
    ];
    dataRows.push(row);
  });

  // Summary Row
  if (includePrices) {
    dataRows.push([]);
    dataRows.push(['', '', 'GESAMTSUMME ABRECHNUNG NETTO', '', '', '', '', '', totalBilledSum]);
    dataRows.push(['', '', 'Davon Original-LV', '', '', '', '', '', totalOriginalSum]);
    dataRows.push(['', '', 'Davon Freigegebene Nachträge & Mehrungen', '', '', '', '', '', totalAddendumSum]);
  }

  // Section breakdown sheet if in LV mode
  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.aoa_to_sheet([
    [`PROJEKT-AUFMASS & RECHNUNGSGRUNDLAGE (${documentType.toUpperCase()})`],
    [`Bauvorhaben: ${project.name} (Projekt-Nr: ${project.projectNumber})`],
    [`Auftraggeber: ${project.client || 'Direktkunde'} | Datum: ${new Date().toLocaleDateString('de-DE')}`],
    [`Aufmaß-Modus: ${isLvMode ? 'LV-basiert (Container-Warenkörbe)' : 'Raumbasiert (DWG-Plan)'}`],
    [],
    headerRow,
    ...dataRows
  ]);

  XLSX.utils.book_append_sheet(wb, ws, 'Aufmass_Rechnung');

  // If LV-based, add secondary sheet for sections
  if (isLvMode && approvedSections.length > 0) {
    const sectionRows: any[][] = [
      ['Abschnitt-Titel', 'Monteur', 'Einreichungsdatum', 'Position', 'Menge', 'Einheit', 'Status']
    ];
    approvedSections.forEach(sec => {
      sec.items.forEach(it => {
        sectionRows.push([
          sec.sectionTitle,
          sec.createdBy,
          new Date(sec.createdAt).toLocaleDateString('de-DE'),
          it.posNr || it.lvItemId,
          it.quantity,
          it.qu || 'Stk',
          sec.status
        ]);
      });
    });
    const wsSections = XLSX.utils.aoa_to_sheet(sectionRows);
    XLSX.utils.book_append_sheet(wb, wsSections, 'Gepruefte_Abschnitte');
  }

  const filename = `${sanitizeFilename(project.name)}_${sanitizeFilename(documentType)}_${new Date().toISOString().slice(0, 10)}.xlsx`;
  XLSX.writeFile(wb, filename);
}

/**
 * Generates a PDF billing export strictly using officialTitle (never aliasTitle).
 */
export function exportBillingToPdf(options: BillingExportOptions): void {
  const { project, positions, sections = [], includePrices, documentType = 'Geprüftes Aufmaß' } = options;
  const isLvMode = project.measurementMode === 'LV_BASED';

  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4'
  });

  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 14;
  const contentWidth = pageWidth - (margin * 2);

  // 1. Header
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(15);
  doc.setTextColor(30, 41, 59);
  doc.text('BURK Haustechnik GmbH', margin, 18);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(100, 116, 139);
  doc.text('Sanitär • Heizung • Klimatechnik | Offizielles Werk- & Rechnungsaufmaß', margin, 23);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13);
  doc.setTextColor(15, 23, 42);
  doc.text(`${documentType}: ${project.name}`, margin, 32);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(71, 85, 105);
  doc.text(`Projekt-Nr: ${project.projectNumber} | Auftraggeber: ${project.client || 'Kunde'} | Datum: ${new Date().toLocaleDateString('de-DE')}`, margin, 37);

  // Mode badge box
  doc.setFillColor(248, 250, 252);
  doc.setDrawColor(226, 232, 240);
  doc.rect(margin, 41, contentWidth, 10, 'FD');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(51, 65, 85);
  const approvedCount = sections.filter(s => s.status === 'APPROVED').length;
  doc.text(`Abrechnungsmodus: ${isLvMode ? `Ausschließlich Leistungsverzeichnis (LV_BASED) • ${approvedCount} geprüfte Abschnitte` : 'Raumbasiert (ROOM_BASED)'} • Basis: Ingenieurbüro-GAEB`, margin + 3, 47);

  // Table header
  let y = 57;
  doc.setFillColor(241, 245, 249);
  doc.rect(margin, y, contentWidth, 7, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(71, 85, 105);

  doc.text('Pos-Nr', margin + 2, y + 5);
  doc.text('Typ', margin + 18, y + 5);
  doc.text('Offizielle Bezeichnung (GAEB / Rechnungs-Kurztext)', margin + 36, y + 5);
  doc.text('Aufmaß-Menge', margin + 120, y + 5, { align: 'right' });

  if (includePrices) {
    doc.text('VK-Preis', margin + 148, y + 5, { align: 'right' });
    doc.text('Gesamt (€)', margin + contentWidth - 2, y + 5, { align: 'right' });
  }

  y += 10;
  doc.setFont('helvetica', 'normal');

  const sorted = [...positions].sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0));
  let totalSum = 0;

  sorted.forEach(p => {
    // Page break check
    if (y > 275) {
      doc.addPage();
      y = 20;
    }

    const isOriginal = p.sourceType !== 'CUSTOM_ADDED';
    const officialText = p.officialTitle || p.shortText || '';
    const code = p.displayCode || p.posNr;
    const qty = p.installedQty ?? p.qty;
    const price = Number(p.unitPriceVK ?? p.unitPrice ?? 0);
    const lineTotal = qty * price;
    totalSum += lineTotal;

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.setTextColor(30, 41, 59);
    doc.text(code, margin + 2, y);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7);
    doc.setTextColor(isOriginal ? 100 : 16, isOriginal ? 116 : 140, isOriginal ? 139 : 76);
    doc.text(isOriginal ? 'Original' : 'Nachtrag', margin + 18, y);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(15, 23, 42);
    const truncatedText = doc.splitTextToSize(officialText, includePrices ? 65 : 100);
    doc.text(truncatedText[0] || '', margin + 36, y);

    doc.setFont('helvetica', 'bold');
    doc.text(`${qty} ${p.qu}`, margin + 120, y, { align: 'right' });

    if (includePrices) {
      doc.setFont('helvetica', 'normal');
      doc.text(`${price.toFixed(2)} €`, margin + 148, y, { align: 'right' });
      doc.setFont('helvetica', 'bold');
      doc.text(`${lineTotal.toFixed(2)} €`, margin + contentWidth - 2, y, { align: 'right' });
    }

    y += 6;
  });

  // Summary box at bottom
  if (includePrices) {
    if (y > 260) {
      doc.addPage();
      y = 20;
    }
    y += 4;
    doc.setDrawColor(203, 213, 225);
    doc.line(margin, y, margin + contentWidth, y);
    y += 6;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.setTextColor(15, 23, 42);
    doc.text('Gesamtsumme netto zur Abrechnung:', margin + 70, y);
    doc.text(`${totalSum.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €`, margin + contentWidth - 2, y, { align: 'right' });
  }

  const filename = `${sanitizeFilename(project.name)}_${sanitizeFilename(documentType)}_${new Date().toISOString().slice(0, 10)}.pdf`;
  doc.save(filename);
}
