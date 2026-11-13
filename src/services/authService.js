import AsyncStorage from '@react-native-async-storage/async-storage';
import NetInfo from '@react-native-community/netinfo';
import { signInWithCustomToken, onAuthStateChanged, signOut } from 'firebase/auth';
import { doc, getDoc, setDoc, collection, getDocs, query, where } from 'firebase/firestore';
import { auth, db } from './firebase';
import { redeemInviteApi, fetchAssignedProjectsApi, getApiBaseUrl } from './apiService';

const USER_KEY = 'ttapp_active_monteur';
const TENANT_KEY = 'ttapp_tenant_id';
const BRANDING_CACHE_PREFIX = '@ttapp:branding:';
const LOCKOUT_KEYS = {
  ATTEMPTS: 'ttapp_pin_failed_attempts',
  LOCKED_UNTIL: 'ttapp_pin_locked_until',
};

// Seed monteurs (legacy fallback for offline mock projects)
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

// Available construction projects (legacy mock fallback)
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
];

/**
 * Check connectivity independently without circular dependency
 */
async function isOnline() {
  try {
    const net = await NetInfo.fetch();
    return !!(net.isConnected && net.isInternetReachable !== false);
  } catch {
    return false;
  }
}

/**
 * Get active tenant ID
 */
export async function getTenantId() {
  try {
    return await AsyncStorage.getItem(TENANT_KEY);
  } catch {
    return null;
  }
}

/**
 * Load the tenant logo and colors configured in the admin, with an offline cache.
 */
export async function loadTenantBranding(tenantId) {
  if (!tenantId) return null;
  const cacheKey = `${BRANDING_CACHE_PREFIX}${tenantId}`;
  try {
    const apiBase = await getApiBaseUrl();
    const response = await fetch(`${apiBase}/public/branding/${encodeURIComponent(tenantId)}`);
    if (!response.ok) throw new Error(`BRANDING_${response.status}`);
    const data = await response.json();
    if (data.tenantId !== tenantId) throw new Error('BRANDING_TENANT_MISMATCH');
    const apiOrigin = apiBase.replace(/\/api$/, '');
    const logoUrl = data.logoUrl
      ? (data.logoUrl.startsWith('http') ? data.logoUrl : `${apiOrigin}${data.logoUrl}`)
      : null;
    let logoMimeType = '';
    if (logoUrl) {
      try {
        const logoResponse = await fetch(logoUrl, { method: 'HEAD' });
        logoMimeType = logoResponse.headers.get('content-type') || '';
      } catch {}
    }
    const branding = {
      name: data.name || tenantId,
      logoUrl,
      logoMimeType,
      logoZoom: Number(data.logoZoom) || 1,
      primaryColor: /^#[0-9a-f]{6}$/i.test(data.primaryColor || '') ? data.primaryColor : null,
      secondaryColor: /^#[0-9a-f]{6}$/i.test(data.secondaryColor || '') ? data.secondaryColor : null,
    };
    await AsyncStorage.setItem(cacheKey, JSON.stringify(branding)).catch(() => {});
    return branding;
  } catch (error) {
    console.warn('Could not load tenant branding:', error?.message);
    try {
      const cached = await AsyncStorage.getItem(cacheKey);
      return cached ? JSON.parse(cached) : null;
    } catch {
      return null;
    }
  }
}

/**
 * Set active tenant ID
 */
export async function setTenantId(tenantId) {
  try {
    if (tenantId) {
      await AsyncStorage.setItem(TENANT_KEY, tenantId);
    } else {
      await AsyncStorage.removeItem(TENANT_KEY);
    }
  } catch (e) {
    console.warn('Error saving tenant ID:', e);
  }
}

/**
 * Check if the device has been activated with a valid tenant & monteur profile
 */
export async function isDeviceActivated() {
  try {
    const [tenantId, monteur] = await Promise.all([
      getTenantId(),
      getActiveMonteur(),
    ]);
    return !!(tenantId && monteur);
  } catch {
    return false;
  }
}

/**
 * Activate device using invite code or QR token
 * 1. Redeem invite at Express backend -> gets { customToken, tenantId, ... }
 * 2. Authenticate Firebase Auth via signInWithCustomToken
 * 3. Load member profile from Firestore (tenants/:tenantId/members/:uid)
 * 4. Fetch assigned projects via backend API and cache them
 */
export async function activateDeviceWithInvite({ code, qrToken }) {
  // 1. Redeem invite at backend
  const redeemResult = await redeemInviteApi({ code, qrToken });
  const { customToken, tenantId } = redeemResult;

  if (!customToken || !tenantId) {
    throw new Error('INVITE_INVALID_RESPONSE');
  }

  // 2. Sign in with Firebase Custom Token
  const userCredential = await signInWithCustomToken(auth, customToken);
  const user = userCredential.user;
  const uid = user.uid;

  // 3. Fetch member data from Firestore tenants/:tenantId/members/:uid
  let memberData = null;
  try {
    const memberDoc = await getDoc(doc(db, 'tenants', tenantId, 'members', uid));
    if (memberDoc.exists()) {
      memberData = memberDoc.data();
    }
  } catch (err) {
    console.warn('Could not read tenant member doc directly:', err?.message);
  }

  // 4. Build Monteur profile
  const monteur = {
    id: uid,
    uid: uid,
    name: memberData?.displayName || user.displayName || 'Monteur',
    email: memberData?.email || user.email || '',
    role: memberData?.role || 'monteur',
    defaultLanguage: memberData?.defaultLanguage || 'de',
    assignedProjectIds: Array.isArray(memberData?.assignedProjectIds) ? memberData.assignedProjectIds : [],
    tenantId,
  };

  // 5. Persist tenant & monteur locally
  await Promise.all([
    setTenantId(tenantId),
    AsyncStorage.setItem(USER_KEY, JSON.stringify(monteur)),
  ]);

  // 6. Fetch and cache assigned projects via backend API
  let projects = [];
  try {
    const idToken = await user.getIdToken();
    projects = await fetchAssignedProjectsApi(tenantId, idToken);
    const cacheKey = `@ttapp:projects:${tenantId}:${uid}`;
    await AsyncStorage.setItem(cacheKey, JSON.stringify(projects));
  } catch (projErr) {
    console.warn('Could not fetch initial projects from API:', projErr?.message);
  }

  return {
    success: true,
    tenantId,
    monteur,
    projects,
  };
}

/**
 * Load assigned projects for tenant & monteur (online via Backend API, fallback to cache)
 */
export async function loadAssignedProjects(tenantId, monteur) {
  const tId = tenantId || (await getTenantId());
  const activeUser = monteur || (await getActiveMonteur());

  if (!tId || !activeUser?.id) return [];

  const cacheKey = `@ttapp:projects:${tId}:${activeUser.id}`;

  const online = await isOnline();
  if (online && auth.currentUser) {
    try {
      const idToken = await auth.currentUser.getIdToken();
      const projects = await fetchAssignedProjectsApi(tId, idToken);
      if (Array.isArray(projects)) {
        await AsyncStorage.setItem(cacheKey, JSON.stringify(projects));
        return projects;
      }
    } catch (e) {
      console.warn('API fetch projects error, using cached projects:', e?.message);
    }
  }

  // Offline / Cache fallback
  try {
    const cachedRaw = await AsyncStorage.getItem(cacheKey);
    if (cachedRaw) {
      const parsed = JSON.parse(cachedRaw);
      if (Array.isArray(parsed) && parsed.length > 0) return parsed;
    }
  } catch {}

  // Fallback for legacy mode without tenant
  if (!tId) {
    const legacyRaw = await AsyncStorage.getItem('ttapp_all_projects');
    if (legacyRaw) {
      const parsed = JSON.parse(legacyRaw);
      return parsed.filter((p) => isUserAssignedToProject(activeUser, p));
    }
  }

  return [];
}

/**
 * Restore persistent session on app start without requiring re-activation
 */
export async function restoreSession() {
  const [tenantId, monteur] = await Promise.all([
    getTenantId(),
    getActiveMonteur(),
  ]);

  if (!tenantId || !monteur) {
    return {
      isActivated: false,
      tenantId: null,
      monteur: null,
      projects: [],
    };
  }

  // Ensure Firebase Auth state is settled (wait up to 2.5s if initializing)
  if (!auth.currentUser) {
    await new Promise((resolve) => {
      const timeout = setTimeout(() => resolve(), 2500);
      const unsubscribe = onAuthStateChanged(auth, (user) => {
        clearTimeout(timeout);
        unsubscribe();
        resolve(user);
      });
    });
  }

  // Load projects
  const projects = await loadAssignedProjects(tenantId, monteur);

  return {
    isActivated: true,
    tenantId,
    monteur,
    projects,
  };
}

/**
 * Logout device / reset activation (with protection)
 */
export async function logoutDevice() {
  try {
    await signOut(auth).catch(() => {});
    await Promise.all([
      AsyncStorage.removeItem(USER_KEY),
      AsyncStorage.removeItem(TENANT_KEY),
      resetPinLockout(),
    ]);
  } catch (e) {
    console.warn('Error during logout:', e);
  }
}

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

    if (lockedUntil > 0 && lockedUntil <= now) {
      await resetPinLockout();
    }

    const rawAttempts = await AsyncStorage.getItem(LOCKOUT_KEYS.ATTEMPTS);
    const attempts = rawAttempts ? parseInt(rawAttempts, 10) : 0;
    return { isLocked: false, remainingMinutes: 0, failedAttempts: attempts };
  } catch {
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
      const lockDurationMs = 30 * 60 * 1000;
      const lockedUntil = Date.now() + lockDurationMs;
      await AsyncStorage.setItem(LOCKOUT_KEYS.LOCKED_UNTIL, String(lockedUntil));
      await AsyncStorage.setItem(LOCKOUT_KEYS.ATTEMPTS, '3');
      return { isLocked: true, remainingMinutes: 30, failedAttempts: 3 };
    } else {
      await AsyncStorage.setItem(LOCKOUT_KEYS.ATTEMPTS, String(nextAttempts));
      return { isLocked: false, remainingMinutes: 0, failedAttempts: nextAttempts };
    }
  } catch {
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
  } catch {}
}

/**
 * Checks whether a user/monteur is authorized to access a project
 */
export function isUserAssignedToProject(monteur, project) {
  if (!monteur || !project) return false;

  if (monteur.role === 'admin' || monteur.role === 'superadmin') {
    return true;
  }

  const monteurId = String(monteur.id || monteur.uid || '').trim().toLowerCase();
  const rawName = String(monteur.name || '').trim();
  const monteurName = rawName.toLowerCase();
  const monteurSlug = monteurName.replace(/\s+/g, '-');

  // Check project settings: assignedMonteurIds
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

  // Check legacy / alternative project fields
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

  // Check user document assignedProjectIds
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
 * Authenticate by PIN (legacy fallback)
 */
export async function authenticateByPin(enteredPin) {
  const cleanPin = String(enteredPin).trim();
  if (cleanPin.length !== 4) {
    return { success: false, reason: 'invalid_length' };
  }

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

  // Local / seed fallback
  const cachedMonteursRaw = await AsyncStorage.getItem('ttapp_known_monteurs');
  const knownList = cachedMonteursRaw ? JSON.parse(cachedMonteursRaw) : SEED_MONTEURS;
  monteur = knownList.find((m) => String(m.pin) === cleanPin);

  const cachedProjectsRaw = await AsyncStorage.getItem('ttapp_all_projects');
  allProjects = cachedProjectsRaw ? JSON.parse(cachedProjectsRaw) : AVAILABLE_PROJECTS;

  if (!monteur) {
    const failResult = await recordFailedPinAttempt();
    return {
      success: false,
      reason: failResult.isLocked ? 'locked' : 'wrong_pin',
      failedAttempts: failResult.failedAttempts,
      remainingMinutes: failResult.remainingMinutes,
    };
  }

  await resetPinLockout();
  await AsyncStorage.setItem(USER_KEY, JSON.stringify(monteur));
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
  } catch {}
}

export async function verifyPin(enteredPin) {
  const result = await authenticateByPin(enteredPin);
  return result.success;
}

export async function syncMonteurToFirebase(monteur, tenantId) {
  if (!monteur || !monteur.id) return;
  try {
    const tId = tenantId || monteur.tenantId || (await getTenantId());
    if (tId && monteur.projectId) {
      const monteurRef = doc(db, 'tenants', tId, 'projects', monteur.projectId, 'monteurs', monteur.id);
      await setDoc(monteurRef, {
        id: monteur.id,
        name: monteur.name,
        role: monteur.role || 'monteur',
        lastSeenAt: new Date().toISOString(),
      }, { merge: true });
    }
  } catch (err) {
    console.warn('Could not sync monteur to Firebase:', err.message);
  }
}
