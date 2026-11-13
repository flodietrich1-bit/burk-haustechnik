import React, { useState, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  SafeAreaView,
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  ScrollView,
  Platform,
} from 'react-native';
import { CameraView, useCameraPermissions, scanFromURLAsync } from 'expo-camera';
import * as ImagePicker from 'expo-image-picker';
import Svg, { Path } from 'react-native-svg';
import { COLORS } from '../constants/theme';
import { APP_VERSION } from '../constants/version';
import { t } from '../locales/i18n';
import { parseInviteInput, resetInstallationId } from '../services/apiService';
import { activateDeviceWithInvite } from '../services/authService';

/**
 * Clean vector camera silhouette icon
 */
function CameraSilhouetteIcon({ size = 22, color = '#FFFFFF' }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill={color}>
      <Path d="M4 7c-1.1 0-2 .9-2 2v10c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V9c0-1.1-.9-2-2-2h-3.17l-1.42-2.58A2 2 0 0 0 13.67 3h-3.34a2 2 0 0 0-1.74 1.42L7.17 7H4zm8 11.5A5.5 5.5 0 1 1 17.5 13 5.5 5.5 0 0 1 12 18.5zm0-9A3.5 3.5 0 1 0 15.5 13 3.5 3.5 0 0 0 12 9.5z" />
    </Svg>
  );
}

export default function ActivationScreen({ onActivationSuccess, currentLang = 'de' }) {
  const [codeDraft, setCodeDraft] = useState('');
  const [isActivating, setIsActivating] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [scannerVisible, setScannerVisible] = useState(false);
  const [scanWarning, setScanWarning] = useState('');

  // Synchronous lock to prevent duplicate frames from firing multiple activation requests
  const isScanningRef = useRef(false);

  const [permission, requestPermission] = useCameraPermissions();

  const handleOpenScanner = async () => {
    setErrorMsg('');
    setScanWarning('');
    isScanningRef.current = false;

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
      isScanningRef.current = false;
      if (err.code === 'INVITE_RATE_LIMITED') {
        setErrorMsg(t('inviteRateLimited', currentLang));
        await resetInstallationId();
      } else {
        setErrorMsg(t('inviteInvalid', currentLang));
      }
    } finally {
      setIsActivating(false);
    }
  };

  const handleBarcodeScanned = (scanningResult) => {
    if (isScanningRef.current || isActivating) return;
    const rawData = scanningResult?.data;
    if (!rawData) return;

    const { qrToken, code } = parseInviteInput(rawData);
    if (!qrToken && !code) {
      setScanWarning(t('scanInvalidQr', currentLang));
      return;
    }

    // Synchronous lock: prevent second/third frame from sending duplicate requests
    isScanningRef.current = true;
    setScanWarning('');
    setScannerVisible(false);
    executeActivation({ code, qrToken });
  };

  const handlePickFromGallery = async () => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: false,
        quality: 1,
      });

      if (result.canceled || !result.assets?.[0]?.uri) return;

      const imageUri = result.assets[0].uri;
      const scanned = await scanFromURLAsync(imageUri, ['qr']);
      if (scanned && scanned.length > 0 && scanned[0]?.data) {
        handleBarcodeScanned({ data: scanned[0].data });
      } else {
        Alert.alert(
          t('scanInvalidQr', currentLang),
          'In diesem Bild wurde kein Einladungs-QR-Code erkannt. Bitte das Foto der Einladungs-PDF prüfen oder den Code manuell eingeben.'
        );
      }
    } catch (err) {
      console.warn('Gallery scan error:', err);
    }
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

  // FULLSCREEN CAMERA SCANNER VIEW (Without Modal wrapper for 100% reliable iOS native camera preview)
  if (scannerVisible) {
    return (
      <View style={styles.scannerRoot}>
        <CameraView
          style={StyleSheet.absoluteFillObject}
          facing="back"
          barcodeScannerSettings={{
            barcodeTypes: ['qr'],
          }}
          onBarcodeScanned={handleBarcodeScanned}
          onMountError={(e) => {
            console.warn('Camera mount error:', e);
            Alert.alert('Kamera-Fehler', 'Kamera konnte nicht gestartet werden.');
            setScannerVisible(false);
          }}
        />

        <SafeAreaView style={styles.scannerOverlay}>
          {/* Top Navigation Row */}
          <View style={styles.scannerTopRow}>
            <TouchableOpacity
              style={styles.scannerBackBtn}
              onPress={() => {
                isScanningRef.current = false;
                setScannerVisible(false);
              }}
              activeOpacity={0.7}
            >
              <Text style={styles.scannerBackText}>✕ Schließen</Text>
            </TouchableOpacity>
            <View style={styles.scannerTitlePill}>
              <Text style={styles.scannerTitleText}>Burk Haustechnik</Text>
            </View>
            <View style={{ width: 80 }} />
          </View>

          {/* Status Hint or Warning Banner */}
          {scanWarning ? (
            <View style={styles.scanWarningBox}>
              <Text style={styles.scanWarningText}>⚠️ {scanWarning}</Text>
            </View>
          ) : (
            <View style={styles.scanHintBox}>
              <Text style={styles.scanHintText}>{t('scanHint', currentLang)}</Text>
            </View>
          )}

          {/* Central Reticle */}
          <View style={styles.reticleFrame}>
            <View style={[styles.corner, styles.topLeft]} />
            <View style={[styles.corner, styles.topRight]} />
            <View style={[styles.corner, styles.bottomLeft]} />
            <View style={[styles.corner, styles.bottomRight]} />
          </View>

          {/* Bottom Actions */}
          <View style={styles.scannerBottomRow}>
            <TouchableOpacity
              style={styles.scannerActionBtn}
              onPress={handlePickFromGallery}
              activeOpacity={0.8}
            >
              <Text style={styles.scannerActionBtnText}>🖼️ Aus Fotos wählen</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.scannerActionBtn, styles.scannerActionBtnPrimary]}
              onPress={() => {
                isScanningRef.current = false;
                setScannerVisible(false);
              }}
              activeOpacity={0.8}
            >
              <Text style={styles.scannerActionBtnPrimaryText}>Code manuell eingeben</Text>
            </TouchableOpacity>
          </View>
        </SafeAreaView>

        {isActivating ? (
          <View style={styles.loadingOverlay}>
            <ActivityIndicator size="large" color="#FFFFFF" />
            <Text style={styles.loadingTextWhite}>{t('activating', currentLang)}</Text>
          </View>
        ) : null}
      </View>
    );
  }

  // STANDARD ACTIVATION SCREEN
  return (
    <SafeAreaView style={styles.safeArea}>
      <KeyboardAvoidingView
        style={styles.keyboardAvoid}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 12 : 0}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          bounces={false}
        >
          {/* Burk Branding */}
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

          {/* Error Alert with manual retry */}
          {errorMsg ? (
            <View style={styles.errorBox}>
              <Text style={styles.errorText}>⚠️ {errorMsg}</Text>
              <TouchableOpacity
                style={styles.retryBtn}
                onPress={() => {
                  setErrorMsg('');
                  resetInstallationId();
                }}
                activeOpacity={0.7}
              >
                <Text style={styles.retryBtnText}>Entsperren / Erneut versuchen</Text>
              </TouchableOpacity>
            </View>
          ) : null}

          {/* Primary Action: QR Code Scanner Button */}
          <TouchableOpacity
            style={styles.primaryScanBtn}
            onPress={handleOpenScanner}
            disabled={isActivating}
            activeOpacity={0.85}
          >
            <CameraSilhouetteIcon size={22} color="#FFFFFF" />
            <Text style={styles.primaryScanText}>{t('scanQrBtn', currentLang)}</Text>
          </TouchableOpacity>

          {/* Divider */}
          <View style={styles.dividerRow}>
            <View style={styles.dividerLine} />
            <Text style={styles.dividerText}>{t('orEnterCode', currentLang)}</Text>
            <View style={styles.dividerLine} />
          </View>

          {/* Manual Code Input - Formatted for 6-char short codes */}
          <View style={styles.inputContainer}>
            <TextInput
              style={styles.codeInput}
              value={codeDraft}
              onChangeText={(text) => {
                let formatted = text.toUpperCase().replace(/[^A-Z0-9]/g, '');
                if (formatted.length > 2) {
                  formatted = `${formatted.slice(0, 2)}-${formatted.slice(2, 6)}`;
                }
                setCodeDraft(formatted);
                setErrorMsg('');
              }}
              placeholder="z. B. YC-89MN"
              placeholderTextColor={COLORS.muted}
              autoCapitalize="characters"
              autoCorrect={false}
              editable={!isActivating}
              maxLength={7}
            />
            <TouchableOpacity
              style={[styles.activateBtn, (!codeDraft.trim() || isActivating) && styles.btnDisabled]}
              onPress={handleManualSubmit}
              disabled={!codeDraft.trim() || isActivating}
              activeOpacity={0.75}
            >
              {isActivating ? (
                <ActivityIndicator color="#FFFFFF" size="small" />
              ) : (
                <Text style={styles.activateBtnText}>{t('activateBtn', currentLang)}</Text>
              )}
            </TouchableOpacity>
          </View>

          {/* Footer info */}
          <View style={styles.footerContainer}>
            <Text style={styles.footerVersion}>
              {t('appVersionLabel', currentLang, { version: APP_VERSION })}
            </Text>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>

      {/* Activating Loading Screen */}
      {isActivating ? (
        <View style={styles.loadingOverlay}>
          <ActivityIndicator size="large" color={COLORS.primary} />
          <Text style={styles.loadingText}>{t('activating', currentLang)}</Text>
        </View>
      ) : null}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  keyboardAvoid: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: 24,
    paddingTop: 36,
    paddingBottom: 24,
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
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
    fontSize: 34,
    fontWeight: '900',
    fontStyle: 'italic',
    color: COLORS.primary,
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
    marginBottom: 24,
    lineHeight: 20,
    paddingHorizontal: 16,
  },
  errorBox: {
    backgroundColor: '#FEE2E2',
    borderWidth: 1,
    borderColor: '#F87171',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    marginBottom: 16,
    width: '100%',
    alignItems: 'center',
    gap: 8,
  },
  errorText: {
    color: '#991B1B',
    fontSize: 13,
    fontWeight: '600',
    textAlign: 'center',
  },
  retryBtn: {
    backgroundColor: '#DC2626',
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 8,
  },
  retryBtnText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
  },
  primaryScanBtn: {
    backgroundColor: COLORS.primary,
    width: '100%',
    paddingVertical: 16,
    borderRadius: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    shadowColor: COLORS.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 3,
  },
  primaryScanText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  dividerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 20,
    width: '100%',
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: '#E2E8F0',
  },
  dividerText: {
    paddingHorizontal: 12,
    fontSize: 11,
    fontWeight: '700',
    color: COLORS.muted,
    letterSpacing: 0.5,
  },
  inputContainer: {
    width: '100%',
    gap: 12,
  },
  codeInput: {
    backgroundColor: '#F8FAFC',
    borderWidth: 1.5,
    borderColor: '#CBD5E1',
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 20,
    fontWeight: '800',
    color: COLORS.ink,
    textAlign: 'center',
    letterSpacing: 3,
  },
  activateBtn: {
    backgroundColor: COLORS.ink,
    paddingVertical: 15,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  activateBtnText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  btnDisabled: {
    opacity: 0.4,
  },
  footerContainer: {
    marginTop: 32,
    paddingBottom: 8,
    alignItems: 'center',
  },
  footerVersion: {
    fontSize: 11,
    color: COLORS.muted,
  },

  // SCANNER VIEW STYLES
  scannerRoot: {
    flex: 1,
    backgroundColor: '#000000',
  },
  scannerOverlay: {
    flex: 1,
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 20,
    paddingHorizontal: 20,
    backgroundColor: 'rgba(0,0,0,0.35)',
  },
  scannerTopRow: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  scannerBackBtn: {
    backgroundColor: 'rgba(0,0,0,0.6)',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.3)',
  },
  scannerBackText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
  scannerTitlePill: {
    backgroundColor: 'rgba(0,0,0,0.6)',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 16,
  },
  scannerTitleText: {
    color: '#60A5FA',
    fontSize: 14,
    fontWeight: '800',
  },
  scanHintBox: {
    backgroundColor: 'rgba(0,0,0,0.7)',
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 14,
    maxWidth: '85%',
  },
  scanHintText: {
    color: '#FFFFFF',
    fontSize: 13,
    textAlign: 'center',
    fontWeight: '500',
  },
  scanWarningBox: {
    backgroundColor: '#991B1B',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 12,
    maxWidth: '90%',
  },
  scanWarningText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
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
    borderColor: '#60A5FA',
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
  scannerBottomRow: {
    width: '100%',
    gap: 12,
    alignItems: 'center',
  },
  scannerActionBtn: {
    backgroundColor: 'rgba(255,255,255,0.25)',
    width: '100%',
    paddingVertical: 14,
    borderRadius: 14,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.4)',
  },
  scannerActionBtnText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
  },
  scannerActionBtnPrimary: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
  },
  scannerActionBtnPrimaryText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
  },
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.8)',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 16,
  },
  loadingText: {
    fontSize: 16,
    fontWeight: '700',
    color: COLORS.ink,
  },
  loadingTextWhite: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFFFFF',
  },
});
