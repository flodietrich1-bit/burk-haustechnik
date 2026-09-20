import React from 'react';
import { View, Text, ActivityIndicator, StyleSheet, Modal } from 'react-native';
import { COLORS } from '../constants/theme';
import ProgressBar from '../components/ProgressBar';

export default function SyncLoadingScreen({
  visible = false,
  statusText = 'Baustelle wird synchronisiert...',
  progress = 0.5,
}) {
  if (!visible) return null;

  return (
    <Modal visible={visible} transparent animationType="fade">
      <View style={styles.overlay}>
        <View style={styles.card}>
          <View style={styles.iconCircle}>
            <Text style={styles.syncIcon}>🔄</Text>
          </View>

          <Text style={styles.title}>Synchronisation läuft</Text>
          <Text style={styles.status}>{statusText}</Text>

          <View style={styles.progressWrap}>
            <ProgressBar progress={Math.round(progress * 100)} height={8} />
          </View>

          <View style={styles.spinnerRow}>
            <ActivityIndicator size="small" color={COLORS.amber} />
            <Text style={styles.hint}>Daten werden abgeglichen...</Text>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(28, 42, 59, 0.75)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  card: {
    width: '100%',
    maxWidth: 340,
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 24,
    alignItems: 'center',
    elevation: 8,
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowOffset: { width: 0, height: 4 },
    shadowRadius: 12,
  },
  iconCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: COLORS.lite,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  syncIcon: {
    fontSize: 28,
  },
  title: {
    fontSize: 18,
    fontWeight: '800',
    color: COLORS.ink,
    marginBottom: 6,
  },
  status: {
    fontSize: 13,
    color: COLORS.muted,
    textAlign: 'center',
    lineHeight: 18,
    marginBottom: 20,
    minHeight: 36,
  },
  progressWrap: {
    width: '100%',
    marginBottom: 16,
  },
  spinnerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  hint: {
    fontSize: 12,
    color: COLORS.inkSoft,
    fontWeight: '600',
  },
});
