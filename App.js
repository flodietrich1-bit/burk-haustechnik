import React, { useState, useEffect, useCallback } from 'react';
import {
  StyleSheet,
  View,
  SafeAreaView,
  StatusBar,
  Alert,
  ActivityIndicator,
} from 'react-native';
import NetInfo from '@react-native-community/netinfo';
import * as Updates from 'expo-updates';
import { COLORS } from './src/constants/theme';
import { getLanguage, setLanguage } from './src/services/storageService';
import { getActiveMonteur, setActiveProjectId } from './src/services/authService';
import {
  getRooms,
  saveRooms,
  getMaterials,
  getProjectInfo,
  getPendingBookings,
  enqueueBooking,
  enqueueAddendum,
  getLocalUnsyncedDelta,
} from './src/services/storageService';
import { syncBookings, checkOnlineStatus } from './src/services/syncService';

// Components
import Header from './src/components/Header';

// Screens
import SetupProfileScreen from './src/screens/SetupProfileScreen';
import PinLockScreen from './src/screens/PinLockScreen';
import ProjectSelectScreen from './src/screens/ProjectSelectScreen';
import SyncLoadingScreen from './src/screens/SyncLoadingScreen';
import RoomListScreen from './src/screens/RoomListScreen';
import BookingScreen from './src/screens/BookingScreen';
import PhotoCaptureScreen from './src/screens/PhotoCaptureScreen';
import DoneScreen from './src/screens/DoneScreen';
import { DEFAULT_PROJECT } from './src/constants/initialData';

export default function App() {
  // App Phase: 'loading' | 'pin' | 'project_select' | 'app'
  const [appPhase, setAppPhase] = useState('loading');
  const [currentScreen, setCurrentScreen] = useState('rooms'); // 'rooms' | 'book' | 'photos' | 'done'

  // User & Localization
  const [monteur, setMonteur] = useState(null);
  const [currentLang, setCurrentLang] = useState('de');

  // Master Data & Project
  const [rooms, setRooms] = useState([]);
  const [materials, setMaterials] = useState([]);
  const [project, setProject] = useState({});
  const [availableProjects, setAvailableProjects] = useState([]);
  const [pendingCount, setPendingCount] = useState(0);

  // Network State
  const [isOnline, setIsOnline] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncProgress, setSyncProgress] = useState({ visible: false, text: '', progress: 0 });

  // Active Booking Session State
  const [selectedRoom, setSelectedRoom] = useState(null);
  const [sessionQuantities, setSessionQuantities] = useState({}); // { matId: delta }
  const [sessionPhotos, setSessionPhotos] = useState([]); // [localUri, ...]
  const [unclearItems, setUnclearItems] = useState([]);
  const [lastSummary, setLastSummary] = useState([]);

  // 1. Initial App Loading
  useEffect(() => {
    async function initApp() {
      try {
        const [savedLang, activeUser, cachedRooms, cachedMats, proj, delta] = await Promise.all([
          getLanguage(),
          getActiveMonteur(),
          getRooms(),
          getMaterials(),
          getProjectInfo(),
          getLocalUnsyncedDelta(),
        ]);

        setCurrentLang(savedLang);
        setRooms(cachedRooms);
        setMaterials(cachedMats);
        setProject(proj);
        setPendingCount(delta.totalPendingCount);

        if (activeUser) {
          setMonteur(activeUser);
        }
        // Neutral PIN screen on app start / reload
        setAppPhase('pin');

        // Check for latest EAS update in background and reload if available
        if (!__DEV__ && Updates.isEnabled) {
          Updates.checkForUpdateAsync()
            .then(async (update) => {
              if (update.isAvailable) {
                await Updates.fetchUpdateAsync();
                await Updates.reloadAsync();
              }
            })
            .catch(() => {});
        }
      } catch (err) {
        console.error('Error during app initialization:', err);
        setAppPhase('pin');
      }
    }

    initApp();
  }, []);

  // 2. NetInfo Listener for real-time connectivity & background sync
  useEffect(() => {
    const unsubscribe = NetInfo.addEventListener(async (state) => {
      const online = !!(state.isConnected && state.isInternetReachable !== false);
      setIsOnline(online);

      // If reconnected and in main app with pending delta, trigger background sync
      if (online && appPhase === 'app') {
        const delta = await getLocalUnsyncedDelta();
        if (delta.hasLocalDelta && !isSyncing) {
          syncBookings({ silent: true }).then((res) => {
            if (res.success) {
              refreshData();
            }
          });
        }
      }
    });

    return () => unsubscribe();
  }, [appPhase, isSyncing]);

  const refreshData = async (targetProjectId) => {
    const pId = targetProjectId || project?.id;
    const [r, m, delta] = await Promise.all([
      getRooms(pId),
      getMaterials(pId),
      getLocalUnsyncedDelta(pId),
    ]);
    setRooms(r);
    setMaterials(m);
    setPendingCount(delta.totalPendingCount);
  };

  // 3. PIN Unlock, Sync & Multi-Project Routing
  const handleUnlockWithAutoSync = async (authenticatedMonteur, assignedProjects = []) => {
    if (authenticatedMonteur) {
      setMonteur(authenticatedMonteur);
    }
    const projectsList = assignedProjects && assignedProjects.length > 0 ? assignedProjects : [DEFAULT_PROJECT];
    setAvailableProjects(projectsList);

    const online = await checkOnlineStatus();
    setIsOnline(online);

    const proceedToAppOrSelect = async () => {
      if (projectsList.length > 1) {
        setAppPhase('project_select');
      } else {
        const targetProj = projectsList[0] || DEFAULT_PROJECT;
        setProject(targetProj);
        // Persist project ID and load its cached data
        if (targetProj?.id) {
          await setActiveProjectId(targetProj.id);
          const [r, m, delta] = await Promise.all([
            getRooms(targetProj.id),
            getMaterials(targetProj.id),
            getLocalUnsyncedDelta(targetProj.id),
          ]);
          setRooms(r);
          setMaterials(m);
          setPendingCount(delta.totalPendingCount);
        }
        setAppPhase('app');
        setCurrentScreen('rooms');
      }
    };

    if (online) {
      // Show seamless sync overlay
      setSyncProgress({
        visible: true,
        text: 'Verbindung hergestellt – Synchronisiere Baustellendaten...',
        progress: 0.1,
      });

      try {
        await syncBookings({
          silent: true,
          onProgress: (text, progress) => {
            setSyncProgress({ visible: true, text, progress });
          },
        });
        await refreshData();
      } catch (err) {
        console.warn('Auto-sync notice:', err);
      } finally {
        setTimeout(async () => {
          setSyncProgress({ visible: false, text: '', progress: 1 });
          await proceedToAppOrSelect();
        }, 600);
      }
    } else {
      // Offline mode
      await proceedToAppOrSelect();
    }
  };

  const handleSelectProject = async (chosenProject) => {
    setProject(chosenProject);
    const pId = chosenProject?.id;
    // Persist chosen project ID and immediately load its rooms & positions
    if (pId) {
      await setActiveProjectId(pId);
      const [r, m, delta] = await Promise.all([
        getRooms(pId),
        getMaterials(pId),
        getLocalUnsyncedDelta(pId),
      ]);
      setRooms(r);
      setMaterials(m);
      setPendingCount(delta.totalPendingCount);
    }
    setAppPhase('app');
    setCurrentScreen('rooms');
    // Immediately sync data from cloud for the selected project
    setTimeout(async () => {
      try {
        await syncBookings({ silent: true });
        await refreshData(pId);
      } catch (err) {
        console.warn('Post-project-select sync notice:', err);
      }
    }, 100);
  };

  const handleSwitchProject = () => {
    if (availableProjects.length > 1) {
      setAppPhase('project_select');
    }
  };

  // 4. Language Change
  const handleSelectLang = async (lang) => {
    setCurrentLang(lang);
    await setLanguage(lang);
  };

  // 6. Manual Sync Button
  const handleManualSync = async () => {
    if (isSyncing) return;
    setIsSyncing(true);
    try {
      const res = await syncBookings({ silent: false });
      if (res.success) {
        await refreshData();
      }
    } finally {
      setIsSyncing(false);
    }
  };

  // 7. Room Navigation
  const handleSelectRoom = (room) => {
    setSelectedRoom(room);
    setSessionQuantities({});
    setSessionPhotos([]);
    setUnclearItems([]);
    setCurrentScreen('book');
  };

  const handleQuantityChange = (matId, qty) => {
    setSessionQuantities((prev) => ({
      ...prev,
      [matId]: qty,
    }));
  };

  const handleAddPhoto = (uri) => {
    setSessionPhotos((prev) => [...prev, uri]);
  };

  const handleRemovePhoto = (index) => {
    setSessionPhotos((prev) => prev.filter((_, i) => i !== index));
  };

  const handleAddUnclearItem = (item) => {
    setUnclearItems((prev) => [...prev, item]);
  };

  const handleAddNachtrag = async (nachtragData) => {
    try {
      await enqueueAddendum(nachtragData);
      const delta = await getLocalUnsyncedDelta();
      setPendingCount(delta.totalPendingCount);
    } catch (e) {
      console.warn('Error saving addendum:', e);
    }
  };

  const handleCompleteRoom = async (roomId, deltaSummary) => {
    try {
      const updatedRooms = rooms.map((r) => {
        if (r.id === roomId) {
          return {
            ...r,
            pct: 100,
            isCompleted: true,
            status: 'completed',
            completedAt: new Date().toISOString(),
            completedBy: monteur?.name || 'Monteur',
            completionDelta: deltaSummary,
          };
        }
        return r;
      });

      setRooms(updatedRooms);
      await saveRooms(updatedRooms);

      if (selectedRoom && selectedRoom.id === roomId) {
        setSelectedRoom({
          ...selectedRoom,
          pct: 100,
          isCompleted: true,
          status: 'completed',
          completedAt: new Date().toISOString(),
          completedBy: monteur?.name || 'Monteur',
          completionDelta: deltaSummary,
        });
      }

      // Enqueue room completion event to offline outbox
      await enqueueBooking({
        projectId: project.id || 'hallenbad-weingarten',
        roomId,
        roomName: selectedRoom?.name || 'Raum',
        type: 'room_completion',
        itemId: 'room_completion',
        itemOz: 'FERTIG',
        itemText: `Raum ${selectedRoom?.name || roomId} zu 100% fertiggestellt`,
        quantity: 1,
        qu: 'Raum',
        deltaSummary,
        createdBy: monteur?.name || 'Monteur',
        calendarWeek: project.calendarWeek || 27,
        isCompleted: true,
      });

      const delta = await getLocalUnsyncedDelta();
      setPendingCount(delta.totalPendingCount);

      Alert.alert(
        'Raum fertiggestellt',
        `Der Raum ${selectedRoom?.name || ''} wurde erfolgreich auf 100 % gesetzt. Das Mengen-Delta wurde für den Bauleiter hinterlegt.`
      );
    } catch (e) {
      console.warn('Error completing room:', e);
    }
  };

  const handleOverConsumptionAlert = async (alertData) => {
    try {
      await enqueueBooking({
        projectId: project.id || 'hallenbad-weingarten',
        type: 'over_consumption_alert',
        roomId: alertData.roomId,
        roomName: alertData.roomName,
        itemId: alertData.materialId,
        itemOz: alertData.materialPos,
        itemText: alertData.materialName,
        quantity: alertData.exceededBy,
        qu: alertData.qu,
        plannedQty: alertData.plannedQty,
        requestedTotal: alertData.requestedTotal,
        reason: alertData.reason,
        createdBy: alertData.monteurName,
        calendarWeek: project.calendarWeek || 27,
        needsReorder: true,
        isAlert: true,
      });

      const pending = await getPendingBookings();
      setPendingCount(pending.length);
    } catch (e) {
      console.warn('Error queuing over-consumption alert:', e);
    }
  };

  // 8. Commit Booking & Outbox Queueing
  const handleFinishBooking = async () => {
    if (!selectedRoom) return;

    try {
      const summary = [];

      // Save each material delta into the outbox queue
      for (const [matId, delta] of Object.entries(sessionQuantities)) {
        if (Number(delta) > 0) {
          const mat = materials.find((m) => m.id === matId);
          if (mat) {
            await enqueueBooking({
              projectId: project.id || 'hallenbad-weingarten',
              roomId: selectedRoom.id,
              roomName: selectedRoom.name,
              itemId: mat.id,
              itemOz: mat.pos,
              itemText: mat.cleanName,
              quantity: delta,
              qu: mat.qu,
              photoUris: sessionPhotos,
              createdBy: monteur?.name || 'Monteur',
              calendarWeek: project.calendarWeek || 27,
            });

            summary.push({
              name: mat.cleanName,
              quantity: delta,
              qu: mat.qu,
            });
          }
        }
      }

      // If only photos were taken without material delta (e.g. proof inspection)
      if (summary.length === 0 && sessionPhotos.length > 0) {
        await enqueueBooking({
          projectId: project.id || 'hallenbad-weingarten',
          roomId: selectedRoom.id,
          roomName: selectedRoom.name,
          itemId: 'photo_doc',
          itemOz: 'DOKU',
          itemText: 'Foto-Belegdokumentation',
          quantity: sessionPhotos.length,
          qu: 'Fotos',
          photoUris: sessionPhotos,
          createdBy: monteur?.name || 'Monteur',
          calendarWeek: project.calendarWeek || 27,
        });

        summary.push({
          name: 'Foto-Belegdokumentation',
          quantity: sessionPhotos.length,
          qu: 'Fotos',
        });
      }

      // Save unclear / unassigned items if any
      for (const u of unclearItems) {
        await enqueueBooking({
          projectId: project.id || 'hallenbad-weingarten',
          roomId: selectedRoom.id,
          roomName: selectedRoom.name,
          itemId: u.materialId || `unclear_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
          itemOz: u.itemOz || u.pos || 'UNKLAR',
          itemText: u.txt,
          quantity: u.qty,
          qu: u.qu || (String(u.qty).includes('m') ? 'm' : 'Stk'),
          photoUris: sessionPhotos,
          createdBy: monteur?.name || 'Monteur',
          calendarWeek: project.calendarWeek || 27,
          isUnclear: true,
          status: 'pending_assignment',
        });

        summary.push({
          name: `${u.txt} (Zuordnung offen)`,
          quantity: u.qty,
          qu: '',
        });
      }

      setLastSummary(summary);
      setUnclearItems([]);
      await refreshData();
      setCurrentScreen('done');
    } catch (error) {
      Alert.alert('Fehler', 'Buchung konnte nicht gespeichert werden.');
    }
  };

  // -------------------------------------------------------------
  // Render Phases
  // -------------------------------------------------------------

  if (appPhase === 'loading') {
    return (
      <View style={styles.centerLoading}>
        <ActivityIndicator size="large" color={COLORS.amber} />
      </View>
    );
  }

  if (appPhase === 'pin') {
    return (
      <SafeAreaView style={styles.safeArea}>
        <StatusBar barStyle="dark-content" backgroundColor={COLORS.bg} />
        <PinLockScreen
          currentLang={currentLang}
          onUnlockSuccess={handleUnlockWithAutoSync}
        />
        <SyncLoadingScreen
          visible={syncProgress.visible}
          statusText={syncProgress.text}
          progress={syncProgress.progress}
        />
      </SafeAreaView>
    );
  }

  if (appPhase === 'project_select') {
    return (
      <ProjectSelectScreen
        monteur={monteur}
        projects={availableProjects}
        currentLang={currentLang}
        onSelectLang={handleSelectLang}
        onSelectProject={handleSelectProject}
      />
    );
  }

  // Main Authenticated App Flow
  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="light-content" backgroundColor={COLORS.ink} />

      {/* Persistent Global Header */}
      <Header
        projectName={project.name || 'Hallenbad Weingarten'}
        subTitle={`${project.client || 'Stadt Weingarten'} · ${selectedRoom ? selectedRoom.name : 'UG'}`}
        calendarWeek={project.calendarWeek || 27}
        isOnline={isOnline}
        pendingCount={pendingCount}
        currentLang={currentLang}
        onSelectLang={handleSelectLang}
        onSyncPress={handleManualSync}
        isSyncing={isSyncing}
        monteurName={monteur?.name || 'Monteur'}
        onSwitchProject={availableProjects.length > 1 ? handleSwitchProject : null}
      />

      {/* Screen Router */}
      <View style={styles.body}>
        {currentScreen === 'rooms' && (
          <RoomListScreen
            rooms={rooms}
            materials={materials}
            project={project}
            currentLang={currentLang}
            onSelectRoom={handleSelectRoom}
            onSwitchProject={availableProjects.length > 1 ? handleSwitchProject : null}
          />
        )}

        {currentScreen === 'book' && selectedRoom && (
          <BookingScreen
            room={selectedRoom}
            materials={materials}
            monteur={monteur}
            currentLang={currentLang}
            sessionQuantities={sessionQuantities}
            onQuantityChange={handleQuantityChange}
            photoCount={sessionPhotos.length}
            onGoToPhotos={() => setCurrentScreen('photos')}
            onBack={() => setCurrentScreen('rooms')}
            unclearItems={unclearItems}
            onAddUnclearItem={handleAddUnclearItem}
            onAddNachtrag={handleAddNachtrag}
            onCompleteRoom={handleCompleteRoom}
            onOverConsumptionAlert={handleOverConsumptionAlert}
          />
        )}

        {currentScreen === 'photos' && selectedRoom && (
          <PhotoCaptureScreen
            room={selectedRoom}
            photos={sessionPhotos}
            onAddPhoto={handleAddPhoto}
            onRemovePhoto={handleRemovePhoto}
            onFinishBooking={handleFinishBooking}
            onBackToBook={() => setCurrentScreen('book')}
            currentLang={currentLang}
          />
        )}

        {currentScreen === 'done' && (
          <DoneScreen
            room={selectedRoom}
            summaryItems={lastSummary}
            photoCount={sessionPhotos.length}
            onBackToRooms={() => {
              setCurrentScreen('rooms');
              setSelectedRoom(null);
            }}
            currentLang={currentLang}
          />
        )}
      </View>

      {/* Auto-Sync Overlay if triggered */}
      <SyncLoadingScreen
        visible={syncProgress.visible}
        statusText={syncProgress.text}
        progress={syncProgress.progress}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: COLORS.ink,
  },
  body: {
    flex: 1,
    backgroundColor: COLORS.bg,
  },
  centerLoading: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: COLORS.bg,
  },
});
