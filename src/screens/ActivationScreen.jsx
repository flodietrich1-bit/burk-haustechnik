import React, { useState, useRef, useEffect } from 'react';
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
  Image,
  Linking,
} from 'react-native';
import { CameraView, useCameraPermissions, scanFromURLAsync } from 'expo-camera';
import * as ImagePicker from 'expo-image-picker';
import Svg, { Path, SvgUri } from 'react-native-svg';
import { COLORS } from '../constants/theme';
import { APP_VERSION } from '../constants/version';
import { t, LANGUAGES } from '../locales/i18n';
import { parseInviteInput, resetInstallationId } from '../services/apiService';
import { activateDeviceWithInvite, activateDemoAccount, loadTenantBranding, getTenantId } from '../services/authService';
import P12AufmassLogo from '../components/P12AufmassLogo';

const BARCODE_SCANNER_SETTINGS = {
  barcodeTypes: ['qr'],
};

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

/**
 * Clean vector back chevron icon
 */
function ChevronLeftIcon({ size = 16, color = COLORS.ink }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M15 19l-7-7 7-7"
        stroke={color}
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

export default function ActivationScreen({
  onActivationSuccess,
  currentLang = 'de',
  onSelectLang,
  branding = null,
}) {
  // Mode: 'choice' (initial 2-button screen) | 'manual' (dedicated full code input screen)
  const [inputMode, setInputMode] = useState('choice');

  const [codeDraft, setCodeDraft] = useState('');
  const [manualPassword, setManualPassword] = useState('');
  const [showManualPassword, setShowManualPassword] = useState(false);
  const [isActivating, setIsActivating] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [scannerVisible, setScannerVisible] = useState(false);
  const [scanWarning, setScanWarning] = useState('');
  const [cameraReady, setCameraReady] = useState(false);

  // Tenant branding & fallback handling
  const [tenantBranding, setTenantBranding] = useState(branding || null);
  const [logoLoadFailed, setLogoLoadFailed] = useState(false);

  // Password Setup Step state
  const [pendingTarget, setPendingTarget] = useState(null); // { code, qrToken }
  const [isSettingPassword, setIsSettingPassword] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordError, setPasswordError] = useState('');

  // Synchronous lock to prevent duplicate frames from firing multiple activation requests
  const isScanningRef = useRef(false);

  const [permission, requestPermission] = useCameraPermissions();

  useEffect(() => {
    if (branding) {
      setTenantBranding(branding);
      return;
    }
    // Attempt loading branding for saved tenant or fallback
    getTenantId().then(async (tId) => {
      const targetTenant = tId || 'burk-haustechnik';
      try {
        const brand = await loadTenantBranding(targetTenant);
        if (brand) setTenantBranding(brand);
      } catch {}
    });
  }, [branding]);

  useEffect(() => {
    if (
      Platform.OS === 'web' ||
      !CameraView.isModernBarcodeScannerAvailable ||
      typeof CameraView.onModernBarcodeScanned !== 'function'
    ) {
      return undefined;
    }

    const subscription = CameraView.onModernBarcodeScanned(async (scanningResult) => {
      if (isScanningRef.current || isActivating) return;
      const rawData = scanningResult?.data;
      if (!rawData) return;

      const { qrToken, code } = parseInviteInput(rawData);
      if (!qrToken && !code) {
        return;
      }

      isScanningRef.current = true;
      try {
        await CameraView.dismissScanner();
      } catch (err) {
        console.warn('Dismiss native scanner warning:', err);
      }
      setScanWarning('');
      setScannerVisible(false);
      handleRecognizedInvite({ code, qrToken });
    });

    return () => {
      subscription?.remove?.();
    };
  }, [isActivating]);

  const handleOpenScanner = async () => {
    setErrorMsg('');
    setScanWarning('');
    isScanningRef.current = false;

    let hasPerm = permission?.granted;
    if (!hasPerm) {
      const res = await requestPermission();
      hasPerm = !!res?.granted;
      if (!hasPerm) {
        Alert.alert(
          t('cameraPermissionTitle', currentLang),
          t('cameraPermissionMsg', currentLang),
          [{ text: t('ok', currentLang) }]
        );
        return;
      }
      await new Promise((resolve) => setTimeout(resolve, 150));
    }

    // Prefer native system barcode scanner (VisionKit DataScannerViewController on iOS 16+ / Google Code Scanner on Android)
    if (Platform.OS !== 'web' && CameraView.isModernBarcodeScannerAvailable) {
      try {
        await CameraView.launchScanner({
          barcodeTypes: ['qr'],
          isHighlightingEnabled: true,
          isGuidanceEnabled: true,
          isPinchToZoomEnabled: true,
        });
        return;
      } catch (err) {
        console.warn('Native scanner fallback to CameraView:', err);
      }
    }

    setCameraReady(false);
    setScannerVisible(true);
  };

  const executeActivation = async ({ code, qrToken, password }) => {
    setIsActivating(true);
    setErrorMsg('');
    const rawCode = (code || '').trim();
    const cleanCode = rawCode.replace(/[^A-Za-z0-9]/g, '').toUpperCase();
    const passTrim = (password || '').trim();

    // Check if this is the Apple Reviewer or Joker code
    const isJoker =
      cleanCode === 'M62N94' ||
      cleanCode === 'DEMO' ||
      cleanCode === 'DEMO2026' ||
      cleanCode === 'APPLE' ||
      cleanCode === 'REVIEW' ||
      cleanCode === 'P12' ||
      passTrim === 'see_attached_pdf' ||
      passTrim === 'Demo2026!' ||
      passTrim === 'Start1234!';

    try {
      let result = null;
      try {
        result = await activateDeviceWithInvite({ code: rawCode, qrToken, password: passTrim });
      } catch (backendErr) {
        if (isJoker) {
          console.log('Joker / Demo fallback triggered for review account');
          result = await activateDemoAccount(passTrim || 'demo');
        } else {
          throw backendErr;
        }
      }

      if (result?.success && onActivationSuccess) {
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
      setIsSettingPassword(false);
      setPendingTarget(null);
    } finally {
      setIsActivating(false);
    }
  };

  const handleRecognizedInvite = ({ code, qrToken }) => {
    setPendingTarget({ code, qrToken });
    setIsSettingPassword(true);
    setNewPassword('');
    setConfirmPassword('');
    setPasswordError('');
  };

  const handleFinalizeWithPassword = async () => {
    if (!newPassword || newPassword.trim().length < 4) {
      setPasswordError(t('passwordTooShort', currentLang));
      return;
    }
    if (newPassword !== confirmPassword) {
      setPasswordError(t('passwordMismatch', currentLang));
      return;
    }
    if (!pendingTarget) return;

    await executeActivation({
      code: pendingTarget.code,
      qrToken: pendingTarget.qrToken,
      password: newPassword.trim(),
    });
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
    handleRecognizedInvite({ code, qrToken });
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

  const handleTakePhotoScan = async () => {
    try {
      setScannerVisible(false);
      const perm = await ImagePicker.requestCameraPermissionsAsync();
      if (perm.status !== 'granted') {
        Alert.alert(
          t('cameraPermissionTitle', currentLang),
          t('cameraPermissionMsg', currentLang),
          [{ text: t('ok', currentLang) }]
        );
        return;
      }
      const result = await ImagePicker.launchCameraAsync({ allowsEditing: false, quality: 1 });
      if (result.canceled || !result.assets?.[0]?.uri) return;
      const scanned = await scanFromURLAsync(result.assets[0].uri, ['qr']);
      if (scanned && scanned.length > 0 && scanned[0]?.data) {
        handleBarcodeScanned({ data: scanned[0].data });
      } else {
        Alert.alert(
          t('scanInvalidQr', currentLang),
          'Auf dem Foto wurde kein Einladungs-QR-Code erkannt. Bitte näher herangehen oder den Code manuell eingeben.'
        );
      }
    } catch (err) {
      console.warn('Photo scan error:', err);
    }
  };

  const handleManualSubmit = async () => {
    if (isActivating) return;
    const rawCode = codeDraft.trim();
    const clean = rawCode.replace(/[^A-Za-z0-9]/g, '').toUpperCase();
    if (clean.length < 3) {
      setErrorMsg(t('credentialsRequired', currentLang));
      return;
    }
    if (!manualPassword.trim()) {
      setErrorMsg(t('credentialsRequired', currentLang));
      return;
    }
    await executeActivation({
      code: rawCode.toUpperCase(),
      password: manualPassword.trim(),
    });
  };

  // Render Burk logo from admin panel if present; otherwise fallback to P12 Aufmaß logo
  const renderLogo = (isSmall = false) => {
    const hasCustomLogo = tenantBranding?.logoUrl && !logoLoadFailed;
    const isSvg =
      tenantBranding?.logoMimeType?.includes('svg') ||
      /\.svg(?:\?|$)/i.test(tenantBranding?.logoUrl || '');

    if (hasCustomLogo) {
      if (isSvg) {
        return (
          <View style={[styles.customLogoWrapper, { transform: [{ scale: tenantBranding.logoZoom || 1 }] }]}>
            <SvgUri
              width={isSmall ? 150 : 190}
              height={isSmall ? 44 : 54}
              uri={tenantBranding.logoUrl}
              onError={() => setLogoLoadFailed(true)}
            />
          </View>
        );
      }
      return (
        <Image
          source={{ uri: tenantBranding.logoUrl }}
          style={[
            isSmall ? styles.logoImageSmall : styles.logoImage,
            { transform: [{ scale: tenantBranding.logoZoom || 1 }] },
          ]}
          resizeMode="contain"
          onError={() => setLogoLoadFailed(true)}
        />
      );
    }

    // Default Fallback: P12 Aufmaß official vector logo
    return (
      <View style={styles.p12LogoContainer}>
        <P12AufmassLogo width={isSmall ? 180 : 225} />
      </View>
    );
  };

  // FULLSCREEN CAMERA SCANNER VIEW
  if (scannerVisible) {
    return (
      <View style={styles.scannerRoot}>
        <CameraView
          style={styles.cameraPreview}
          facing="back"
          mode="picture"
          active={scannerVisible}
          barcodeScannerSettings={BARCODE_SCANNER_SETTINGS}
          onCameraReady={() => setCameraReady(true)}
          onBarcodeScanned={handleBarcodeScanned}
          onMountError={(e) => {
            console.warn('Camera mount error:', e);
            Alert.alert('Kamera-Fehler', 'Kamera konnte nicht gestartet werden.');
            setCameraReady(false);
            setScannerVisible(false);
          }}
        />

        <SafeAreaView style={styles.scannerOverlay} pointerEvents="box-none">
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

          {/* Prominent Direct Manual Login Button under viewfinder */}
          <TouchableOpacity
            style={styles.reticleManualBtn}
            onPress={() => {
              isScanningRef.current = false;
              setScannerVisible(false);
              setInputMode('manual');
            }}
            activeOpacity={0.85}
          >
            <Text style={styles.reticleManualBtnIcon}>⌨️</Text>
            <Text style={styles.reticleManualBtnText}>
              {t('manualLoginBtn', currentLang)}
            </Text>
          </TouchableOpacity>

          {/* Bottom Actions */}
          <View style={styles.scannerBottomRow}>
            <TouchableOpacity
              style={styles.scannerActionBtn}
              onPress={handleTakePhotoScan}
              activeOpacity={0.8}
            >
              <Text style={styles.scannerActionBtnText}>📸 Foto aufnehmen &amp; scannen</Text>
            </TouchableOpacity>

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
                setInputMode('manual');
              }}
              activeOpacity={0.8}
            >
              <Text style={styles.scannerActionBtnPrimaryText}>
                {t('enterCredentialsManuallyBtn', currentLang)}
              </Text>
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

  // PASSWORD SETUP STEP FOR NEW MONTEUR ACTIVATION
  if (isSettingPassword && pendingTarget) {
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
          >
            {/* Branding */}
            <View style={styles.logoBoxManual}>
              {renderLogo(true)}
            </View>

            {/* Title & Instructions */}
            <Text style={styles.title}>{t('setupPasswordTitle', currentLang)}</Text>
            <Text style={styles.subtitle}>
              {t('setupPasswordSubtitle', currentLang)}
            </Text>

            {passwordError ? (
              <View style={styles.errorBox}>
                <Text style={styles.errorText}>⚠️ {passwordError}</Text>
              </View>
            ) : null}

            <View style={styles.inputContainer}>
              <TextInput
                style={styles.passwordInput}
                placeholder={t('passwordPlaceholder', currentLang)}
                placeholderTextColor={COLORS.muted}
                secureTextEntry
                value={newPassword}
                onChangeText={(text) => {
                  setNewPassword(text);
                  setPasswordError('');
                }}
                autoCapitalize="none"
                editable={!isActivating}
              />
              <TextInput
                style={styles.passwordInput}
                placeholder={t('passwordConfirmPlaceholder', currentLang)}
                placeholderTextColor={COLORS.muted}
                secureTextEntry
                value={confirmPassword}
                onChangeText={(text) => {
                  setConfirmPassword(text);
                  setPasswordError('');
                }}
                autoCapitalize="none"
                editable={!isActivating}
              />

              <TouchableOpacity
                style={[
                  styles.primaryScanBtn,
                  (!newPassword || !confirmPassword || isActivating) && styles.btnDisabled,
                ]}
                onPress={handleFinalizeWithPassword}
                disabled={!newPassword || !confirmPassword || isActivating}
                activeOpacity={0.8}
              >
                {isActivating ? (
                  <ActivityIndicator color="#FFFFFF" size="small" />
                ) : (
                  <Text style={styles.primaryScanText}>
                    {t('savePasswordAndContinue', currentLang)}
                  </Text>
                )}
              </TouchableOpacity>

              <TouchableOpacity
                style={{ marginTop: 16, alignItems: 'center', paddingVertical: 10 }}
                onPress={() => {
                  setIsSettingPassword(false);
                  setPendingTarget(null);
                  isScanningRef.current = false;
                }}
                activeOpacity={0.7}
              >
                <Text style={{ color: COLORS.muted, fontSize: 14, fontWeight: '600' }}>
                  ‹ {t('cancel', currentLang)}
                </Text>
              </TouchableOpacity>
            </View>

            <View style={styles.footerContainer}>
              <Text style={styles.footerVersion}>
                {t('appVersionLabel', currentLang, { version: APP_VERSION })}
              </Text>
            </View>
          </ScrollView>
        </KeyboardAvoidingView>

        {isActivating ? (
          <View style={styles.loadingOverlay}>
            <ActivityIndicator size="large" color={COLORS.primary} />
            <Text style={styles.loadingText}>{t('activating', currentLang)}</Text>
          </View>
        ) : null}
      </SafeAreaView>
    );
  }

  // ---------------------------------------------------------
  // MAIN ACTIVATION SCREEN: CHOICE MODE vs MANUAL INPUT MODE
  // ---------------------------------------------------------
  return (
    <SafeAreaView style={styles.safeArea}>
      <KeyboardAvoidingView
        style={styles.keyboardAvoid}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 12 : 0}
      >
        {/* Top Header Row with Language Switcher and optional Back button */}
        <View style={styles.topBar}>
          {inputMode === 'manual' ? (
            <TouchableOpacity
              style={styles.backBtnPill}
              onPress={() => {
                setInputMode('choice');
                setErrorMsg('');
              }}
              activeOpacity={0.7}
            >
              <ChevronLeftIcon size={16} color={COLORS.ink} />
              <Text style={styles.backBtnText}>{t('backShort', currentLang)}</Text>
            </TouchableOpacity>
          ) : (
            <View style={{ width: 60 }} />
          )}

          {/* Language Switcher */}
          <View style={styles.langRow}>
            {LANGUAGES.map((l) => (
              <TouchableOpacity
                key={l.code}
                style={[styles.langChip, currentLang === l.code && styles.langChipActive]}
                onPress={() => onSelectLang && onSelectLang(l.code)}
                activeOpacity={0.7}
              >
                <Text
                  style={[
                    styles.langChipText,
                    currentLang === l.code && styles.langChipTextActive,
                  ]}
                >
                  {l.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {inputMode === 'choice' ? (
          // =======================================================
          // SCREEN 1: CHOICE SCREEN (Centered vertically, 2 buttons)
          // =======================================================
          <ScrollView
            contentContainerStyle={styles.centeredScrollContent}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
            bounces={false}
          >
            <View style={styles.mainContentCenter}>
              {/* Centered Logo with generous breathing room */}
              <View style={styles.logoBox}>
                {renderLogo(false)}
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

              {/* The Two Distinct Action Buttons */}
              <View style={styles.choiceButtonGroup}>
                {/* Button 1: Mit QR-Code verbinden */}
                <TouchableOpacity
                  style={styles.primaryScanBtn}
                  onPress={handleOpenScanner}
                  disabled={isActivating}
                  activeOpacity={0.85}
                >
                  <CameraSilhouetteIcon size={22} color="#FFFFFF" />
                  <Text style={styles.primaryScanText}>{t('scanQrBtn', currentLang)}</Text>
                </TouchableOpacity>

                {/* Button 2: Zugangsdaten manuell eingeben */}
                <TouchableOpacity
                  style={styles.secondaryCodeBtn}
                  onPress={() => {
                    setErrorMsg('');
                    setInputMode('manual');
                  }}
                  disabled={isActivating}
                  activeOpacity={0.75}
                >
                  <Text style={styles.secondaryCodeIcon}>⌨️</Text>
                  <Text style={styles.secondaryCodeText}>
                    {t('enterCodeManuallyBtn', currentLang)}
                  </Text>
                </TouchableOpacity>
              </View>
            </View>

            {/* Footer info */}
            <View style={styles.footerContainer}>
              <Text style={styles.footerVersion}>
                {t('appVersionLabel', currentLang, { version: APP_VERSION })}
              </Text>
            </View>
          </ScrollView>
        ) : (
          // =======================================================
          // SCREEN 2: DEDICATED MANUAL INPUT SCREEN (No scan button)
          // =======================================================
          <ScrollView
            contentContainerStyle={styles.manualScrollContent}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
            bounces={false}
          >
            <View style={styles.manualCard}>
              {/* Logo */}
              <View style={styles.logoBoxManual}>
                {renderLogo(true)}
              </View>

              <Text style={styles.title}>{t('activationTitle', currentLang)}</Text>
              <Text style={styles.subtitle}>{t('manualCodePrompt', currentLang)}</Text>

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

              {/* Manual Code & Password Input Form */}
              <View style={styles.manualInputGroup}>
                <View style={styles.fieldBlock}>
                  <Text style={styles.fieldLabel}>
                    {t('licenseKeyLabel', currentLang)}
                  </Text>
                  <TextInput
                    style={styles.codeInputField}
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
                    maxLength={15}
                  />
                </View>

                <View style={styles.fieldBlock}>
                  <Text style={styles.fieldLabel}>
                    {t('passwordOrPinLabel', currentLang)}
                  </Text>
                  <View style={styles.passwordInputWrapper}>
                    <TextInput
                      style={styles.passwordInputField}
                      value={manualPassword}
                      onChangeText={(text) => {
                        setManualPassword(text);
                        setErrorMsg('');
                      }}
                      placeholder={t('passwordPlaceholder', currentLang)}
                      placeholderTextColor={COLORS.muted}
                      secureTextEntry={!showManualPassword}
                      autoCapitalize="none"
                      autoCorrect={false}
                      editable={!isActivating}
                    />
                    <TouchableOpacity
                      style={styles.eyeBtnManual}
                      onPress={() => setShowManualPassword(!showManualPassword)}
                      activeOpacity={0.7}
                    >
                      <Text style={styles.eyeBtnText}>{showManualPassword ? '🙈' : '👁️'}</Text>
                    </TouchableOpacity>
                  </View>
                </View>

                {/* "Verbinden & Anmelden" Button directly underneath */}
                <TouchableOpacity
                  style={[
                    styles.activateBtnLarge,
                    (!codeDraft.trim() || !manualPassword.trim() || isActivating) && styles.btnDisabled,
                  ]}
                  onPress={handleManualSubmit}
                  disabled={!codeDraft.trim() || !manualPassword.trim() || isActivating}
                  activeOpacity={0.75}
                >
                  {isActivating ? (
                    <ActivityIndicator color="#FFFFFF" size="small" />
                  ) : (
                    <Text style={styles.activateBtnLargeText}>
                      {t('connectAndLoginBtn', currentLang)}
                    </Text>
                  )}
                </TouchableOpacity>

                {/* Back to selection link */}
                <TouchableOpacity
                  style={styles.switchModeLink}
                  onPress={() => {
                    setInputMode('choice');
                    setErrorMsg('');
                  }}
                  activeOpacity={0.7}
                >
                  <Text style={styles.switchModeText}>
                    {t('backToChoice', currentLang)}
                  </Text>
                </TouchableOpacity>
              </View>
            </View>

            {/* Footer info */}
            <View style={styles.footerContainer}>
              <Text style={styles.footerVersion}>
                {t('appVersionLabel', currentLang, { version: APP_VERSION })}
              </Text>
            </View>
          </ScrollView>
        )}
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
    backgroundColor: '#F8FAFC',
  },
  keyboardAvoid: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 4,
  },
  backBtnPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 14,
    backgroundColor: '#EDF2F7',
  },
  backBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: COLORS.ink,
  },
  langRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  langChip: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 12,
    backgroundColor: '#EDF2F7',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  langChipActive: {
    backgroundColor: COLORS.ink,
    borderColor: COLORS.ink,
  },
  langChipText: {
    fontSize: 11.5,
    fontWeight: '700',
    color: COLORS.muted,
  },
  langChipTextActive: {
    color: '#FFFFFF',
  },

  // Centered choice screen
  centeredScrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingHorizontal: 28,
    paddingVertical: 24,
  },
  mainContentCenter: {
    alignItems: 'center',
    width: '100%',
    maxWidth: 380,
    alignSelf: 'center',
  },
  logoBox: {
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 32,
    minHeight: 56,
  },
  p12LogoContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
  },
  customLogoWrapper: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoImage: {
    width: 190,
    height: 56,
  },
  logoImageSmall: {
    width: 150,
    height: 44,
  },

  title: {
    fontSize: 24,
    fontWeight: '800',
    color: COLORS.ink,
    marginBottom: 10,
    textAlign: 'center',
    letterSpacing: -0.3,
  },
  subtitle: {
    fontSize: 14,
    color: '#64748B',
    textAlign: 'center',
    marginBottom: 36,
    lineHeight: 21,
    paddingHorizontal: 12,
  },

  choiceButtonGroup: {
    width: '100%',
    gap: 14,
  },
  primaryScanBtn: {
    backgroundColor: COLORS.primary,
    width: '100%',
    paddingVertical: 16,
    borderRadius: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    shadowColor: COLORS.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 10,
    elevation: 4,
  },
  primaryScanText: {
    fontSize: 15.5,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  secondaryCodeBtn: {
    backgroundColor: '#FFFFFF',
    width: '100%',
    paddingVertical: 15,
    borderRadius: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderWidth: 1.5,
    borderColor: '#CBD5E1',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 1,
  },
  secondaryCodeIcon: {
    fontSize: 16,
  },
  secondaryCodeText: {
    fontSize: 14.5,
    fontWeight: '700',
    color: COLORS.ink,
  },
  // Manual code screen
  manualScrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingHorizontal: 28,
    paddingVertical: 24,
  },
  manualCard: {
    alignItems: 'center',
    width: '100%',
    maxWidth: 380,
    alignSelf: 'center',
  },
  logoBoxManual: {
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
    minHeight: 44,
  },
  manualInputGroup: {
    width: '100%',
    gap: 14,
  },
  fieldBlock: {
    width: '100%',
    gap: 6,
  },
  fieldLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: '#334155',
    marginLeft: 2,
  },
  codeInputField: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1.5,
    borderColor: '#CBD5E1',
    borderRadius: 14,
    paddingVertical: 14,
    paddingHorizontal: 16,
    fontSize: 18,
    fontWeight: '700',
    color: COLORS.ink,
    letterSpacing: 1.5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 1,
  },
  passwordInputWrapper: {
    position: 'relative',
    width: '100%',
  },
  passwordInputField: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1.5,
    borderColor: '#CBD5E1',
    borderRadius: 14,
    paddingVertical: 14,
    paddingLeft: 16,
    paddingRight: 48,
    fontSize: 16,
    color: COLORS.ink,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 1,
  },
  eyeBtnManual: {
    position: 'absolute',
    right: 14,
    top: 14,
    padding: 4,
  },
  eyeBtnText: {
    fontSize: 18,
  },
  activateBtnLarge: {
    backgroundColor: COLORS.primary,
    paddingVertical: 16,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: COLORS.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 3,
    marginTop: 6,
  },
  activateBtnLargeText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFFFFF',
    letterSpacing: 0.2,
  },
  switchModeLink: {
    marginTop: 8,
    alignItems: 'center',
    paddingVertical: 8,
  },
  switchModeText: {
    fontSize: 13.5,
    fontWeight: '600',
    color: COLORS.muted,
  },

  // Password / Shared styles
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: 28,
    paddingTop: 36,
    paddingBottom: 24,
    alignItems: 'center',
  },
  inputContainer: {
    width: '100%',
    maxWidth: 380,
    gap: 14,
  },
  passwordInput: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1.5,
    borderColor: '#CBD5E1',
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.ink,
  },
  btnDisabled: {
    opacity: 0.4,
  },
  errorBox: {
    backgroundColor: '#FEE2E2',
    borderWidth: 1,
    borderColor: '#F87171',
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 12,
    marginBottom: 20,
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
  footerContainer: {
    marginTop: 40,
    paddingBottom: 8,
    alignItems: 'center',
  },
  footerVersion: {
    fontSize: 11.5,
    fontWeight: '600',
    color: COLORS.muted,
    letterSpacing: 0.3,
  },

  // SCANNER VIEW STYLES
  scannerRoot: {
    flex: 1,
    backgroundColor: '#000000',
  },
  cameraPreview: {
    flex: 1,
    width: '100%',
    height: '100%',
  },
  scannerOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 20,
    paddingHorizontal: 20,
    backgroundColor: 'transparent',
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
  reticleManualBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#0F172A',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 24,
    borderWidth: 1.5,
    borderColor: '#38BDF8',
    marginTop: 18,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 4,
  },
  reticleManualBtnIcon: {
    fontSize: 16,
  },
  reticleManualBtnText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
    letterSpacing: 0.2,
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
