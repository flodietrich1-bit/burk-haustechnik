import React, { useState } from 'react';
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

export default function BookingScreen({
  room,
  materials = [],
  monteur,
  currentLang = 'de',
  sessionQuantities = {},
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
  const [activeMaterialIds, setActiveMaterialIds] = useState(
    room.defaultMaterialIds || ['m2', 'm3', 'm4', 'm5']
  );

  // Unclear item inline form
  const [showUnclearForm, setShowUnclearForm] = useState(false);
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

  // Pre-fill monteur name as default when opening modal
  const openNachtragModal = () => {
    if (!matBesteller) setMatBesteller(monteur?.name || '');
    if (!hoursMonteur) setHoursMonteur(monteur?.name || '');
    setShowMatSuggestions(false);
    setShowNachtragModal(true);
  };

  // Main screen search filter
  const q = searchQuery.trim().toLowerCase();
  const searchResults = q
    ? materials.filter((m) =>
        (m.pos + ' ' + m.name + ' ' + m.cleanName + ' ' + m.group).toLowerCase().includes(q)
      ).slice(0, 6)
    : [];

  // Nachtrag Material GAEB Autosuggester
  const nq = matTitle.trim().toLowerCase();
  const matSuggestions = (showMatSuggestions && nq.length >= 1 && activeTab === 'material')
    ? materials.filter((m) =>
        (m.pos + ' ' + m.name + ' ' + m.cleanName + ' ' + m.group).toLowerCase().includes(nq)
      ).slice(0, 8)
    : [];

  // Unclear Product Autosuggester (Durchsucht alle bestellten / GAEB-Positionen)
  const uq = unclearText.trim().toLowerCase();
  const unclearSuggestions = (showUnclearSuggestions && uq.length >= 1)
    ? materials.filter((m) =>
        (m.pos + ' ' + m.name + ' ' + m.cleanName + ' ' + (m.group || '')).toLowerCase().includes(uq)
      ).slice(0, 6)
    : [];

  const handlePickMaterial = (id) => {
    // Pin chosen position immediately to the very top (index 0) of the list
    setActiveMaterialIds((prev) => [id, ...prev.filter((mId) => mId !== id)]);
    setSearchQuery('');
    Keyboard.dismiss();
  };

  // When searching, hoist matching materials to the top of the cards list immediately
  const displayMaterialIds = searchQuery.trim()
    ? [
        ...searchResults.map((m) => m.id),
        ...activeMaterialIds.filter((id) => !searchResults.some((m) => m.id === id)),
      ]
    : activeMaterialIds;

  const handleSelectMatSuggestion = (item) => {
    setMatTitle(item.cleanName || item.name);
    if (item.qu === 'm') {
      setMatUnit('m');
    } else {
      setMatUnit('Stk');
    }
    setShowMatSuggestions(false);
  };

  const handleSelectUnclearSuggestion = (item) => {
    setUnclearText(item.cleanName || item.name);
    setSelectedUnclearMat(item);
    if (item.qu === 'm') {
      setUnclearUnit('m');
    } else {
      setUnclearUnit('Stk');
    }
    setShowUnclearSuggestions(false);
  };

  // Stepper with Over-Quantity / Mehrverbrauch check
  const handleStep = (matId, stepDelta) => {
    const mat = materials.find((m) => m.id === matId);
    if (!mat) return;

    const currentDelta = Number(sessionQuantities[matId]) || 0;
    const nextDelta = Math.max(0, currentDelta + stepDelta);

    const hasRoomPlan = Boolean(room.plannedItems && room.plannedItems[matId]);
    const planned = hasRoomPlan ? Number(room.plannedItems[matId].plannedQty) : Number(mat.deliveredQty || 0);
    const installedBefore = hasRoomPlan
      ? Number(room.plannedItems[matId].installedQty || 0)
      : Number(mat.installedQty || 0);
    const nextTotalVerb = installedBefore + nextDelta;

    // Trigger Mehrverbrauch explanation if going over planned and not yet explained
    if (stepDelta > 0 && nextTotalVerb > planned && !overExplanations[matId]) {
      const exceeded = Math.max(1, nextTotalVerb - planned);
      setPendingOverMat({
        mat,
        nextDelta,
        exceededBy: exceeded,
        planned,
        installedBefore,
        qu: mat.qu,
      });
      setOverExtraQty(String(exceeded % 1 === 0 ? exceeded : exceeded.toFixed(1)));
      setOverReason('');
      setShowOverModal(true);
      return;
    }

    onQuantityChange(matId, nextDelta);
  };

  // Adjust extra quantity inside Mehrverbrauch modal via stepper
  const handleStepOverExtra = (delta) => {
    const current = parseFloat(overExtraQty) || 1;
    const next = Math.max(0.5, current + delta);
    setOverExtraQty(String(next % 1 === 0 ? next : Number(next.toFixed(1))));
  };

  // Confirming Mehrverbrauch Overlay
  const handleConfirmOverReason = (reasonToUse) => {
    if (!pendingOverMat) return;
    const finalReason = (reasonToUse || overReason).trim() || 'Mehrverbrauch auf Baustelle';
    const extraNum = Math.max(0.1, parseFloat(overExtraQty) || 1);

    const hasRoomPlan = Boolean(room.plannedItems && room.plannedItems[pendingOverMat.mat.id]);
    const installedBefore = pendingOverMat.installedBefore !== undefined
      ? pendingOverMat.installedBefore
      : (hasRoomPlan
          ? Number(room.plannedItems[pendingOverMat.mat.id].installedQty || 0)
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
        materialName: pendingOverMat.mat.cleanName || pendingOverMat.mat.name,
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

  // Confirming 100% Room Completion & Calculating Delta
  const handleConfirmCompleteRoom = () => {
    const deltaSummary = [];
    activeMaterialIds.forEach((matId) => {
      const mat = materials.find((m) => m.id === matId);
      if (!mat) return;

      const hasRoomPlan = Boolean(room.plannedItems && room.plannedItems[matId]);
      const planned = hasRoomPlan ? Number(room.plannedItems[matId].plannedQty) : null;
      const installedBefore = hasRoomPlan
        ? Number(room.plannedItems[matId].installedQty || 0)
        : Number(mat.installedQty || 0);
      const delta = Number(sessionQuantities[matId]) || 0;
      const totalInstalled = installedBefore + delta;

      deltaSummary.push({
        materialId: mat.id,
        pos: mat.pos,
        name: mat.cleanName || mat.name,
        qu: mat.qu,
        plannedQty: planned,
        installedQty: totalInstalled,
        diff: planned !== null ? Number((planned - totalInstalled).toFixed(2)) : 0,
        status: planned !== null
          ? (totalInstalled > planned ? 'over' : totalInstalled < planned ? 'under' : 'exact')
          : 'documented',
      });
    });

    if (onCompleteRoom) {
      onCompleteRoom(room.id, deltaSummary);
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
    setShowUnclearForm(false);
    setShowUnclearSuggestions(false);
  };

  // Save Nachtrag (dispatches according to active tab with separate payloads)
  const handleSubmitNachtrag = () => {
    if (activeTab === 'material') {
      if (!matTitle.trim()) {
        Alert.alert('Hinweis', 'Bitte Materialbezeichnung eingeben.');
        return;
      }
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
      });

      // Clear material form
      setMatTitle('');
      setMatQty('');
      setMatNote('');
    } else {
      // Arbeitszeit / Stundenlohn
      if (!hoursActivity.trim()) {
        Alert.alert('Hinweis', 'Bitte ausgeführte Tätigkeit eingeben.');
        return;
      }
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
      });

      // Clear hours form
      setHoursActivity('');
      setHoursDuration('');
      setHoursNote('');
    }

    setShowNachtragModal(false);
    Alert.alert('Erfasst', 'Nachtrag wurde zur Synchronisation hinterlegt.');
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
            {t('bookHead', currentLang)} · KW 27
          </Text>
        </View>

        {/* 3 Action Buttons nebeneinander direkt unter dem Titel */}
        <View style={styles.topActionsRow}>
          {/* Button 1: Nachtrag */}
          <TouchableOpacity
            style={styles.actionBtnNachtrag}
            onPress={openNachtragModal}
            activeOpacity={0.7}
          >
            <Text style={styles.actionBtnNachtragText}>＋ {t('nachtrag', currentLang)}</Text>
          </TouchableOpacity>

          {/* Button 2: Position unklar */}
          <TouchableOpacity
            style={[styles.actionBtnUnclear, showUnclearForm && styles.actionBtnUnclearActive]}
            onPress={() => setShowUnclearForm(!showUnclearForm)}
            activeOpacity={0.7}
          >
            <Text style={[styles.actionBtnUnclearText, showUnclearForm && styles.actionBtnUnclearTextActive]}>
              ❓ {t('unclearBtnShort', currentLang)}
            </Text>
          </TouchableOpacity>

          {/* Button 3: Bereich Fertigstellen (Grüner Button) */}
          <TouchableOpacity
            style={[
              styles.actionBtnComplete,
              (room.isCompleted || room.pct === 100) && styles.actionBtnCompleteDone,
            ]}
            onPress={() => setShowCompleteModal(true)}
            activeOpacity={0.7}
          >
            <Text
              style={[
                styles.actionBtnCompleteText,
                (room.isCompleted || room.pct === 100) && styles.actionBtnCompleteDoneText,
              ]}
            >
              ✓ {t('completeBtnShort', currentLang)}
            </Text>
          </TouchableOpacity>
        </View>

        {/* Inline Unclear Form (falls 'Pos. unklar' geöffnet) */}
        {showUnclearForm && (
          <View style={styles.unclearFormCard}>
            <View style={styles.unclearHeaderRow}>
              <Text style={styles.unclearFormTitle}>{t('unclearTitle', currentLang)}</Text>
              <TouchableOpacity
                onPress={() => {
                  setShowUnclearForm(false);
                  setShowUnclearSuggestions(false);
                }}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              >
                <Text style={styles.unclearCloseText}>✕</Text>
              </TouchableOpacity>
            </View>

            <Text style={styles.unclearSubInfo}>
              Erfassen Sie ein verbautes Produkt. Beim Tippen werden auch bereits bestellte Materialien vorgeschlagen.
            </Text>

            {/* Product input with Autosuggest */}
            <View style={{ position: 'relative', zIndex: 10 }}>
              <TextInput
                style={styles.unclearInput}
                placeholder={t('unclearWhat', currentLang)}
                placeholderTextColor={COLORS.muted}
                value={unclearText}
                onChangeText={(text) => {
                  setUnclearText(text);
                  setSelectedUnclearMat(null);
                  setShowUnclearSuggestions(text.trim().length >= 1);
                }}
                onFocus={() => {
                  if (unclearText.trim().length >= 1) {
                    setShowUnclearSuggestions(true);
                  }
                }}
              />

              {/* Suggestions List */}
              {unclearSuggestions.length > 0 && (
                <View style={styles.unclearSuggestionsBox}>
                  <Text style={styles.unclearSugHeader}>
                    Bestellte / GAEB-Positionen:
                  </Text>
                  {unclearSuggestions.map((item) => (
                    <TouchableOpacity
                      key={item.id}
                      style={styles.unclearSugItem}
                      onPress={() => handleSelectUnclearSuggestion(item)}
                      activeOpacity={0.7}
                    >
                      <View style={{ flex: 1 }}>
                        <Text style={styles.unclearSugName} numberOfLines={1}>
                          {item.cleanName || item.name}
                        </Text>
                        <Text style={styles.unclearSugMeta}>
                          Pos {item.pos} · {item.group}
                          {item.deliveredQty ? ` · Geliefert: ${item.deliveredQty} ${item.qu}` : ` · ${item.qu}`}
                        </Text>
                      </View>
                      <View style={styles.unclearSugBadge}>
                        <Text style={styles.unclearSugBadgeText}>Bestellt</Text>
                      </View>
                    </TouchableOpacity>
                  ))}
                </View>
              )}
            </View>

            {/* Unit Toggle: Stück (Menge) vs Meter (Meterzahl) */}
            <View style={styles.unclearUnitToggleRow}>
              <TouchableOpacity
                style={[styles.unclearUnitBtn, unclearUnit === 'Stk' && styles.unclearUnitBtnActive]}
                onPress={() => setUnclearUnit('Stk')}
                activeOpacity={0.7}
              >
                <Text style={[styles.unclearUnitBtnText, unclearUnit === 'Stk' && styles.unclearUnitBtnTextActive]}>
                  Stück (Menge)
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.unclearUnitBtn, unclearUnit === 'm' && styles.unclearUnitBtnActive]}
                onPress={() => setUnclearUnit('m')}
                activeOpacity={0.7}
              >
                <Text style={[styles.unclearUnitBtnText, unclearUnit === 'm' && styles.unclearUnitBtnTextActive]}>
                  Meter (Meterzahl)
                </Text>
              </TouchableOpacity>
            </View>

            {/* Quantity Input */}
            <TextInput
              style={styles.unclearInput}
              placeholder={unclearUnit === 'm' ? "Meterzahl (z. B. 12.5)" : "Menge in Stück (z. B. 10)"}
              placeholderTextColor={COLORS.muted}
              keyboardType="decimal-pad"
              value={unclearQty}
              onChangeText={setUnclearQty}
            />

            <TouchableOpacity style={styles.unclearSaveBtn} onPress={handleSaveUnclear} activeOpacity={0.8}>
              <Text style={styles.unclearSaveText}>{t('unclearRecord', currentLang)}</Text>
            </TouchableOpacity>
          </View>
        )}

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
                  <Text style={styles.uBadgeText}>Zuordnung offen</Text>
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
              placeholder={t('searchPlaceholder', currentLang) || "Position suchen – z. B. 1.002, Rohr, Bogen..."}
              placeholderTextColor={COLORS.muted}
              value={searchQuery}
              onChangeText={setSearchQuery}
              onSubmitEditing={() => {
                if (searchResults.length > 0) {
                  handlePickMaterial(searchResults[0].id);
                }
              }}
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

          {/* Autocomplete-Ergebnisse direkt unter dem Suchfeld */}
          {searchResults.length > 0 && (
            <View style={styles.resultsList}>
              <View style={styles.resultsHeaderRow}>
                <Text style={styles.resultsHeaderText}>Gefundene Positionen (Klick verschiebt nach ganz oben):</Text>
              </View>
              {searchResults.map((item) => (
                <TouchableOpacity
                  key={item.id}
                  style={styles.resultRow}
                  onPress={() => handlePickMaterial(item.id)}
                  activeOpacity={0.7}
                >
                  <View style={styles.resPosChip}>
                    <Text style={styles.resPosChipText}>Pos {item.pos}</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.resName}>{item.cleanName}</Text>
                    <Text style={styles.resSub}>
                      {item.group} · {item.qu === 'm' ? 'Meter (m)' : 'Stück (Stk)'}
                      {item.containsHint ? ` · (${item.containsHint})` : ''}
                    </Text>
                  </View>
                  <View style={styles.resPickBadge}>
                    <Text style={styles.resPickArrow}>↑ Nach oben</Text>
                  </View>
                </TouchableOpacity>
              ))}
            </View>
          )}
        </View>

        {/* Active Material Booking Rows (displayMaterialIds puts matching/selected items first!) */}
        <View style={styles.rowsWrapper}>
          {displayMaterialIds.map((matId) => {
            const mat = materials.find((m) => m.id === matId);
            if (!mat) return null;

            const delta = Number(sessionQuantities[matId]) || 0;
            const hasRoomPlan = Boolean(room.plannedItems && room.plannedItems[matId]);
            const roomPlanned = hasRoomPlan ? Number(room.plannedItems[matId].plannedQty) : null;
            const roomInstalledBefore = hasRoomPlan
              ? Number(room.plannedItems[matId].installedQty || 0)
              : Number(mat.installedQty || 0);

            const currentRoomVerb = roomInstalledBefore + delta;
            const projectDelivered = Number(mat.deliveredQty || 0);

            // Remaining for this room: planned - verbaut (or delivered - verbaut if pure GAEB)
            const roomRemaining = hasRoomPlan
              ? Math.max(0, roomPlanned - currentRoomVerb)
              : Math.max(0, projectDelivered - currentRoomVerb);

            const isOver = hasRoomPlan
              ? currentRoomVerb > roomPlanned
              : currentRoomVerb > projectDelivered;

            const exceededBy = hasRoomPlan
              ? Math.max(0, currentRoomVerb - roomPlanned)
              : Math.max(0, currentRoomVerb - projectDelivered);

            // Progress percentage: strictly capped at 100%
            const baseTarget = hasRoomPlan ? roomPlanned : projectDelivered;
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
                            +{exceededBy.toFixed(1)} {mat.qu} Mehrverbrauch
                          </Text>
                        </View>
                      ) : null}
                    </View>

                    <Text style={styles.matName}>
                      {mat.cleanName}
                      {gloss ? <Text style={styles.matGloss}> ({gloss})</Text> : null}
                    </Text>
                    <Text style={styles.matGroup}>{mat.group}</Text>
                  </View>
                </View>

                {/* 2. 4-Metrics Matrix: Geliefert | Geplant | Verbaut | Rest */}
                <View style={styles.metricsContainer}>
                  {/* Geliefert (Gesamtbaustelle) */}
                  <View style={styles.metricCell}>
                    <Text style={styles.metricLabel}>Geliefert</Text>
                    <Text style={styles.metricValue}>
                      {projectDelivered} <Text style={styles.metricUnit}>{mat.qu}</Text>
                    </Text>
                    <Text style={styles.metricSub}>Gesamt</Text>
                  </View>

                  <View style={styles.metricDivider} />

                  {/* Geplant (Raum oder GAEB-Fallback) */}
                  <View style={styles.metricCell}>
                    <Text style={styles.metricLabel}>Geplant</Text>
                    <Text style={styles.metricValue}>
                      {hasRoomPlan ? `${roomPlanned} ` : '–'}
                      {hasRoomPlan ? <Text style={styles.metricUnit}>{mat.qu}</Text> : ''}
                    </Text>
                    <Text style={styles.metricSub}>{hasRoomPlan ? 'Raum' : 'Nur GAEB'}</Text>
                  </View>

                  <View style={styles.metricDivider} />

                  {/* Verbaut (In Raum) */}
                  <View style={styles.metricCell}>
                    <Text style={styles.metricLabel}>Verbaut</Text>
                    <Text style={[styles.metricValue, isOver && styles.metricValOver]}>
                      {currentRoomVerb} <Text style={styles.metricUnit}>{mat.qu}</Text>
                    </Text>
                    <Text style={styles.metricSub}>In Raum</Text>
                  </View>

                  <View style={styles.metricDivider} />

                  {/* Rest (Im Raum noch zu verbauen) */}
                  <View style={styles.metricCell}>
                    <Text style={styles.metricLabel}>Rest</Text>
                    <Text
                      style={[
                        styles.metricValue,
                        isOver
                          ? styles.metricValOver
                          : roomRemaining === 0
                          ? styles.metricValDone
                          : null,
                      ]}
                    >
                      {isOver ? `-${exceededBy.toFixed(1)}` : roomRemaining.toFixed(1)}{' '}
                      <Text style={styles.metricUnit}>{mat.qu}</Text>
                    </Text>
                    <Text style={styles.metricSub}>{isOver ? 'Über Soll' : 'Offen'}</Text>
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
                        ⚠️ Mehrverbrauch erfasst
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
            {t('toPhotos', currentLang)}
            {photoCount > 0 ? ` (${photoCount})` : ''}
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
              <Text style={styles.modalMainTitle}>{t('nachtragTitle', currentLang)}</Text>
              <Text style={styles.modalSubTitle}>{room.name} · KW 27</Text>
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
            >
              {/* ========================================================= */}
              {/* TAB 1: MATERIAL NACHTRAG                                 */}
              {/* ========================================================= */}
              {activeTab === 'material' && (
                <View>
                  {/* Material / Artikel mit GAEB Autosuggester */}
                  <View style={styles.modalField}>
                    <Text style={styles.modalFieldLabel}>Material / Artikel (aus GAEB oder Freitext)</Text>
                    <TextInput
                      style={styles.modalInput}
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
                        <Text style={styles.suggestionsHeader}>Treffer aus GAEB / Leistungsverzeichnis:</Text>
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
                              <Text style={styles.sugUnitBadge}>{item.qu === 'm' ? 'Meter (m)' : 'Stück (Stk)'}</Text>
                            </View>
                            <Text style={styles.sugTitle}>{item.cleanName}</Text>
                            <Text style={styles.sugGroup}>{item.group}</Text>
                          </TouchableOpacity>
                        ))}
                      </View>
                    )}
                  </View>

                  {/* Einheit & Mengeneingabe */}
                  <View style={styles.modalField}>
                    <Text style={styles.modalFieldLabel}>Einheit wählen</Text>
                    <View style={styles.unitSelectorRow}>
                      <TouchableOpacity
                        style={[styles.unitToggle, matUnit === 'Stk' && styles.unitToggleActive]}
                        onPress={() => setMatUnit('Stk')}
                      >
                        <Text style={[styles.unitToggleText, matUnit === 'Stk' && styles.unitToggleTextActive]}>
                          Stück (Menge)
                        </Text>
                      </TouchableOpacity>

                      <TouchableOpacity
                        style={[styles.unitToggle, matUnit === 'm' && styles.unitToggleActive]}
                        onPress={() => setMatUnit('m')}
                      >
                        <Text style={[styles.unitToggleText, matUnit === 'm' && styles.unitToggleTextActive]}>
                          Meter (Meterzahl)
                        </Text>
                      </TouchableOpacity>
                    </View>

                    <TextInput
                      style={styles.modalInput}
                      placeholder={`Anzahl in ${matUnit === 'm' ? 'Metern (z. B. 6.5)' : 'Stück (z. B. 2)'}`}
                      placeholderTextColor={COLORS.muted}
                      keyboardType="decimal-pad"
                      value={matQty}
                      onChangeText={setMatQty}
                    />
                  </View>

                  {/* Besteller / Auftraggeber (Default: Monteurname) */}
                  <View style={styles.modalField}>
                    <Text style={styles.modalFieldLabel}>Auftraggeber / Besteller</Text>
                    <TextInput
                      style={styles.modalInput}
                      placeholder={t('reBest', currentLang)}
                      placeholderTextColor={COLORS.muted}
                      value={matBesteller}
                      onChangeText={setMatBesteller}
                    />
                  </View>

                  {/* Kommentar / Begründung (3 Zeilen) */}
                  <View style={styles.modalField}>
                    <Text style={styles.modalFieldLabel}>Kommentar / Begründung (3 Zeilen)</Text>
                    <TextInput
                      style={[styles.modalInput, styles.multilineInput]}
                      placeholder="Begründung für den Bauleiter (z. B. Sonderwunsch Bauherr, fehlendes Fitting)..."
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
                    <Text style={styles.modalFieldLabel}>Ausgeführte Tätigkeit / Arbeit</Text>
                    <TextInput
                      style={styles.modalInput}
                      placeholder="z. B. Kernbohrung DN 150 + Mauerdurchbruch..."
                      placeholderTextColor={COLORS.muted}
                      value={hoursActivity}
                      onChangeText={setHoursActivity}
                    />
                  </View>

                  {/* Stunden & Schnellwahl */}
                  <View style={styles.modalField}>
                    <Text style={styles.modalFieldLabel}>Geleistete Stunden (h)</Text>
                    <TextInput
                      style={styles.modalInput}
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
                    <Text style={styles.modalFieldLabel}>Ausführender Monteur / Auftraggeber</Text>
                    <TextInput
                      style={styles.modalInput}
                      placeholder="Monteur-Name"
                      placeholderTextColor={COLORS.muted}
                      value={hoursMonteur}
                      onChangeText={setHoursMonteur}
                    />
                  </View>

                  {/* Begründung / Notiz (3 Zeilen) */}
                  <View style={styles.modalField}>
                    <Text style={styles.modalFieldLabel}>Begründung für Mehraufwand (3 Zeilen)</Text>
                    <TextInput
                      style={[styles.modalInput, styles.multilineInput]}
                      placeholder="Grund für die Stundenlohnarbeiten (z. B. unvorhergesehene Altbaubeschaffenheit)..."
                      placeholderTextColor={COLORS.muted}
                      multiline={true}
                      numberOfLines={3}
                      value={hoursNote}
                      onChangeText={setHoursNote}
                    />
                  </View>
                </View>
              )}

              {/* Submit CTA Button */}
              <TouchableOpacity
                style={styles.modalSubmitBtn}
                onPress={handleSubmitNachtrag}
                activeOpacity={0.8}
              >
                <Text style={styles.modalSubmitText}>
                  {activeTab === 'material' ? 'Material-Nachtrag erfassen' : 'Arbeitszeit erfassen'}
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
        <SafeAreaView style={styles.modalFullscreen}>
          {/* Header with Title and Close '✕' Button */}
          <View style={styles.modalHeader}>
            <View style={styles.modalTitleBox}>
              <Text style={styles.modalMainTitle}>⚠️ Mehraufwand / Mehrverbrauch</Text>
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
              contentContainerStyle={styles.modalScrollContent}
              keyboardShouldPersistTaps="handled"
            >
              {/* Product Info & Calculation Card */}
              <View style={styles.overSummaryCard}>
                <View style={styles.overCardHeaderRow}>
                  <View style={styles.iconBoxOver}>
                    <Text style={styles.iconSymbolOver}>
                      {getMatIconSymbol(pendingOverMat?.mat?.icon)}
                    </Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <View style={styles.posRow}>
                      <View style={styles.posChip}>
                        <Text style={styles.posChipText}>Pos {pendingOverMat?.mat?.pos}</Text>
                      </View>
                      <View style={styles.overBadge}>
                        <Text style={styles.overBadgeText}>
                          +{parseFloat(overExtraQty) || 0} {pendingOverMat?.qu} Mehr
                        </Text>
                      </View>
                    </View>
                    <Text style={styles.overMatTitle}>
                      {pendingOverMat?.mat?.cleanName || pendingOverMat?.mat?.name}
                    </Text>
                    {pendingOverMat?.mat?.name !== pendingOverMat?.mat?.cleanName ? (
                      <Text style={styles.overMatSubtitle} numberOfLines={2}>
                        {pendingOverMat?.mat?.name}
                      </Text>
                    ) : null}
                  </View>
                </View>

                {/* Live Calculation Matrix: Geplant -> Neu verbaut -> Mehrverbrauch */}
                <View style={styles.overCalcBox}>
                  <View style={styles.overCalcCol}>
                    <Text style={styles.overCalcLabel}>Geplant Raum</Text>
                    <Text style={styles.overCalcVal}>
                      {pendingOverMat?.planned} {pendingOverMat?.qu}
                    </Text>
                  </View>
                  <Text style={styles.overCalcArrow}>→</Text>
                  <View style={styles.overCalcCol}>
                    <Text style={styles.overCalcLabel}>Neu verbaut</Text>
                    <Text style={styles.overCalcVal}>
                      {((pendingOverMat?.planned || 0) + (parseFloat(overExtraQty) || 0)).toFixed(1).replace(/\.0$/, '')} {pendingOverMat?.qu}
                    </Text>
                  </View>
                  <Text style={styles.overCalcArrow}>=</Text>
                  <View style={styles.overCalcCol}>
                    <Text style={[styles.overCalcLabel, { color: COLORS.red }]}>Mehrverbrauch</Text>
                    <Text style={[styles.overCalcVal, { color: COLORS.red, fontWeight: '900' }]}>
                      +{(parseFloat(overExtraQty) || 0).toFixed(1).replace(/\.0$/, '')} {pendingOverMat?.qu}
                    </Text>
                  </View>
                </View>
              </View>

              {/* Quantity Controls: Stepper [−] [Input] [+] and Quick Select Pills */}
              <View style={styles.modalField}>
                <Text style={styles.modalFieldLabel}>
                  Zusätzlich benötigte Menge ({pendingOverMat?.qu === 'm' ? 'Meter' : 'Stück'}):
                </Text>

                <View style={styles.overQtyControlRow}>
                  <TouchableOpacity
                    style={styles.overStepBtn}
                    onPress={() => handleStepOverExtra(-1)}
                    activeOpacity={0.7}
                  >
                    <Text style={styles.overStepBtnText}>−</Text>
                  </TouchableOpacity>

                  <View style={styles.overInputWrap}>
                    <Text style={styles.overPlusSign}>+</Text>
                    <TextInput
                      style={styles.overQtyInput}
                      value={overExtraQty}
                      onChangeText={(val) => setOverExtraQty(val.replace(',', '.'))}
                      keyboardType="decimal-pad"
                      placeholder="z. B. 8"
                      placeholderTextColor={COLORS.muted}
                      selectTextOnFocus
                    />
                    <Text style={styles.overUnitSuffix}>{pendingOverMat?.qu}</Text>
                  </View>

                  <TouchableOpacity
                    style={styles.overStepBtn}
                    onPress={() => handleStepOverExtra(1)}
                    activeOpacity={0.7}
                  >
                    <Text style={styles.overStepBtnText}>+</Text>
                  </TouchableOpacity>
                </View>

                {/* Quick Pills for 1-tap setting (+1, +2, +3, +5, +8, +10, +15) */}
                <Text style={styles.overQuickLabel}>Schnellauswahl für Mehraufwand:</Text>
                <View style={styles.overQuickPillsRow}>
                  {['1', '2', '3', '5', '8', '10', '15'].map((val) => {
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

              {/* Reason Selection */}
              <View style={styles.modalField}>
                <Text style={styles.modalFieldLabel}>
                  Grund für Bauleiter & Nachtrag wählen:
                </Text>

                <View style={styles.quickPillsGrid}>
                  {[
                    'Planänderung Bauherr',
                    'Altbau-Hindernis / Versprung',
                    'Verschnitt / Beschädigung',
                    'Zusätzlicher Anschluss',
                  ].map((reasonOption) => (
                    <TouchableOpacity
                      key={reasonOption}
                      style={[
                        styles.reasonPill,
                        overReason === reasonOption && styles.reasonPillActive,
                      ]}
                      onPress={() => setOverReason(reasonOption)}
                      activeOpacity={0.7}
                    >
                      <Text
                        style={[
                          styles.reasonPillText,
                          overReason === reasonOption && styles.reasonPillTextActive,
                        ]}
                      >
                        {reasonOption}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>

                {/* 3-line Comment / Reason field */}
                <Text style={styles.modalFieldLabel}>
                  Detail-Begründung (3 Zeilen für Baustellen-Notizen):
                </Text>
                <TextInput
                  style={styles.overReasonInputFullscreen}
                  placeholder="Begründung für Mehraufwand eingeben (erscheint im Bauleiter-Dashboard)..."
                  placeholderTextColor={COLORS.muted}
                  multiline={true}
                  numberOfLines={3}
                  value={overReason}
                  onChangeText={setOverReason}
                />
              </View>

              {/* Fullscreen Action Buttons */}
              <View style={styles.overFullscreenActionRow}>
                <TouchableOpacity
                  style={styles.overCancelBtnLarge}
                  onPress={() => {
                    setShowOverModal(false);
                    setPendingOverMat(null);
                  }}
                  activeOpacity={0.7}
                >
                  <Text style={styles.overCancelTextLarge}>Abbrechen</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.overConfirmBtnLarge}
                  onPress={() => handleConfirmOverReason()}
                  activeOpacity={0.8}
                >
                  <Text style={styles.overConfirmTextLarge}>
                    ✓ Mehraufwand (+{overExtraQty || 0} {pendingOverMat?.qu}) buchen
                  </Text>
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
              <Text style={styles.completeModalTitle}>✓ Raum/Ort fertigstellen</Text>
              <TouchableOpacity
                onPress={() => setShowCompleteModal(false)}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              >
                <Text style={styles.overModalClose}>✕</Text>
              </TouchableOpacity>
            </View>

            <Text style={styles.completeModalSub}>
              {room.name} ({room.code}) · 100 % Abschluss
            </Text>

            <Text style={styles.completeNoticeText}>
              Die Fertigstellung setzt den Raum auf 100 %. Das Mengen-Delta (Minder- oder Mehrverbrauch) wird für den Bauleiter im Admin-Panel zur VOB-Abrechnung hinterlegt:
            </Text>

            {/* Delta Summary List */}
            <ScrollView style={styles.deltaScrollList}>
              {activeMaterialIds.map((matId) => {
                const mat = materials.find((m) => m.id === matId);
                if (!mat) return null;

                const hasRoomPlan = Boolean(room.plannedItems && room.plannedItems[matId]);
                const planned = hasRoomPlan ? Number(room.plannedItems[matId].plannedQty) : null;
                const installedBefore = hasRoomPlan
                  ? Number(room.plannedItems[matId].installedQty || 0)
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
                        Pos {mat.pos} · {mat.cleanName}
                      </Text>
                      <Text style={styles.deltaMatSub}>
                        {hasRoomPlan
                          ? `Soll: ${planned} ${mat.qu}  |  Ist: ${totalVerb} ${mat.qu}`
                          : `Verbaut: ${totalVerb} ${mat.qu} (GAEB-Bestand)`}
                      </Text>
                    </View>

                    {hasRoomPlan ? (
                      isUnder ? (
                        <View style={styles.deltaBadgeUnder}>
                          <Text style={styles.deltaBadgeUnderText}>
                            +{diff.toFixed(1)} {mat.qu} unverbaut
                          </Text>
                        </View>
                      ) : isOver ? (
                        <View style={styles.deltaBadgeOver}>
                          <Text style={styles.deltaBadgeOverText}>
                            -{Math.abs(diff).toFixed(1)} {mat.qu} Mehraufwand
                          </Text>
                        </View>
                      ) : (
                        <View style={styles.deltaBadgeExact}>
                          <Text style={styles.deltaBadgeExactText}>Exakt nach Plan</Text>
                        </View>
                      )
                    ) : (
                      <View style={styles.deltaBadgeExact}>
                        <Text style={styles.deltaBadgeExactText}>{totalVerb} {mat.qu}</Text>
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
                <Text style={styles.overCancelText}>Weiter bearbeiten</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.completeConfirmBtn}
                onPress={handleConfirmCompleteRoom}
                activeOpacity={0.8}
              >
                <Text style={styles.completeConfirmText}>Raum jetzt abschließen (100 %)</Text>
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
    paddingBottom: 90,
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
    backgroundColor: '#059669',
    borderWidth: 1.5,
    borderColor: '#047857',
    borderRadius: 10,
    shadowColor: '#059669',
    shadowOpacity: 0.25,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 3,
    elevation: 2,
  },
  actionBtnCompleteText: {
    fontSize: 12,
    fontWeight: '900',
    color: '#FFFFFF',
  },
  actionBtnCompleteDone: {
    backgroundColor: '#D1FAE5',
    borderColor: '#10B981',
  },
  actionBtnCompleteDoneText: {
    color: '#065F46',
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
  resultsList: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1.5,
    borderColor: '#93C5FD',
    borderRadius: 12,
    marginTop: 6,
    overflow: 'hidden',
    elevation: 3,
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 4,
  },
  resultsHeaderRow: {
    backgroundColor: '#EFF6FF',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: '#DBEAFE',
  },
  resultsHeaderText: {
    fontSize: 11,
    fontWeight: '700',
    color: COLORS.primary,
  },
  resultRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#EEF2F6',
  },
  resPosChip: {
    backgroundColor: '#EFF6FF',
    borderWidth: 1,
    borderColor: '#BFDBFE',
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 2,
    marginRight: 10,
  },
  resPosChipText: {
    fontSize: 11,
    fontWeight: '800',
    color: COLORS.primary,
  },
  resName: {
    fontSize: 13.5,
    fontWeight: '700',
    color: COLORS.ink,
  },
  resSub: {
    fontSize: 11.5,
    color: COLORS.muted,
    marginTop: 2,
  },
  resPickBadge: {
    backgroundColor: '#F0FDF4',
    borderWidth: 1,
    borderColor: '#86EFAC',
    borderRadius: 6,
    paddingHorizontal: 7,
    paddingVertical: 4,
    marginLeft: 8,
  },
  resPickArrow: {
    fontSize: 11,
    fontWeight: '800',
    color: '#15803D',
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
  modalSubmitText: {
    color: '#FFFFFF',
    fontWeight: '800',
    fontSize: 16,
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
    backgroundColor: COLORS.amber,
    alignItems: 'center',
    shadowColor: COLORS.amber,
    shadowOpacity: 0.3,
    shadowOffset: { width: 0, height: 3 },
    shadowRadius: 6,
    elevation: 3,
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
