import React from 'react';
import { View, Text, TouchableOpacity, ScrollView, Modal } from 'react-native';
import { t, formatUnit } from '../../locales/i18n';
import { styles } from './completeRoomStyles';

export default function CompleteRoomModal({
  visible,
  room,
  currentLang = 'de',
  deltaSummary = [],
  onClose,
  onConfirm,
}) {
  if (!room) return null;

  return (
    <Modal visible={visible} transparent animationType="slide">
      <View style={styles.modalBackdrop}>
        <View style={styles.completeModalCard}>
          <View style={styles.completeModalHeader}>
            <Text style={styles.completeModalTitle}>
              ✓ {t('completeModalTitle', currentLang)}
            </Text>
            <TouchableOpacity
              onPress={onClose}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <Text style={styles.closeBtnText}>✕</Text>
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
            {deltaSummary.map((item) => {
              const displayQu = formatUnit(item.qu, currentLang);
              const isUnplanned = Boolean(item.isUnplanned || item.status === 'unplanned');
              const hasRoomPlan = !isUnplanned && item.plannedQty !== null && item.plannedQty !== undefined;
              const isUnder = !isUnplanned && (item.status === 'under' || (hasRoomPlan && item.diff > 0));
              const isOver = !isUnplanned && (item.status === 'over' || (hasRoomPlan && item.diff < 0));

              return (
                <View key={item.materialId} style={styles.deltaRow}>
                  <View style={{ flex: 1, paddingRight: 8 }}>
                    <Text style={styles.deltaMatName} numberOfLines={1}>
                      Pos {item.pos} · {item.name}
                    </Text>
                    <Text style={styles.deltaMatSub}>
                      {isUnplanned
                        ? `${t('matrixPlanned', currentLang)}: 0 ${displayQu}  |  ${t(
                            'matrixInstalled',
                            currentLang
                          )}: ${item.installedQty} ${displayQu} (${t('unplannedBadge', currentLang)})`
                        : hasRoomPlan
                        ? `${t('matrixPlanned', currentLang)}: ${item.plannedQty} ${displayQu}  |  ${t(
                            'matrixInstalled',
                            currentLang
                          )}: ${item.installedQty} ${displayQu}`
                        : `${t('matrixInstalled', currentLang)}: ${item.installedQty} ${displayQu} (${t(
                            'matrixOnlyGaeb',
                            currentLang
                          )})`}
                    </Text>
                  </View>

                  {isUnplanned ? (
                    <View style={styles.deltaBadgeOver}>
                      <Text style={styles.deltaBadgeOverText}>
                        +{item.installedQty} {displayQu} {t('unplannedBadge', currentLang)}
                      </Text>
                    </View>
                  ) : hasRoomPlan ? (
                    isUnder ? (
                      <View style={styles.deltaBadgeUnder}>
                        <Text style={styles.deltaBadgeUnderText}>
                          +{item.diff.toFixed(1)} {displayQu} {t('completeUnder', currentLang)}
                        </Text>
                      </View>
                    ) : isOver ? (
                      <View style={styles.deltaBadgeOver}>
                        <Text style={styles.deltaBadgeOverText}>
                          -{Math.abs(item.diff).toFixed(1)} {displayQu} {t('completeOver', currentLang)}
                        </Text>
                      </View>
                    ) : (
                      <View style={styles.deltaBadgeExact}>
                        <Text style={styles.deltaBadgeExactText}>
                          {t('completeExact', currentLang)}
                        </Text>
                      </View>
                    )
                  ) : (
                    <View style={styles.deltaBadgeExact}>
                      <Text style={styles.deltaBadgeExactText}>
                        {item.installedQty} {displayQu}
                      </Text>
                    </View>
                  )}
                </View>
              );
            })}
          </ScrollView>

          <View style={styles.completeActionRow}>
            <TouchableOpacity
              style={styles.overCancelBtn}
              onPress={onClose}
              activeOpacity={0.7}
            >
              <Text style={styles.overCancelText}>{t('cancel', currentLang)}</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.completeConfirmBtn}
              onPress={onConfirm}
              activeOpacity={0.8}
            >
              <Text style={styles.completeConfirmText}>
                {t('completeRoomConfirm', currentLang)}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}
