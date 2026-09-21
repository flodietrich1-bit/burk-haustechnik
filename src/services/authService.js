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
    assignedProjectIds: ['gemeindehaus-bavendorf', 'hallenbad-weingarten'],
    projectIds: ['gemeindehaus-bavendorf', 'hallenbad-weingarten'],
    role: 'monteur',
    defaultLanguage: 'de',
  },
  {
    id: 'user_mont_1',
    name: 'Ion Popescu',
    pin: '1234',
    assignedProjectIds: ['hallenbad-weingarten'],
    projectIds: ['hallenbad-weingarten'],
    role: 'monteur',
    defaultLanguage: 'ro',
  },
  {
    id: 'monteur_ion_alt',
    name: 'Ion Popescu',
    pin: '4321',
    assignedProjectIds: ['hallenbad-weingarten'],
    projectIds: ['hallenbad-weingarten'],
    role: 'monteur',
    defaultLanguage: 'ro',
  },
  {
    id: 'user_mont_2',
    name: 'Tomasz Novak',
    pin: '4821',
    assignedProjectIds: ['hallenbad-weingarten'],
    projectIds: ['hallenbad-weingarten'],
    role: 'monteur',
    defaultLanguage: 'pl',
  },
  {
    id: 'user_mont_3',
    name: 'Marko Horvat',
    pin: '9012',
    assignedProjectIds: ['hallenbad-weingarten'],
    projectIds: ['hallenbad-weingarten'],
    role: 'monteur',
    defaultLanguage: 'hr',
  },
  {
    id: 'monteur_florian',
    name: 'Florian Dietrich',
    pin: '1234',
    assignedProjectIds: ['hallenbad-weingarten', 'wohnanlage-ravensburg'],
    projectIds: ['hallenbad-weingarten', 'wohnanlage-ravensburg'],
    role: 'monteur',
    defaultLanguage: 'de',
  },
  {
    id: 'monteur_thomas',
    name: 'Thomas Weber',
    pin: '9876',
    assignedProjectIds: ['hallenbad-weingarten', 'schulzentrum-wangen'],
    projectIds: ['hallenbad-weingarten', 'schulzentrum-wangen'],
    role: 'monteur',
    defaultLanguage: 'de',
  },
  {
    id: 'user_bl_1',
    name: 'Florian Buck',
    pin: '9999',
    assignedProjectIds: ['hallenbad-weingarten', 'wohnanlage-ravensburg', 'gemeindehaus-bavendorf'],
    projectIds: ['hallenbad-weingarten', 'wohnanlage-ravensburg', 'gemeindehaus-bavendorf'],
    role: 'bauleiter',
    defaultLanguage: 'de',
  },
  {
    id: 'monteur_burk',
    name: 'Monteur Burk',
    pin: '0000',
    assignedProjectIds: ['hallenbad-weingarten', 'wohnanlage-ravensburg', 'schulzentrum-wangen', 'gemeindehaus-bavendorf'],
    projectIds: ['hallenbad-weingarten', 'wohnanlage-ravensburg', 'schulzentrum-wangen', 'gemeindehaus-bavendorf'],
    role: 'monteur',
    defaultLanguage: 'de',
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
    id: 'gemeindehaus-bavendorf',
    name: 'Gemeindehaus Bavendorf Sanierung',
    projectNumber: '1702 / 24320-012',
    client: 'Gemeinde Bavendorf',
    location: 'Bavendorf',
    address: 'Kirchweg 4, 88213 Ravensburg-Bavendorf',
    trade: 'Heizung & Sanitär',
    projectManager: 'Florian Buck',
    calendarWeek: 27,
    totalDeliveredPercentage: 35,
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

  // Determine assigned projects for this Monteur (support both assignedProjectIds and projectIds)
  const userProjectIds = monteur.assignedProjectIds || monteur.projectIds || [];
  let assignedProjects = [];
  if (Array.isArray(userProjectIds) && userProjectIds.length > 0) {
    assignedProjects = allProjects.filter((p) => userProjectIds.includes(p.id));
    if (assignedProjects.length === 0) {
      assignedProjects = userProjectIds.map((pId) => {
        const found = AVAILABLE_PROJECTS.find((ap) => ap.id === pId);
        return (
          found || {
            id: pId,
            name: pId === 'gemeindehaus-bavendorf' ? 'Gemeindehaus Bavendorf Sanierung' : pId,
            client: 'Burk Haustechnik',
            calendarWeek: 27,
            totalDeliveredPercentage: 50,
          }
        );
      });
    }
  } else {
    // If no explicit projectIds assigned, assign default
    assignedProjects = allProjects.length > 0 ? allProjects : AVAILABLE_PROJECTS;
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
