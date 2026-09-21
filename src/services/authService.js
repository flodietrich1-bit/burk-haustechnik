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
    id: 'monteur_florian',
    name: 'Florian Dietrich',
    pin: '1234',
    projectIds: ['hallenbad-weingarten', 'wohnanlage-ravensburg'],
    role: 'monteur',
  },
  {
    id: 'monteur_ion',
    name: 'Ion Popescu',
    pin: '4321',
    projectIds: ['hallenbad-weingarten'],
    role: 'monteur',
  },
  {
    id: 'monteur_thomas',
    name: 'Thomas Weber',
    pin: '9876',
    projectIds: ['hallenbad-weingarten', 'schulzentrum-wangen'],
    role: 'monteur',
  },
  {
    id: 'monteur_burk',
    name: 'Monteur Burk',
    pin: '0000',
    projectIds: ['hallenbad-weingarten', 'wohnanlage-ravensburg', 'schulzentrum-wangen'],
    role: 'monteur',
  },
];

// Available construction projects
export const AVAILABLE_PROJECTS = [
  {
    id: 'hallenbad-weingarten',
    name: 'Hallenbad Weingarten Sanierung',
    projectNumber: '1638 / 24316-044',
    client: 'Stadt Weingarten',
    location: 'Weingarten',
    address: 'Brechenmacherstraße 11, 88250 Weingarten',
    trade: 'Sanitärinstallation',
    projectManager: 'Florian Buck',
    calendarWeek: 27,
    totalDeliveredPercentage: 42,
  },
  {
    id: 'wohnanlage-ravensburg',
    name: 'Wohnanlage Sonnenhof Ravensburg',
    projectNumber: '1742 / 24319-012',
    client: 'Baugenossenschaft RV',
    location: 'Ravensburg',
    address: 'Sonnenstraße 14-18, 88212 Ravensburg',
    trade: 'Heizung & Sanitär',
    projectManager: 'Markus Burk',
    calendarWeek: 27,
    totalDeliveredPercentage: 68,
  },
  {
    id: 'schulzentrum-wangen',
    name: 'Schulzentrum Wangen Neubau',
    projectNumber: '1805 / 24322-003',
    client: 'Landkreis Ravensburg',
    location: 'Wangen im Allgäu',
    address: 'Jahnstraße 5, 88239 Wangen',
    trade: 'Lüftung & Sanitär',
    projectManager: 'Stefan Eder',
    calendarWeek: 27,
    totalDeliveredPercentage: 15,
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

  // 1. Try Firestore Online Lookup
  try {
    const isOnline = await checkOnlineStatus();
    if (isOnline) {
      // Check Firestore monteurs collection
      const qMonteur = query(collection(db, 'monteurs'), where('pin', '==', cleanPin));
      const snapMonteur = await getDocs(qMonteur);
      if (!snapMonteur.empty) {
        monteur = { id: snapMonteur.docs[0].id, ...snapMonteur.docs[0].data() };
      }

      // Fetch projects
      const snapProj = await getDocs(collection(db, 'projects'));
      if (!snapProj.empty) {
        allProjects = snapProj.docs.map((d) => ({ id: d.id, ...d.data() }));
        await AsyncStorage.setItem('ttapp_all_projects', JSON.stringify(allProjects));
      }
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

  if (allProjects.length === 0) {
    const cachedProjectsRaw = await AsyncStorage.getItem('ttapp_all_projects');
    allProjects = cachedProjectsRaw ? JSON.parse(cachedProjectsRaw) : AVAILABLE_PROJECTS;
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

  // 4. Successful PIN match!
  await resetPinLockout();
  await AsyncStorage.setItem(USER_KEY, JSON.stringify(monteur));

  // Determine assigned projects for this Monteur
  let assignedProjects = [];
  if (Array.isArray(monteur.projectIds) && monteur.projectIds.length > 0) {
    assignedProjects = allProjects.filter((p) => monteur.projectIds.includes(p.id));
    if (assignedProjects.length === 0) {
      assignedProjects = allProjects.slice(0, 1);
    }
  } else {
    // If no explicit projectIds assigned, assign default
    assignedProjects = allProjects.length > 0 ? allProjects : [DEFAULT_PROJECT];
  }

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
