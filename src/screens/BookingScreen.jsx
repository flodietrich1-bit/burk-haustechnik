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
} from 'react-native';
import { COLORS } from '../constants/theme';
import { t, GLOSSARY } from '../locales/i18n';
import ProgressBar from '../components/ProgressBar';

export default function BookingScreen({
  room,
  materials = [],
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

  // Unclear item modal/form
  const [showUnclearForm, setShowUnclearForm] = useState(false);
  const [unclearText, setUnclearText] = useState('');
  const [unclearQty, setUnclearQty] = useState('');

  // Nachtrag modal/form
  const [showNachtragModal, setShowNachtragModal] = useState(false);
  const [nachtragType, setNachtragType] = useState('material'); // 'material' | 'stunden'
  const [nachtragTitle, setNachtragTitle] = useState('');
  const [nachtragQty, setNachtragQty] = useState('');
  const [nachtragBesteller, setNachtragBesteller] = useState('');
  const [nachtragNote, setNachtragNote] = useState('');

  // Filter materials for search autocomplete
  const q = searchQuery.trim().toLowerCase();
  const searchResults = q
    ? materials.filter((m) =>
        (m.pos + ' ' + m.name + ' ' + m.cleanName + ' ' + m.group).toLowerCase().includes(q)
      ).slice(0, 6)
    : [];

  const handlePickMaterial = (id) => {
    if (!activeMaterialIds.includes(id)) {
      setActiveMaterialIds([id, ...activeMaterialIds]);
    }
    setSearchQuery('');
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
      Alert.alert('Hinweis', 'Bitte Bezeichnung eingeben.');
      return;
    }
    onAddNachtrag({
      roomId: room.id,
      roomName: room.name,
      type: nachtragType,
      title: nachtragTitle.trim(),
      quantity: nachtragQty.trim() || (nachtragType === 'stunden' ? '1 h' : '1 Stk'),
      requestedBy: nachtragBesteller.trim() || 'Bauleiter',
      note: nachtragNote.trim(),
    });
    setNachtragTitle('');
    setNachtragQty('');
    setNachtragBesteller('');
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
            onPress={() => setShowNachtragModal(true)}
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

      {/* Nachtrag Modal Dialog */}
      <Modal visible={showNachtragModal} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>{t('nachtragTitle', currentLang)}</Text>
            <Text style={styles.modalSub}>{room.name} · KW 27</Text>

            {/* Mode Switcher: Material vs Stundenlohn */}
            <View style={styles.typeModes}>
              <TouchableOpacity
                style={[styles.typeMode, nachtragType === 'material' && styles.typeModeActive]}
                onPress={() => setNachtragType('material')}
              >
                <Text style={[styles.typeModeText, nachtragType === 'material' && styles.typeModeTextActive]}>
                  {t('typeMat', currentLang)}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.typeMode, nachtragType === 'stunden' && styles.typeModeActive]}
                onPress={() => setNachtragType('stunden')}
              >
                <Text style={[styles.typeModeText, nachtragType === 'stunden' && styles.typeModeTextActive]}>
                  {t('typeStd', currentLang)}
                </Text>
              </TouchableOpacity>
            </View>

            <TextInput
              style={styles.modalInput}
              placeholder={nachtragType === 'stunden' ? t('fldTaetigkeit', currentLang) : t('reMat', currentLang)}
              placeholderTextColor={COLORS.muted}
              value={nachtragTitle}
              onChangeText={setNachtragTitle}
            />

            <TextInput
              style={styles.modalInput}
              placeholder={nachtragType === 'stunden' ? t('fldStunden', currentLang) : t('reQty', currentLang)}
              placeholderTextColor={COLORS.muted}
              value={nachtragQty}
              onChangeText={setNachtragQty}
            />

            <TextInput
              style={styles.modalInput}
              placeholder={t('reBest', currentLang)}
              placeholderTextColor={COLORS.muted}
              value={nachtragBesteller}
              onChangeText={setNachtragBesteller}
            />

            <TextInput
              style={styles.modalInput}
              placeholder={t('reNote', currentLang)}
              placeholderTextColor={COLORS.muted}
              value={nachtragNote}
              onChangeText={setNachtragNote}
            />

            <TouchableOpacity style={styles.modalSubmitBtn} onPress={handleCreateNachtrag}>
              <Text style={styles.modalSubmitText}>{t('reCreate', currentLang)}</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.modalCancelBtn}
              onPress={() => setShowNachtragModal(false)}
            >
              <Text style={styles.modalCancelText}>{t('cancel', currentLang)}</Text>
            </TouchableOpacity>
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
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    padding: 20,
  },
  modalCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    padding: 20,
  },
  modalTitle: {
    fontSize: 17,
    fontWeight: '800',
    color: COLORS.ink,
  },
  modalSub: {
    fontSize: 12,
    color: COLORS.muted,
    marginBottom: 14,
    marginTop: 2,
  },
  typeModes: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 12,
  },
  typeMode: {
    flex: 1,
    borderWidth: 1.5,
    borderColor: COLORS.line,
    borderRadius: 10,
    paddingVertical: 9,
    alignItems: 'center',
  },
  typeModeActive: {
    borderColor: COLORS.amber,
    backgroundColor: COLORS.lite,
  },
  typeModeText: {
    fontSize: 13,
    fontWeight: '700',
    color: COLORS.inkSoft,
  },
  typeModeTextActive: {
    color: COLORS.ink,
  },
  modalInput: {
    borderWidth: 1.5,
    borderColor: COLORS.line,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    marginBottom: 10,
    color: COLORS.ink,
  },
  modalSubmitBtn: {
    backgroundColor: COLORS.amber,
    borderRadius: 12,
    paddingVertical: 13,
    alignItems: 'center',
    marginTop: 4,
  },
  modalSubmitText: {
    color: '#FFFFFF',
    fontWeight: '800',
    fontSize: 15,
  },
  modalCancelBtn: {
    alignItems: 'center',
    paddingVertical: 10,
    marginTop: 4,
  },
  modalCancelText: {
    color: COLORS.muted,
    fontWeight: '600',
    fontSize: 13.5,
  },
});
