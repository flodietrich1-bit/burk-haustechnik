import AsyncStorage from '@react-native-async-storage/async-storage';
import * as FileSystem from 'expo-file-system';
import { INITIAL_ROOMS, INITIAL_MATERIALS, DEFAULT_PROJECT, DEFAULT_PROJECT_ID, INITIAL_PLANS } from '../constants/initialData';

// Base storage keys
const KEYS = {
  LANGUAGE: 'ttapp_selected_language',
  ROOMS: 'ttapp_cached_rooms',
  MATERIALS: 'ttapp_cached_materials',
  PROJECT: 'ttapp_cached_project',
  PLANS: 'ttapp_cached_plans',
  BOOKINGS: 'ttapp_outbox_bookings',
  ADDENDUMS: 'ttapp_outbox_addendums',
  UNCLEAR: 'ttapp_outbox_unclear',
  USER_PROFILE: 'ttapp_monteur_profile',
  LAST_SYNCED_AT: 'ttapp_last_synced_at',
};

// Ensure local proof photos & plans directories exist
const PROOFS_DIR = `${FileSystem.documentDirectory || ''}proofs/`;
export const PLANS_DIR = `${FileSystem.documentDirectory || ''}plans/`;

async function ensureProofsDir() {
  try {
    if (!FileSystem.documentDirectory) return;
    const dirInfo = await FileSystem.getInfoAsync(PROOFS_DIR);
    if (!dirInfo.exists) {
      await FileSystem.makeDirectoryAsync(PROOFS_DIR, { intermediates: true });
    }
  } catch (e) {
    console.warn('Could not create proofs directory:', e);
  }
}

export async function ensurePlansDir() {
  try {
    if (!FileSystem.documentDirectory) return;
    const dirInfo = await FileSystem.getInfoAsync(PLANS_DIR);
    if (!dirInfo.exists) {
      await FileSystem.makeDirectoryAsync(PLANS_DIR, { intermediates: true });
    }
  } catch (e) {
    console.warn('Could not create plans directory:', e);
  }
}

// -------------------------------------------------------------
// 1. Storage Context & Namespacing Helpers
// -------------------------------------------------------------
export async function getStorageContext(projectId) {
  let tenantId = null;
  let userId = null;
  let activeProjectId = projectId;
  try {
    tenantId = await AsyncStorage.getItem('ttapp_tenant_id');
    const rawMonteur = await AsyncStorage.getItem('ttapp_active_monteur');
    if (rawMonteur) {
      const m = JSON.parse(rawMonteur);
      userId = m?.id || m?.uid;
      if (!activeProjectId) {
        activeProjectId = m?.projectId || m?.assignedProjectIds?.[0];
      }
    }
  } catch {}

  return {
    tenantId,
    userId: userId || 'common',
    projectId: activeProjectId || DEFAULT_PROJECT_ID,
  };
}

function buildScopedKey(baseKey, context) {
  const { tenantId, userId, projectId } = context;
  if (tenantId) {
    return `@ttapp:${baseKey}:${tenantId}:${userId}:${projectId}`;
  }
  return `${KEYS[baseKey.toUpperCase()] || baseKey}_${projectId}`;
}

// -------------------------------------------------------------
// 2. Language Persistence
// -------------------------------------------------------------
export async function getLanguage() {
  try {
    const lang = await AsyncStorage.getItem(KEYS.LANGUAGE);
    return lang || 'de';
  } catch (e) {
    return 'de';
  }
}

export async function setLanguage(lang) {
  try {
    await AsyncStorage.setItem(KEYS.LANGUAGE, lang);
  } catch (e) {
    console.warn('Error saving language:', e);
  }
}

// -------------------------------------------------------------
// 3. Master Data (Rooms, Materials, Project, Plans)
// -------------------------------------------------------------
export async function getRooms(projectId) {
  try {
    const ctx = await getStorageContext(projectId);
    const scopedKey = buildScopedKey('rooms', ctx);
    const legacyKey = `${KEYS.ROOMS}_${ctx.projectId}`;

    let data = await AsyncStorage.getItem(scopedKey);
    if (!data && ctx.tenantId) {
      // Check legacy key if scoped not yet written
      data = await AsyncStorage.getItem(legacyKey);
    }

    if (data) {
      const parsed = JSON.parse(data);
      if (Array.isArray(parsed)) return parsed;
    }

    // STRICT RULE: No dummy initial data when active tenant is present!
    if (!ctx.tenantId && ctx.projectId === DEFAULT_PROJECT_ID) {
      const legacyData = await AsyncStorage.getItem(KEYS.ROOMS);
      if (legacyData) {
        const parsed = JSON.parse(legacyData);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
      return INITIAL_ROOMS;
    }
  } catch (e) {
    console.warn('Error reading rooms:', e);
  }
  return [];
}

export function computeRoomPercentage(room, materials = []) {
  if (!room) return 0;
  if (room.isCompleted) {
    let totalPlanned = 0;
    let totalInstalled = 0;
    if (room.plannedItems && Object.keys(room.plannedItems).length > 0) {
      Object.entries(room.plannedItems).forEach(([matId, item]) => {
        const planned = Number(item.plannedQty || 0);
        const installed = Number(item.installedQty || 0);
        if (planned > 0) {
          totalPlanned += planned;
          totalInstalled += installed;
        }
      });
    } else if (Array.isArray(room.materials) && room.materials.length > 0) {
      room.materials.forEach((m) => {
        const planned = Number(m.plannedQty || 0);
        const installed = Number(m.installedQty || 0);
        if (planned > 0) {
          totalPlanned += planned;
          totalInstalled += installed;
        }
      });
    }
    if (totalPlanned > 0) {
      return Math.max(100, Math.round((totalInstalled / totalPlanned) * 100));
    }
    return 100;
  }

  let totalPlanned = 0;
  let totalInstalled = 0;

  if (room.plannedItems && Object.keys(room.plannedItems).length > 0) {
    Object.entries(room.plannedItems).forEach(([matId, item]) => {
      const planned = Number(item.plannedQty || 0);
      const installed = Number(item.installedQty || 0);
      const draft = Number(room.draftQuantities?.[matId] || 0);
      if (planned > 0) {
        totalPlanned += planned;
        totalInstalled += (installed + draft);
      }
    });
  } else if (Array.isArray(room.materials) && room.materials.length > 0) {
    room.materials.forEach((m) => {
      const mId = m.positionId || m.id;
      const planned = Number(m.plannedQty || 0);
      const installed = Number(m.installedQty || 0);
      const draft = Number(room.draftQuantities?.[mId] || 0);
      if (planned > 0) {
        totalPlanned += planned;
        totalInstalled += (installed + draft);
      }
    });
  } else if (Array.isArray(materials) && materials.length > 0) {
    const roomMats = materials.filter((m) => {
      if (!m.assignedRoomNames || !Array.isArray(m.assignedRoomNames)) return false;
      return m.assignedRoomNames.some(
        (rn) =>
          rn.toLowerCase() === room.name.toLowerCase() ||
          rn.toLowerCase() === room.id.toLowerCase()
      );
    });

    roomMats.forEach((m) => {
      const planned = Number(m.plannedQty || 0);
      const installed = Number(m.installedQty || 0);
      const draft = Number(room.draftQuantities?.[m.id] || 0);
      if (planned > 0) {
        totalPlanned += planned;
        totalInstalled += (installed + draft);
      }
    });
  }

  if (totalPlanned === 0) return 0;
  return Math.round((totalInstalled / totalPlanned) * 100);
}

export async function saveRooms(rooms, projectId) {
  try {
    const ctx = await getStorageContext(projectId);
    const key = buildScopedKey('rooms', ctx);
    await AsyncStorage.setItem(key, JSON.stringify(rooms));
  } catch (e) {
    console.warn('Error saving rooms:', e);
  }
}

export async function updateRoom(updatedRoom, projectId) {
  try {
    const rooms = await getRooms(projectId);
    const index = rooms.findIndex((r) => r.id === updatedRoom.id);
    let newRooms;
    if (index >= 0) {
      newRooms = [...rooms];
      newRooms[index] = {
        ...newRooms[index],
        ...updatedRoom,
        updatedAt: new Date().toISOString(),
      };
    } else {
      newRooms = [...rooms, { ...updatedRoom, updatedAt: new Date().toISOString() }];
    }
    await saveRooms(newRooms, projectId);
    return newRooms;
  } catch (e) {
    console.warn('Error updating room:', e);
    return [];
  }
}

export async function getMaterials(projectId) {
  try {
    const ctx = await getStorageContext(projectId);
    const key = buildScopedKey('materials', ctx);
    const legacyKey = `${KEYS.MATERIALS}_${ctx.projectId}`;

    let data = await AsyncStorage.getItem(key);
    if (!data && ctx.tenantId) {
      data = await AsyncStorage.getItem(legacyKey);
    }

    if (data) {
      const parsed = JSON.parse(data);
      if (Array.isArray(parsed)) return parsed;
    }

    // STRICT RULE: No dummy materials for tenant projects
    if (!ctx.tenantId && ctx.projectId === DEFAULT_PROJECT_ID) {
      const legacyData = await AsyncStorage.getItem(KEYS.MATERIALS);
      if (legacyData) {
        const parsed = JSON.parse(legacyData);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
      return INITIAL_MATERIALS;
    }
  } catch (e) {
    console.warn('Error reading materials:', e);
  }
  return [];
}

export async function saveMaterials(materials, projectId) {
  try {
    const ctx = await getStorageContext(projectId);
    const key = buildScopedKey('materials', ctx);
    await AsyncStorage.setItem(key, JSON.stringify(materials));
  } catch (e) {
    console.warn('Error saving materials:', e);
  }
}

export async function getProjectInfo(projectId) {
  try {
    const ctx = await getStorageContext(projectId);
    const key = buildScopedKey('project', ctx);
    const legacyKey = `${KEYS.PROJECT}_${ctx.projectId}`;

    let data = await AsyncStorage.getItem(key);
    if (!data && ctx.tenantId) {
      data = await AsyncStorage.getItem(legacyKey);
    }

    if (data) {
      return JSON.parse(data);
    }

    if (!ctx.tenantId && ctx.projectId === DEFAULT_PROJECT_ID) {
      const legacyData = await AsyncStorage.getItem(KEYS.PROJECT);
      if (legacyData) return JSON.parse(legacyData);
      return DEFAULT_PROJECT;
    }
  } catch (e) {
    console.warn('Error reading project info:', e);
  }
  return {};
}

export async function saveProjectInfo(project, projectId) {
  try {
    const ctx = await getStorageContext(projectId || project?.id);
    const key = buildScopedKey('project', ctx);
    await AsyncStorage.setItem(key, JSON.stringify(project || {}));
  } catch (e) {
    console.warn('Error saving project info:', e);
  }
}

export async function getCachedPlans(projectId) {
  try {
    const ctx = await getStorageContext(projectId);
    const key = buildScopedKey('plans', ctx);
    const legacyKey = `${KEYS.PLANS}_${ctx.projectId}`;

    let data = await AsyncStorage.getItem(key);
    if (!data && ctx.tenantId) {
      data = await AsyncStorage.getItem(legacyKey);
    }

    if (data) {
      const parsed = JSON.parse(data);
      if (Array.isArray(parsed)) return parsed;
    }

    if (!ctx.tenantId && ctx.projectId === DEFAULT_PROJECT_ID) {
      return INITIAL_PLANS;
    }
  } catch (e) {
    console.warn('Error reading cached plans:', e);
  }
  return [];
}

export async function saveCachedPlans(plans, projectId) {
  try {
    const ctx = await getStorageContext(projectId);
    const key = buildScopedKey('plans', ctx);
    await AsyncStorage.setItem(key, JSON.stringify(plans || []));
  } catch (e) {
    console.warn('Error saving cached plans:', e);
  }
}

// -------------------------------------------------------------
// 4. Persistent Local Images
// -------------------------------------------------------------
export async function persistPhotoLocally(tempUri) {
  if (!tempUri) return null;
  try {
    await ensureProofsDir();
    const filename = `proof_${Date.now()}_${Math.random().toString(36).substring(2, 8)}.jpg`;
    const destination = `${PROOFS_DIR}${filename}`;
    await FileSystem.copyAsync({
      from: tempUri,
      to: destination,
    });
    return destination;
  } catch (e) {
    console.warn('Failed to copy photo to persistent storage, using tempUri:', e);
    return tempUri;
  }
}

// -------------------------------------------------------------
// 5. Outbox Queue (Bookings)
// -------------------------------------------------------------
export async function getAllBookings() {
  try {
    const data = await AsyncStorage.getItem(KEYS.BOOKINGS);
    return data ? JSON.parse(data) : [];
  } catch (e) {
    console.warn('Error reading bookings:', e);
    return [];
  }
}

export async function getPendingBookings() {
  const all = await getAllBookings();
  return all.filter((b) => b.status === 'pending');
}

export async function enqueueBooking(booking) {
  try {
    const rawAll = await getAllBookings();
    const all = Array.isArray(rawAll) ? rawAll.filter(Boolean) : [];
    const newBooking = {
      ...booking,
      id: booking.id || `book_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      projectId: booking.projectId,
      roomId: booking.roomId,
      roomName: booking.roomName,
      itemId: booking.itemId,
      itemOz: booking.itemOz,
      itemText: booking.itemText,
      quantity: Number(booking.quantity) || 0,
      qu: booking.qu || 'Stk',
      photoUris: booking.photoUris || (booking.photoUri ? [booking.photoUri] : []),
      photoUrls: booking.photoUrls || [],
      status: 'pending',
      timestamp: booking.timestamp || new Date().toISOString(),
      calendarWeek: booking.calendarWeek || 27,
      createdBy: booking.createdBy || 'Monteur',
      possibleDuplicate: !!booking.possibleDuplicate,
      note: booking.note || '',
    };

    const updated = [newBooking, ...all.filter((b) => b && b.id !== newBooking.id)];
    await AsyncStorage.setItem(KEYS.BOOKINGS, JSON.stringify(updated));

    // Optimistically update locally installedQty
    try {
      await updateLocalMaterialInstalledQty(newBooking.itemId, newBooking.quantity, newBooking.projectId);
    } catch {}

    return newBooking;
  } catch (e) {
    console.error('Error enqueuing booking:', e);
    throw e;
  }
}

async function updateLocalMaterialInstalledQty(materialId, additionalQty, projectId) {
  try {
    const materials = await getMaterials(projectId);
    const updated = materials.map((m) => {
      if (m.id === materialId) {
        return {
          ...m,
          installedQty: Math.max(0, (Number(m.installedQty) || 0) + Number(additionalQty)),
        };
      }
      return m;
    });
    await saveMaterials(updated, projectId);
  } catch (e) {
    console.warn('Error updating local material qty:', e);
  }
}

export async function updateBookingStatus(id, status, remoteData = {}) {
  try {
    const all = await getAllBookings();
    const updated = all.map((b) => {
      if (b.id === id) {
        return {
          ...b,
          status,
          syncedAt: new Date().toISOString(),
          ...remoteData,
        };
      }
      return b;
    });
    await AsyncStorage.setItem(KEYS.BOOKINGS, JSON.stringify(updated));
  } catch (e) {
    console.warn('Error updating booking status:', e);
  }
}

export async function clearSyncedBookings() {
  try {
    const all = await getAllBookings();
    const pendingOnly = all.filter((b) => b.status === 'pending');
    await AsyncStorage.setItem(KEYS.BOOKINGS, JSON.stringify(pendingOnly));
  } catch (e) {
    console.warn('Error clearing synced bookings:', e);
  }
}

// -------------------------------------------------------------
// 6. Addendums / Nachträge
// -------------------------------------------------------------
export async function getAddendums() {
  try {
    const data = await AsyncStorage.getItem(KEYS.ADDENDUMS);
    return data ? JSON.parse(data) : [];
  } catch (e) {
    return [];
  }
}

export async function enqueueAddendum(addendum) {
  try {
    const all = await getAddendums();
    const newAddendum = {
      id: addendum.id || `add_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      projectId: addendum.projectId,
      roomId: addendum.roomId,
      roomName: addendum.roomName,
      type: addendum.type || 'material',
      title: addendum.title,
      quantity: addendum.quantity,
      qu: addendum.qu || 'Stk',
      requestedBy: addendum.requestedBy || 'Monteur',
      note: addendum.note || '',
      signature: addendum.signature || null,
      status: 'pending',
      createdAt: new Date().toISOString(),
      itemOz: addendum.itemOz || null,
      materialId: addendum.materialId || null,
      isOrdered: !!addendum.isOrdered,
    };
    const updated = [newAddendum, ...all];
    await AsyncStorage.setItem(KEYS.ADDENDUMS, JSON.stringify(updated));
    return newAddendum;
  } catch (e) {
    console.error('Error enqueuing addendum:', e);
    throw e;
  }
}

export async function getPendingAddendums() {
  try {
    const all = await getAddendums();
    return all.filter((a) => a.status === 'pending');
  } catch (e) {
    return [];
  }
}

export async function updateAddendumStatus(id, status, remoteData = {}) {
  try {
    const all = await getAddendums();
    const updated = all.map((a) => {
      if (a.id === id) {
        return {
          ...a,
          status,
          syncedAt: new Date().toISOString(),
          ...remoteData,
        };
      }
      return a;
    });
    await AsyncStorage.setItem(KEYS.ADDENDUMS, JSON.stringify(updated));
  } catch (e) {
    console.warn('Error updating addendum status:', e);
  }
}

// -------------------------------------------------------------
// 7. Two-Way Delta Sync Tracking (Scoped per Project & Tenant)
// -------------------------------------------------------------
export async function getLastSyncedAt(projectId) {
  try {
    const ctx = await getStorageContext(projectId);
    const scopedKey = buildScopedKey('last_synced', ctx);
    const legacyKey = `${KEYS.LAST_SYNCED_AT}_${ctx.projectId}`;

    const val = await AsyncStorage.getItem(scopedKey);
    if (!val && ctx.tenantId) {
      return await AsyncStorage.getItem(legacyKey);
    }
    return val;
  } catch (e) {
    return null;
  }
}

export async function setLastSyncedAt(timestamp, projectId) {
  try {
    const ctx = await getStorageContext(projectId);
    const key = buildScopedKey('last_synced', ctx);
    const val = timestamp || new Date().toISOString();
    await AsyncStorage.setItem(key, val);
    return val;
  } catch (e) {
    console.warn('Error saving lastSyncedAt:', e);
    return null;
  }
}

export async function getLocalUnsyncedDelta(projectId) {
  const ctx = await getStorageContext(projectId);
  const pId = ctx.projectId;
  const allBookings = await getPendingBookings();
  const allAddendums = await getPendingAddendums();
  const pendingBookings = allBookings.filter((b) => !b.projectId || b.projectId === pId);
  const pendingAddendums = allAddendums.filter((a) => !a.projectId || a.projectId === pId);
  const rooms = await getRooms(pId);
  const lastSyncedAt = await getLastSyncedAt(pId);
  const pendingRooms = rooms.filter((r) => {
    if (!r) return false;
    // 1. Completed room that hasn't been synced or was completed after lastSyncedAt
    if (r.isCompleted && (!r.syncedAt || (lastSyncedAt && r.completedAt && r.completedAt > lastSyncedAt))) {
      return true;
    }
    // 2. Room in progress whose local changes haven't been synced
    const hasUnsyncedChanges = Boolean(
      (r.updatedAt && (!r.syncedAt || r.updatedAt > r.syncedAt)) ||
      (!r.syncedAt && (Number(r.pct) > 0 || (r.draftQuantities && Object.keys(r.draftQuantities).length > 0) || (Array.isArray(r.photos) && r.photos.length > 0)))
    );
    return hasUnsyncedChanges;
  });

  return {
    pendingBookings,
    pendingAddendums,
    pendingRooms,
    hasLocalDelta: pendingBookings.length > 0 || pendingAddendums.length > 0 || pendingRooms.length > 0,
    totalPendingCount: pendingBookings.length + pendingAddendums.length + pendingRooms.length,
  };
}

/**
 * Clear project cache safely.
 * CRITICAL RULE: Under NO circumstances clear the cache if there are pending bookings or addendums!
 */
export async function clearProjectCache(projectId) {
  try {
    const ctx = await getStorageContext(projectId);
    const pId = ctx.projectId;

    // Outbox safety check: do NOT clear if there are unsynced items
    const delta = await getLocalUnsyncedDelta(pId);
    if (delta.hasLocalDelta) {
      console.warn(`PROTECTION: Refusing to clear cache for project ${pId} because ${delta.totalPendingCount} pending items exist!`);
      return false;
    }

    const scopedRoomsKey = buildScopedKey('rooms', ctx);
    const scopedMatsKey = buildScopedKey('materials', ctx);
    const scopedProjKey = buildScopedKey('project', ctx);
    const scopedPlansKey = buildScopedKey('plans', ctx);
    const scopedSyncKey = buildScopedKey('last_synced', ctx);

    await Promise.all([
      AsyncStorage.removeItem(scopedRoomsKey),
      AsyncStorage.removeItem(scopedMatsKey),
      AsyncStorage.removeItem(scopedProjKey),
      AsyncStorage.removeItem(scopedPlansKey),
      AsyncStorage.removeItem(scopedSyncKey),
      AsyncStorage.removeItem(`${KEYS.ROOMS}_${pId}`),
      AsyncStorage.removeItem(`${KEYS.MATERIALS}_${pId}`),
      AsyncStorage.removeItem(`${KEYS.PROJECT}_${pId}`),
      AsyncStorage.removeItem(`${KEYS.PLANS}_${pId}`),
      AsyncStorage.removeItem(`${KEYS.LAST_SYNCED_AT}_${pId}`),
    ]);

    return true;
  } catch (e) {
    console.warn('Error clearing project cache:', e);
    return false;
  }
}
