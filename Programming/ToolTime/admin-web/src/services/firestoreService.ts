import { 
  collection, doc, onSnapshot, setDoc, updateDoc, deleteDoc, writeBatch, getDocs
} from 'firebase/firestore';
import { ref, uploadBytesResumable, getDownloadURL } from 'firebase/storage';
import { db, storage } from '../firebase';
import type { Project, Position, Room, Booking, Addendum, Alert, User, PlanDocument, PlanLevel } from '../types';

export const DEFAULT_PROJECT_ID = '';

// Initial projects: start completely empty for clean onboarding
export const INITIAL_PROJECTS: Project[] = [];

// Local storage key for persistent projects in offline / local fallback mode
const LOCAL_STORAGE_PROJECTS_KEY = 'burk_tooltime_projects_v2';
const LOCAL_STORAGE_POSITIONS_PREFIX = 'burk_tooltime_positions_';
const LOCAL_STORAGE_ROOMS_PREFIX = 'burk_tooltime_rooms_';
const LOCAL_STORAGE_ALERTS_PREFIX = 'burk_tooltime_alerts_';
const LOCAL_STORAGE_PLANS_PREFIX = 'burk_tooltime_plans_';

const LOCAL_STORAGE_DELETED_PROJECTS_KEY = 'burk_tooltime_deleted_project_ids';

export function getDeletedProjectIds(): Set<string> {
  try {
    const raw = localStorage.getItem(LOCAL_STORAGE_DELETED_PROJECTS_KEY);
    return new Set(raw ? JSON.parse(raw) : []);
  } catch {
    return new Set();
  }
}

export function addDeletedProjectId(projectId: string) {
  try {
    const current = getDeletedProjectIds();
    current.add(projectId);
    localStorage.setItem(LOCAL_STORAGE_DELETED_PROJECTS_KEY, JSON.stringify(Array.from(current)));
  } catch {}
}

/** Helper to sanitize objects before sending to Firestore (Firestore rejects undefined fields) */
export function cleanForFirestore<T>(data: T): T {
  if (data === undefined) return null as unknown as T;
  return JSON.parse(JSON.stringify(data));
}

export function getLocalProjects(): Project[] {
  try {
    const raw = localStorage.getItem(LOCAL_STORAGE_PROJECTS_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        const deletedIds = getDeletedProjectIds();
        return parsed.filter(p => p.id && !deletedIds.has(p.id) && p.status !== 'deleted' && !(p as any).isDeleted);
      }
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
type PlansCallback = (plans: PlanDocument[]) => void;

const projectSubscribers = new Set<ProjectsCallback>();
const singleProjectSubscribers = new Map<string, Set<SingleProjectCallback>>();
const positionsSubscribers = new Map<string, Set<PositionsCallback>>();
const roomsSubscribers = new Map<string, Set<RoomsCallback>>();
const alertsSubscribers = new Map<string, Set<AlertsCallback>>();
const plansSubscribers = new Map<string, Set<PlansCallback>>();

export function notifyPlansSubscribers(projectId: string, plans: PlanDocument[]) {
  const set = plansSubscribers.get(projectId);
  if (set) {
    set.forEach(cb => {
      try {
        cb(plans);
      } catch (e) {
        console.warn('Error in plans subscriber:', e);
      }
    });
  }
}

export function getLocalPlans(projectId: string): PlanDocument[] {
  try {
    const raw = localStorage.getItem(LOCAL_STORAGE_PLANS_PREFIX + projectId);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return parsed;
    }
  } catch (e) {
    console.warn('LocalStorage error reading plans:', e);
  }
  return [];
}

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
  const unsubFirestore = onSnapshot(colRef, (snap) => {
    const deletedIds = getDeletedProjectIds();
    if (!snap.empty) {
      const firestoreProjects = snap.docs
        .map(d => ({ id: d.id, ...d.data() }) as Project)
        .filter(p => p && p.id && p.name && p.status !== 'deleted' && !(p as any).isDeleted && !deletedIds.has(p.id));

      saveLocalProjects(firestoreProjects);
    } else {
      saveLocalProjects([]);
    }
  }, (err) => {
    console.warn('Firestore onSnapshot projects error:', err.message);
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

// 4b. Listen to plans of project
export function listenToPlans(projectId: string, callback: (plans: PlanDocument[]) => void) {
  if (!projectId) {
    callback([]);
    return () => {};
  }

  if (!plansSubscribers.has(projectId)) {
    plansSubscribers.set(projectId, new Set());
  }
  const set = plansSubscribers.get(projectId)!;
  set.add(callback);

  // Immediately deliver current cached state synchronously
  const saved = localStorage.getItem(LOCAL_STORAGE_PLANS_PREFIX + projectId);
  if (saved) {
    try {
      callback(JSON.parse(saved));
    } catch {
      callback([]);
    }
  } else {
    callback([]);
  }

  const colRef = collection(db, 'projects', projectId, 'plans');
  const unsubFirestore = onSnapshot(colRef, (snap) => {
    if (!snap.empty) {
      const list = snap.docs.map(d => ({ id: d.id, ...d.data() }) as PlanDocument);
      localStorage.setItem(LOCAL_STORAGE_PLANS_PREFIX + projectId, JSON.stringify(list));
      notifyPlansSubscribers(projectId, list);
    }
  }, () => {
    // Fallback mode
  });

  return () => {
    set.delete(callback);
    if (set.size === 0) plansSubscribers.delete(projectId);
    unsubFirestore();
  };
}

export function listenToBookings(projectId: string, callback: (bookings: Booking[]) => void) {
  if (!projectId) {
    callback([]);
    return () => {};
  }

  let globalBookings: Booking[] = [];
  let projectBookings: Booking[] = [];

  const emitMerged = () => {
    const map = new Map<string, Booking>();
    globalBookings.forEach(b => {
      if (b.projectId === projectId || !b.projectId) {
        map.set(b.id, b);
      }
    });
    projectBookings.forEach(b => {
      const existing = map.get(b.id);
      map.set(b.id, existing ? { ...existing, ...b } : b);
    });
    callback(Array.from(map.values()));
  };

  const globalRef = collection(db, 'bookings');
  const unsubGlobal = onSnapshot(globalRef, (snap) => {
    if (!snap.empty) {
      globalBookings = snap.docs
        .map(d => ({ id: d.id, ...d.data() }) as Booking)
        .filter(b => !b.projectId || b.projectId === projectId);
    } else {
      globalBookings = [];
    }
    emitMerged();
  }, (err) => {
    console.warn('Firestore global bookings fallback:', err.message);
  });

  const projectRef = collection(db, 'projects', projectId, 'bookings');
  const unsubProject = onSnapshot(projectRef, (snap) => {
    if (!snap.empty) {
      projectBookings = snap.docs.map(d => ({ id: d.id, ...d.data() }) as Booking);
    } else {
      projectBookings = [];
    }
    emitMerged();
  }, (err) => {
    console.warn('Firestore project bookings fallback:', err.message);
  });

  return () => {
    unsubGlobal();
    unsubProject();
  };
}

export function listenToAddendums(projectId: string, callback: (addendums: Addendum[]) => void) {
  if (!projectId) {
    callback([]);
    return () => {};
  }

  let globalList: Addendum[] = [];
  let projectList: Addendum[] = [];

  const emitMerged = () => {
    const map = new Map<string, Addendum>();
    globalList.forEach(a => {
      if (a.projectId === projectId || !a.projectId) {
        map.set(a.id, a);
      }
    });
    projectList.forEach(a => {
      const existing = map.get(a.id);
      map.set(a.id, existing ? { ...existing, ...a } : a);
    });

    const normalized: Addendum[] = Array.from(map.values()).map(item => ({
      ...item,
      // Normalize 'synced' status from mobile to 'pending'
      status: (item.status && (item.status as string) !== 'synced') ? item.status : 'pending',
    }));

    callback(normalized);
  };

  const globalRef = collection(db, 'addendums');
  const unsubGlobal = onSnapshot(globalRef, (snap) => {
    if (!snap.empty) {
      globalList = snap.docs
        .map(d => ({ id: d.id, ...d.data() }) as Addendum)
        .filter(a => !a.projectId || a.projectId === projectId);
    } else {
      globalList = [];
    }
    emitMerged();
  }, (err) => {
    console.warn('Firestore global addendums fallback:', err.message);
  });

  const projectRef = collection(db, 'projects', projectId, 'addendums');
  const unsubProject = onSnapshot(projectRef, (snap) => {
    if (!snap.empty) {
      projectList = snap.docs.map(d => ({ id: d.id, ...d.data() }) as Addendum);
    } else {
      projectList = [];
    }
    emitMerged();
  }, (err) => {
    console.warn('Firestore project addendums fallback:', err.message);
  });

  return () => {
    unsubGlobal();
    unsubProject();
  };
}

// Delete a single project and clean all associated local data, users & Firestore subcollections
export async function deleteProject(projectId: string): Promise<void> {
  addDeletedProjectId(projectId);
  const current = getLocalProjects().filter(p => p.id !== projectId);
  saveLocalProjects(current);
  localStorage.removeItem(LOCAL_STORAGE_POSITIONS_PREFIX + projectId);
  localStorage.removeItem(LOCAL_STORAGE_ROOMS_PREFIX + projectId);
  localStorage.removeItem(LOCAL_STORAGE_ALERTS_PREFIX + projectId);
  localStorage.removeItem(LOCAL_STORAGE_PLANS_PREFIX + projectId);
  localStorage.removeItem('burk_tooltime_aufmasse_' + projectId);

  const activeSavedId = localStorage.getItem('burk_tooltime_active_project_id');
  if (activeSavedId === projectId) {
    if (current.length > 0) {
      localStorage.setItem('burk_tooltime_active_project_id', current[0].id);
    } else {
      localStorage.removeItem('burk_tooltime_active_project_id');
    }
  }

  // Notify memory subscribers for subcollections
  notifyPositionsSubscribers(projectId, []);
  notifyRoomsSubscribers(projectId, []);
  notifyAlertsSubscribers(projectId, []);
  notifyPlansSubscribers(projectId, []);

  try {
    const projectRef = doc(db, 'projects', projectId);

    // 1. Mark as tombstone (status: deleted, isDeleted: true) so all clients filter it out permanently
    try {
      await setDoc(projectRef, {
        status: 'deleted',
        isDeleted: true,
        deletedAt: new Date().toISOString()
      }, { merge: true });
    } catch {
      // Document might be offline
    }

    // 2. Wipe all subcollection documents in Firestore
    const subcollections = [
      'positions',
      'items',
      'rooms',
      'bookings',
      'addendums',
      'alerts',
      'plans',
      'aufmasse',
      'aufmass',
      'monteurs'
    ];

    for (const sub of subcollections) {
      try {
        const subSnap = await getDocs(collection(db, 'projects', projectId, sub));
        if (!subSnap.empty) {
          const chunkSize = 200;
          for (let i = 0; i < subSnap.docs.length; i += chunkSize) {
            const batch = writeBatch(db);
            const slice = subSnap.docs.slice(i, i + chunkSize);
            slice.forEach(d => batch.delete(d.ref));
            await batch.commit();
          }
        }
      } catch (subErr) {
        console.warn(`Error wiping subcollection ${sub} for project ${projectId}:`, subErr);
      }
    }

    // 3. Remove projectId from assignedProjectIds of all users
    try {
      const usersSnap = await getDocs(collection(db, 'users'));
      if (!usersSnap.empty) {
        for (const uDoc of usersSnap.docs) {
          const uData = uDoc.data();
          if (Array.isArray(uData.assignedProjectIds) && uData.assignedProjectIds.includes(projectId)) {
            const updated = uData.assignedProjectIds.filter((id: string) => id !== projectId);
            await updateDoc(uDoc.ref, { assignedProjectIds: updated });
          }
        }
      }
    } catch (userErr) {
      console.warn('Error clearing project from users:', userErr);
    }

    // Also update local users cache
    try {
      const localUsers = getLocalUsers();
      let usersChanged = false;
      const updatedLocalUsers = localUsers.map(u => {
        if (Array.isArray(u.assignedProjectIds) && u.assignedProjectIds.includes(projectId)) {
          usersChanged = true;
          return {
            ...u,
            assignedProjectIds: u.assignedProjectIds.filter(id => id !== projectId)
          };
        }
        return u;
      });
      if (usersChanged) {
        localStorage.setItem(LOCAL_STORAGE_USERS_KEY, JSON.stringify(updatedLocalUsers));
      }
    } catch {
      // ignore
    }

    console.log(`✅ Project ${projectId} completely marked as deleted in Firestore and wiped from caches.`);
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
    localStorage.removeItem(LOCAL_STORAGE_PLANS_PREFIX + p.id);
    try {
      await deleteDoc(doc(db, 'projects', p.id));
    } catch {
      // ignore
    }
  }
  localStorage.removeItem('burk_tooltime_active_project_id');
}

let isStorageReachable: boolean | null = null;

export async function uploadPlanFile(
  projectId: string,
  planId: string,
  file: File,
  onProgress?: (pct: number) => void
): Promise<{ downloadUrl: string; storagePath: string; dwgUrl: string; pdfUrl: string }> {
  const isPdf = file.name.toLowerCase().endsWith('.pdf');
  const ext = isPdf ? '.pdf' : '.dwg';
  const storagePath = `projects/${projectId}/plans/${planId}${ext}`;
  
  if (!storage || isStorageReachable === false) {
    if (onProgress) onProgress(100);
    const localUrl = URL.createObjectURL(file);
    return {
      downloadUrl: localUrl,
      dwgUrl: localUrl,
      pdfUrl: localUrl,
      storagePath
    };
  }

  return new Promise((resolve) => {
    let isSettled = false;
    let uploadTask: any = null;

    const safeSettle = (res: { downloadUrl: string; storagePath: string; dwgUrl?: string; pdfUrl?: string }) => {
      if (isSettled) return;
      isSettled = true;
      if (timeoutTimer) clearTimeout(timeoutTimer);
      if (onProgress) onProgress(100);
      resolve({
        downloadUrl: res.downloadUrl,
        storagePath: res.storagePath,
        dwgUrl: res.dwgUrl || res.downloadUrl,
        pdfUrl: res.pdfUrl || res.downloadUrl
      });
    };

    // Safety timeout: 3.5s per file max. If network hangs, CORS blocked, or bucket is 404, fallback quickly
    const timeoutTimer = setTimeout(() => {
      if (!isSettled) {
        console.warn(`Firebase Storage upload timed out for ${file.name}. Falling back to local URL.`);
        isStorageReachable = false;
        try {
          if (uploadTask && typeof uploadTask.cancel === 'function') uploadTask.cancel();
        } catch {}
        safeSettle({
          downloadUrl: URL.createObjectURL(file),
          storagePath
        });
      }
    }, 3500);

    try {
      const storageRef = ref(storage, storagePath);
      uploadTask = uploadBytesResumable(storageRef, file);

      uploadTask.on(
        'state_changed',
        (snapshot: any) => {
          if (!isSettled && snapshot.totalBytes > 0) {
            const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
            if (onProgress) onProgress(Math.min(100, Math.round(progress)));
          }
        },
        (error: any) => {
          console.warn('Firebase Storage upload failed, fallback to local URL:', error.message || error);
          isStorageReachable = false;
          safeSettle({
            downloadUrl: URL.createObjectURL(file),
            storagePath
          });
        },
        async () => {
          try {
            const downloadUrl = await getDownloadURL(uploadTask.snapshot.ref);
            isStorageReachable = true;
            safeSettle({ downloadUrl, storagePath });
          } catch (err) {
            console.warn('Failed to retrieve download URL, using local fallback:', err);
            isStorageReachable = false;
            safeSettle({
              downloadUrl: URL.createObjectURL(file),
              storagePath
            });
          }
        }
      );
    } catch (err) {
      console.warn('Storage upload initiation error, fallback to local URL:', err);
      isStorageReachable = false;
      safeSettle({
        downloadUrl: URL.createObjectURL(file),
        storagePath
      });
    }
  });
}

export async function savePlan(projectId: string, plan: PlanDocument): Promise<void> {
  const current = getLocalPlans(projectId);
  const updated = [plan, ...current.filter(p => p.id !== plan.id)];
  localStorage.setItem(LOCAL_STORAGE_PLANS_PREFIX + projectId, JSON.stringify(updated));
  notifyPlansSubscribers(projectId, updated);

  try {
    const pRef = doc(db, 'projects', projectId, 'plans', plan.id);
    await setDoc(pRef, plan, { merge: true });
    await updateDoc(doc(db, 'projects', projectId), { plansCount: updated.length });
  } catch (err: any) {
    console.warn('Firestore savePlan error:', err.message);
  }
}

export async function updatePlanFloor(projectId: string, planId: string, newFloor: PlanLevel): Promise<void> {
  const current = getLocalPlans(projectId);
  const updated = current.map(p => p.id === planId ? { ...p, floor: newFloor, level: newFloor } : p);
  localStorage.setItem(LOCAL_STORAGE_PLANS_PREFIX + projectId, JSON.stringify(updated));
  notifyPlansSubscribers(projectId, updated);

  try {
    const pRef = doc(db, 'projects', projectId, 'plans', planId);
    await updateDoc(pRef, { floor: newFloor, level: newFloor });
  } catch (err: any) {
    console.warn('Firestore updatePlanFloor error:', err.message);
  }
}

export async function deletePlan(projectId: string, planId: string): Promise<void> {
  const current = getLocalPlans(projectId);
  const updated = current.filter(p => p.id !== planId);
  localStorage.setItem(LOCAL_STORAGE_PLANS_PREFIX + projectId, JSON.stringify(updated));
  notifyPlansSubscribers(projectId, updated);

  try {
    const pRef = doc(db, 'projects', projectId, 'plans', planId);
    await deleteDoc(pRef);
    await updateDoc(doc(db, 'projects', projectId), { plansCount: updated.length });
  } catch (err: any) {
    console.warn('Firestore deletePlan error:', err.message);
  }
}

// Mutators & Project Creation
export async function createProject(
  project: Project,
  positions: Partial<Position>[] = [],
  rooms: Room[] = [],
  plans: PlanDocument[] = []
): Promise<void> {
  const updatedProject: Project = {
    ...project,
    plansCount: plans.length,
    plans: plans
  };

  // Update local list first
  const existing = getLocalProjects().filter(p => p.id !== project.id);
  const updatedProjects = [updatedProject, ...existing];
  saveLocalProjects(updatedProjects);

  // Save positions, rooms, and plans locally
  if (positions.length > 0) {
    localStorage.setItem(LOCAL_STORAGE_POSITIONS_PREFIX + project.id, JSON.stringify(positions));
    notifyPositionsSubscribers(project.id, positions as Position[]);
  }
  if (rooms.length > 0) {
    localStorage.setItem(LOCAL_STORAGE_ROOMS_PREFIX + project.id, JSON.stringify(rooms));
    notifyRoomsSubscribers(project.id, rooms);
  }
  if (plans.length > 0) {
    localStorage.setItem(LOCAL_STORAGE_PLANS_PREFIX + project.id, JSON.stringify(plans));
    notifyPlansSubscribers(project.id, plans);
  }

  // Attempt Firestore sync
  try {
    const projectRef = doc(db, 'projects', project.id);
    await setDoc(projectRef, cleanForFirestore(updatedProject), { merge: true });

    // High-speed Chunked Batch-Write to both /positions AND /items (max 500 ops per batch)
    const POS_CHUNK = 200; // 200 pos * 2 refs = 400 operations
    for (let i = 0; i < positions.length; i += POS_CHUNK) {
      const chunk = positions.slice(i, i + POS_CHUNK);
      const batch = writeBatch(db);
      for (const pos of chunk) {
        if (!pos.id) continue;
        const pRef = doc(db, 'projects', project.id, 'positions', pos.id);
        const iRef = doc(db, 'projects', project.id, 'items', pos.id);
        batch.set(pRef, cleanForFirestore(pos), { merge: true });
        batch.set(iRef, cleanForFirestore({
          id: pos.id,
          oz: pos.posNr,
          posNr: pos.posNr,
          text: pos.shortText,
          shortText: pos.shortText,
          qu: pos.qu,
          unit: pos.qu,
          qty: pos.qty,
          quantity: pos.qty,
          unitPrice: pos.unitPrice || 0,
          group: pos.group,
          updatedAt: pos.updatedAt || new Date().toISOString()
        }), { merge: true });
      }
      await batch.commit();
    }

    // High-speed batch write for rooms and plans
    if (rooms.length > 0 || plans.length > 0) {
      const roomPlanBatch = writeBatch(db);
      for (const r of rooms) {
        const rRef = doc(db, 'projects', project.id, 'rooms', r.id);
        roomPlanBatch.set(rRef, cleanForFirestore(r), { merge: true });
      }
      for (const plan of plans) {
        const planRef = doc(db, 'projects', project.id, 'plans', plan.id);
        roomPlanBatch.set(planRef, cleanForFirestore(plan), { merge: true });
      }
      await roomPlanBatch.commit();
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
    const POS_CHUNK = 200;
    for (let i = 0; i < positions.length; i += POS_CHUNK) {
      const chunk = positions.slice(i, i + POS_CHUNK);
      const batch = writeBatch(db);
      for (const pos of chunk) {
        if (!pos.id) continue;
        const ref = doc(db, 'projects', projectId, 'positions', pos.id);
        const iRef = doc(db, 'projects', projectId, 'items', pos.id);
        batch.set(ref, pos, { merge: true });
        batch.set(iRef, {
          id: pos.id,
          oz: pos.posNr,
          posNr: pos.posNr,
          text: pos.shortText,
          shortText: pos.shortText,
          qu: pos.qu,
          unit: pos.qu,
          qty: pos.qty,
          quantity: pos.qty,
          unitPrice: pos.unitPrice || 0,
          group: pos.group,
          updatedAt: pos.updatedAt || new Date().toISOString()
        }, { merge: true });
      }
      await batch.commit();
    }
    await updateDoc(doc(db, 'projects', projectId), { totalPositions: mergedList.length });
  } catch (err: any) {
    console.warn('Firestore savePositionsBatch error:', err.message);
  }
}

export async function addPositionDeliveredQty(projectId: string, positionIdOrPosNr: string, additionalQty: number, qu?: string) {
  const currentSaved = localStorage.getItem(LOCAL_STORAGE_POSITIONS_PREFIX + projectId);
  const currentList: Position[] = currentSaved ? JSON.parse(currentSaved) : [];
  let matchedId = positionIdOrPosNr;
  let found = false;

  const targetKey = positionIdOrPosNr.toLowerCase().trim();

  const updated = currentList.map(p => {
    if (
      p.id === positionIdOrPosNr || 
      p.posNr === positionIdOrPosNr || 
      (p.shortText && p.shortText.toLowerCase().trim() === targetKey)
    ) {
      matchedId = p.id;
      found = true;
      return {
        ...p,
        deliveredQty: (Number(p.deliveredQty) || Number(p.qty) || 0) + additionalQty,
      };
    }
    return p;
  });

  if (!found && positionIdOrPosNr) {
    matchedId = `pos_extra_${Date.now()}`;
    const newPos: Position = {
      id: matchedId,
      projectId,
      posNr: 'Sonder-Mat',
      group: 'Sonderbedarf',
      shortText: positionIdOrPosNr,
      qty: 0,
      deliveredQty: additionalQty,
      qu: qu || 'Stk',
      unitPrice: 0,
    };
    updated.push(newPos);
  }

  localStorage.setItem(LOCAL_STORAGE_POSITIONS_PREFIX + projectId, JSON.stringify(updated));

  try {
    const target = updated.find(p => p.id === matchedId);
    if (target) {
      const ref = doc(db, 'projects', projectId, 'positions', target.id);
      await setDoc(ref, target, { merge: true });
    }
  } catch (err: any) {
    console.warn('Firestore addPositionDeliveredQty error:', err.message);
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

export async function createAddendum(projectId: string, addendumData: Partial<Addendum>): Promise<void> {
  const addId = addendumData.id || `add_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
  const now = new Date().toISOString();
  const payload: Addendum = {
    id: addId,
    projectId,
    roomId: addendumData.roomId || 'allgemein',
    roomName: addendumData.roomName || 'Baustelle',
    type: addendumData.type || 'material',
    title: addendumData.title || 'Mehrbedarf',
    description: addendumData.description || '',
    quantity: addendumData.quantity || '1',
    qu: addendumData.qu || 'Stk',
    requestedBy: addendumData.requestedBy || 'Projektleiter',
    status: (addendumData.status as any) || 'pending',
    note: addendumData.note || '',
    signature: addendumData.signature || null,
    signatureUrl: addendumData.signatureUrl || undefined,
    photoUrls: addendumData.photoUrls || [],
    createdAt: addendumData.createdAt || now,
    itemOz: addendumData.itemOz,
    materialId: addendumData.materialId,
    isOrdered: addendumData.isOrdered,
    isUnclear: addendumData.isUnclear,
  };

  try {
    await setDoc(doc(db, 'projects', projectId, 'addendums', addId), payload, { merge: true });
    await setDoc(doc(db, 'addendums', addId), payload, { merge: true });
  } catch (err: any) {
    console.warn('Firestore createAddendum error:', err.message);
  }
}

export async function updateAddendumStatus(
  addendumId: string, 
  status: 'approved' | 'rejected' | 'pending',
  projectId?: string,
  extraData?: Partial<Addendum>
): Promise<void> {
  const payload = {
    status,
    updatedAt: new Date().toISOString(),
    ...(extraData || {}),
  };

  try {
    const ref = doc(db, 'addendums', addendumId);
    await setDoc(ref, payload, { merge: true });
  } catch (err: any) {
    console.warn('Firestore updateAddendumStatus global error:', err.message);
  }

  if (projectId) {
    try {
      const projRef = doc(db, 'projects', projectId, 'addendums', addendumId);
      await setDoc(projRef, payload, { merge: true });
    } catch (err: any) {
      console.warn('Firestore updateAddendumStatus project error:', err.message);
    }
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
  notifyAlertsSubscribers(projectId, updated);

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

export async function deleteAlert(projectId: string, alertId: string) {
  const saved = localStorage.getItem(LOCAL_STORAGE_ALERTS_PREFIX + projectId);
  const currentList: Alert[] = saved ? JSON.parse(saved) : (projectId === DEFAULT_PROJECT_ID ? MOCK_ALERTS : []);
  const updated = currentList.filter(a => a.id !== alertId);
  localStorage.setItem(LOCAL_STORAGE_ALERTS_PREFIX + projectId, JSON.stringify(updated));
  notifyAlertsSubscribers(projectId, updated);

  try {
    const ref = doc(db, 'projects', projectId, 'alerts', alertId);
    await deleteDoc(ref);
  } catch (err: any) {
    console.warn('Firestore deleteAlert error:', err.message);
  }
}

export async function createAlert(projectId: string, alert: Alert) {
  const saved = localStorage.getItem(LOCAL_STORAGE_ALERTS_PREFIX + projectId);
  const currentList: Alert[] = saved ? JSON.parse(saved) : [];
  const updated = [alert, ...currentList.filter(a => a.id !== alert.id)];
  localStorage.setItem(LOCAL_STORAGE_ALERTS_PREFIX + projectId, JSON.stringify(updated));
  notifyAlertsSubscribers(projectId, updated);

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
  completedBy: string = 'Florian Buck (Projektleiter)'
) {
  const now = new Date().toISOString();
  const saved = localStorage.getItem(LOCAL_STORAGE_ROOMS_PREFIX + projectId);
  const currentList: Room[] = saved ? JSON.parse(saved) : [];
  const updated = currentList.map(r => {
    if (r.id === roomId) {
      const newPct = isCompleted ? 100 : Math.min(90, Math.max(25, ((r as any).pct || r.progressPercent || 50) - 10));
      return {
        ...r,
        status: (isCompleted ? 'completed' : 'in_progress') as 'completed' | 'in_progress',
        isCompleted: isCompleted,
        pct: newPct,
        progressPercent: newPct,
        completedAt: isCompleted ? now : undefined,
        completedBy: isCompleted ? completedBy : undefined,
        unlockedAt: !isCompleted ? now : undefined,
        unlockedBy: !isCompleted ? completedBy : undefined,
        updatedAt: now,
      };
    }
    return r;
  });
  localStorage.setItem(LOCAL_STORAGE_ROOMS_PREFIX + projectId, JSON.stringify(updated));

  try {
    const ref = doc(db, 'projects', projectId, 'rooms', roomId);
    await updateDoc(ref, {
      status: isCompleted ? 'completed' : 'in_progress',
      isCompleted: isCompleted,
      progressPercent: isCompleted ? 100 : 50,
      pct: isCompleted ? 100 : 50,
      completedAt: isCompleted ? now : null,
      completedBy: isCompleted ? completedBy : null,
      unlockedAt: !isCompleted ? now : null,
      unlockedBy: !isCompleted ? completedBy : null,
      updatedAt: now,
    });
  } catch (err: any) {
    console.warn('Firestore completeRoom error:', err.message);
  }
}

/**
 * Resolves the true actual installed quantity for a material in a room:
 * 1. Checks if explicitly set or overridden on the material (mat.actualQty)
 * 2. Checks room.completionDelta or the latest room_completion booking's deltaSummary
 * 3. Falls back to direct in-progress bookings (excluding completion bookings)
 */
export function isRoomMatch(
  room: { id?: string; code?: string; name?: string } | null,
  item: { roomId?: string; roomName?: string } | null
): boolean {
  if (!room || !item) return false;
  if (item.roomId) {
    return item.roomId === room.id || item.roomId === room.code;
  }
  if (item.roomName && room.name) {
    return item.roomName.toLowerCase().trim() === room.name.toLowerCase().trim();
  }
  return false;
}

export function getMaterialActualQty(
  mat: { positionId?: string; posNr?: string; plannedQty?: number; actualQty?: number; id?: string },
  room: { id?: string; code?: string; name?: string; status?: string; isCompleted?: boolean; completionDelta?: any[] } | null,
  bookings: Booking[] = []
): number {
  if (!room || !mat) return 0;

  // 1. If explicitly edited/saved on the material
  if (mat.actualQty !== undefined && mat.actualQty !== null) {
    return Number(mat.actualQty);
  }

  // 2. Check room's completionDelta or the latest room_completion booking
  const completionBookings = bookings
    .filter(b => 
      isRoomMatch(room, b) && 
      (b.type === 'room_completion' || b.itemId === 'room_completion')
    )
    .sort((a, b) => {
      const timeA = new Date(a.createdAt || a.timestamp || 0).getTime() || parseInt(a.id.split('_')[1] || '0', 10);
      const timeB = new Date(b.createdAt || b.timestamp || 0).getTime() || parseInt(b.id.split('_')[1] || '0', 10);
      return timeB - timeA;
    });

  const latestCompletion = completionBookings[0];
  const deltaList = (room as any).completionDelta?.length 
    ? (room as any).completionDelta 
    : ((latestCompletion as any)?.deltaSummary || []);

  if (Array.isArray(deltaList) && deltaList.length > 0) {
    const found = deltaList.find((d: any) => 
      (d.pos && mat.posNr && d.pos === mat.posNr) ||
      (d.posNr && mat.posNr && d.posNr === mat.posNr) ||
      (d.materialId && mat.positionId && d.materialId === mat.positionId) ||
      (d.positionId && mat.positionId && d.positionId === mat.positionId) ||
      (d.materialId && (mat as any).id && d.materialId === (mat as any).id)
    );
    if (found && found.installedQty !== undefined) {
      return Number(found.installedQty);
    }
  }

  // 3. For rooms without completion (in progress), sum direct non-completion bookings
  const directBookings = bookings.filter(b => 
    isRoomMatch(room, b) &&
    b.type !== 'room_completion' &&
    b.itemId !== 'room_completion' &&
    (
      (b.positionId && mat.positionId && b.positionId === mat.positionId) ||
      (b.positionNr && mat.posNr && b.positionNr === mat.posNr) ||
      (b.itemOz && mat.posNr && b.itemOz === mat.posNr) ||
      (b.itemId && mat.positionId && b.itemId === mat.positionId)
    )
  );

  if (directBookings.length > 0) {
    // If an alert booking exists, it represents an over-consumption event where:
    // - requestedTotal is the absolute total installed in the room, OR
    // - quantity/exceededBy is the excess delta on top of plannedQty.
    const alertBooking = directBookings.find(b => 
      b.type === 'over_consumption_alert' || 
      (b as any).isAlert || 
      (b as any).requestedTotal !== undefined
    );

    if (alertBooking) {
      if ((alertBooking as any).requestedTotal !== undefined && Number((alertBooking as any).requestedTotal) > 0) {
        return Number((alertBooking as any).requestedTotal);
      }
      if ((alertBooking as any).exceededBy !== undefined && Number((alertBooking as any).exceededBy) > 0) {
        return (Number(mat.plannedQty) || 0) + Number((alertBooking as any).exceededBy);
      }
      if (alertBooking.type === 'over_consumption_alert' && alertBooking.quantity) {
        return (Number(mat.plannedQty) || 0) + Number(alertBooking.quantity);
      }
    }

    return directBookings.reduce((sum, b) => sum + (Number(b.quantity) || 0), 0);
  }

  return 0;
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
    role: 'projektleiter',
    email: 'f.buck@burk-haustechnik.de',
    password: 'Bauleiter2026!',
    phone: '+49 171 1234567',
    status: 'active',
    createdAt: '2026-02-01T09:00:00.000Z'
  },
  {
    id: 'user_bl_2',
    name: 'Michael Weber',
    role: 'projektleiter',
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

/**
 * Normalizes and deduplicates user lists by canonical person identity (normalized name).
 * Combines richer information (email, phone, pin, role, project assignments) and ensures
 * each person appears exactly once in the entire application.
 */
export function normalizeAndDeduplicateUsers(users: User[]): User[] {
  const byName = new Map<string, User>();

  for (const user of users) {
    if (!user || !user.name) continue;
    const key = user.name.trim().toLowerCase();
    const existing = byName.get(key);

    if (!existing) {
      byName.set(key, { ...user });
    } else {
      const mergedAssignments = Array.from(new Set([
        ...(existing.assignedProjectIds || []),
        ...(user.assignedProjectIds || [])
      ]));

      // Keep standard prefixed ID if available (e.g. user_mont_1 over slug)
      const keepExistingId = Boolean(existing.id && existing.id.startsWith('user_'));
      const finalId = keepExistingId ? existing.id : (user.id || existing.id);

      const merged: User = {
        ...existing,
        ...user,
        id: finalId,
        name: existing.name || user.name,
        role: existing.role || user.role,
        email: existing.email || user.email || '',
        phone: existing.phone || user.phone || '',
        pin: existing.pin || user.pin,
        defaultLanguage: existing.defaultLanguage || user.defaultLanguage || 'de',
        assignedProjectIds: mergedAssignments,
        status: existing.status || user.status || 'active'
      };

      byName.set(key, merged);
    }
  }

  return Array.from(byName.values());
}

export function getLocalUsers(): User[] {
  try {
    const saved = localStorage.getItem(LOCAL_STORAGE_USERS_KEY);
    if (saved) {
      const parsed = JSON.parse(saved);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return normalizeAndDeduplicateUsers([...MOCK_USERS, ...parsed]);
      }
    }
  } catch (e) {
    console.warn('Error reading users from localStorage:', e);
  }
  return normalizeAndDeduplicateUsers(MOCK_USERS);
}

export function listenToUsers(callback: (users: User[]) => void) {
  // Synchronous immediate delivery
  callback(getLocalUsers());

  const colRef = collection(db, 'users');
  return onSnapshot(colRef, (snap) => {
    if (!snap.empty) {
      const list = snap.docs.map(d => ({ id: d.id, ...d.data() }) as User);
      const merged = normalizeAndDeduplicateUsers([...MOCK_USERS, ...list]);
      localStorage.setItem(LOCAL_STORAGE_USERS_KEY, JSON.stringify(merged));
      callback(merged);
    } else {
      callback(getLocalUsers());
    }
  }, () => {
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
    await setDoc(ref, { pin }, { merge: true });
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
    await setDoc(ref, cleanForFirestore({
      ...partial,
      updatedAt: new Date().toISOString()
    }), { merge: true });
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


