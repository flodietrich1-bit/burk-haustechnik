import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  Modal,
  SafeAreaView,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { COLORS } from '../../constants/theme';
import { t } from '../../locales/i18n';
import SignaturePad from '../SignaturePad';
import { getMaterialDisplayName } from './bookingHelpers';
import { styles } from './unplannedStyles';

export default function UnplannedInstallModal({
  visible,
  materials = [],
  room,
  monteur,
  currentLang = 'de',
  onClose,
  onSave,
}) {
  const [unclearText, setUnclearText] = useState('');
  const [unclearQty, setUnclearQty] = useState('');
  const [unclearUnit, setUnclearUnit] = useState('Stk'); // 'Stk' | 'm'
  const [selectedUnclearMat, setSelectedUnclearMat] = useState(null);
  const [showUnclearSuggestions, setShowUnclearSuggestions] = useState(false);
  const [unclearReason, setUnclearReason] = useState('');
  const [unclearSignature, setUnclearSignature] = useState(null);
  const [unclearScrollEnabled, setUnclearScrollEnabled] = useState(true);
  const [hasAttemptedUnclearSubmit, setHasAttemptedUnclearSubmit] = useState(false);

  if (!visible || !room) return null;

  const uq = unclearText.trim().toLowerCase();
  const unclearSuggestions = showUnclearSuggestions
    ? (uq.length >= 1
        ? materials
            .filter((m) =>
              (m.pos + ' ' + (m.shortText || '') + ' ' + m.name + ' ' + m.cleanName + ' ' + (m.group || ''))
                .toLowerCase()
                .includes(uq)
            )
            .slice(0, 10)
        : materials.slice(0, 10))
    : [];

  const handleSelectUnclearSuggestion = (item) => {
    const dispName = getMaterialDisplayName(item);
    setUnclearText(dispName);
    setSelectedUnclearMat(item);
    const isMeter =
      item.qu === 'm' ||
      (dispName && dispName.toLowerCase().includes('rohr') && !dispName.toLowerCase().includes('schelle'));
    setUnclearUnit(isMeter ? 'm' : 'Stk');
    setShowUnclearSuggestions(false);
  };

  const handleClose = () => {
    setShowUnclearSuggestions(false);
    setHasAttemptedUnclearSubmit(false);
    onClose();
  };

  const handleSave = () => {
    const qtyVal = parseFloat(unclearQty) || 0;
    const isMissing = !unclearText.trim() || qtyVal <= 0 || !unclearReason.trim() || !unclearSignature;
    if (isMissing) {
      setHasAttemptedUnclearSubmit(true);
      return;
    }

    const matId = selectedUnclearMat ? selectedUnclearMat.id : `extra_${Date.now()}`;
    const cleanQty = String(qtyVal);

    onSave({
      txt: unclearText.trim(),
      qty: cleanQty,
      qu: unclearUnit,
      itemOz: selectedUnclearMat ? selectedUnclearMat.pos : 'ZUSATZ',
      pos: selectedUnclearMat ? selectedUnclearMat.pos : 'ZUSATZ',
      materialId: matId,
      group: selectedUnclearMat?.group || 'Zusatz / Außerplanmäßig',
      isOrdered: !!selectedUnclearMat,
      reason: unclearReason.trim(),
      signature: unclearSignature,
      requestedBy: monteur?.name || 'Monteur',
      roomId: room.id,
      roomName: room.name,
    });

    setUnclearText('');
    setUnclearQty('');
    setUnclearReason('');
    setUnclearSignature(null);
    setSelectedUnclearMat(null);
    setShowUnclearSuggestions(false);
    setHasAttemptedUnclearSubmit(false);
  };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="fullScreen">
      <SafeAreaView style={styles.modalFullscreen}>
        {/* Header with Title and Close '✕' Button */}
        <View style={styles.modalHeader}>
          <View style={styles.modalTitleBox}>
            <Text style={styles.modalMainTitle}>📋 {t('unclearTitle', currentLang)}</Text>
            <Text style={styles.modalSubTitle}>
              {room.name} · {t('unplannedBadge', currentLang)}
            </Text>
          </View>
          <TouchableOpacity
            style={styles.modalCloseBtn}
            onPress={handleClose}
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
            scrollEnabled={unclearScrollEnabled}
          >
            {/* Info banner */}
            <View style={styles.unclearInfoCard}>
              <Text style={styles.unclearInfoIcon}>ℹ️</Text>
              <Text style={styles.unclearInfoText}>{t('unclearSubInfo', currentLang)}</Text>
            </View>

            {/* Product field + Autosuggest from GAEB / ordered */}
            <View style={styles.modalField}>
              <Text style={styles.modalFieldLabel}>
                {t('unclearWhatLabel', currentLang)} <Text style={styles.requiredStar}>*</Text>
              </Text>
              <TextInput
                style={[
                  styles.modalInput,
                  hasAttemptedUnclearSubmit && !unclearText.trim() && styles.inputInvalid,
                ]}
                placeholder={t('unclearWhatPlaceholder', currentLang)}
                placeholderTextColor={COLORS.muted}
                value={unclearText}
                onChangeText={(text) => {
                  setUnclearText(text);
                  setSelectedUnclearMat(null);
                  setShowUnclearSuggestions(true);
                }}
                onFocus={() => {
                  setShowUnclearSuggestions(true);
                }}
              />

              {unclearSuggestions.length > 0 && (
                <View style={styles.unclearSuggestionsBox}>
                  <Text style={styles.unclearSugHeader}>
                    {t('unclearOrderedSuggestions', currentLang)} ({unclearSuggestions.length})
                  </Text>
                  <ScrollView
                    nestedScrollEnabled
                    style={{ maxHeight: 220 }}
                    keyboardShouldPersistTaps="handled"
                  >
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
                            {item.deliveredQty
                              ? ` · ${t('matrixDelivered', currentLang)}: ${item.deliveredQty} ${item.qu}`
                              : ` · ${item.qu}`}
                          </Text>
                        </View>
                        <View style={styles.unclearSugBadge}>
                          <Text style={styles.unclearSugBadgeText}>
                            {t('unclearOrderedBadge', currentLang)}
                          </Text>
                        </View>
                      </TouchableOpacity>
                    ))}
                  </ScrollView>
                </View>
              )}
            </View>

            {/* Unit Selector & Quantity */}
            <View style={styles.modalField}>
              <Text style={styles.modalFieldLabel}>
                {t('unclearSelectUnit', currentLang)} <Text style={styles.requiredStar}>*</Text>
              </Text>
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
                style={[
                  styles.modalInput,
                  hasAttemptedUnclearSubmit &&
                    (!unclearQty.trim() || !(parseFloat(unclearQty) > 0)) &&
                    styles.inputInvalid,
                ]}
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

            {/* Begründung für Einbau */}
            <View style={styles.modalField}>
              <Text style={styles.modalFieldLabel}>
                {t('unplannedReason', currentLang)} <Text style={styles.requiredStar}>*</Text>
              </Text>
              <View style={styles.quickPillsRow}>
                {['Planabweichung', 'Zusatzmontage', 'Kollision Lüftung', 'Bauherrenwunsch'].map((r) => (
                  <TouchableOpacity
                    key={r}
                    style={[styles.pill, unclearReason === r && styles.pillActive]}
                    onPress={() => setUnclearReason(r)}
                  >
                    <Text style={[styles.pillText, unclearReason === r && styles.pillTextActive]}>
                      {r}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
              <TextInput
                style={[
                  styles.modalInput,
                  styles.multilineInput,
                  hasAttemptedUnclearSubmit && !unclearReason.trim() && styles.inputInvalid,
                ]}
                placeholder={t('unplannedReasonPlaceholder', currentLang)}
                placeholderTextColor={COLORS.muted}
                multiline={true}
                numberOfLines={3}
                value={unclearReason}
                onChangeText={setUnclearReason}
              />
            </View>

            {/* Unterschrift */}
            <SignaturePad
              key="sig-unclear"
              isInvalid={hasAttemptedUnclearSubmit && !unclearSignature}
              currentLang={currentLang}
              onSignatureChange={(hasSig, paths) => setUnclearSignature(hasSig ? paths : null)}
              onDrawStart={() => setUnclearScrollEnabled(false)}
              onDrawEnd={() => setUnclearScrollEnabled(true)}
            />
          </ScrollView>

          {/* Single Sticky Bottom Button: Material erfassen */}
          <View style={styles.modalStickyFooter}>
            {hasAttemptedUnclearSubmit &&
              (!unclearText.trim() ||
                !(parseFloat(unclearQty) > 0) ||
                !unclearReason.trim() ||
                !unclearSignature) && (
                <View style={styles.missingHintBar}>
                  <Text style={styles.missingHintIcon}>⚠️</Text>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.missingHintTitle}>
                      {t('validationFillRequired', currentLang)}
                    </Text>
                    <Text style={styles.missingHintList}>
                      {[
                        !unclearText.trim() ? t('reMat', currentLang) : null,
                        !(parseFloat(unclearQty) > 0) ? t('reQty', currentLang) : null,
                        !unclearReason.trim() ? t('unplannedReason', currentLang) : null,
                        !unclearSignature ? t('signatureLabel', currentLang) : null,
                      ]
                        .filter(Boolean)
                        .join(' · ')}
                    </Text>
                  </View>
                </View>
              )}

            <TouchableOpacity
              style={styles.modalSubmitBtn}
              onPress={handleSave}
              activeOpacity={0.8}
            >
              <Text style={styles.modalSubmitText}>
                {t('unplannedRecordBtn', currentLang)}
              </Text>
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </Modal>
  );
}
