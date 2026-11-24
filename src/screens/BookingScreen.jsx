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
import { t, formatUnit, translateGroup } from '../locales/i18n';
import {
  resolveMat,
  getRoomPlannedItem,
  getMaterialDisplayName,
  getRoomDisplayName,
  cleanMaterialName,
  isMeterUnit,
} from '../components/booking/bookingHelpers';
import MaterialBookingCard from '../components/booking/MaterialBookingCard';
import UnplannedInstallModal from '../components/booking/UnplannedInstallModal';
import CompleteRoomModal from '../components/booking/CompleteRoomModal';
import { getRoomFloor } from '../services/storageService';
import { isPositionHiddenForMonteur } from '../utils/projectMode';
import { styles } from '../components/booking/bookingStyles';

export default function BookingScreen({
  room,
  materials = [],
  plans = [],
  project,
  monteur,
  currentLang = 'de',
  sessionQuantities = {},
  sessionPhotos = [],
  onQuantityChange,
  photoCount = 0,
  onGoToPhotos,
  unclearItems = [],
  onAddUnclearItem,
  onAddNachtrag,
  onCompleteRoom,
  onReopenRoom,
  onOverConsumptionAlert,
}) {
  const [searchQuery, setSearchQuery] = useState('');

  const floor = useMemo(() => getRoomFloor(room), [room]);

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

  // Progress alone never completes a room.
  const isRoomCompleted = Boolean(
    room.isCompleted ||
    room.status === 'completed'
  );
  const isLocked = isRoomCompleted;

  const handleLockedAction = () => {
    Alert.alert(
      t('roomLockedAlertTitle', currentLang),
      t('roomLockedAlertMsg', currentLang)
    );
  };

  // Modals state
  const [showUnclearModal, setShowUnclearModal] = useState(false);
  const [showCompleteModal, setShowCompleteModal] = useState(false);
  const [isSliderDragging, setIsSliderDragging] = useState(false);

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
          name: cleanMaterialName(
            rm.shortText ||
            rm.cleanName ||
            rm.name ||
            full?.cleanName ||
            full?.name ||
            'Material'
          ),
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

  // Main screen live search and trade filter
  const [selectedTrade, setSelectedTrade] = useState('Alle');

  useEffect(() => {
    setSelectedTrade('Alle');
  }, [room?.id]);

  const q = searchQuery.trim().toLowerCase();

  const unplannedMaterialIds = useMemo(() => [
    ...unclearItems.slice().reverse().map((item) => item.materialId),
    ...(Array.isArray(room.materials) ? room.materials : [])
      .filter((item) => item.isUnplanned)
      .map((item) => item.positionId || item.id),
  ].filter(Boolean), [unclearItems, room.materials]);

  const baseMaterialIds = useMemo(() => {
    return [...new Set([...unplannedMaterialIds, ...activeMaterialIds])];
  }, [unplannedMaterialIds, activeMaterialIds]);

  // Compute distinct trades present in this room
  const { availableTrades, tradeCounts } = useMemo(() => {
    const counts = { Alle: 0 };
    const tradeSet = new Set();

    baseMaterialIds.forEach((id) => {
      const { mat, roomPlan } = resolveMat(id, materials, room);
      if (!mat || isPositionHiddenForMonteur(mat) || isPositionHiddenForMonteur(roomPlan)) return;
      counts.Alle = (counts.Alle || 0) + 1;
      const grp = mat?.group && mat.group !== 'Allgemein'
        ? mat.group
        : (roomPlan?.group || mat?.group || 'Allgemein');
      tradeSet.add(grp);
      counts[grp] = (counts[grp] || 0) + 1;
    });

    const sortedTrades = Array.from(tradeSet).sort((a, b) => a.localeCompare(b));
    return {
      availableTrades: ['Alle', ...sortedTrades],
      tradeCounts: counts,
    };
  }, [baseMaterialIds, materials, room]);

  // Filter materials for this room by Trade and Search query
  const displayMaterialIds = useMemo(() => {
    let ids = baseMaterialIds.filter((id) => {
      const { mat, roomPlan } = resolveMat(id, materials, room);
      return Boolean(mat) && !isPositionHiddenForMonteur(mat) && !isPositionHiddenForMonteur(roomPlan);
    });

    if (selectedTrade && selectedTrade !== 'Alle') {
      ids = ids.filter((id) => {
        const { mat, roomPlan } = resolveMat(id, materials, room);
        if (!mat) return false;
        const grp = mat?.group && mat.group !== 'Allgemein'
          ? mat.group
          : (roomPlan?.group || mat?.group || 'Allgemein');
        return grp === selectedTrade;
      });
    }

    if (q) {
      ids = ids.filter((id) => {
        const { mat, roomPlan } = resolveMat(id, materials, room);
        if (!mat) return false;
        const pos = String(mat.pos || roomPlan?.posNr || '').toLowerCase();
        const alias = String(mat.aliasTitle || roomPlan?.aliasTitle || '').toLowerCase();
        const short = String(mat.shortText || roomPlan?.shortText || '').toLowerCase();
        const name = String(mat.name || roomPlan?.name || '').toLowerCase();
        const grp = String(mat.group || roomPlan?.group || '').toLowerCase();
        const monteurInfo = String(
          mat.monteurInfo ||
          roomPlan?.monteurInfo ||
          mat.containsHint ||
          mat.notes ||
          mat.note ||
          mat.montagehinweis ||
          mat.hinweis ||
          ''
        ).toLowerCase();

        return (
          pos.includes(q) ||
          alias.includes(q) ||
          short.includes(q) ||
          name.includes(q) ||
          grp.includes(q) ||
          monteurInfo.includes(q)
        );
      });
    }

    return ids;
  }, [baseMaterialIds, selectedTrade, q, materials, room]);

  const applyNextDelta = (matId, rawNextDelta) => {
    const { mat, roomPlan } = resolveMat(matId, materials, room);
    if (!mat) return;

    const isMeter = isMeterUnit(mat.qu || roomPlan?.qu);
    const nextDelta = isMeter
      ? Math.max(0, Number(Number(rawNextDelta || 0).toFixed(2)))
      : Math.max(0, Math.round(Number(rawNextDelta || 0)));

    const isUnplannedMat = Boolean(
      mat.isUnplanned ||
      roomPlan?.isUnplanned ||
      unclearItems?.some((u) => u.materialId === matId || u.pos === mat?.pos)
    );
    const hasRoomPlan = Boolean(roomPlan) && !isUnplannedMat;
    const planned = hasRoomPlan ? Number(roomPlan.plannedQty) : 0;
    const installedBefore = hasRoomPlan
      ? Number(roomPlan.installedQty || 0)
      : Number(mat.installedQty || 0);

    const nextTotalVerb = isMeter
      ? Number((installedBefore + nextDelta).toFixed(2))
      : Math.round(installedBefore + nextDelta);

    // Mehrverbrauch automatisch erfassen für Admin (Abweichungen), ohne Monteur zu blockieren
    if (!isUnplannedMat && planned > 0 && nextTotalVerb > planned) {
      const exceededBy = Number((nextTotalVerb - planned).toFixed(2));
      if (onOverConsumptionAlert) {
        onOverConsumptionAlert({
          id: `alert_${room.id}_${matId}`,
          timestamp: new Date().toISOString(),
          roomId: room.id,
          roomName: room.name,
          materialId: mat.id,
          materialPos: mat.pos || '–',
          materialName: getMaterialDisplayName(mat, roomPlan),
          plannedQty: planned,
          requestedTotal: nextTotalVerb,
          exceededBy,
          qu: formatUnit(mat.qu, currentLang),
          reason: 'Mehrverbrauch Baustelle',
          monteurName: monteur?.name || 'Monteur',
        });
      }
    }

    // Keep searched material visible in room list once interacted with
    if (!activeMaterialIds.includes(matId)) {
      setActiveMaterialIds((prev) => [matId, ...prev]);
    }

    onQuantityChange(matId, nextDelta);
  };

  // Stepper (+/-): springs to the next full integer (e.g. 15.7 -> (+) 16.0 / (-) 15.0)
  const handleStep = (matId, stepDelta) => {
    if (isLocked) {
      handleLockedAction();
      return;
    }
    const { mat, roomPlan } = resolveMat(matId, materials, room);
    if (!mat) return;

    const isMeter = isMeterUnit(mat.qu || roomPlan?.qu);
    const hasRoomPlan = Boolean(roomPlan) && !mat.isUnplanned && !roomPlan?.isUnplanned;
    const installedBefore = hasRoomPlan
      ? Number(roomPlan.installedQty || 0)
      : Number(mat.installedQty || 0);

    const currentDelta = Number(sessionQuantities[matId]) || 0;
    const currentTotalVerb = isMeter
      ? Number((installedBefore + currentDelta).toFixed(2))
      : Math.round(installedBefore + currentDelta);

    const isInteger = Math.abs(currentTotalVerb - Math.round(currentTotalVerb)) < 0.001;

    let nextTotalVerb;
    if (stepDelta >= 0) {
      // e.g. 15.7 -> 16.0; 16.0 -> 17.0
      if (isInteger) {
        nextTotalVerb = Math.round(currentTotalVerb) + 1;
      } else {
        nextTotalVerb = Math.floor(currentTotalVerb) + 1;
      }
    } else {
      // e.g. 15.7 -> 15.0; 15.0 -> 14.0
      if (isInteger) {
        nextTotalVerb = Math.max(0, Math.round(currentTotalVerb) - 1);
      } else {
        nextTotalVerb = Math.max(0, Math.floor(currentTotalVerb));
      }
    }

    const nextDelta = isMeter
      ? Math.max(0, Number((nextTotalVerb - installedBefore).toFixed(2)))
      : Math.max(0, Math.round(nextTotalVerb - installedBefore));

    applyNextDelta(matId, nextDelta);
  };

  // Direct delta setter for Slider (up to 100%) and Calculator Keypad (exact meter value)
  const handleSetDelta = (matId, targetDelta) => {
    if (isLocked) {
      handleLockedAction();
      return;
    }
    applyNextDelta(matId, targetDelta);
  };

  // Photos & room status
  const effectivePhotos =
    sessionPhotos && sessionPhotos.length > 0
      ? sessionPhotos
      : Array.isArray(room.photos)
      ? room.photos
      : [];
  const effectivePhotoCount = effectivePhotos.length;

  // Delta Summary calculation for Room Completion
  const deltaSummary = useMemo(() => {
    const summary = [];
    activeMaterialIds.forEach((matId) => {
      const { mat, roomPlan } = resolveMat(matId, materials, room);
      if (!mat) return;

      const isUnplannedMat = Boolean(
        mat.isUnplanned ||
        roomPlan?.isUnplanned ||
        unclearItems?.some((u) => u.materialId === matId || u.pos === mat.pos)
      );
      const hasRoomPlan = Boolean(roomPlan) && !isUnplannedMat;
      const planned = isUnplannedMat ? 0 : hasRoomPlan ? Number(roomPlan.plannedQty) : 0;
      const installedBefore = hasRoomPlan
        ? Number(roomPlan.installedQty || 0)
        : Number(mat.installedQty || 0);
      const delta = Number(sessionQuantities[matId]) || 0;
      const totalInstalled = installedBefore + delta;

      summary.push({
        materialId: mat.id,
        pos: mat.pos,
        name: getMaterialDisplayName(mat, roomPlan),
        qu: formatUnit(mat.qu || roomPlan?.qu || 'Stk', currentLang),
        plannedQty: planned,
        installedQty: totalInstalled,
        isUnplanned: isUnplannedMat,
        diff: Number((planned - totalInstalled).toFixed(2)),
        status: isUnplannedMat
          ? 'unplanned'
          : totalInstalled > planned
          ? 'over'
          : totalInstalled < planned
          ? 'under'
          : 'exact',
      });
    });
    return summary;
  }, [activeMaterialIds, materials, room, sessionQuantities, unclearItems, currentLang]);

  const handleMonteurFertigPress = () => {
    if (isLocked) {
      handleLockedAction();
      return;
    }
    if (effectivePhotoCount === 0) {
      Alert.alert(
        t('photosRequiredTitle', currentLang),
        t('photosRequiredMsg', currentLang),
        [
          { text: t('cancel', currentLang), style: 'cancel' },
          {
            text: t('toPhotos', currentLang),
            onPress: () => {
              if (onGoToPhotos) onGoToPhotos();
            },
          },
        ]
      );
      return;
    }

    setShowCompleteModal(true);
  };

  const handleConfirmCompleteRoom = () => {
    if (isLocked || effectivePhotoCount === 0) {
      setShowCompleteModal(false);
      if (effectivePhotoCount === 0) {
        Alert.alert(t('photosRequiredTitle', currentLang), t('photosRequiredMsg', currentLang));
      }
      return;
    }
    if (onCompleteRoom) {
      onCompleteRoom(room.id, deltaSummary, sessionQuantities, effectivePhotos);
    }
    setShowCompleteModal(false);
  };

  const handleSaveUnclear = (unclearItem) => {
    setActiveMaterialIds((prev) =>
      prev.includes(unclearItem.materialId) ? prev : [unclearItem.materialId, ...prev]
    );
    setSearchQuery('');
    if (onAddUnclearItem) {
      onAddUnclearItem(unclearItem);
    }
    setShowUnclearModal(false);
  };

  return (
    <View style={styles.container}>
      <ScrollView
        contentContainerStyle={styles.scroll}
        scrollEnabled={!isSliderDragging}
      >
        {/* Room Header */}
        <View style={styles.headerRowClean}>
          <View style={{ flex: 1 }}>
            <Text style={styles.roomTitle}>{getRoomDisplayName(room, currentLang)}</Text>
            <Text style={styles.roomSubtitle}>
              {t('bookHead', currentLang)} · {t('floorPrefix', currentLang, { floor })}
            </Text>
          </View>
        </View>

        {/* Locked Room Status Banner */}
        {isLocked && (
          <View style={styles.roomLockedBanner}>
            <Text style={styles.roomLockedIcon}>🔒</Text>
            <View style={{ flex: 1 }}>
              <Text style={styles.roomLockedTitle}>{t('roomLockedBanner', currentLang)}</Text>
              <Text style={styles.roomLockedSub}>
                {effectivePhotoCount === 0 && onReopenRoom
                  ? t('reopenRoomExplanation', currentLang)
                  : t('roomLockedBannerSub', currentLang)}
              </Text>
              {effectivePhotoCount === 0 && onReopenRoom && (
                <TouchableOpacity style={styles.roomReopenButton} onPress={() => onReopenRoom(room.id)} activeOpacity={0.7}>
                  <Text style={styles.roomReopenButtonText}>{t('reopenRoomMissingPhotos', currentLang)}</Text>
                </TouchableOpacity>
              )}
            </View>
          </View>
        )}

        {/* Action Button direkt unter dem Titel - nur anbieten wenn Raum nicht fertig/gesperrt ist */}
        {!isLocked && (
          <View style={styles.topActionsRow}>
            {/* Außerplanmäßig verbaut */}
            <TouchableOpacity
              style={styles.actionBtnUnclear}
              onPress={() => setShowUnclearModal(true)}
              activeOpacity={0.7}
            >
              <Text style={styles.actionBtnUnclearText}>
                {t('btnUnplannedInstalled', currentLang)}
              </Text>
            </TouchableOpacity>
          </View>
        )}

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

        {/* Gewerke-Filter Kacheln (Horizontal Scroll) */}
        {availableTrades.length > 1 && (
          <View style={styles.tradeFilterSection}>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.tradeFilterRow}
            >
              {availableTrades.map((tradeName) => {
                const isSelected = selectedTrade === tradeName;
                const count = tradeCounts[tradeName] || 0;
                const translatedTradeName = tradeName === 'Alle'
                  ? t('lvAllTrades', currentLang)
                  : translateGroup(tradeName, currentLang);

                return (
                  <TouchableOpacity
                    key={tradeName}
                    style={[styles.tradePill, isSelected && styles.tradePillActive]}
                    onPress={() => setSelectedTrade(tradeName)}
                    activeOpacity={0.7}
                  >
                    <Text
                      style={[styles.tradePillText, isSelected && styles.tradePillTextActive]}
                    >
                      {translatedTradeName}
                      {count > 0 ? ` (${count})` : ''}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </View>
        )}

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

            const isUnplannedMat = Boolean(
              mat.isUnplanned ||
              roomPlan?.isUnplanned ||
              unclearItems?.some((u) => u.materialId === matId || u.pos === mat?.pos)
            );
            const delivered = Number(
              mat.deliveredQty !== undefined && mat.deliveredQty !== null && Number(mat.deliveredQty) > 0
                ? mat.deliveredQty
                : mat.qty || (roomPlan && roomPlan.plannedQty) || 0
            );
            const currentDelta = Number(sessionQuantities[matId]) || 0;
            const totalInstalledAcrossSite = Number(mat.installedQty || 0) + currentDelta;
            const siteStockAvailable = Math.max(0, delivered - totalInstalledAcrossSite);

            return (
              <MaterialBookingCard
                key={mat.id}
                mat={mat}
                roomPlan={roomPlan}
                delta={currentDelta}
                room={room}
                currentLang={currentLang}
                userReason=""
                isLocked={isLocked}
                isUnplanned={isUnplannedMat}
                siteStockAvailable={siteStockAvailable}
                onStep={handleStep}
                onSetDelta={handleSetDelta}
                onDragStateChange={setIsSliderDragging}
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
            {isLocked
              ? t('viewPhotosOnly', currentLang, { n: effectivePhotoCount })
              : effectivePhotoCount > 0
              ? t('photosSavedNotice', currentLang, {
                  n: effectivePhotoCount,
                  label: effectivePhotoCount === 1 ? t('photosSingle', currentLang) : t('photosPlural', currentLang),
                })
              : t('takePhotosRequirement', currentLang)}
          </Text>
        </TouchableOpacity>

        {/* Monteur fertig Button */}
        <TouchableOpacity
          style={[
            styles.monteurFertigBtn,
            isLocked
              ? styles.monteurFertigBtnDone
              : effectivePhotoCount === 0
              ? styles.monteurFertigBtnGrey
              : styles.monteurFertigBtnGreen,
            isRoomCompleted && styles.monteurFertigBtnDone,
          ]}
          onPress={handleMonteurFertigPress}
          activeOpacity={0.8}
        >
          <Text style={styles.monteurFertigBtnText}>
            {isLocked
              ? t('roomLockedCompletedBtn', currentLang)
              : effectivePhotoCount === 0
              ? t('finishRoomPendingPhotos', currentLang)
              : t('finishRoomProgress', currentLang)}
          </Text>
        </TouchableOpacity>
      </View>

      {/* MODAL: AUSSERPLANMÄSSIG VERBAUT */}
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
