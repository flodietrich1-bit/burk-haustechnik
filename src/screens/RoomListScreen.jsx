import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
} from 'react-native';
import { COLORS } from '../constants/theme';
import { t } from '../locales/i18n';
import ProgressRing from '../components/ProgressRing';

export default function RoomListScreen({
  rooms = [],
  materials = [],
  project = {},
  currentLang = 'de',
  onSelectRoom,
  onSwitchProject = null,
}) {
  // Calculate total project stats
  const totalDeliveredVal = materials.reduce((acc, m) => acc + (m.deliveredQty * m.unitPrice), 0);
  const totalInstalledVal = materials.reduce((acc, m) => acc + (m.installedQty * m.unitPrice), 0);
  const totalProg = totalDeliveredVal > 0 ? Math.round((totalInstalledVal / totalDeliveredVal) * 100) : 42;

  const formatEuro = (val) => {
    return Math.round(val).toLocaleString('de-DE') + ' €';
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* Project Banner Card */}
      <View style={styles.projCard}>
        <View style={styles.projHeader}>
          <Text style={styles.p1}>{t('projTitle', currentLang)}</Text>
          <View style={styles.badgeOverall}>
            <Text style={styles.badgeText}>{totalProg}%</Text>
          </View>
        </View>
        <Text style={styles.p2}>{t('projSub', currentLang)}</Text>

        {/* Quick KPI stats */}
        <View style={styles.kpiRow}>
          <View style={styles.kpiItem}>
            <Text style={styles.kpiLabel}>{t('installedValue', currentLang)}</Text>
            <Text style={styles.kpiValue}>{formatEuro(totalInstalledVal)}</Text>
          </View>
          <View style={styles.kpiDivider} />
          <View style={styles.kpiItem}>
            <Text style={styles.kpiLabel}>{t('deliveredValue', currentLang)}</Text>
            <Text style={styles.kpiValue}>{formatEuro(totalDeliveredVal)}</Text>
          </View>
        </View>

        {onSwitchProject && (
          <TouchableOpacity
            style={styles.switchProjectBtn}
            onPress={onSwitchProject}
            activeOpacity={0.7}
          >
            <Text style={styles.switchProjectText}>🔄 {t('switchProject', currentLang)}</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Section Title */}
      <Text style={styles.sectTitle}>{t('roomsSect', currentLang)}</Text>

      {/* Rooms List */}
      <View style={styles.roomList}>
        {rooms.map((room) => {
          const transName = currentLang !== 'de' && room.translations?.[currentLang];
          return (
            <TouchableOpacity
              key={room.id}
              style={styles.roomCard}
              onPress={() => onSelectRoom(room)}
              activeOpacity={0.7}
            >
              {/* Progress Ring */}
              <View style={styles.ringWrapper}>
                <ProgressRing size={46} strokeWidth={5} percentage={room.pct || 0} />
              </View>

              {/* Room Texts */}
              <View style={styles.roomInfo}>
                <View style={styles.nameRow}>
                  <Text style={styles.roomName}>{room.name}</Text>
                  {room.isCompleted || room.pct === 100 ? (
                    <View style={styles.completedBadge}>
                      <Text style={styles.completedBadgeText}>✓ 100 %</Text>
                    </View>
                  ) : null}
                  {transName ? (
                    <Text style={styles.translatedName}>({transName})</Text>
                  ) : null}
                </View>
                <Text style={styles.roomSub} numberOfLines={1}>
                  {room.sub || room.code}
                </Text>
              </View>

              {/* Chevron Arrow */}
              <Text style={styles.chevron}>›</Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.bg,
  },
  content: {
    padding: 16,
    paddingBottom: 32,
  },
  projCard: {
    backgroundColor: COLORS.ink2,
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
  },
  projHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  p1: {
    color: '#FFFFFF',
    fontWeight: '800',
    fontSize: 17,
  },
  badgeOverall: {
    backgroundColor: COLORS.amber,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 12,
  },
  badgeText: {
    color: '#FFFFFF',
    fontWeight: '800',
    fontSize: 12,
  },
  p2: {
    color: COLORS.textSecondary,
    fontSize: 12.5,
    lineHeight: 17,
    marginBottom: 14,
  },
  kpiRow: {
    flexDirection: 'row',
    backgroundColor: '#1E2D3E',
    borderRadius: 12,
    padding: 10,
    alignItems: 'center',
  },
  kpiItem: {
    flex: 1,
    alignItems: 'center',
  },
  kpiDivider: {
    width: 1,
    height: 24,
    backgroundColor: '#34475D',
  },
  kpiLabel: {
    fontSize: 10.5,
    color: COLORS.textSecondary,
    fontWeight: '600',
    textTransform: 'uppercase',
  },
  kpiValue: {
    fontSize: 15,
    fontWeight: '800',
    color: '#FFFFFF',
    marginTop: 2,
  },
  switchProjectBtn: {
    marginTop: 12,
    paddingVertical: 8,
    paddingHorizontal: 12,
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  switchProjectText: {
    color: '#93C5FD',
    fontSize: 12,
    fontWeight: '800',
  },
  sectTitle: {
    fontSize: 12,
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    color: COLORS.muted,
    fontWeight: '800',
    marginHorizontal: 2,
    marginBottom: 10,
    marginTop: 4,
  },
  roomList: {
    gap: 10,
  },
  roomCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: COLORS.line,
    gap: 12,
    elevation: 1,
    shadowColor: '#000',
    shadowOpacity: 0.04,
    shadowOffset: { width: 0, height: 1 },
    shadowRadius: 3,
  },
  ringWrapper: {
    flexShrink: 0,
  },
  roomInfo: {
    flex: 1,
  },
  nameRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: 6,
  },
  roomName: {
    fontSize: 15,
    fontWeight: '700',
    color: COLORS.ink,
  },
  completedBadge: {
    backgroundColor: '#E6FFFA',
    borderWidth: 1,
    borderColor: '#38B2AC',
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 1,
  },
  completedBadgeText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#234E52',
  },
  translatedName: {
    fontSize: 13,
    fontStyle: 'italic',
    color: COLORS.muted,
    fontWeight: '500',
  },
  roomSub: {
    fontSize: 12,
    color: COLORS.muted,
    marginTop: 3,
  },
  chevron: {
    fontSize: 22,
    fontWeight: '400',
    color: '#C4CDD6',
  },
});
