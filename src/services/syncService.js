import { Alert } from 'react-native';
import NetInfo from '@react-native-community/netinfo';
import { doc, setDoc, collection, getDocs, query, where } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { db, storage } from './firebase';
import {
  getPendingBookings,
  updateBookingStatus,
  saveRooms,
  saveMaterials,
  getLanguage,
  getRooms,
  getMaterials,
  getLastSyncedAt,
  setLastSyncedAt,
  getLocalUnsyncedDelta,
  updateAddendumStatus,
} from './storageService';
import { getActiveMonteur, syncMonteurToFirebase } from './authService';
import { DEFAULT_PROJECT_ID } from '../constants/initialData';
import { t } from '../locales/i18n';

/**
 * Check if the device is currently online and internet is reachable
 */
export async function checkOnlineStatus() {
  try {
    const state = await NetInfo.fetch();
    return !!(state.isConnected && state.isInternetReachable !== false);
  } catch (e) {
    return false;
  }
}

/**
 * Upload local photo file to Firebase Storage
 */
async function uploadPhotoToFirebase(localUri, projectId, bookingId, photoIndex) {
  if (!localUri) return null;
  try {
    const response = await fetch(localUri);
    const blob = await response.blob();
    const storagePath = `projects/${projectId}/proofs/${bookingId}_${photoIndex}.jpg`;
    const storageRef = ref(storage, storagePath);

    await uploadBytes(storageRef, blob);
    const downloadUrl = await getDownloadURL(storageRef);
    return downloadUrl;
  } catch (error) {
    console.warn(`Failed to upload photo ${localUri}:`, error.message);
    return null;
  }
}

/**
 * Perform strictly DELTA-based two-way sync:
 * 1. Push: Upload ONLY new/pending local items (bookings, addendums, completions) since lastSyncedAt
 * 2. Pull: Fetch ONLY items modified in Admin-Panel since lastSyncedAt (positions, rooms)
 * 
 * @param {Object} options
 * @param {boolean} options.silent - If true, do not display native alerts (e.g. for background auto-sync)
 * @param {Function} options.onProgress - Optional callback for live progress updates
 */
export async function syncBookings(options = {}) {
  const { silent = false, onProgress = null } = options;
  const currentLang = await getLanguage();

  const isOnline = await checkOnlineStatus();

  // 1. Offline Case
  if (!isOnline) {
    if (!silent) {
      Alert.alert(
        t('offlineAlertTitle', currentLang),
        t('offlineAlertMsg', currentLang),
        [{ text: t('ok', currentLang) }]
      );
    }
    return { success: false, syncedCount: 0, reason: 'offline' };
  }

  // 2. Online Case: Evaluate Delta in Both Directions
  try {
    const monteur = await getActiveMonteur();
    // Use the monteur's active project — fall back to DEFAULT_PROJECT_ID only as last resort
    const projectId = monteur?.projectId || monteur?.assignedProjectIds?.[0] || DEFAULT_PROJECT_ID;
    const lastSyncedAt = await getLastSyncedAt(projectId);
    const localDelta = await getLocalUnsyncedDelta(projectId);

    // Sync monteur profile if present
    if (monteur) {
      await syncMonteurToFirebase(monteur);
    }

    let pushedCount = 0;

    // -------------------------------------------------------------
    // DIRECTION 1 (App -> Admin-Panel): Push ONLY local delta
    // -------------------------------------------------------------
    if (localDelta.hasLocalDelta) {
      if (onProgress) onProgress(t('syncUploading', currentLang), 0.2);

      const totalPending = localDelta.totalPendingCount;
      let processed = 0;

      // 1a. Upload pending bookings
      for (const booking of localDelta.pendingBookings) {
        processed++;
        if (onProgress) {
          onProgress(
            `${t('syncUploading', currentLang)} (${processed}/${totalPending})`,
            0.2 + 0.4 * (processed / totalPending)
          );
        }

        // Upload proof photos
        const uploadedUrls = [];
        const photosToUpload = booking.photoUris || [];
        for (let pIdx = 0; pIdx < photosToUpload.length; pIdx++) {
          const photoUri = photosToUpload[pIdx];
          const cloudUrl = await uploadPhotoToFirebase(photoUri, booking.projectId, booking.id, pIdx);
          if (cloudUrl) {
            uploadedUrls.push(cloudUrl);
          }
        }

        const now = new Date().toISOString();
        const finalBookingData = {
          ...booking,
          photoUrls: uploadedUrls,
          status: 'synced',
          syncedAt: now,
          updatedAt: now,
        };

        try {
          const projectBookingRef = doc(db, 'projects', booking.projectId, 'bookings', booking.id);
          await setDoc(projectBookingRef, finalBookingData, { merge: true });

          const globalBookingRef = doc(db, 'bookings', booking.id);
          await setDoc(globalBookingRef, finalBookingData, { merge: true });

          await updateBookingStatus(booking.id, 'synced', {
            photoUrls: uploadedUrls,
          });

          pushedCount++;
        } catch (err) {
          console.error(`Failed to push booking ${booking.id}:`, err);
        }
      }

      // 1b. Upload pending addendums
      for (const addendum of localDelta.pendingAddendums) {
        processed++;
        if (onProgress) {
          onProgress(
            `${t('syncUploading', currentLang)} (${processed}/${totalPending})`,
            0.2 + 0.4 * (processed / totalPending)
          );
        }

        const now = new Date().toISOString();
        const finalAddendumData = {
          ...addendum,
          status: 'synced',
          syncedAt: now,
          updatedAt: now,
        };

        try {
          const projectAddendumRef = doc(db, 'projects', addendum.projectId, 'addendums', addendum.id);
          await setDoc(projectAddendumRef, finalAddendumData, { merge: true });

          const globalAddendumRef = doc(db, 'addendums', addendum.id);
          await setDoc(globalAddendumRef, finalAddendumData, { merge: true });

          await updateAddendumStatus(addendum.id, 'synced');
          pushedCount++;
        } catch (err) {
          console.error(`Failed to push addendum ${addendum.id}:`, err);
        }
      }

      // 1c. Upload completed room status updates
      for (const room of localDelta.pendingRooms) {
        processed++;
        const now = new Date().toISOString();
        try {
          const roomRef = doc(db, 'projects', projectId, 'rooms', room.id);
          await setDoc(roomRef, {
            pct: room.pct || 100,
            isCompleted: true,
            status: 'completed',
            completedAt: room.completedAt || now,
            completedBy: room.completedBy || 'Monteur',
            completionDelta: room.completionDelta || [],
            updatedAt: now,
          }, { merge: true });

          // Update local room record
          const allRooms = await getRooms(projectId);
          const updatedRooms = allRooms.map((r) => (r.id === room.id ? { ...r, syncedAt: now } : r));
          await saveRooms(updatedRooms, projectId);

          pushedCount++;
        } catch (err) {
          console.error(`Failed to push room completion for ${room.id}:`, err);
        }
      }
    } else {
      console.log('Sync Push: No local delta to push. Skipping upload.');
    }

    // -------------------------------------------------------------
    // DIRECTION 2 (Admin-Panel -> App): Pull ONLY remote delta
    // -------------------------------------------------------------
    if (onProgress) onProgress(t('syncDownloading', currentLang), 0.75);

    let pulledPositionsCount = 0;
    let pulledRoomsCount = 0;

    // 2a. Fetch positions delta
    try {
      let remotePositionsDelta = [];
      if (lastSyncedAt) {
        // Query only positions updated after lastSyncedAt
        try {
          const posQuery = query(
            collection(db, 'projects', projectId, 'positions'),
            where('updatedAt', '>', lastSyncedAt)
          );
          const snap = await getDocs(posQuery);
          remotePositionsDelta = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
        } catch (queryErr) {
          console.warn('Direct delta query on positions failed, using fallback:', queryErr.message);
          const snap = await getDocs(collection(db, 'projects', projectId, 'positions'));
          remotePositionsDelta = snap.docs
            .map((d) => ({ id: d.id, ...d.data() }))
            .filter((d) => d.updatedAt && d.updatedAt > lastSyncedAt);
        }
      } else {
        // Baseline first sync: fetch all
        const snap = await getDocs(collection(db, 'projects', projectId, 'positions'));
        remotePositionsDelta = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      }

      if (remotePositionsDelta.length > 0) {
        let updated;
        if (!lastSyncedAt) {
          // Baseline first sync: Remote positions from Firestore are the clean source of truth
          updated = remotePositionsDelta.map((remote) => ({
            id: remote.id,
            pos: remote.posNr || remote.pos || 'neu',
            name: remote.name || 'Neues Material',
            cleanName: remote.cleanName || remote.name || 'Neues Material',
            group: remote.group || 'Allgemein',
            qu: remote.qu || remote.unit || 'Stk',
            deliveredQty: Number(remote.qty ?? remote.deliveredQty ?? 0),
            installedQty: Number(remote.installedQty ?? 0),
            ...remote,
          }));
        } else {
          // Delta sync: update existing positions or append new ones
          const localPositions = await getMaterials(projectId);
          updated = localPositions.map((local) => {
            const remote = remotePositionsDelta.find((rp) => rp.id === local.id || rp.posNr === local.pos);
            if (remote) {
              return {
                ...local,
                ...remote,
                deliveredQty: remote.qty ?? remote.deliveredQty ?? local.deliveredQty,
                installedQty: remote.installedQty ?? local.installedQty,
              };
            }
            return local;
          });

          // Insert new materials created remotely
          remotePositionsDelta.forEach((remote) => {
            if (!updated.some((m) => m.id === remote.id || m.pos === remote.posNr)) {
              updated.push({
                id: remote.id,
                pos: remote.posNr || remote.pos || 'neu',
                name: remote.name || 'Neues Material',
                cleanName: remote.cleanName || remote.name || 'Neues Material',
                group: remote.group || 'Allgemein',
                qu: remote.qu || remote.unit || 'Stk',
                deliveredQty: Number(remote.qty ?? remote.deliveredQty ?? 0),
                installedQty: Number(remote.installedQty ?? 0),
                ...remote,
              });
            }
          });
        }

        await saveMaterials(updated, projectId);
        pulledPositionsCount = remotePositionsDelta.length;
      }
    } catch (posErr) {
      console.warn('Could not pull positions delta:', posErr.message);
    }

    // 2b. Fetch rooms delta
    try {
      let remoteRoomsDelta = [];
      if (lastSyncedAt) {
        try {
          const roomQuery = query(
            collection(db, 'projects', projectId, 'rooms'),
            where('updatedAt', '>', lastSyncedAt)
          );
          const snap = await getDocs(roomQuery);
          remoteRoomsDelta = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
        } catch (queryErr) {
          console.warn('Direct delta query on rooms failed, using fallback:', queryErr.message);
          const snap = await getDocs(collection(db, 'projects', projectId, 'rooms'));
          remoteRoomsDelta = snap.docs
            .map((d) => ({ id: d.id, ...d.data() }))
            .filter((d) => d.updatedAt && d.updatedAt > lastSyncedAt);
        }
      } else {
        // Baseline first sync: fetch all
        const snap = await getDocs(collection(db, 'projects', projectId, 'rooms'));
        remoteRoomsDelta = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      }

      if (remoteRoomsDelta.length > 0) {
        let updated;
        if (!lastSyncedAt) {
          // Baseline first sync: Remote rooms from Firestore are the clean source of truth for THIS project!
          updated = remoteRoomsDelta.map((rr) => ({
            ...rr,
            pct: Number(rr.pct !== undefined ? rr.pct : 0),
          }));
        } else {
          // Delta sync: merge changes with local rooms of this project
          const localRooms = await getRooms(projectId);
          updated = localRooms.map((local) => {
            const remote = remoteRoomsDelta.find((rr) => rr.id === local.id);
            return remote ? { ...local, ...remote, pct: Number(remote.pct !== undefined ? remote.pct : local.pct || 0) } : local;
          });

          // Insert new rooms created remotely
          remoteRoomsDelta.forEach((remote) => {
            if (!updated.some((r) => r.id === remote.id)) {
              updated.push({
                ...remote,
                pct: Number(remote.pct !== undefined ? remote.pct : 0),
              });
            }
          });
        }

        await saveRooms(updated, projectId);
        pulledRoomsCount = remoteRoomsDelta.length;
      }
    } catch (roomErr) {
      console.warn('Could not pull rooms delta:', roomErr.message);
    }

    // -------------------------------------------------------------
    // Save New Sync Timestamp (Scoped per Project)
    // -------------------------------------------------------------
    const newSyncTimestamp = new Date().toISOString();
    await setLastSyncedAt(newSyncTimestamp, projectId);

    const totalSyncedCount = pushedCount + pulledPositionsCount + pulledRoomsCount;
    const hasDelta = localDelta.hasLocalDelta || pulledPositionsCount > 0 || pulledRoomsCount > 0;

    if (onProgress) onProgress(t('syncSuccessTitle', currentLang), 1.0);

    // Show native success alert if not silent
    if (!silent) {
      const msg = hasDelta && totalSyncedCount > 0
        ? t('syncSuccessMsg', currentLang, { n: totalSyncedCount })
        : t('syncNoPending', currentLang);

      Alert.alert(t('syncSuccessTitle', currentLang), msg, [{ text: t('ok', currentLang) }]);
    }

    return {
      success: true,
      syncedCount: totalSyncedCount,
      pushedCount,
      pulledCount: pulledPositionsCount + pulledRoomsCount,
      hasDelta,
      lastSyncedAt: newSyncTimestamp,
    };
  } catch (error) {
    console.error('Delta sync error:', error);
    if (!silent) {
      Alert.alert('Sync Error', error.message || 'Synchronisation fehlgeschlagen.', [{ text: t('ok', currentLang) }]);
    }
    return { success: false, error: error.message };
  }
}
