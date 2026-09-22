import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  Alert,
  Modal,
  SafeAreaView,
  KeyboardAvoidingView,
  Platform,
  Keyboard,
} from 'react-native';
import { COLORS } from '../constants/theme';
import { t, GLOSSARY } from '../locales/i18n';
import ProgressBar from '../components/ProgressBar';
import SignaturePad from '../components/SignaturePad';

const formatQty = (val) => {
  if (val === null || val === undefined || isNaN(val)) return '0';
  const num = Number(val);
  return num % 1 === 0 ? String(num) : num.toFixed(1);
};

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

  const getRoomPlannedItem = (matId) => {
    if (room.plannedItems && room.plannedItems[matId]) {
      return room.plannedItems[matId];
    }
    if (Array.isArray(room.materials)) {
      const found = room.materials.find((m) => (m.positionId || m.id) === matId || m.posNr === matId);
      if (found) {
        return {
          plannedQty: Number(found.plannedQty || 0),
          installedQty: Number(found.installedQty || 0),
          shortText: found.shortText || found.name || '',
          name: found.shortText || found.name || '',
          cleanName: found.shortText || found.cleanName || found.name || '',
          posNr: found.posNr || '',
          group: found.group || '',
          qu: found.qu || 'Stk',
        };
      }
    }
    return null;
  };

  const getMaterialDisplayName = (mat, roomPlan = null) => {
    if (mat?.cleanName && mat.cleanName !== 'Neues Material') {
      return mat.cleanName;
    }
    if (mat?.shortText && mat.shortText !== 'Neues Material') {
      return mat.shortText;
    }
    if (roomPlan?.shortText && roomPlan.shortText !== 'Neues Material') {
      return roomPlan.shortText;
    }
    if (mat?.name && mat.name !== 'Neues Material') {
      return mat.name;
    }
    if (roomPlan?.cleanName && roomPlan.cleanName !== 'Neues Material') {
      return roomPlan.cleanName;
    }
    if (roomPlan?.name && roomPlan.name !== 'Neues Material') {
      return roomPlan.name;
    }
    if (mat?.longText) {
      return mat.longText;
    }
    if (mat?.pos || roomPlan?.posNr) {
      return `Pos ${mat?.pos || roomPlan?.posNr}`;
    }
    return 'Material';
  };

  // Unclear item Fullscreen Modal
  const [showUnclearModal, setShowUnclearModal] = useState(false);
  const [unclearText, setUnclearText] = useState('');
  const [unclearQty, setUnclearQty] = useState('');
  const [unclearUnit, setUnclearUnit] = useState('Stk'); // 'Stk' | 'm'
  const [selectedUnclearMat, setSelectedUnclearMat] = useState(null);
  const [showUnclearSuggestions, setShowUnclearSuggestions] = useState(false);

  // -------------------------------------------------------------
  // Mehrverbrauch (Over-Consumption) Overlay & Reasons
  // -------------------------------------------------------------
  const [showOverModal, setShowOverModal] = useState(false);
  const [pendingOverMat, setPendingOverMat] = useState(null); // { mat, nextDelta, exceededBy, planned, qu }
  const [overReason, setOverReason] = useState('');
  const [overExtraQty, setOverExtraQty] = useState('1'); // User-adjustable extra quantity (e.g. +8m)
  const [overExplanations, setOverExplanations] = useState({}); // { [matId]: reasonText }

  // -------------------------------------------------------------
  // Raum/Ort fertigstellen (100% Completion) Modal
  // -------------------------------------------------------------
  const [showCompleteModal, setShowCompleteModal] = useState(false);

  // -------------------------------------------------------------
  // Nachtrag Modal & Independent Form States
  // -------------------------------------------------------------
  const [showNachtragModal, setShowNachtragModal] = useState(false);
  const [activeTab, setActiveTab] = useState('material'); // 'material' | 'hours'

  // Form 1: Material Nachtrag (Completely independent state)
  const [matTitle, setMatTitle] = useState('');
  const [matQty, setMatQty] = useState('');
  const [matUnit, setMatUnit] = useState('Stk'); // 'Stk' | 'm'
  const [matBesteller, setMatBesteller] = useState('');
  const [matNote, setMatNote] = useState('');
  const [showMatSuggestions, setShowMatSuggestions] = useState(false);

  // Form 2: Arbeitszeit Nachtrag (Completely independent state)
  const [hoursActivity, setHoursActivity] = useState('');
  const [hoursDuration, setHoursDuration] = useState('');
  const [hoursMonteur, setHoursMonteur] = useState('');
  const [hoursNote, setHoursNote] = useState('');

  // Form 3: Unterschrift & Validation
  const [nachtragSignature, setNachtragSignature] = useState(null);
  const [modalScrollEnabled, setModalScrollEnabled] = useState(true);

  // Pre-fill monteur name as default when opening modal
  const openNachtragModal = () => {
    if (!matBesteller) setMatBesteller(monteur?.name || '');
    if (!hoursMonteur) setHoursMonteur(monteur?.name || '');
    setShowMatSuggestions(false);
    setNachtragSignature(null);
    setModalScrollEnabled(true);
    setShowNachtragModal(true);
  };

  // Validation: List of remaining required fields
  const missingList = activeTab === 'material' ? [
    !matTitle.trim() ? t('reMat', currentLang) : null,
    !matQty.trim() ? t('reQty', currentLang) : null,
    !matBesteller.trim() ? t('reBest', currentLang) : null,
    !matNote.trim() ? t('reNote', currentLang) : null,
    !nachtragSignature ? t('signatureLabel', currentLang) : null,
  ].filter(Boolean) : [
    !hoursActivity.trim() ? t('fldTaetigkeit', currentLang) : null,
    !hoursDuration.trim() ? t('fldStunden', currentLang) : null,
    !hoursMonteur.trim() ? t('monteur', currentLang) : null,
    !hoursNote.trim() ? t('reNote', currentLang) : null,
    !nachtragSignature ? t('signatureLabel', currentLang) : null,
  ].filter(Boolean);

  const isFormValid = missingList.length === 0;

  // Main screen live search filter for material tiles
  const q = searchQuery.trim().toLowerCase();
  const filteredMaterials = q
    ? materials.filter((m) =>
        `${m.pos || ''} ${m.shortText || ''} ${m.name || ''} ${m.cleanName || ''} ${m.group || ''}`
          .toLowerCase()
          .includes(q)
      )
    : [];

  // When searching, display ONLY matching materials (pure filter, no separate autosuggester)
  const displayMaterialIds = q
    ? filteredMaterials.map((m) => m.id)
    : activeMaterialIds;

  // Nachtrag Material GAEB Autosuggester (inside Nachtrag modal)
  const nq = matTitle.trim().toLowerCase();
  const matSuggestions = (showMatSuggestions && nq.length >= 1 && activeTab === 'material')
    ? materials.filter((m) =>
        (m.pos + ' ' + (m.shortText || '') + ' ' + m.name + ' ' + m.cleanName + ' ' + m.group).toLowerCase().includes(nq)
      ).slice(0, 8)
    : [];

  // Unclear Product Autosuggester (inside Unclear modal)
  const uq = unclearText.trim().toLowerCase();
  const unclearSuggestions = (showUnclearSuggestions && uq.length >= 1)
    ? materials.filter((m) =>
        (m.pos + ' ' + (m.shortText || '') + ' ' + m.name + ' ' + m.cleanName + ' ' + (m.group || '')).toLowerCase().includes(uq)
      ).slice(0, 6)
    : [];

  const handleSelectMatSuggestion = (item) => {
    setMatTitle(getMaterialDisplayName(item));
    if (item.qu === 'm') {
      setMatUnit('m');
    } else {
      setMatUnit('Stk');
    }
    setShowMatSuggestions(false);
  };

  const handleSelectUnclearSuggestion = (item) => {
    setUnclearText(getMaterialDisplayName(item));
    setSelectedUnclearMat(item);
    if (item.qu === 'm') {
      setUnclearUnit('m');
    } else {
      setUnclearUnit('Stk');
    }
    setShowUnclearSuggestions(false);
  };

  // Stepper with Over-Quantity / Mehrverbrauch check capped at delivered quantity
  const handleStep = (matId, stepDelta) => {
    let mat = materials.find((m) => m.id === matId || m.pos === matId || m.posNr === matId);
    const roomPlan = getRoomPlannedItem(matId);
    if (!mat && roomPlan) {
      mat = {
        id: matId,
        pos: roomPlan.posNr || matId,
        name: roomPlan.shortText || roomPlan.name || 'Material',
        cleanName: roomPlan.shortText || roomPlan.cleanName || roomPlan.name || 'Material',
        shortText: roomPlan.shortText || '',
        group: roomPlan.group || 'Allgemein',
        qu: roomPlan.qu || 'Stk',
        deliveredQty: Number(roomPlan.plannedQty || 0),
        installedQty: Number(roomPlan.installedQty || 0),
      };
    }
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
        : (mat.qty || (roomPlan && roomPlan.plannedQty) || 0)
    );
    const hasRoomPlan = Boolean(roomPlan);
    const planned = hasRoomPlan ? Number(roomPlan.plannedQty) : delivered;
    const installedBefore = hasRoomPlan
      ? Number(roomPlan.installedQty || 0)
      : Number(mat.installedQty || 0);

    const availableToInstall = delivered - (installedBefore + currentDelta);

    // If delivered is 0 or nothing left in stock
    if (delivered === 0 || availableToInstall <= 0) {
      Alert.alert(
        'Leider nichts mehr da',
        'Leider nichts mehr da. Bitte nachbestellen.'
      );
      return;
    }

    const nextDelta = currentDelta + stepDelta;
    const nextTotalVerb = installedBefore + nextDelta;

    // If stepping UP and exceeding planned quantity
    if (nextTotalVerb > planned) {
      // 1. Overall cap: Cannot exceed delivered quantity of the project
      if (nextTotalVerb > delivered) {
        Alert.alert(
          'Leider nichts mehr da',
          'Leider nichts mehr da. Bitte nachbestellen.'
        );
        return;
      }

      // 2. Mehrverbrauch is only possible if delivered > planned
      if (delivered <= planned) {
        Alert.alert(
          t('noOverPossible', currentLang),
          t('noOverPossibleMsg', currentLang, { delivered, planned, qu: mat.qu })
        );
        return;
      }

      // 3. Trigger Mehrverbrauch explanation if not yet explained
      if (!overExplanations[matId]) {
        const exceeded = Math.max(1, nextTotalVerb - planned);
        const maxPossibleExtra = Math.max(0, delivered - (hasRoomPlan ? planned : installedBefore));
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
        setOverExtraQty(String(initialExtra % 1 === 0 ? initialExtra : initialExtra.toFixed(1)));
        setOverReason('');
        setShowOverModal(true);
        return;
      }
    }

    // Keep searched material visible in room list once interacted with
    if (!activeMaterialIds.includes(matId)) {
      setActiveMaterialIds((prev) => [matId, ...prev]);
    }

    onQuantityChange(matId, nextDelta);
  };

  // Adjust extra quantity inside Mehrverbrauch modal via stepper
  const handleStepOverExtra = (delta) => {
    const current = parseFloat(overExtraQty) || 1;
    let next = Math.max(0.5, current + delta);
    setOverExtraQty(String(next % 1 === 0 ? next : Number(next.toFixed(1))));
  };

  // Confirming Mehrverbrauch Overlay
  const handleConfirmOverReason = (reasonToUse) => {
    if (!pendingOverMat) return;
    const finalReason = (reasonToUse || overReason).trim();
    if (!finalReason) return;
    const extraNum = Math.max(0.1, parseFloat(overExtraQty) || 1);

    const roomPlan = getRoomPlannedItem(pendingOverMat.mat.id);
    const hasRoomPlan = Boolean(roomPlan);
    const installedBefore = pendingOverMat.installedBefore !== undefined
      ? pendingOverMat.installedBefore
      : (hasRoomPlan
          ? Number(roomPlan.installedQty || 0)
          : Number(pendingOverMat.mat.installedQty || 0));

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
        materialName: getMaterialDisplayName(pendingOverMat.mat, getRoomPlannedItem(pendingOverMat.mat.id)),
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

  // Check photos & status for "Monteur fertig" button
  const effectivePhotos = (sessionPhotos && sessionPhotos.length > 0)
    ? sessionPhotos
    : (Array.isArray(room.photos) ? room.photos : []);
  const effectivePhotoCount = effectivePhotos.length;
  const isRoomCompleted = room.isCompleted || room.pct === 100;

  // Calculate live room percentage based on installed before + current delta
  const calculateCurrentRoomPct = () => {
    if (room.isCompleted) return 100;
    let totalPlanned = 0;
    let totalInstalled = 0;
    activeMaterialIds.forEach((matId) => {
      const roomPlan = getRoomPlannedItem(matId);
      const mat = materials.find((m) => m.id === matId || m.pos === matId || m.posNr === matId);
      const planned = roomPlan ? Number(roomPlan.plannedQty || 0) : Number(mat?.deliveredQty || 0);
      const installedBefore = roomPlan ? Number(roomPlan.installedQty || 0) : Number(mat?.installedQty || 0);
      const delta = Number(sessionQuantities[matId]) || 0;
      totalPlanned += planned;
      totalInstalled += (installedBefore + delta);
    });

    if (totalPlanned > 0) {
      return Math.min(100, Math.round((totalInstalled / totalPlanned) * 100));
    }
    return room.pct !== undefined ? room.pct : 0;
  };

  const handleMonteurFertigPress = () => {
    if (effectivePhotoCount === 0 && !isRoomCompleted) {
      Alert.alert(
        t('photosRequiredTitle', currentLang) || 'Fotos erforderlich',
        t('photosRequiredMsg', currentLang) || 'Bitte hinterlege mindestens 1 Foto der Montagearbeiten, bevor du den Raum abschließt.',
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

  // Confirming 100% Room Completion & Calculating Delta
  const handleConfirmCompleteRoom = () => {
    const deltaSummary = [];
    activeMaterialIds.forEach((matId) => {
      let mat = materials.find((m) => m.id === matId || m.pos === matId || m.posNr === matId);
      const roomPlan = getRoomPlannedItem(matId);
      if (!mat && roomPlan) {
        mat = {
          id: matId,
          pos: roomPlan.posNr || matId,
          name: roomPlan.shortText || roomPlan.name || 'Material',
          cleanName: roomPlan.shortText || roomPlan.cleanName || roomPlan.name || 'Material',
          shortText: roomPlan.shortText || '',
          group: roomPlan.group || 'Allgemein',
          qu: roomPlan.qu || 'Stk',
          deliveredQty: Number(roomPlan.plannedQty || 0),
          installedQty: Number(roomPlan.installedQty || 0),
        };
      }
      if (!mat) return;

      const hasRoomPlan = Boolean(roomPlan);
      const planned = hasRoomPlan ? Number(roomPlan.plannedQty) : null;
      const installedBefore = hasRoomPlan
        ? Number(roomPlan.installedQty || 0)
        : Number(mat.installedQty || 0);
      const delta = Number(sessionQuantities[matId]) || 0;
      const totalInstalled = installedBefore + delta;

      deltaSummary.push({
        materialId: mat.id,
        pos: mat.pos,
        name: getMaterialDisplayName(mat, roomPlan),
        qu: mat.qu || roomPlan?.qu || 'Stk',
        plannedQty: planned,
        installedQty: totalInstalled,
        diff: planned !== null ? Number((planned - totalInstalled).toFixed(2)) : 0,
        status: planned !== null
          ? (totalInstalled > planned ? 'over' : totalInstalled < planned ? 'under' : 'exact')
          : 'documented',
      });
    });

    if (onCompleteRoom) {
      onCompleteRoom(room.id, deltaSummary, sessionQuantities, effectivePhotos);
    }
    setShowCompleteModal(false);
  };

  const handleSaveUnclear = () => {
    if (!unclearText.trim()) return;
    const cleanQty = unclearQty.trim() || '1';
    onAddUnclearItem({
      txt: unclearText.trim(),
      qty: `${cleanQty} ${unclearUnit}`,
      qu: unclearUnit,
      itemOz: selectedUnclearMat ? selectedUnclearMat.pos : 'UNKLAR',
      pos: selectedUnclearMat ? selectedUnclearMat.pos : null,
      materialId: selectedUnclearMat ? selectedUnclearMat.id : null,
      isOrdered: !!selectedUnclearMat,
      roomId: room.id,
      roomName: room.name,
    });
    setUnclearText('');
    setUnclearQty('');
    setSelectedUnclearMat(null);
    setShowUnclearModal(false);
    setShowUnclearSuggestions(false);
  };

  // Save Nachtrag (dispatches according to active tab with separate payloads)
  const handleSubmitNachtrag = () => {
    if (!isFormValid) {
      return;
    }
    if (activeTab === 'material') {
      const cleanQty = matQty.trim() || '1';
      onAddNachtrag({
        roomId: room.id,
        roomName: room.name,
        type: 'material',
        title: matTitle.trim(),
        quantity: `${cleanQty} ${matUnit}`,
        qu: matUnit,
        requestedBy: matBesteller.trim() || monteur?.name || 'Monteur',
        note: matNote.trim(),
        signature: nachtragSignature,
      });

      // Clear material form
      setMatTitle('');
      setMatQty('');
      setMatNote('');
      setNachtragSignature(null);
    } else {
      // Arbeitszeit / Stundenlohn
      const cleanHours = hoursDuration.trim() || '1';
      onAddNachtrag({
        roomId: room.id,
        roomName: room.name,
        type: 'stunden',
        title: hoursActivity.trim(),
        quantity: `${cleanHours} h`,
        qu: 'h',
        requestedBy: hoursMonteur.trim() || monteur?.name || 'Monteur',
        note: hoursNote.trim(),
        signature: nachtragSignature,
      });

      // Clear hours form
      setHoursActivity('');
      setHoursDuration('');
      setHoursNote('');
      setNachtragSignature(null);
    }

    setShowNachtragModal(false);
    Alert.alert(
      t('doneTitle', currentLang) || 'Erfasst',
      t('mehrbedarfSaved', currentLang) || 'Mehrbedarf wurde zur Synchronisation hinterlegt.'
    );
  };

  const getForeignGloss = (mat) => {
    if (currentLang === 'de') return '';
    const key = mat.icon === 'bend' ? 'bogen' : mat.icon === 'valve' ? 'ventil' : mat.icon === 'clamp' ? 'schelle' : 'rohr';
    return GLOSSARY[key]?.[currentLang] || '';
  };

  const getMatIconSymbol = (icon) => {
    switch (icon) {
      case 'bend': return '↪';
      case 'valve': return '⨂';
      case 'clamp': return '◯';
      case 'tee': return '┬';
      default: return '━';
    }
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

        {/* Action Buttons direkt unter dem Titel */}
        <View style={styles.topActionsRow}>
          {/* Button 1: Nachtrag */}
          <TouchableOpacity
            style={styles.actionBtnNachtrag}
            onPress={openNachtragModal}
            activeOpacity={0.7}
          >
            <Text style={styles.actionBtnNachtragText}>＋ {t('nachtrag', currentLang)}</Text>
          </TouchableOpacity>

          {/* Button 2: Position unklar (Öffnet Fullscreen Overlay) */}
          <TouchableOpacity
            style={styles.actionBtnUnclear}
            onPress={() => setShowUnclearModal(true)}
            activeOpacity={0.7}
          >
            <Text style={styles.actionBtnUnclearText}>
              ❓ {t('unclearBtnShort', currentLang)}
            </Text>
          </TouchableOpacity>
        </View>

        {/* Unclear items list */}
        {unclearItems.length > 0 && (
          <View style={styles.unclearSectionWrapper}>
            <Text style={styles.unclearSectTitle}>{t('unclearSection', currentLang)}</Text>
            {unclearItems.map((u, i) => (
              <View key={i} style={styles.unclearRow}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.uName}>{u.txt}</Text>
                  <Text style={styles.uSub}>
                    {u.pos ? `Pos ${u.pos} · ` : ''}{u.qty} · {room.name}
                  </Text>
                </View>
                <View style={styles.uBadge}>
                  <Text style={styles.uBadgeText}>
                    {t('unclearOpenBadge', currentLang)}
                  </Text>
                </View>
              </View>
            ))}
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

        {/* Active Material Booking Rows (filtered live when typing) */}
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
            let mat = materials.find((m) => m.id === matId || m.pos === matId || m.posNr === matId);
            const roomPlan = getRoomPlannedItem(matId);
            if (!mat && roomPlan) {
              mat = {
                id: matId,
                pos: roomPlan.posNr || matId,
                name: roomPlan.shortText || roomPlan.name || 'Material',
                cleanName: roomPlan.shortText || roomPlan.cleanName || roomPlan.name || 'Material',
                shortText: roomPlan.shortText || '',
                group: roomPlan.group || 'Allgemein',
                qu: roomPlan.qu || 'Stk',
                deliveredQty: Number(roomPlan.plannedQty || 0),
                installedQty: Number(roomPlan.installedQty || 0),
              };
            }
            if (!mat) return null;

            const displayName = getMaterialDisplayName(mat, roomPlan);
            const displayGroup = (mat?.group && mat.group !== 'Allgemein')
              ? mat.group
              : (roomPlan?.group || mat?.group || 'Allgemein');
            const displayQu = mat?.qu || roomPlan?.qu || 'Stk';

            const delta = Number(sessionQuantities[matId]) || 0;
            const hasRoomPlan = Boolean(roomPlan);
            const roomPlanned = hasRoomPlan ? Number(roomPlan.plannedQty) : null;
            const roomInstalledBefore = hasRoomPlan
              ? Number(roomPlan.installedQty || 0)
              : Number(mat.installedQty || 0);

            const currentRoomVerb = roomInstalledBefore + delta;
            const projectDelivered = Number(
              mat.deliveredQty !== undefined && mat.deliveredQty !== null && Number(mat.deliveredQty) > 0
                ? mat.deliveredQty
                : (mat.qty || (roomPlan && roomPlan.plannedQty) || 0)
            );

            // Target for planning
            const baseTarget = hasRoomPlan ? roomPlanned : projectDelivered;

            // Verfügbar: Geht mit jedem verbaut nach unten :)
            const availableQty = Math.max(0, baseTarget - currentRoomVerb);

            const isOver = currentRoomVerb > baseTarget;
            const exceededBy = Math.max(0, currentRoomVerb - baseTarget);

            // Progress percentage: strictly capped at 100%
            const progressPct = baseTarget > 0
              ? Math.min(100, Math.round((currentRoomVerb / baseTarget) * 100))
              : 0;

            const gloss = getForeignGloss(mat);
            const userReason = overExplanations[mat.id];

            return (
              <View
                key={mat.id}
                style={[
                  styles.bookCard,
                  isOver && styles.bookCardOver,
                  room.isCompleted && styles.bookCardCompleted,
                ]}
              >
                {/* 1. TOP: Icon left + Full-width Title & Subtitle */}
                <View style={styles.cardHeaderRow}>
                  <View style={[styles.iconBox, isOver && styles.iconBoxOver]}>
                    <Text style={[styles.iconSymbol, isOver && styles.iconSymbolOver]}>
                      {getMatIconSymbol(mat.icon)}
                    </Text>
                  </View>

                  <View style={styles.cardHeaderCol}>
                    <View style={styles.posRow}>
                      <View style={styles.posChip}>
                        <Text style={styles.posChipText}>Pos {mat.pos}</Text>
                      </View>
                      {mat.containsHint ? (
                        <View style={styles.hintChip}>
                          <Text style={styles.hintChipText} numberOfLines={1}>
                            {mat.containsHint}
                          </Text>
                        </View>
                      ) : null}
                      {isOver ? (
                        <View style={styles.overBadge}>
                          <Text style={styles.overBadgeText}>
                            +{formatQty(exceededBy)} {displayQu} {t('overConsumptionBadge', currentLang)}
                          </Text>
                        </View>
                      ) : null}
                    </View>

                    <Text style={styles.matName}>
                      {displayName}
                      {gloss ? <Text style={styles.matGloss}> ({gloss})</Text> : null}
                    </Text>
                    <Text style={styles.matGroup}>{displayGroup}</Text>
                  </View>
                </View>

                {/* 2. 3-Metrics Matrix: Geplant | Verfügbar | Verbaut */}
                <View style={styles.metricsContainer}>
                  {/* Geplant (Raum oder GAEB-Fallback) */}
                  <View style={styles.metricCell}>
                    <Text style={styles.metricLabel}>{t('matrixPlanned', currentLang)}</Text>
                    <Text style={styles.metricValue}>
                      {hasRoomPlan ? `${formatQty(roomPlanned)} ` : '–'}
                      {hasRoomPlan ? <Text style={styles.metricUnit}>{displayQu}</Text> : ''}
                    </Text>
                    <Text style={styles.metricSub}>
                      {hasRoomPlan ? t('matrixRoom', currentLang) : t('matrixOnlyGaeb', currentLang)}
                    </Text>
                  </View>

                  <View style={styles.metricDivider} />

                  {/* Verfügbar (Geht mit jedem verbaut nach unten :) */}
                  <View style={styles.metricCell}>
                    <Text style={styles.metricLabel}>{t('matrixAvailable', currentLang)}</Text>
                    <Text
                      style={[
                        styles.metricValue,
                        isOver
                          ? styles.metricValOver
                          : availableQty === 0
                          ? styles.metricValDone
                          : null,
                      ]}
                    >
                      {isOver ? `-${formatQty(exceededBy)}` : formatQty(availableQty)}{' '}
                      <Text style={styles.metricUnit}>{displayQu}</Text>
                    </Text>
                    <Text style={styles.metricSub}>
                      {isOver ? t('matrixOver', currentLang) : t('matrixOpen', currentLang)}
                    </Text>
                  </View>

                  <View style={styles.metricDivider} />

                  {/* Verbaut (In Raum) */}
                  <View style={styles.metricCell}>
                    <Text style={styles.metricLabel}>{t('matrixInstalled', currentLang)}</Text>
                    <Text style={[styles.metricValue, isOver && styles.metricValOver]}>
                      {formatQty(currentRoomVerb)} <Text style={styles.metricUnit}>{displayQu}</Text>
                    </Text>
                    <Text style={styles.metricSub}>{t('matrixInRoom', currentLang)}</Text>
                  </View>
                </View>

                {/* 3. Progress Bar (Capped at 100%) */}
                <View style={styles.progressRow}>
                  <View style={{ flex: 1 }}>
                    <ProgressBar progress={progressPct} isOver={isOver} height={6} />
                  </View>
                  <Text style={[styles.progressPctText, isOver && styles.progressPctTextOver]}>
                    {progressPct} %
                  </Text>
                </View>

                {/* 4. Bottom Row: Reason note (if over) + Stepper bottom right */}
                <View style={styles.cardFooterRow}>
                  <View style={{ flex: 1, paddingRight: 8 }}>
                    {userReason ? (
                      <TouchableOpacity
                        style={styles.reasonBadge}
                        onPress={() => {
                          setPendingOverMat({
                            mat,
                            nextDelta: delta,
                            exceededBy,
                            planned: baseTarget,
                            installedBefore,
                            qu: mat.qu,
                          });
                          setOverExtraQty(String(exceededBy > 0 ? (exceededBy % 1 === 0 ? exceededBy : exceededBy.toFixed(1)) : '1'));
                          setOverReason(userReason);
                          setShowOverModal(true);
                        }}
                      >
                        <Text style={styles.reasonBadgeText} numberOfLines={1}>
                          ⚠️ {userReason}
                        </Text>
                      </TouchableOpacity>
                    ) : isOver ? (
                      <Text style={styles.overWarningText}>
                        ⚠️ {t('overRecorded', currentLang)}
                      </Text>
                    ) : null}
                  </View>

                  {/* Stepper (+ / −) */}
                  <View style={styles.stepperWrapper}>
                    <TouchableOpacity
                      style={styles.stepperBtn}
                      onPress={() => handleStep(mat.id, -1)}
                      activeOpacity={0.6}
                    >
                      <Text style={styles.stepperBtnText}>−</Text>
                    </TouchableOpacity>

                    <View style={styles.stepperValBox}>
                      <Text style={styles.stepperValText}>
                        {delta > 0 ? `+${delta}` : delta}
                      </Text>
                      <Text style={styles.stepperUnitText}>
                        {mat.qu} {t('perWeek', currentLang)}
                      </Text>
                    </View>

                    <TouchableOpacity
                      style={styles.stepperBtn}
                      onPress={() => handleStep(mat.id, 1)}
                      activeOpacity={0.6}
                    >
                      <Text style={styles.stepperBtnText}>+</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              </View>
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

        {/* Monteur fertig Button (direkt unter Weiter zu Fotos) */}
        <TouchableOpacity
          style={[
            styles.monteurFertigBtn,
            (effectivePhotoCount === 0 && !isRoomCompleted)
              ? styles.monteurFertigBtnGrey
              : styles.monteurFertigBtnGreen,
            isRoomCompleted && styles.monteurFertigBtnDone,
          ]}
          onPress={handleMonteurFertigPress}
          activeOpacity={0.8}
        >
          <Text style={styles.monteurFertigBtnText}>
            {isRoomCompleted
              ? '✓ Raum fertiggestellt'
              : (effectivePhotoCount === 0
                ? 'Monteur fertig (Fotos erforderlich)'
                : '✓ Monteur fertig (Abnahme starten)')}
          </Text>
        </TouchableOpacity>
      </View>

      {/* ------------------------------------------------------------- */}
      {/* FULLSCREEN NACHTRAG MODAL WITH INDEPENDENT TABS & INPUTS     */}
      {/* ------------------------------------------------------------- */}
      <Modal visible={showNachtragModal} animationType="slide" presentationStyle="fullScreen">
        <SafeAreaView style={styles.modalFullscreen}>
          {/* Fullscreen Modal Header with Close '✕' Button */}
          <View style={styles.modalHeader}>
            <View style={styles.modalTitleBox}>
              <Text style={styles.modalMainTitle}>📋 {t('nachtragTitle', currentLang)}</Text>
              <Text style={styles.modalSubTitle}>{room.name} · {t('nachtragSub', currentLang)}</Text>
            </View>
            <TouchableOpacity
              style={styles.modalCloseBtn}
              onPress={() => setShowNachtragModal(false)}
              activeOpacity={0.7}
            >
              <Text style={styles.modalCloseIcon}>✕</Text>
            </TouchableOpacity>
          </View>

          {/* Segmented Control Tabs: Material vs Arbeitszeit */}
          <View style={styles.tabBarContainer}>
            <TouchableOpacity
              style={[styles.segmentTab, activeTab === 'material' && styles.segmentTabActive]}
              onPress={() => setActiveTab('material')}
              activeOpacity={0.7}
            >
              <Text style={[styles.segmentText, activeTab === 'material' && styles.segmentTextActive]}>
                📦 {t('typeMat', currentLang)}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.segmentTab, activeTab === 'hours' && styles.segmentTabActive]}
              onPress={() => setActiveTab('hours')}
              activeOpacity={0.7}
            >
              <Text style={[styles.segmentText, activeTab === 'hours' && styles.segmentTextActive]}>
                ⏱ {t('typeStd', currentLang)}
              </Text>
            </TouchableOpacity>
          </View>

          <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : undefined}
            style={{ flex: 1 }}
          >
            <ScrollView
              style={styles.modalBody}
              contentContainerStyle={styles.modalScrollContent}
              keyboardShouldPersistTaps="handled"
              scrollEnabled={modalScrollEnabled}
            >
              {/* ========================================================= */}
              {/* TAB 1: MATERIAL NACHTRAG                                 */}
              {/* ========================================================= */}
              {activeTab === 'material' && (
                <View>
                  {/* Material / Artikel mit GAEB Autosuggester */}
                  <View style={styles.modalField}>
                    <Text style={styles.modalFieldLabel}>{t('reMat', currentLang)} <Text style={styles.requiredStar}>*</Text></Text>
                    <TextInput
                      style={[styles.modalInput, !matTitle.trim() && styles.inputInvalid]}
                      placeholder="z. B. DIN 100, Bogen, Schelle, Kugelhahn..."
                      placeholderTextColor={COLORS.muted}
                      value={matTitle}
                      onChangeText={(val) => {
                        setMatTitle(val);
                        setShowMatSuggestions(true);
                      }}
                      onFocus={() => setShowMatSuggestions(true)}
                    />

                    {/* GAEB Suggestions Dropdown */}
                    {matSuggestions.length > 0 && (
                      <View style={styles.suggestionsContainer}>
                        <Text style={styles.suggestionsHeader}>{t('unclearOrderedSuggestions', currentLang)}</Text>
                        {matSuggestions.map((item) => (
                          <TouchableOpacity
                            key={item.id}
                            style={styles.suggestionItem}
                            onPress={() => handleSelectMatSuggestion(item)}
                          >
                            <View style={styles.sugTopRow}>
                              <View style={styles.sugPosChip}>
                                <Text style={styles.sugPosText}>Pos {item.pos}</Text>
                              </View>
                              <Text style={styles.sugUnitBadge}>{item.qu === 'm' ? t('unitMeters', currentLang) : t('unitPieces', currentLang)}</Text>
                            </View>
                            <Text style={styles.sugTitle}>{getMaterialDisplayName(item)}</Text>
                            <Text style={styles.sugGroup}>{item.group}</Text>
                          </TouchableOpacity>
                        ))}
                      </View>
                    )}
                  </View>

                  {/* Einheit & Mengeneingabe */}
                  <View style={styles.modalField}>
                    <Text style={styles.modalFieldLabel}>{t('unclearSelectUnit', currentLang)} <Text style={styles.requiredStar}>*</Text></Text>
                    <View style={styles.unitSelectorRow}>
                      <TouchableOpacity
                        style={[styles.unitToggle, matUnit === 'Stk' && styles.unitToggleActive]}
                        onPress={() => setMatUnit('Stk')}
                      >
                        <Text style={[styles.unitToggleText, matUnit === 'Stk' && styles.unitToggleTextActive]}>
                          {t('unitPieces', currentLang)}
                        </Text>
                      </TouchableOpacity>

                      <TouchableOpacity
                        style={[styles.unitToggle, matUnit === 'm' && styles.unitToggleActive]}
                        onPress={() => setMatUnit('m')}
                      >
                        <Text style={[styles.unitToggleText, matUnit === 'm' && styles.unitToggleTextActive]}>
                          {t('unitMeters', currentLang)}
                        </Text>
                      </TouchableOpacity>
                    </View>

                    <TextInput
                      style={[styles.modalInput, !matQty.trim() && styles.inputInvalid]}
                      placeholder={matUnit === 'm' ? t('unclearQtyMeterPlaceholder', currentLang) : t('unclearQtyPiecePlaceholder', currentLang)}
                      placeholderTextColor={COLORS.muted}
                      keyboardType="decimal-pad"
                      value={matQty}
                      onChangeText={setMatQty}
                    />
                  </View>

                  {/* Besteller / Auftraggeber (Default: Monteurname) */}
                  <View style={styles.modalField}>
                    <Text style={styles.modalFieldLabel}>{t('reBest', currentLang)} <Text style={styles.requiredStar}>*</Text></Text>
                    <TextInput
                      style={[styles.modalInput, !matBesteller.trim() && styles.inputInvalid]}
                      placeholder={t('reBest', currentLang)}
                      placeholderTextColor={COLORS.muted}
                      value={matBesteller}
                      onChangeText={setMatBesteller}
                    />
                  </View>

                  {/* Kommentar / Begründung (3 Zeilen) */}
                  <View style={styles.modalField}>
                    <Text style={styles.modalFieldLabel}>{t('reNote', currentLang)} <Text style={styles.requiredStar}>*</Text></Text>
                    <TextInput
                      style={[styles.modalInput, styles.multilineInput, !matNote.trim() && styles.inputInvalid]}
                      placeholder={t('overCommentPlaceholder', currentLang)}
                      placeholderTextColor={COLORS.muted}
                      multiline={true}
                      numberOfLines={3}
                      value={matNote}
                      onChangeText={setMatNote}
                    />
                  </View>
                </View>
              )}

              {/* ========================================================= */}
              {/* TAB 2: ARBEITSZEIT NACHTRAG                              */}
              {/* ========================================================= */}
              {activeTab === 'hours' && (
                <View>
                  {/* Ausgeführte Tätigkeit */}
                  <View style={styles.modalField}>
                    <Text style={styles.modalFieldLabel}>{t('fldTaetigkeit', currentLang)} <Text style={styles.requiredStar}>*</Text></Text>
                    <TextInput
                      style={[styles.modalInput, !hoursActivity.trim() && styles.inputInvalid]}
                      placeholder="z. B. Kernbohrung DN 150 + Mauerdurchbruch..."
                      placeholderTextColor={COLORS.muted}
                      value={hoursActivity}
                      onChangeText={setHoursActivity}
                    />
                  </View>

                  {/* Stunden & Schnellwahl */}
                  <View style={styles.modalField}>
                    <Text style={styles.modalFieldLabel}>{t('fldStunden', currentLang)} <Text style={styles.requiredStar}>*</Text></Text>
                    <TextInput
                      style={[styles.modalInput, !hoursDuration.trim() && styles.inputInvalid]}
                      placeholder="z. B. 2.5"
                      placeholderTextColor={COLORS.muted}
                      keyboardType="decimal-pad"
                      value={hoursDuration}
                      onChangeText={setHoursDuration}
                    />

                    {/* Quick Duration Pills */}
                    <View style={styles.quickPillsRow}>
                      {['0.5', '1.0', '2.0', '3.5', '8.0'].map((h) => (
                        <TouchableOpacity
                          key={h}
                          style={[styles.pill, hoursDuration === h && styles.pillActive]}
                          onPress={() => setHoursDuration(h)}
                        >
                          <Text style={[styles.pillText, hoursDuration === h && styles.pillTextActive]}>
                            +{h} h
                          </Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  </View>

                  {/* Monteur / Ausführender (Default: Monteurname) */}
                  <View style={styles.modalField}>
                    <Text style={styles.modalFieldLabel}>{t('monteur', currentLang)} / {t('reBest', currentLang)} <Text style={styles.requiredStar}>*</Text></Text>
                    <TextInput
                      style={[styles.modalInput, !hoursMonteur.trim() && styles.inputInvalid]}
                      placeholder={t('monteur', currentLang)}
                      placeholderTextColor={COLORS.muted}
                      value={hoursMonteur}
                      onChangeText={setHoursMonteur}
                    />
                  </View>

                  {/* Begründung / Notiz (3 Zeilen) */}
                  <View style={styles.modalField}>
                    <Text style={styles.modalFieldLabel}>{t('reNote', currentLang)} <Text style={styles.requiredStar}>*</Text></Text>
                    <TextInput
                      style={[styles.modalInput, styles.multilineInput, !hoursNote.trim() && styles.inputInvalid]}
                      placeholder={t('overCommentPlaceholder', currentLang)}
                      placeholderTextColor={COLORS.muted}
                      multiline={true}
                      numberOfLines={3}
                      value={hoursNote}
                      onChangeText={setHoursNote}
                    />
                  </View>
                </View>
              )}

              {/* ========================================================= */}
              {/* UNTERSCHRIFTENFELD (AM ENDE DER BEGRÜNDUNG)               */}
              {/* ========================================================= */}
              <SignaturePad
                key={`sig-${activeTab}`}
                isInvalid={!nachtragSignature}
                currentLang={currentLang}
                onSignatureChange={(hasSig, paths) => setNachtragSignature(hasSig ? paths : null)}
                onDrawStart={() => setModalScrollEnabled(false)}
                onDrawEnd={() => setModalScrollEnabled(true)}
              />

              {/* ========================================================= */}
              {/* GRAUER BALKEN: NOCH AUSZUFÜLLENDE FELDER                  */}
              {/* ========================================================= */}
              {missingList.length > 0 ? (
                <View style={styles.missingHintBar}>
                  <Text style={styles.missingHintIcon}>ℹ️</Text>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.missingHintTitle}>{t('missingFieldsTitle', currentLang)}</Text>
                    <Text style={styles.missingHintList}>
                      {missingList.join(' · ')}
                    </Text>
                  </View>
                </View>
              ) : (
                <View style={styles.completeHintBar}>
                  <Text style={styles.completeHintIcon}>✓</Text>
                  <Text style={styles.completeHintText}>{t('fieldsComplete', currentLang)}</Text>
                </View>
              )}

              {/* Submit CTA Button - Grau solange unvollständig oder ohne Unterschrift */}
              <TouchableOpacity
                style={[
                  styles.modalSubmitBtn,
                  !isFormValid && styles.modalSubmitBtnDisabled,
                ]}
                onPress={handleSubmitNachtrag}
                disabled={!isFormValid}
                activeOpacity={0.8}
              >
                <Text
                  style={[
                    styles.modalSubmitText,
                    !isFormValid && styles.modalSubmitTextDisabled,
                  ]}
                >
                  {isFormValid ? '✓ ' : ''}{activeTab === 'material' ? t('reCreate', currentLang) : t('reCreateHours', currentLang)}
                </Text>
              </TouchableOpacity>
            </ScrollView>
          </KeyboardAvoidingView>
        </SafeAreaView>
      </Modal>

      {/* ------------------------------------------------------------- */}
      {/* FULLSCREEN OVERLAY: MEHRVERBRAUCH ERFASSEN                   */}
      {/* ------------------------------------------------------------- */}
      <Modal visible={showOverModal} animationType="slide" presentationStyle="fullScreen">
        {(() => {
          const hasOverReason = Boolean(overReason && overReason.trim().length > 0);
          const maxPossibleExtra = pendingOverMat?.maxPossibleExtra !== undefined ? pendingOverMat.maxPossibleExtra : 9999;
          const isOverDelivery = pendingOverMat?.maxPossibleExtra !== undefined && (parseFloat(overExtraQty) || 0) > maxPossibleExtra;
          const extraNum = parseFloat(overExtraQty) || 0;
          const plannedNum = pendingOverMat?.planned || 0;
          const totalNewVerbaut = (plannedNum + extraNum).toFixed(1).replace(/\.0$/, '');

          return (
            <SafeAreaView style={styles.modalFullscreen}>
              {/* Header with Title and Close '✕' Button */}
              <View style={styles.modalHeader}>
                <View style={styles.modalTitleBox}>
                  <Text style={styles.modalMainTitle}>⚠️ {t('overTitle', currentLang)}</Text>
                  <Text style={styles.modalSubTitle}>
                    {room.name} ({room.code}) · Pos {pendingOverMat?.mat?.pos}
                  </Text>
                </View>
                <TouchableOpacity
                  style={styles.modalCloseBtn}
                  onPress={() => {
                    setShowOverModal(false);
                    setPendingOverMat(null);
                  }}
                  activeOpacity={0.7}
                  hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
                >
                  <Text style={styles.modalCloseIcon}>✕</Text>
                </TouchableOpacity>
              </View>

              <KeyboardAvoidingView
                behavior={Platform.OS === 'ios' ? 'padding' : undefined}
                style={{ flex: 1 }}
              >
                <ScrollView
                  style={styles.modalBody}
                  contentContainerStyle={[styles.modalScrollContent, { paddingBottom: 24 }]}
                  keyboardShouldPersistTaps="handled"
                >
                  {/* 1. OBEN: "Bei diesem Produkt hast du mehr als geplant verbaut!" */}
                  <View style={styles.overNoticeBox}>
                    <View style={styles.overNoticeHeader}>
                      <Text style={styles.overNoticeIcon}>⚠️</Text>
                      <Text style={styles.overNoticeTitle}>
                        {t('overProductHint', currentLang)}
                      </Text>
                    </View>

                    <Text style={styles.overNoticeMatName}>
                      {getMaterialDisplayName(pendingOverMat?.mat, getRoomPlannedItem(pendingOverMat?.mat?.id))}
                    </Text>

                    <View style={styles.overNoticeMetaRow}>
                      <View style={styles.posChip}>
                        <Text style={styles.posChipText}>Pos {pendingOverMat?.mat?.pos}</Text>
                      </View>
                      <Text style={styles.overNoticeMetaText}>
                        {t('matrixPlanned', currentLang)}: <Text style={{ fontWeight: '800', color: COLORS.ink }}>{pendingOverMat?.planned} {pendingOverMat?.qu}</Text>
                        {' · '}{t('overNewInstalled', currentLang)}: <Text style={{ fontWeight: '800', color: COLORS.red }}>{totalNewVerbaut} {pendingOverMat?.qu}</Text>
                      </Text>
                    </View>
                  </View>

                  {/* 2. DARUNTER DIE ZAHL: Stepper & Schnellauswahl (wird rot wenn mehr als Lieferung) */}
                  <View style={styles.modalField}>
                    <Text style={styles.modalFieldLabel}>
                      {t('overExtraQtyLabel', currentLang)} ({pendingOverMat?.qu}):
                    </Text>

                    <View style={styles.overQtyControlRow}>
                      <TouchableOpacity
                        style={styles.overStepBtn}
                        onPress={() => handleStepOverExtra(-1)}
                        activeOpacity={0.7}
                      >
                        <Text style={styles.overStepBtnText}>−</Text>
                      </TouchableOpacity>

                      <View
                        style={[
                          styles.overInputWrap,
                          isOverDelivery && styles.overInputWrapWarn,
                        ]}
                      >
                        <Text style={[styles.overPlusSign, isOverDelivery && { color: COLORS.red }]}>+</Text>
                        <TextInput
                          style={[styles.overQtyInput, isOverDelivery && { color: COLORS.red }]}
                          value={overExtraQty}
                          onChangeText={(val) => {
                            const clean = val.replace(',', '.');
                            setOverExtraQty(clean);
                          }}
                          keyboardType="decimal-pad"
                          placeholder="z. B. 3"
                          placeholderTextColor={COLORS.muted}
                          selectTextOnFocus
                        />
                        <Text style={[styles.overUnitSuffix, isOverDelivery && { color: COLORS.red }]}>
                          {pendingOverMat?.qu}
                        </Text>
                      </View>

                      <TouchableOpacity
                        style={styles.overStepBtn}
                        onPress={() => handleStepOverExtra(1)}
                        activeOpacity={0.7}
                      >
                        <Text style={styles.overStepBtnText}>+</Text>
                      </TouchableOpacity>
                    </View>

                    {/* Wenn mehr als Lieferung: Box & Text rot ("was nichts macht aber es wird rot") */}
                    {isOverDelivery ? (
                      <View style={styles.overDeliveryWarnBox}>
                        <Text style={styles.overDeliveryWarnText}>
                          ⚠️ {t('overDeliveryExceededWarn', currentLang, {
                            delivered: pendingOverMat?.delivered || 0,
                            qu: pendingOverMat?.qu || 'Stk',
                          })}
                        </Text>
                      </View>
                    ) : null}

                    {/* Schnellauswahl Pills */}
                    <Text style={styles.overQuickLabel}>{t('overQuickLabel', currentLang)}</Text>
                    <View style={styles.overQuickPillsRow}>
                      {[1, 2, 3, 5, 8, 10, 15].map((n) => {
                        const val = String(n);
                        const isSelected = String(parseFloat(overExtraQty)) === val;
                        return (
                          <TouchableOpacity
                            key={val}
                            style={[styles.overQuickPill, isSelected && styles.overQuickPillActive]}
                            onPress={() => setOverExtraQty(val)}
                            activeOpacity={0.7}
                          >
                            <Text
                              style={[
                                styles.overQuickPillText,
                                isSelected && styles.overQuickPillTextActive,
                              ]}
                            >
                              +{val} {pendingOverMat?.qu}
                            </Text>
                          </TouchableOpacity>
                        );
                      })}
                    </View>
                  </View>

                  {/* 3. DARUNTER DIE BEGRÜNDUNG */}
                  <View style={styles.modalField}>
                    <Text style={styles.modalFieldLabel}>
                      {t('overReasonLabel', currentLang)}
                    </Text>

                    <View style={styles.quickPillsGrid}>
                      {[
                        { key: 'reasonPlanChange', text: t('reasonPlanChange', currentLang) },
                        { key: 'reasonObstacle', text: t('reasonObstacle', currentLang) },
                        { key: 'reasonDamage', text: t('reasonDamage', currentLang) },
                        { key: 'reasonExtraConn', text: t('reasonExtraConn', currentLang) },
                      ].map((r) => (
                        <TouchableOpacity
                          key={r.key}
                          style={[
                            styles.reasonPill,
                            overReason === r.text && styles.reasonPillActive,
                          ]}
                          onPress={() => setOverReason(r.text)}
                          activeOpacity={0.7}
                        >
                          <Text
                            style={[
                              styles.reasonPillText,
                              overReason === r.text && styles.reasonPillTextActive,
                            ]}
                          >
                            {r.text}
                          </Text>
                        </TouchableOpacity>
                      ))}
                    </View>

                    {/* 3-line Comment / Reason field */}
                    <Text style={styles.modalFieldLabel}>
                      {t('overDetailReasonLabel', currentLang)}
                    </Text>
                    <TextInput
                      style={[
                        styles.overReasonInputFullscreen,
                        !hasOverReason && { borderColor: '#CBD5E1' },
                      ]}
                      placeholder={t('overCommentPlaceholder', currentLang)}
                      placeholderTextColor={COLORS.muted}
                      multiline={true}
                      numberOfLines={3}
                      value={overReason}
                      onChangeText={setOverReason}
                    />
                  </View>
                </ScrollView>

                {/* 4. BUTTONS UNTEN FEST FIXIERT (Sticky Footer - immer voll sichtbar, klickbar nur wenn Begründung angegeben) */}
                <View style={styles.stickyModalFooter}>
                  <TouchableOpacity
                    style={styles.overCancelBtnLarge}
                    onPress={() => {
                      setShowOverModal(false);
                      setPendingOverMat(null);
                    }}
                    activeOpacity={0.7}
                  >
                    <Text style={styles.overCancelTextLarge}>{t('cancel', currentLang)}</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[
                      styles.overConfirmBtnLarge,
                      !hasOverReason && styles.overConfirmBtnDisabled,
                    ]}
                    onPress={() => hasOverReason && handleConfirmOverReason()}
                    disabled={!hasOverReason}
                    activeOpacity={0.8}
                  >
                    <Text
                      style={[
                        styles.overConfirmTextLarge,
                        !hasOverReason && styles.overConfirmTextDisabled,
                      ]}
                    >
                      ✓ {t('overConfirmBtn', currentLang)} (+{(parseFloat(overExtraQty) || 0).toFixed(1).replace(/\.0$/, '')} {pendingOverMat?.qu})
                    </Text>
                  </TouchableOpacity>
                </View>
              </KeyboardAvoidingView>
            </SafeAreaView>
          );
        })()}
      </Modal>

      {/* ------------------------------------------------------------- */}
      {/* FULLSCREEN OVERLAY: POSITION UNKLAR ERFASSEN                 */}
      {/* ------------------------------------------------------------- */}
      <Modal visible={showUnclearModal} animationType="slide" presentationStyle="fullScreen">
        <SafeAreaView style={styles.modalFullscreen}>
          {/* Header with Title and Close '✕' Button */}
          <View style={styles.modalHeader}>
            <View style={styles.modalTitleBox}>
              <Text style={styles.modalMainTitle}>❓ {t('unclearTitle', currentLang)}</Text>
              <Text style={styles.modalSubTitle}>
                {room.name} · {t('kw', currentLang)} 27
              </Text>
            </View>
            <TouchableOpacity
              style={styles.modalCloseBtn}
              onPress={() => {
                setShowUnclearModal(false);
                setShowUnclearSuggestions(false);
              }}
              activeOpacity={0.7}
              hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
            >
              <Text style={styles.modalCloseIcon}>✕</Text>
            </TouchableOpacity>
          </View>

          <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : undefined}
            style={{ flex: 1 }}
          >
            <ScrollView
              style={styles.modalBody}
              contentContainerStyle={styles.modalScrollContent}
              keyboardShouldPersistTaps="handled"
            >
              {/* Info banner */}
              <View style={styles.unclearInfoCard}>
                <Text style={styles.unclearInfoIcon}>ℹ️</Text>
                <Text style={styles.unclearInfoText}>{t('unclearSubInfo', currentLang)}</Text>
              </View>

              {/* Product field + Autosuggest from GAEB / ordered */}
              <View style={styles.modalField}>
                <Text style={styles.modalFieldLabel}>{t('unclearWhatLabel', currentLang)}</Text>
                <TextInput
                  style={styles.modalInput}
                  placeholder={t('unclearWhatPlaceholder', currentLang)}
                  placeholderTextColor={COLORS.muted}
                  value={unclearText}
                  onChangeText={(text) => {
                    setUnclearText(text);
                    setSelectedUnclearMat(null);
                    setShowUnclearSuggestions(text.trim().length >= 1);
                  }}
                  onFocus={() => {
                    if (unclearText.trim().length >= 1) setShowUnclearSuggestions(true);
                  }}
                />

                {unclearSuggestions.length > 0 && (
                  <View style={styles.unclearSuggestionsBox}>
                    <Text style={styles.unclearSugHeader}>{t('unclearOrderedSuggestions', currentLang)}</Text>
                    {unclearSuggestions.map((item) => (
                      <TouchableOpacity
                        key={item.id}
                        style={styles.unclearSugItem}
                        onPress={() => handleSelectUnclearSuggestion(item)}
                        activeOpacity={0.7}
                      >
                        <View style={{ flex: 1 }}>
                          <Text style={styles.unclearSugName} numberOfLines={1}>
                            {getMaterialDisplayName(item)}
                          </Text>
                          <Text style={styles.unclearSugMeta}>
                            Pos {item.pos} · {item.group}
                            {item.deliveredQty ? ` · ${t('matrixDelivered', currentLang)}: ${item.deliveredQty} ${item.qu}` : ` · ${item.qu}`}
                          </Text>
                        </View>
                        <View style={styles.unclearSugBadge}>
                          <Text style={styles.unclearSugBadgeText}>{t('unclearOrderedBadge', currentLang)}</Text>
                        </View>
                      </TouchableOpacity>
                    ))}
                  </View>
                )}
              </View>

              {/* Unit Selector & Quantity */}
              <View style={styles.modalField}>
                <Text style={styles.modalFieldLabel}>{t('unclearSelectUnit', currentLang)}</Text>
                <View style={styles.unitSelectorRow}>
                  <TouchableOpacity
                    style={[styles.unitToggle, unclearUnit === 'Stk' && styles.unitToggleActive]}
                    onPress={() => setUnclearUnit('Stk')}
                    activeOpacity={0.7}
                  >
                    <Text
                      style={[
                        styles.unitToggleText,
                        unclearUnit === 'Stk' && styles.unitToggleTextActive,
                      ]}
                    >
                      {t('unitPieces', currentLang)}
                    </Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[styles.unitToggle, unclearUnit === 'm' && styles.unitToggleActive]}
                    onPress={() => setUnclearUnit('m')}
                    activeOpacity={0.7}
                  >
                    <Text
                      style={[
                        styles.unitToggleText,
                        unclearUnit === 'm' && styles.unitToggleTextActive,
                      ]}
                    >
                      {t('unitMeters', currentLang)}
                    </Text>
                  </TouchableOpacity>
                </View>

                <TextInput
                  style={styles.modalInput}
                  placeholder={
                    unclearUnit === 'm'
                      ? t('unclearQtyMeterPlaceholder', currentLang)
                      : t('unclearQtyPiecePlaceholder', currentLang)
                  }
                  placeholderTextColor={COLORS.muted}
                  keyboardType="decimal-pad"
                  value={unclearQty}
                  onChangeText={setUnclearQty}
                />
              </View>

              {/* Fullscreen Action Buttons */}
              <View style={styles.overFullscreenActionRow}>
                <TouchableOpacity
                  style={styles.overCancelBtnLarge}
                  onPress={() => {
                    setShowUnclearModal(false);
                    setShowUnclearSuggestions(false);
                  }}
                  activeOpacity={0.7}
                >
                  <Text style={styles.overCancelTextLarge}>{t('cancel', currentLang)}</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.overConfirmBtnLarge, { backgroundColor: COLORS.primary }]}
                  onPress={handleSaveUnclear}
                  activeOpacity={0.8}
                >
                  <Text style={styles.overConfirmTextLarge}>✓ {t('unclearRecord', currentLang)}</Text>
                </TouchableOpacity>
              </View>
            </ScrollView>
          </KeyboardAvoidingView>
        </SafeAreaView>
      </Modal>

      {/* ------------------------------------------------------------- */}
      {/* MODAL: RAUM/ORT FERTIGSTELLEN (100% ABSCHLUSS MIT DELTA)     */}
      {/* ------------------------------------------------------------- */}
      <Modal visible={showCompleteModal} transparent animationType="slide">
        <View style={styles.modalBackdrop}>
          <View style={styles.completeModalCard}>
            <View style={styles.completeModalHeader}>
              <Text style={styles.completeModalTitle}>✓ {t('completeModalTitle', currentLang)}</Text>
              <TouchableOpacity
                onPress={() => setShowCompleteModal(false)}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              >
                <Text style={styles.overModalClose}>✕</Text>
              </TouchableOpacity>
            </View>

            <Text style={styles.completeModalSub}>
              {room.name} ({room.code}) · {t('completeModalSub', currentLang)}
            </Text>

            <Text style={styles.completeNoticeText}>
              {t('completeNoticeText', currentLang)}
            </Text>

            {/* Delta Summary List */}
            <ScrollView style={styles.deltaScrollList}>
              {activeMaterialIds.map((matId) => {
                let mat = materials.find((m) => m.id === matId || m.pos === matId || m.posNr === matId);
                const roomPlan = getRoomPlannedItem(matId);
                if (!mat && roomPlan) {
                  mat = {
                    id: matId,
                    pos: roomPlan.posNr || matId,
                    name: roomPlan.shortText || roomPlan.name || 'Material',
                    cleanName: roomPlan.shortText || roomPlan.cleanName || roomPlan.name || 'Material',
                    shortText: roomPlan.shortText || '',
                    group: roomPlan.group || 'Allgemein',
                    qu: roomPlan.qu || 'Stk',
                    deliveredQty: Number(roomPlan.plannedQty || 0),
                    installedQty: Number(roomPlan.installedQty || 0),
                  };
                }
                if (!mat) return null;

                const displayName = getMaterialDisplayName(mat, roomPlan);
                const displayQu = mat?.qu || roomPlan?.qu || 'Stk';
                const hasRoomPlan = Boolean(roomPlan);
                const planned = hasRoomPlan ? Number(roomPlan.plannedQty) : null;
                const installedBefore = hasRoomPlan
                  ? Number(roomPlan.installedQty || 0)
                  : Number(mat.installedQty || 0);
                const delta = Number(sessionQuantities[matId]) || 0;
                const totalVerb = installedBefore + delta;

                const diff = planned !== null ? planned - totalVerb : 0;
                const isOver = planned !== null && totalVerb > planned;
                const isUnder = planned !== null && totalVerb < planned;

                return (
                  <View key={mat.id} style={styles.deltaRow}>
                    <View style={{ flex: 1, paddingRight: 8 }}>
                      <Text style={styles.deltaMatName} numberOfLines={1}>
                        Pos {mat.pos} · {displayName}
                      </Text>
                      <Text style={styles.deltaMatSub}>
                        {hasRoomPlan
                          ? `${t('matrixPlanned', currentLang)}: ${planned} ${displayQu}  |  ${t('matrixInstalled', currentLang)}: ${totalVerb} ${displayQu}`
                          : `${t('matrixInstalled', currentLang)}: ${totalVerb} ${displayQu} (${t('matrixOnlyGaeb', currentLang)})`}
                      </Text>
                    </View>

                    {hasRoomPlan ? (
                      isUnder ? (
                        <View style={styles.deltaBadgeUnder}>
                          <Text style={styles.deltaBadgeUnderText}>
                            +{diff.toFixed(1)} {displayQu} {t('completeUnder', currentLang)}
                          </Text>
                        </View>
                      ) : isOver ? (
                        <View style={styles.deltaBadgeOver}>
                          <Text style={styles.deltaBadgeOverText}>
                            -{Math.abs(diff).toFixed(1)} {displayQu} {t('completeOver', currentLang)}
                          </Text>
                        </View>
                      ) : (
                        <View style={styles.deltaBadgeExact}>
                          <Text style={styles.deltaBadgeExactText}>{t('completeExact', currentLang)}</Text>
                        </View>
                      )
                    ) : (
                      <View style={styles.deltaBadgeExact}>
                        <Text style={styles.deltaBadgeExactText}>{totalVerb} {displayQu}</Text>
                      </View>
                    )}
                  </View>
                );
              })}
            </ScrollView>

            <View style={styles.completeActionRow}>
              <TouchableOpacity
                style={styles.overCancelBtn}
                onPress={() => setShowCompleteModal(false)}
                activeOpacity={0.7}
              >
                <Text style={styles.overCancelText}>{t('cancel', currentLang)}</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.completeConfirmBtn}
                onPress={handleConfirmCompleteRoom}
                activeOpacity={0.8}
              >
                <Text style={styles.completeConfirmText}>{t('completeRoomConfirm', currentLang)}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.bg,
  },
  scroll: {
    padding: 16,
    paddingBottom: 160,
  },
  backButton: {
    marginBottom: 8,
  },
  backText: {
    fontSize: 14,
    fontWeight: '700',
    color: COLORS.muted,
  },
  headerRowClean: {
    marginBottom: 10,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 10,
  },
  headerTitles: {
    flex: 1,
  },
  roomTitle: {
    fontSize: 20,
    fontWeight: '900',
    color: COLORS.ink,
    letterSpacing: -0.3,
  },
  roomSubtitle: {
    fontSize: 12.5,
    color: COLORS.muted,
    marginTop: 2,
  },
  // Top 3 Action Buttons directly under the Title
  topActionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 14,
  },
  actionBtnNachtrag: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 9,
    paddingHorizontal: 6,
    backgroundColor: '#EFF6FF',
    borderWidth: 1.5,
    borderColor: '#93C5FD',
    borderRadius: 10,
  },
  actionBtnNachtragText: {
    fontSize: 12,
    fontWeight: '800',
    color: COLORS.primary,
  },
  actionBtnUnclear: {
    flex: 1.1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 9,
    paddingHorizontal: 6,
    backgroundColor: '#F8FAFC',
    borderWidth: 1.5,
    borderColor: '#CBD5E1',
    borderRadius: 10,
  },
  actionBtnUnclearActive: {
    backgroundColor: '#FEF3C7',
    borderColor: '#F59E0B',
  },
  actionBtnUnclearText: {
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.inkSoft,
  },
  actionBtnUnclearTextActive: {
    color: '#B45309',
    fontWeight: '800',
  },
  actionBtnComplete: {
    flex: 1.25,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 9,
    paddingHorizontal: 6,
    borderRadius: 10,
  },
  actionBtnCompleteGrey: {
    backgroundColor: '#E2E8F0',
    borderWidth: 1.5,
    borderColor: '#94A3B8',
  },
  actionBtnCompleteGreyText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#64748B',
  },
  actionBtnCompleteGreen: {
    backgroundColor: '#059669',
    borderWidth: 1.5,
    borderColor: '#047857',
    shadowColor: '#059669',
    shadowOpacity: 0.25,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 3,
    elevation: 2,
  },
  actionBtnCompleteGreenText: {
    fontSize: 12,
    fontWeight: '900',
    color: '#FFFFFF',
  },
  actionBtnCompleteText: {
    fontSize: 12,
    fontWeight: '900',
    color: '#FFFFFF',
  },
  actionBtnCompleteDone: {
    backgroundColor: '#D1FAE5',
    borderColor: '#10B981',
    borderWidth: 1.5,
  },
  actionBtnCompleteDoneText: {
    color: '#065F46',
    fontWeight: '900',
  },

  // Suchfunktion DIRECT oberhalb der Kacheln
  searchSectionDirect: {
    marginBottom: 14,
  },
  searchInputWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderWidth: 1.5,
    borderColor: COLORS.line,
    borderRadius: 12,
    paddingHorizontal: 12,
    height: 46,
  },
  searchIcon: {
    fontSize: 15,
    marginRight: 8,
    opacity: 0.7,
  },
  searchInputField: {
    flex: 1,
    fontSize: 13.5,
    color: COLORS.ink,
    paddingVertical: 0,
  },
  searchClearBtn: {
    padding: 6,
  },
  searchClearText: {
    fontSize: 14,
    fontWeight: '800',
    color: COLORS.muted,
  },
  emptyFilterState: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: '#CBD5E1',
    borderStyle: 'dashed',
    paddingVertical: 28,
    paddingHorizontal: 20,
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: 12,
  },
  emptyFilterIcon: {
    fontSize: 32,
    marginBottom: 8,
  },
  emptyFilterTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: COLORS.ink,
    marginBottom: 4,
    textAlign: 'center',
  },
  emptyFilterSub: {
    fontSize: 13,
    color: COLORS.muted,
    textAlign: 'center',
  },
  unclearBtn: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderColor: COLORS.line,
    borderRadius: 12,
    paddingVertical: 10,
    alignItems: 'center',
    marginTop: 8,
  },
  unclearBtnText: {
    fontSize: 12.5,
    fontWeight: '700',
    color: COLORS.amberDark,
  },
  unclearFormCard: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1.5,
    borderColor: '#D4E2F0',
    borderRadius: 12,
    padding: 12,
    marginTop: 8,
  },
  unclearFormTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: COLORS.ink,
  },
  unclearHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  unclearCloseText: {
    fontSize: 16,
    color: COLORS.muted,
    fontWeight: '800',
    padding: 4,
  },
  unclearSubInfo: {
    fontSize: 11.5,
    color: COLORS.muted,
    marginBottom: 10,
    lineHeight: 16,
  },
  unclearInfoCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#EBF8FF',
    borderWidth: 1,
    borderColor: '#BEE3F8',
    borderRadius: 10,
    padding: 12,
    marginBottom: 16,
    gap: 10,
  },
  unclearInfoIcon: {
    fontSize: 18,
  },
  unclearInfoText: {
    flex: 1,
    fontSize: 12.5,
    color: '#2B6CB0',
    lineHeight: 18,
  },
  unclearSuggestionsBox: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1.5,
    borderColor: '#90CDF4',
    borderRadius: 10,
    marginBottom: 10,
    maxHeight: 200,
    elevation: 3,
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 4,
    overflow: 'hidden',
  },
  unclearSugHeader: {
    fontSize: 10.5,
    fontWeight: '800',
    color: COLORS.blue,
    backgroundColor: '#EBF8FF',
    paddingHorizontal: 12,
    paddingVertical: 5,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  unclearSugItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingVertical: 9,
    borderBottomWidth: 1,
    borderBottomColor: '#EDF2F7',
    backgroundColor: '#FFFFFF',
  },
  unclearSugName: {
    fontSize: 13,
    fontWeight: '700',
    color: COLORS.ink,
  },
  unclearSugMeta: {
    fontSize: 11,
    color: COLORS.muted,
    marginTop: 2,
  },
  unclearSugBadge: {
    backgroundColor: '#E6FFFA',
    borderWidth: 1,
    borderColor: '#38B2AC',
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 2,
    marginLeft: 8,
  },
  unclearSugBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#234E52',
  },
  unclearUnitToggleRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 8,
  },
  unclearUnitBtn: {
    flex: 1,
    paddingVertical: 7,
    borderWidth: 1.5,
    borderColor: COLORS.line,
    borderRadius: 8,
    alignItems: 'center',
    backgroundColor: '#FAFCFE',
  },
  unclearUnitBtnActive: {
    backgroundColor: '#FEFCBF',
    borderColor: COLORS.amber,
  },
  unclearUnitBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.muted,
  },
  unclearUnitBtnTextActive: {
    color: COLORS.amberDark,
    fontWeight: '800',
  },
  unclearInput: {
    backgroundColor: '#FAFCFE',
    borderWidth: 1,
    borderColor: COLORS.line,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
    fontSize: 13,
    marginBottom: 8,
    color: COLORS.ink,
  },
  unclearSaveBtn: {
    backgroundColor: COLORS.amber,
    borderRadius: 8,
    paddingVertical: 10,
    alignItems: 'center',
  },
  unclearSaveText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 13,
  },
  unclearSectionWrapper: {
    marginBottom: 16,
  },
  unclearSectTitle: {
    fontSize: 12,
    fontWeight: '800',
    color: COLORS.orange,
    marginBottom: 6,
  },
  unclearRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.orangeBg,
    borderWidth: 1,
    borderColor: '#F0D9BC',
    borderRadius: 10,
    padding: 10,
    marginBottom: 6,
  },
  uName: {
    fontSize: 13,
    fontWeight: '700',
    color: COLORS.ink,
  },
  uSub: {
    fontSize: 11.5,
    color: COLORS.muted,
    marginTop: 2,
  },
  uBadge: {
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  uBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: COLORS.orange,
  },
  rowsWrapper: {
    gap: 12,
  },
  // Room Completion Section
  roomCompleteSection: {
    marginBottom: 14,
  },
  roomCompletedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#E6FFFA',
    borderWidth: 1.5,
    borderColor: '#38B2AC',
    borderRadius: 14,
    padding: 12,
    gap: 12,
  },
  roomCompletedIcon: {
    fontSize: 22,
    fontWeight: '900',
    color: '#234E52',
  },
  roomCompletedTitle: {
    fontSize: 14.5,
    fontWeight: '800',
    color: '#234E52',
  },
  roomCompletedSub: {
    fontSize: 11.5,
    color: '#285E61',
    marginTop: 1,
  },
  completeRoomBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
    borderWidth: 1.5,
    borderColor: '#38B2AC',
    borderRadius: 14,
    paddingVertical: 12,
    paddingHorizontal: 16,
    gap: 8,
    elevation: 1,
    shadowColor: '#38B2AC',
    shadowOpacity: 0.15,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 4,
  },
  completeRoomIcon: {
    fontSize: 17,
    fontWeight: '900',
    color: '#319795',
  },
  completeRoomBtnText: {
    fontSize: 14,
    fontWeight: '800',
    color: '#285E61',
  },

  // -------------------------------------------------------------
  // Redesigned Material Card Styles
  // -------------------------------------------------------------
  bookCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: COLORS.line,
    padding: 14,
    marginBottom: 12,
    elevation: 2,
    shadowColor: '#000',
    shadowOpacity: 0.04,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 6,
  },
  bookCardOver: {
    borderColor: '#FEB2B2',
    backgroundColor: '#FFF5F5',
  },
  bookCardCompleted: {
    borderColor: '#B2F5EA',
    backgroundColor: '#F7FFFD',
  },
  cardHeaderRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    marginBottom: 12,
  },
  iconBox: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: '#F1F5F9',
    borderWidth: 1.5,
    borderColor: '#CBD5E1',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 2,
  },
  iconSymbol: {
    fontSize: 20,
    fontWeight: '900',
    color: COLORS.ink,
  },
  iconBoxOver: {
    backgroundColor: '#FFF5F5',
    borderColor: '#FEB2B2',
  },
  iconSymbolOver: {
    color: COLORS.red,
  },
  cardHeaderCol: {
    flex: 1,
  },
  posRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 6,
    marginBottom: 5,
  },
  posChip: {
    backgroundColor: '#EFF6FF',
    borderWidth: 1,
    borderColor: '#BFDBFE',
    borderRadius: 6,
    paddingHorizontal: 7,
    paddingVertical: 2,
  },
  posChipText: {
    fontSize: 11,
    fontWeight: '800',
    color: COLORS.primary,
  },
  hintChip: {
    backgroundColor: '#F1F5F9',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  hintChipText: {
    fontSize: 10.5,
    fontWeight: '700',
    color: COLORS.inkSoft,
  },
  matName: {
    fontSize: 18,
    fontWeight: '900',
    color: COLORS.ink,
    lineHeight: 23,
    marginBottom: 3,
    letterSpacing: -0.3,
  },
  matGloss: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.muted,
  },
  matGroup: {
    fontSize: 13,
    fontWeight: '600',
    color: COLORS.muted,
    lineHeight: 17,
  },
  overBadge: {
    backgroundColor: '#FED7D7',
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 1,
    marginLeft: 4,
  },
  overBadgeText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#9B2C2C',
  },
  // 4-Metrics Matrix: Geliefert | Geplant | Verbaut | Rest
  metricsContainer: {
    flexDirection: 'row',
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    paddingVertical: 8,
    paddingHorizontal: 6,
    marginBottom: 10,
    alignItems: 'center',
    justifyContent: 'space-around',
  },
  metricCell: {
    flex: 1,
    alignItems: 'center',
  },
  metricLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: COLORS.muted,
    textTransform: 'uppercase',
    letterSpacing: 0.3,
    marginBottom: 2,
  },
  metricValue: {
    fontSize: 13.5,
    fontWeight: '800',
    color: COLORS.ink,
  },
  metricUnit: {
    fontSize: 10,
    fontWeight: '600',
    color: COLORS.muted,
  },
  metricSub: {
    fontSize: 9.5,
    color: COLORS.muted,
    marginTop: 1,
  },
  metricDivider: {
    width: 1,
    height: 28,
    backgroundColor: '#E2E8F0',
  },
  metricValOver: {
    color: COLORS.red,
  },
  metricValDone: {
    color: '#276749',
  },
  progressRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 10,
  },
  progressPctText: {
    fontSize: 11.5,
    fontWeight: '800',
    color: COLORS.inkSoft,
    minWidth: 42,
    textAlign: 'right',
  },
  progressPctTextOver: {
    color: COLORS.red,
  },
  cardFooterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 4,
  },
  reasonBadge: {
    backgroundColor: '#FEFCBF',
    borderWidth: 1,
    borderColor: '#ECC94B',
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 5,
  },
  reasonBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#744210',
  },
  overWarningText: {
    fontSize: 11,
    fontWeight: '700',
    color: COLORS.red,
  },
  stepperWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: COLORS.line,
    borderRadius: 12,
    overflow: 'hidden',
  },
  stepperBtn: {
    width: 36,
    height: 42,
    backgroundColor: '#F6F8FA',
    justifyContent: 'center',
    alignItems: 'center',
  },
  stepperBtnText: {
    fontSize: 20,
    fontWeight: '700',
    color: COLORS.ink,
  },
  stepperValBox: {
    minWidth: 50,
    paddingHorizontal: 6,
    alignItems: 'center',
  },
  stepperValText: {
    fontSize: 15,
    fontWeight: '800',
    color: COLORS.ink,
  },
  stepperUnitText: {
    fontSize: 8.5,
    color: COLORS.muted,
    fontWeight: '700',
    marginTop: -2,
    textAlign: 'center',
  },
  footCta: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: 'rgba(238, 241, 244, 0.95)',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: COLORS.line,
  },
  primaryButton: {
    backgroundColor: COLORS.ink,
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
  },
  primaryButtonText: {
    color: '#FFFFFF',
    fontWeight: '800',
    fontSize: 15,
  },
  monteurFertigBtn: {
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
  },
  monteurFertigBtnGrey: {
    backgroundColor: '#718096',
  },
  monteurFertigBtnGreen: {
    backgroundColor: '#16A34A',
  },
  monteurFertigBtnDone: {
    backgroundColor: '#2F855A',
  },
  monteurFertigBtnText: {
    color: '#FFFFFF',
    fontWeight: '800',
    fontSize: 15,
  },

  // -------------------------------------------------------------
  // Fullscreen Modal Styles with Tabs
  // -------------------------------------------------------------
  modalFullscreen: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.line,
    backgroundColor: '#FFFFFF',
  },
  modalTitleBox: {
    flex: 1,
  },
  modalMainTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: COLORS.ink,
  },
  modalSubTitle: {
    fontSize: 13,
    color: COLORS.muted,
    marginTop: 2,
  },
  modalCloseBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#F1F4F7',
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 12,
  },
  modalCloseIcon: {
    fontSize: 18,
    fontWeight: 'bold',
    color: COLORS.inkSoft,
  },
  tabBarContainer: {
    flexDirection: 'row',
    backgroundColor: '#F1F4F7',
    padding: 4,
    marginHorizontal: 20,
    marginTop: 14,
    borderRadius: 12,
  },
  segmentTab: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
    borderRadius: 9,
  },
  segmentTabActive: {
    backgroundColor: '#FFFFFF',
    elevation: 2,
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 4,
  },
  segmentText: {
    fontSize: 14,
    fontWeight: '700',
    color: COLORS.muted,
  },
  segmentTextActive: {
    color: COLORS.ink,
    fontWeight: '800',
  },
  modalBody: {
    flex: 1,
    backgroundColor: '#FAFCFE',
  },
  modalScrollContent: {
    padding: 20,
    paddingBottom: 40,
  },
  modalField: {
    marginBottom: 18,
  },
  modalFieldLabel: {
    fontSize: 12,
    fontWeight: '800',
    color: COLORS.inkSoft,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 7,
  },
  requiredStar: {
    color: '#E53E3E',
    fontWeight: '900',
  },
  modalInput: {
    borderWidth: 1.5,
    borderColor: COLORS.line,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    color: COLORS.ink,
    backgroundColor: '#FFFFFF',
  },
  multilineInput: {
    minHeight: 84,
    textAlignVertical: 'top',
    paddingTop: 12,
    lineHeight: 20,
  },
  unitSelectorRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 10,
  },
  unitToggle: {
    flex: 1,
    borderWidth: 1.5,
    borderColor: COLORS.line,
    borderRadius: 10,
    paddingVertical: 10,
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
  },
  unitToggleActive: {
    borderColor: COLORS.amber,
    backgroundColor: COLORS.lite,
  },
  unitToggleText: {
    fontSize: 13,
    fontWeight: '700',
    color: COLORS.muted,
  },
  unitToggleTextActive: {
    color: COLORS.amberDark,
    fontWeight: '800',
  },
  quickPillsRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 8,
  },
  pill: {
    backgroundColor: '#F1F4F7',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: COLORS.line,
  },
  pillActive: {
    backgroundColor: COLORS.lite,
    borderColor: COLORS.amber,
  },
  pillText: {
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.inkSoft,
  },
  pillTextActive: {
    color: COLORS.amberDark,
  },
  suggestionsContainer: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1.5,
    borderColor: COLORS.amber,
    borderRadius: 12,
    marginTop: 6,
    maxHeight: 240,
    overflow: 'hidden',
    elevation: 4,
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 6,
  },
  suggestionsHeader: {
    fontSize: 11,
    fontWeight: '800',
    color: COLORS.amberDark,
    backgroundColor: COLORS.lite,
    paddingHorizontal: 12,
    paddingVertical: 6,
    textTransform: 'uppercase',
  },
  suggestionItem: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#EEF2F6',
  },
  sugTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 3,
  },
  sugPosChip: {
    backgroundColor: '#EAF4FB',
    borderRadius: 5,
    paddingHorizontal: 6,
    paddingVertical: 1,
  },
  sugPosText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#0082C9',
  },
  sugUnitBadge: {
    fontSize: 11,
    color: COLORS.muted,
    fontWeight: '600',
  },
  sugTitle: {
    fontSize: 13.5,
    fontWeight: '700',
    color: COLORS.ink,
  },
  sugGroup: {
    fontSize: 11,
    color: COLORS.muted,
    marginTop: 1,
  },
  modalSubmitBtn: {
    backgroundColor: COLORS.amber,
    borderRadius: 14,
    paddingVertical: 15,
    alignItems: 'center',
    marginTop: 14,
  },
  modalSubmitBtnDisabled: {
    backgroundColor: '#CBD5E0',
    shadowOpacity: 0,
    elevation: 0,
  },
  modalSubmitText: {
    color: '#FFFFFF',
    fontWeight: '800',
    fontSize: 16,
  },
  modalSubmitTextDisabled: {
    color: '#718096',
  },
  inputInvalid: {
    borderColor: '#E53E3E',
    borderWidth: 1.5,
    backgroundColor: '#FFF5F5',
  },
  missingHintBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#EDF2F7',
    borderWidth: 1.5,
    borderColor: '#CBD5E0',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginTop: 8,
    marginBottom: 4,
    gap: 8,
  },
  missingHintIcon: {
    fontSize: 16,
  },
  missingHintTitle: {
    fontSize: 11,
    fontWeight: '800',
    color: '#4A5568',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
    marginBottom: 2,
  },
  missingHintList: {
    fontSize: 12,
    fontWeight: '700',
    color: '#C53030',
    lineHeight: 16,
  },
  completeHintBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#E6FFFA',
    borderWidth: 1.5,
    borderColor: '#38B2AC',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginTop: 8,
    marginBottom: 4,
    gap: 8,
  },
  completeHintIcon: {
    fontSize: 16,
    color: '#234E52',
    fontWeight: '900',
  },
  completeHintText: {
    fontSize: 12.5,
    fontWeight: '700',
    color: '#234E52',
  },

  // -------------------------------------------------------------
  // Modals (Mehrverbrauch & Complete Room) Styles
  // -------------------------------------------------------------
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.65)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 18,
  },
  // Fullscreen Mehrverbrauch Overlay Styles
  overSummaryCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: '#FED7D7',
    padding: 16,
    marginBottom: 16,
    elevation: 2,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 4,
  },
  overCardHeaderRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    marginBottom: 14,
  },
  overMatTitle: {
    fontSize: 15.5,
    fontWeight: '800',
    color: COLORS.ink,
    marginBottom: 2,
  },
  overMatSubtitle: {
    fontSize: 12.5,
    color: COLORS.muted,
  },
  overDeliveryNotice: {
    backgroundColor: '#F0FDF4',
    borderWidth: 1.5,
    borderColor: '#86EFAC',
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 12,
    marginBottom: 12,
  },
  overDeliveryNoticeTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: '#166534',
    marginBottom: 3,
  },
  overDeliveryNoticeSub: {
    fontSize: 12,
    fontWeight: '700',
    color: '#15803D',
  },
  overCalcBox: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#FFF5F5',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#FED7D7',
    paddingVertical: 12,
    paddingHorizontal: 14,
  },
  overCalcCol: {
    alignItems: 'center',
  },
  overCalcLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: COLORS.muted,
    marginBottom: 2,
  },
  overCalcVal: {
    fontSize: 14.5,
    fontWeight: '800',
    color: COLORS.ink,
  },
  overCalcArrow: {
    fontSize: 14,
    fontWeight: '800',
    color: COLORS.muted,
  },
  overQtyControlRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 12,
  },
  overStepBtn: {
    width: 52,
    height: 52,
    borderRadius: 14,
    backgroundColor: '#EFF6FF',
    borderWidth: 1.5,
    borderColor: '#BFDBFE',
    justifyContent: 'center',
    alignItems: 'center',
  },
  overStepBtnText: {
    fontSize: 26,
    fontWeight: '800',
    color: COLORS.primary,
    lineHeight: 28,
  },
  overInputWrap: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    borderWidth: 2,
    borderColor: COLORS.primary,
    borderRadius: 14,
    paddingHorizontal: 14,
    height: 52,
  },
  overPlusSign: {
    fontSize: 22,
    fontWeight: '900',
    color: COLORS.primary,
    marginRight: 6,
  },
  overQtyInput: {
    flex: 1,
    fontSize: 22,
    fontWeight: '900',
    color: COLORS.ink,
    paddingVertical: 0,
  },
  overUnitSuffix: {
    fontSize: 15,
    fontWeight: '800',
    color: COLORS.muted,
    marginLeft: 6,
  },
  overQuickLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.muted,
    marginBottom: 8,
    marginTop: 4,
  },
  overQuickPillsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 16,
  },
  overQuickPill: {
    backgroundColor: '#F1F5F9',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 20,
    paddingHorizontal: 13,
    paddingVertical: 7,
  },
  overQuickPillActive: {
    backgroundColor: '#EFF6FF',
    borderColor: COLORS.primary,
  },
  overQuickPillText: {
    fontSize: 13,
    fontWeight: '700',
    color: COLORS.inkSoft,
  },
  overQuickPillTextActive: {
    color: COLORS.primary,
    fontWeight: '900',
  },
  quickPillsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 12,
  },
  reasonPill: {
    backgroundColor: '#F1F5F9',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  reasonPillActive: {
    backgroundColor: '#FEFCBF',
    borderColor: '#D69E2E',
  },
  reasonPillText: {
    fontSize: 11.5,
    fontWeight: '700',
    color: COLORS.inkSoft,
  },
  reasonPillTextActive: {
    color: '#744210',
    fontWeight: '800',
  },
  overReasonInputFullscreen: {
    backgroundColor: '#F8FAFC',
    borderWidth: 1.5,
    borderColor: COLORS.line,
    borderRadius: 12,
    padding: 12,
    fontSize: 14,
    color: COLORS.ink,
    minHeight: 80,
    textAlignVertical: 'top',
    marginBottom: 16,
  },
  overFullscreenActionRow: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 8,
    marginBottom: 30,
  },
  overCancelBtnLarge: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: COLORS.line,
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
  },
  overCancelTextLarge: {
    fontSize: 14,
    fontWeight: '700',
    color: COLORS.muted,
  },
  overConfirmBtnLarge: {
    flex: 2,
    paddingVertical: 14,
    borderRadius: 12,
    backgroundColor: COLORS.primary || '#2563EB',
    alignItems: 'center',
    shadowColor: COLORS.primary || '#2563EB',
    shadowOpacity: 0.3,
    shadowOffset: { width: 0, height: 3 },
    shadowRadius: 6,
    elevation: 3,
  },
  overConfirmBtnDisabled: {
    backgroundColor: '#E2E8F0',
    shadowOpacity: 0,
    elevation: 0,
  },
  overConfirmTextDisabled: {
    color: '#94A3B8',
  },
  stickyModalFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: Platform.OS === 'ios' ? 24 : 16,
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderTopColor: '#E2E8F0',
    gap: 12,
  },
  overNoticeBox: {
    backgroundColor: '#FEF2F2',
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: '#FECACA',
    padding: 16,
    marginBottom: 16,
  },
  overNoticeHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 6,
  },
  overNoticeIcon: {
    fontSize: 20,
  },
  overNoticeTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#991B1B',
    flex: 1,
  },
  overNoticeMatName: {
    fontSize: 15,
    fontWeight: '700',
    color: COLORS.ink,
    marginBottom: 8,
  },
  overNoticeMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  overNoticeMetaText: {
    fontSize: 13,
    color: COLORS.muted,
  },
  overInputWrapWarn: {
    borderColor: COLORS.red,
    backgroundColor: '#FEF2F2',
  },
  overDeliveryWarnBox: {
    backgroundColor: '#FEF2F2',
    borderWidth: 1,
    borderColor: '#FECACA',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginTop: 8,
    marginBottom: 4,
  },
  overDeliveryWarnText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#B91C1C',
  },
  overConfirmTextLarge: {
    fontSize: 14,
    fontWeight: '900',
    color: '#FFFFFF',
  },

  // Complete Room Modal Styles
  completeModalCard: {
    width: '100%',
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 20,
    maxHeight: '85%',
    elevation: 6,
    shadowColor: '#000',
    shadowOpacity: 0.15,
    shadowOffset: { width: 0, height: 4 },
    shadowRadius: 10,
  },
  completeModalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  completeModalTitle: {
    fontSize: 18,
    fontWeight: '900',
    color: '#234E52',
  },
  completeModalSub: {
    fontSize: 13,
    color: COLORS.muted,
    marginBottom: 10,
  },
  completeNoticeText: {
    fontSize: 12,
    color: COLORS.inkSoft,
    lineHeight: 17,
    marginBottom: 12,
  },
  deltaScrollList: {
    maxHeight: 250,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 12,
    backgroundColor: '#F8FAFC',
    padding: 10,
    marginBottom: 16,
  },
  deltaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#EDF2F7',
  },
  deltaMatName: {
    fontSize: 12.5,
    fontWeight: '700',
    color: COLORS.ink,
  },
  deltaMatSub: {
    fontSize: 11,
    color: COLORS.muted,
    marginTop: 1,
  },
  deltaBadgeUnder: {
    backgroundColor: '#E6FFFA',
    borderWidth: 1,
    borderColor: '#38B2AC',
    borderRadius: 6,
    paddingHorizontal: 7,
    paddingVertical: 2,
  },
  deltaBadgeUnderText: {
    fontSize: 10.5,
    fontWeight: '800',
    color: '#234E52',
  },
  deltaBadgeOver: {
    backgroundColor: '#FFF5F5',
    borderWidth: 1,
    borderColor: '#FEB2B2',
    borderRadius: 6,
    paddingHorizontal: 7,
    paddingVertical: 2,
  },
  deltaBadgeOverText: {
    fontSize: 10.5,
    fontWeight: '800',
    color: '#9B2C2C',
  },
  deltaBadgeExact: {
    backgroundColor: '#EDF2F7',
    borderRadius: 6,
    paddingHorizontal: 7,
    paddingVertical: 2,
  },
  deltaBadgeExactText: {
    fontSize: 10.5,
    fontWeight: '700',
    color: COLORS.muted,
  },
  completeActionRow: {
    flexDirection: 'row',
    gap: 10,
  },
  completeConfirmBtn: {
    flex: 1.6,
    paddingVertical: 12,
    borderRadius: 10,
    backgroundColor: '#319795',
    alignItems: 'center',
  },
  completeConfirmText: {
    fontSize: 13.5,
    fontWeight: '800',
    color: '#FFFFFF',
  },
});
