import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  SafeAreaView,
} from 'react-native';
import { COLORS } from '../constants/theme';
import { t } from '../locales/i18n';
import LvPositionCard from '../components/lv/LvPositionCard';
import LvQuantityModal from '../components/lv/LvQuantityModal';

export default function LvOverviewScreen({
  positions = [],
  cart = [],
  project = {},
  currentLang = 'de',
  onSelectTrade,
  onOpenCart,
  onQuantityChange,
}) {
  const [searchQuery, setSearchQuery] = useState('');
  const [modalPos, setModalPos] = useState(null);

  // Group positions by tradeCategory
  const { trades, totalPositionsCount, filteredPositions } = useMemo(() => {
    const tradeMap = new Map();

    positions.forEach((p) => {
      const tradeName = p.tradeCategory || p.group || 'Allgemein';
      if (!tradeMap.has(tradeName)) {
        tradeMap.set(tradeName, {
          name: tradeName,
          positions: [],
          totalPlannedQty: 0,
          totalInstalledQty: 0,
          itemsWithProgress: 0,
        });
      }
      const trade = tradeMap.get(tradeName);
      trade.positions.push(p);

      const qty = Number(p.qty || 0);
      const installed = Number(p.installedQty || 0);
      trade.totalPlannedQty += qty;
      trade.totalInstalledQty += installed;
      if (installed > 0) {
        trade.itemsWithProgress += 1;
      }
    });

    // Convert map to sorted array
    const sortedTrades = Array.from(tradeMap.values()).map((tr) => {
      // Sort positions within trade by sortOrder then displayCode
      tr.positions.sort((a, b) => {
        const orderA = typeof a.sortOrder === 'number' ? a.sortOrder : 999999;
        const orderB = typeof b.sortOrder === 'number' ? b.sortOrder : 999999;
        if (orderA !== orderB) return orderA - orderB;
        return String(a.displayCode || a.posNr || '').localeCompare(String(b.displayCode || b.posNr || ''), undefined, { numeric: true });
      });

      const pct = tr.totalPlannedQty > 0
        ? Math.min(100, Math.round((tr.totalInstalledQty / tr.totalPlannedQty) * 100))
        : (tr.itemsWithProgress > 0 ? 100 : 0);

      // Count how many items of this trade are in current cart
      const cartCount = cart.filter((item) =>
        tr.positions.some((p) => p.id === item.lvItemId || (p.displayCode && p.displayCode === item.posNr))
      ).length;

      return {
        ...tr,
        count: tr.positions.length,
        progressPercent: pct,
        cartCount,
      };
    });

    // Filtered positions when search is active
    const q = searchQuery.trim().toLowerCase();
    let filtered = [];
    if (q) {
      filtered = positions.filter((p) => {
        const displayCode = String(p.displayCode || p.posNr || '').toLowerCase();
        const aliasTitle = String(p.aliasTitle || '').toLowerCase();
        const officialTitle = String(p.officialTitle || p.shortText || p.name || '').toLowerCase();
        const trade = String(p.tradeCategory || p.group || '').toLowerCase();
        return (
          displayCode.includes(q) ||
          aliasTitle.includes(q) ||
          officialTitle.includes(q) ||
          trade.includes(q)
        );
      });
      // Sort filtered
      filtered.sort((a, b) => {
        const orderA = typeof a.sortOrder === 'number' ? a.sortOrder : 999999;
        const orderB = typeof b.sortOrder === 'number' ? b.sortOrder : 999999;
        if (orderA !== orderB) return orderA - orderB;
        return String(a.displayCode || a.posNr || '').localeCompare(String(b.displayCode || b.posNr || ''), undefined, { numeric: true });
      });
    }

    return {
      trades: sortedTrades,
      totalPositionsCount: positions.length,
      filteredPositions: filtered,
    };
  }, [positions, cart, searchQuery]);

  // Total cart items count & quantity
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
      {/* Global Search Bar */}
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
            <TouchableOpacity onPress={() => setSearchQuery('')} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <Text style={styles.searchClear}>✕</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
        {searchQuery.trim().length > 0 ? (
          /* Search Results Mode */
          <View style={styles.resultsContainer}>
            <View style={styles.sectionHeaderRow}>
              <Text style={styles.sectionHeading}>
                {t('foundPositionsHeader', currentLang)} ({filteredPositions.length})
              </Text>
            </View>

            {filteredPositions.length === 0 ? (
              <View style={styles.emptyStateBox}>
                <Text style={styles.emptyStateIcon}>🔎</Text>
                <Text style={styles.emptyStateText}>{t('lvNoPositionsFound', currentLang)}</Text>
              </View>
            ) : (
              filteredPositions.map((pos) => (
                <LvPositionCard
                  key={pos.id}
                  position={pos}
                  cartQty={getCartQty(pos)}
                  onQuantityChange={onQuantityChange}
                  onOpenQuantityModal={(p, q) => setModalPos({ position: p, qty: q })}
                  currentLang={currentLang}
                />
              ))
            )}
          </View>
        ) : (
          /* Trades Overview (Gewerke-Kacheln) */
          <View style={styles.tradesContainer}>
            <View style={styles.sectionHeaderRow}>
              <View>
                <Text style={styles.sectionHeading}>{t('lvTrades', currentLang)}</Text>
                <Text style={styles.sectionSubHeading}>
                  {project?.name || ''} · {t('lvItemCount', currentLang, { count: totalPositionsCount })}
                </Text>
              </View>
            </View>

            {trades.map((trade) => {
              const hasProgress = trade.progressPercent > 0;
              return (
                <TouchableOpacity
                  key={trade.name}
                  style={[styles.tradeCard, trade.cartCount > 0 && styles.tradeCardCartActive]}
                  onPress={() => onSelectTrade && onSelectTrade(trade.name)}
                  activeOpacity={0.75}
                >
                  <View style={styles.tradeCardHeader}>
                    <View style={styles.tradeTitleRow}>
                      <View style={styles.tradeIconPill}>
                        <Text style={styles.tradeIconText}>📦</Text>
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.tradeTitle} numberOfLines={2}>
                          {trade.name}
                        </Text>
                        <Text style={styles.tradeSubtitle}>
                          {t('lvItemCount', currentLang, { count: trade.count })}
                          {trade.itemsWithProgress > 0
                            ? ` · ${trade.itemsWithProgress}/${trade.count} erfasst`
                            : ''}
                        </Text>
                      </View>
                    </View>

                    {trade.cartCount > 0 && (
                      <View style={styles.cartBadgeInTrade}>
                        <Text style={styles.cartBadgeInTradeText}>
                          🛒 {trade.cartCount}
                        </Text>
                      </View>
                    )}
                  </View>

                  {/* Progress Bar & Percentage */}
                  <View style={styles.progressRow}>
                    <View style={styles.progressBarTrack}>
                      <View
                        style={[
                          styles.progressBarFill,
                          {
                            width: `${Math.min(100, Math.max(0, trade.progressPercent))}%`,
                            backgroundColor: trade.progressPercent >= 100 ? '#10B981' : '#3B82F6',
                          },
                        ]}
                      />
                    </View>
                    <Text
                      style={[
                        styles.progressPercentText,
                        trade.progressPercent >= 100 && { color: '#059669' },
                      ]}
                    >
                      {trade.progressPercent}%
                    </Text>
                  </View>

                  {/* Right Arrow / Action hint */}
                  <View style={styles.tradeCardFooter}>
                    <Text style={styles.viewPositionsLink}>{t('lvPositions', currentLang)} ansehen</Text>
                    <Text style={styles.chevronArrow}>›</Text>
                  </View>
                </TouchableOpacity>
              );
            })}
          </View>
        )}
      </ScrollView>

      {/* Floating Action Button for Aufmaß-Warenkorb */}
      <TouchableOpacity
        style={[styles.fab, totalCartCount > 0 && styles.fabActive]}
        onPress={onOpenCart}
        activeOpacity={0.8}
        hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
      >
        <Text style={styles.fabIcon}>🛒</Text>
        <Text style={styles.fabText}>{t('lvCartFab', currentLang)}</Text>
        {totalCartCount > 0 && (
          <View style={styles.fabBadge}>
            <Text style={styles.fabBadgeText}>{totalCartCount}</Text>
          </View>
        )}
      </TouchableOpacity>

      {/* Direct Numeric Input Modal */}
      {modalPos && (
        <LvQuantityModal
          visible={!!modalPos}
          position={modalPos.position}
          initialQty={modalPos.qty}
          onClose={() => setModalPos(null)}
          onApply={onQuantityChange}
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
  searchContainer: {
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F1F5F9',
    borderRadius: 12,
    paddingHorizontal: 12,
    height: 44,
  },
  searchIcon: {
    fontSize: 16,
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 15,
    color: '#0F172A',
    paddingVertical: 0,
  },
  searchClear: {
    fontSize: 14,
    color: '#64748B',
    fontWeight: '700',
    paddingHorizontal: 6,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 90, // Leave room for FAB
  },
  sectionHeaderRow: {
    marginBottom: 14,
  },
  sectionHeading: {
    fontSize: 20,
    fontWeight: '800',
    color: '#0F172A',
    letterSpacing: -0.3,
  },
  sectionSubHeading: {
    fontSize: 13,
    color: '#64748B',
    fontWeight: '500',
    marginTop: 2,
  },
  tradesContainer: {
    gap: 12,
  },
  tradeCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 2,
  },
  tradeCardCartActive: {
    borderColor: '#93C5FD',
    backgroundColor: '#FBFDFF',
  },
  tradeCardHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 10,
    marginBottom: 12,
  },
  tradeTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  tradeIconPill: {
    width: 42,
    height: 42,
    borderRadius: 12,
    backgroundColor: '#EFF6FF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  tradeIconText: {
    fontSize: 20,
  },
  tradeTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: '#0F172A',
    lineHeight: 22,
  },
  tradeSubtitle: {
    fontSize: 12,
    color: '#64748B',
    fontWeight: '500',
    marginTop: 2,
  },
  cartBadgeInTrade: {
    backgroundColor: '#EFF6FF',
    borderWidth: 1,
    borderColor: '#3B82F6',
    borderRadius: 20,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  cartBadgeInTradeText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#1D4ED8',
  },
  progressRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 12,
  },
  progressBarTrack: {
    flex: 1,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#F1F5F9',
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    borderRadius: 3,
  },
  progressPercentText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#64748B',
    width: 38,
    textAlign: 'right',
  },
  tradeCardFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#F8FAFC',
  },
  viewPositionsLink: {
    fontSize: 13,
    fontWeight: '600',
    color: '#2563EB',
  },
  chevronArrow: {
    fontSize: 20,
    fontWeight: '600',
    color: '#94A3B8',
  },
  resultsContainer: {
    gap: 8,
  },
  emptyStateBox: {
    padding: 32,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    marginTop: 20,
  },
  emptyStateIcon: {
    fontSize: 32,
    marginBottom: 8,
  },
  emptyStateText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#64748B',
    textAlign: 'center',
  },
  fab: {
    position: 'absolute',
    bottom: 24,
    right: 20,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#0F172A',
    paddingVertical: 14,
    paddingHorizontal: 18,
    borderRadius: 30,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 8,
    gap: 8,
  },
  fabActive: {
    backgroundColor: '#2563EB',
  },
  fabIcon: {
    fontSize: 18,
  },
  fabText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
  },
  fabBadge: {
    backgroundColor: '#EF4444',
    borderRadius: 12,
    paddingHorizontal: 8,
    paddingVertical: 2,
    marginLeft: 2,
  },
  fabBadgeText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '800',
  },
});
