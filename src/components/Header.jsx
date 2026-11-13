import React, { useRef, useEffect, useState } from 'react';
import { View, Text, Image, TouchableOpacity, StyleSheet, Animated } from 'react-native';
import Svg, { Path, SvgUri } from 'react-native-svg';
import { COLORS } from '../constants/theme';
import { LANGUAGES, t } from '../locales/i18n';

export default function Header({
  projectName = '',
  subTitle = '',
  branding = null,
  isOnline = false,
  currentLang = 'de',
  onSelectLang,
  onSyncPress,
  isSyncing = false,
  onSwitchProject = null,
  onLockPress = null,
}) {
  const spinAnim = useRef(new Animated.Value(0)).current;
  const loopRef = useRef(null);
  const [logoLoadFailed, setLogoLoadFailed] = useState(false);

  useEffect(() => setLogoLoadFailed(false), [branding?.logoUrl]);

  useEffect(() => {
    if (isSyncing) {
      spinAnim.setValue(0);
      loopRef.current = Animated.loop(
        Animated.timing(spinAnim, {
          toValue: 1,
          duration: 800,
          useNativeDriver: true,
        })
      );
      loopRef.current.start();
    } else {
      if (loopRef.current) {
        loopRef.current.stop();
        loopRef.current = null;
      }
      spinAnim.setValue(0);
    }
    return () => {
      if (loopRef.current) loopRef.current.stop();
    };
  }, [isSyncing]);

  const spinInterpolate = spinAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  });
  const isSvgLogo = branding?.logoMimeType?.includes('svg') || /\.svg(?:\?|$)/i.test(branding?.logoUrl || '');

  return (
    <View style={styles.wrapper}>
      {/* Top Brand & Project Bar */}
      <View style={styles.topBar}>
        <View style={styles.leftInfo}>
          <View style={styles.logoRow}>
            {branding?.logoUrl && !logoLoadFailed ? (
              isSvgLogo ? (
                <View style={{ transform: [{ scale: branding.logoZoom || 1 }] }}>
                  <SvgUri width={72} height={34} uri={branding.logoUrl} onError={() => setLogoLoadFailed(true)} />
                </View>
              ) : (
                <Image source={{ uri: branding.logoUrl }} style={[styles.logoImage, { transform: [{ scale: branding.logoZoom || 1 }] }]} resizeMode="contain" onError={() => setLogoLoadFailed(true)} />
              )
            ) : (
              <Text style={[styles.brandFallback, branding?.secondaryColor && { color: branding.secondaryColor }]} numberOfLines={2}>{branding?.name || ''}</Text>
            )}
          </View>
          <TouchableOpacity
            style={styles.projectTexts}
            onPress={onSwitchProject}
            disabled={!onSwitchProject}
            activeOpacity={0.7}
          >
            <Text style={styles.projectTitle} numberOfLines={2}>
              {projectName} {onSwitchProject ? '▾' : ''}
            </Text>
            <Text style={styles.projectSub} numberOfLines={1}>
              {subTitle}
            </Text>
          </TouchableOpacity>
        </View>

        <View style={styles.rightBadges}>
          {/* Sync Button */}
          <TouchableOpacity
            style={[
              styles.syncButton,
              branding?.primaryColor && { backgroundColor: branding.primaryColor },
            ]}
            onPress={onSyncPress}
            disabled={isSyncing}
            accessibilityLabel={t('syncBtn', currentLang)}
            activeOpacity={0.7}
          >
            <Animated.View style={isSyncing ? { transform: [{ rotate: spinInterpolate }] } : undefined}>
              <Svg width={21} height={21} viewBox="0 0 24 24" fill="none">
                <Path
                  d="M20 11a8.1 8.1 0 0 0-15.5-2M4 4v5h5M4 13a8.1 8.1 0 0 0 15.5 2M20 20v-5h-5"
                  stroke="#FFFFFF"
                  strokeWidth={2.2}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </Svg>
            </Animated.View>
          </TouchableOpacity>
          {onLockPress && (
            <TouchableOpacity style={styles.menuButton} onPress={onLockPress} accessibilityLabel={t('logoutDeviceTitle', currentLang)}>
              <Text style={styles.menuText}>⋯</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* Sub Bar: Status & Languages */}
      <View style={styles.subBar}>
        {/* Online / Offline Status Badge */}
        <View style={styles.statusGroup}>
          <View style={[styles.statusDot, isOnline ? styles.dotOnline : styles.dotOffline]} />
          <Text style={styles.statusLabel}>
            {isOnline ? t('online', currentLang) : t('offline', currentLang)}
          </Text>
        </View>

        {/* Language Switcher Chips */}
        <View style={styles.langChips}>
          <Text style={styles.globeIcon}>🌐</Text>
          {LANGUAGES.map((lang) => {
            const isActive = currentLang === lang.code;
            return (
              <TouchableOpacity
                key={lang.code}
                style={[styles.langChip, isActive && styles.langChipActive]}
                onPress={() => onSelectLang && onSelectLang(lang.code)}
                activeOpacity={0.7}
              >
                <Text style={[styles.langChipText, isActive && styles.langChipTextActive]}>
                  {lang.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    backgroundColor: '#F7F8FA',
    borderBottomWidth: 1,
    borderBottomColor: COLORS.line,
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingTop: 8,
    paddingBottom: 7,
    gap: 8,
  },
  leftInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    gap: 10,
  },
  logoRow: {
    width: 72,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  logoImage: {
    width: 72,
    height: 34,
  },
  brandFallback: {
    color: COLORS.ink,
    fontSize: 10,
    fontWeight: '800',
    textAlign: 'center',
  },
  projectTexts: {
    flex: 1,
  },
  projectTitle: {
    color: COLORS.ink,
    fontWeight: '700',
    fontSize: 15,
  },
  projectSub: {
    color: COLORS.muted,
    fontSize: 11.5,
    marginTop: 1,
  },
  rightBadges: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  syncButton: {
    width: 38,
    height: 38,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 19,
    backgroundColor: COLORS.amber,
  },
  menuButton: {
    width: 34,
    height: 34,
    borderRadius: 16,
    backgroundColor: '#E8ECF0',
    alignItems: 'center',
    justifyContent: 'center',
  },
  menuText: {
    color: COLORS.ink,
    fontSize: 22,
    fontWeight: '700',
    marginTop: -5,
  },
  subBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#F6F8FA',
    paddingHorizontal: 16,
    paddingVertical: 7,
    borderTopWidth: 1,
    borderTopColor: COLORS.line,
  },
  statusGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flex: 1,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  dotOnline: {
    backgroundColor: COLORS.green,
  },
  dotOffline: {
    backgroundColor: COLORS.muted,
  },
  statusLabel: {
    fontSize: 11.5,
    fontWeight: '700',
    color: COLORS.inkSoft,
  },
  langChips: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  globeIcon: {
    fontSize: 13,
    marginRight: 2,
  },
  langChip: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    backgroundColor: 'transparent',
  },
  langChipActive: {
    backgroundColor: COLORS.amber,
  },
  langChipText: {
    fontSize: 11,
    fontWeight: '700',
    color: COLORS.muted,
  },
  langChipTextActive: {
    color: '#FFFFFF',
  },
});
