import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { t } from '../../locales/i18n';
import ProgressBar from '../ProgressBar';
import {
  formatQty,
  getMaterialDisplayName,
  getForeignGloss,
  getMatIconSymbol,
} from './bookingHelpers';
import { styles } from './materialCardStyles';

export default function MaterialBookingCard({
  mat,
  roomPlan = null,
  delta = 0,
  room,
  currentLang = 'de',
  userReason = '',
  isLocked = false,
  onStep,
  onReasonBadgePress,
  onLockedAction,
}) {
  if (!mat) return null;

  const isUnplanned = Boolean(mat.isUnplanned || roomPlan?.isUnplanned);
  const displayName = getMaterialDisplayName(mat, roomPlan);
  const displayGroup =
    mat?.group && mat.group !== 'Allgemein'
      ? mat.group
      : roomPlan?.group || mat?.group || 'Allgemein';
  const displayQu = mat?.qu || roomPlan?.qu || 'Stk';

  const hasRoomPlan = Boolean(roomPlan);
  const roomPlanned = hasRoomPlan ? Number(roomPlan.plannedQty || 0) : null;
  const roomInstalledBefore = hasRoomPlan
    ? Number(roomPlan.installedQty || 0)
    : Number(mat.installedQty || 0);

  const currentRoomVerb = roomInstalledBefore + delta;
  const projectDelivered = Number(
    mat.deliveredQty !== undefined && mat.deliveredQty !== null && Number(mat.deliveredQty) > 0
      ? mat.deliveredQty
      : mat.qty || (roomPlan && roomPlan.plannedQty) || 0
  );

  // Target for planning: For unplanned items, the available pool is the project delivered amount!
  const baseTarget = isUnplanned
    ? projectDelivered > 0
      ? projectDelivered
      : currentRoomVerb
    : hasRoomPlan
    ? roomPlanned
    : projectDelivered;

  // Verfügbar: For unplanned items, it reflects remaining project stock
  const availableQty = Math.max(0, baseTarget - currentRoomVerb);

  // isOver: For unplanned items, ONLY over if currentRoomVerb exceeds total projectDelivered!
  const isOver = isUnplanned
    ? projectDelivered > 0
      ? currentRoomVerb > projectDelivered
      : false
    : currentRoomVerb > baseTarget;

  const exceededBy = isOver
    ? Math.max(0, currentRoomVerb - (isUnplanned ? projectDelivered : baseTarget))
    : 0;

  // Progress percentage: unplanned items are completed (100%), not 0% or red over-limit
  const progressPct = isUnplanned
    ? 100
    : baseTarget > 0
    ? Math.min(100, Math.round((currentRoomVerb / baseTarget) * 100))
    : 0;

  const gloss = getForeignGloss(mat, currentLang);

  return (
    <View
      style={[
        styles.bookCard,
        isOver && styles.bookCardOver,
        room?.isCompleted && styles.bookCardCompleted,
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
            {isUnplanned ? (
              <View style={styles.unplannedBadgeChip}>
                <Text style={styles.unplannedBadgeChipText}>
                  🏷️ {t('unplannedBadge', currentLang)}
                </Text>
              </View>
            ) : null}
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
        {/* Geplant */}
        <View style={styles.metricCell}>
          <Text style={styles.metricLabel}>{t('matrixPlanned', currentLang)}</Text>
          <Text style={styles.metricValue}>
            {isUnplanned ? (
              <>
                0 <Text style={styles.metricUnit}>{displayQu}</Text>
              </>
            ) : (
              <>
                {hasRoomPlan ? `${formatQty(roomPlanned)} ` : '–'}
                {hasRoomPlan ? <Text style={styles.metricUnit}>{displayQu}</Text> : ''}
              </>
            )}
          </Text>
          <Text style={styles.metricSub}>
            {isUnplanned
              ? t('unplannedBadge', currentLang)
              : hasRoomPlan
              ? t('matrixRoom', currentLang)
              : t('matrixOnlyGaeb', currentLang)}
          </Text>
        </View>

        <View style={styles.metricDivider} />

        {/* Verfügbar */}
        <View style={styles.metricCell}>
          <Text style={styles.metricLabel}>{t('matrixAvailable', currentLang)}</Text>
          <Text
            style={[
              styles.metricValue,
              isOver ? styles.metricValOver : availableQty === 0 ? styles.metricValDone : null,
            ]}
          >
            {isOver ? `-${formatQty(exceededBy)}` : formatQty(availableQty)}{' '}
            <Text style={styles.metricUnit}>{displayQu}</Text>
          </Text>
          <Text style={styles.metricSub}>
            {isOver
              ? t('matrixOver', currentLang)
              : isUnplanned
              ? t('matrixRemaining', currentLang) || 'Rest'
              : t('matrixOpen', currentLang)}
          </Text>
        </View>

        <View style={styles.metricDivider} />

        {/* Verbaut */}
        <View style={styles.metricCell}>
          <Text style={styles.metricLabel}>{t('matrixInstalled', currentLang)}</Text>
          <Text style={[styles.metricValue, isOver && styles.metricValOver]}>
            {formatQty(currentRoomVerb)} <Text style={styles.metricUnit}>{displayQu}</Text>
          </Text>
          <Text style={styles.metricSub}>{t('matrixInRoom', currentLang)}</Text>
        </View>
      </View>

      {/* 3. Progress Bar */}
      <View style={styles.progressRow}>
        <View style={{ flex: 1 }}>
          <ProgressBar progress={progressPct} isOver={isOver} height={6} />
        </View>
        <Text style={[styles.progressPctText, isOver && styles.progressPctTextOver]}>
          {progressPct} %
        </Text>
      </View>

      {/* 4. Bottom Row: Reason note (if over) + Stepper */}
      <View style={styles.cardFooterRow}>
        <View style={{ flex: 1, paddingRight: 8 }}>
          {userReason ? (
            <TouchableOpacity
              style={styles.reasonBadge}
              onPress={() => {
                if (isLocked) {
                  if (onLockedAction) onLockedAction();
                  return;
                }
                if (onReasonBadgePress) {
                  onReasonBadgePress({
                    mat,
                    nextDelta: delta,
                    exceededBy,
                    planned: baseTarget,
                    installedBefore: roomInstalledBefore,
                    qu: mat.qu,
                    userReason,
                  });
                }
              }}
            >
              <Text style={styles.reasonBadgeText} numberOfLines={1}>
                ⚠️ {userReason}
              </Text>
            </TouchableOpacity>
          ) : isOver ? (
            <Text style={styles.overWarningText}>⚠️ {t('overRecorded', currentLang)}</Text>
          ) : null}
        </View>

        {/* Stepper (+ / −) */}
        <View style={styles.stepperWrapper}>
          <TouchableOpacity
            style={styles.stepperBtn}
            onPress={() => onStep(mat.id, -1)}
            activeOpacity={0.6}
          >
            <Text style={styles.stepperBtnText}>−</Text>
          </TouchableOpacity>

          <View style={styles.stepperValBox}>
            <Text style={styles.stepperValText}>{delta > 0 ? `+${delta}` : delta}</Text>
            <Text style={styles.stepperUnitText}>
              {mat.qu} {t('perWeek', currentLang)}
            </Text>
          </View>

          <TouchableOpacity
            style={styles.stepperBtn}
            onPress={() => onStep(mat.id, 1)}
            activeOpacity={0.6}
          >
            <Text style={styles.stepperBtnText}>+</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}
