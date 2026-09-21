import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, Alert, SafeAreaView, ActivityIndicator } from 'react-native';
import { COLORS } from '../constants/theme';
import { t } from '../locales/i18n';
import PinPad from '../components/PinPad';
import {
  authenticateByPin,
  getPinLockoutStatus,
} from '../services/authService';

export default function PinLockScreen({ onUnlockSuccess, currentLang = 'de' }) {
  const [pin, setPin] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [isVerifying, setIsVerifying] = useState(false);
  const [lockout, setLockout] = useState({ isLocked: false, remainingMinutes: 0 });

  // Check lockout status on mount and keep countdown accurate
  useEffect(() => {
    let intervalId;

    async function checkStatus() {
      const status = await getPinLockoutStatus();
      setLockout(status);
      if (status.isLocked) {
        setErrorMsg(t('pinLockedMsg', currentLang, { mins: status.remainingMinutes }));
      }
    }

    checkStatus();
    intervalId = setInterval(checkStatus, 10000); // update every 10s

    return () => clearInterval(intervalId);
  }, [currentLang]);

  const handleDigitPress = async (digit) => {
    if (lockout.isLocked || isVerifying || pin.length >= 4) return;
    const nextPin = pin + digit;
    setPin(nextPin);
    setErrorMsg('');

    if (nextPin.length === 4) {
      setIsVerifying(true);
      try {
        const result = await authenticateByPin(nextPin);

        if (result.success) {
          setPin('');
          setErrorMsg('');
          if (onUnlockSuccess) {
            onUnlockSuccess(result.monteur, result.projects);
          }
        } else if (result.reason === 'locked') {
          setLockout({ isLocked: true, remainingMinutes: result.remainingMinutes || 30 });
          setErrorMsg(t('pinLockedMsg', currentLang, { mins: result.remainingMinutes || 30 }));
          setPin('');
        } else {
          // Wrong PIN
          const attemptsLeft = Math.max(0, 3 - (result.failedAttempts || 1));
          setErrorMsg(
            attemptsLeft > 0
              ? t('pinWrongAttempts', currentLang, { n: attemptsLeft })
              : t('pinLockedMsg', currentLang, { mins: 30 })
          );
          setTimeout(() => {
            setPin('');
          }, 400);
        }
      } catch (e) {
        setErrorMsg(t('pinWrong', currentLang));
        setTimeout(() => setPin(''), 400);
      } finally {
        setIsVerifying(false);
      }
    }
  };

  const handleDeletePress = () => {
    if (lockout.isLocked || isVerifying) return;
    if (pin.length > 0) {
      setPin(pin.slice(0, -1));
      setErrorMsg('');
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.container}>
        {/* Top Branding (Neutral - no user name displayed) */}
        <View style={styles.topInfo}>
          <View style={styles.brandRow}>
            <Text style={styles.brandBold}>burk</Text>
            <Text style={styles.brandSmall}>Haustechnik</Text>
          </View>
          <Text style={styles.appTitle}>Materialtracker</Text>
        </View>

        {/* Title & Instructions */}
        <Text style={styles.title}>{t('pinTitle', currentLang)}</Text>
        <Text style={styles.sub}>{t('pinSub', currentLang)}</Text>

        {/* Lockout Banner or Error State */}
        {lockout.isLocked ? (
          <View style={styles.lockoutBox}>
            <Text style={styles.lockoutIcon}>🔒</Text>
            <Text style={styles.lockoutTitle}>{t('pinLockedTitle', currentLang)}</Text>
            <Text style={styles.lockoutText}>
              {t('pinLockedMsg', currentLang, { mins: lockout.remainingMinutes })}
            </Text>
          </View>
        ) : errorMsg ? (
          <View style={styles.errorBox}>
            <Text style={styles.errorText}>{errorMsg}</Text>
          </View>
        ) : (
          <View style={styles.placeholderBox} />
        )}

        {/* Keypad or Loading */}
        {isVerifying ? (
          <View style={styles.loadingBox}>
            <ActivityIndicator size="large" color={COLORS.amber} />
            <Text style={styles.loadingText}>{t('syncDownloading', currentLang)}</Text>
          </View>
        ) : (
          <View style={lockout.isLocked ? styles.disabledPad : null}>
            <PinPad
              pin={pin}
              onDigitPress={handleDigitPress}
              onDeletePress={handleDeletePress}
              disabled={lockout.isLocked}
            />
          </View>
        )}
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
    marginBottom: 28,
  },
  brandRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 4,
  },
  brandBold: {
    fontSize: 32,
    fontWeight: '900',
    fontStyle: 'italic',
    color: COLORS.amber,
  },
  brandSmall: {
    fontSize: 10,
    letterSpacing: 1.5,
    color: COLORS.muted,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  appTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.inkSoft,
    marginTop: 3,
  },
  title: {
    fontSize: 24,
    fontWeight: '800',
    color: COLORS.ink,
    marginBottom: 6,
  },
  sub: {
    fontSize: 13.5,
    color: COLORS.muted,
    marginBottom: 20,
    textAlign: 'center',
  },
  placeholderBox: {
    height: 60,
    marginBottom: 8,
  },
  errorBox: {
    minHeight: 60,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
    paddingHorizontal: 16,
  },
  errorText: {
    color: COLORS.red,
    fontSize: 13.5,
    fontWeight: '700',
    textAlign: 'center',
  },
  lockoutBox: {
    backgroundColor: '#FEE2E2',
    borderWidth: 1.5,
    borderColor: '#FCA5A5',
    borderRadius: 14,
    paddingVertical: 14,
    paddingHorizontal: 18,
    alignItems: 'center',
    marginBottom: 16,
    maxWidth: 320,
  },
  lockoutIcon: {
    fontSize: 26,
    marginBottom: 4,
  },
  lockoutTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: '#991B1B',
    marginBottom: 4,
  },
  lockoutText: {
    fontSize: 12.5,
    color: '#7F1D1D',
    textAlign: 'center',
    lineHeight: 18,
  },
  loadingBox: {
    height: 280,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 12,
  },
  loadingText: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.inkSoft,
  },
  disabledPad: {
    opacity: 0.35,
    pointerEvents: 'none',
  },
});
