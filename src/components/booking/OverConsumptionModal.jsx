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
import { getMaterialDisplayName, getRoomPlannedItem } from './bookingHelpers';
import { styles } from './overConsumptionStyles';

export default function OverConsumptionModal({
  visible,
  pendingOverMat,
  room,
  currentLang = 'de',
  initialReason = '',
  initialExtraQty = '',
  onClose,
  onConfirm,
}) {
  const [overReason, setOverReason] = useState('');
  const [overExtraQty, setOverExtraQty] = useState('1');

  useEffect(() => {
    if (visible && pendingOverMat) {
      if (initialExtraQty) {
        setOverExtraQty(String(initialExtraQty));
      } else {
        const initExtra = pendingOverMat.exceededBy || 1;
        setOverExtraQty(String(initExtra % 1 === 0 ? initExtra : Number(initExtra).toFixed(1)));
      }
      setOverReason(initialReason || '');
    }
  }, [visible, pendingOverMat, initialReason, initialExtraQty]);

  if (!visible || !pendingOverMat) return null;

  const handleStepOverExtra = (delta) => {
    const current = parseFloat(overExtraQty) || 1;
    let next = Math.max(0.5, current + delta);
    setOverExtraQty(String(next % 1 === 0 ? next : Number(next.toFixed(1))));
  };

  const hasOverReason = Boolean(overReason && overReason.trim().length > 0);
  const maxPossibleExtra =
    pendingOverMat.maxPossibleExtra !== undefined ? pendingOverMat.maxPossibleExtra : 9999;
  const isOverDelivery =
    pendingOverMat.maxPossibleExtra !== undefined &&
    (parseFloat(overExtraQty) || 0) > maxPossibleExtra;
  const extraNum = parseFloat(overExtraQty) || 0;
  const plannedNum = pendingOverMat.planned || 0;
  const totalNewVerbaut = (plannedNum + extraNum).toFixed(1).replace(/\.0$/, '');

  const roomPlan = getRoomPlannedItem(pendingOverMat.mat?.id, room);
  const displayName = getMaterialDisplayName(pendingOverMat.mat, roomPlan);

  const handleConfirmPress = () => {
    if (!hasOverReason) return;
    const finalExtra = Math.max(0.1, parseFloat(overExtraQty) || 1);
    onConfirm(overReason.trim(), finalExtra);
  };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="fullScreen">
      <SafeAreaView style={styles.modalFullscreen}>
        {/* Header with Title and Close '✕' Button */}
        <View style={styles.modalHeader}>
          <View style={styles.modalTitleBox}>
            <Text style={styles.modalMainTitle}>⚠️ {t('overTitle', currentLang)}</Text>
            <Text style={styles.modalSubTitle}>
              {room?.name} ({room?.code}) · Pos {pendingOverMat.mat?.pos}
            </Text>
          </View>
          <TouchableOpacity
            style={styles.modalCloseBtn}
            onPress={onClose}
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

              <Text style={styles.overNoticeMatName}>{displayName}</Text>

              <View style={styles.overNoticeMetaRow}>
                <View style={styles.posChip}>
                  <Text style={styles.posChipText}>Pos {pendingOverMat.mat?.pos}</Text>
                </View>
                <Text style={styles.overNoticeMetaText}>
                  {t('matrixPlanned', currentLang)}:{' '}
                  <Text style={{ fontWeight: '800', color: COLORS.ink }}>
                    {pendingOverMat.planned} {pendingOverMat.qu}
                  </Text>
                  {' · '}
                  {t('overNewInstalled', currentLang)}:{' '}
                  <Text style={{ fontWeight: '800', color: COLORS.red }}>
                    {totalNewVerbaut} {pendingOverMat.qu}
                  </Text>
                </Text>
              </View>
            </View>

            {/* 2. Stepper & Schnellauswahl */}
            <View style={styles.modalField}>
              <Text style={styles.modalFieldLabel}>
                {t('overExtraQtyLabel', currentLang)} ({pendingOverMat.qu}):
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
                  <Text
                    style={[
                      styles.overPlusSign,
                      isOverDelivery && { color: COLORS.red },
                    ]}
                  >
                    +
                  </Text>
                  <TextInput
                    style={[
                      styles.overQtyInput,
                      isOverDelivery && { color: COLORS.red },
                    ]}
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
                  <Text
                    style={[
                      styles.overUnitSuffix,
                      isOverDelivery && { color: COLORS.red },
                    ]}
                  >
                    {pendingOverMat.qu}
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

              {isOverDelivery ? (
                <View style={styles.overDeliveryWarnBox}>
                  <Text style={styles.overDeliveryWarnText}>
                    ⚠️{' '}
                    {t('overDeliveryExceededWarn', currentLang, {
                      delivered: pendingOverMat.delivered || 0,
                      qu: pendingOverMat.qu || 'Stk',
                    })}
                  </Text>
                </View>
              ) : null}

              {/* Quick Pills */}
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
                        +{val} {pendingOverMat.qu}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>

            {/* 3. Begründung */}
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

          {/* 4. Sticky Footer */}
          <View style={styles.stickyModalFooter}>
            <TouchableOpacity
              style={styles.overCancelBtnLarge}
              onPress={onClose}
              activeOpacity={0.7}
            >
              <Text style={styles.overCancelTextLarge}>{t('cancel', currentLang)}</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.overConfirmBtnLarge,
                !hasOverReason && styles.overConfirmBtnDisabled,
              ]}
              onPress={handleConfirmPress}
              disabled={!hasOverReason}
              activeOpacity={0.8}
            >
              <Text
                style={[
                  styles.overConfirmTextLarge,
                  !hasOverReason && styles.overConfirmTextDisabled,
                ]}
              >
                ✓ {t('overConfirmBtn', currentLang)} (+
                {(parseFloat(overExtraQty) || 0).toFixed(1).replace(/\.0$/, '')}{' '}
                {pendingOverMat.qu})
              </Text>
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </Modal>
  );
}
