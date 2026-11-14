import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
} from 'react-native';
import { COLORS } from '../constants/theme';
import { APP_VERSION } from '../constants/version';
import { t } from '../locales/i18n';
import ProgressRing from '../components/ProgressRing';
import { computeRoomPercentage, getRoomFloor } from '../services/storageService';

const FLOOR_PILLS = ['Alle', 'UG', 'EG', 'OG', 'DG', 'Strangschema'];

export default function RoomListScreen({
  rooms = [],
  materials = [],
  plans = [],
  project = {},
  currentLang = 'de',
  onSelectRoom,
}) {
  const [selectedFloor, setSelectedFloor] = useState('Alle');

  // Group rooms by floor
  const { floorCounts, groupedRooms, filteredRooms } = useMemo(() => {
    const counts = { Alle: rooms.length, UG: 0, EG: 0, OG: 0, DG: 0, Strangschema: 0, Sonstiges: 0 };
    const groups = { UG: [], EG: [], OG: [], DG: [], Strangschema: [], Sonstiges: [] };

    rooms.forEach((r) => {
      const fl = getRoomFloor(r);
      if (counts[fl] !== undefined) {
        counts[fl]++;
      } else {
        counts.Sonstiges++;
      }
      if (groups[fl]) {
        groups[fl].push(r);
      } else {
        groups.Sonstiges.push(r);
      }
    });

    let filtered = rooms;
    if (selectedFloor !== 'Alle') {
      filtered = rooms.filter((r) => getRoomFloor(r) === selectedFloor);
    }

    return { floorCounts: counts, groupedRooms: groups, filteredRooms: filtered };
  }, [rooms, selectedFloor]);

  const renderRoomCard = (room) => {
    const transName = currentLang !== 'de' && room.translations?.[currentLang];
    const pct = computeRoomPercentage(room, materials);
    const isCompleted = room.isCompleted || room.status === 'completed';
    return (
      <TouchableOpacity
        key={room.id}
        style={styles.roomCard}
        onPress={() => onSelectRoom(room)}
        activeOpacity={0.7}
      >
        {/* Progress Ring */}
        <View style={styles.ringWrapper}>
          <ProgressRing size={46} strokeWidth={5} percentage={pct} />
        </View>

        {/* Room Texts */}
        <View style={styles.roomInfo}>
          <View style={styles.nameRow}>
            <Text style={styles.roomName}>{room.name}</Text>
            {!isCompleted && pct > 0 && pct < 100 ? (
              <View style={styles.inProgressBadge}>
                <Text style={styles.inProgressBadgeText}>{pct} %</Text>
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

        {isCompleted && (
          <View style={styles.completedBadge}>
            <Text style={styles.completedBadgeText}>✓ {t('roomCompletedBadge', currentLang)}</Text>
          </View>
        )}

        {/* Chevron Arrow */}
        <Text style={styles.chevron}>›</Text>
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.content}>
        {/* Horizontal Floor Filter Pills Bar */}
        <View style={styles.filterSection}>
          <Text style={styles.sectTitle}>{t('roomsSect', currentLang)}</Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.filterPillsScroll}
          >
            {FLOOR_PILLS.map((pill) => {
              const count = floorCounts[pill] || 0;
              const isSelected = selectedFloor === pill;
              if (pill !== 'Alle' && count === 0 && !FLOOR_PILLS.slice(0, 4).includes(pill)) {
                return null;
              }
              return (
                <TouchableOpacity
                  key={pill}
                  style={[styles.filterPill, isSelected && styles.filterPillActive]}
                  onPress={() => setSelectedFloor(pill)}
                  activeOpacity={0.7}
                >
                  <Text
                    style={[styles.filterPillText, isSelected && styles.filterPillTextActive]}
                  >
                    {pill === 'Alle' ? t('filterAll', currentLang) : pill}
                    {count > 0 ? ` (${count})` : ''}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </View>

        {/* Rooms List grouped or filtered */}
        <View style={styles.roomList}>
          {selectedFloor === 'Alle' ? (
            // Grouped by Floor
            Object.entries(groupedRooms).map(([fl, fRooms]) => {
              if (!fRooms || fRooms.length === 0) return null;
              return (
                <View key={fl} style={styles.floorGroup}>
                  <View style={styles.floorGroupHeader}>
                    <View style={styles.floorGroupTitleRow}>
                      <View style={styles.floorBadgeMini}>
                        <Text style={styles.floorBadgeMiniText}>{fl}</Text>
                      </View>
                      <Text style={styles.floorGroupTitle}>
                        {t('roomsCountFloor', currentLang, { n: fRooms.length })}
                      </Text>
                    </View>
                  </View>
                  <View style={styles.floorCardsWrap}>
                    {fRooms.map(renderRoomCard)}
                  </View>
                </View>
              );
            })
          ) : (
            // Filtered Rooms for Single Floor
            filteredRooms.map(renderRoomCard)
          )}
        </View>

        {/* App Version Footer */}
        <View style={styles.footerVersionBox}>
          <Text style={styles.footerVersionText}>TTApp {APP_VERSION}</Text>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.bg,
  },
  content: {
    padding: 12,
    paddingBottom: 28,
  },
  filterSection: {
    marginBottom: 10,
  },
  sectTitle: {
    fontSize: 12,
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    color: COLORS.muted,
    fontWeight: '800',
    marginHorizontal: 2,
    marginBottom: 8,
    marginTop: 4,
  },
  filterPillsScroll: {
    gap: 8,
    paddingVertical: 2,
  },
  filterPill: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    alignItems: 'center',
    justifyContent: 'center',
  },
  filterPillActive: {
    backgroundColor: '#0284C7',
    borderColor: '#0284C7',
    shadowColor: '#0284C7',
    shadowOpacity: 0.25,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 4,
    elevation: 2,
  },
  filterPillText: {
    fontSize: 12.5,
    fontWeight: '700',
    color: COLORS.ink,
  },
  filterPillTextActive: {
    color: '#FFFFFF',
  },

  roomList: {
    gap: 10,
  },
  floorGroup: {
    marginBottom: 12,
  },
  floorGroupHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 6,
    paddingHorizontal: 4,
    marginBottom: 6,
  },
  floorGroupTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  floorBadgeMini: {
    backgroundColor: '#0F172A',
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 6,
  },
  floorBadgeMiniText: {
    color: '#38BDF8',
    fontWeight: '800',
    fontSize: 11,
  },
  floorGroupTitle: {
    fontSize: 12,
    color: COLORS.muted,
    fontWeight: '700',
  },

  floorCardsWrap: {
    gap: 8,
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
    borderRadius: 8,
    minHeight: 34,
    paddingHorizontal: 10,
    paddingVertical: 6,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 4,
  },
  completedBadgeText: {
    fontSize: 12.5,
    fontWeight: '800',
    color: '#234E52',
  },
  inProgressBadge: {
    backgroundColor: '#FEF3C7',
    borderWidth: 1,
    borderColor: '#F59E0B',
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 1,
  },
  inProgressBadgeText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#B45309',
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
  footerVersionBox: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 20,
    marginTop: 8,
  },
  footerVersionText: {
    fontSize: 11.5,
    fontWeight: '700',
    color: COLORS.muted,
    letterSpacing: 0.5,
  },
});
