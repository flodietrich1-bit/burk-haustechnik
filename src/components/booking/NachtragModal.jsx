import React, { useState, useEffect } from 'react';
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
import { getRoomDisplayName } from './bookingHelpers';
import { styles } from './nachtragStyles';

export default function NachtragModal({
  visible,
  roomMaterialsList = [],
  room,
  monteur,
  currentLang = 'de',
  onClose,
  onSave,
}) {
  // Material Nachtrag
  const [matTitle, setMatTitle] = useState('');
  const [matQty, setMatQty] = useState('');
  const [matUnit, setMatUnit] = useState('Stk'); // 'Stk' | 'm'
  const [matBesteller, setMatBesteller] = useState('');
  const [matNote, setMatNote] = useState('');
  const [selectedRoomMat, setSelectedRoomMat] = useState(null);
  const [showRoomMatPicker, setShowRoomMatPicker] = useState(false);

  // Validation
  const [hasAttemptedSubmit, setHasAttemptedSubmit] = useState(false);

  useEffect(() => {
    if (visible) {
      if (!matBesteller) setMatBesteller(monteur?.name || '');
      setHasAttemptedSubmit(false);
      setShowRoomMatPicker(false);
    }
  }, [visible, monteur]);

  if (!visible || !room) return null;

  const handleSelectRoomMat = (item) => {
    setSelectedRoomMat(item);
    setMatTitle(item.name);
    const isMeter =
      item.qu === 'm' ||
      (item.name &&
        item.name.toLowerCase().includes('rohr') &&
        !item.name.toLowerCase().includes('schelle'));
    setMatUnit(isMeter ? 'm' : 'Stk');
    setShowRoomMatPicker(false);
  };

  // Begründung ist rein optional, um Monteure nicht zu blockieren
  const missingList = [
    !matTitle.trim() ? t('reMat', currentLang) : null,
    !matQty.trim() || !(parseFloat(matQty) > 0) ? t('reQty', currentLang) : null,
    !matBesteller.trim() ? t('reBest', currentLang) : null,
  ].filter(Boolean);

  const handleSubmit = () => {
    if (missingList.length > 0) {
      setHasAttemptedSubmit(true);
      return;
    }

    const cleanQty = matQty.trim() || '1';
    onSave({
      roomId: room.id,
      roomName: room.name,
      type: 'material',
      title: matTitle.trim(),
      quantity: `${cleanQty} ${matUnit}`,
      qu: matUnit,
      requestedBy: matBesteller.trim() || monteur?.name || 'Monteur',
      note: matNote.trim(),
      signature: null,
    });

    setMatTitle('');
    setMatQty('');
    setMatNote('');
    setSelectedRoomMat(null);
    setHasAttemptedSubmit(false);
    setShowRoomMatPicker(false);
  };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="fullScreen">
      <SafeAreaView style={styles.modalFullscreen}>
        {/* Fullscreen Modal Header with Close '✕' Button */}
        <View style={styles.modalHeader}>
          <View style={styles.modalTitleBox}>
            <Text style={styles.modalMainTitle}>
              📋 {t('btnNeedMaterial', currentLang) || '+ Material benötigt'}
            </Text>
            <Text style={styles.modalSubTitle}>
              {getRoomDisplayName(room, currentLang)} · {t('nachtragSub', currentLang)}
            </Text>
          </View>
          <TouchableOpacity
            style={styles.modalCloseBtn}
            onPress={onClose}
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
            <View>
              {/* Material aus Raum Dropdown */}
              <View style={styles.modalField}>
                <Text style={styles.modalFieldLabel}>
                  {t('dropdownRoomMaterials', currentLang)} <Text style={styles.requiredStar}>*</Text>
                </Text>
                <TouchableOpacity
                  style={[
                    styles.dropdownTrigger,
                    hasAttemptedSubmit && !matTitle.trim() && styles.inputInvalid,
                  ]}
                  onPress={() => setShowRoomMatPicker(!showRoomMatPicker)}
                  activeOpacity={0.7}
                >
                  <View style={{ flex: 1 }}>
                    {selectedRoomMat ? (
                      <View style={styles.dropdownSelectedRow}>
                        <Text style={styles.dropdownPosBadge}>Pos {selectedRoomMat.pos}</Text>
                        <Text style={styles.dropdownSelectedTitle} numberOfLines={1}>
                          {selectedRoomMat.name}
                        </Text>
                      </View>
                    ) : (
                      <Text style={styles.dropdownPlaceholder}>
                        {t('selectRoomMaterial', currentLang)}
                      </Text>
                    )}
                  </View>
                  <Text style={styles.dropdownArrow}>{showRoomMatPicker ? '▲' : '▼'}</Text>
                </TouchableOpacity>

                {/* Dropdown List Items */}
                {showRoomMatPicker && (
                  <View style={styles.dropdownListContainer}>
                    <Text style={styles.dropdownListHeader}>
                      {t('dropdownRoomMaterials', currentLang)} ({roomMaterialsList.length}):
                    </Text>
                    <ScrollView
                      nestedScrollEnabled
                      style={{ maxHeight: 220 }}
                      keyboardShouldPersistTaps="handled"
                    >
                      {roomMaterialsList.map((item) => {
                        const isSelected =
                          selectedRoomMat?.id === item.id || matTitle === item.name;
                        return (
                          <TouchableOpacity
                            key={item.id}
                            style={[
                              styles.dropdownItem,
                              isSelected && styles.dropdownItemActive,
                            ]}
                            onPress={() => handleSelectRoomMat(item)}
                            activeOpacity={0.7}
                          >
                            <View style={{ flex: 1 }}>
                              <View style={styles.sugTopRow}>
                                <View style={styles.sugPosChip}>
                                  <Text style={styles.sugPosText}>Pos {item.pos}</Text>
                                </View>
                                <Text style={styles.sugUnitBadge}>
                                  {item.qu === 'm'
                                    ? t('unitMeters', currentLang)
                                    : t('unitPieces', currentLang)}
                                </Text>
                              </View>
                              <Text style={styles.dropdownItemText}>{item.name}</Text>
                            </View>
                            {isSelected && <Text style={styles.dropdownCheckmark}>✓</Text>}
                          </TouchableOpacity>
                        );
                      })}
                    </ScrollView>
                  </View>
                )}
              </View>

              {/* Benötigte Menge & Einheit */}
              <View style={styles.modalField}>
                <Text style={styles.modalFieldLabel}>
                  {matUnit === 'm'
                    ? t('unclearQtyMeterPlaceholder', currentLang)
                    : t('reQty', currentLang)}{' '}
                  <Text style={styles.requiredStar}>*</Text>
                </Text>
                <View style={styles.qtyWithUnitRow}>
                  <TextInput
                    style={[
                      styles.modalInput,
                      { flex: 1 },
                      hasAttemptedSubmit &&
                        (!matQty.trim() || !(parseFloat(matQty) > 0)) &&
                        styles.inputInvalid,
                    ]}
                    placeholder={matUnit === 'm' ? 'z. B. 12.5' : 'z. B. 4'}
                    placeholderTextColor={COLORS.muted}
                    keyboardType="decimal-pad"
                    value={matQty}
                    onChangeText={setMatQty}
                  />
                  <View style={styles.qtyUnitBadgeBox}>
                    <Text style={styles.qtyUnitBadgeText}>
                      {matUnit === 'm'
                        ? t('unitMeters', currentLang)
                        : t('unitPieces', currentLang)}
                    </Text>
                  </View>
                </View>
              </View>

              {/* Begründung (Optional - kein Zwang) */}
              <View style={styles.modalField}>
                <Text style={styles.modalFieldLabel}>
                  {t('unplannedReason', currentLang) || 'Begründung / Notiz'}
                </Text>
                <View style={styles.quickPillsRow}>
                  {[
                    { key: 'pillOverConsumption', text: t('pillOverConsumption', currentLang) },
                    { key: 'pillDamage', text: t('pillDamage', currentLang) },
                    { key: 'pillPlanChange', text: t('pillPlanChange', currentLang) },
                    { key: 'pillScrap', text: t('pillScrap', currentLang) },
                    { key: 'pillMissingQty', text: t('pillMissingQty', currentLang) },
                  ].map((item) => (
                    <TouchableOpacity
                      key={item.key}
                      style={[styles.pill, matNote === item.text && styles.pillActive]}
                      onPress={() => setMatNote(item.text)}
                    >
                      <Text style={[styles.pillText, matNote === item.text && styles.pillTextActive]}>
                        {item.text}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
                <TextInput
                  style={[
                    styles.modalInput,
                    styles.multilineInput,
                  ]}
                  placeholder={
                    t('overCommentPlaceholder', currentLang) ||
                    'Grund für den Mehrbedarf angeben (optional)...'
                  }
                  placeholderTextColor={COLORS.muted}
                  multiline={true}
                  numberOfLines={3}
                  value={matNote}
                  onChangeText={setMatNote}
                />
              </View>

              {/* Besteller / Auftraggeber */}
              <View style={styles.modalField}>
                <Text style={styles.modalFieldLabel}>
                  {t('reBest', currentLang)} <Text style={styles.requiredStar}>*</Text>
                </Text>
                <TextInput
                  style={[
                    styles.modalInput,
                    hasAttemptedSubmit && !matBesteller.trim() && styles.inputInvalid,
                  ]}
                  placeholder={t('reBest', currentLang)}
                  placeholderTextColor={COLORS.muted}
                  value={matBesteller}
                  onChangeText={setMatBesteller}
                />
              </View>
            </View>
          </ScrollView>

          {/* Sticky Bottom Footer */}
          <View style={styles.modalStickyFooter}>
            {hasAttemptedSubmit && missingList.length > 0 && (
              <View style={styles.missingHintBar}>
                <Text style={styles.missingHintIcon}>⚠️</Text>
                <View style={{ flex: 1 }}>
                  <Text style={styles.missingHintTitle}>
                    {t('validationFillRequired', currentLang)}
                  </Text>
                  <Text style={styles.missingHintList}>
                    {missingList.join(' · ')}
                  </Text>
                </View>
              </View>
            )}

            <TouchableOpacity
              style={styles.modalSubmitBtn}
              onPress={handleSubmit}
              activeOpacity={0.8}
            >
              <Text style={styles.modalSubmitText}>
                {t('reCreate', currentLang)}
              </Text>
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </Modal>
  );
}
