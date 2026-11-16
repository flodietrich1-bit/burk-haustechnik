import React, { useState } from 'react';
import { View, Text, TouchableOpacity, Modal } from 'react-native';
import { t, formatUnit, translateGroup } from '../../locales/i18n';
import ProgressBar from '../ProgressBar';
import {
  formatQty,
  isMeterUnit,
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
  onSetDelta,
  onDragStateChange,
  onReasonBadgePress,
  onLockedAction,
}) {
  const [calcVisible, setCalcVisible] = useState(false);
  const [calcInput, setCalcInput] = useState('0');
  const [replaceOnNext, setReplaceOnNext] = useState(true);
  const [isDraggingSlider, setIsDraggingSlider] = useState(false);

  if (!mat) return null;

  const finalIsUnplanned = Boolean(isUnplanned || mat.isUnplanned || roomPlan?.isUnplanned);
  const displayName = getMaterialDisplayName(mat, roomPlan);
  const rawGroup =
    mat?.group && mat.group !== 'Allgemein'
      ? mat.group
      : roomPlan?.group || mat?.group || 'Allgemein';
  const displayGroup = translateGroup(rawGroup, currentLang);
  const rawQu = mat?.qu || roomPlan?.qu || 'Stk';
  const isMeter = isMeterUnit(rawQu);
  const displayQu = formatUnit(rawQu, currentLang);

  const hasRoomPlan = Boolean(roomPlan) && !finalIsUnplanned;
  const roomPlanned = hasRoomPlan ? Number(roomPlan.plannedQty || 0) : 0;
  const roomInstalledBefore = hasRoomPlan
    ? Number(roomPlan.installedQty || 0)
    : Number(mat.installedQty || 0);

  const safeDelta = isMeter ? Number(Number(delta || 0).toFixed(2)) : Math.round(Number(delta || 0));
  const currentRoomVerb = isMeter
    ? Number((roomInstalledBefore + safeDelta).toFixed(2))
    : Math.round(roomInstalledBefore + safeDelta);

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
    ? Math.max(0, Number((projectDelivered - currentRoomVerb).toFixed(2)))
    : Math.max(0, Number((baseTarget - currentRoomVerb).toFixed(2)));

  // isOver: For unplanned items, ONLY over if currentRoomVerb exceeds total projectDelivered!
  const isOver = finalIsUnplanned
    ? projectDelivered > 0
      ? currentRoomVerb > projectDelivered
      : false
    : baseTarget > 0
    ? currentRoomVerb > baseTarget
    : false;

  const exceededBy = isOver
    ? Math.max(0, Number((currentRoomVerb - (finalIsUnplanned ? projectDelivered : baseTarget)).toFixed(2)))
    : 0;

  // Progress percentage: unplanned items are completed (100%), can exceed 100% on overconsumption
  const rawPct = finalIsUnplanned
    ? 100
    : baseTarget > 0
    ? (currentRoomVerb / baseTarget) * 100
    : 0;
  const progressPct = Math.round(rawPct);

  const isPlusDisabled = isLocked;
  const canInteractiveSlide = !isLocked && !finalIsUnplanned && baseTarget > 0 && Boolean(onSetDelta);
  const canOpenCalculator = isMeter && !isLocked && Boolean(onSetDelta);

  const gloss = getForeignGloss(mat, currentLang);

  // Slider handler: pulls from 0% up to max 100% (baseTarget). Over 100% is only possible via "+"
  const handleSlideRatio = (ratio) => {
    if (!canInteractiveSlide) return;
    const clampedRatio = Math.max(0, Math.min(1, ratio));
    const rawTargetVerb = clampedRatio * baseTarget;

    let targetVerb;
    if (isMeter) {
      targetVerb = clampedRatio >= 1 ? baseTarget : Number(rawTargetVerb.toFixed(2));
    } else {
      targetVerb = clampedRatio >= 1 ? Math.round(baseTarget) : Math.round(rawTargetVerb);
    }

    const boundedVerb = Math.max(roomInstalledBefore, Math.min(baseTarget, targetVerb));
    const nextDelta = isMeter
      ? Math.max(0, Number((boundedVerb - roomInstalledBefore).toFixed(2)))
      : Math.max(0, Math.round(boundedVerb - roomInstalledBefore));

    onSetDelta(mat.id, nextDelta, { fromSlider: true });
  };

  const handleSliderDragState = (dragging) => {
    setIsDraggingSlider(dragging);
    if (onDragStateChange) {
      onDragStateChange(dragging);
    }
  };

  // Calculator Modal handlers (strictly for meter units: 0-9 and comma up to 2 decimal places)
  const openCalculator = () => {
    if (isLocked) {
      if (onLockedAction) onLockedAction();
      return;
    }
    if (!canOpenCalculator) return;
    const initialStr = formatQty(currentRoomVerb, true, false);
    setCalcInput(initialStr);
    setReplaceOnNext(true);
    setCalcVisible(true);
  };

  const handleCalcDigit = (digit) => {
    if (replaceOnNext) {
      setCalcInput(String(digit));
      setReplaceOnNext(false);
      return;
    }
    setCalcInput((prev) => {
      if (prev.includes(',')) {
        const [, decPart = ''] = prev.split(',');
        if (decPart.length >= 2) return prev; // Max 2 decimal places
        return `${prev}${digit}`;
      }
      if (prev === '0') {
        return String(digit);
      }
      if (prev.length >= 6) return prev;
      return `${prev}${digit}`;
    });
  };

  const handleCalcComma = () => {
    if (replaceOnNext) {
      setCalcInput('0,');
      setReplaceOnNext(false);
      return;
    }
    setCalcInput((prev) => (prev.includes(',') ? prev : `${prev},`));
  };

  const handleCalcBackspace = () => {
    setReplaceOnNext(false);
    setCalcInput((prev) => {
      if (prev.length <= 1) return '0';
      return prev.slice(0, -1);
    });
  };

  const handleCalcClear = () => {
    setCalcInput('0');
    setReplaceOnNext(true);
  };

  const handleCalcConfirm = () => {
    const normalized = String(calcInput || '0').replace(',', '.');
    const parsed = parseFloat(normalized);
    const validNum = !isNaN(parsed) && parsed >= 0 ? Number(parsed.toFixed(2)) : 0;
    const targetVerb = Math.max(roomInstalledBefore, validNum);
    const nextDelta = Math.max(0, Number((targetVerb - roomInstalledBefore).toFixed(2)));
    setCalcVisible(false);
    if (onSetDelta) {
      onSetDelta(mat.id, nextDelta, { fromCalculator: true });
    }
  };

  const remainingQty = finalIsUnplanned
    ? 0
    : Math.max(0, Number((baseTarget - currentRoomVerb).toFixed(2)));

  const displayVerbVal = currentRoomVerb > 0
    ? `+${formatQty(currentRoomVerb, isMeter, isDraggingSlider && isMeter)}`
    : '0';

  const formattedDelta = formatQty(safeDelta, isMeter, isDraggingSlider && isMeter);

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
                  +{formatQty(exceededBy, isMeter)} {displayQu} {t('overConsumptionBadge', currentLang)}
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

      {userReason ? (
        <View style={styles.reasonBadgeRow}>
          <View style={styles.reasonBadge}>
            <Text style={styles.reasonBadgeText} numberOfLines={1}>
              ℹ️ {userReason}
            </Text>
          </View>
        </View>
      ) : null}

      {/* 2. Quantity Box: GEPLANT (left) & VERBAUT Pill with Integrated Stepper (right) */}
      <View style={styles.quantityBox}>
        <View style={styles.quantityTopRow}>
          {/* GEPLANT */}
          <View style={styles.plannedCol}>
            <Text style={styles.qtyLabel}>{t('matrixPlanned', currentLang)}</Text>
            <Text style={styles.plannedValue}>
              {finalIsUnplanned ? (
                <>
                  0 <Text style={styles.plannedUnit}>{displayQu}</Text>
                </>
              ) : (
                <>
                  {hasRoomPlan ? `${formatQty(roomPlanned, isMeter)} ` : '– '}
                  <Text style={styles.plannedUnit}>{displayQu}</Text>
                </>
              )}
            </Text>
          </View>

          {/* VERBAUT Stepper Pill: [ − | VERBAUT +20 m | + ] */}
          <View
            style={[
              styles.installedStepperPill,
              isOver &&
                (progressPct > 110
                  ? styles.installedStepperPillOverRed
                  : styles.installedStepperPillOverYellow),
            ]}
          >
            {/* Minus Button */}
            <TouchableOpacity
              style={[styles.stepperInlineBtn, isLocked && styles.stepperInlineBtnDisabled]}
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
              <Text style={[styles.stepperInlineBtnText, isLocked && styles.stepperInlineBtnTextDisabled]}>−</Text>
            </TouchableOpacity>

            {/* Center: VERBAUT & Value (Tappable for Calculator on Meter items) */}
            <TouchableOpacity
              style={styles.installedValCenter}
              disabled={!canOpenCalculator && !isLocked}
              onPress={openCalculator}
              activeOpacity={canOpenCalculator ? 0.65 : 1}
            >
              <Text
                style={[
                  styles.installedLabelText,
                  isOver &&
                    (progressPct > 110
                      ? styles.installedTextOverRed
                      : styles.installedTextOverYellow),
                ]}
              >
                {t('matrixInstalled', currentLang)}
              </Text>
              <Text
                style={[
                  styles.installedValText,
                  isOver &&
                    (progressPct > 110
                      ? styles.installedTextOverRed
                      : styles.installedTextOverYellow),
                ]}
              >
                {displayVerbVal} {displayQu}
              </Text>
            </TouchableOpacity>

            {/* Plus Button */}
            <TouchableOpacity
              style={[styles.stepperInlineBtn, isPlusDisabled && styles.stepperInlineBtnDisabled]}
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
              <Text style={[styles.stepperInlineBtnText, isPlusDisabled && styles.stepperInlineBtnTextDisabled]}>+</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Bottom Banner: Noch übrig: {geplant - verbaut} m */}
        <View
          style={[
            styles.remainingBanner,
            isOver
              ? (progressPct > 110 ? styles.remainingBannerRed : styles.remainingBannerYellow)
              : null,
          ]}
        >
          <Text
            style={[
              styles.remainingBannerText,
              isOver
                ? (progressPct > 110
                    ? styles.remainingBannerTextRed
                    : styles.remainingBannerTextYellow)
                : null,
            ]}
          >
            {finalIsUnplanned
              ? t('siteStockRemaining', currentLang, {
                  qty: formatQty(availableQty, isMeter, isDraggingSlider && isMeter),
                  unit: displayQu,
                })
              : isOver
              ? t('overConsumptionRemaining', currentLang, {
                  qty: formatQty(exceededBy, isMeter, isDraggingSlider && isMeter),
                  unit: displayQu,
                })
              : t('remainingLeft', currentLang, {
                  qty: formatQty(remainingQty, isMeter, isDraggingSlider && isMeter),
                  unit: displayQu,
                })}
          </Text>
        </View>
      </View>

      {/* 3. Interactive Progress Bar (Draggable up to 100%) */}
      <View style={styles.progressRow}>
        <View style={{ flex: 1 }}>
          <ProgressBar
            progress={rawPct}
            isOver={isOver}
            height={7}
            interactive={canInteractiveSlide}
            onSlideRatio={handleSlideRatio}
            onDragStateChange={handleSliderDragState}
          />
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

      {/* 5. Calculator Keypad Modal (Strictly for Meter Units: 0-9 and comma) */}
      {canOpenCalculator && (
        <Modal
          visible={calcVisible}
          transparent
          animationType="fade"
          onRequestClose={() => setCalcVisible(false)}
        >
          <View style={styles.calcModalBackdrop}>
            <View style={styles.calcModalCard}>
              <View style={styles.calcHeaderRow}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.calcTitle}>{t('calcModalTitle', currentLang)}</Text>
                  <Text style={styles.calcSubtitle} numberOfLines={2}>
                    Pos {mat.pos} · {displayName}
                  </Text>
                </View>
                <TouchableOpacity
                  style={styles.calcCloseBtn}
                  onPress={() => setCalcVisible(false)}
                >
                  <Text style={styles.calcCloseBtnText}>✕</Text>
                </TouchableOpacity>
              </View>

              {hasRoomPlan ? (
                <Text style={styles.calcPlannedInfo}>
                  {t('matrixPlanned', currentLang)}: {formatQty(roomPlanned, true)} {displayQu}
                </Text>
              ) : null}

              {/* Calculator Display */}
              <View style={styles.calcDisplayBox}>
                <Text style={styles.calcDisplayValue}>{calcInput}</Text>
                <Text style={styles.calcDisplayUnit}>{displayQu}</Text>
              </View>

              {/* Calculator Keypad: 0-9 and comma only */}
              <View style={styles.calcGrid}>
                {[
                  ['7', '8', '9'],
                  ['4', '5', '6'],
                  ['1', '2', '3'],
                ].map((row, rIdx) => (
                  <View key={rIdx} style={styles.calcRow}>
                    {row.map((digit) => (
                      <TouchableOpacity
                        key={digit}
                        style={styles.calcKey}
                        onPress={() => handleCalcDigit(digit)}
                        activeOpacity={0.65}
                      >
                        <Text style={styles.calcKeyText}>{digit}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                ))}

                {/* Bottom Row: Comma, 0, Backspace */}
                <View style={styles.calcRow}>
                  <TouchableOpacity
                    style={[styles.calcKey, styles.calcKeyAccent]}
                    onPress={handleCalcComma}
                    activeOpacity={0.65}
                  >
                    <Text style={styles.calcKeyText}>,</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={styles.calcKey}
                    onPress={() => handleCalcDigit('0')}
                    activeOpacity={0.65}
                  >
                    <Text style={styles.calcKeyText}>0</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[styles.calcKey, styles.calcKeyAccent]}
                    onPress={handleCalcBackspace}
                    onLongPress={handleCalcClear}
                    activeOpacity={0.65}
                  >
                    <Text style={styles.calcKeyText}>⌫</Text>
                  </TouchableOpacity>
                </View>
              </View>

              {/* Action Buttons: Clear (C) and Confirm */}
              <View style={styles.calcActionsRow}>
                <TouchableOpacity
                  style={styles.calcClearActionBtn}
                  onPress={handleCalcClear}
                  activeOpacity={0.7}
                >
                  <Text style={styles.calcClearActionText}>{t('calcClearBtn', currentLang)}</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.calcConfirmBtn}
                  onPress={handleCalcConfirm}
                  activeOpacity={0.8}
                >
                  <Text style={styles.calcConfirmText}>{t('calcApplyBtn', currentLang)}</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>
      )}
    </View>
  );
}
