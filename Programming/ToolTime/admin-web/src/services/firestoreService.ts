import { 
  collection, doc, onSnapshot, setDoc, updateDoc, deleteDoc
} from 'firebase/firestore';
import { db } from '../firebase';
import type { Project, Position, Room, Booking, Addendum } from '../types';

export const DEFAULT_PROJECT_ID = 'hallenbad-weingarten';

// Mock initial projects with real data from Burk Haustechnik
export const INITIAL_PROJECTS: Project[] = [
  {
    id: 'hallenbad-weingarten',
    name: 'Hallenbad Weingarten Sanierung',
    projectNumber: '1638 / 24316-044',
    client: 'Stadt Weingarten',
    location: 'Weingarten',
    address: 'Brechenmacherstraße 11, 88250 Weingarten',
    startDate: '2026-09-01',
    endDate: '2027-04-30',
    trade: 'Sanitärinstallation',
    projectManager: 'Florian Buck',
    status: 'in_progress',
    currency: 'EUR',
    totalPositions: 251,
    totalDeliveredPercentage: 28,
    createdAt: '2026-09-01T08:00:00.000Z'
  },
  {
    id: 'gemeindehaus-bavendorf',
    name: 'Gemeindehaus Bavendorf',
    projectNumber: '2337',
    client: 'Bischöfliches Ordinariat der Diözese Rottenburg-Stuttgart',
    location: 'Bavendorf',
    address: 'Kirchstraße 4, 88213 Ravensburg-Bavendorf',
    startDate: '2025-12-01',
    endDate: '2026-08-16',
    trade: 'Heizungsanlage nach DIN 18380',
    projectManager: 'Matthias Ruf',
    status: 'in_progress',
    currency: 'EUR',
    totalPositions: 242,
    totalDeliveredPercentage: 12,
    createdAt: '2025-11-15T09:00:00.000Z'
  }
];

// Local storage key for persistent projects in offline / local fallback mode
const LOCAL_STORAGE_PROJECTS_KEY = 'burk_tooltime_projects';
const LOCAL_STORAGE_POSITIONS_PREFIX = 'burk_tooltime_positions_';
const LOCAL_STORAGE_ROOMS_PREFIX = 'burk_tooltime_rooms_';

function getLocalProjects(): Project[] {
  try {
    const raw = localStorage.getItem(LOCAL_STORAGE_PROJECTS_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) return parsed;
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
    translations: { ro: 'Vestiar Bărbați', pl: 'Szatnia Męska', hr: 'Muška Svlačionica' },
    materials: [
      { positionId: 'pos_01_03', posNr: '01.03', shortText: 'Kunststoffrohr DN 70', plannedQty: 6, qu: 'm', group: 'Abflussleitungen' },
      { positionId: 'pos_01_05', posNr: '01.05', shortText: 'Bogen DN 50, 15° - 87°', plannedQty: 8, qu: 'Stk', group: 'Abflussleitungen' }
    ]
  },
  { 
    id: 'room_102', 
    name: 'Umkleide Damen', 
    code: 'EG-102', 
    floor: 'EG', 
    source: 'dwg',
    translations: { ro: 'Vestiar Femei', pl: 'Szatnia Damska', hr: 'Ženska Svlačionica' },
    materials: [
      { positionId: 'pos_01_03', posNr: '01.03', shortText: 'Kunststoffrohr DN 70', plannedQty: 6, qu: 'm', group: 'Abflussleitungen' },
      { positionId: 'pos_01_05', posNr: '01.05', shortText: 'Bogen DN 50, 15° - 87°', plannedQty: 8, qu: 'Stk', group: 'Abflussleitungen' }
    ]
  },
  { 
    id: 'room_103', 
    name: 'Duschen Herren', 
    code: 'EG-103', 
    floor: 'EG', 
    source: 'dwg',
    translations: { ro: 'Dușuri Bărbați', pl: 'Prysznice Męskie', hr: 'Muški Tuševi' },
    materials: [
      { positionId: 'pos_01_02', posNr: '01.02', shortText: 'Kunststoffrohr DN 100', plannedQty: 25, qu: 'm', group: 'Abflussleitungen' },
      { positionId: 'pos_01_05', posNr: '01.05', shortText: 'Bogen DN 50, 15° - 87°', plannedQty: 12, qu: 'Stk', group: 'Abflussleitungen' },
      { positionId: 'pos_01_18', posNr: '01.18', shortText: 'Brandschutzmanschette DN 100', plannedQty: 4, qu: 'Stk', group: 'Abflussleitungen' }
    ]
  },
  { 
    id: 'room_104', 
    name: 'Duschen Damen', 
    code: 'EG-104', 
    floor: 'EG', 
    source: 'dwg',
    translations: { ro: 'Dușuri Femei', pl: 'Prysznice Damskie', hr: 'Ženske Tuševi' },
    materials: [
      { positionId: 'pos_01_02', posNr: '01.02', shortText: 'Kunststoffrohr DN 100', plannedQty: 20, qu: 'm', group: 'Abflussleitungen' },
      { positionId: 'pos_01_05', posNr: '01.05', shortText: 'Bogen DN 50, 15° - 87°', plannedQty: 10, qu: 'Stk', group: 'Abflussleitungen' },
      { positionId: 'pos_01_18', posNr: '01.18', shortText: 'Brandschutzmanschette DN 100', plannedQty: 4, qu: 'Stk', group: 'Abflussleitungen' }
    ]
  },
  { 
    id: 'room_201', 
    name: 'Technikraum OG', 
    code: 'OG-201', 
    floor: 'OG', 
    source: 'dwg',
    translations: { ro: 'Cameră Tehnică', pl: 'Maszynownia', hr: 'Tehnička Soba' },
    materials: [
      { positionId: 'pos_01_01', posNr: '01.01', shortText: 'Schmutzwasserleitung DN 125 hochschalldämmend', plannedQty: 3, qu: 'm', group: 'Abflussleitungen' }
    ]
  },
  { 
    id: 'room_001', 
    name: 'Keller / Hebeanlage', 
    code: 'UG-001', 
    floor: 'UG', 
    source: 'dwg',
    translations: { ro: 'Subsol / Pompare', pl: 'Piwnica / Pompownia', hr: 'Podrum / Crpna Stanica' },
    materials: [
      { positionId: 'pos_01_36', posNr: '01.36', shortText: 'Schmutzwassersammelbehälter 270L Doppelhebeanlage', plannedQty: 1, qu: 'Stk', group: 'Grauwasser Hebeanlage' },
      { positionId: 'pos_01_37', posNr: '01.37', shortText: 'Vertikale 1-stufige Schmutzwasserpumpe IP68', plannedQty: 2, qu: 'Stk', group: 'Grauwasser Hebeanlage' }
    ]
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
export function listenToProject(projectId: string, callback: (project: Project) => void) {
  const ref = doc(db, 'projects', projectId);
  return onSnapshot(ref, (snap) => {
    if (snap.exists()) {
      callback(snap.data() as Project);
    } else {
      const local = getLocalProjects().find(p => p.id === projectId);
      if (local) {
        callback(local);
      } else {
        callback({
          id: projectId,
          name: 'Hallenbad Weingarten Sanierung',
          projectNumber: '1638 / 24316-044',
          client: 'Stadt Weingarten',
          location: 'Weingarten',
          status: 'in_progress',
          currency: 'EUR',
          totalPositions: MOCK_POSITIONS.length,
          createdAt: new Date().toISOString()
        });
      }
    }
  }, (err) => {
    console.warn('Firestore fallback mode for project:', err.message);
    const local = getLocalProjects().find(p => p.id === projectId);
    if (local) callback(local);
  });
}

// 3. Listen to positions of project
export function listenToPositions(projectId: string, callback: (positions: Position[]) => void) {
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
      } else if (projectId === 'hallenbad-weingarten') {
        callback(MOCK_POSITIONS);
      } else {
        callback([]);
      }
    }
  }, (err) => {
    console.warn('Firestore fallback mode for positions:', err.message);
    const saved = localStorage.getItem(LOCAL_STORAGE_POSITIONS_PREFIX + projectId);
    if (saved) {
      callback(JSON.parse(saved));
    } else if (projectId === 'hallenbad-weingarten') {
      callback(MOCK_POSITIONS);
    } else {
      callback([]);
    }
  });
}

// 4. Listen to rooms of project
export function listenToRooms(projectId: string, callback: (rooms: Room[]) => void) {
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
      } else if (projectId === 'hallenbad-weingarten') {
        callback(MOCK_ROOMS);
      } else {
        callback([]);
      }
    }
  }, (err) => {
    console.warn('Firestore fallback mode for rooms:', err.message);
    const saved = localStorage.getItem(LOCAL_STORAGE_ROOMS_PREFIX + projectId);
    if (saved) {
      callback(JSON.parse(saved));
    } else if (projectId === 'hallenbad-weingarten') {
      callback(MOCK_ROOMS);
    } else {
      callback([]);
    }
  });
}

export function listenToBookings(projectId: string, callback: (bookings: Booking[]) => void) {
  const colRef = collection(db, 'bookings');
  return onSnapshot(colRef, (snap) => {
    if (!snap.empty) {
      const list = snap.docs
        .map(d => ({ id: d.id, ...d.data() }) as Booking)
        .filter(b => b.projectId === projectId);
      callback(list);
    } else {
      callback(MOCK_BOOKINGS.filter(b => b.projectId === projectId));
    }
  }, (err) => {
    console.warn('Firestore fallback mode for bookings:', err.message);
    callback(MOCK_BOOKINGS.filter(b => b.projectId === projectId));
  });
}

export function listenToAddendums(projectId: string, callback: (addendums: Addendum[]) => void) {
  const colRef = collection(db, 'addendums');
  return onSnapshot(colRef, (snap) => {
    if (!snap.empty) {
      const list = snap.docs
        .map(d => ({ id: d.id, ...d.data() }) as Addendum)
        .filter(a => a.projectId === projectId);
      callback(list);
    } else {
      callback(MOCK_ADDENDUMS.filter(a => a.projectId === projectId));
    }
  }, (err) => {
    console.warn('Firestore fallback mode for addendums:', err.message);
    callback(MOCK_ADDENDUMS.filter(a => a.projectId === projectId));
  });
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
