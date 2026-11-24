import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
} from 'react-native';
import { COLORS } from '../constants/theme';
import { t, translateGroup } from '../locales/i18n';
import LvPositionCard from '../components/lv/LvPositionCard';
import LvUnplannedModal from '../components/lv/LvUnplannedModal';
import { isPositionHiddenForMonteur } from '../utils/projectMode';

export default function LvOverviewScreen({
  positions = [],
  cart = [],
  project = {},
  currentLang = 'de',
  onOpenCart,
  onQuantityChange,
  onAddUnplannedItem,
}) {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedTrade, setSelectedTrade] = useState('Alle');
  const [isSliderDragging, setIsSliderDragging] = useState(false);
  const [unplannedModalVisible, setUnplannedModalVisible] = useState(false);

  // Group positions by tradeCategory and calculate counts
  const { trades, totalPositionsCount, tradeCounts, tradeCartCounts, displayedPositions } = useMemo(() => {
    const visiblePositions = positions.filter((p) => !isPositionHiddenForMonteur(p));
    const tradeMap = new Map();
    const tCounts = { Alle: visiblePositions.length };
    const tCartCounts = { Alle: 0 };

    visiblePositions.forEach((p) => {
      const tradeName = p.tradeCategory || p.group || 'Allgemein';
      if (!tradeMap.has(tradeName)) {
        tradeMap.set(tradeName, []);
      }
      tradeMap.get(tradeName).push(p);

      tCounts[tradeName] = (tCounts[tradeName] || 0) + 1;

      // Check if position is in cart
      const cartItem = cart.find(
        (it) => it.lvItemId === p.id || (p.displayCode && it.posNr === p.displayCode)
      );
      if (cartItem && Number(cartItem.quantity) > 0) {
        tCartCounts[tradeName] = (tCartCounts[tradeName] || 0) + 1;
        tCartCounts.Alle = (tCartCounts.Alle || 0) + 1;
      }
    });

    // List of unique trade names sorted alphabetically
    const tradeNames = Array.from(tradeMap.keys()).sort((a, b) => a.localeCompare(b));

    // Filter positions based on selectedTrade and searchQuery
    const q = searchQuery.trim().toLowerCase();
    let filtered = visiblePositions;

    if (selectedTrade !== 'Alle') {
      filtered = filtered.filter(
        (p) => (p.tradeCategory || p.group || 'Allgemein') === selectedTrade
      );
    }

    if (q) {
      filtered = filtered.filter((p) => {
        const displayCode = String(p.displayCode || p.posNr || '').toLowerCase();
        const aliasTitle = String(p.aliasTitle || '').toLowerCase();
        const officialTitle = String(p.officialTitle || p.shortText || p.name || '').toLowerCase();
        const trade = String(p.tradeCategory || p.group || '').toLowerCase();
        const monteurInfo = String(p.monteurInfo || p.containsHint || p.notes || p.note || p.montagehinweis || p.hinweis || '').toLowerCase();
        return (
          displayCode.includes(q) ||
          aliasTitle.includes(q) ||
          officialTitle.includes(q) ||
          trade.includes(q) ||
          monteurInfo.includes(q)
        );
      });
    }

    // Stable sort: sortOrder then displayCode
    const sorted = [...filtered].sort((a, b) => {
      const orderA = typeof a.sortOrder === 'number' ? a.sortOrder : 999999;
      const orderB = typeof b.sortOrder === 'number' ? b.sortOrder : 999999;
      if (orderA !== orderB) return orderA - orderB;
      return String(a.displayCode || a.posNr || '').localeCompare(
        String(b.displayCode || b.posNr || ''),
        undefined,
        { numeric: true }
      );
    });

    return {
      trades: ['Alle', ...tradeNames],
      totalPositionsCount: visiblePositions.length,
      tradeCounts: tCounts,
      tradeCartCounts: tCartCounts,
      displayedPositions: sorted,
    };
  }, [positions, cart, selectedTrade, searchQuery]);

  // Total cart items count
  const totalCartCount = useMemo(() => {
    return cart.reduce((acc, it) => acc + (Number(it.quantity) > 0 ? 1 : 0), 0);
  }, [cart]);

  // Lookup cart quantity for a position
  const getCartQty = (pos) => {
    const item = cart.find(
      (it) => it.lvItemId === pos.id || (pos.displayCode && it.posNr === pos.displayCode)
    );
    return item ? Number(item.quantity) || 0 : 0;
  };

  return (
    <View style={styles.container}>
      {/* 0. Action Button: Außerplanmäßig verbaut */}
      {onAddUnplannedItem && (
        <View style={styles.unplannedActionWrap}>
          <TouchableOpacity
            style={styles.unplannedActionBtn}
            onPress={() => setUnplannedModalVisible(true)}
            activeOpacity={0.75}
          >
            <Text style={styles.unplannedActionText}>
              {t('btnUnplannedInstalled', currentLang)}
            </Text>
          </TouchableOpacity>
        </View>
      )}

      {/* 1. Global Search Bar */}
      <View style={styles.searchContainer}>
        <View style={styles.searchBar}>
          <Text style={styles.searchIcon}>🔍</Text>
          <TextInput
            style={styles.searchInput}
            value={searchQuery}
            onChangeText={setSearchQuery}
            placeholder={t('lvSearchPlaceholder', currentLang)}
            placeholderTextColor="#94A3B8"
            autoCapitalize="none"
            autoCorrect={false}
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity
              onPress={() => setSearchQuery('')}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Text style={styles.searchClear}>✕</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* 2. Horizontal Trade Filter Chip Pills */}
      <View style={styles.filterSection}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.filterPillsScroll}
        >
          {trades.map((tradeName) => {
            const isSelected = selectedTrade === tradeName;
            const count = tradeCounts[tradeName] || 0;
            const inCart = tradeCartCounts[tradeName] || 0;

            const translatedTradeName = tradeName === 'Alle'
              ? t('lvAllTrades', currentLang)
              : translateGroup(tradeName, currentLang);

            return (
              <TouchableOpacity
                key={tradeName}
                style={[styles.filterPill, isSelected && styles.filterPillActive]}
                onPress={() => setSelectedTrade(tradeName)}
                activeOpacity={0.7}
              >
                <Text
                  style={[styles.filterPillText, isSelected && styles.filterPillTextActive]}
                >
                  {translatedTradeName}
                  {count > 0 ? ` (${count})` : ''}
                </Text>

                {/* Badge if positions in this trade have quantities entered */}
                {inCart > 0 && (
                  <View
                    style={[
                      styles.pillBadge,
                      isSelected ? styles.pillBadgeActive : styles.pillBadgeInactive,
                    ]}
                  >
                    <Text
                      style={[
                        styles.pillBadgeText,
                        isSelected ? styles.pillBadgeTextActive : styles.pillBadgeTextInactive,
                      ]}
                    >
                      {inCart}
                    </Text>
                  </View>
                )}
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>

      {/* 3. Section Info Header */}
      <View style={styles.listHeaderRow}>
        <Text style={styles.listHeaderText}>
          {(selectedTrade === 'Alle'
            ? t('lvPositions', currentLang)
            : translateGroup(selectedTrade, currentLang)
          ).toUpperCase()}
          {` · ${displayedPositions.length} `}
          {displayedPositions.length === 1 ? 'Position' : 'Positionen'}
        </Text>
        {selectedTrade !== 'Alle' && (
          <TouchableOpacity onPress={() => setSelectedTrade('Alle')}>
            <Text style={styles.clearFilterText}>✕ {t('lvAllTrades', currentLang)}</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* 4. Positions List */}
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
        scrollEnabled={!isSliderDragging}
      >
        {displayedPositions.length === 0 ? (
          <View style={styles.emptyStateBox}>
            <Text style={styles.emptyStateIcon}>🔎</Text>
            <Text style={styles.emptyStateText}>
              {t('lvNoPositionsFound', currentLang)}
            </Text>
            {(selectedTrade !== 'Alle' || searchQuery.length > 0) && (
              <TouchableOpacity
                style={styles.resetBtn}
                onPress={() => {
                  setSelectedTrade('Alle');
                  setSearchQuery('');
                }}
              >
                <Text style={styles.resetBtnText}>Filter zurücksetzen</Text>
              </TouchableOpacity>
            )}
          </View>
        ) : (
          displayedPositions.map((pos) => (
            <LvPositionCard
              key={pos.id}
              position={pos}
              cartQty={getCartQty(pos)}
              onQuantityChange={onQuantityChange}
              onDragStateChange={setIsSliderDragging}
              currentLang={currentLang}
            />
          ))
        )}
      </ScrollView>

      {/* 5. Sticky Bottom Bar: "Zum Aufmaß vorbereiten"-Button */}
      <View style={styles.bottomBarContainer}>
        <TouchableOpacity
          style={[styles.prepareBtn, totalCartCount > 0 && styles.prepareBtnActive]}
          onPress={onOpenCart}
          activeOpacity={0.8}
        >
          <View style={styles.prepareBtnLeft}>
            <Text style={styles.prepareBtnIcon}>📋</Text>
            <Text style={styles.prepareBtnText}>
              {t('lvPrepareMeasurementBtn', currentLang)}
            </Text>
          </View>

          <View style={styles.prepareBtnRight}>
            {totalCartCount > 0 ? (
              <View style={styles.cartCountPill}>
                <Text style={styles.cartCountPillText}>
                  {totalCartCount} {totalCartCount === 1 ? 'Position' : 'Positionen'}
                </Text>
              </View>
            ) : null}
            <Text style={styles.prepareBtnArrow}>›</Text>
          </View>
        </TouchableOpacity>
      </View>

      {/* Modal: Außerplanmäßig verbaut / Nicht im LV */}
      {onAddUnplannedItem && (
        <LvUnplannedModal
          visible={unplannedModalVisible}
          onClose={() => setUnplannedModalVisible(false)}
          onAdd={(item) => onAddUnplannedItem(item)}
          currentLang={currentLang}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F7F8FA',
  },
  unplannedActionWrap: {
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 2,
  },
  unplannedActionBtn: {
    backgroundColor: '#FFFBEB',
    borderWidth: 1.5,
    borderColor: '#F59E0B',
    borderRadius: 12,
    paddingVertical: 11,
    paddingHorizontal: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  unplannedActionText: {
    color: '#92400E',
    fontSize: 13.5,
    fontWeight: '800',
  },
  searchContainer: {
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 8,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F1F5F9',
    borderRadius: 12,
    paddingHorizontal: 12,
    height: 42,
  },
  searchIcon: {
    fontSize: 16,
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 14.5,
    color: '#0F172A',
    paddingVertical: 0,
  },
  searchClear: {
    fontSize: 14,
    color: '#64748B',
    fontWeight: '700',
    paddingHorizontal: 6,
  },

  /* Filter Section (Horizontal Trade Chip Pills) */
  filterSection: {
    backgroundColor: '#FFFFFF',
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  filterPillsScroll: {
    paddingHorizontal: 16,
    gap: 8,
    alignItems: 'center',
  },
  filterPill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 13,
    paddingVertical: 7,
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#CBD5E1',
    gap: 6,
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
    color: '#334155',
  },
  filterPillTextActive: {
    color: '#FFFFFF',
  },
  pillBadge: {
    paddingHorizontal: 6,
    paddingVertical: 1.5,
    borderRadius: 10,
  },
  pillBadgeActive: {
    backgroundColor: '#FFFFFF',
  },
  pillBadgeInactive: {
    backgroundColor: '#0284C7',
  },
  pillBadgeText: {
    fontSize: 11,
    fontWeight: '800',
  },
  pillBadgeTextActive: {
    color: '#0284C7',
  },
  pillBadgeTextInactive: {
    color: '#FFFFFF',
  },

  /* List Header */
  listHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 4,
  },
  listHeaderText: {
    fontSize: 11.5,
    fontWeight: '800',
    color: '#64748B',
    letterSpacing: 0.5,
  },
  clearFilterText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#0284C7',
  },

  /* Scroll Content */
  scrollContent: {
    padding: 16,
    paddingTop: 8,
    paddingBottom: 95, // Room for sticky bottom bar
    gap: 12,
  },

  /* Empty State */
  emptyStateBox: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 32,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginTop: 20,
    gap: 8,
  },
  emptyStateIcon: {
    fontSize: 36,
  },
  emptyStateText: {
    fontSize: 14,
    color: '#64748B',
    fontWeight: '600',
    textAlign: 'center',
  },
  resetBtn: {
    marginTop: 10,
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: '#F1F5F9',
    borderRadius: 10,
  },
  resetBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#0284C7',
  },

  /* Sticky Bottom Bar ("Zum Aufmaß vorbereiten") */
  bottomBarContainer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 16,
    borderTopWidth: 1,
    borderTopColor: '#E2E8F0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -3 },
    shadowOpacity: 0.08,
    shadowRadius: 6,
    elevation: 8,
  },
  prepareBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#334155',
    borderRadius: 14,
    paddingVertical: 13,
    paddingHorizontal: 16,
  },
  prepareBtnActive: {
    backgroundColor: '#0284C7',
    shadowColor: '#0284C7',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 4,
  },
  prepareBtnLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  prepareBtnIcon: {
    fontSize: 18,
  },
  prepareBtnText: {
    fontSize: 15,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  prepareBtnRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  cartCountPill: {
    backgroundColor: 'rgba(255, 255, 255, 0.25)',
    paddingHorizontal: 9,
    paddingVertical: 3,
    borderRadius: 12,
  },
  cartCountPillText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  prepareBtnArrow: {
    fontSize: 20,
    fontWeight: '800',
    color: '#FFFFFF',
    lineHeight: 22,
  },
});
