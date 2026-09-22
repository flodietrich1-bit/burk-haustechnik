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

export function getLocalProjects(): Project[] {
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

// In-Memory Subscriber System for instant reactivity across all views
type ProjectsCallback = (projects: Project[]) => void;
type SingleProjectCallback = (project: Project | null) => void;
type PositionsCallback = (positions: Position[]) => void;
type RoomsCallback = (rooms: Room[]) => void;
type AlertsCallback = (alerts: Alert[]) => void;

const projectSubscribers = new Set<ProjectsCallback>();
const singleProjectSubscribers = new Map<string, Set<SingleProjectCallback>>();
const positionsSubscribers = new Map<string, Set<PositionsCallback>>();
const roomsSubscribers = new Map<string, Set<RoomsCallback>>();
const alertsSubscribers = new Map<string, Set<AlertsCallback>>();

export function notifyProjectSubscribers(projects: Project[]) {
  projectSubscribers.forEach(cb => {
    try {
      cb(projects);
    } catch (e) {
      console.warn('Error in project subscriber:', e);
    }
  });

  projects.forEach(p => {
    const set = singleProjectSubscribers.get(p.id);
    if (set) {
      set.forEach(cb => {
        try {
          cb(p);
        } catch (e) {
          console.warn('Error in single project subscriber:', e);
        }
      });
    }
  });
}

export function notifySingleProject(projectId: string, project: Project | null) {
  const set = singleProjectSubscribers.get(projectId);
  if (set) {
    set.forEach(cb => {
      try {
        cb(project);
      } catch (e) {
        console.warn('Error in single project subscriber:', e);
      }
    });
  }
}

export function notifyPositionsSubscribers(projectId: string, positions: Position[]) {
  const set = positionsSubscribers.get(projectId);
  if (set) {
    set.forEach(cb => {
      try {
        cb(positions);
      } catch (e) {
        console.warn('Error in positions subscriber:', e);
      }
    });
  }
}

export function notifyRoomsSubscribers(projectId: string, rooms: Room[]) {
  const set = roomsSubscribers.get(projectId);
  if (set) {
    set.forEach(cb => {
      try {
        cb(rooms);
      } catch (e) {
        console.warn('Error in rooms subscriber:', e);
      }
    });
  }
}

export function notifyAlertsSubscribers(projectId: string, alerts: Alert[]) {
  const set = alertsSubscribers.get(projectId);
  if (set) {
    set.forEach(cb => {
      try {
        cb(alerts);
      } catch (e) {
        console.warn('Error in alerts subscriber:', e);
      }
    });
  }
}

function saveLocalProjects(projects: Project[]) {
  try {
    localStorage.setItem(LOCAL_STORAGE_PROJECTS_KEY, JSON.stringify(projects));
  } catch (e) {
    console.warn('LocalStorage error saving projects:', e);
  }
  notifyProjectSubscribers(projects);
}

// Clean empty datasets (zero mock data)
export const MOCK_POSITIONS: Position[] = [];
export const MOCK_ROOMS: Room[] = [];
export const MOCK_ALERTS: Alert[] = [];
export const MOCK_BOOKINGS: Booking[] = [];
export const MOCK_ADDENDUMS: Addendum[] = [];

// Real-time Firestore Listeners with Local Pub/Sub Fallback

// 1. Listen to all projects
export function listenToProjects(callback: (projects: Project[]) => void) {
  projectSubscribers.add(callback);
  // Immediately deliver current cached state synchronously
  callback(getLocalProjects());

  const colRef = collection(db, 'projects');
  const unsubFirestore = onSnapshot(colRef, async (snap) => {
    if (!snap.empty) {
      // Firestore has data → use it as source of truth
      const list = snap.docs.map(d => ({ id: d.id, ...d.data() }) as Project);
      saveLocalProjects(list);
    } else {
      // Firestore is empty → migrate localStorage projects to Firestore (one-time)
      const localProjects = getLocalProjects();
      if (localProjects.length > 0) {
        console.log(`Migrating ${localProjects.length} local project(s) to Firestore...`);
        for (const project of localProjects) {
          try {
            const projectRef = doc(db, 'projects', project.id);
            await setDoc(projectRef, project, { merge: true });

            // Also migrate positions and rooms for each project
            const posRaw = localStorage.getItem(LOCAL_STORAGE_POSITIONS_PREFIX + project.id);
            if (posRaw) {
              const positions: Position[] = JSON.parse(posRaw);
              for (const pos of positions) {
                if (!pos.id) continue;
                const pRef = doc(db, 'projects', project.id, 'positions', pos.id);
                await setDoc(pRef, pos, { merge: true });
              }
            }
            const roomsRaw = localStorage.getItem(LOCAL_STORAGE_ROOMS_PREFIX + project.id);
            if (roomsRaw) {
              const rooms: Room[] = JSON.parse(roomsRaw);
              for (const room of rooms) {
                const rRef = doc(db, 'projects', project.id, 'rooms', room.id);
                await setDoc(rRef, room, { merge: true });
              }
            }
            console.log(`✅ Migrated project: ${project.id}`);
          } catch (err: any) {
            console.warn(`Failed to migrate project ${project.id}:`, err.message);
          }
        }
      }
    }
  }, () => {
    // Ignore in fallback mode
  });

  return () => {
    projectSubscribers.delete(callback);
    unsubFirestore();
  };
}

// 2. Listen to single project
export function listenToProject(projectId: string, callback: (project: Project | null) => void) {
  if (!projectId) {
    callback(null);
    return () => {};
  }

  if (!singleProjectSubscribers.has(projectId)) {
    singleProjectSubscribers.set(projectId, new Set());
  }
  const set = singleProjectSubscribers.get(projectId)!;
  set.add(callback);

  // Immediately deliver current cached state synchronously
  const local = getLocalProjects().find(p => p.id === projectId) || null;
  callback(local);

  const ref = doc(db, 'projects', projectId);
  const unsubFirestore = onSnapshot(ref, (snap) => {
    if (snap.exists()) {
      const p = { id: snap.id, ...snap.data() } as Project;
      callback(p);
    }
  }, () => {
    // Ignore in fallback mode
  });

  return () => {
    set.delete(callback);
    if (set.size === 0) singleProjectSubscribers.delete(projectId);
    unsubFirestore();
  };
}

// 3. Listen to positions of project
export function listenToPositions(projectId: string, callback: (positions: Position[]) => void) {
  if (!projectId) {
    callback([]);
    return () => {};
  }

  if (!positionsSubscribers.has(projectId)) {
    positionsSubscribers.set(projectId, new Set());
  }
  const set = positionsSubscribers.get(projectId)!;
  set.add(callback);

  // Immediately deliver current cached state synchronously
  const saved = localStorage.getItem(LOCAL_STORAGE_POSITIONS_PREFIX + projectId);
  if (saved) {
    try {
      callback(JSON.parse(saved));
    } catch {
      callback([]);
    }
  } else {
    callback([]);
  }

  const colRef = collection(db, 'projects', projectId, 'positions');
  const unsubFirestore = onSnapshot(colRef, (snap) => {
    if (!snap.empty) {
      const list = snap.docs.map(d => ({ id: d.id, ...d.data() }) as Position);
      localStorage.setItem(LOCAL_STORAGE_POSITIONS_PREFIX + projectId, JSON.stringify(list));
      notifyPositionsSubscribers(projectId, list);
    }
  }, () => {
    // Ignore in fallback mode
  });

  return () => {
    set.delete(callback);
    if (set.size === 0) positionsSubscribers.delete(projectId);
    unsubFirestore();
  };
}

// 4. Listen to rooms of project
export function listenToRooms(projectId: string, callback: (rooms: Room[]) => void) {
  if (!projectId) {
    callback([]);
    return () => {};
  }

  if (!roomsSubscribers.has(projectId)) {
    roomsSubscribers.set(projectId, new Set());
  }
  const set = roomsSubscribers.get(projectId)!;
  set.add(callback);

  // Immediately deliver current cached state synchronously
  const saved = localStorage.getItem(LOCAL_STORAGE_ROOMS_PREFIX + projectId);
  if (saved) {
    try {
      callback(JSON.parse(saved));
    } catch {
      callback([]);
    }
  } else {
    callback([]);
  }

  const colRef = collection(db, 'projects', projectId, 'rooms');
  const unsubFirestore = onSnapshot(colRef, (snap) => {
    if (!snap.empty) {
      const list = snap.docs.map(d => ({ id: d.id, ...d.data() }) as Room);
      localStorage.setItem(LOCAL_STORAGE_ROOMS_PREFIX + projectId, JSON.stringify(list));
      notifyRoomsSubscribers(projectId, list);
    }
  }, () => {
    // Fallback mode
  });

  return () => {
    set.delete(callback);
    if (set.size === 0) roomsSubscribers.delete(projectId);
    unsubFirestore();
  };
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
    notifyPositionsSubscribers(project.id, positions as Position[]);
  }
  if (rooms.length > 0) {
    localStorage.setItem(LOCAL_STORAGE_ROOMS_PREFIX + project.id, JSON.stringify(rooms));
    notifyRoomsSubscribers(project.id, rooms);
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

  if (!alertsSubscribers.has(projectId)) {
    alertsSubscribers.set(projectId, new Set());
  }
  const set = alertsSubscribers.get(projectId)!;
  set.add(callback);

  // Immediately deliver current cached state synchronously
  const saved = localStorage.getItem(LOCAL_STORAGE_ALERTS_PREFIX + projectId);
  if (saved) {
    try {
      callback(JSON.parse(saved));
    } catch {
      callback([]);
    }
  } else {
    callback([]);
  }

  const colRef = collection(db, 'projects', projectId, 'alerts');
  const unsubFirestore = onSnapshot(colRef, (snap) => {
    if (!snap.empty) {
      const list = snap.docs.map(d => ({ id: d.id, ...d.data() }) as Alert);
      localStorage.setItem(LOCAL_STORAGE_ALERTS_PREFIX + projectId, JSON.stringify(list));
      notifyAlertsSubscribers(projectId, list);
    }
  }, () => {
    // Fallback mode
  });

  return () => {
    set.delete(callback);
    if (set.size === 0) alertsSubscribers.delete(projectId);
    unsubFirestore();
  };
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
  const currentList: Alert[] = saved ? JSON.parse(saved) : [];
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
  const currentList: Room[] = saved ? JSON.parse(saved) : [];
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
  const currentList: Room[] = saved ? JSON.parse(saved) : [];
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
    password: 'Admin2026!',
    phone: '+49 751 98765-0',
    status: 'active',
    createdAt: '2026-01-10T08:00:00.000Z'
  },
  {
    id: 'user_bl_1',
    name: 'Florian Buck',
    role: 'bauleiter',
    email: 'f.buck@burk-haustechnik.de',
    password: 'Bauleiter2026!',
    phone: '+49 171 1234567',
    status: 'active',
    createdAt: '2026-02-01T09:00:00.000Z'
  },
  {
    id: 'user_bl_2',
    name: 'Michael Weber',
    role: 'bauleiter',
    email: 'm.weber@burk-haustechnik.de',
    password: 'Bauleiter2026!',
    phone: '+49 171 2345678',
    status: 'active',
    createdAt: '2026-03-15T09:00:00.000Z'
  },
  {
    id: 'user_kfm_1',
    name: 'Sabine Müller',
    role: 'kaufmaennisch',
    email: 's.mueller@burk-haustechnik.de',
    password: 'Kfm2026!',
    phone: '+49 751 98765-12',
    status: 'active',
    createdAt: '2026-01-15T08:30:00.000Z'
  },
  {
    id: 'user_kfm_2',
    name: 'Andreas Schmidt',
    role: 'kaufmaennisch',
    email: 'a.schmidt@burk-haustechnik.de',
    password: 'Kfm2026!',
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

export function getLocalUsers(): User[] {
  try {
    const saved = localStorage.getItem(LOCAL_STORAGE_USERS_KEY);
    if (saved) return JSON.parse(saved);
  } catch (e) {
    console.warn('Error reading users from localStorage:', e);
  }
  return MOCK_USERS;
}

export function listenToUsers(callback: (users: User[]) => void) {
  const colRef = collection(db, 'users');
  return onSnapshot(colRef, (snap) => {
    if (!snap.empty) {
      const list = snap.docs.map(d => ({ id: d.id, ...d.data() }) as User);
      localStorage.setItem(LOCAL_STORAGE_USERS_KEY, JSON.stringify(list));
      callback(list);
    } else {
      callback(getLocalUsers());
    }
  }, (err) => {
    console.warn('Firestore fallback mode for users:', err.message);
    callback(getLocalUsers());
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
  let updatedProject: Project | null = null;
  const updated = projects.map(p => {
    if (p.id === projectId) {
      updatedProject = { ...p, ...partial, updatedAt: new Date().toISOString() };
      return updatedProject;
    }
    return p;
  });
  saveLocalProjects(updated);
  if (updatedProject) {
    notifySingleProject(projectId, updatedProject);
  }

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

// -------------------------------------------------------------
// AUTHENTICATION & PASSWORD MANAGEMENT
// -------------------------------------------------------------
const LOCAL_STORAGE_AUTH_USER_KEY = 'burk_tooltime_auth_user';

export function getCurrentAuthUser(): User | null {
  try {
    const raw = localStorage.getItem(LOCAL_STORAGE_AUTH_USER_KEY);
    if (raw) return JSON.parse(raw);
  } catch (e) {
    console.warn('Error reading auth user from localStorage:', e);
  }
  return null;
}

export function setCurrentAuthUser(user: User | null): void {
  try {
    if (user) {
      localStorage.setItem(LOCAL_STORAGE_AUTH_USER_KEY, JSON.stringify(user));
    } else {
      localStorage.removeItem(LOCAL_STORAGE_AUTH_USER_KEY);
    }
  } catch (e) {
    console.warn('Error saving auth user to localStorage:', e);
  }
}

export async function updateUserPassword(userId: string, newPassword: string): Promise<void> {
  const saved = localStorage.getItem(LOCAL_STORAGE_USERS_KEY);
  const currentList: User[] = saved ? JSON.parse(saved) : MOCK_USERS;
  const updated = currentList.map(u => u.id === userId ? { ...u, password: newPassword } : u);
  localStorage.setItem(LOCAL_STORAGE_USERS_KEY, JSON.stringify(updated));

  // If the logged in user changed their own password, update session
  const authUser = getCurrentAuthUser();
  if (authUser && authUser.id === userId) {
    setCurrentAuthUser({ ...authUser, password: newPassword });
  }

  try {
    const ref = doc(db, 'users', userId);
    await updateDoc(ref, { password: newPassword });
  } catch (err: any) {
    console.warn('Firestore updateUserPassword error:', err.message);
  }
}


