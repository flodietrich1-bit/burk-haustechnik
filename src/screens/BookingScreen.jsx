import React, { useState, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  Alert,
  Keyboard,
} from 'react-native';
import { COLORS } from '../constants/theme';
import { t } from '../locales/i18n';
import {
  resolveMat,
  getRoomPlannedItem,
  getMaterialDisplayName,
} from '../components/booking/bookingHelpers';
import MaterialBookingCard from '../components/booking/MaterialBookingCard';
import NachtragModal from '../components/booking/NachtragModal';
import UnplannedInstallModal from '../components/booking/UnplannedInstallModal';
import OverConsumptionModal from '../components/booking/OverConsumptionModal';
import CompleteRoomModal from '../components/booking/CompleteRoomModal';
import { styles } from '../components/booking/bookingStyles';

export default function BookingScreen({
  room,
  materials = [],
  monteur,
  currentLang = 'de',
  sessionQuantities = {},
  sessionPhotos = [],
  onQuantityChange,
  photoCount = 0,
  onGoToPhotos,
  onBack,
  unclearItems = [],
  onAddUnclearItem,
  onAddNachtrag,
  onCompleteRoom,
  onOverConsumptionAlert,
}) {
  const [searchQuery, setSearchQuery] = useState('');

  const getInitialMaterialIds = () => {
    if (Array.isArray(room.materials) && room.materials.length > 0) {
      const ids = room.materials.map((m) => m.positionId || m.id).filter(Boolean);
      if (ids.length > 0) return ids;
    }
    if (Array.isArray(room.defaultMaterialIds) && room.defaultMaterialIds.length > 0) {
      return room.defaultMaterialIds;
    }
    if (Array.isArray(materials) && materials.length > 0) {
      return materials.map((m) => m.id);
    }
    return [];
  };

  const [activeMaterialIds, setActiveMaterialIds] = useState(getInitialMaterialIds);

  useEffect(() => {
    setActiveMaterialIds(getInitialMaterialIds());
  }, [room.id, materials.length]);

  // Locked State
  const isLocked = Boolean(room.isCompleted || room.status === 'completed');

  const handleLockedAction = () => {
    Alert.alert(
      t('roomLockedAlertTitle', currentLang) || 'Raum bereits fertiggestellt',
      t('roomLockedAlertMsg', currentLang) ||
        'Dieser Raum wurde bereits fertiggestellt. Änderungen sind gesperrt und können nur durch den Bauleiter im Admin-Bereich freigeschaltet werden.'
    );
  };

  // Modals state
  const [showUnclearModal, setShowUnclearModal] = useState(false);
  const [showOverModal, setShowOverModal] = useState(false);
  const [pendingOverMat, setPendingOverMat] = useState(null);
  const [overExplanations, setOverExplanations] = useState({});
  const [showCompleteModal, setShowCompleteModal] = useState(false);
  const [showNachtragModal, setShowNachtragModal] = useState(false);

  // Dropdown list of materials present in this room
  const roomMaterialsList = useMemo(() => {
    const list = [];
    const seen = new Set();
    if (Array.isArray(room.materials)) {
      room.materials.forEach((rm) => {
        const mId = rm.positionId || rm.id;
        if (!mId || seen.has(mId)) return;
        seen.add(mId);
        const full = materials.find((m) => m.id === mId || (rm.posNr && m.pos === rm.posNr));
        list.push({
          id: mId,
          pos: rm.posNr || full?.pos || '',
          name:
            rm.shortText ||
            rm.cleanName ||
            rm.name ||
            full?.cleanName ||
            full?.name ||
            'Material',
          qu: rm.qu || full?.qu || 'Stk',
          group: rm.group || full?.group || '',
        });
      });
    }
    if (list.length === 0 && Array.isArray(activeMaterialIds)) {
      activeMaterialIds.forEach((id) => {
        if (seen.has(id)) return;
        seen.add(id);
        const m = materials.find((x) => x.id === id);
        if (m) {
          list.push({
            id: m.id,
            pos: m.pos || '',
            name: getMaterialDisplayName(m),
            qu: m.qu || 'Stk',
            group: m.group || '',
          });
        }
      });
    }
    return list;
  }, [room.materials, activeMaterialIds, materials]);

  // Main screen live search filter
  const q = searchQuery.trim().toLowerCase();
  const filteredMaterials = q
    ? materials.filter((m) =>
        `${m.pos || ''} ${m.shortText || ''} ${m.name || ''} ${m.cleanName || ''} ${m.group || ''}`
          .toLowerCase()
          .includes(q)
      )
    : [];

  const displayMaterialIds = q
    ? filteredMaterials.map((m) => m.id)
    : activeMaterialIds;

  // Stepper with Over-Quantity / Mehrverbrauch check capped at delivered quantity
  const handleStep = (matId, stepDelta) => {
    if (isLocked) {
      handleLockedAction();
      return;
    }
    const { mat, roomPlan } = resolveMat(matId, materials, room);
    if (!mat) return;

    const currentDelta = Number(sessionQuantities[matId]) || 0;

    // Stepping down: always allowed down to 0
    if (stepDelta < 0) {
      const nextDelta = Math.max(0, currentDelta + stepDelta);
      onQuantityChange(matId, nextDelta);
      return;
    }

    // Stepping up: Check delivery stock
    const delivered = Number(
      mat.deliveredQty !== undefined && mat.deliveredQty !== null && Number(mat.deliveredQty) > 0
        ? mat.deliveredQty
        : mat.qty || (roomPlan && roomPlan.plannedQty) || 0
    );
    const hasRoomPlan = Boolean(roomPlan);
    const planned = hasRoomPlan ? Number(roomPlan.plannedQty) : delivered;
    const installedBefore = hasRoomPlan
      ? Number(roomPlan.installedQty || 0)
      : Number(mat.installedQty || 0);

    const availableToInstall = delivered - (installedBefore + currentDelta);

    // If delivered is 0 or nothing left in stock
    if (delivered === 0 || availableToInstall <= 0) {
      Alert.alert('Leider nichts mehr da', 'Leider nichts mehr da. Bitte nachbestellen.');
      return;
    }

    const nextDelta = currentDelta + stepDelta;
    const nextTotalVerb = installedBefore + nextDelta;

    // If stepping UP and exceeding planned quantity
    if (nextTotalVerb > planned) {
      // 1. Overall cap: Cannot exceed delivered quantity of the project
      if (nextTotalVerb > delivered) {
        Alert.alert('Leider nichts mehr da', 'Leider nichts mehr da. Bitte nachbestellen.');
        return;
      }

      // 2. Mehrverbrauch check
      const isUnplannedMat = Boolean(mat.isUnplanned || roomPlan?.isUnplanned);

      if (!isUnplannedMat) {
        if (delivered <= planned) {
          Alert.alert(
            t('noOverPossible', currentLang),
            t('noOverPossibleMsg', currentLang, { delivered, planned, qu: mat.qu })
          );
          return;
        }

        // Trigger Mehrverbrauch explanation if not yet explained
        if (!overExplanations[matId]) {
          const exceeded = Math.max(1, nextTotalVerb - planned);
          const maxPossibleExtra = Math.max(
            0,
            delivered - (hasRoomPlan ? planned : installedBefore)
          );
          const initialExtra = Math.min(exceeded, maxPossibleExtra);

          setPendingOverMat({
            mat,
            nextDelta,
            exceededBy: initialExtra,
            planned,
            installedBefore,
            delivered,
            maxPossibleExtra,
            qu: mat.qu,
          });
          setShowOverModal(true);
          return;
        }
      }
    }

    // Keep searched material visible in room list once interacted with
    if (!activeMaterialIds.includes(matId)) {
      setActiveMaterialIds((prev) => [matId, ...prev]);
    }

    onQuantityChange(matId, nextDelta);
  };

  // Confirming Mehrverbrauch Overlay
  const handleConfirmOverReason = (reasonToUse, extraNum) => {
    if (!pendingOverMat) return;
    const finalReason = reasonToUse.trim();
    if (!finalReason) return;

    const { roomPlan } = resolveMat(pendingOverMat.mat.id, materials, room);
    const hasRoomPlan = Boolean(roomPlan);
    const installedBefore =
      pendingOverMat.installedBefore !== undefined
        ? pendingOverMat.installedBefore
        : hasRoomPlan
        ? Number(roomPlan.installedQty || 0)
        : Number(pendingOverMat.mat.installedQty || 0);

    const neededToReachPlan = Math.max(0, pendingOverMat.planned - installedBefore);
    const finalDelta = neededToReachPlan + extraNum;

    setOverExplanations((prev) => ({
      ...prev,
      [pendingOverMat.mat.id]: finalReason,
    }));

    onQuantityChange(pendingOverMat.mat.id, finalDelta);

    if (onOverConsumptionAlert) {
      onOverConsumptionAlert({
        id: `alert_${Date.now()}_${pendingOverMat.mat.id}`,
        timestamp: new Date().toISOString(),
        roomId: room.id,
        roomName: room.name,
        materialId: pendingOverMat.mat.id,
        materialPos: pendingOverMat.mat.pos,
        materialName: getMaterialDisplayName(
          pendingOverMat.mat,
          getRoomPlannedItem(pendingOverMat.mat.id, room)
        ),
        plannedQty: pendingOverMat.planned,
        requestedTotal: installedBefore + finalDelta,
        exceededBy: extraNum,
        qu: pendingOverMat.qu,
        reason: finalReason,
        monteurName: monteur?.name || 'Monteur',
      });
    }

    setShowOverModal(false);
    setPendingOverMat(null);
  };

  const handleReasonBadgePress = (pendingData) => {
    if (isLocked) {
      handleLockedAction();
      return;
    }
    setPendingOverMat(pendingData);
    setShowOverModal(true);
  };

  // Photos & room status
  const effectivePhotos =
    sessionPhotos && sessionPhotos.length > 0
      ? sessionPhotos
      : Array.isArray(room.photos)
      ? room.photos
      : [];
  const effectivePhotoCount = effectivePhotos.length;
  const isRoomCompleted = room.isCompleted || room.pct === 100;

  // Calculate live room percentage
  const calculateCurrentRoomPct = () => {
    if (room.isCompleted) return 100;
    let totalPlanned = 0;
    let totalInstalled = 0;
    activeMaterialIds.forEach((matId) => {
      const { mat, roomPlan } = resolveMat(matId, materials, room);
      const planned = roomPlan ? Number(roomPlan.plannedQty || 0) : Number(mat?.deliveredQty || 0);
      const installedBefore = roomPlan
        ? Number(roomPlan.installedQty || 0)
        : Number(mat?.installedQty || 0);
      const delta = Number(sessionQuantities[matId]) || 0;
      totalPlanned += planned;
      totalInstalled += installedBefore + delta;
    });

    if (totalPlanned > 0) {
      return Math.min(100, Math.round((totalInstalled / totalPlanned) * 100));
    }
    return room.pct !== undefined ? room.pct : 0;
  };

  // Delta Summary calculation for Room Completion
  const deltaSummary = useMemo(() => {
    const summary = [];
    activeMaterialIds.forEach((matId) => {
      const { mat, roomPlan } = resolveMat(matId, materials, room);
      if (!mat) return;

      const hasRoomPlan = Boolean(roomPlan);
      const planned = hasRoomPlan ? Number(roomPlan.plannedQty) : null;
      const installedBefore = hasRoomPlan
        ? Number(roomPlan.installedQty || 0)
        : Number(mat.installedQty || 0);
      const delta = Number(sessionQuantities[matId]) || 0;
      const totalInstalled = installedBefore + delta;

      summary.push({
        materialId: mat.id,
        pos: mat.pos,
        name: getMaterialDisplayName(mat, roomPlan),
        qu: mat.qu || roomPlan?.qu || 'Stk',
        plannedQty: planned,
        installedQty: totalInstalled,
        diff: planned !== null ? Number((planned - totalInstalled).toFixed(2)) : 0,
        status:
          planned !== null
            ? totalInstalled > planned
              ? 'over'
              : totalInstalled < planned
              ? 'under'
              : 'exact'
            : 'documented',
      });
    });
    return summary;
  }, [activeMaterialIds, materials, room, sessionQuantities]);

  const handleMonteurFertigPress = () => {
    if (isLocked) {
      handleLockedAction();
      return;
    }
    if (effectivePhotoCount === 0 && !isRoomCompleted) {
      Alert.alert(
        t('photosRequiredTitle', currentLang) || 'Fotos erforderlich',
        t('photosRequiredMsg', currentLang) ||
          'Bitte hinterlege mindestens 1 Foto der Montagearbeiten, bevor du den Raum abschließt.',
        [
          { text: t('cancel', currentLang) || 'Abbrechen', style: 'cancel' },
          {
            text: t('toPhotos', currentLang) || 'Fotos aufnehmen',
            onPress: () => {
              if (onGoToPhotos) onGoToPhotos();
            },
          },
        ]
      );
      return;
    }

    const roomPct = calculateCurrentRoomPct();
    Alert.alert(
      'Monteur fertig',
      `Der Raum ist zu ${roomPct}% fertig.\n\nBist du aus deiner Sicht wirklich fertig, sodass die Abnahme beginnen kann?`,
      [
        { text: t('cancel', currentLang) || 'Abbrechen', style: 'cancel' },
        {
          text: 'Ja, fertigstellen',
          onPress: () => handleConfirmCompleteRoom(),
        },
      ]
    );
  };

  const handleConfirmCompleteRoom = () => {
    if (onCompleteRoom) {
      onCompleteRoom(room.id, deltaSummary, sessionQuantities, effectivePhotos);
    }
    setShowCompleteModal(false);
  };

  const handleSaveUnclear = (unclearItem) => {
    setActiveMaterialIds((prev) =>
      prev.includes(unclearItem.materialId) ? prev : [unclearItem.materialId, ...prev]
    );
    if (onAddUnclearItem) {
      onAddUnclearItem(unclearItem);
    }
    setShowUnclearModal(false);
  };

  const handleSaveNachtrag = (addendum) => {
    if (onAddNachtrag) {
      onAddNachtrag(addendum);
    }
    setShowNachtragModal(false);
    Alert.alert(
      t('doneTitle', currentLang) || 'Erfasst',
      t('mehrbedarfSaved', currentLang) || 'Mehrbedarf wurde zur Synchronisation hinterlegt.'
    );
  };

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.scroll}>
        {/* Back Button */}
        <TouchableOpacity style={styles.backButton} onPress={onBack}>
          <Text style={styles.backText}>‹ {t('back', currentLang)}</Text>
        </TouchableOpacity>

        {/* Room Header */}
        <View style={styles.headerRowClean}>
          <Text style={styles.roomTitle}>{room.name}</Text>
          <Text style={styles.roomSubtitle}>
            {t('bookHead', currentLang)} · {t('kw', currentLang)} 27
          </Text>
        </View>

        {/* Locked Room Status Banner */}
        {isLocked && (
          <View style={styles.roomLockedBanner}>
            <Text style={styles.roomLockedIcon}>🔒</Text>
            <View style={{ flex: 1 }}>
              <Text style={styles.roomLockedTitle}>{t('roomLockedBanner', currentLang)}</Text>
              <Text style={styles.roomLockedSub}>{t('roomLockedBannerSub', currentLang)}</Text>
            </View>
          </View>
        )}

        {/* Action Buttons direkt unter dem Titel */}
        <View style={styles.topActionsRow}>
          {/* Button 1: + Material/Zeit benötigt */}
          <TouchableOpacity
            style={styles.actionBtnNachtrag}
            onPress={isLocked ? handleLockedAction : () => setShowNachtragModal(true)}
            activeOpacity={0.7}
          >
            <Text style={styles.actionBtnNachtragText}>
              + Material/Zeit{'\n'}benötigt
            </Text>
          </TouchableOpacity>

          {/* Button 2: außerplanmäßig verbaut */}
          <TouchableOpacity
            style={styles.actionBtnUnclear}
            onPress={isLocked ? handleLockedAction : () => setShowUnclearModal(true)}
            activeOpacity={0.7}
          >
            <Text style={styles.actionBtnUnclearText}>
              außerplanmäßig{'\n'}verbaut
            </Text>
          </TouchableOpacity>
        </View>

        {/* Suchfunktion DIREKT OBERHALB der Materialkacheln */}
        <View style={styles.searchSectionDirect}>
          <View style={styles.searchInputWrap}>
            <Text style={styles.searchIcon}>🔍</Text>
            <TextInput
              style={styles.searchInputField}
              placeholder={t('searchPlaceholder', currentLang)}
              placeholderTextColor={COLORS.muted}
              value={searchQuery}
              onChangeText={setSearchQuery}
              onSubmitEditing={() => Keyboard.dismiss()}
              returnKeyType="search"
            />
            {searchQuery.length > 0 && (
              <TouchableOpacity
                onPress={() => setSearchQuery('')}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                style={styles.searchClearBtn}
              >
                <Text style={styles.searchClearText}>✕</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>

        {/* Active Material Booking Rows */}
        <View style={styles.rowsWrapper}>
          {q && displayMaterialIds.length === 0 && (
            <View style={styles.emptyFilterState}>
              <Text style={styles.emptyFilterIcon}>🔍</Text>
              <Text style={styles.emptyFilterTitle}>
                {t('noMaterialsFound', currentLang)}
              </Text>
              <Text style={styles.emptyFilterSub}>
                {t('noMaterialsFoundSub', currentLang, { query: searchQuery.trim() })}
              </Text>
            </View>
          )}

          {displayMaterialIds.map((matId) => {
            const { mat, roomPlan } = resolveMat(matId, materials, room);
            if (!mat) return null;

            return (
              <MaterialBookingCard
                key={mat.id}
                mat={mat}
                roomPlan={roomPlan}
                delta={Number(sessionQuantities[matId]) || 0}
                room={room}
                currentLang={currentLang}
                userReason={overExplanations[mat.id]}
                isLocked={isLocked}
                onStep={handleStep}
                onReasonBadgePress={handleReasonBadgePress}
                onLockedAction={handleLockedAction}
              />
            );
          })}
        </View>
      </ScrollView>

      {/* Sticky Bottom CTA */}
      <View style={styles.footCta}>
        <TouchableOpacity style={styles.primaryButton} onPress={onGoToPhotos} activeOpacity={0.8}>
          <Text style={styles.primaryButtonText}>
            {effectivePhotoCount > 0
              ? `📸 ${effectivePhotoCount} ${effectivePhotoCount === 1 ? 'Foto' : 'Fotos'} hinterlegt (anzeigen / hinzufügen)`
              : `📸 ${t('toPhotos', currentLang) || 'Fotos aufnehmen'} (für Abnahme erforderlich)`}
          </Text>
        </TouchableOpacity>

        {/* Monteur fertig Button */}
        <TouchableOpacity
          style={[
            styles.monteurFertigBtn,
            isLocked
              ? styles.monteurFertigBtnDone
              : effectivePhotoCount === 0 && !isRoomCompleted
              ? styles.monteurFertigBtnGrey
              : styles.monteurFertigBtnGreen,
            isRoomCompleted && styles.monteurFertigBtnDone,
          ]}
          onPress={handleMonteurFertigPress}
          activeOpacity={0.8}
        >
          <Text style={styles.monteurFertigBtnText}>
            {isLocked
              ? t('roomLockedCompletedBtn', currentLang) || '✓ Raum fertiggestellt (Gesperrt)'
              : isRoomCompleted
              ? '✓ Raum fertiggestellt'
              : effectivePhotoCount === 0
              ? 'Monteur fertig (Fotos erforderlich)'
              : '✓ Monteur fertig (Abnahme starten)'}
          </Text>
        </TouchableOpacity>
      </View>

      {/* MODAL 1: NACHTRAG (+ Material/Zeit benötigt) */}
      <NachtragModal
        visible={showNachtragModal}
        roomMaterialsList={roomMaterialsList}
        room={room}
        monteur={monteur}
        currentLang={currentLang}
        onClose={() => setShowNachtragModal(false)}
        onSave={handleSaveNachtrag}
      />

      {/* MODAL 2: MEHRVERBRAUCH (Over-Consumption) */}
      <OverConsumptionModal
        visible={showOverModal}
        pendingOverMat={pendingOverMat}
        room={room}
        currentLang={currentLang}
        initialReason={pendingOverMat?.userReason || overExplanations[pendingOverMat?.mat?.id] || ''}
        onClose={() => {
          setShowOverModal(false);
          setPendingOverMat(null);
        }}
        onConfirm={handleConfirmOverReason}
      />

      {/* MODAL 3: AUSSERPLANMÄSSIG VERBAUT */}
      <UnplannedInstallModal
        visible={showUnclearModal}
        materials={materials}
        room={room}
        monteur={monteur}
        currentLang={currentLang}
        onClose={() => setShowUnclearModal(false)}
        onSave={handleSaveUnclear}
      />

      {/* MODAL 4: RAUM/ORT FERTIGSTELLEN */}
      <CompleteRoomModal
        visible={showCompleteModal}
        room={room}
        currentLang={currentLang}
        deltaSummary={deltaSummary}
        onClose={() => setShowCompleteModal(false)}
        onConfirm={handleConfirmCompleteRoom}
      />
    </View>
  );
}
