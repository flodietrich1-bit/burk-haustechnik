import * as XLSX from 'xlsx';
import type { Position, Booking, Room, AufmassDocument, Alert, Addendum } from '../types';
import { getMaterialActualQty } from './firestoreService';

/**
 * Vollständige reale Baustellenbilanz als Excel-Export:
 * - Spalte 1: Plan-Soll (GAEB LV-Menge)
 * - Spalte 2: Geliefert (Lieferschein)
 * - Spalte 3: Tatsächlich verbaut (Baustelle - Ist)
 * - Spalte 4: Delta Verbau (Soll vs. Ist) mit farbiger/textueller Kennzeichnung bei Überschreitung
 * - Spalte 5: Restbedarf offene Räume
 * - Spalte 6: Nachträge & Zusatzpositionen inkl. protokollierter Monteur-Begründung
 */
export function exportMaterialReportToExcel(
  projectName: string,
  positions: Position[],
  bookings: Booking[],
  rooms: Room[],
  alerts: Alert[] = [],
  addendums: Addendum[] = []
) {
  const roomMap = new Map(rooms.map(r => [r.id, r.name]));

  // Index alerts and addendums for instant lookup
  const alertMap = new Map<string, Alert>();
  alerts.forEach(a => {
    if (a.materialPos) alertMap.set(a.materialPos, a);
    if (a.materialId) alertMap.set(a.materialId, a);
  });

  // Calculate project-wide actuals, remaining requirements, and deviations
  const matData: any[] = positions.map(p => {
    // Spalte 1: Plan-Soll (GAEB LV-Menge)
    const planSoll = Number(p.qty) || 0;

    // Spalte 2: Geliefert (Lieferschein)
    const delivered = Number(p.deliveredQty !== undefined && p.deliveredQty !== null ? p.deliveredQty : p.qty) || 0;

    // Spalte 3: Tatsächlich verbaut (Baustelle - Ist) across all rooms + direct bookings
    let roomInstalled = 0;
    let remainingNeeded = 0;
    let hasRoomMatches = false;
    let allRoomsCompleted = true;

    rooms.forEach(r => {
      const isUnlocked = r.isCompleted === false || r.status === 'in_progress';
      const isDone = !isUnlocked && (r.status === 'completed' || r.isCompleted === true || ((r as any).pct === 100));

      (r.materials || []).forEach(m => {
        const isMatch = 
          (m.positionId && m.positionId === p.id) ||
          (m.posNr && m.posNr === p.posNr) ||
          (m.shortText && p.shortText && m.shortText.trim().toLowerCase() === p.shortText.trim().toLowerCase());

        if (isMatch) {
          hasRoomMatches = true;
          if (!isDone) allRoomsCompleted = false;
          const pl = Number(m.plannedQty) || 0;
          const act = getMaterialActualQty(m, r, bookings);
          roomInstalled += act;
          if (!isDone && pl > act) {
            remainingNeeded += (pl - act);
          }
        }
      });
    });

    let standaloneBookings = 0;
    const relatedNotes: string[] = [];
    bookings.forEach(b => {
      const bPosId = b.positionId || (b as any).itemId;
      const bPosNr = b.positionNr || (b as any).itemOz;
      if (bPosId === p.id || (bPosNr && bPosNr === p.posNr)) {
        if (!hasRoomMatches) standaloneBookings += Number(b.quantity) || 0;
        if (b.note && b.note.trim()) {
          relatedNotes.push(`${b.createdBy || 'Monteur'}: "${b.note.trim()}"`);
        }
      }
    });

    const totalInstalled = hasRoomMatches ? roomInstalled : Math.max(Number(p.installedQty) || 0, standaloneBookings);

    // Spalte 4: Delta Verbau (Soll vs. Ist)
    const rawDiff = totalInstalled - planSoll;
    let deltaVerbau = `0 ${p.qu} (Punktgenau)`;
    let statusBewertung = 'Punktgenau im Plan';
    if (rawDiff > 0) {
      deltaVerbau = `+${rawDiff} ${p.qu} [ÜBERSCHREITUNG / MEHRBEDARF]`;
      statusBewertung = 'ROT (Überschreitung / Mehrkosten)';
    } else if (rawDiff < 0) {
      if (allRoomsCompleted && hasRoomMatches) {
        deltaVerbau = `-${Math.abs(rawDiff)} ${p.qu} [MINDERVERBRAUCH]`;
        statusBewertung = 'GRÜN (Minderverbrauch / Ersparnis)';
      } else {
        deltaVerbau = `Offen: ${Math.abs(rawDiff)} ${p.qu} [In Montage]`;
        statusBewertung = 'GELB (In Ausführung)';
      }
    }

    // Spalte 5: Restbedarf offene Räume
    const restbedarf = hasRoomMatches 
      ? (remainingNeeded > 0 ? `${remainingNeeded} ${p.qu}` : `0 ${p.qu} (Abgeschlossen)`)
      : (Math.max(0, planSoll - totalInstalled) > 0 ? `${Math.max(0, planSoll - totalInstalled)} ${p.qu}` : `0 ${p.qu}`);

    // Spalte 6: Nachträge & Zusatzpositionen inkl. protokollierter Monteur-Begründung
    const alert = alertMap.get(p.posNr) || alertMap.get(p.id);
    const relatedAddendums = addendums.filter(a => a.itemOz === p.posNr || a.materialId === p.id);
    
    let begruendung = '';
    if (alert && alert.reason) {
      begruendung += `[Meldung: ${alert.monteurName}] ${alert.reason}; `;
    }
    if (relatedAddendums.length > 0) {
      relatedAddendums.forEach(a => {
        begruendung += `[Nachtrag: ${a.title} (${a.quantity})] ${a.note || ''}; `;
      });
    }
    if (relatedNotes.length > 0 && !begruendung) {
      begruendung = relatedNotes.slice(0, 2).join(' | ');
    }
    if (!begruendung) {
      begruendung = rawDiff > 0 ? 'Vor-Ort-Mehrverbrauch (keine Freitextbegründung)' : '-';
    }

    const unitPrice = p.unitPrice || 0;
    const verbautWert = totalInstalled * unitPrice;

    return {
      'Pos-Nr': p.posNr,
      'Kategorie / Gewerk': p.group || 'Allgemein',
      'Materialbezeichnung': p.shortText,
      'Plan-Soll (GAEB LV-Menge)': planSoll,
      'Geliefert (Lieferschein)': delivered,
      'Tatsächlich verbaut (Baustelle - Ist)': totalInstalled,
      'Einheit': p.qu,
      'Delta Verbau (Soll vs. Ist)': deltaVerbau,
      'Restbedarf offene Räume': restbedarf,
      'Status / VOB-Bewertung': statusBewertung,
      'Nachträge & Zusatzpositionen (Monteur-Begründung)': begruendung,
      'Einzelpreis (€)': unitPrice ? unitPrice.toFixed(2) : '0.00',
      'Abrechnungswert Ist (€)': verbautWert ? verbautWert.toFixed(2) : '0.00'
    };
  });

  // Append any Extra/Unplanned Addendums that are not part of regular LV positions
  const knownPosNrs = new Set(positions.map(p => p.posNr));
  const knownPosIds = new Set(positions.map(p => p.id));

  addendums.forEach(a => {
    const isKnown = (a.itemOz && knownPosNrs.has(a.itemOz)) || (a.materialId && knownPosIds.has(a.materialId));
    if (!isKnown && a.type === 'material') {
      const qtyNum = typeof a.quantity === 'number' ? a.quantity : parseFloat(String(a.quantity).replace(',', '.')) || 1;
      matData.push({
        'Pos-Nr': a.itemOz || 'NACHTRAG',
        'Kategorie / Gewerk': 'Zusatz / Nachtrag',
        'Materialbezeichnung': `[ZUSATZPOSITION] ${a.title}`,
        'Plan-Soll (GAEB LV-Menge)': 0,
        'Geliefert (Lieferschein)': 0,
        'Tatsächlich verbaut (Baustelle - Ist)': qtyNum,
        'Einheit': a.qu || 'Stk',
        'Delta Verbau (Soll vs. Ist)': `+${qtyNum} [ZUSATZBEDARF]`,
        'Restbedarf offene Räume': '0',
        'Status / VOB-Bewertung': 'ROT (Außerplanmäßiger Nachtrag)',
        'Nachträge & Zusatzpositionen (Monteur-Begründung)': `[Nachtrag: ${a.requestedBy || 'Monteur'}] ${a.note || a.description || 'Außerplanmäßig verbaut'}`,
        'Einzelpreis (€)': '0.00',
        'Abrechnungswert Ist (€)': '0.00'
      });
    }
  });

  const wsMat = XLSX.utils.json_to_sheet(matData);

  // Sheet 2: Bookings Log
  const bookData = bookings.map(b => ({
    'Datum': b.createdAt ? new Date(b.createdAt).toLocaleString('de-DE') : '-',
    'KW': b.calendarWeek || '-',
    'Monteur': b.createdBy,
    'Raum': roomMap.get(b.roomId) || b.roomId,
    'Pos-Nr': b.positionNr || (b as any).itemOz || '-',
    'Material': b.positionName || (b as any).itemText || '-',
    'Verbaut / Geliefert': b.quantity,
    'Einheit': b.qu || '-',
    'Monteur-Hinweis': b.note || '-'
  }));
  const wsBook = XLSX.utils.json_to_sheet(bookData);

  // Sheet 3: Nachtrags-Protokoll
  const addendumData = addendums.map(a => ({
    'ID': a.id,
    'Art': a.type === 'stunden' ? 'Arbeitszeit / Regie' : 'Material-Nachtrag',
    'Titel': a.title,
    'Menge': a.quantity,
    'Raum': a.roomName || roomMap.get(a.roomId) || 'Baustelle allgemein',
    'Erfasst von': a.requestedBy,
    'Status': a.status === 'approved' ? 'Freigegeben' : a.status === 'rejected' ? 'Abgelehnt' : 'Offen / In Prüfung',
    'Begründung': a.note || a.description || '-',
    'Datum': a.createdAt ? new Date(a.createdAt).toLocaleString('de-DE') : '-'
  }));
  const wsAddendums = XLSX.utils.json_to_sheet(addendumData);

  // Create workbook
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, wsMat, 'Baustellenbilanz');
  XLSX.utils.book_append_sheet(wb, wsBook, 'Monteursbuchungen');
  if (addendums.length > 0) {
    XLSX.utils.book_append_sheet(wb, wsAddendums, 'Nachtragsprotokoll');
  }

  // Trigger download
  const filename = `ToolTime_Baustellenbilanz_${projectName.replace(/\s+/g, '_')}_${new Date().toISOString().slice(0, 10)}.xlsx`;
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
      deltaDisplay = `+${excessQty} ${mat.qu} [ÜBERSCHREITUNG]`;
    } else if (isUnder) {
      if (isCompleted) {
        vobStatus = `Minderverbrauch (-${underQty} ${mat.qu} Ersparnis/Retoure)`;
        deltaDisplay = `-${underQty} ${mat.qu} [MINDERVERBRAUCH]`;
      } else {
        vobStatus = `In Montage (Offen: ${underQty} ${mat.qu})`;
        deltaDisplay = `Offen: ${underQty} ${mat.qu} [In Ausführung]`;
      }
    }

    const gaebQty = Number(pos?.qty) || planned;
    const deliveredQty = (pos && pos.deliveredQty !== undefined && pos.deliveredQty !== null) ? pos.deliveredQty : gaebQty;
    const restbedarf = !isCompleted && planned > actual ? `${planned - actual} ${mat.qu || 'Stk'}` : '0';

    return {
      'Pos-Nr': mat.posNr || pos?.posNr || '-',
      'Gewerk / Kategorie': mat.group || pos?.group || '-',
      'Materialbezeichnung': mat.shortText || pos?.shortText || '-',
      'Plan-Soll (GAEB LV-Menge)': planned,
      'Geliefert (Lieferschein)': deliveredQty,
      'Tatsächlich verbaut (Baustelle - Ist)': actual,
      'Einheit': mat.qu || pos?.qu || 'Stk',
      'Delta Verbau (Soll vs. Ist)': deltaDisplay,
      'Restbedarf': restbedarf,
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
/**
 * Export a complete Aufmaß Snapshot into an Excel (.xlsx) file with 2 sheets:
 * Sheet 1: Gesamtübersicht (only installed period totals with wide columns)
 * Sheet 2: Räume (separated into 'Planmäßig verbaut' and 'Sonderposten' with cause & reason)
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
    ['Verbaute Positionen:', `${aufmass.summaryItems.length} Positionen in ${aufmass.roomsData.length} bearbeiteten Räumen`],
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
  XLSX.utils.sheet_add_json(wsSummary, summaryRows, { origin: 'A10' });

  // Feste Spaltenbreiten (Breite Spalten für Beschreibung)
  wsSummary['!cols'] = [
    { wch: 14 }, // Pos-Nr
    { wch: 24 }, // Gewerk / Kategorie
    { wch: 50 }, // Material / Leistungsbezeichnung (großzügig breit!)
    { wch: 18 }, // Soll-Menge (Plan)
    { wch: 22 }, // Kumuliert bis Stichtag
    { wch: 24 }, // Delta seit vorigem Aufmaß
    { wch: 10 }, // Einheit
    { wch: 16 }, // Einzelpreis (€)
    { wch: 22 }  // Abrechnungsbetrag (€)
  ];

  // -------------------------------------------------------------
  // SHEET 2: Räume (Detailaufstellung nach Räumen mit Planmäßig vs Sonderposten)
  // -------------------------------------------------------------
  const roomRows: any[] = [];

  aufmass.roomsData.forEach(room => {
    const planned = room.plannedPositions || room.positions.filter(p => !p.isExtraPosition);
    const special = room.specialPositions || room.positions.filter(p => p.isExtraPosition);

    // 1. Room Header Row
    roomRows.push({
      'Bereich / Raum': `${room.roomCode} - ${room.roomName} (Etage: ${room.floor})`,
      'Pos-Nr': room.isCompleted ? '✓ 100% Abgeschlossen' : 'In Montage',
      'Materialbezeichnung': '',
      'Plan-Menge': '',
      'Verbaut im Zeitraum': '',
      'Kumuliert bis Stichtag': '',
      'Einheit': '',
      'Art / Status': '',
      'Begründung': '',
      'Verursacher': ''
    });

    // 2. Section: Planmäßig verbaut (laut Plan)
    roomRows.push({
      'Bereich / Raum': '--- 1. Planmäßig verbaut (laut Plan) ---',
      'Pos-Nr': '',
      'Materialbezeichnung': '',
      'Plan-Menge': '',
      'Verbaut im Zeitraum': '',
      'Kumuliert bis Stichtag': '',
      'Einheit': '',
      'Art / Status': '',
      'Begründung': '',
      'Verursacher': ''
    });

    if (planned.length === 0) {
      roomRows.push({
        'Bereich / Raum': '',
        'Pos-Nr': '–',
        'Materialbezeichnung': '(Keine planmäßigen Teile verbaut)',
        'Plan-Menge': '',
        'Verbaut im Zeitraum': '',
        'Kumuliert bis Stichtag': '',
        'Einheit': '',
        'Art / Status': '–',
        'Begründung': '',
        'Verursacher': ''
      });
    } else {
      planned.forEach(p => {
        roomRows.push({
          'Bereich / Raum': '',
          'Pos-Nr': p.posNr,
          'Materialbezeichnung': p.shortText,
          'Plan-Menge': p.plannedQty,
          'Verbaut im Zeitraum': p.installedInPeriod > 0 ? p.installedInPeriod : '–',
          'Kumuliert bis Stichtag': p.totalInstalledToDate,
          'Einheit': p.qu,
          'Art / Status': 'Planmäßig verbaut',
          'Begründung': '',
          'Verursacher': ''
        });
      });
    }

    // 3. Section: Sonderposten (Zusätzlich verbaut)
    roomRows.push({
      'Bereich / Raum': '--- 2. Sonderposten (Zusätzlich verbaut) ---',
      'Pos-Nr': '',
      'Materialbezeichnung': '',
      'Plan-Menge': '',
      'Verbaut im Zeitraum': '',
      'Kumuliert bis Stichtag': '',
      'Einheit': '',
      'Art / Status': '',
      'Begründung': '',
      'Verursacher': ''
    });

    if (special.length === 0) {
      roomRows.push({
        'Bereich / Raum': '',
        'Pos-Nr': '–',
        'Materialbezeichnung': '(Keine Sonderposten – alle Arbeiten planmäßig ausgeführt)',
        'Plan-Menge': '',
        'Verbaut im Zeitraum': '',
        'Kumuliert bis Stichtag': '',
        'Einheit': '',
        'Art / Status': 'Kein Mehrbedarf',
        'Begründung': '–',
        'Verursacher': '–'
      });
    } else {
      special.forEach(p => {
        roomRows.push({
          'Bereich / Raum': '',
          'Pos-Nr': p.posNr,
          'Materialbezeichnung': p.shortText,
          'Plan-Menge': '–',
          'Verbaut im Zeitraum': p.installedInPeriod > 0 ? `+${p.installedInPeriod}` : '–',
          'Kumuliert bis Stichtag': `+${p.totalInstalledToDate || p.excessQty}`,
          'Einheit': p.qu,
          'Art / Status': p.specialType === 'mehrverbrauch' ? 'Mehrverbrauch' : 'Zusatzmaterial',
          'Begründung': p.reason || 'Baustellenanpassung',
          'Verursacher': p.causedBy || 'Monteur'
        });
      });
    }

    // Blank separator row between rooms
    roomRows.push({
      'Bereich / Raum': '',
      'Pos-Nr': '',
      'Materialbezeichnung': '',
      'Plan-Menge': '',
      'Verbaut im Zeitraum': '',
      'Kumuliert bis Stichtag': '',
      'Einheit': '',
      'Art / Status': '',
      'Begründung': '',
      'Verursacher': ''
    });
  });

  const wsRooms = XLSX.utils.json_to_sheet(roomRows);

  // Feste Spaltenbreiten für Räume-Sheet
  wsRooms['!cols'] = [
    { wch: 34 }, // Bereich / Raum
    { wch: 14 }, // Pos-Nr
    { wch: 48 }, // Materialbezeichnung (breit!)
    { wch: 14 }, // Plan-Menge
    { wch: 22 }, // Verbaut im Zeitraum
    { wch: 22 }, // Kumuliert bis Stichtag
    { wch: 10 }, // Einheit
    { wch: 20 }, // Art / Status
    { wch: 42 }, // Begründung (breit!)
    { wch: 18 }  // Verursacher
  ];

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
 * Enthält nur verbaute Posten, getrennt nach Planmäßig vs Sonderposten (mit Grund & Verursacher).
 */
export function exportAufmassToPdf(aufmass: AufmassDocument) {
  const esc = (v: unknown) => String(v ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  const eur = (n: number) => `${(n || 0).toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €`;
  const d = (s: string) => new Date(s).toLocaleDateString('de-DE');

  const summaryRows = aufmass.summaryItems.map(i => `<tr>
    <td class="b" style="color: #1e40af;">${esc(i.posNr)}</td>
    <td style="word-break: break-word;">${esc(i.shortText)}</td>
    <td class="r">${i.plannedQty}</td>
    <td class="r b">${i.totalInstalledUpToDate}</td>
    <td class="r b" style="color: #2563eb;">${i.periodInstalledQty}</td>
    <td class="c">${esc(i.qu)}</td>
    <td class="r">${i.unitPrice ? i.unitPrice.toFixed(2) : '-'}</td>
    <td class="r b">${i.totalCost ? i.totalCost.toFixed(2) : '-'}</td></tr>`).join('');

  const roomBlocks = aufmass.roomsData.map(r => {
    const planned = r.plannedPositions || r.positions.filter(p => !p.isExtraPosition);
    const special = r.specialPositions || r.positions.filter(p => p.isExtraPosition);

    return `
    <div class="room-block">
      <h3>${esc(r.roomCode)} – ${esc(r.roomName)} (Etage ${esc(r.floor)}) ${r.isCompleted ? '✓ abgeschlossen' : '(in Montage)'}</h3>
      
      <!-- Bereich 1: Planmäßig verbaut -->
      <div class="sub-head">Planmäßig verbaut (laut Plan)</div>
      <table>
        <colgroup>
          <col style="width: 12%;">
          <col style="width: 44%;">
          <col style="width: 14%;">
          <col style="width: 15%;">
          <col style="width: 15%;">
        </colgroup>
        <thead>
          <tr>
            <th>Pos</th>
            <th>Material / Beschreibung</th>
            <th class="r">Plan-Menge</th>
            <th class="r">Kumuliert Ist</th>
            <th class="r">Delta Zeitraum</th>
          </tr>
        </thead>
        <tbody>
          ${planned.length === 0 ? `<tr><td colspan="5" style="color: #94a3b8; text-align: center; font-style: italic;">Keine planmäßigen Teile verbaut</td></tr>` : 
            planned.map(p => `<tr>
              <td class="b" style="color: #1e40af;">${esc(p.posNr)}</td>
              <td style="word-break: break-word;">${esc(p.shortText)}</td>
              <td class="r">${p.plannedQty} ${esc(p.qu)}</td>
              <td class="r b">${p.totalInstalledToDate} ${esc(p.qu)}</td>
              <td class="r b" style="color: #2563eb;">${p.installedInPeriod > 0 ? `${p.installedInPeriod} ${esc(p.qu)}` : '–'}</td>
            </tr>`).join('')}
        </tbody>
      </table>

      <!-- Bereich 2: Sonderposten -->
      <div class="sub-head special">Sonderposten (Zusätzlich verbaut)</div>
      ${special.length === 0 ? `
        <div style="font-size: 9px; font-style: italic; color: #64748b; margin: 4px 0 10px 4px;">
          ✓ Keine Sonderposten in diesem Raum – alle Arbeiten planmäßig ausgeführt.
        </div>
      ` : `
        <table>
          <colgroup>
            <col style="width: 12%;">
            <col style="width: 32%;">
            <col style="width: 14%;">
            <col style="width: 26%;">
            <col style="width: 16%;">
          </colgroup>
          <thead>
            <tr style="background: #fef2f2;">
              <th>Pos</th>
              <th>Material / Beschreibung</th>
              <th class="r">Mehrung</th>
              <th>Begründung</th>
              <th>Verursacher</th>
            </tr>
          </thead>
          <tbody>
            ${special.map(p => `<tr>
              <td class="b" style="color: #b91c1c;">${esc(p.posNr)}</td>
              <td style="word-break: break-word;">${esc(p.shortText)}</td>
              <td class="r b" style="color: #b91c1c;">+${p.totalInstalledToDate || p.excessQty} ${esc(p.qu)}</td>
              <td style="word-break: break-word; font-style: italic;">${esc(p.reason || 'Mehrverbrauch')}</td>
              <td><span class="badge">${esc(p.causedBy || 'Monteur')}</span></td>
            </tr>`).join('')}
          </tbody>
        </table>
      `}
    </div>`;
  }).join('');

  const html = `<!doctype html><html lang="de"><head><meta charset="utf-8"><title>${esc(aufmass.aufmassNumber)}</title>
  <style>
    @page { size: A4 landscape; margin: 12mm 14mm; }
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; font-size: 10px; color: #0f172a; margin: 16px; }
    h1 { font-size: 18px; margin: 2px 0 6px; }
    h2 { font-size: 13px; margin: 14px 0 6px; border-bottom: 2px solid #3B82C4; padding-bottom: 4px; }
    h3 { font-size: 11px; margin: 10px 0 4px; background: #f1f5f9; padding: 4px 8px; border-left: 3px solid #3B82C4; }
    .sub-head { font-size: 10px; font-weight: bold; color: #334155; margin: 6px 0 2px 2px; text-transform: uppercase; letter-spacing: 0.3px; }
    .sub-head.special { color: #b91c1c; margin-top: 8px; }
    .brand { color: #3B82C4; font-weight: 800; font-size: 12px; letter-spacing: 0.5px; }
    table { width: 100%; table-layout: fixed; border-collapse: collapse; margin-top: 3px; margin-bottom: 6px; }
    th, td { border: 1px solid #cbd5e1; padding: 4px 6px; text-align: left; vertical-align: top; word-wrap: break-word; overflow-wrap: break-word; hyphens: auto; }
    th { background: #e2e8f0; font-weight: 700; color: #334155; font-size: 9.5px; }
    .r { text-align: right; }
    .b { font-weight: bold; }
    .c { text-align: center; }
    .badge { display: inline-block; background: #f1f5f9; border: 1px solid #cbd5e1; padding: 1px 4px; border-radius: 4px; font-weight: 600; font-size: 9px; }
    .meta { width: auto; margin: 8px 0; border: none; table-layout: auto; }
    .meta td { border: none; padding: 2px 10px 2px 0; font-size: 10.5px; }
    .room-block { page-break-inside: avoid; margin-bottom: 12px; }
    .sig { display: flex; gap: 80px; margin-top: 36px; page-break-inside: avoid; }
    .sig div { border-top: 1px solid #334155; width: 240px; padding-top: 4px; font-size: 10px; color: #475569; }
    @media print {
      body { margin: 0; }
      .pb { page-break-before: always; }
    }
  </style></head><body>
  <div class="brand">BURK Haustechnik</div>
  <h1>Aufmaß ${esc(aufmass.aufmassNumber)}</h1>
  <table class="meta">
    <tr><td>Projekt:</td><td><b>${esc(aufmass.projectName)}</b></td></tr>
    <tr><td>Verbaute Positionen:</td><td><b>${aufmass.summaryItems.length} Positionen</b> in ${aufmass.roomsData.length} bearbeiteten Räumen</td></tr>
    <tr><td>Stichtag der Abrechnung:</td><td><b>${d(aufmass.dateTo)}</b></td></tr>
    <tr><td>Delta-Zeitraum (seit vorigem Aufmaß):</td><td>${d(aufmass.dateFrom)} bis ${d(aufmass.dateTo)}</td></tr>
    <tr><td>Erstellt:</td><td>${new Date(aufmass.createdAt).toLocaleString('de-DE')} von ${esc(aufmass.createdBy)}</td></tr>
    <tr><td>Abrechnungsvolumen (Delta):</td><td><b>${eur(aufmass.totalPeriodVolume)}</b></td></tr>
  </table>
  ${aufmass.notes ? `<p style="margin: 6px 0; font-style: italic; color: #475569;">Bemerkung: ${esc(aufmass.notes)}</p>` : ''}
  
  <h2>Gesamtübersicht: ${aufmass.summaryItems.length} verbaute Positionen (Kumuliert)</h2>
  <table>
    <colgroup>
      <col style="width: 10%;">
      <col style="width: 32%;">
      <col style="width: 8%;">
      <col style="width: 11%;">
      <col style="width: 11%;">
      <col style="width: 7%;">
      <col style="width: 9%;">
      <col style="width: 12%;">
    </colgroup>
    <thead>
      <tr>
        <th>Pos</th>
        <th>Material / Leistung</th>
        <th class="r">Plan</th>
        <th class="r">Kumuliert bis Stichtag</th>
        <th class="r">Delta seit vorigem Aufmaß</th>
        <th class="c">Einheit</th>
        <th class="r">EP (€)</th>
        <th class="r">Betrag Delta (€)</th>
      </tr>
    </thead>
    <tbody>${summaryRows}</tbody>
  </table>

  <div class="pb"></div>
  <h2>Raumaufstellung (Aufgeschlüsselt nach Plan- und Sonderposten)</h2>
  ${roomBlocks}
  
  <div class="sig">
    <div>Datum / Auftragnehmer</div>
    <div>Datum / Auftraggeber</div>
  </div>
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
