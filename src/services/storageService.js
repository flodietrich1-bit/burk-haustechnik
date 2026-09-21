import AsyncStorage from '@react-native-async-storage/async-storage';
import * as FileSystem from 'expo-file-system';
import { INITIAL_ROOMS, INITIAL_MATERIALS, DEFAULT_PROJECT, DEFAULT_PROJECT_ID } from '../constants/initialData';

// Storage keys
const KEYS = {
  LANGUAGE: 'ttapp_selected_language',
  ROOMS: 'ttapp_cached_rooms',
  MATERIALS: 'ttapp_cached_materials',
  PROJECT: 'ttapp_cached_project',
  BOOKINGS: 'ttapp_outbox_bookings',
  ADDENDUMS: 'ttapp_outbox_addendums',
  UNCLEAR: 'ttapp_outbox_unclear',
  USER_PROFILE: 'ttapp_monteur_profile',
  LAST_SYNCED_AT: 'ttapp_last_synced_at',
};

// Ensure local proof photos directory exists
const PROOFS_DIR = `${FileSystem.documentDirectory || ''}proofs/`;

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

// -------------------------------------------------------------
// 1. Language Persistence
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
// 2. Master Data (Rooms, Materials, Project)
// -------------------------------------------------------------
export async function getRooms() {
  try {
    const data = await AsyncStorage.getItem(KEYS.ROOMS);
    if (data) {
      const parsed = JSON.parse(data);
      if (Array.isArray(parsed) && parsed.length > 0) return parsed;
    }
  } catch (e) {
    console.warn('Error reading rooms:', e);
  }
  return INITIAL_ROOMS;
}

export async function saveRooms(rooms) {
  try {
    await AsyncStorage.setItem(KEYS.ROOMS, JSON.stringify(rooms));
  } catch (e) {
    console.warn('Error saving rooms:', e);
  }
}

export async function getMaterials() {
  try {
    const data = await AsyncStorage.getItem(KEYS.MATERIALS);
    if (data) {
      const parsed = JSON.parse(data);
      if (Array.isArray(parsed) && parsed.length > 0) return parsed;
    }
  } catch (e) {
    console.warn('Error reading materials:', e);
  }
  return INITIAL_MATERIALS;
}

export async function saveMaterials(materials) {
  try {
    await AsyncStorage.setItem(KEYS.MATERIALS, JSON.stringify(materials));
  } catch (e) {
    console.warn('Error saving materials:', e);
  }
}

export async function getProjectInfo() {
  try {
    const data = await AsyncStorage.getItem(KEYS.PROJECT);
    if (data) return JSON.parse(data);
  } catch (e) {
    console.warn('Error reading project info:', e);
  }
  return DEFAULT_PROJECT;
}

export async function saveProjectInfo(project) {
  try {
    await AsyncStorage.setItem(KEYS.PROJECT, JSON.stringify(project));
  } catch (e) {
    console.warn('Error saving project info:', e);
  }
}

// -------------------------------------------------------------
// 3. Persistent Local Images
// -------------------------------------------------------------
export async function persistPhotoLocally(tempUri) {
  if (!tempUri) return null;
  try {
    await ensureProofsDir();
    const filename = `proof_${Date.now()}_${Math.random().toString(36).substring(2, 8)}.jpg`;
    const destination = `${PROOFS_DIR}${filename}`;
    
    // Copy the temp photo to document directory for permanent offline availability
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
// 4. Outbox Queue (Bookings)
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
    const all = await getAllBookings();
    const newBooking = {
      id: booking.id || `book_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      projectId: booking.projectId || DEFAULT_PROJECT_ID,
      roomId: booking.roomId,
      roomName: booking.roomName,
      itemId: booking.itemId,
      itemOz: booking.itemOz,
      itemText: booking.itemText,
      quantity: Number(booking.quantity) || 0,
      qu: booking.qu || 'Stk',
      photoUris: booking.photoUris || (booking.photoUri ? [booking.photoUri] : []),
      photoUrls: booking.photoUrls || [],
      status: 'pending', // 'pending' | 'synced'
      timestamp: booking.timestamp || new Date().toISOString(),
      calendarWeek: booking.calendarWeek || 27,
      createdBy: booking.createdBy || 'Monteur',
      possibleDuplicate: !!booking.possibleDuplicate,
      note: booking.note || '',
    };

    const updated = [newBooking, ...all.filter((b) => b.id !== newBooking.id)];
    await AsyncStorage.setItem(KEYS.BOOKINGS, JSON.stringify(updated));

    // Also optimistically update locally installedQty of the material
    await updateLocalMaterialInstalledQty(newBooking.itemId, newBooking.quantity);

    return newBooking;
  } catch (e) {
    console.error('Error enqueuing booking:', e);
    throw e;
  }
}

async function updateLocalMaterialInstalledQty(materialId, additionalQty) {
  try {
    const materials = await getMaterials();
    const updated = materials.map((m) => {
      if (m.id === materialId) {
        return {
          ...m,
          installedQty: Math.max(0, (Number(m.installedQty) || 0) + Number(additionalQty)),
        };
      }
      return m;
    });
    await saveMaterials(updated);
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
// 5. Addendums / Nachträge
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
      projectId: addendum.projectId || DEFAULT_PROJECT_ID,
      roomId: addendum.roomId,
      roomName: addendum.roomName,
      type: addendum.type || 'material', // 'material' | 'stunden'
      title: addendum.title,
      quantity: addendum.quantity,
      qu: addendum.qu || 'Stk',
      requestedBy: addendum.requestedBy || 'Bauleiter',
      note: addendum.note || '',
      signature: addendum.signature || null,
      status: 'pending',
      createdAt: new Date().toISOString(),
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
// 6. Two-Way Delta Sync Tracking
// -------------------------------------------------------------
export async function getLastSyncedAt() {
  try {
    return await AsyncStorage.getItem(KEYS.LAST_SYNCED_AT);
  } catch (e) {
    return null;
  }
}

export async function setLastSyncedAt(timestamp) {
  try {
    const val = timestamp || new Date().toISOString();
    await AsyncStorage.setItem(KEYS.LAST_SYNCED_AT, val);
    return val;
  } catch (e) {
    console.warn('Error saving lastSyncedAt:', e);
    return null;
  }
}

export async function getLocalUnsyncedDelta() {
  const pendingBookings = await getPendingBookings();
  const pendingAddendums = await getPendingAddendums();
  const rooms = await getRooms();
  const lastSyncedAt = await getLastSyncedAt();
  const pendingRooms = rooms.filter(
    (r) => r.isCompleted && (!r.syncedAt || (lastSyncedAt && r.completedAt && r.completedAt > lastSyncedAt))
  );

  return {
    pendingBookings,
    pendingAddendums,
    pendingRooms,
    hasLocalDelta: pendingBookings.length > 0 || pendingAddendums.length > 0 || pendingRooms.length > 0,
    totalPendingCount: pendingBookings.length + pendingAddendums.length + pendingRooms.length,
  };
}

