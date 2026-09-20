import * as XLSX from 'xlsx';
import type { Position, Booking, Room } from '../types';

export function exportMaterialReportToExcel(
  projectName: string,
  positions: Position[],
  bookings: Booking[],
  rooms: Room[]
) {
  const roomMap = new Map(rooms.map(r => [r.id, r.name]));

  // Sheet 1: Material Overview
  const matData = positions.map(p => {
    const percent = p.qty > 0 ? Math.round((p.deliveredQty / p.qty) * 100) : 0;
    return {
      'Pos-Nr': p.posNr,
      'Kategorie / Gewerk': p.group,
      'Bezeichnung': p.shortText,
      'Soll-Menge': p.qty,
      'Ist-Geliefert': p.deliveredQty,
      'Einheit': p.qu,
      'Fortschritt (%)': `${percent}%`,
      'Einzelpreis (€)': p.unitPrice ? p.unitPrice.toFixed(2) : '-',
      'Gesamtwert (€)': p.unitPrice ? (p.deliveredQty * p.unitPrice).toFixed(2) : '-',
      'Status': p.deliveredQty >= p.qty ? 'Vollständig' : p.deliveredQty > 0 ? 'Teilgeliefert' : 'Offen'
    };
  });

  const wsMat = XLSX.utils.json_to_sheet(matData);

  // Sheet 2: Bookings Log
  const bookData = bookings.map(b => ({
    'Datum': new Date(b.createdAt).toLocaleString('de-DE'),
    'KW': b.calendarWeek || '-',
    'Monteur': b.createdBy,
    'Raum': roomMap.get(b.roomId) || b.roomId,
    'Pos-Nr': b.positionNr || '-',
    'Material': b.positionName || '-',
    'Gelieferte Menge': b.quantity,
    'Einheit': b.qu || '-',
    'Bemerkung': b.note || '-'
  }));

  const wsBook = XLSX.utils.json_to_sheet(bookData);

  // Create workbook
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, wsMat, 'Materialbilanz');
  XLSX.utils.book_append_sheet(wb, wsBook, 'Monteursbuchungen');

  // Trigger download
  const filename = `ToolTime_Materialbilanz_${projectName.replace(/\s+/g, '_')}_${new Date().toISOString().slice(0, 10)}.xlsx`;
  XLSX.writeFile(wb, filename);
}
