import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { t, formatUnit, translateGroup } from '../../locales/i18n';
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
  isUnplanned = false,
  siteStockAvailable = null,
  onStep,
  onReasonBadgePress,
  onLockedAction,
}) {
  if (!mat) return null;

  const finalIsUnplanned = Boolean(isUnplanned || mat.isUnplanned || roomPlan?.isUnplanned);
  const displayName = getMaterialDisplayName(mat, roomPlan);
  const rawGroup =
    mat?.group && mat.group !== 'Allgemein'
      ? mat.group
      : roomPlan?.group || mat?.group || 'Allgemein';
  const displayGroup = translateGroup(rawGroup, currentLang);
  const displayQu = formatUnit(mat?.qu || roomPlan?.qu || 'Stk', currentLang);

  const hasRoomPlan = Boolean(roomPlan) && !finalIsUnplanned;
  const roomPlanned = hasRoomPlan ? Number(roomPlan.plannedQty || 0) : 0;
  const roomInstalledBefore = hasRoomPlan
    ? Number(roomPlan.installedQty || 0)
    : Number(mat.installedQty || 0);

  const currentRoomVerb = roomInstalledBefore + delta;
  const projectDelivered = Number(
    mat.deliveredQty !== undefined && mat.deliveredQty !== null && Number(mat.deliveredQty) > 0
      ? mat.deliveredQty
      : mat.qty || (roomPlan && roomPlan.plannedQty) || 0
  );

  // Target for planning: For unplanned items, planned is strictly 0!
  const baseTarget = finalIsUnplanned
    ? 0
    : hasRoomPlan
    ? roomPlanned
    : projectDelivered;

  // Verfügbar: For unplanned items, it reflects remaining project site stock
  const availableQty = siteStockAvailable !== null
    ? siteStockAvailable
    : finalIsUnplanned
    ? Math.max(0, projectDelivered - currentRoomVerb)
    : Math.max(0, baseTarget - currentRoomVerb);

  // isOver: For unplanned items, ONLY over if currentRoomVerb exceeds total projectDelivered!
  const isOver = finalIsUnplanned
    ? projectDelivered > 0
      ? currentRoomVerb > projectDelivered
      : false
    : baseTarget > 0
    ? currentRoomVerb > baseTarget
    : false;

  const exceededBy = isOver
    ? Math.max(0, currentRoomVerb - (finalIsUnplanned ? projectDelivered : baseTarget))
    : 0;

  // Progress percentage: unplanned items are completed (100%), can exceed 100% on overconsumption
  const progressPct = finalIsUnplanned
    ? 100
    : baseTarget > 0
    ? Math.round((currentRoomVerb / baseTarget) * 100)
    : 0;

  const isPlusDisabled = isLocked;

  const gloss = getForeignGloss(mat, currentLang);

  return (
    <View
      style={[
        styles.bookCard,
        room?.isCompleted && styles.bookCardCompleted,
      ]}
    >
      {/* 1. TOP: Icon left + Full-width Title & Subtitle */}
      <View style={styles.cardHeaderRow}>
        <View style={styles.iconBox}>
          <Text style={styles.iconSymbol}>
            {getMatIconSymbol(mat.icon)}
          </Text>
        </View>

        <View style={styles.cardHeaderCol}>
          <View style={styles.posRow}>
            <View style={styles.posChip}>
              <Text style={styles.posChipText}>Pos {mat.pos}</Text>
            </View>
            {finalIsUnplanned ? (
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
              <View
                style={[
                  styles.overBadge,
                  progressPct <= 110 ? styles.overBadgeYellow : styles.overBadgeRed,
                ]}
              >
                <Text
                  style={[
                    styles.overBadgeText,
                    progressPct <= 110
                      ? styles.overBadgeTextYellow
                      : styles.overBadgeTextRed,
                  ]}
                >
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
            {finalIsUnplanned ? (
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
            {finalIsUnplanned
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
              isOver
                ? (progressPct > 110 ? styles.metricValOverRed : styles.metricValOverYellow)
                : availableQty === 0
                ? styles.metricValDone
                : null,
            ]}
          >
            {isOver ? `-${formatQty(exceededBy)}` : formatQty(availableQty)}{' '}
            <Text style={styles.metricUnit}>{displayQu}</Text>
          </Text>
          <Text style={styles.metricSub}>
            {isOver
              ? t('matrixOver', currentLang)
              : finalIsUnplanned
              ? t('matrixRemaining', currentLang) || 'Rest'
              : t('matrixOpen', currentLang)}
          </Text>
        </View>

        <View style={styles.metricDivider} />

        {/* Verbaut */}
        <View style={styles.metricCell}>
          <Text style={styles.metricLabel}>{t('matrixInstalled', currentLang)}</Text>
          <Text
            style={[
              styles.metricValue,
              isOver ? (progressPct > 110 ? styles.metricValOverRed : styles.metricValOverYellow) : null,
            ]}
          >
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
        <Text
          style={[
            styles.progressPctText,
            progressPct > 110
              ? styles.progressPctTextRed
              : progressPct > 100
              ? styles.progressPctTextYellow
              : null,
          ]}
        >
          {progressPct} %
        </Text>
      </View>

      {/* 4. Bottom Row: Stepper */}
      <View style={styles.cardFooterRow}>
        <View style={{ flex: 1, paddingRight: 8 }}>
          {userReason ? (
            <View style={styles.reasonBadge}>
              <Text style={styles.reasonBadgeText} numberOfLines={1}>
                ℹ️ {userReason}
              </Text>
            </View>
          ) : null}
        </View>

        {/* Stepper (+ / −) */}
        <View style={styles.stepperWrapper}>
          <TouchableOpacity
            style={[styles.stepperBtn, isLocked && styles.stepperBtnDisabled]}
            onPress={() => {
              if (isLocked) {
                if (onLockedAction) onLockedAction();
                return;
              }
              onStep(mat.id, -1);
            }}
            disabled={isLocked}
            activeOpacity={0.6}
          >
            <Text style={[styles.stepperBtnText, isLocked && styles.stepperBtnTextDisabled]}>−</Text>
          </TouchableOpacity>

          <View style={styles.stepperValBox}>
            <Text style={styles.stepperValText}>{delta > 0 ? `+${delta}` : delta}</Text>
            <Text style={styles.stepperUnitText}>
              {displayQu} {t('perWeek', currentLang)}
            </Text>
          </View>

          <TouchableOpacity
            style={[styles.stepperBtn, isPlusDisabled && styles.stepperBtnDisabled]}
            onPress={() => {
              if (isLocked) {
                if (onLockedAction) onLockedAction();
                return;
              }
              onStep(mat.id, 1);
            }}
            disabled={isPlusDisabled}
            activeOpacity={0.6}
          >
            <Text style={[styles.stepperBtnText, isPlusDisabled && styles.stepperBtnTextDisabled]}>+</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}
