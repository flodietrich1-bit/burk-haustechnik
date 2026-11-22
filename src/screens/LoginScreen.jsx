import React, { useState } from 'react';
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
import Svg, { Path, SvgUri } from 'react-native-svg';
import { COLORS } from '../constants/theme';
import { APP_VERSION } from '../constants/version';
import { t } from '../locales/i18n';
import { unlockDeviceWithPassword, logoutDevice } from '../services/authService';

export default function LoginScreen({
  monteur,
  branding,
  currentLang = 'de',
  onLoginSuccess,
  onResetDevice,
}) {
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [logoLoadFailed, setLogoLoadFailed] = useState(false);

  const isSvgLogo =
    branding?.logoMimeType?.includes('svg') ||
    /\.svg(?:\?|$)/i.test(branding?.logoUrl || '');

  const handleLogin = async () => {
    if (!password.trim()) {
      setErrorMsg(t('wrongPassword', currentLang));
      return;
    }

    setIsSubmitting(true);
    setErrorMsg('');

    try {
      const result = await unlockDeviceWithPassword(password.trim());
      if (result.success && onLoginSuccess) {
        onLoginSuccess(result.monteur, result.projects);
      }
    } catch (err) {
      console.warn('Login error:', err);
      if (err.code === 'USER_DELETED') {
        Alert.alert(
          t('userDeletedTitle', currentLang),
          t('userDeletedMsg', currentLang),
          [
            {
              text: t('ok', currentLang),
              onPress: () => {
                if (onResetDevice) onResetDevice();
              },
            },
          ]
        );
      } else if (err.code === 'INVALID_PASSWORD') {
        setErrorMsg(t('wrongPassword', currentLang));
      } else {
        setErrorMsg(t('wrongPassword', currentLang));
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSwitchUser = () => {
    Alert.alert(
      t('switchUserOrNewInvite', currentLang),
      t('logoutDeviceConfirm', currentLang),
      [
        { text: t('cancel', currentLang), style: 'cancel' },
        {
          text: t('logoutDeviceBtn', currentLang),
          style: 'destructive',
          onPress: async () => {
            await logoutDevice();
            if (onResetDevice) onResetDevice();
          },
        },
      ]
    );
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
        >
          {/* Header Branding */}
          <View style={styles.header}>
            <View style={styles.logoContainer}>
              {branding?.logoUrl && !logoLoadFailed ? (
                isSvgLogo ? (
                  <View style={{ transform: [{ scale: branding.logoZoom || 1 }] }}>
                    <SvgUri
                      width={160}
                      height={48}
                      uri={branding.logoUrl}
                      onError={() => setLogoLoadFailed(true)}
                    />
                  </View>
                ) : (
                  <Image
                    source={{ uri: branding.logoUrl }}
                    style={[
                      styles.logoImage,
                      { transform: [{ scale: branding.logoZoom || 1 }] },
                    ]}
                    resizeMode="contain"
                    onError={() => setLogoLoadFailed(true)}
                  />
                )
              ) : (
                <Text style={styles.brandTitle}>
                  {branding?.name || 'burk HAUSTECHNIK'}
                </Text>
              )}
            </View>

            <View style={styles.userCard}>
              <View style={styles.avatarCircle}>
                <Text style={styles.avatarInitial}>
                  {(monteur?.name || 'M').charAt(0).toUpperCase()}
                </Text>
              </View>
              <View style={styles.userTexts}>
                <Text style={styles.userLabel}>
                  {t('loggedInAs', currentLang)}
                </Text>
                <Text style={styles.userName} numberOfLines={1}>
                  {monteur?.name || 'Monteur'}
                </Text>
              </View>
            </View>
          </View>

          {/* Form Content */}
          <View style={styles.body}>
            <Text style={styles.title}>{t('enterPasswordTitle', currentLang)}</Text>
            <Text style={styles.subtitle}>
              {t('enterPasswordSubtitle', currentLang)}
            </Text>

            {errorMsg ? (
              <View style={styles.errorBox}>
                <Text style={styles.errorText}>⚠️ {errorMsg}</Text>
              </View>
            ) : null}

            <View style={styles.inputWrapper}>
              <TextInput
                style={styles.passwordInput}
                placeholder={t('passwordPlaceholder', currentLang)}
                placeholderTextColor="#94A3B8"
                secureTextEntry={!showPassword}
                value={password}
                onChangeText={(text) => {
                  setPassword(text);
                  setErrorMsg('');
                }}
                autoCapitalize="none"
                autoCorrect={false}
                returnKeyType="done"
                onSubmitEditing={handleLogin}
              />
              <TouchableOpacity
                style={styles.eyeBtn}
                onPress={() => setShowPassword(!showPassword)}
                activeOpacity={0.7}
              >
                <Text style={styles.eyeBtnText}>{showPassword ? '🙈' : '👁️'}</Text>
              </TouchableOpacity>
            </View>

            <TouchableOpacity
              style={[styles.loginBtn, isSubmitting && styles.btnDisabled]}
              onPress={handleLogin}
              disabled={isSubmitting}
              activeOpacity={0.8}
            >
              {isSubmitting ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <Text style={styles.loginBtnText}>
                  {t('loginBtn', currentLang)}
                </Text>
              )}
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.switchUserBtn}
              onPress={handleSwitchUser}
              activeOpacity={0.7}
            >
              <Text style={styles.switchUserText}>
                {t('switchUserOrNewInvite', currentLang)}
              </Text>
            </TouchableOpacity>
          </View>

          {/* Version Footer */}
          <View style={styles.footerContainer}>
            <Text style={styles.footerVersion}>
              {t('appVersionLabel', currentLang, { version: APP_VERSION })}
            </Text>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'space-between',
    paddingHorizontal: 24,
    paddingTop: 32,
    paddingBottom: 20,
  },
  header: {
    alignItems: 'center',
    gap: 16,
  },
  logoContainer: {
    height: 50,
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoImage: {
    width: 160,
    height: 48,
  },
  brandTitle: {
    fontSize: 22,
    fontWeight: '900',
    color: '#0284C7',
    letterSpacing: 0.5,
  },
  userCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F1F5F9',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 16,
    gap: 12,
    width: '100%',
    marginTop: 8,
  },
  avatarCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: COLORS.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarInitial: {
    color: '#FFFFFF',
    fontSize: 20,
    fontWeight: '800',
  },
  userTexts: {
    flex: 1,
  },
  userLabel: {
    fontSize: 12,
    color: COLORS.muted,
    fontWeight: '600',
  },
  userName: {
    fontSize: 16,
    fontWeight: '700',
    color: COLORS.ink,
  },
  body: {
    width: '100%',
    paddingVertical: 20,
  },
  title: {
    fontSize: 22,
    fontWeight: '800',
    color: COLORS.ink,
    textAlign: 'center',
    marginBottom: 6,
  },
  subtitle: {
    fontSize: 14,
    color: COLORS.muted,
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 24,
    paddingHorizontal: 12,
  },
  errorBox: {
    backgroundColor: '#FEE2E2',
    borderWidth: 1,
    borderColor: '#F87171',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    marginBottom: 16,
  },
  errorText: {
    color: '#B91C1C',
    fontSize: 13,
    fontWeight: '600',
    textAlign: 'center',
  },
  inputWrapper: {
    position: 'relative',
    width: '100%',
    marginBottom: 16,
  },
  passwordInput: {
    backgroundColor: '#F8FAFC',
    borderWidth: 1.5,
    borderColor: '#CBD5E1',
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 14,
    paddingRight: 50,
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.ink,
  },
  eyeBtn: {
    position: 'absolute',
    right: 12,
    top: 12,
    padding: 6,
  },
  eyeBtnText: {
    fontSize: 18,
  },
  loginBtn: {
    backgroundColor: COLORS.primary,
    width: '100%',
    paddingVertical: 15,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: COLORS.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 3,
    marginTop: 8,
  },
  loginBtnText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  btnDisabled: {
    opacity: 0.5,
  },
  switchUserBtn: {
    marginTop: 20,
    paddingVertical: 10,
    alignItems: 'center',
  },
  switchUserText: {
    fontSize: 13,
    fontWeight: '600',
    color: COLORS.muted,
    textDecorationLine: 'underline',
  },
  noAccessBox: {
    marginTop: 22,
    alignItems: 'center',
    gap: 4,
  },
  noAccessPrompt: {
    fontSize: 13,
    fontWeight: '500',
    color: '#64748B',
    textAlign: 'center',
  },
  noAccessLink: {
    fontSize: 14,
    fontWeight: '700',
    color: COLORS.primary,
    textDecorationLine: 'underline',
    textAlign: 'center',
  },
  footerContainer: {
    marginTop: 24,
    alignItems: 'center',
  },
  footerVersion: {
    fontSize: 11,
    color: COLORS.muted,
  },
});
