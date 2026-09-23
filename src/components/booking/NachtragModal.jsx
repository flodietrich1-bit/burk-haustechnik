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
import SignaturePad from '../SignaturePad';
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
  const [activeTab, setActiveTab] = useState('material'); // 'material' | 'hours'

  // Form 1: Material Nachtrag
  const [matTitle, setMatTitle] = useState('');
  const [matQty, setMatQty] = useState('');
  const [matUnit, setMatUnit] = useState('Stk'); // 'Stk' | 'm'
  const [matBesteller, setMatBesteller] = useState('');
  const [matNote, setMatNote] = useState('');
  const [selectedRoomMat, setSelectedRoomMat] = useState(null);
  const [showRoomMatPicker, setShowRoomMatPicker] = useState(false);

  // Form 2: Arbeitszeit Nachtrag
  const [hoursActivity, setHoursActivity] = useState('');
  const [hoursDuration, setHoursDuration] = useState('');
  const [hoursMonteur, setHoursMonteur] = useState('');
  const [hoursNote, setHoursNote] = useState('');

  // Form 3: Unterschrift & Validation
  const [nachtragSignature, setNachtragSignature] = useState(null);
  const [modalScrollEnabled, setModalScrollEnabled] = useState(true);
  const [hasAttemptedSubmit, setHasAttemptedSubmit] = useState(false);

  useEffect(() => {
    if (visible) {
      if (!matBesteller) setMatBesteller(monteur?.name || '');
      if (!hoursMonteur) setHoursMonteur(monteur?.name || '');
      setNachtragSignature(null);
      setModalScrollEnabled(true);
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

  const missingList =
    activeTab === 'material'
      ? [
          !matTitle.trim() ? t('reMat', currentLang) : null,
          !matQty.trim() || !(parseFloat(matQty) > 0) ? t('reQty', currentLang) : null,
          !matNote.trim() ? t('reNote', currentLang) : null,
          !matBesteller.trim() ? t('reBest', currentLang) : null,
          !nachtragSignature ? t('signatureLabel', currentLang) : null,
        ].filter(Boolean)
      : [
          !hoursActivity.trim() ? t('fldTaetigkeit', currentLang) : null,
          !hoursDuration.trim() || !(parseFloat(hoursDuration) > 0)
            ? t('fldStunden', currentLang)
            : null,
          !hoursNote.trim() ? t('reNote', currentLang) : null,
          !hoursMonteur.trim() ? t('monteur', currentLang) : null,
          !nachtragSignature ? t('signatureLabel', currentLang) : null,
        ].filter(Boolean);

  const handleSubmit = () => {
    if (missingList.length > 0) {
      setHasAttemptedSubmit(true);
      return;
    }

    if (activeTab === 'material') {
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
        signature: nachtragSignature,
      });

      setMatTitle('');
      setMatQty('');
      setMatNote('');
      setSelectedRoomMat(null);
      setNachtragSignature(null);
      setHasAttemptedSubmit(false);
      setShowRoomMatPicker(false);
    } else {
      const cleanHours = hoursDuration.trim() || '1';
      onSave({
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

      setHoursActivity('');
      setHoursDuration('');
      setHoursNote('');
      setNachtragSignature(null);
      setHasAttemptedSubmit(false);
    }
  };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="fullScreen">
      <SafeAreaView style={styles.modalFullscreen}>
        {/* Fullscreen Modal Header with Close '✕' Button */}
        <View style={styles.modalHeader}>
          <View style={styles.modalTitleBox}>
            <Text style={styles.modalMainTitle}>
              📋 {t('btnNeedMaterialTime', currentLang) || '+ Material/Zeit benötigt'}
            </Text>
            <Text style={styles.modalSubTitle}>
              {room.name} · {t('nachtragSub', currentLang)}
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

        {/* Segmented Control Tabs */}
        <View style={styles.tabBarContainer}>
          <TouchableOpacity
            style={[styles.segmentTab, activeTab === 'material' && styles.segmentTabActive]}
            onPress={() => setActiveTab('material')}
            activeOpacity={0.7}
          >
            <Text
              style={[
                styles.segmentText,
                activeTab === 'material' && styles.segmentTextActive,
              ]}
            >
              📦 {t('typeMat', currentLang)}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.segmentTab, activeTab === 'hours' && styles.segmentTabActive]}
            onPress={() => setActiveTab('hours')}
            activeOpacity={0.7}
          >
            <Text
              style={[
                styles.segmentText,
                activeTab === 'hours' && styles.segmentTextActive,
              ]}
            >
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
            {/* TAB 1: MATERIAL NACHTRAG */}
            {activeTab === 'material' && (
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
                        {matUnit === 'm' ? 'Meter (m)' : 'Stück (Stk)'}
                      </Text>
                    </View>
                  </View>
                </View>

                {/* Begründung (Pflichtfeld) */}
                <View style={styles.modalField}>
                  <Text style={styles.modalFieldLabel}>
                    {t('unplannedReason', currentLang) || 'Begründung'}{' '}
                    <Text style={styles.requiredStar}>*</Text>
                  </Text>
                  <View style={styles.quickPillsRow}>
                    {['Mehrverbrauch', 'Bruch / Beschädigung', 'Planänderung', 'Verschnitt', 'Fehlmenge'].map(
                      (r) => (
                        <TouchableOpacity
                          key={r}
                          style={[styles.pill, matNote === r && styles.pillActive]}
                          onPress={() => setMatNote(r)}
                        >
                          <Text style={[styles.pillText, matNote === r && styles.pillTextActive]}>
                            {r}
                          </Text>
                        </TouchableOpacity>
                      )
                    )}
                  </View>
                  <TextInput
                    style={[
                      styles.modalInput,
                      styles.multilineInput,
                      hasAttemptedSubmit && !matNote.trim() && styles.inputInvalid,
                    ]}
                    placeholder={
                      t('overCommentPlaceholder', currentLang) ||
                      'Grund für den Mehrbedarf angeben...'
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
            )}

            {/* TAB 2: ARBEITSZEIT NACHTRAG */}
            {activeTab === 'hours' && (
              <View>
                {/* Ausgeführte Tätigkeit */}
                <View style={styles.modalField}>
                  <Text style={styles.modalFieldLabel}>
                    {t('fldTaetigkeit', currentLang)} <Text style={styles.requiredStar}>*</Text>
                  </Text>
                  <TextInput
                    style={[
                      styles.modalInput,
                      hasAttemptedSubmit && !hoursActivity.trim() && styles.inputInvalid,
                    ]}
                    placeholder="z. B. Kernbohrung DN 150 + Mauerdurchbruch..."
                    placeholderTextColor={COLORS.muted}
                    value={hoursActivity}
                    onChangeText={setHoursActivity}
                  />
                </View>

                {/* Stunden & Schnellwahl */}
                <View style={styles.modalField}>
                  <Text style={styles.modalFieldLabel}>
                    {t('fldStunden', currentLang)} <Text style={styles.requiredStar}>*</Text>
                  </Text>
                  <TextInput
                    style={[
                      styles.modalInput,
                      hasAttemptedSubmit &&
                        (!hoursDuration.trim() || !(parseFloat(hoursDuration) > 0)) &&
                        styles.inputInvalid,
                    ]}
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
                        <Text
                          style={[
                            styles.pillText,
                            hoursDuration === h && styles.pillTextActive,
                          ]}
                        >
                          +{h} h
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>

                {/* Monteur / Ausführender */}
                <View style={styles.modalField}>
                  <Text style={styles.modalFieldLabel}>
                    {t('monteur', currentLang)} / {t('reBest', currentLang)}{' '}
                    <Text style={styles.requiredStar}>*</Text>
                  </Text>
                  <TextInput
                    style={[
                      styles.modalInput,
                      hasAttemptedSubmit && !hoursMonteur.trim() && styles.inputInvalid,
                    ]}
                    placeholder={t('monteur', currentLang)}
                    placeholderTextColor={COLORS.muted}
                    value={hoursMonteur}
                    onChangeText={setHoursMonteur}
                  />
                </View>

                {/* Begründung / Notiz */}
                <View style={styles.modalField}>
                  <Text style={styles.modalFieldLabel}>
                    {t('reNote', currentLang)} <Text style={styles.requiredStar}>*</Text>
                  </Text>
                  <TextInput
                    style={[
                      styles.modalInput,
                      styles.multilineInput,
                      hasAttemptedSubmit && !hoursNote.trim() && styles.inputInvalid,
                    ]}
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

            {/* UNTERSCHRIFTENFELD */}
            <SignaturePad
              key={`sig-${activeTab}`}
              isInvalid={hasAttemptedSubmit && !nachtragSignature}
              currentLang={currentLang}
              onSignatureChange={(hasSig, paths) => setNachtragSignature(hasSig ? paths : null)}
              onDrawStart={() => setModalScrollEnabled(false)}
              onDrawEnd={() => setModalScrollEnabled(true)}
            />
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
                {activeTab === 'material'
                  ? t('reCreate', currentLang)
                  : t('reCreateHours', currentLang)}
              </Text>
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </Modal>
  );
}
