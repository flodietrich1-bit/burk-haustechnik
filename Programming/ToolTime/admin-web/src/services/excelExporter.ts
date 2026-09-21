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

export function exportRoomVobAufmassToExcel(
  room: Room,
  positions: Position[],
  projectName: string
) {
  const posMap = new Map(positions.map(p => [p.id, p]));

  // Build sheet rows from room materials
  const rows = (room.materials || []).map(mat => {
    const pos = posMap.get(mat.positionId);
    const unitPrice = mat.unitPrice || pos?.unitPrice || 0;
    const planned = mat.plannedQty || 0;
    const actual = mat.actualQty ?? planned;
    const qtyDelta = planned - actual; // >0 Minderverbrauch (Ersparnis), <0 Mehrverbrauch
    const actualTotal = actual * unitPrice;
    const costDelta = -qtyDelta * unitPrice; // positive if actual > planned (extra cost)

    let vobStatus = 'Punktgenau';
    if (qtyDelta > 0) {
      vobStatus = `Minderverbrauch (+${qtyDelta} ${mat.qu} Ersparnis)`;
    } else if (qtyDelta < 0) {
      vobStatus = `Mehrverbrauch (${qtyDelta} ${mat.qu} Mehraufwand / Sonderposten)`;
    }

    return {
      'Pos-Nr': mat.posNr || pos?.posNr || '-',
      'Gewerk / Kategorie': mat.group || pos?.group || '-',
      'Materialbezeichnung': mat.shortText || pos?.shortText || '-',
      'Soll-Menge (Plan)': planned,
      'Ist-Menge (Verbaut)': actual,
      'Einheit': mat.qu || pos?.qu || 'Stk',
      'Mengen-Delta': qtyDelta > 0 ? `+${qtyDelta} ${mat.qu}` : `${qtyDelta} ${mat.qu}`,
      'Einheitspreis (€)': unitPrice ? unitPrice.toFixed(2) : '0.00',
      'Abrechnungswert (€)': actualTotal ? actualTotal.toFixed(2) : '0.00',
      'Kosten-Delta (€)': costDelta !== 0 ? (costDelta > 0 ? `+${costDelta.toFixed(2)}` : costDelta.toFixed(2)) : '0.00',
      'VOB-Abrechnungsstatus': vobStatus
    };
  });

  const wsAufmass = XLSX.utils.json_to_sheet(rows);

  // Metadata Sheet for Room & VOB protocol
  const metaRows = [
    { 'Merkmal': 'Projekt', 'Wert': projectName },
    { 'Merkmal': 'Raum-Code', 'Wert': room.code },
    { 'Merkmal': 'Raum-Bezeichnung', 'Wert': room.name },
    { 'Merkmal': 'Geschoss / Etage', 'Wert': room.floor },
    { 'Merkmal': 'Status', 'Wert': room.status === 'completed' ? '100% Fertiggestellt' : 'In Bearbeitung' },
    { 'Merkmal': 'Fortschritt', 'Wert': `${room.progressPercent || 0}%` },
    { 'Merkmal': 'Abgenommen von', 'Wert': room.completedBy || 'Florian Buck (Bauleiter)' },
    { 'Merkmal': 'Abnahmedatum', 'Wert': room.completedAt ? new Date(room.completedAt).toLocaleDateString('de-DE') : '-' },
    { 'Merkmal': 'Exportiert am', 'Wert': new Date().toLocaleString('de-DE') },
    { 'Merkmal': 'VOB/B §14 Regelung', 'Wert': 'Aufmaßblatt für Schlussrechnung / Nachtragsprüfung' }
  ];
  const wsMeta = XLSX.utils.json_to_sheet(metaRows);

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, wsAufmass, 'VOB-Aufmaßblatt');
  XLSX.utils.book_append_sheet(wb, wsMeta, 'Raum-Protokoll');

  const cleanRoom = `${room.code}_${room.name}`.replace(/[^a-zA-Z0-9_-]/g, '_');
  const filename = `VOB_Aufmass_${projectName.replace(/\s+/g, '_')}_${cleanRoom}_${new Date().toISOString().slice(0, 10)}.xlsx`;
  XLSX.writeFile(wb, filename);
}
