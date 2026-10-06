import * as XLSX from 'xlsx';
import type { Position, Booking, Room, AufmassDocument } from '../types';
import { getMaterialActualQty } from './firestoreService';

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
    'Datum': b.createdAt ? new Date(b.createdAt).toLocaleString('de-DE') : '-',
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
  projectName: string,
  bookings: Booking[] = []
) {
  const posMap = new Map(positions.map(p => [p.id, p]));
  const isExplicitlyUnlocked = room.isCompleted === false || room.status === 'in_progress';
  const isCompleted = !isExplicitlyUnlocked && (room.status === 'completed' || room.isCompleted === true || ((room as any).pct === 100));

  // Build sheet rows from room materials
  const rows = (room.materials || []).map(mat => {
    const pos = posMap.get(mat.positionId);
    const unitPrice = mat.unitPrice || pos?.unitPrice || 0;
    const planned = mat.plannedQty || 0;
    
    const actual = getMaterialActualQty(mat, room, bookings);
    const isOver = actual > planned;
    const isUnder = actual < planned;
    const excessQty = isOver ? (actual - planned) : 0;
    const underQty = isUnder ? (planned - actual) : 0;

    const actualTotal = actual * unitPrice;
    const costDelta = isOver 
      ? (excessQty * unitPrice) 
      : (isUnder && isCompleted ? -(underQty * unitPrice) : 0);

    let vobStatus = 'Punktgenau';
    let deltaDisplay = '0 ' + (mat.qu || 'Stk');
    if (isOver) {
      vobStatus = `Mehrverbrauch (+${excessQty} ${mat.qu} Sonderposten/Mehraufwand)`;
      deltaDisplay = `+${excessQty} ${mat.qu}`;
    } else if (isUnder) {
      if (isCompleted) {
        vobStatus = `Minderverbrauch (-${underQty} ${mat.qu} Ersparnis/Retoure)`;
        deltaDisplay = `-${underQty} ${mat.qu}`;
      } else {
        vobStatus = `In Montage (Offen: ${underQty} ${mat.qu})`;
        deltaDisplay = `Offen: ${underQty} ${mat.qu}`;
      }
    }

    return {
      'Pos-Nr': mat.posNr || pos?.posNr || '-',
      'Gewerk / Kategorie': mat.group || pos?.group || '-',
      'Materialbezeichnung': mat.shortText || pos?.shortText || '-',
      'Soll-Menge (Plan)': planned,
      'Ist-Menge (Verbaut)': actual,
      'Einheit': mat.qu || pos?.qu || 'Stk',
      'Mengen-Delta': deltaDisplay,
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
    { 'Merkmal': 'Abgenommen von', 'Wert': room.completedBy || 'Florian Buck (Projektleiter)' },
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

/**
 * Export a complete Aufmaß Snapshot into an Excel (.xlsx) file with 2 sheets:
 * Sheet 1: Gesamtübersicht (aggregated period totals)
 * Sheet 2: Räume (detailed room breakdown with overconsumption and reasons)
 */
export function exportAufmassToExcel(aufmass: AufmassDocument) {
  const wb = XLSX.utils.book_new();

  // -------------------------------------------------------------
  // SHEET 1: Gesamtübersicht
  // -------------------------------------------------------------
  const summaryHeader = [
    ['AUFMASS-PROTOKOLL (GESAMTÜBERSICHT)'],
    ['Projekt:', aufmass.projectName],
    ['Aufmaß-Nr:', aufmass.aufmassNumber],
    ['Stichtag der Abrechnung:', new Date(aufmass.dateTo).toLocaleDateString('de-DE')],
    ['Zeitraum (Delta seit vorigem Aufmaß):', `Von ${new Date(aufmass.dateFrom).toLocaleDateString('de-DE')} bis ${new Date(aufmass.dateTo).toLocaleDateString('de-DE')}`],
    ['Erstellt am:', `${new Date(aufmass.createdAt).toLocaleString('de-DE')} von ${aufmass.createdBy}`],
    ['Gesamtvolumen (€):', `${aufmass.totalPeriodVolume.toFixed(2)} €`],
    [] // blank line
  ];

  const summaryRows = aufmass.summaryItems.map(item => ({
    'Pos-Nr': item.posNr,
    'Gewerk / Kategorie': item.group || '-',
    'Material / Leistungsbezeichnung': item.shortText,
    'Soll-Menge (Plan)': item.plannedQty,
    'Kumuliert bis Stichtag': item.totalInstalledUpToDate,
    'Delta seit vorigem Aufmaß': item.periodInstalledQty,
    'Einheit': item.qu,
    'Einzelpreis (€)': item.unitPrice ? item.unitPrice.toFixed(2) : '0.00',
    'Abrechnungsbetrag (€)': item.totalCost ? item.totalCost.toFixed(2) : '0.00'
  }));

  const wsSummary = XLSX.utils.aoa_to_sheet(summaryHeader);
  XLSX.utils.sheet_add_json(wsSummary, summaryRows, { origin: 'A9' });

  // -------------------------------------------------------------
  // SHEET 2: Räume (Detailaufstellung nach Räumen mit Begründungszeilen)
  // -------------------------------------------------------------
  const roomRows: any[] = [];

  aufmass.roomsData.forEach(room => {
    // Room Header Row
    roomRows.push({
      'Raum / Code': `${room.roomCode} - ${room.roomName} (Etage: ${room.floor})`,
      'Pos-Nr': room.isCompleted ? '✓ 100% Abgeschlossen' : 'In Montage',
      'Materialbezeichnung': '',
      'Plan-Menge': '',
      'Delta seit vorigem Aufmaß': '',
      'Kumuliert bis Stichtag': '',
      'Einheit': '',
      'Mehrverbrauch': '',
      'Hinweis / Begründung': ''
    });

    if (room.positions.length === 0) {
      roomRows.push({
        'Raum / Code': '',
        'Pos-Nr': '-',
        'Materialbezeichnung': '(Keine Positionen für diesen Raum)',
        'Plan-Menge': '',
        'Delta seit vorigem Aufmaß': '',
        'Kumuliert bis Stichtag': '',
        'Einheit': '',
        'Mehrverbrauch': '',
        'Hinweis / Begründung': ''
      });
    } else {
      room.positions.forEach(pos => {
        let deviationText = '-';
        if (pos.isOverconsumption) {
          deviationText = `+${pos.excessQty} ${pos.qu} (MEHRVERBRAUCH)`;
        } else if (pos.isExtraPosition) {
          deviationText = `+${pos.installedInPeriod} ${pos.qu} (ZUSATZPOSITION)`;
        }

        // Primary row for position
        roomRows.push({
          'Raum / Code': '',
          'Pos-Nr': pos.posNr,
          'Materialbezeichnung': pos.isExtraPosition ? `[Zusatzposition] ${pos.shortText}` : pos.shortText,
          'Plan-Menge': pos.plannedQty,
          'Delta seit vorigem Aufmaß': pos.installedInPeriod,
          'Kumuliert bis Stichtag': pos.totalInstalledToDate,
          'Einheit': pos.qu,
          'Mehrverbrauch': deviationText,
          'Hinweis / Begründung': pos.reason || ''
        });

        // If there's an explicit reason, also append a dedicated notice row underneath for clear printing
        if ((pos.isOverconsumption || pos.isExtraPosition) && pos.reason) {
          roomRows.push({
            'Raum / Code': '',
            'Pos-Nr': '',
            'Materialbezeichnung': `  ↳ BEGRÜNDUNG: ${pos.reason}`,
            'Plan-Menge': '',
            'Delta seit vorigem Aufmaß': '',
            'Kumuliert bis Stichtag': '',
            'Einheit': '',
            'Mehrverbrauch': '',
            'Hinweis / Begründung': ''
          });
        }
      });
    }

    // Blank separator row between rooms
    roomRows.push({
      'Raum / Code': '',
      'Pos-Nr': '',
      'Materialbezeichnung': '',
      'Plan-Menge': '',
      'Delta seit vorigem Aufmaß': '',
      'Kumuliert bis Stichtag': '',
      'Einheit': '',
      'Mehrverbrauch': '',
      'Hinweis / Begründung': ''
    });
  });

  const wsRooms = XLSX.utils.json_to_sheet(roomRows);

  // Append sheets
  XLSX.utils.book_append_sheet(wb, wsSummary, 'Gesamtübersicht');
  XLSX.utils.book_append_sheet(wb, wsRooms, 'Räume');

  // Trigger file download
  const cleanProject = aufmass.projectName.replace(/[^a-zA-Z0-9_-]/g, '_');
  const filename = `Aufmass_${aufmass.aufmassNumber}_${cleanProject}_${aufmass.dateTo}.xlsx`;
  XLSX.writeFile(wb, filename);
}

/**
 * PDF-Export: druckfertiges Aufmaß (Browser-Druckdialog -> "Als PDF speichern").
 * Enthält kumulierte Menge bis Stichtag UND Delta seit dem vorigen Aufmaß.
 */
export function exportAufmassToPdf(aufmass: AufmassDocument) {
  const esc = (v: unknown) => String(v ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  const eur = (n: number) => `${(n || 0).toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €`;
  const d = (s: string) => new Date(s).toLocaleDateString('de-DE');

  const summaryRows = aufmass.summaryItems.map(i => `<tr>
    <td>${esc(i.posNr)}</td><td>${esc(i.shortText)}</td>
    <td class="r">${i.plannedQty}</td>
    <td class="r b">${i.totalInstalledUpToDate}</td>
    <td class="r b">${i.periodInstalledQty}</td>
    <td>${esc(i.qu)}</td>
    <td class="r">${i.unitPrice ? i.unitPrice.toFixed(2) : '-'}</td>
    <td class="r b">${i.totalCost ? i.totalCost.toFixed(2) : '-'}</td></tr>`).join('');

  const roomBlocks = aufmass.roomsData.map(r => `
    <h3>${esc(r.roomCode)} – ${esc(r.roomName)} (Etage ${esc(r.floor)}) ${r.isCompleted ? '✓ abgeschlossen' : '(in Montage)'}</h3>
    <table><thead><tr><th>Pos</th><th>Material</th><th class="r">Plan</th><th class="r">Kumuliert bis Stichtag</th><th class="r">Delta seit vorigem Aufmaß</th><th>Hinweis</th></tr></thead><tbody>
    ${r.positions.map(p => `<tr><td>${esc(p.posNr)}</td><td>${esc(p.shortText)}</td><td class="r">${p.plannedQty} ${esc(p.qu)}</td><td class="r b">${p.totalInstalledToDate}</td><td class="r b">${p.installedInPeriod}</td><td>${p.isOverconsumption ? `+${p.excessQty} ${esc(p.qu)} ` : ''}${esc(p.reason || '')}</td></tr>`).join('')}
    </tbody></table>`).join('');

  const html = `<!doctype html><html lang="de"><head><meta charset="utf-8"><title>${esc(aufmass.aufmassNumber)}</title>
  <style>
    body{font-family:Arial,sans-serif;font-size:11px;color:#111;margin:24px}
    h1{font-size:18px;margin:0}h3{font-size:12px;margin:16px 0 4px}
    .brand{color:#3B82C4;font-weight:bold;font-size:12px}
    table{width:100%;border-collapse:collapse;margin-top:6px}
    th,td{border:1px solid #ccc;padding:4px 6px;text-align:left}
    th{background:#eef2f7}.r{text-align:right}.b{font-weight:bold}
    .meta td{border:none;padding:1px 6px 1px 0}
    .sig{display:flex;gap:60px;margin-top:50px}.sig div{border-top:1px solid #000;width:240px;padding-top:4px}
    @media print{.pb{page-break-before:always}}
  </style></head><body>
  <div class="brand">BURK Haustechnik</div>
  <h1>Aufmaß ${esc(aufmass.aufmassNumber)}</h1>
  <table class="meta"><tr><td>Projekt:</td><td><b>${esc(aufmass.projectName)}</b></td></tr>
  <tr><td>Stichtag der Abrechnung:</td><td><b>${d(aufmass.dateTo)}</b></td></tr>
  <tr><td>Delta-Zeitraum (seit vorigem Aufmaß):</td><td>${d(aufmass.dateFrom)} bis ${d(aufmass.dateTo)}</td></tr>
  <tr><td>Erstellt:</td><td>${new Date(aufmass.createdAt).toLocaleString('de-DE')} von ${esc(aufmass.createdBy)}</td></tr>
  <tr><td>Abrechnungsvolumen (Delta):</td><td><b>${eur(aufmass.totalPeriodVolume)}</b></td></tr></table>
  ${aufmass.notes ? `<p>Bemerkung: ${esc(aufmass.notes)}</p>` : ''}
  <h3>Gesamtübersicht</h3>
  <table><thead><tr><th>Pos</th><th>Material / Leistung</th><th class="r">Plan</th><th class="r">Kumuliert bis Stichtag</th><th class="r">Delta seit vorigem Aufmaß</th><th>Einheit</th><th class="r">EP (€)</th><th class="r">Betrag Delta (€)</th></tr></thead><tbody>${summaryRows}</tbody></table>
  <div class="pb"></div>
  <h2>Raumaufstellung</h2>${roomBlocks}
  <div class="sig"><div>Datum / Auftragnehmer</div><div>Datum / Auftraggeber</div></div>
  <script>window.onload=function(){window.focus();window.print();}<\/script>
  </body></html>`;

  const w = window.open('', '_blank');
  if (!w) {
    alert('Pop-up wurde blockiert. Bitte Pop-ups für den PDF-Export erlauben.');
    return;
  }
  w.document.write(html);
  w.document.close();
}
