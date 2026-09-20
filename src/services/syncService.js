import { Alert } from 'react-native';
import NetInfo from '@react-native-community/netinfo';
import { doc, setDoc, collection, getDocs } from 'firebase/firestore';
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
    // Some local WiFis or cellular connections might have isInternetReachable null initially,
    // so we treat isConnected === true and isInternetReachable !== false as connected.
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
 * Perform complete two-way sync:
 * 1. Push: Upload pending bookings + photos + monteur profile to Firebase
 * 2. Pull: Fetch updated project rooms & positions (with teammates' cumulative totals) from Firestore
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

  // 2. Online Case
  try {
    if (onProgress) onProgress(t('syncUploading', currentLang), 0.2);

    const pendingBookings = await getPendingBookings();
    const monteur = await getActiveMonteur();

    // Sync monteur profile
    if (monteur) {
      await syncMonteurToFirebase(monteur);
    }

    let syncedCount = 0;

    // Check existing remote bookings for duplicate warning heuristics
    const projectId = DEFAULT_PROJECT_ID;
    let existingBookings = [];
    try {
      const snap = await getDocs(collection(db, 'projects', projectId, 'bookings'));
      existingBookings = snap.docs.map((d) => d.data());
    } catch (e) {
      console.warn('Could not fetch existing remote bookings:', e.message);
    }

    // Sequentially upload each pending booking
    for (let i = 0; i < pendingBookings.length; i++) {
      const booking = pendingBookings[i];
      if (onProgress) {
        const progressPct = 0.2 + (0.5 * (i / Math.max(1, pendingBookings.length)));
        onProgress(`${t('syncUploading', currentLang)} (${i + 1}/${pendingBookings.length})`, progressPct);
      }

      // Upload local proof photos
      const uploadedUrls = [];
      const photosToUpload = booking.photoUris || [];

      for (let pIdx = 0; pIdx < photosToUpload.length; pIdx++) {
        const photoUri = photosToUpload[pIdx];
        const cloudUrl = await uploadPhotoToFirebase(photoUri, booking.projectId, booking.id, pIdx);
        if (cloudUrl) {
          uploadedUrls.push(cloudUrl);
        }
      }

      // Check duplicate heuristic: same room, same item, same calendar week by another monteur
      const isPossibleDuplicate = existingBookings.some((b) => (
        b.roomId === booking.roomId &&
        b.itemId === booking.itemId &&
        b.calendarWeek === booking.calendarWeek &&
        b.createdBy !== booking.createdBy
      ));

      const finalBookingData = {
        ...booking,
        photoUrls: uploadedUrls,
        status: 'synced',
        syncedAt: new Date().toISOString(),
        possibleDuplicate: isPossibleDuplicate,
        reviewRequired: isPossibleDuplicate,
      };

      // Write to project subcollection and global collection for admin-web compatibility
      try {
        const projectBookingRef = doc(db, 'projects', booking.projectId, 'bookings', booking.id);
        await setDoc(projectBookingRef, finalBookingData, { merge: true });

        const globalBookingRef = doc(db, 'bookings', booking.id);
        await setDoc(globalBookingRef, finalBookingData, { merge: true });

        // Update local booking record
        await updateBookingStatus(booking.id, 'synced', {
          photoUrls: uploadedUrls,
          possibleDuplicate: isPossibleDuplicate,
        });

        syncedCount++;
      } catch (err) {
        console.error(`Failed to write booking ${booking.id} to Firestore:`, err);
      }
    }

    // 3. Pull newest project state from Cloud (rooms, positions)
    if (onProgress) onProgress(t('syncDownloading', currentLang), 0.8);

    try {
      const positionsSnap = await getDocs(collection(db, 'projects', projectId, 'positions'));
      if (!positionsSnap.empty) {
        const remotePositions = positionsSnap.docs.map((d) => ({ id: d.id, ...d.data() }));
        if (remotePositions.length > 0) {
          // Merge remote installed quantities
          const localPositions = await getMaterials();
          const merged = localPositions.map((local) => {
            const remote = remotePositions.find((rp) => rp.id === local.id || rp.posNr === local.pos);
            if (remote) {
              return {
                ...local,
                deliveredQty: remote.qty ?? remote.deliveredQty ?? local.deliveredQty,
                installedQty: remote.deliveredQty ?? remote.installedQty ?? local.installedQty,
              };
            }
            return local;
          });
          await saveMaterials(merged);
        }
      }

      const roomsSnap = await getDocs(collection(db, 'projects', projectId, 'rooms'));
      if (!roomsSnap.empty) {
        const remoteRooms = roomsSnap.docs.map((d) => ({ id: d.id, ...d.data() }));
        if (remoteRooms.length > 0) {
          await saveRooms(remoteRooms);
        }
      }
    } catch (pullErr) {
      console.warn('Could not pull latest cloud state, keeping local cache:', pullErr.message);
    }

    if (onProgress) onProgress(t('syncSuccessTitle', currentLang), 1.0);

    // Show native success alert if not silent
    if (!silent) {
      const msg = syncedCount > 0
        ? t('syncSuccessMsg', currentLang, { n: syncedCount })
        : t('syncNoPending', currentLang);

      Alert.alert(t('syncSuccessTitle', currentLang), msg, [{ text: t('ok', currentLang) }]);
    }

    return { success: true, syncedCount };
  } catch (error) {
    console.error('Sync error:', error);
    if (!silent) {
      Alert.alert('Sync Error', error.message || 'Synchronisation fehlgeschlagen.', [{ text: t('ok', currentLang) }]);
    }
    return { success: false, error: error.message };
  }
}
