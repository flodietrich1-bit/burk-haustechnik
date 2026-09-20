import React, { useState } from 'react';
import { View, Text, StyleSheet, Alert, SafeAreaView } from 'react-native';
import { COLORS } from '../constants/theme';
import { t } from '../locales/i18n';
import PinPad from '../components/PinPad';
import { verifyPin } from '../services/authService';

export default function PinLockScreen({ monteur, onUnlockSuccess, currentLang = 'de' }) {
  const [pin, setPin] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  const handleDigitPress = async (digit) => {
    if (pin.length >= 4) return;
    const nextPin = pin + digit;
    setPin(nextPin);
    setErrorMsg('');

    if (nextPin.length === 4) {
      const isValid = await verifyPin(nextPin);
      if (isValid) {
        setPin('');
        onUnlockSuccess();
      } else {
        setErrorMsg(t('pinWrong', currentLang));
        setTimeout(() => {
          setPin('');
        }, 500);
      }
    }
  };

  const handleDeletePress = () => {
    if (pin.length > 0) {
      setPin(pin.slice(0, -1));
      setErrorMsg('');
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.container}>
        {/* Header Branding */}
        <View style={styles.topInfo}>
          <View style={styles.brandRow}>
            <Text style={styles.brandBold}>burk</Text>
            <Text style={styles.brandSmall}>Haustechnik</Text>
          </View>
          <Text style={styles.appTitle}>Materialtracker</Text>
        </View>

        {/* User Card */}
        <View style={styles.userBadge}>
          <Text style={styles.userIcon}>👤</Text>
          <Text style={styles.userName}>{monteur?.name || t('monteur', currentLang)}</Text>
        </View>

        <Text style={styles.title}>{t('pinTitle', currentLang)}</Text>
        <Text style={styles.sub}>{t('pinSub', currentLang)}</Text>

        {errorMsg ? (
          <Text style={styles.errorText}>{errorMsg}</Text>
        ) : (
          <View style={styles.errorPlaceholder} />
        )}

        {/* Keypad */}
        <PinPad
          pin={pin}
          onDigitPress={handleDigitPress}
          onDeletePress={handleDeletePress}
        />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: COLORS.bg,
  },
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  topInfo: {
    alignItems: 'center',
    marginBottom: 20,
  },
  brandRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 4,
  },
  brandBold: {
    fontSize: 26,
    fontWeight: '900',
    fontStyle: 'italic',
    color: COLORS.amber,
  },
  brandSmall: {
    fontSize: 9,
    letterSpacing: 1.5,
    color: COLORS.muted,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  appTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: COLORS.inkSoft,
    marginTop: 2,
  },
  userBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: COLORS.line,
    gap: 8,
    marginBottom: 24,
  },
  userIcon: {
    fontSize: 16,
  },
  userName: {
    fontSize: 14,
    fontWeight: '700',
    color: COLORS.ink,
  },
  title: {
    fontSize: 22,
    fontWeight: '800',
    color: COLORS.ink,
    marginBottom: 6,
  },
  sub: {
    fontSize: 13,
    color: COLORS.muted,
    marginBottom: 16,
  },
  errorText: {
    color: COLORS.red,
    fontSize: 12.5,
    fontWeight: '600',
    height: 20,
    marginBottom: 10,
  },
  errorPlaceholder: {
    height: 20,
    marginBottom: 10,
  },
});
