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
}) {
  const [searchQuery, setSearchQuery] = useState('');
  const [activeMaterialIds, setActiveMaterialIds] = useState(
    room.defaultMaterialIds || ['m2', 'm3', 'm4', 'm5']
  );

  // Unclear item inline form
  const [showUnclearForm, setShowUnclearForm] = useState(false);
  const [unclearText, setUnclearText] = useState('');
  const [unclearQty, setUnclearQty] = useState('');

  // Nachtrag Modal state
  const [showNachtragModal, setShowNachtragModal] = useState(false);
  const [nachtragType, setNachtragType] = useState('material'); // 'material' | 'stunden'
  const [nachtragTitle, setNachtragTitle] = useState('');
  const [nachtragQty, setNachtragQty] = useState('');
  const [nachtragUnit, setNachtragUnit] = useState('Stk'); // 'Stk' (Menge) | 'm' (Meterzahl)
  const [nachtragBesteller, setNachtragBesteller] = useState('');
  const [nachtragNote, setNachtragNote] = useState('');
  const [showNachtragSuggestions, setShowNachtragSuggestions] = useState(false);

  // Pre-fill monteur name as default Auftraggeber/Besteller when modal opens
  const openNachtragModal = () => {
    if (!nachtragBesteller) {
      setNachtragBesteller(monteur?.name || '');
    }
    setShowNachtragSuggestions(false);
    setShowNachtragModal(true);
  };

  // Filter materials for search autocomplete in main screen
  const q = searchQuery.trim().toLowerCase();
  const searchResults = q
    ? materials.filter((m) =>
        (m.pos + ' ' + m.name + ' ' + m.cleanName + ' ' + m.group).toLowerCase().includes(q)
      ).slice(0, 6)
    : [];

  // Filter materials for Nachtrag GAEB autosuggester
  const nq = nachtragTitle.trim().toLowerCase();
  const nachtragSuggestions = (showNachtragSuggestions && nq.length >= 1 && nachtragType === 'material')
    ? materials.filter((m) =>
        (m.pos + ' ' + m.name + ' ' + m.cleanName + ' ' + m.group).toLowerCase().includes(nq)
      ).slice(0, 8)
    : [];

  const handlePickMaterial = (id) => {
    if (!activeMaterialIds.includes(id)) {
      setActiveMaterialIds([id, ...activeMaterialIds]);
    }
    setSearchQuery('');
  };

  const handleSelectNachtragSuggestion = (item) => {
    setNachtragTitle(item.cleanName || item.name);
    // Auto-detect unit: if position is measured in meters, set 'm', else 'Stk'
    if (item.qu === 'm') {
      setNachtragUnit('m');
    } else {
      setNachtragUnit('Stk');
    }
    setShowNachtragSuggestions(false);
  };

  const handleStep = (id, delta) => {
    const current = Number(sessionQuantities[id]) || 0;
    const next = Math.max(0, current + delta);
    onQuantityChange(id, next);
  };

  const handleSaveUnclear = () => {
    if (!unclearText.trim()) return;
    onAddUnclearItem({
      txt: unclearText.trim(),
      qty: unclearQty.trim() || '1 Stk',
      roomId: room.id,
      roomName: room.name,
    });
    setUnclearText('');
    setUnclearQty('');
    setShowUnclearForm(false);
  };

  const handleCreateNachtrag = () => {
    if (!nachtragTitle.trim()) {
      Alert.alert('Hinweis', 'Bitte Bezeichnung / Material eingeben.');
      return;
    }

    let finalQty = '';
    if (nachtragType === 'stunden') {
      finalQty = `${nachtragQty.trim() || '1'} h`;
    } else {
      const cleanVal = nachtragQty.trim() || '1';
      finalQty = `${cleanVal} ${nachtragUnit}`;
    }

    onAddNachtrag({
      roomId: room.id,
      roomName: room.name,
      type: nachtragType,
      title: nachtragTitle.trim(),
      quantity: finalQty,
      qu: nachtragType === 'stunden' ? 'h' : nachtragUnit,
      requestedBy: nachtragBesteller.trim() || monteur?.name || 'Monteur',
      note: nachtragNote.trim(),
    });

    setNachtragTitle('');
    setNachtragQty('');
    setNachtragNote('');
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
        <View style={styles.headerRow}>
          <View style={styles.headerTitles}>
            <Text style={styles.roomTitle}>{room.name}</Text>
            <Text style={styles.roomSubtitle}>
              {t('bookHead', currentLang)} · KW 27
            </Text>
          </View>
          <TouchableOpacity
            style={styles.nachtragButton}
            onPress={openNachtragModal}
            activeOpacity={0.7}
          >
            <Text style={styles.nachtragBtnText}>＋ {t('nachtrag', currentLang)}</Text>
          </TouchableOpacity>
        </View>

        {/* Search / Add Material Input */}
        <View style={styles.searchSection}>
          <Text style={styles.searchLabel}>{t('addLabel', currentLang)}</Text>
          <TextInput
            style={styles.searchInput}
            placeholder={t('searchPlaceholder', currentLang)}
            placeholderTextColor={COLORS.muted}
            value={searchQuery}
            onChangeText={setSearchQuery}
          />

          {/* Autocomplete Results */}
          {searchResults.length > 0 && (
            <View style={styles.resultsList}>
              {searchResults.map((item) => (
                <TouchableOpacity
                  key={item.id}
                  style={styles.resultRow}
                  onPress={() => handlePickMaterial(item.id)}
                >
                  <Text style={styles.resName}>{item.cleanName}</Text>
                  <Text style={styles.resSub}>
                    Pos {item.pos} · {item.group} · {item.qu}
                    {item.containsHint ? ` · (${item.containsHint})` : ''}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          )}

          {/* Button: Position unklar */}
          <TouchableOpacity
            style={styles.unclearBtn}
            onPress={() => setShowUnclearForm(!showUnclearForm)}
            activeOpacity={0.7}
          >
            <Text style={styles.unclearBtnText}>{t('unclearBtn', currentLang)}</Text>
          </TouchableOpacity>

          {/* Inline Unclear Form */}
          {showUnclearForm && (
            <View style={styles.unclearFormCard}>
              <Text style={styles.unclearFormTitle}>{t('unclearTitle', currentLang)}</Text>
              <TextInput
                style={styles.unclearInput}
                placeholder={t('unclearWhat', currentLang)}
                placeholderTextColor={COLORS.muted}
                value={unclearText}
                onChangeText={setUnclearText}
              />
              <TextInput
                style={styles.unclearInput}
                placeholder={t('unclearQty', currentLang)}
                placeholderTextColor={COLORS.muted}
                value={unclearQty}
                onChangeText={setUnclearQty}
              />
              <TouchableOpacity style={styles.unclearSaveBtn} onPress={handleSaveUnclear}>
                <Text style={styles.unclearSaveText}>{t('unclearRecord', currentLang)}</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>

        {/* Unclear items list */}
        {unclearItems.length > 0 && (
          <View style={styles.unclearSectionWrapper}>
            <Text style={styles.unclearSectTitle}>{t('unclearSection', currentLang)}</Text>
            {unclearItems.map((u, i) => (
              <View key={i} style={styles.unclearRow}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.uName}>{u.txt}</Text>
                  <Text style={styles.uSub}>{u.qty} · {room.name}</Text>
                </View>
                <View style={styles.uBadge}>
                  <Text style={styles.uBadgeText}>Zuordnung offen</Text>
                </View>
              </View>
            ))}
          </View>
        )}

        {/* Active Material Booking Rows */}
        <View style={styles.rowsWrapper}>
          {activeMaterialIds.map((matId) => {
            const mat = materials.find((m) => m.id === matId);
            if (!mat) return null;

            const delta = Number(sessionQuantities[matId]) || 0;
            const currentTotalVerb = (Number(mat.installedQty) || 0) + delta;
            const remaining = (Number(mat.deliveredQty) || 0) - currentTotalVerb;
            const isOver = remaining < 0;
            const donePct = mat.deliveredQty > 0
              ? Math.min(100, Math.round((currentTotalVerb / mat.deliveredQty) * 100))
              : 0;

            const gloss = getForeignGloss(mat);

            return (
              <View key={mat.id} style={styles.bookRow}>
                {/* Icon box */}
                <View style={[styles.iconBox, isOver && styles.iconBoxOver]}>
                  <Text style={[styles.iconSymbol, isOver && styles.iconSymbolOver]}>
                    {getMatIconSymbol(mat.icon)}
                  </Text>
                </View>

                {/* Details */}
                <View style={styles.infoCol}>
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
                  </View>

                  <Text style={styles.matName}>
                    {mat.cleanName}
                    {gloss ? <Text style={styles.matGloss}> ({gloss})</Text> : null}
                  </Text>
                  <Text style={styles.matGroup}>{mat.group}</Text>

                  {/* Quantity Pool Counters */}
                  <View style={styles.poolRow}>
                    <Text style={styles.poolText}>
                      {t('gLief', currentLang)} <Text style={styles.poolBold}>{mat.deliveredQty} {mat.qu}</Text>
                    </Text>
                    <Text style={styles.poolText}>
                      {t('gBer', currentLang)} <Text style={styles.poolBold}>{currentTotalVerb}</Text>
                    </Text>
                    <Text style={[styles.poolText, isOver && styles.poolTextOver]}>
                      {t('gRest', currentLang)} <Text style={[styles.poolBold, isOver && styles.poolTextOver]}>{remaining.toFixed(1)} {mat.qu}</Text>
                    </Text>
                  </View>

                  {/* Progress bar */}
                  <ProgressBar progress={donePct} isOver={isOver} height={6} style={{ marginTop: 6 }} />
                </View>

                {/* Stepper (+ / -) */}
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

      {/* Nachtrag Fullscreen Modal Dialog with Close '✕' Button */}
      <Modal visible={showNachtragModal} animationType="slide" presentationStyle="fullScreen">
        <SafeAreaView style={styles.modalFullscreen}>
          {/* Fullscreen Modal Header */}
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

          <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : undefined}
            style={{ flex: 1 }}
          >
            <ScrollView
              style={styles.modalBody}
              contentContainerStyle={styles.modalScrollContent}
              keyboardShouldPersistTaps="handled"
            >
              {/* Mode Switcher: Material vs Stundenlohn */}
              <View style={styles.typeModes}>
                <TouchableOpacity
                  style={[styles.typeMode, nachtragType === 'material' && styles.typeModeActive]}
                  onPress={() => {
                    setNachtragType('material');
                    setShowNachtragSuggestions(false);
                  }}
                >
                  <Text style={[styles.typeModeText, nachtragType === 'material' && styles.typeModeTextActive]}>
                    {t('typeMat', currentLang)}
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.typeMode, nachtragType === 'stunden' && styles.typeModeActive]}
                  onPress={() => {
                    setNachtragType('stunden');
                    setShowNachtragSuggestions(false);
                  }}
                >
                  <Text style={[styles.typeModeText, nachtragType === 'stunden' && styles.typeModeTextActive]}>
                    {t('typeStd', currentLang)}
                  </Text>
                </TouchableOpacity>
              </View>

              {/* Material/Artikel Input with GAEB Autosuggester */}
              <View style={styles.modalField}>
                <Text style={styles.modalFieldLabel}>
                  {nachtragType === 'stunden' ? t('fldTaetigkeit', currentLang) : 'Material / Artikel (aus GAEB oder Freitext)'}
                </Text>
                <TextInput
                  style={styles.modalInput}
                  placeholder={nachtragType === 'stunden' ? 'z. B. Kernbohrung + Anpassung' : 'z. B. DIN 100, Bogen, Kugelhahn...'}
                  placeholderTextColor={COLORS.muted}
                  value={nachtragTitle}
                  onChangeText={(val) => {
                    setNachtragTitle(val);
                    setShowNachtragSuggestions(true);
                  }}
                  onFocus={() => setShowNachtragSuggestions(true)}
                />

                {/* GAEB Product Autosuggester Dropdown */}
                {nachtragSuggestions.length > 0 && (
                  <View style={styles.suggestionsContainer}>
                    <Text style={styles.suggestionsHeader}>Treffer aus GAEB / Leistungsverzeichnis:</Text>
                    {nachtragSuggestions.map((item) => (
                      <TouchableOpacity
                        key={item.id}
                        style={styles.suggestionItem}
                        onPress={() => handleSelectNachtragSuggestion(item)}
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

              {/* Quantity Section with Toggle: Stück (Menge) vs Meter (Meterzahl) */}
              {nachtragType === 'material' ? (
                <View style={styles.modalField}>
                  <Text style={styles.modalFieldLabel}>Einheit & Menge</Text>
                  {/* Unit Selector: Menge vs Meterzahl */}
                  <View style={styles.unitSelectorRow}>
                    <TouchableOpacity
                      style={[styles.unitToggle, nachtragUnit === 'Stk' && styles.unitToggleActive]}
                      onPress={() => setNachtragUnit('Stk')}
                    >
                      <Text style={[styles.unitToggleText, nachtragUnit === 'Stk' && styles.unitToggleTextActive]}>
                        Stück (Menge)
                      </Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={[styles.unitToggle, nachtragUnit === 'm' && styles.unitToggleActive]}
                      onPress={() => setNachtragUnit('m')}
                    >
                      <Text style={[styles.unitToggleText, nachtragUnit === 'm' && styles.unitToggleTextActive]}>
                        Meter (Meterzahl)
                      </Text>
                    </TouchableOpacity>
                  </View>

                  <TextInput
                    style={styles.modalInput}
                    placeholder={`Anzahl in ${nachtragUnit === 'm' ? 'Metern (z. B. 6.5)' : 'Stück (z. B. 2)'}`}
                    placeholderTextColor={COLORS.muted}
                    keyboardType="decimal-pad"
                    value={nachtragQty}
                    onChangeText={setNachtragQty}
                  />
                </View>
              ) : (
                <View style={styles.modalField}>
                  <Text style={styles.modalFieldLabel}>{t('fldStunden', currentLang)}</Text>
                  <TextInput
                    style={styles.modalInput}
                    placeholder="z. B. 2.5"
                    placeholderTextColor={COLORS.muted}
                    keyboardType="decimal-pad"
                    value={nachtragQty}
                    onChangeText={setNachtragQty}
                  />
                </View>
              )}

              {/* Auftraggeber / Besteller (Default Monteurname) */}
              <View style={styles.modalField}>
                <Text style={styles.modalFieldLabel}>Auftraggeber / Besteller</Text>
                <TextInput
                  style={styles.modalInput}
                  placeholder={t('reBest', currentLang)}
                  placeholderTextColor={COLORS.muted}
                  value={nachtragBesteller}
                  onChangeText={setNachtragBesteller}
                />
              </View>

              {/* Notiz / Begründung (3 Zeilen für ausreichend Platz) */}
              <View style={styles.modalField}>
                <Text style={styles.modalFieldLabel}>Kommentar / Begründung</Text>
                <TextInput
                  style={[styles.modalInput, styles.multilineInput]}
                  placeholder="Begründung für den Bauleiter (z. B. Planänderung, Sonderwunsch Bauherr)..."
                  placeholderTextColor={COLORS.muted}
                  multiline={true}
                  numberOfLines={3}
                  value={nachtragNote}
                  onChangeText={setNachtragNote}
                />
              </View>

              {/* Submit CTA */}
              <TouchableOpacity style={styles.modalSubmitBtn} onPress={handleCreateNachtrag} activeOpacity={0.8}>
                <Text style={styles.modalSubmitText}>{t('reCreate', currentLang)}</Text>
              </TouchableOpacity>
            </ScrollView>
          </KeyboardAvoidingView>
        </SafeAreaView>
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
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 14,
  },
  headerTitles: {
    flex: 1,
  },
  roomTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: COLORS.ink,
  },
  roomSubtitle: {
    fontSize: 12.5,
    color: COLORS.muted,
    marginTop: 2,
  },
  nachtragButton: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1.5,
    borderColor: COLORS.line,
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  nachtragBtnText: {
    fontSize: 12,
    fontWeight: '800',
    color: COLORS.amberDark,
  },
  searchSection: {
    marginBottom: 16,
  },
  searchLabel: {
    fontSize: 11.5,
    fontWeight: '700',
    textTransform: 'uppercase',
    color: COLORS.muted,
    letterSpacing: 0.5,
    marginBottom: 6,
  },
  searchInput: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1.5,
    borderColor: COLORS.line,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 11,
    fontSize: 14,
    color: COLORS.ink,
  },
  resultsList: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: COLORS.line,
    borderRadius: 12,
    marginTop: 6,
    overflow: 'hidden',
  },
  resultRow: {
    padding: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#EEF2F6',
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
    marginBottom: 8,
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
  bookRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: COLORS.line,
    padding: 12,
    gap: 10,
  },
  iconBox: {
    width: 42,
    height: 42,
    borderRadius: 10,
    backgroundColor: '#F1F4F7',
    justifyContent: 'center',
    alignItems: 'center',
  },
  iconBoxOver: {
    backgroundColor: COLORS.redBg,
  },
  iconSymbol: {
    fontSize: 20,
    color: COLORS.inkSoft,
    fontWeight: 'bold',
  },
  iconSymbolOver: {
    color: COLORS.red,
  },
  infoCol: {
    flex: 1,
  },
  posRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 2,
  },
  posChip: {
    backgroundColor: '#EAF4FB',
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 1,
  },
  posChipText: {
    fontSize: 10.5,
    fontWeight: '800',
    color: '#0082C9',
  },
  hintChip: {
    backgroundColor: '#E1F3F1',
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 1,
    flexShrink: 1,
  },
  hintChipText: {
    fontSize: 10,
    fontWeight: '600',
    color: '#12897E',
  },
  matName: {
    fontSize: 13.5,
    fontWeight: '700',
    color: COLORS.ink,
  },
  matGloss: {
    fontSize: 12,
    fontStyle: 'italic',
    color: COLORS.muted,
  },
  matGroup: {
    fontSize: 11,
    color: COLORS.muted,
    marginTop: 1,
  },
  poolRow: {
    flexDirection: 'row',
    gap: 10,
    flexWrap: 'wrap',
    marginTop: 4,
  },
  poolText: {
    fontSize: 11,
    color: COLORS.inkSoft,
  },
  poolBold: {
    fontWeight: '700',
    color: COLORS.ink,
  },
  poolTextOver: {
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
  // Fullscreen Nachtrag Modal Styles
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
  modalBody: {
    flex: 1,
    backgroundColor: '#FAFCFE',
  },
  modalScrollContent: {
    padding: 20,
    paddingBottom: 40,
  },
  typeModes: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 20,
  },
  typeMode: {
    flex: 1,
    borderWidth: 1.5,
    borderColor: COLORS.line,
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
  },
  typeModeActive: {
    borderColor: COLORS.amber,
    backgroundColor: COLORS.lite,
  },
  typeModeText: {
    fontSize: 14,
    fontWeight: '700',
    color: COLORS.inkSoft,
  },
  typeModeTextActive: {
    color: COLORS.amberDark,
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
    marginTop: 10,
  },
  modalSubmitText: {
    color: '#FFFFFF',
    fontWeight: '800',
    fontSize: 16,
  },
});
