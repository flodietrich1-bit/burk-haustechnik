import { collection, doc, onSnapshot, setDoc, deleteDoc, query, orderBy } from 'firebase/firestore';
import { db } from '../firebase';
import type { 
  Project, 
  Position, 
  Room, 
  Booking, 
  Alert, 
  Addendum,
  AufmassDocument, 
  AufmassMaterialItem, 
  AufmassRoomData, 
  AufmassRoomPosition 
} from '../types';
import { getMaterialActualQty } from './firestoreService';

const LOCAL_STORAGE_AUFMASS_PREFIX = 'burk_tooltime_aufmasse_';

function getLocalAufmasse(projectId: string): AufmassDocument[] {
  if (typeof localStorage === 'undefined') return [];
  try {
    const raw = localStorage.getItem(LOCAL_STORAGE_AUFMASS_PREFIX + projectId);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return parsed;
    }
  } catch (e) {
    console.warn('LocalStorage error reading aufmasse:', e);
  }
  return [];
}

function saveLocalAufmasse(projectId: string, aufmasse: AufmassDocument[]) {
  if (typeof localStorage === 'undefined') return;
  try {
    localStorage.setItem(LOCAL_STORAGE_AUFMASS_PREFIX + projectId, JSON.stringify(aufmasse));
  } catch (e) {
    console.warn('LocalStorage error saving aufmasse:', e);
  }
}

/**
 * Real-time listener for Aufmaße of a project
 */
export function listenToAufmasse(projectId: string, callback: (aufmasse: AufmassDocument[]) => void) {
  if (!projectId) {
    callback([]);
    return () => {};
  }

  // Deliver cached instantly
  callback(getLocalAufmasse(projectId));

  try {
    const colRef = collection(db, 'projects', projectId, 'aufmasse');
    const q = query(colRef, orderBy('createdAt', 'desc'));

    const unsub = onSnapshot(q, (snap) => {
      const list = snap.docs.map(d => ({ id: d.id, ...d.data() }) as AufmassDocument);
      saveLocalAufmasse(projectId, list);
      callback(list);
    }, (err) => {
      console.warn('Firestore listenToAufmasse fallback to localStorage:', err.message);
      callback(getLocalAufmasse(projectId));
    });

    return unsub;
  } catch (e) {
    console.warn('listenToAufmasse init error:', e);
    return () => {};
  }
}

/**
 * Persists an immutable Aufmass snapshot document
 */
export async function saveAufmassDocument(projectId: string, aufmass: AufmassDocument): Promise<void> {
  // Strip any undefined fields before persisting to Firestore
  const cleaned: AufmassDocument = JSON.parse(JSON.stringify(aufmass));
  const current = getLocalAufmasse(projectId);
  const updated = [cleaned, ...current.filter(a => a.id !== cleaned.id)];
  saveLocalAufmasse(projectId, updated);

  try {
    const ref = doc(db, 'projects', projectId, 'aufmasse', cleaned.id);
    await setDoc(ref, cleaned);
  } catch (err: any) {
    console.error('Firestore saveAufmassDocument error:', err);
    throw err;
  }
}

/**
 * Deletes an Aufmass document
 */
export async function deleteAufmassDocument(projectId: string, aufmassId: string): Promise<void> {
  const current = getLocalAufmasse(projectId);
  const updated = current.filter(a => a.id !== aufmassId);
  saveLocalAufmasse(projectId, updated);

  try {
    const ref = doc(db, 'projects', projectId, 'aufmasse', aufmassId);
    await deleteDoc(ref);
  } catch (err: any) {
    console.error('Firestore deleteAufmassDocument error:', err);
    throw err;
  }
}

// Helper to determine cause and clean originator without personal names
export function determineCauseAndOriginator(
  rawReason?: string,
  _posNr?: string,
  _roomId?: string
): { reasonText: string; causedBy: string; causeType: string } {
  const r = (rawReason || '').trim();
  const lower = r.toLowerCase();

  let causedBy = 'Monteur';
  let causeType = 'sonstiges';
  let reasonText = r;

  if (lower.includes('kunde') || lower.includes('kundenwunsch') || lower.includes('bauherr') || lower.includes('sonderwunsch')) {
    causedBy = 'Kunde';
    causeType = 'kunde';
    if (!reasonText) reasonText = 'Änderungswunsch Kunde';
  } else if (lower.includes('architekt') || lower.includes('fachplaner') || lower.includes('statik') || lower.includes('planer')) {
    causedBy = 'Architekt';
    causeType = 'architekt';
    if (!reasonText) reasonText = 'Änderungswunsch Architekt';
  } else if (lower.includes('gaeb') || lower.includes('dwg') || lower.includes('planabweichung') || lower.includes('bauleiter') || lower.includes('bauleitung')) {
    causedBy = 'Bauleitung';
    causeType = 'bauleitung';
    if (!reasonText) reasonText = 'Planungsabweichung / GAEB vs. DWG';
  } else if (lower.includes('bruch') || lower.includes('beschädigt') || lower.includes('defekt') || lower.includes('kaputt')) {
    causedBy = 'Monteur';
    causeType = 'bruch';
    if (!reasonText) reasonText = 'Bruch bei Montage';
  } else if (lower.includes('verschnitt') || lower.includes('verschnitten')) {
    causedBy = 'Monteur';
    causeType = 'verschnitt';
    if (!reasonText) reasonText = 'Verschnitt';
  } else {
    causedBy = 'Monteur';
    if (!reasonText) reasonText = 'Mehrverbrauch / Baustellenanpassung';
  }

  // Clean out specific personal name patterns from reason text
  reasonText = reasonText
    .replace(/(?:Herr|Frau)\s+[A-ZÄÖÜ][a-zäöüß]+/g, '')
    .replace(/von\s+[A-ZÄÖÜ][a-zäöüß]+\s+[A-ZÄÖÜ][a-zäöüß]+/g, '')
    .trim();

  return { reasonText, causedBy, causeType };
}

/**
 * Calculate immutable snapshot for a given date interval [dateFrom, dateTo]
 */
export function calculateAufmassSnapshot(
  project: Project | null,
  positions: Position[],
  rooms: Room[],
  bookings: Booking[],
  alerts: Alert[],
  addendums: Addendum[],
  dateFrom: string, // YYYY-MM-DD
  dateTo: string,   // YYYY-MM-DD (Stichtag)
  creatorName: string = 'Florian Burk',
  notes: string = '',
  previousAufmass?: AufmassDocument | null
): AufmassDocument {
  const projectId = project?.id || 'default_project';
  const projectName = project?.name || 'Bauvorhaben';

  // Helper date parsing (end of dateTo day is inclusive)
  const toDateEndTimestamp = new Date(`${dateTo}T23:59:59.999Z`).getTime();
  const fromDateStartTimestamp = new Date(`${dateFrom}T00:00:00.000Z`).getTime();

  // Filter bookings in interval vs up to dateTo
  const bookingsUpToDate = bookings.filter(b => {
    const t = b.createdAt || b.timestamp;
    if (!t) return true; // without timestamp, treat as current
    const time = new Date(t).getTime();
    return time <= toDateEndTimestamp;
  });

  const bookingsInPeriod = bookings.filter(b => {
    const t = b.createdAt || b.timestamp;
    if (!t) return true;
    const time = new Date(t).getTime();
    return time >= fromDateStartTimestamp && time <= toDateEndTimestamp;
  });

  const posMap = new Map(positions.map(p => [p.id, p]));
  const posByNrMap = new Map(positions.map(p => [p.posNr, p]));

  // Lookup for alerts/reasons by roomId + posNr
  const reasonMap = new Map<string, string>();
  alerts.forEach(a => {
    if (a.reason && a.roomId) {
      const key = `${a.roomId}_${a.materialPos}`;
      reasonMap.set(key, a.reason);
      if (a.materialName) {
        reasonMap.set(`${a.roomId}_${a.materialName.toLowerCase()}`, a.reason);
      }
    }
  });

  // Also include booking notes as backup reasons
  bookingsInPeriod.forEach(b => {
    if (b.note && b.note.trim().length > 0 && b.roomId) {
      const key = `${b.roomId}_${b.positionNr || b.itemOz || b.positionId || ''}`;
      if (!reasonMap.has(key)) {
        reasonMap.set(key, b.note.trim());
      }
    }
  });

  // 1. Calculate Room Data (Only rooms with actual installed items)
  const roomsData: AufmassRoomData[] = [];

  rooms.forEach(room => {
    const isUnlocked = room.isCompleted === false || room.status === 'in_progress';
    const isDone = !isUnlocked && (room.status === 'completed' || room.isCompleted === true || ((room as any).pct === 100));

    const plannedPositions: AufmassRoomPosition[] = [];
    const specialPositions: AufmassRoomPosition[] = [];
    const plannedPosKeys = new Set<string>();

    // A. Regular planned materials in room
    (room.materials || []).forEach(m => {
      const pos = posMap.get(m.positionId) || posByNrMap.get(m.posNr);
      const planned = Number(m.plannedQty) || 0;
      const unitPrice = m.unitPrice || pos?.unitPrice || 0;
      const qu = m.qu || pos?.qu || 'Stk';

      plannedPosKeys.add(m.posNr);
      if (m.positionId) plannedPosKeys.add(m.positionId);

      // Total installed in room up to dateTo
      const totalInstalledToDate = getMaterialActualQty(m, room, bookingsUpToDate);

      // SKIP if nothing was ever installed for this material in this room
      if (totalInstalledToDate <= 0) {
        return;
      }

      // Quantity installed prior to this Aufmaß
      let installedBeforePeriod = 0;
      if (previousAufmass) {
        const prevRoom = previousAufmass.roomsData?.find(r => r.roomId === room.id);
        const prevPos = prevRoom?.positions?.find(p => p.posNr === m.posNr || p.positionId === (m.positionId || pos?.id));
        if (prevPos) {
          installedBeforePeriod = Number(prevPos.totalInstalledToDate) || 0;
        }
      } else {
        const bookingsBeforePeriod = bookingsUpToDate.filter(b => {
          const t = b.createdAt || b.timestamp;
          if (!t) return false;
          return new Date(t).getTime() < fromDateStartTimestamp;
        });
        installedBeforePeriod = getMaterialActualQty(m, room, bookingsBeforePeriod);
      }

      // Period Delta = what was installed within this Aufmaß period
      const installedInPeriod = Math.max(0, totalInstalledToDate - installedBeforePeriod);

      // Check for overconsumption
      if (totalInstalledToDate <= planned) {
        // Entirely planned installation
        plannedPositions.push({
          positionId: m.positionId || pos?.id || `pos_${m.posNr}`,
          posNr: m.posNr || pos?.posNr || '–',
          shortText: m.shortText || pos?.shortText || 'Material',
          group: m.group || pos?.group || '',
          qu,
          unitPrice,
          plannedQty: planned,
          installedInPeriod,
          totalInstalledToDate,
          isOverconsumption: false,
          excessQty: 0,
          isExtraPosition: false,
        });
      } else {
        // Overconsumption: Split into plan-adherent part and Sonderposten part
        const excessQty = totalInstalledToDate - planned;
        const plannedInPeriod = Math.min(installedInPeriod, planned);
        const excessInPeriod = Math.max(0, installedInPeriod - plannedInPeriod);

        // 1. Planned part
        plannedPositions.push({
          positionId: m.positionId || pos?.id || `pos_${m.posNr}`,
          posNr: m.posNr || pos?.posNr || '–',
          shortText: m.shortText || pos?.shortText || 'Material',
          group: m.group || pos?.group || '',
          qu,
          unitPrice,
          plannedQty: planned,
          installedInPeriod: plannedInPeriod,
          totalInstalledToDate: planned,
          isOverconsumption: false,
          excessQty: 0,
          isExtraPosition: false,
        });

        // 2. Sonderposten part (Mehrverbrauch)
        const reasonKey = `${room.id}_${m.posNr}`;
        const reasonKeyName = `${room.id}_${(m.shortText || '').toLowerCase()}`;
        const rawReason = reasonMap.get(reasonKey) || reasonMap.get(reasonKeyName) || 'Mehrverbrauch im Raum';
        const { reasonText, causedBy } = determineCauseAndOriginator(rawReason, m.posNr, room.id);

        specialPositions.push({
          positionId: `${m.positionId || pos?.id || m.posNr}_excess`,
          posNr: m.posNr || pos?.posNr || '–',
          shortText: m.shortText || pos?.shortText || 'Material',
          group: m.group || pos?.group || 'Mehrverbrauch',
          qu,
          unitPrice,
          plannedQty: 0,
          installedInPeriod: excessInPeriod,
          totalInstalledToDate: excessQty,
          isOverconsumption: true,
          excessQty,
          reason: reasonText,
          causedBy,
          isExtraPosition: true,
          specialType: 'mehrverbrauch',
        });
      }
    });

    // B. Extra Positions (Zusatzpositionen / außerplanmäßig verbaut)
    // 1. Extra Bookings in this room not part of planned materials
    bookingsInPeriod.forEach(b => {
      if (b.roomId === room.id) {
        const bPosId = b.positionId || (b as any).itemId;
        const bPosNr = b.positionNr || (b as any).itemOz;
        const isPlanned = (bPosId && plannedPosKeys.has(bPosId)) || (bPosNr && plannedPosKeys.has(bPosNr));

        if (!isPlanned && bPosNr !== 'FERTIG' && bPosNr !== 'DOKU') {
          const qty = Number(b.quantity) || 0;
          if (qty > 0) {
            const alreadyAdded = specialPositions.find(p => p.posNr === bPosNr || p.positionId === bPosId);
            if (!alreadyAdded) {
              const pos = (bPosId ? posMap.get(bPosId) : undefined) || (bPosNr ? posByNrMap.get(bPosNr) : undefined);
              const { reasonText, causedBy } = determineCauseAndOriginator(b.note || 'Außerplanmäßige Monteurbuchung', bPosNr, room.id);

              specialPositions.push({
                positionId: bPosId || `extra_${b.id}`,
                posNr: bPosNr || pos?.posNr || 'Sonder',
                shortText: b.positionName || (b as any).itemText || pos?.shortText || 'Außerplanmäßiges Material',
                group: pos?.group || 'Sonderbedarf',
                qu: b.qu || pos?.qu || 'Stk',
                unitPrice: pos?.unitPrice || 0,
                plannedQty: 0,
                installedInPeriod: qty,
                totalInstalledToDate: qty,
                isOverconsumption: true,
                excessQty: qty,
                reason: reasonText,
                causedBy,
                isExtraPosition: true,
                specialType: 'zusatzmaterial',
              });
            }
          }
        }
      }
    });

    // 2. Extra Addendums for this room (approved or pending)
    addendums.forEach(a => {
      if (a.roomId === room.id && a.type === 'material') {
        const aKey = a.itemOz || a.materialId;
        const isPlanned = aKey && plannedPosKeys.has(aKey);
        if (!isPlanned) {
          const rawQty = typeof a.quantity === 'number' ? a.quantity : parseFloat(String(a.quantity).replace(',', '.')) || 1;
          if (rawQty > 0) {
            const alreadyAdded = specialPositions.find(p => p.shortText.toLowerCase() === a.title.toLowerCase());
            if (!alreadyAdded) {
              const rawNote = a.note || (a.status === 'approved' ? 'Freigegebener Mehrbedarf' : 'Erfasster Mehrbedarf');
              const { reasonText, causedBy } = determineCauseAndOriginator(rawNote, a.itemOz, room.id);

              specialPositions.push({
                positionId: a.materialId || `addendum_${a.id}`,
                posNr: a.itemOz || 'Sonder-Mat',
                shortText: a.title,
                group: 'Sonderbedarf / Mehrbedarf',
                qu: a.qu || 'Stk',
                unitPrice: a.unitPrice || 0,
                plannedQty: 0,
                installedInPeriod: rawQty,
                totalInstalledToDate: rawQty,
                isOverconsumption: true,
                excessQty: rawQty,
                reason: reasonText,
                causedBy: a.createdByRole === 'bauleiter' ? 'Bauleitung' : causedBy,
                isExtraPosition: true,
                specialType: 'zusatzmaterial',
              });
            }
          }
        }
      }
    });

    // Sort
    plannedPositions.sort((a, b) => a.posNr.localeCompare(b.posNr, undefined, { numeric: true }));
    specialPositions.sort((a, b) => a.posNr.localeCompare(b.posNr, undefined, { numeric: true }));

    // Combined positions array (for backward compatibility)
    const combinedPositions = [...plannedPositions, ...specialPositions];

    // Calculate room progress percentage
    let roomPercent = isDone ? 100 : ((room as any).pct ?? room.progressPercent ?? 0);
    if (!isDone) {
      let totPlan = 0;
      let totInst = 0;
      (room.materials || []).forEach(m => {
        const pl = Number(m.plannedQty || 0);
        const act = getMaterialActualQty(m, room, bookingsUpToDate);
        if (pl > 0) {
          totPlan += pl;
          totInst += Math.min(pl, act);
        }
      });
      if (totPlan > 0) {
        roomPercent = Math.min(99, Math.round((totInst / totPlan) * 100));
      }
    }

    // Only include room if work has been performed (at least 1 position installed)
    if (combinedPositions.length > 0) {
      roomsData.push({
        roomId: room.id,
        roomName: room.name,
        roomCode: room.code || 'Raum',
        floor: room.floor,
        isCompleted: isDone,
        progressPercent: roomPercent,
        plannedPositions,
        specialPositions,
        positions: combinedPositions,
      });
    }
  });

  // 2. Calculate Summary Items across the whole project (ONLY INSTALLED MATERIALS)
  const summaryMap = new Map<string, AufmassMaterialItem>();

  roomsData.forEach(r => {
    r.positions.forEach(p => {
      const key = p.posNr || p.positionId;
      if (!summaryMap.has(key)) {
        // Find matching original position for overall planned quantity if available
        const pos = posByNrMap.get(p.posNr) || posMap.get(p.positionId);
        summaryMap.set(key, {
          positionId: p.positionId,
          posNr: p.posNr || '–',
          shortText: p.shortText || 'Material',
          group: p.group || '',
          qu: p.qu || 'Stk',
          unitPrice: p.unitPrice || 0,
          plannedQty: pos ? Number(pos.qty) || 0 : p.plannedQty || 0,
          totalInstalledUpToDate: 0,
          periodInstalledQty: 0,
          totalCost: 0,
        });
      }

      const item = summaryMap.get(key)!;
      item.totalInstalledUpToDate += p.totalInstalledToDate;
      item.periodInstalledQty += p.installedInPeriod;
      item.totalCost = Math.round(item.periodInstalledQty * item.unitPrice * 100) / 100;
    });
  });

  // Summary items: ONLY positions with actual installation (> 0)
  const summaryItems = Array.from(summaryMap.values())
    .filter(item => item.totalInstalledUpToDate > 0 || item.periodInstalledQty > 0)
    .sort((a, b) => a.posNr.localeCompare(b.posNr, undefined, { numeric: true }));

  const totalPeriodVolume = summaryItems.reduce((acc, item) => acc + item.totalCost, 0);

  // Generate unique Aufmass Number
  const dateStr = dateTo.replace(/-/g, '');
  const aufmassId = `aufmass_${dateStr}_${Date.now()}`;
  const aufmassNumber = `AUF-${new Date(dateTo).getFullYear()}-${String(Math.floor(Math.random() * 900) + 100)}`;

  return {
    id: aufmassId,
    projectId,
    projectName,
    aufmassNumber,
    dateFrom,
    dateTo,
    createdAt: new Date().toISOString(),
    createdBy: creatorName,
    notes,
    totalItemsCount: summaryItems.length,
    totalPeriodVolume: Math.round(totalPeriodVolume * 100) / 100,
    summaryItems,
    roomsData,
  };
}

/**
 * Update reason and originator for a position in an existing Aufmass document (e.g. translate from Polish to German)
 */
export async function updateAufmassPositionReason(
  projectId: string,
  aufmassId: string,
  roomId: string,
  positionId: string,
  newReason: string,
  newCausedBy?: string
): Promise<AufmassDocument | null> {
  const localList = getLocalAufmasse(projectId);
  const target = localList.find(a => a.id === aufmassId);
  if (!target) return null;

  // Clone document
  const updated: AufmassDocument = JSON.parse(JSON.stringify(target));
  const room = updated.roomsData.find(r => r.roomId === roomId);
  if (room) {
    const updatePos = (pos: AufmassRoomPosition) => {
      pos.reason = newReason;
      if (newCausedBy) pos.causedBy = newCausedBy;
    };

    // Update in positions
    const pos = room.positions.find(p => p.positionId === positionId || p.posNr === positionId);
    if (pos) updatePos(pos);

    // Update in specialPositions
    if (room.specialPositions) {
      const sPos = room.specialPositions.find(p => p.positionId === positionId || p.posNr === positionId);
      if (sPos) updatePos(sPos);
    }

    // Update in plannedPositions
    if (room.plannedPositions) {
      const pPos = room.plannedPositions.find(p => p.positionId === positionId || p.posNr === positionId);
      if (pPos) updatePos(pPos);
    }
  }

  await saveAufmassDocument(projectId, updated);
  return updated;
}

/**
 * Resolves the completion percentage for a room in an Aufmaß snapshot.
 * Uses persistent progressPercent if available, or derives it from planned vs installed.
 */
export function getAufmassRoomPercent(r: AufmassRoomData): number {
  if (r.progressPercent !== undefined && r.progressPercent !== null) {
    return Math.round(r.progressPercent);
  }
  if (r.isCompleted) return 100;
  const planned = r.plannedPositions || r.positions?.filter(p => !p.isExtraPosition) || [];
  let totPlan = 0;
  let totInst = 0;
  planned.forEach(p => {
    const pl = Number(p.plannedQty || 0);
    const inst = Number(p.totalInstalledToDate || 0);
    if (pl > 0) {
      totPlan += pl;
      totInst += Math.min(pl, inst);
    }
  });
  if (totPlan > 0) {
    return Math.min(99, Math.round((totInst / totPlan) * 100));
  }
  return 0;
}
