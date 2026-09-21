import { 
  collection, doc, onSnapshot, setDoc, updateDoc, deleteDoc
} from 'firebase/firestore';
import { db } from '../firebase';
import type { Project, Position, Room, Booking, Addendum, Alert, User } from '../types';

export const DEFAULT_PROJECT_ID = '';

// Initial projects: start completely empty for clean onboarding
export const INITIAL_PROJECTS: Project[] = [];

// Local storage key for persistent projects in offline / local fallback mode
const LOCAL_STORAGE_PROJECTS_KEY = 'burk_tooltime_projects_v2';
const LOCAL_STORAGE_POSITIONS_PREFIX = 'burk_tooltime_positions_';
const LOCAL_STORAGE_ROOMS_PREFIX = 'burk_tooltime_rooms_';
const LOCAL_STORAGE_ALERTS_PREFIX = 'burk_tooltime_alerts_';

// Cleanup old v1 demo mock data from localStorage if present
try {
  if (typeof window !== 'undefined') {
    localStorage.removeItem('burk_tooltime_projects');
  }
} catch {
  // ignore
}

function getLocalProjects(): Project[] {
  try {
    const raw = localStorage.getItem(LOCAL_STORAGE_PROJECTS_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return parsed;
    }
  } catch (e) {
    console.warn('LocalStorage error reading projects:', e);
  }
  return INITIAL_PROJECTS;
}

function saveLocalProjects(projects: Project[]) {
  try {
    localStorage.setItem(LOCAL_STORAGE_PROJECTS_KEY, JSON.stringify(projects));
  } catch (e) {
    console.warn('LocalStorage error saving projects:', e);
  }
}

// Fallback positions for Weingarten
export const MOCK_POSITIONS: Position[] = [
  { id: 'pos_01_01', posNr: '01.01', group: 'Abflussleitungen und Isolierung', shortText: 'Schmutzwasserleitung DN 125 hochschalldämmend', qty: 6, qu: 'm', deliveredQty: 4, unitPrice: 42.50, isCutMaterial: true, status: 'partial' },
  { id: 'pos_01_02', posNr: '01.02', group: 'Abflussleitungen und Isolierung', shortText: 'Kunststoffrohr DN 100', qty: 71, qu: 'm', deliveredQty: 71, unitPrice: 28.00, isCutMaterial: true, status: 'completed' },
  { id: 'pos_01_03', posNr: '01.03', group: 'Abflussleitungen und Isolierung', shortText: 'Kunststoffrohr DN 70', qty: 12, qu: 'm', deliveredQty: 10, unitPrice: 22.40, isCutMaterial: true, status: 'partial' },
  { id: 'pos_01_04', posNr: '01.04', group: 'Abflussleitungen und Isolierung', shortText: 'Kunststoffrohr DN 50', qty: 10, qu: 'm', deliveredQty: 0, unitPrice: 18.90, isCutMaterial: true, status: 'open' },
  { id: 'pos_01_05', posNr: '01.05', group: 'Abflussleitungen und Isolierung', shortText: 'Bogen DN 50, 15° - 87°', qty: 40, qu: 'Stk', deliveredQty: 25, unitPrice: 8.50, isCutMaterial: false, status: 'partial' },
  { id: 'pos_01_18', posNr: '01.18', group: 'Abflussleitungen und Isolierung', shortText: 'Brandschutzmanschette DN 100', qty: 8, qu: 'Stk', deliveredQty: 8, unitPrice: 89.00, isCutMaterial: false, status: 'completed' },
  { id: 'pos_01_36', posNr: '01.36', group: 'Grauwasser Hebeanlage', shortText: 'Schmutzwassersammelbehälter 270L Doppelhebeanlage', qty: 1, qu: 'Stk', deliveredQty: 1, unitPrice: 3450.00, isCutMaterial: false, status: 'completed' },
  { id: 'pos_01_37', posNr: '01.37', group: 'Grauwasser Hebeanlage', shortText: 'Vertikale 1-stufige Schmutzwasserpumpe IP68', qty: 2, qu: 'Stk', deliveredQty: 1, unitPrice: 1280.00, isCutMaterial: false, status: 'partial' }
];

export const MOCK_ROOMS: Room[] = [
  { 
    id: 'room_101', 
    name: 'Umkleide Herren', 
    code: 'EG-101', 
    floor: 'EG', 
    source: 'dwg',
    status: 'in_progress',
    progressPercent: 60,
    translations: { ro: 'Vestiar Bărbați', pl: 'Szatnia Męska', hr: 'Muška Svlačionica' },
    materials: [
      { positionId: 'pos_01_03', posNr: '01.03', shortText: 'Kunststoffrohr DN 70', plannedQty: 6, actualQty: 5, unitPrice: 22.40, qu: 'm', group: 'Abflussleitungen' },
      { positionId: 'pos_01_05', posNr: '01.05', shortText: 'Bogen DN 50, 15° - 87°', plannedQty: 8, actualQty: 8, unitPrice: 8.50, qu: 'Stk', group: 'Abflussleitungen' }
    ]
  },
  { 
    id: 'room_102', 
    name: 'Umkleide Damen', 
    code: 'EG-102', 
    floor: 'EG', 
    source: 'dwg',
    status: 'planned',
    progressPercent: 20,
    translations: { ro: 'Vestiar Femei', pl: 'Szatnia Damska', hr: 'Ženska Svlačionica' },
    materials: [
      { positionId: 'pos_01_03', posNr: '01.03', shortText: 'Kunststoffrohr DN 70', plannedQty: 6, actualQty: 0, unitPrice: 22.40, qu: 'm', group: 'Abflussleitungen' },
      { positionId: 'pos_01_05', posNr: '01.05', shortText: 'Bogen DN 50, 15° - 87°', plannedQty: 8, actualQty: 0, unitPrice: 8.50, qu: 'Stk', group: 'Abflussleitungen' }
    ]
  },
  { 
    id: 'room_103', 
    name: 'Duschen Herren', 
    code: 'EG-103', 
    floor: 'EG', 
    source: 'dwg',
    status: 'completed',
    progressPercent: 100,
    completedAt: '2026-09-19T14:30:00.000Z',
    completedBy: 'Ion Popescu (Monteur)',
    translations: { ro: 'Dușuri Bărbați', pl: 'Prysznice Męskie', hr: 'Muški Tuševi' },
    materials: [
      { positionId: 'pos_01_02', posNr: '01.02', shortText: 'Kunststoffrohr DN 100', plannedQty: 25, actualQty: 20, unitPrice: 28.00, qu: 'm', group: 'Abflussleitungen' },
      { positionId: 'pos_01_05', posNr: '01.05', shortText: 'Bogen DN 50, 15° - 87°', plannedQty: 12, actualQty: 15, unitPrice: 8.50, qu: 'Stk', group: 'Abflussleitungen' },
      { positionId: 'pos_01_18', posNr: '01.18', shortText: 'Brandschutzmanschette DN 100', plannedQty: 4, actualQty: 4, unitPrice: 89.00, qu: 'Stk', group: 'Abflussleitungen' }
    ]
  },
  { 
    id: 'room_104', 
    name: 'Duschen Damen', 
    code: 'EG-104', 
    floor: 'EG', 
    source: 'dwg',
    status: 'in_progress',
    progressPercent: 75,
    translations: { ro: 'Dușuri Femei', pl: 'Prysznice Damskie', hr: 'Ženske Tuševi' },
    materials: [
      { positionId: 'pos_01_02', posNr: '01.02', shortText: 'Kunststoffrohr DN 100', plannedQty: 20, actualQty: 24, unitPrice: 28.00, qu: 'm', group: 'Abflussleitungen' },
      { positionId: 'pos_01_05', posNr: '01.05', shortText: 'Bogen DN 50, 15° - 87°', plannedQty: 10, actualQty: 9, unitPrice: 8.50, qu: 'Stk', group: 'Abflussleitungen' },
      { positionId: 'pos_01_18', posNr: '01.18', shortText: 'Brandschutzmanschette DN 100', plannedQty: 4, actualQty: 4, unitPrice: 89.00, qu: 'Stk', group: 'Abflussleitungen' }
    ]
  },
  { 
    id: 'room_201', 
    name: 'Technikraum OG', 
    code: 'OG-201', 
    floor: 'OG', 
    source: 'dwg',
    status: 'completed',
    progressPercent: 100,
    completedAt: '2026-09-18T11:00:00.000Z',
    completedBy: 'Piotr Kowalski (Monteur)',
    translations: { ro: 'Cameră Tehnică', pl: 'Maszynownia', hr: 'Tehnička Soba' },
    materials: [
      { positionId: 'pos_01_01', posNr: '01.01', shortText: 'Schmutzwasserleitung DN 125 hochschalldämmend', plannedQty: 3, actualQty: 3, unitPrice: 42.50, qu: 'm', group: 'Abflussleitungen' }
    ]
  },
  { 
    id: 'room_001', 
    name: 'Keller / Hebeanlage', 
    code: 'UG-001', 
    floor: 'UG', 
    source: 'dwg',
    status: 'in_progress',
    progressPercent: 50,
    translations: { ro: 'Subsol / Pompare', pl: 'Piwnica / Pompownia', hr: 'Podrum / Crpna Stanica' },
    materials: [
      { positionId: 'pos_01_36', posNr: '01.36', shortText: 'Schmutzwassersammelbehälter 270L Doppelhebeanlage', plannedQty: 1, actualQty: 1, unitPrice: 3450.00, qu: 'Stk', group: 'Grauwasser Hebeanlage' },
      { positionId: 'pos_01_37', posNr: '01.37', shortText: 'Vertikale 1-stufige Schmutzwasserpumpe IP68', plannedQty: 2, actualQty: 4, unitPrice: 1280.00, qu: 'Stk', group: 'Grauwasser Hebeanlage' }
    ]
  }
];

export const MOCK_ALERTS: Alert[] = [
  {
    id: 'alert_1',
    projectId: DEFAULT_PROJECT_ID,
    roomId: 'room_001',
    roomName: 'Keller / Hebeanlage',
    materialId: 'pos_01_37',
    materialPos: '01.37',
    materialName: 'Vertikale 1-stufige Schmutzwasserpumpe IP68',
    plannedQty: 2,
    requestedTotal: 4,
    exceededBy: 2,
    qu: 'Stk',
    reason: 'Zweiter Pumpensumpf wegen Grundwassereintritt im Bestandsfundament erforderlich',
    monteurName: 'Piotr Kowalski',
    status: 'open',
    needsReorder: true,
    createdAt: new Date(Date.now() - 3600000 * 2.5).toISOString()
  },
  {
    id: 'alert_2',
    projectId: DEFAULT_PROJECT_ID,
    roomId: 'room_103',
    roomName: 'Duschen Herren',
    materialId: 'pos_01_05',
    materialPos: '01.05',
    materialName: 'Bogen DN 50, 15° - 87°',
    plannedQty: 12,
    requestedTotal: 15,
    exceededBy: 3,
    qu: 'Stk',
    reason: 'Trassenversprung wegen Betonträger im Deckenanschluss',
    monteurName: 'Ion Popescu',
    status: 'open',
    needsReorder: true,
    createdAt: new Date(Date.now() - 3600000 * 6).toISOString()
  },
  {
    id: 'alert_3',
    projectId: DEFAULT_PROJECT_ID,
    roomId: 'room_104',
    roomName: 'Duschen Damen',
    materialId: 'pos_01_02',
    materialPos: '01.02',
    materialName: 'Kunststoffrohr DN 100',
    plannedQty: 20,
    requestedTotal: 24,
    exceededBy: 4,
    qu: 'm',
    reason: 'Zusätzliche Umgehungsleitung wegen bestehender Elektrotraße',
    monteurName: 'Ion Popescu',
    status: 'reordered',
    needsReorder: false,
    createdAt: new Date(Date.now() - 3600000 * 28).toISOString(),
    actionNote: 'Bestellposition bei GC-Gruppe ausgelöst (Auftrag #88392)'
  }
];

export const MOCK_BOOKINGS: Booking[] = [
  {
    id: 'book_1',
    projectId: DEFAULT_PROJECT_ID,
    roomId: 'room_103',
    positionId: 'pos_01_02',
    positionNr: '01.02',
    positionName: 'Kunststoffrohr DN 100',
    quantity: 25,
    qu: 'm',
    note: 'Hauptstrang im Duschbereich verlegt.',
    createdBy: 'Ion Popescu (Monteur)',
    createdAt: new Date(Date.now() - 3600000 * 24 * 2).toISOString(),
    calendarWeek: 37
  },
  {
    id: 'book_2',
    projectId: DEFAULT_PROJECT_ID,
    roomId: 'room_201',
    positionId: 'pos_01_36',
    positionNr: '01.36',
    positionName: 'Schmutzwassersammelbehälter 270L Doppelhebeanlage',
    quantity: 1,
    qu: 'Stk',
    note: 'Behälter im Technikraum platziert und ausgerichtet.',
    createdBy: 'Piotr Kowalski (Monteur)',
    createdAt: new Date(Date.now() - 3600000 * 12).toISOString(),
    calendarWeek: 37
  }
];

export const MOCK_ADDENDUMS: Addendum[] = [
  {
    id: 'add_1',
    projectId: DEFAULT_PROJECT_ID,
    roomId: 'room_101',
    roomName: 'Umkleide Herren',
    title: 'Zusätzlicher HT-Bogen DN 100 45°',
    description: 'Aufgrund geänderter Wandschlitzführung im Altbestand wird 1x Bogen benötigt.',
    quantity: 1,
    qu: 'Stk',
    requestedBy: 'Ion Popescu',
    status: 'pending',
    createdAt: new Date(Date.now() - 3600000 * 5).toISOString()
  }
];

// Real-time Firestore Listeners with Fallback

// 1. Listen to all projects
export function listenToProjects(callback: (projects: Project[]) => void) {
  const colRef = collection(db, 'projects');
  return onSnapshot(colRef, (snap) => {
    if (!snap.empty) {
      const list = snap.docs.map(d => ({ id: d.id, ...d.data() }) as Project);
      saveLocalProjects(list);
      callback(list);
    } else {
      callback(getLocalProjects());
    }
  }, (err) => {
    console.warn('Firestore fallback mode for projects:', err.message);
    callback(getLocalProjects());
  });
}

// 2. Listen to single project
export function listenToProject(projectId: string, callback: (project: Project | null) => void) {
  if (!projectId) {
    callback(null);
    return () => {};
  }
  const ref = doc(db, 'projects', projectId);
  return onSnapshot(ref, (snap) => {
    if (snap.exists()) {
      callback(snap.data() as Project);
    } else {
      const local = getLocalProjects().find(p => p.id === projectId);
      callback(local || null);
    }
  }, (err) => {
    console.warn('Firestore fallback mode for project:', err.message);
    const local = getLocalProjects().find(p => p.id === projectId);
    callback(local || null);
  });
}

// 3. Listen to positions of project
export function listenToPositions(projectId: string, callback: (positions: Position[]) => void) {
  if (!projectId) {
    callback([]);
    return () => {};
  }
  const colRef = collection(db, 'projects', projectId, 'positions');
  return onSnapshot(colRef, (snap) => {
    if (!snap.empty) {
      const list = snap.docs.map(d => ({ id: d.id, ...d.data() }) as Position);
      localStorage.setItem(LOCAL_STORAGE_POSITIONS_PREFIX + projectId, JSON.stringify(list));
      callback(list);
    } else {
      // Check local storage for this project
      const saved = localStorage.getItem(LOCAL_STORAGE_POSITIONS_PREFIX + projectId);
      if (saved) {
        callback(JSON.parse(saved));
      } else {
        callback([]);
      }
    }
  }, (err) => {
    console.warn('Firestore fallback mode for positions:', err.message);
    const saved = localStorage.getItem(LOCAL_STORAGE_POSITIONS_PREFIX + projectId);
    if (saved) {
      callback(JSON.parse(saved));
    } else {
      callback([]);
    }
  });
}

// 4. Listen to rooms of project
export function listenToRooms(projectId: string, callback: (rooms: Room[]) => void) {
  if (!projectId) {
    callback([]);
    return () => {};
  }
  const colRef = collection(db, 'projects', projectId, 'rooms');
  return onSnapshot(colRef, (snap) => {
    if (!snap.empty) {
      const list = snap.docs.map(d => ({ id: d.id, ...d.data() }) as Room);
      localStorage.setItem(LOCAL_STORAGE_ROOMS_PREFIX + projectId, JSON.stringify(list));
      callback(list);
    } else {
      const saved = localStorage.getItem(LOCAL_STORAGE_ROOMS_PREFIX + projectId);
      if (saved) {
        callback(JSON.parse(saved));
      } else {
        callback([]);
      }
    }
  }, (err) => {
    console.warn('Firestore fallback mode for rooms:', err.message);
    const saved = localStorage.getItem(LOCAL_STORAGE_ROOMS_PREFIX + projectId);
    if (saved) {
      callback(JSON.parse(saved));
    } else {
      callback([]);
    }
  });
}

export function listenToBookings(projectId: string, callback: (bookings: Booking[]) => void) {
  if (!projectId) {
    callback([]);
    return () => {};
  }
  const colRef = collection(db, 'bookings');
  return onSnapshot(colRef, (snap) => {
    if (!snap.empty) {
      const list = snap.docs
        .map(d => ({ id: d.id, ...d.data() }) as Booking)
        .filter(b => b.projectId === projectId);
      callback(list);
    } else {
      callback([]);
    }
  }, (err) => {
    console.warn('Firestore fallback mode for bookings:', err.message);
    callback([]);
  });
}

export function listenToAddendums(projectId: string, callback: (addendums: Addendum[]) => void) {
  if (!projectId) {
    callback([]);
    return () => {};
  }
  const colRef = collection(db, 'addendums');
  return onSnapshot(colRef, (snap) => {
    if (!snap.empty) {
      const list = snap.docs
        .map(d => ({ id: d.id, ...d.data() }) as Addendum)
        .filter(a => a.projectId === projectId);
      callback(list);
    } else {
      callback([]);
    }
  }, (err) => {
    console.warn('Firestore fallback mode for addendums:', err.message);
    callback([]);
  });
}

// Delete a single project and clean all associated local data & collections
export async function deleteProject(projectId: string): Promise<void> {
  const current = getLocalProjects().filter(p => p.id !== projectId);
  saveLocalProjects(current);
  localStorage.removeItem(LOCAL_STORAGE_POSITIONS_PREFIX + projectId);
  localStorage.removeItem(LOCAL_STORAGE_ROOMS_PREFIX + projectId);
  localStorage.removeItem(LOCAL_STORAGE_ALERTS_PREFIX + projectId);

  try {
    const ref = doc(db, 'projects', projectId);
    await deleteDoc(ref);
  } catch (err: any) {
    console.warn('Firestore deleteProject error:', err.message);
  }
}

// Clear all projects completely
export async function clearAllProjects(): Promise<void> {
  const current = getLocalProjects();
  saveLocalProjects([]);
  for (const p of current) {
    localStorage.removeItem(LOCAL_STORAGE_POSITIONS_PREFIX + p.id);
    localStorage.removeItem(LOCAL_STORAGE_ROOMS_PREFIX + p.id);
    localStorage.removeItem(LOCAL_STORAGE_ALERTS_PREFIX + p.id);
    try {
      await deleteDoc(doc(db, 'projects', p.id));
    } catch {
      // ignore
    }
  }
}

// Mutators & Project Creation
export async function createProject(
  project: Project,
  positions: Partial<Position>[] = [],
  rooms: Room[] = []
): Promise<void> {
  // Update local list first
  const existing = getLocalProjects().filter(p => p.id !== project.id);
  const updatedProjects = [project, ...existing];
  saveLocalProjects(updatedProjects);

  // Save positions and rooms locally
  if (positions.length > 0) {
    localStorage.setItem(LOCAL_STORAGE_POSITIONS_PREFIX + project.id, JSON.stringify(positions));
  }
  if (rooms.length > 0) {
    localStorage.setItem(LOCAL_STORAGE_ROOMS_PREFIX + project.id, JSON.stringify(rooms));
  }

  // Attempt Firestore sync
  try {
    const projectRef = doc(db, 'projects', project.id);
    await setDoc(projectRef, project, { merge: true });

    for (const pos of positions) {
      if (!pos.id) continue;
      const pRef = doc(db, 'projects', project.id, 'positions', pos.id);
      await setDoc(pRef, pos, { merge: true });
    }

    for (const r of rooms) {
      const rRef = doc(db, 'projects', project.id, 'rooms', r.id);
      await setDoc(rRef, r, { merge: true });
    }
  } catch (err: any) {
    console.warn('Firestore project write failed, preserved in local storage:', err.message);
  }
}

export async function savePositionsBatch(projectId: string, positions: Partial<Position>[]) {
  // Save local
  const currentSaved = localStorage.getItem(LOCAL_STORAGE_POSITIONS_PREFIX + projectId);
  const currentList: Partial<Position>[] = currentSaved ? JSON.parse(currentSaved) : [];
  const mergedMap = new Map<string, Partial<Position>>();
  currentList.forEach(p => p.id && mergedMap.set(p.id, p));
  positions.forEach(p => p.id && mergedMap.set(p.id, p));
  const mergedList = Array.from(mergedMap.values());
  localStorage.setItem(LOCAL_STORAGE_POSITIONS_PREFIX + projectId, JSON.stringify(mergedList));

  // Also update project totalPositions
  const projects = getLocalProjects().map(p => {
    if (p.id === projectId) {
      return { ...p, totalPositions: mergedList.length };
    }
    return p;
  });
  saveLocalProjects(projects);

  try {
    for (const pos of positions) {
      if (!pos.id) continue;
      const ref = doc(db, 'projects', projectId, 'positions', pos.id);
      await setDoc(ref, pos, { merge: true });
    }
    await updateDoc(doc(db, 'projects', projectId), { totalPositions: mergedList.length });
  } catch (err: any) {
    console.warn('Firestore savePositionsBatch error:', err.message);
  }
}

export async function saveRoom(projectId: string, room: Room) {
  const currentSaved = localStorage.getItem(LOCAL_STORAGE_ROOMS_PREFIX + projectId);
  const currentList: Room[] = currentSaved ? JSON.parse(currentSaved) : [];
  const updated = [room, ...currentList.filter(r => r.id !== room.id)];
  localStorage.setItem(LOCAL_STORAGE_ROOMS_PREFIX + projectId, JSON.stringify(updated));

  try {
    const ref = doc(db, 'projects', projectId, 'rooms', room.id);
    await setDoc(ref, room, { merge: true });
  } catch (err: any) {
    console.warn('Firestore saveRoom error:', err.message);
  }
}

export async function deleteRoom(projectId: string, roomId: string) {
  const currentSaved = localStorage.getItem(LOCAL_STORAGE_ROOMS_PREFIX + projectId);
  if (currentSaved) {
    const currentList: Room[] = JSON.parse(currentSaved);
    localStorage.setItem(LOCAL_STORAGE_ROOMS_PREFIX + projectId, JSON.stringify(currentList.filter(r => r.id !== roomId)));
  }

  try {
    const ref = doc(db, 'projects', projectId, 'rooms', roomId);
    await deleteDoc(ref);
  } catch (err: any) {
    console.warn('Firestore deleteRoom error:', err.message);
  }
}

export async function updateAddendumStatus(addendumId: string, status: 'approved' | 'rejected') {
  try {
    const ref = doc(db, 'addendums', addendumId);
    await updateDoc(ref, { status });
  } catch (err: any) {
    console.warn('Firestore updateAddendumStatus error:', err.message);
  }
}

// 5. Listen to alerts of project
export function listenToAlerts(projectId: string, callback: (alerts: Alert[]) => void) {
  if (!projectId) {
    callback([]);
    return () => {};
  }
  const colRef = collection(db, 'projects', projectId, 'alerts');
  return onSnapshot(colRef, (snap) => {
    if (!snap.empty) {
      const list = snap.docs.map(d => ({ id: d.id, ...d.data() }) as Alert);
      localStorage.setItem(LOCAL_STORAGE_ALERTS_PREFIX + projectId, JSON.stringify(list));
      callback(list);
    } else {
      const saved = localStorage.getItem(LOCAL_STORAGE_ALERTS_PREFIX + projectId);
      if (saved) {
        callback(JSON.parse(saved));
      } else {
        callback([]);
      }
    }
  }, (err) => {
    console.warn('Firestore fallback mode for alerts:', err.message);
    const saved = localStorage.getItem(LOCAL_STORAGE_ALERTS_PREFIX + projectId);
    if (saved) {
      callback(JSON.parse(saved));
    } else {
      callback([]);
    }
  });
}

export async function updateAlertStatus(
  projectId: string,
  alertId: string,
  status: 'open' | 'reordered' | 'billed' | 'acknowledged',
  actionNote?: string
) {
  const saved = localStorage.getItem(LOCAL_STORAGE_ALERTS_PREFIX + projectId);
  const currentList: Alert[] = saved ? JSON.parse(saved) : (projectId === DEFAULT_PROJECT_ID ? MOCK_ALERTS : []);
  const updated = currentList.map(a => {
    if (a.id === alertId) {
      return {
        ...a,
        status,
        actionNote: actionNote || a.actionNote,
        updatedAt: new Date().toISOString()
      };
    }
    return a;
  });
  localStorage.setItem(LOCAL_STORAGE_ALERTS_PREFIX + projectId, JSON.stringify(updated));

  try {
    const ref = doc(db, 'projects', projectId, 'alerts', alertId);
    await updateDoc(ref, {
      status,
      actionNote: actionNote || null,
      updatedAt: new Date().toISOString()
    });
  } catch (err: any) {
    console.warn('Firestore updateAlertStatus error:', err.message);
  }
}

export async function createAlert(projectId: string, alert: Alert) {
  const saved = localStorage.getItem(LOCAL_STORAGE_ALERTS_PREFIX + projectId);
  const currentList: Alert[] = saved ? JSON.parse(saved) : (projectId === DEFAULT_PROJECT_ID ? MOCK_ALERTS : []);
  const updated = [alert, ...currentList.filter(a => a.id !== alert.id)];
  localStorage.setItem(LOCAL_STORAGE_ALERTS_PREFIX + projectId, JSON.stringify(updated));

  try {
    const ref = doc(db, 'projects', projectId, 'alerts', alert.id);
    await setDoc(ref, alert, { merge: true });
  } catch (err: any) {
    console.warn('Firestore createAlert error:', err.message);
  }
}

export async function completeRoom(
  projectId: string,
  roomId: string,
  isCompleted: boolean = true,
  completedBy: string = 'Florian Buck (Bauleiter)'
) {
  const saved = localStorage.getItem(LOCAL_STORAGE_ROOMS_PREFIX + projectId);
  const currentList: Room[] = saved ? JSON.parse(saved) : (projectId === DEFAULT_PROJECT_ID ? MOCK_ROOMS : []);
  const updated = currentList.map(r => {
    if (r.id === roomId) {
      return {
        ...r,
        status: (isCompleted ? 'completed' : 'in_progress') as 'completed' | 'in_progress',
        progressPercent: isCompleted ? 100 : Math.max(25, (r.progressPercent || 50) - 20),
        completedAt: isCompleted ? new Date().toISOString() : undefined,
        completedBy: isCompleted ? completedBy : undefined
      };
    }
    return r;
  });
  localStorage.setItem(LOCAL_STORAGE_ROOMS_PREFIX + projectId, JSON.stringify(updated));

  try {
    const ref = doc(db, 'projects', projectId, 'rooms', roomId);
    await updateDoc(ref, {
      status: isCompleted ? 'completed' : 'in_progress',
      progressPercent: isCompleted ? 100 : 50,
      completedAt: isCompleted ? new Date().toISOString() : null,
      completedBy: isCompleted ? completedBy : null
    });
  } catch (err: any) {
    console.warn('Firestore completeRoom error:', err.message);
  }
}

export async function updateRoomMaterialActual(
  projectId: string,
  roomId: string,
  positionId: string,
  actualQty: number
) {
  const saved = localStorage.getItem(LOCAL_STORAGE_ROOMS_PREFIX + projectId);
  const currentList: Room[] = saved ? JSON.parse(saved) : (projectId === DEFAULT_PROJECT_ID ? MOCK_ROOMS : []);
  const updated = currentList.map(r => {
    if (r.id === roomId) {
      const mats = (r.materials || []).map(m => {
        if (m.positionId === positionId) {
          return { ...m, actualQty };
        }
        return m;
      });
      return { ...r, materials: mats };
    }
    return r;
  });
  localStorage.setItem(LOCAL_STORAGE_ROOMS_PREFIX + projectId, JSON.stringify(updated));

  try {
    const targetRoom = updated.find(r => r.id === roomId);
    if (targetRoom) {
      const ref = doc(db, 'projects', projectId, 'rooms', roomId);
      await updateDoc(ref, { materials: targetRoom.materials });
    }
  } catch (err: any) {
    console.warn('Firestore updateRoomMaterialActual error:', err.message);
  }
}

// -------------------------------------------------------------
// USER MANAGEMENT & STAKEHOLDER ROLES
// -------------------------------------------------------------
export const MOCK_USERS: User[] = [
  {
    id: 'user_admin_1',
    name: 'Florian Burk',
    role: 'admin',
    email: 'f.burk@burk-haustechnik.de',
    phone: '+49 751 98765-0',
    status: 'active',
    createdAt: '2026-01-10T08:00:00.000Z'
  },
  {
    id: 'user_bl_1',
    name: 'Florian Buck',
    role: 'bauleiter',
    email: 'f.buck@burk-haustechnik.de',
    phone: '+49 171 1234567',
    status: 'active',
    createdAt: '2026-02-01T09:00:00.000Z'
  },
  {
    id: 'user_bl_2',
    name: 'Michael Weber',
    role: 'bauleiter',
    email: 'm.weber@burk-haustechnik.de',
    phone: '+49 171 2345678',
    status: 'active',
    createdAt: '2026-03-15T09:00:00.000Z'
  },
  {
    id: 'user_kfm_1',
    name: 'Sabine Müller',
    role: 'kaufmaennisch',
    email: 's.mueller@burk-haustechnik.de',
    phone: '+49 751 98765-12',
    status: 'active',
    createdAt: '2026-01-15T08:30:00.000Z'
  },
  {
    id: 'user_kfm_2',
    name: 'Andreas Schmidt',
    role: 'kaufmaennisch',
    email: 'a.schmidt@burk-haustechnik.de',
    phone: '+49 751 98765-14',
    status: 'active',
    createdAt: '2026-02-10T08:30:00.000Z'
  },
  {
    id: 'user_mont_1',
    name: 'Ion Popescu',
    role: 'monteur',
    email: 'i.popescu@burk-haustechnik.de',
    phone: '+49 172 3456789',
    pin: '1234',
    defaultLanguage: 'ro',
    status: 'active',
    assignedProjectIds: ['hallenbad-weingarten'],
    createdAt: '2026-04-01T07:00:00.000Z'
  },
  {
    id: 'user_mont_2',
    name: 'Tomasz Novak',
    role: 'monteur',
    email: 't.novak@burk-haustechnik.de',
    phone: '+49 172 4567890',
    pin: '4821',
    defaultLanguage: 'pl',
    status: 'active',
    assignedProjectIds: ['hallenbad-weingarten'],
    createdAt: '2026-04-01T07:00:00.000Z'
  },
  {
    id: 'user_mont_3',
    name: 'Marko Horvat',
    role: 'monteur',
    email: 'm.horvat@burk-haustechnik.de',
    phone: '+49 172 5678901',
    pin: '9012',
    defaultLanguage: 'hr',
    status: 'active',
    assignedProjectIds: ['hallenbad-weingarten'],
    createdAt: '2026-05-15T07:00:00.000Z'
  },
  {
    id: 'user_mont_4',
    name: 'Stefan Maier',
    role: 'monteur',
    email: 's.maier@burk-haustechnik.de',
    phone: '+49 172 6789012',
    pin: '5578',
    defaultLanguage: 'de',
    status: 'active',
    assignedProjectIds: ['gemeindehaus-bavendorf'],
    createdAt: '2026-06-01T07:00:00.000Z'
  }
];

const LOCAL_STORAGE_USERS_KEY = 'burk_tooltime_users';

export function listenToUsers(callback: (users: User[]) => void) {
  const colRef = collection(db, 'users');
  return onSnapshot(colRef, (snap) => {
    if (!snap.empty) {
      const list = snap.docs.map(d => ({ id: d.id, ...d.data() }) as User);
      localStorage.setItem(LOCAL_STORAGE_USERS_KEY, JSON.stringify(list));
      callback(list);
    } else {
      const saved = localStorage.getItem(LOCAL_STORAGE_USERS_KEY);
      if (saved) {
        callback(JSON.parse(saved));
      } else {
        localStorage.setItem(LOCAL_STORAGE_USERS_KEY, JSON.stringify(MOCK_USERS));
        callback(MOCK_USERS);
      }
    }
  }, (err) => {
    console.warn('Firestore fallback mode for users:', err.message);
    const saved = localStorage.getItem(LOCAL_STORAGE_USERS_KEY);
    if (saved) {
      callback(JSON.parse(saved));
    } else {
      localStorage.setItem(LOCAL_STORAGE_USERS_KEY, JSON.stringify(MOCK_USERS));
      callback(MOCK_USERS);
    }
  });
}

export async function saveUser(user: User) {
  const saved = localStorage.getItem(LOCAL_STORAGE_USERS_KEY);
  const currentList: User[] = saved ? JSON.parse(saved) : MOCK_USERS;
  const updated = [user, ...currentList.filter(u => u.id !== user.id)];
  localStorage.setItem(LOCAL_STORAGE_USERS_KEY, JSON.stringify(updated));

  try {
    const ref = doc(db, 'users', user.id);
    await setDoc(ref, user, { merge: true });
  } catch (err: any) {
    console.warn('Firestore saveUser error:', err.message);
  }
}

export async function updateUserPin(userId: string, pin: string) {
  const saved = localStorage.getItem(LOCAL_STORAGE_USERS_KEY);
  const currentList: User[] = saved ? JSON.parse(saved) : MOCK_USERS;
  const updated = currentList.map(u => u.id === userId ? { ...u, pin } : u);
  localStorage.setItem(LOCAL_STORAGE_USERS_KEY, JSON.stringify(updated));

  try {
    const ref = doc(db, 'users', userId);
    await updateDoc(ref, { pin });
  } catch (err: any) {
    console.warn('Firestore updateUserPin error:', err.message);
  }
}

export async function updateProjectDetails(projectId: string, partial: Partial<Project>) {
  const projects = getLocalProjects();
  const updated = projects.map(p => {
    if (p.id === projectId) {
      return { ...p, ...partial, updatedAt: new Date().toISOString() };
    }
    return p;
  });
  saveLocalProjects(updated);

  try {
    const ref = doc(db, 'projects', projectId);
    await updateDoc(ref, {
      ...partial,
      updatedAt: new Date().toISOString()
    });
  } catch (err: any) {
    console.warn('Firestore updateProjectDetails error:', err.message);
  }
}

