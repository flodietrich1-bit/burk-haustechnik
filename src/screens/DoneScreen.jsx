import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView } from 'react-native';
import { COLORS } from '../constants/theme';
import { t } from '../locales/i18n';

export default function DoneScreen({
  room,
  summaryItems = [],
  photoCount = 0,
  onBackToRooms,
  currentLang = 'de',
}) {
  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* Check Icon */}
      <View style={styles.checkCircle}>
        <Text style={styles.checkIcon}>✓</Text>
      </View>

      <Text style={styles.title}>{t('doneTitle', currentLang)}</Text>
      <Text style={styles.sub}>
        {room?.name} · {photoCount} {photoCount === 1 ? 'Foto' : 'Fotos'}
      </Text>
      <Text style={styles.hint}>{t('doneSub', currentLang)}</Text>

      {/* Summary Card */}
      <View style={styles.summaryCard}>
        {summaryItems.length > 0 ? (
          summaryItems.map((item, index) => (
            <View key={index} style={styles.summaryRow}>
              <Text style={styles.rowName} numberOfLines={2}>
                {item.name}
              </Text>
              <Text style={styles.rowQty}>
                +{item.quantity} {item.qu}
              </Text>
            </View>
          ))
        ) : (
          <View style={styles.summaryRow}>
            <Text style={styles.rowName}>Keine Materialmengen (nur Beleg)</Text>
            <Text style={styles.rowQty}>-</Text>
          </View>
        )}
      </View>

      {/* Button */}
      <TouchableOpacity style={styles.primaryButton} onPress={onBackToRooms} activeOpacity={0.8}>
        <Text style={styles.primaryText}>{t('backToRooms', currentLang)}</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.bg,
  },
  content: {
    padding: 24,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: '100%',
  },
  checkCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: COLORS.greenBg,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  checkIcon: {
    fontSize: 36,
    color: COLORS.green,
    fontWeight: 'bold',
  },
  title: {
    fontSize: 22,
    fontWeight: '800',
    color: COLORS.ink,
    marginBottom: 6,
    textAlign: 'center',
  },
  sub: {
    fontSize: 14,
    fontWeight: '700',
    color: COLORS.amberDark,
    marginBottom: 4,
    textAlign: 'center',
  },
  hint: {
    fontSize: 12.5,
    color: COLORS.muted,
    textAlign: 'center',
    lineHeight: 18,
    marginBottom: 24,
    paddingHorizontal: 12,
  },
  summaryCard: {
    width: '100%',
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: COLORS.line,
    padding: 14,
    marginBottom: 24,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 9,
    borderBottomWidth: 1,
    borderBottomColor: '#EEF2F6',
    gap: 12,
  },
  rowName: {
    flex: 1,
    fontSize: 13.5,
    color: COLORS.ink,
    fontWeight: '600',
  },
  rowQty: {
    fontSize: 14,
    fontWeight: '800',
    color: COLORS.green,
    whiteSpace: 'nowrap',
  },
  primaryButton: {
    width: '100%',
    backgroundColor: COLORS.amber,
    borderRadius: 14,
    paddingVertical: 15,
    alignItems: 'center',
  },
  primaryText: {
    color: '#FFFFFF',
    fontWeight: '800',
    fontSize: 16,
  },
});
