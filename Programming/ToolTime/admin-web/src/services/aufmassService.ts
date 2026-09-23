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
      if (!snap.empty) {
        const list = snap.docs.map(d => ({ id: d.id, ...d.data() }) as AufmassDocument);
        saveLocalAufmasse(projectId, list);
        callback(list);
      } else {
        const local = getLocalAufmasse(projectId);
        callback(local);
      }
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
  const current = getLocalAufmasse(projectId);
  const updated = [aufmass, ...current.filter(a => a.id !== aufmass.id)];
  saveLocalAufmasse(projectId, updated);

  try {
    const ref = doc(db, 'projects', projectId, 'aufmasse', aufmass.id);
    await setDoc(ref, aufmass, { merge: true });
  } catch (err: any) {
    console.warn('Firestore saveAufmassDocument error:', err.message);
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
    console.warn('Firestore deleteAufmassDocument error:', err.message);
  }
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
  notes: string = ''
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

  // 1. Calculate Room Data
  const roomsData: AufmassRoomData[] = [];

  rooms.forEach(room => {
    const isUnlocked = room.isCompleted === false || room.status === 'in_progress';
    const isDone = !isUnlocked && (room.status === 'completed' || room.isCompleted === true || ((room as any).pct === 100));

    const roomPositions: AufmassRoomPosition[] = [];
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

      // Installed in room before dateFrom
      const bookingsBeforePeriod = bookingsUpToDate.filter(b => {
        const t = b.createdAt || b.timestamp;
        if (!t) return false;
        return new Date(t).getTime() < fromDateStartTimestamp;
      });
      const installedBeforePeriod = getMaterialActualQty(m, room, bookingsBeforePeriod);

      // Period Delta = what was installed within [dateFrom, dateTo]
      const installedInPeriod = Math.max(0, totalInstalledToDate - installedBeforePeriod);

      // Overconsumption check:
      // In this room, actual > planned
      const diff = totalInstalledToDate - planned;
      const isOverconsumption = diff > 0;
      const excessQty = isOverconsumption ? diff : 0;

      // Reason lookup
      const reasonKey = `${room.id}_${m.posNr}`;
      const reasonKeyName = `${room.id}_${(m.shortText || '').toLowerCase()}`;
      const reason = reasonMap.get(reasonKey) || reasonMap.get(reasonKeyName);

      roomPositions.push({
        positionId: m.positionId || pos?.id || `pos_${m.posNr}`,
        posNr: m.posNr || pos?.posNr || '–',
        shortText: m.shortText || pos?.shortText || 'Material',
        group: m.group || pos?.group || '',
        qu,
        unitPrice,
        plannedQty: planned,
        installedInPeriod,
        totalInstalledToDate,
        isOverconsumption,
        excessQty,
        reason,
        isExtraPosition: false,
      });
    });

    // B. Check for Extra Positions (Zusatzpositionen / außerplanmäßig verbaut)
    // 1. Extra Bookings in this room not part of planned materials
    bookingsInPeriod.forEach(b => {
      if (b.roomId === room.id) {
        const bPosId = b.positionId || (b as any).itemId;
        const bPosNr = b.positionNr || (b as any).itemOz;
        const isPlanned = (bPosId && plannedPosKeys.has(bPosId)) || (bPosNr && plannedPosKeys.has(bPosNr));

        if (!isPlanned && bPosNr !== 'FERTIG' && bPosNr !== 'DOKU') {
          // Check if already added
          const alreadyAdded = roomPositions.find(p => p.posNr === bPosNr || p.positionId === bPosId);
          if (!alreadyAdded) {
            const pos = (bPosId ? posMap.get(bPosId) : undefined) || (bPosNr ? posByNrMap.get(bPosNr) : undefined);
            roomPositions.push({
              positionId: bPosId || `extra_${b.id}`,
              posNr: bPosNr || pos?.posNr || 'Sonder',
              shortText: b.positionName || (b as any).itemText || pos?.shortText || 'Außerplanmäßiges Material',
              group: pos?.group || 'Sonderbedarf',
              qu: b.qu || pos?.qu || 'Stk',
              unitPrice: pos?.unitPrice || 0,
              plannedQty: 0,
              installedInPeriod: Number(b.quantity) || 0,
              totalInstalledToDate: Number(b.quantity) || 0,
              isOverconsumption: true,
              excessQty: Number(b.quantity) || 0,
              reason: b.note || 'Außerplanmäßige Monteurbuchung',
              isExtraPosition: true,
            });
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
          const alreadyAdded = roomPositions.find(p => p.shortText.toLowerCase() === a.title.toLowerCase());
          if (!alreadyAdded) {
            const rawQty = typeof a.quantity === 'number' ? a.quantity : parseFloat(String(a.quantity).replace(',', '.')) || 1;
            roomPositions.push({
              positionId: a.materialId || `addendum_${a.id}`,
              posNr: a.itemOz || 'Sonder-Mat',
              shortText: a.title,
              group: 'Sonderbedarf / Mehrbedarf',
              qu: a.qu || 'Stk',
              unitPrice: 0,
              plannedQty: 0,
              installedInPeriod: rawQty,
              totalInstalledToDate: rawQty,
              isOverconsumption: true,
              excessQty: rawQty,
              reason: a.note || (a.status === 'approved' ? 'Freigegebener Mehrbedarf' : 'Erfasster Mehrbedarf'),
              isExtraPosition: true,
            });
          }
        }
      }
    });

    // Sort room positions: Planned positions first, then extra positions at the end
    roomPositions.sort((a, b) => {
      if (a.isExtraPosition && !b.isExtraPosition) return 1;
      if (!a.isExtraPosition && b.isExtraPosition) return -1;
      return a.posNr.localeCompare(b.posNr, undefined, { numeric: true });
    });

    roomsData.push({
      roomId: room.id,
      roomName: room.name,
      roomCode: room.code || 'Raum',
      floor: room.floor,
      isCompleted: isDone,
      positions: roomPositions,
    });
  });

  // 2. Calculate Summary Items across the whole project
  // Aggregate all unique positions that have planned, period or total installed quantity
  const summaryMap = new Map<string, AufmassMaterialItem>();

  // A. Start with all LV positions
  positions.forEach(pos => {
    summaryMap.set(pos.posNr || pos.id, {
      positionId: pos.id,
      posNr: pos.posNr,
      shortText: pos.shortText,
      group: pos.group,
      qu: pos.qu,
      unitPrice: pos.unitPrice || 0,
      plannedQty: Number(pos.qty) || 0,
      totalInstalledUpToDate: 0,
      periodInstalledQty: 0,
      totalCost: 0,
    });
  });

  // B. Accumulate quantities from rooms
  roomsData.forEach(r => {
    r.positions.forEach(p => {
      const key = p.posNr || p.positionId;
      if (!summaryMap.has(key)) {
        summaryMap.set(key, {
          positionId: p.positionId,
          posNr: p.posNr,
          shortText: p.shortText,
          group: p.group,
          qu: p.qu,
          unitPrice: p.unitPrice,
          plannedQty: p.plannedQty,
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

  // Filter summary items: include all positions with plannedQty > 0 or periodInstalledQty > 0 or totalInstalledUpToDate > 0
  const summaryItems = Array.from(summaryMap.values())
    .filter(item => item.plannedQty > 0 || item.periodInstalledQty > 0 || item.totalInstalledUpToDate > 0)
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
