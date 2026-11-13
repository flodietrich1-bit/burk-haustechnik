import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  SafeAreaView,
  ActivityIndicator,
  Modal,
  Alert,
} from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { COLORS } from '../constants/theme';
import { APP_VERSION } from '../constants/version';
import { t, LANGUAGES } from '../locales/i18n';
import { parseInviteInput } from '../services/apiService';
import { activateDeviceWithInvite } from '../services/authService';

export default function ActivationScreen({ onActivationSuccess, currentLang = 'de', onSelectLang }) {
  const [codeDraft, setCodeDraft] = useState('');
  const [isActivating, setIsActivating] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [scannerVisible, setScannerVisible] = useState(false);
  const [scannedOnce, setScannedOnce] = useState(false);

  const [permission, requestPermission] = useCameraPermissions();

  const handleOpenScanner = async () => {
    setErrorMsg('');
    if (!permission?.granted) {
      const res = await requestPermission();
      if (!res?.granted) {
        Alert.alert(
          t('cameraPermissionTitle', currentLang),
          t('cameraPermissionMsg', currentLang),
          [{ text: t('ok', currentLang) }]
        );
        return;
      }
    }
    setScannedOnce(false);
    setScannerVisible(true);
  };

  const executeActivation = async ({ code, qrToken }) => {
    setIsActivating(true);
    setErrorMsg('');
    try {
      const result = await activateDeviceWithInvite({ code, qrToken });
      if (result.success && onActivationSuccess) {
        onActivationSuccess(result.monteur, result.projects, result.tenantId);
      }
    } catch (err) {
      console.warn('Activation error:', err);
      if (err.code === 'INVITE_RATE_LIMITED') {
        setErrorMsg(t('inviteRateLimited', currentLang));
      } else {
        setErrorMsg(t('inviteInvalid', currentLang));
      }
    } finally {
      setIsActivating(false);
    }
  };

  const handleBarcodeScanned = (scanningResult) => {
    if (scannedOnce || isActivating) return;
    const rawData = scanningResult?.data;
    if (!rawData) return;

    setScannedOnce(true);
    setScannerVisible(false);

    const { qrToken, code } = parseInviteInput(rawData);
    if (!qrToken && !code) {
      setErrorMsg(t('inviteInvalid', currentLang));
      return;
    }

    executeActivation({ code, qrToken });
  };

  const handleManualSubmit = () => {
    if (isActivating) return;
    const clean = codeDraft.trim().replace(/[^A-Za-z0-9]/g, '').toUpperCase();
    if (clean.length < 4) {
      setErrorMsg(t('inviteInvalid', currentLang));
      return;
    }
    executeActivation({ code: clean });
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.container}>
        {/* Language Switcher Bar */}
        <View style={styles.langBar}>
          {LANGUAGES.map((lang) => (
            <TouchableOpacity
              key={lang.code}
              style={[styles.langChip, currentLang === lang.code && styles.langChipActive]}
              onPress={() => onSelectLang && onSelectLang(lang.code)}
              activeOpacity={0.7}
            >
              <Text style={[styles.langText, currentLang === lang.code && styles.langTextActive]}>
                {lang.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Branding */}
        <View style={styles.topInfo}>
          <View style={styles.brandRow}>
            <Text style={styles.brandBold}>burk</Text>
            <Text style={styles.brandSmall}>Haustechnik</Text>
          </View>
          <Text style={styles.appTitle}>Materialtracker</Text>
        </View>

        {/* Title & Instructions */}
        <Text style={styles.title}>{t('activationTitle', currentLang)}</Text>
        <Text style={styles.subtitle}>{t('activationSubtitle', currentLang)}</Text>

        {/* Error Alert */}
        {errorMsg ? (
          <View style={styles.errorBox}>
            <Text style={styles.errorText}>⚠️ {errorMsg}</Text>
          </View>
        ) : null}

        {/* Primary Action: QR Code Scanner Button */}
        <TouchableOpacity
          style={styles.primaryScanBtn}
          onPress={handleOpenScanner}
          disabled={isActivating}
          activeOpacity={0.8}
        >
          <Text style={styles.primaryScanIcon}>📷</Text>
          <Text style={styles.primaryScanText}>{t('scanQrBtn', currentLang)}</Text>
        </TouchableOpacity>

        {/* Divider */}
        <View style={styles.dividerRow}>
          <View style={styles.dividerLine} />
          <Text style={styles.dividerText}>{t('orEnterCode', currentLang)}</Text>
          <View style={styles.dividerLine} />
        </View>

        {/* Manual Code Input */}
        <View style={styles.inputContainer}>
          <TextInput
            style={styles.codeInput}
            value={codeDraft}
            onChangeText={(text) => {
              setCodeDraft(text.toUpperCase());
              setErrorMsg('');
            }}
            placeholder={t('codePlaceholder', currentLang)}
            placeholderTextColor={COLORS.muted}
            autoCapitalize="characters"
            autoCorrect={false}
            editable={!isActivating}
            maxLength={10}
          />
          <TouchableOpacity
            style={[styles.activateBtn, (!codeDraft.trim() || isActivating) && styles.btnDisabled]}
            onPress={handleManualSubmit}
            disabled={!codeDraft.trim() || isActivating}
            activeOpacity={0.7}
          >
            {isActivating ? (
              <ActivityIndicator color={COLORS.ink} size="small" />
            ) : (
              <Text style={styles.activateBtnText}>{t('activateBtn', currentLang)}</Text>
            )}
          </TouchableOpacity>
        </View>

        {/* Footer info */}
        <Text style={styles.footerVersion}>
          {t('appVersionLabel', currentLang, { version: APP_VERSION })}
        </Text>
      </View>

      {/* QR Code Scanner Camera Modal */}
      <Modal
        visible={scannerVisible}
        animationType="slide"
        transparent={false}
        onRequestClose={() => setScannerVisible(false)}
      >
        <SafeAreaView style={styles.cameraContainer}>
          <CameraView
            style={StyleSheet.absoluteFillObject}
            facing="back"
            barcodeScannerSettings={{
              barcodeTypes: ['qr'],
            }}
            onBarcodeScanned={handleBarcodeScanned}
          />

          {/* Scanner Overlay UI */}
          <View style={styles.overlay}>
            <View style={styles.scannerHeader}>
              <Text style={styles.scannerTitle}>Burk Haustechnik</Text>
              <Text style={styles.scannerHint}>{t('scanHint', currentLang)}</Text>
            </View>

            {/* Target Reticle */}
            <View style={styles.reticleFrame}>
              <View style={[styles.corner, styles.topLeft]} />
              <View style={[styles.corner, styles.topRight]} />
              <View style={[styles.corner, styles.bottomLeft]} />
              <View style={[styles.corner, styles.bottomRight]} />
            </View>

            <TouchableOpacity
              style={styles.closeScannerBtn}
              onPress={() => setScannerVisible(false)}
              activeOpacity={0.8}
            >
              <Text style={styles.closeScannerText}>{t('scanClose', currentLang)}</Text>
            </TouchableOpacity>
          </View>
        </SafeAreaView>
      </Modal>

      {/* Activating Loading Screen */}
      {isActivating ? (
        <View style={styles.loadingOverlay}>
          <ActivityIndicator size="large" color={COLORS.amber} />
          <Text style={styles.loadingText}>{t('activating', currentLang)}</Text>
        </View>
      ) : null}
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
    paddingHorizontal: 24,
    justifyContent: 'center',
    alignItems: 'center',
  },
  langBar: {
    position: 'absolute',
    top: 16,
    flexDirection: 'row',
    gap: 8,
  },
  langChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    backgroundColor: '#E2E8F0',
  },
  langChipActive: {
    backgroundColor: COLORS.amber,
  },
  langText: {
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.inkSoft,
  },
  langTextActive: {
    color: COLORS.ink,
  },
  topInfo: {
    alignItems: 'center',
    marginBottom: 24,
  },
  brandRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 4,
  },
  brandBold: {
    fontSize: 34,
    fontWeight: '900',
    fontStyle: 'italic',
    color: COLORS.amber,
  },
  brandSmall: {
    fontSize: 11,
    letterSpacing: 1.5,
    color: COLORS.muted,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  appTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.inkSoft,
    marginTop: 2,
  },
  title: {
    fontSize: 24,
    fontWeight: '800',
    color: COLORS.ink,
    marginBottom: 8,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 14,
    color: COLORS.muted,
    textAlign: 'center',
    marginBottom: 28,
    lineHeight: 20,
    paddingHorizontal: 16,
  },
  errorBox: {
    backgroundColor: '#FEE2E2',
    borderWidth: 1,
    borderColor: '#F87171',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 10,
    marginBottom: 20,
    width: '100%',
  },
  errorText: {
    color: '#991B1B',
    fontSize: 13,
    fontWeight: '600',
    textAlign: 'center',
  },
  primaryScanBtn: {
    backgroundColor: COLORS.amber,
    width: '100%',
    paddingVertical: 18,
    borderRadius: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    shadowColor: COLORS.amber,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 4,
  },
  primaryScanIcon: {
    fontSize: 22,
  },
  primaryScanText: {
    fontSize: 17,
    fontWeight: '800',
    color: COLORS.ink,
  },
  dividerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 24,
    width: '100%',
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: '#CBD5E1',
  },
  dividerText: {
    paddingHorizontal: 12,
    fontSize: 12,
    fontWeight: '600',
    color: COLORS.muted,
    textTransform: 'uppercase',
  },
  inputContainer: {
    width: '100%',
    gap: 12,
  },
  codeInput: {
    backgroundColor: '#FFFFFF',
    borderWidth: 2,
    borderColor: '#CBD5E1',
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 18,
    fontWeight: '700',
    color: COLORS.ink,
    textAlign: 'center',
    letterSpacing: 2,
  },
  activateBtn: {
    backgroundColor: '#E2E8F0',
    paddingVertical: 15,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  activateBtnText: {
    fontSize: 15,
    fontWeight: '700',
    color: COLORS.ink,
  },
  btnDisabled: {
    opacity: 0.5,
  },
  footerVersion: {
    position: 'absolute',
    bottom: 20,
    fontSize: 11,
    color: COLORS.muted,
  },
  cameraContainer: {
    flex: 1,
    backgroundColor: '#000000',
  },
  overlay: {
    flex: 1,
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 40,
    paddingHorizontal: 20,
    backgroundColor: 'rgba(0,0,0,0.4)',
  },
  scannerHeader: {
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.6)',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 16,
  },
  scannerTitle: {
    color: COLORS.amber,
    fontSize: 18,
    fontWeight: '800',
  },
  scannerHint: {
    color: '#FFFFFF',
    fontSize: 13,
    marginTop: 4,
    textAlign: 'center',
  },
  reticleFrame: {
    width: 250,
    height: 250,
    position: 'relative',
  },
  corner: {
    position: 'absolute',
    width: 32,
    height: 32,
    borderColor: COLORS.amber,
  },
  topLeft: {
    top: 0,
    left: 0,
    borderTopWidth: 4,
    borderLeftWidth: 4,
  },
  topRight: {
    top: 0,
    right: 0,
    borderTopWidth: 4,
    borderRightWidth: 4,
  },
  bottomLeft: {
    bottom: 0,
    left: 0,
    borderBottomWidth: 4,
    borderLeftWidth: 4,
  },
  bottomRight: {
    bottom: 0,
    right: 0,
    borderBottomWidth: 4,
    borderRightWidth: 4,
  },
  closeScannerBtn: {
    backgroundColor: 'rgba(255,255,255,0.9)',
    paddingHorizontal: 28,
    paddingVertical: 14,
    borderRadius: 24,
  },
  closeScannerText: {
    color: COLORS.ink,
    fontSize: 15,
    fontWeight: '700',
  },
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(15, 23, 42, 0.75)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 14,
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '600',
  },
});
