import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { COLORS } from '../../constants/theme';
import { t, formatUnit } from '../../locales/i18n';

export default function LvPositionCard({
  position,
  cartQty = 0,
  onQuantityChange,
  onOpenQuantityModal,
  currentLang = 'de',
}) {
  const displayCode = position.displayCode || position.posNr || position.pos || '';
  const aliasTitle = position.aliasTitle;
  const officialTitle = position.officialTitle || position.shortText || position.name || '';
  const monteurInfo = position.monteurInfo;
  const tradeCategory = position.tradeCategory || position.group || '';
  const isCustomAdded = position.sourceType === 'CUSTOM_ADDED';
  const qu = formatUnit(position.qu || 'Stk', currentLang);
  const installedQty = Number(position.installedQty || 0);
  const plannedQty = Number(position.qty || 0);

  const handleMinus = () => {
    const next = Math.max(0, (Number(cartQty) || 0) - 1);
    onQuantityChange && onQuantityChange(position, next);
  };

  const handlePlus = () => {
    const next = (Number(cartQty) || 0) + 1;
    onQuantityChange && onQuantityChange(position, next);
  };

  return (
    <View style={[styles.card, cartQty > 0 && styles.cardActive]}>
      {/* Top Header Row: displayCode, Trade Category, Custom Added Badge */}
      <View style={styles.topRow}>
        <View style={styles.codeGroup}>
          {displayCode ? (
            <View style={styles.codeBadge}>
              <Text style={styles.codeText}>{displayCode}</Text>
            </View>
          ) : null}
          {tradeCategory ? (
            <View style={styles.tradeBadge}>
              <Text style={styles.tradeText} numberOfLines={1}>{tradeCategory}</Text>
            </View>
          ) : null}
        </View>

        {isCustomAdded && (
          <View style={styles.customAddedBadge}>
            <Text style={styles.customAddedText}>★ {t('lvCustomAdded', currentLang)}</Text>
          </View>
        )}
      </View>

      {/* Titles: Prominent Bold aliasTitle + smaller officialTitle */}
      <View style={styles.titleSection}>
        {aliasTitle ? (
          <>
            <Text style={styles.aliasTitle}>{aliasTitle}</Text>
            {officialTitle ? (
              <Text style={styles.officialTitleSubtitle} numberOfLines={2}>
                {officialTitle}
              </Text>
            ) : null}
          </>
        ) : (
          <Text style={styles.aliasTitle}>{officialTitle}</Text>
        )}
      </View>

      {/* Prominent Colored Info Box for monteurInfo */}
      {monteurInfo ? (
        <View style={styles.monteurInfoBox}>
          <Text style={styles.monteurInfoIcon}>⚠️</Text>
          <View style={styles.monteurInfoContent}>
            <Text style={styles.monteurInfoLabel}>{t('lvMontagehinweis', currentLang)}:</Text>
            <Text style={styles.monteurInfoText}>{monteurInfo}</Text>
          </View>
        </View>
      ) : null}

      {/* Bottom Section: Progress Info (Left) & Fast Stepper for Cart (Right) */}
      <View style={styles.footerRow}>
        <View style={styles.statsCol}>
          <Text style={styles.statLine}>
            {t('lvBookedSoFar', currentLang, {
              qty: installedQty.toLocaleString('de-DE', { maximumFractionDigits: 2 }),
              unit: qu,
            })}
          </Text>
          {plannedQty > 0 && (
            <Text style={styles.statLineSub}>
              {t('lvTotalPlanned', currentLang, {
                qty: plannedQty.toLocaleString('de-DE', { maximumFractionDigits: 2 }),
                unit: qu,
              })}
            </Text>
          )}
        </View>

        {/* Stepper Pill for Aufmaß-Erfassung */}
        <View style={[styles.stepperContainer, cartQty > 0 && styles.stepperActive]}>
          <TouchableOpacity
            style={[styles.stepperBtn, cartQty === 0 && styles.stepperBtnDisabled]}
            onPress={handleMinus}
            disabled={cartQty === 0}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            activeOpacity={0.6}
          >
            <Text style={[styles.stepperBtnText, cartQty === 0 && styles.stepperBtnTextDisabled]}>−</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.stepperValTouch}
            onPress={() => onOpenQuantityModal && onOpenQuantityModal(position, cartQty)}
            activeOpacity={0.7}
          >
            <Text style={[styles.stepperValText, cartQty > 0 && styles.stepperValTextActive]} numberOfLines={1}>
              {cartQty > 0 ? `+${cartQty}` : '0'}
            </Text>
            <Text style={[styles.stepperUnitText, cartQty > 0 && styles.stepperUnitTextActive]}>{qu}</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.stepperBtn}
            onPress={handlePlus}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            activeOpacity={0.6}
          >
            <Text style={styles.stepperBtnText}>+</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 14,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 2,
  },
  cardActive: {
    borderColor: '#3B82F6',
    backgroundColor: '#F8FAFC',
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
    gap: 8,
  },
  codeGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flexShrink: 1,
  },
  codeBadge: {
    backgroundColor: '#0F172A',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  codeText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 0.3,
  },
  tradeBadge: {
    backgroundColor: '#F1F5F9',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    maxWidth: 160,
  },
  tradeText: {
    color: '#475569',
    fontSize: 11,
    fontWeight: '600',
  },
  customAddedBadge: {
    backgroundColor: '#EFF6FF',
    borderColor: '#BFDBFE',
    borderWidth: 1,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
  },
  customAddedText: {
    color: '#2563EB',
    fontSize: 11,
    fontWeight: '700',
  },
  titleSection: {
    marginBottom: 8,
  },
  aliasTitle: {
    color: '#0F172A',
    fontSize: 16,
    fontWeight: '700',
    lineHeight: 22,
  },
  officialTitleSubtitle: {
    color: '#64748B',
    fontSize: 12,
    lineHeight: 16,
    marginTop: 2,
  },
  monteurInfoBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: '#FEF3C7',
    borderWidth: 1,
    borderColor: '#F59E0B',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
    marginTop: 2,
    marginBottom: 10,
    gap: 8,
  },
  monteurInfoIcon: {
    fontSize: 14,
    marginTop: 1,
  },
  monteurInfoContent: {
    flex: 1,
  },
  monteurInfoLabel: {
    color: '#92400E',
    fontSize: 11,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 0.3,
  },
  monteurInfoText: {
    color: '#78350F',
    fontSize: 13,
    fontWeight: '600',
    lineHeight: 18,
    marginTop: 1,
  },
  footerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
    gap: 12,
  },
  statsCol: {
    flex: 1,
  },
  statLine: {
    color: '#334155',
    fontSize: 12,
    fontWeight: '600',
  },
  statLineSub: {
    color: '#94A3B8',
    fontSize: 11,
    fontWeight: '500',
    marginTop: 1,
  },
  stepperContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F1F5F9',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#CBD5E1',
    width: 156,
    height: 44,
    overflow: 'hidden',
  },
  stepperActive: {
    backgroundColor: '#EFF6FF',
    borderColor: '#3B82F6',
  },
  stepperBtn: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#E2E8F0',
  },
  stepperBtnDisabled: {
    backgroundColor: '#F8FAFC',
  },
  stepperBtnText: {
    fontSize: 22,
    fontWeight: '700',
    color: '#0F172A',
  },
  stepperBtnTextDisabled: {
    color: '#CBD5E1',
  },
  stepperValTouch: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 2,
  },
  stepperValText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#64748B',
  },
  stepperValTextActive: {
    color: '#1D4ED8',
    fontWeight: '800',
  },
  stepperUnitText: {
    fontSize: 10,
    fontWeight: '600',
    color: '#94A3B8',
    marginTop: -2,
  },
  stepperUnitTextActive: {
    color: '#3B82F6',
  },
});
