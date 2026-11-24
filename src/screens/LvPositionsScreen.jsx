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
import { t } from '../locales/i18n';
import LvPositionCard from '../components/lv/LvPositionCard';
import LvUnplannedModal from '../components/lv/LvUnplannedModal';
import { isPositionHiddenForMonteur } from '../utils/projectMode';

export default function LvPositionsScreen({
  tradeName,
  positions = [],
  cart = [],
  currentLang = 'de',
  onBack,
  onOpenCart,
  onQuantityChange,
  onAddUnplannedItem,
}) {
  const [filterText, setFilterText] = useState('');
  const [isSliderDragging, setIsSliderDragging] = useState(false);
  const [unplannedModalVisible, setUnplannedModalVisible] = useState(false);

  // Filter positions for this trade and sort by sortOrder then displayCode
  const tradePositions = useMemo(() => {
    const list = positions.filter((p) => {
      if (isPositionHiddenForMonteur(p)) return false;
      const pTrade = p.tradeCategory || p.group || 'Allgemein';
      return pTrade.toLowerCase() === (tradeName || '').toLowerCase();
    });

    // Sort by sortOrder (asc) then displayCode (natural alphanumeric)
    list.sort((a, b) => {
      const orderA = typeof a.sortOrder === 'number' ? a.sortOrder : 999999;
      const orderB = typeof b.sortOrder === 'number' ? b.sortOrder : 999999;
      if (orderA !== orderB) return orderA - orderB;
      return String(a.displayCode || a.posNr || '').localeCompare(String(b.displayCode || b.posNr || ''), undefined, { numeric: true });
    });

    const q = filterText.trim().toLowerCase();
    if (!q) return list;

    return list.filter((p) => {
      const displayCode = String(p.displayCode || p.posNr || '').toLowerCase();
      const aliasTitle = String(p.aliasTitle || '').toLowerCase();
      const officialTitle = String(p.officialTitle || p.shortText || p.name || '').toLowerCase();
      const monteurInfo = String(p.monteurInfo || p.containsHint || p.notes || p.note || p.montagehinweis || p.hinweis || '').toLowerCase();
      return (
        displayCode.includes(q) ||
        aliasTitle.includes(q) ||
        officialTitle.includes(q) ||
        monteurInfo.includes(q)
      );
    });
  }, [positions, tradeName, filterText]);

  // Lookup cart quantity for a position
  const getCartQty = (pos) => {
    const item = cart.find(
      (it) => it.lvItemId === pos.id || (pos.displayCode && it.posNr === pos.displayCode)
    );
    return item ? Number(item.quantity) || 0 : 0;
  };

  const totalCartCount = useMemo(() => {
    return cart.reduce((acc, it) => acc + (Number(it.quantity) > 0 ? 1 : 0), 0);
  }, [cart]);

  return (
    <View style={styles.container}>
      {/* Sub Header / Bar with Back navigation & Search */}
      <View style={styles.headerBar}>
        <View style={styles.navRow}>
          <TouchableOpacity style={styles.backBtn} onPress={onBack} activeOpacity={0.7}>
            <Text style={styles.backBtnText}>{t('lvBackToTrades', currentLang)}</Text>
          </TouchableOpacity>
          <Text style={styles.countText}>
            {t('lvItemCount', currentLang, { count: tradePositions.length })}
          </Text>
        </View>

        <Text style={styles.tradeTitle} numberOfLines={2}>
          {tradeName}
        </Text>

        {/* Action Button: Außerplanmäßig verbaut */}
        {onAddUnplannedItem && (
          <TouchableOpacity
            style={styles.unplannedActionBtn}
            onPress={() => setUnplannedModalVisible(true)}
            activeOpacity={0.75}
          >
            <Text style={styles.unplannedActionText}>
              {t('btnUnplannedInstalled', currentLang)}
            </Text>
          </TouchableOpacity>
        )}

        {/* Filter Input */}
        <View style={styles.searchBar}>
          <Text style={styles.searchIcon}>🔍</Text>
          <TextInput
            style={styles.searchInput}
            value={filterText}
            onChangeText={setFilterText}
            placeholder={t('lvSearchInTrade', currentLang)}
            placeholderTextColor="#94A3B8"
            autoCapitalize="none"
            autoCorrect={false}
          />
          {filterText.length > 0 && (
            <TouchableOpacity onPress={() => setFilterText('')} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <Text style={styles.searchClear}>✕</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* Positions List */}
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
        scrollEnabled={!isSliderDragging}
      >
        {tradePositions.length === 0 ? (
          <View style={styles.emptyStateBox}>
            <Text style={styles.emptyStateIcon}>📋</Text>
            <Text style={styles.emptyStateText}>{t('lvNoPositionsFound', currentLang)}</Text>
          </View>
        ) : (
          tradePositions.map((pos) => (
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

      {/* Floating Action Button for Aufmaß vorbereiten */}
      <TouchableOpacity
        style={[styles.fab, totalCartCount > 0 && styles.fabActive]}
        onPress={onOpenCart}
        activeOpacity={0.8}
        hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
      >
        <Text style={styles.fabIcon}>📋</Text>
        <Text style={styles.fabText}>{t('lvPrepareMeasurementBtn', currentLang)}</Text>
        {totalCartCount > 0 && (
          <View style={styles.fabBadge}>
            <Text style={styles.fabBadgeText}>{totalCartCount}</Text>
          </View>
        )}
      </TouchableOpacity>

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
  headerBar: {
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  navRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  backBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F1F5F9',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
  },
  backBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#2563EB',
  },
  countText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#64748B',
  },
  tradeTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: '#0F172A',
    marginBottom: 10,
  },
  unplannedActionBtn: {
    backgroundColor: '#FFFBEB',
    borderWidth: 1.5,
    borderColor: '#F59E0B',
    borderRadius: 10,
    paddingVertical: 9,
    paddingHorizontal: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
  },
  unplannedActionText: {
    color: '#92400E',
    fontSize: 13,
    fontWeight: '800',
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F1F5F9',
    borderRadius: 10,
    paddingHorizontal: 12,
    height: 40,
  },
  searchIcon: {
    fontSize: 14,
    marginRight: 6,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
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
