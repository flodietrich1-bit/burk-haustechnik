import AsyncStorage from '@react-native-async-storage/async-storage';
import { doc, setDoc, collection, getDocs, query, where } from 'firebase/firestore';
import { db } from './firebase';
import { DEFAULT_PROJECT_ID, DEFAULT_PROJECT } from '../constants/initialData';
import { checkOnlineStatus } from './syncService';

const USER_KEY = 'ttapp_active_monteur';
const LOCKOUT_KEYS = {
  ATTEMPTS: 'ttapp_pin_failed_attempts',
  LOCKED_UNTIL: 'ttapp_pin_locked_until',
};

// Seed monteurs (configured via Benutzer-Admin or offline fallback)
export const SEED_MONTEURS = [
  {
    id: 'user_mont_4',
    name: 'Stefan Maier',
    pin: '5578',
    assignedProjectIds: ['proj_1789997083092', 'einfamilienhaus'],
    projectIds: ['proj_1789997083092', 'einfamilienhaus'],
    role: 'monteur',
    defaultLanguage: 'de',
  },
  {
    id: 'user_mont_1',
    name: 'Ion Popescu',
    pin: '1234',
    assignedProjectIds: ['proj_1791403908448', 'hallenbad-weingarten'],
    projectIds: ['proj_1791403908448', 'hallenbad-weingarten'],
    role: 'monteur',
    defaultLanguage: 'ro',
  },
  {
    id: 'user_mont_2',
    name: 'Tomasz Novak',
    pin: '4821',
    assignedProjectIds: [],
    projectIds: [],
    role: 'monteur',
    defaultLanguage: 'pl',
  },
  {
    id: 'user_mont_3',
    name: 'Marko Horvat',
    pin: '9012',
    assignedProjectIds: [],
    projectIds: [],
    role: 'monteur',
    defaultLanguage: 'hr',
  },
  {
    id: 'monteur_florian',
    name: 'Florian Dietrich',
    pin: '1234',
    assignedProjectIds: ['proj_1791403908448', 'hallenbad-weingarten'],
    projectIds: ['proj_1791403908448', 'hallenbad-weingarten'],
    role: 'monteur',
    defaultLanguage: 'de',
  },
  {
    id: 'user_bl_1',
    name: 'Florian Buck',
    pin: '9999',
    assignedProjectIds: ['proj_1789997083092', 'proj_1791403908448'],
    projectIds: ['proj_1789997083092', 'proj_1791403908448'],
    role: 'bauleiter',
    defaultLanguage: 'de',
  },
];

// Available construction projects
export const AVAILABLE_PROJECTS = [
  {
    id: 'proj_1789997083092',
    name: 'Einfamilienhaus',
    projectNumber: 'EFH-2026-01',
    client: 'Familie Schneider',
    location: 'Ravensburg',
    address: 'Gartenstraße 12, 88212 Ravensburg',
    trade: 'Sanitär & Heizung',
    projectManager: 'Florian Buck',
    assignedMonteurIds: ['user_mont_4'],
    calendarWeek: 27,
    totalDeliveredPercentage: 20,
  },
  {
    id: 'proj_1791403908448',
    name: 'Hallenbad Weingarten',
    projectNumber: '1638 / 24316-044',
    client: 'Stadt Weingarten',
    location: 'Weingarten',
    address: 'Brechenmacherstraße 11, 88250 Weingarten',
    trade: 'Sanitärinstallation',
    projectManager: 'Florian Buck',
    assignedMonteurIds: ['user_mont_1'],
    calendarWeek: 27,
    totalDeliveredPercentage: 42,
  },
  {
    id: 'hallenbad-weingarten',
    name: 'Hallenbad Weingarten Sanierung',
    projectNumber: '1638 / 24316-044',
    client: 'Stadt Weingarten',
    location: 'Weingarten',
    address: 'Brechenmacherstraße 11, 88250 Weingarten',
    trade: 'Sanitärinstallation',
    projectManager: 'Florian Buck',
    assignedMonteurIds: ['user_mont_1'],
    calendarWeek: 27,
    totalDeliveredPercentage: 42,
  },
];

/**
 * Check if the PIN entry is currently locked due to 3 failed attempts (30-minute block)
 */
export async function getPinLockoutStatus() {
  try {
    const rawUntil = await AsyncStorage.getItem(LOCKOUT_KEYS.LOCKED_UNTIL);
    const lockedUntil = rawUntil ? parseInt(rawUntil, 10) : 0;
    const now = Date.now();

    if (lockedUntil > now) {
      const remainingMinutes = Math.max(1, Math.ceil((lockedUntil - now) / (60 * 1000)));
      return { isLocked: true, remainingMinutes, lockedUntil };
    }

    // Auto-reset when lock period expired
    if (lockedUntil > 0 && lockedUntil <= now) {
      await resetPinLockout();
    }

    const rawAttempts = await AsyncStorage.getItem(LOCKOUT_KEYS.ATTEMPTS);
    const attempts = rawAttempts ? parseInt(rawAttempts, 10) : 0;
    return { isLocked: false, remainingMinutes: 0, failedAttempts: attempts };
  } catch (e) {
    return { isLocked: false, remainingMinutes: 0, failedAttempts: 0 };
  }
}

/**
 * Record a failed PIN attempt; blocks system for 30 minutes on the 3rd fail
 */
export async function recordFailedPinAttempt() {
  try {
    const rawAttempts = await AsyncStorage.getItem(LOCKOUT_KEYS.ATTEMPTS);
    const nextAttempts = (rawAttempts ? parseInt(rawAttempts, 10) : 0) + 1;

    if (nextAttempts >= 3) {
      const lockDurationMs = 30 * 60 * 1000; // 30 minutes
      const lockedUntil = Date.now() + lockDurationMs;
      await AsyncStorage.setItem(LOCKOUT_KEYS.LOCKED_UNTIL, String(lockedUntil));
      await AsyncStorage.setItem(LOCKOUT_KEYS.ATTEMPTS, '3');
      return { isLocked: true, remainingMinutes: 30, failedAttempts: 3 };
    } else {
      await AsyncStorage.setItem(LOCKOUT_KEYS.ATTEMPTS, String(nextAttempts));
      return { isLocked: false, remainingMinutes: 0, failedAttempts: nextAttempts };
    }
  } catch (e) {
    return { isLocked: false, remainingMinutes: 0, failedAttempts: 1 };
  }
}

/**
 * Reset failed attempts and remove security lockout
 */
export async function resetPinLockout() {
  try {
    await AsyncStorage.removeItem(LOCKOUT_KEYS.ATTEMPTS);
    await AsyncStorage.removeItem(LOCKOUT_KEYS.LOCKED_UNTIL);
  } catch (e) {}
}

/**
 * Checks whether a user/monteur is authorized to access a project according to Project Settings.
 */
export function isUserAssignedToProject(monteur, project) {
  if (!monteur || !project) return false;

  // 1. Admins have access to all projects
  if (monteur.role === 'admin') {
    return true;
  }

  const monteurId = String(monteur.id || '').trim().toLowerCase();
  const rawName = String(monteur.name || '').trim();
  const monteurName = rawName.toLowerCase();
  const monteurSlug = monteurName.replace(/\s+/g, '-');

  // 2. Check project settings: assignedMonteurIds (managed in ProjectSettingsView in ToolTime admin-web)
  if (Array.isArray(project.assignedMonteurIds) && project.assignedMonteurIds.length > 0) {
    const isAssigned = project.assignedMonteurIds.some((assignedId) => {
      if (!assignedId) return false;
      const cleanAssigned = String(assignedId).trim().toLowerCase();
      return (
        cleanAssigned === monteurId ||
        cleanAssigned === monteurSlug ||
        cleanAssigned === monteurName
      );
    });
    if (isAssigned) return true;
  }

  // 3. Check legacy / alternative project fields (monteurs, assignedUsers)
  if (Array.isArray(project.monteurs) && project.monteurs.length > 0) {
    const isAssigned = project.monteurs.some((m) => {
      if (!m) return false;
      if (typeof m === 'string') {
        const str = m.trim().toLowerCase();
        return str === monteurId || str === monteurSlug || str === monteurName;
      }
      if (typeof m === 'object') {
        return (
          String(m.id || '').trim().toLowerCase() === monteurId ||
          String(m.userId || '').trim().toLowerCase() === monteurId ||
          (m.name && String(m.name).trim().toLowerCase() === monteurName)
        );
      }
      return false;
    });
    if (isAssigned) return true;
  }

  if (Array.isArray(project.assignedUsers) && project.assignedUsers.length > 0) {
    const isAssigned = project.assignedUsers.some((uId) => {
      if (!uId) return false;
      const clean = String(uId).trim().toLowerCase();
      return clean === monteurId || clean === monteurSlug || clean === monteurName;
    });
    if (isAssigned) return true;
  }

  // 4. Check project manager / commercial manager (for bauleiter / projektleiter)
  if (
    monteur.role === 'bauleiter' ||
    monteur.role === 'projektleiter' ||
    monteur.role === 'kaufmaennisch'
  ) {
    const isLeadOrDeputy =
      (project.projectManagerId && String(project.projectManagerId).toLowerCase() === monteurId) ||
      (project.deputyProjectManagerId && String(project.deputyProjectManagerId).toLowerCase() === monteurId) ||
      (project.commercialManagerId && String(project.commercialManagerId).toLowerCase() === monteurId) ||
      (project.deputyCommercialManagerId && String(project.deputyCommercialManagerId).toLowerCase() === monteurId) ||
      (project.projectManager && String(project.projectManager).trim().toLowerCase() === monteurName) ||
      (project.deputyProjectManager && String(project.deputyProjectManager).trim().toLowerCase() === monteurName) ||
      (project.commercialManager && String(project.commercialManager).trim().toLowerCase() === monteurName) ||
      (project.deputyCommercialManager && String(project.deputyCommercialManager).trim().toLowerCase() === monteurName);
    if (isLeadOrDeputy) return true;
  }

  // 5. Check if user document itself explicitly has assignedProjectIds or projectIds
  const userProjectIds = monteur.assignedProjectIds || monteur.projectIds || [];
  if (Array.isArray(userProjectIds) && userProjectIds.length > 0) {
    const projId = String(project.id || '').trim().toLowerCase();
    const projNameSlug = String(project.name || '').trim().toLowerCase().replace(/\s+/g, '-');
    const isMatch = userProjectIds.some((pId) => {
      if (!pId) return false;
      const cleanPId = String(pId).trim().toLowerCase();
      return cleanPId === projId || cleanPId === projNameSlug;
    });
    if (isMatch) return true;
  }

  return false;
}

/**
 * Authenticate strictly by PIN without exposing user names on the lock screen.
 * Resolves the Monteur name and their assigned projects.
 */
export async function authenticateByPin(enteredPin) {
  const cleanPin = String(enteredPin).trim();
  if (cleanPin.length !== 4) {
    return { success: false, reason: 'invalid_length' };
  }

  // Check 30-minute lockout
  const lockout = await getPinLockoutStatus();
  if (lockout.isLocked) {
    return {
      success: false,
      reason: 'locked',
      remainingMinutes: lockout.remainingMinutes,
    };
  }

  let monteur = null;
  let allProjects = [];
  let firestoreProjectsFetched = false;

  // 1. Try Firestore Online Lookup
  try {
    const isOnline = await checkOnlineStatus();
    if (isOnline) {
      // Check Firestore 'users' collection (where admin-web saves users)
      let qUser = query(collection(db, 'users'), where('pin', '==', cleanPin));
      let snapUser = await getDocs(qUser);

      // If not found with string, try with numeric pin
      if (snapUser.empty && !isNaN(Number(cleanPin))) {
        qUser = query(collection(db, 'users'), where('pin', '==', Number(cleanPin)));
        snapUser = await getDocs(qUser);
      }

      // If still not found, also check 'monteurs' collection
      if (snapUser.empty) {
        qUser = query(collection(db, 'monteurs'), where('pin', '==', cleanPin));
        snapUser = await getDocs(qUser);
      }

      if (!snapUser.empty) {
        monteur = { id: snapUser.docs[0].id, ...snapUser.docs[0].data() };
      }

      // Fetch projects from Firestore
      const snapProj = await getDocs(collection(db, 'projects'));
      firestoreProjectsFetched = true;
      allProjects = snapProj.docs
        .map((d) => ({ id: d.id, ...d.data() }))
        .filter((p) => p.status !== 'deleted' && !p.isDeleted);
      await AsyncStorage.setItem('ttapp_all_projects', JSON.stringify(allProjects));
    }
  } catch (err) {
    console.warn('Firestore PIN lookup error, using local/seed fallback:', err.message);
  }

  // 2. Offline / Local Cache Fallback
  if (!monteur) {
    const cachedMonteursRaw = await AsyncStorage.getItem('ttapp_known_monteurs');
    const knownList = cachedMonteursRaw ? JSON.parse(cachedMonteursRaw) : SEED_MONTEURS;
    monteur = knownList.find((m) => String(m.pin) === cleanPin);
  }

  if (!firestoreProjectsFetched && allProjects.length === 0) {
    const cachedProjectsRaw = await AsyncStorage.getItem('ttapp_all_projects');
    const cachedList = cachedProjectsRaw ? JSON.parse(cachedProjectsRaw) : [];
    allProjects = cachedList.filter((p) => p.status !== 'deleted' && !p.isDeleted);
    if (allProjects.length === 0) {
      allProjects = AVAILABLE_PROJECTS;
    }
  }

  // 3. If PIN does not match any registered Monteur
  if (!monteur) {
    const failResult = await recordFailedPinAttempt();
    return {
      success: false,
      reason: failResult.isLocked ? 'locked' : 'wrong_pin',
      failedAttempts: failResult.failedAttempts,
      remainingMinutes: failResult.remainingMinutes,
    };
  }

  // Cache authenticated monteur locally so future offline logins have their exact profile
  try {
    const cachedMonteursRaw = await AsyncStorage.getItem('ttapp_known_monteurs');
    const list = cachedMonteursRaw ? JSON.parse(cachedMonteursRaw) : [];
    const updated = [
      monteur,
      ...list.filter((m) => m.id !== monteur.id && String(m.pin) !== String(monteur.pin)),
    ];
    await AsyncStorage.setItem('ttapp_known_monteurs', JSON.stringify(updated));
  } catch {}

  // 4. Successful PIN match!
  await resetPinLockout();
  await AsyncStorage.setItem(USER_KEY, JSON.stringify(monteur));

  // Determine assigned projects strictly according to project settings
  const assignedProjects = allProjects.filter((p) => isUserAssignedToProject(monteur, p));

  return {
    success: true,
    monteur,
    projects: assignedProjects,
  };
}

export async function getActiveMonteur() {
  try {
    const raw = await AsyncStorage.getItem(USER_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch (e) {
    console.warn('Error reading active monteur:', e);
    return null;
  }
}

/**
 * Update the stored monteur's active projectId so that syncBookings()
 * always uses the correct project for Firestore operations.
 */
export async function setActiveProjectId(projectId) {
  try {
    const raw = await AsyncStorage.getItem(USER_KEY);
    if (!raw) return;
    const monteur = JSON.parse(raw);
    monteur.projectId = projectId;
    await AsyncStorage.setItem(USER_KEY, JSON.stringify(monteur));
  } catch (e) {
    console.warn('Error updating active project ID:', e);
  }
}

export async function clearActiveMonteur() {
  try {
    await AsyncStorage.removeItem(USER_KEY);
  } catch (e) {}
}

export async function verifyPin(enteredPin) {
  const result = await authenticateByPin(enteredPin);
  return result.success;
}

export async function syncMonteurToFirebase(monteur) {
  if (!monteur || !monteur.id) return;
  try {
    const monteurRef = doc(db, 'projects', monteur.projectId || DEFAULT_PROJECT_ID, 'monteurs', monteur.id);
    await setDoc(monteurRef, {
      ...monteur,
      lastSync: new Date().toISOString(),
    }, { merge: true });
  } catch (err) {
    console.warn('Could not sync monteur to Firebase (offline or permission):', err.message);
  }
}
