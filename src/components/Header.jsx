import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { COLORS } from '../constants/theme';
import { LANGUAGES, t } from '../locales/i18n';

export default function Header({
  projectName = 'Hallenbad Weingarten',
  subTitle = 'Burk Haustechnik · UG',
  calendarWeek = 27,
  isOnline = false,
  pendingCount = 0,
  currentLang = 'de',
  onSelectLang,
  onSyncPress,
  isSyncing = false,
  monteurName = 'Monteur',
}) {
  return (
    <View style={styles.wrapper}>
      {/* Top Brand & Project Bar */}
      <View style={styles.topBar}>
        <View style={styles.leftInfo}>
          <View style={styles.logoRow}>
            <Text style={styles.logoBold}>burk</Text>
            <Text style={styles.logoSmall}>Haustechnik</Text>
          </View>
          <View style={styles.projectTexts}>
            <Text style={styles.projectTitle} numberOfLines={1}>
              {projectName}
            </Text>
            <Text style={styles.projectSub} numberOfLines={1}>
              {subTitle}
            </Text>
          </View>
        </View>

        <View style={styles.rightBadges}>
          <View style={styles.kwBadge}>
            <Text style={styles.kwText}>{t('kw', currentLang)} {calendarWeek}</Text>
          </View>

          {/* Sync Button */}
          <TouchableOpacity
            style={[
              styles.syncButton,
              pendingCount > 0 ? styles.syncButtonActive : styles.syncButtonIdle,
            ]}
            onPress={onSyncPress}
            disabled={isSyncing}
            activeOpacity={0.7}
          >
            <Text style={styles.syncIcon}>{isSyncing ? '⟳' : '⇅'}</Text>
            <Text style={styles.syncText}>
              {isSyncing
                ? '...'
                : pendingCount > 0
                ? `${t('syncBtn', currentLang)} (${pendingCount})`
                : t('syncBtn', currentLang)}
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Sub Bar: Status, Monteur & Languages */}
      <View style={styles.subBar}>
        {/* Online / Offline Status Badge */}
        <View style={styles.statusGroup}>
          <View style={[styles.statusDot, isOnline ? styles.dotOnline : styles.dotOffline]} />
          <Text style={styles.statusLabel}>
            {isOnline ? t('online', currentLang) : t('offline', currentLang)}
          </Text>
          {monteurName ? (
            <Text style={styles.monteurText} numberOfLines={1}>
              · {monteurName}
            </Text>
          ) : null}
        </View>

        {/* Language Switcher Chips */}
        <View style={styles.langChips}>
          <Text style={styles.globeIcon}>🌐</Text>
          {LANGUAGES.map((lang) => {
            const isActive = currentLang === lang.code;
            return (
              <TouchableOpacity
                key={lang.code}
                style={[styles.langChip, isActive && styles.langChipActive]}
                onPress={() => onSelectLang && onSelectLang(lang.code)}
                activeOpacity={0.7}
              >
                <Text style={[styles.langChipText, isActive && styles.langChipTextActive]}>
                  {lang.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    backgroundColor: COLORS.ink,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.line,
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 10,
    gap: 8,
  },
  leftInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    gap: 12,
  },
  logoRow: {
    alignItems: 'flex-start',
  },
  logoBold: {
    fontSize: 22,
    fontWeight: '900',
    fontStyle: 'italic',
    color: COLORS.amber,
    letterSpacing: -0.5,
  },
  logoSmall: {
    fontSize: 8,
    letterSpacing: 1.2,
    color: '#8A9096',
    fontWeight: '700',
    marginTop: -2,
    textTransform: 'uppercase',
  },
  projectTexts: {
    flex: 1,
  },
  projectTitle: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 15,
  },
  projectSub: {
    color: COLORS.textSecondary,
    fontSize: 11.5,
    marginTop: 1,
  },
  rightBadges: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  kwBadge: {
    backgroundColor: COLORS.ink2,
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#37495E',
  },
  kwText: {
    color: '#D2DCE6',
    fontWeight: '700',
    fontSize: 11,
  },
  syncButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 16,
  },
  syncButtonActive: {
    backgroundColor: COLORS.amber,
  },
  syncButtonIdle: {
    backgroundColor: '#37495E',
  },
  syncIcon: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: 'bold',
  },
  syncText: {
    color: '#FFFFFF',
    fontWeight: '800',
    fontSize: 12,
  },
  subBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#F6F8FA',
    paddingHorizontal: 16,
    paddingVertical: 7,
    borderTopWidth: 1,
    borderTopColor: '#28384C',
  },
  statusGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flex: 1,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  dotOnline: {
    backgroundColor: COLORS.green,
  },
  dotOffline: {
    backgroundColor: COLORS.muted,
  },
  statusLabel: {
    fontSize: 11.5,
    fontWeight: '700',
    color: COLORS.inkSoft,
  },
  monteurText: {
    fontSize: 11.5,
    color: COLORS.muted,
    fontWeight: '600',
  },
  langChips: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  globeIcon: {
    fontSize: 13,
    marginRight: 2,
  },
  langChip: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    backgroundColor: 'transparent',
  },
  langChipActive: {
    backgroundColor: COLORS.amber,
  },
  langChipText: {
    fontSize: 11,
    fontWeight: '700',
    color: COLORS.muted,
  },
  langChipTextActive: {
    color: '#FFFFFF',
  },
});
