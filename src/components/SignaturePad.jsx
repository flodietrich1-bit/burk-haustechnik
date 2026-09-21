import React, { useState, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  PanResponder,
} from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { COLORS } from '../constants/theme';
import { t } from '../locales/i18n';

export default function SignaturePad({
  onSignatureChange,
  isInvalid = false,
  currentLang = 'de',
  onDrawStart,
  onDrawEnd,
}) {
  const [paths, setPaths] = useState([]);
  const [currentPath, setCurrentPath] = useState('');
  const currentPathRef = useRef('');

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: (evt) => {
        onDrawStart && onDrawStart();
        const { locationX, locationY } = evt.nativeEvent;
        const x = Math.max(0, locationX);
        const y = Math.max(0, locationY);
        currentPathRef.current = `M ${x.toFixed(1)} ${y.toFixed(1)}`;
        setCurrentPath(currentPathRef.current);
      },
      onPanResponderMove: (evt) => {
        const { locationX, locationY } = evt.nativeEvent;
        const x = Math.max(0, locationX);
        const y = Math.max(0, locationY);
        currentPathRef.current += ` L ${x.toFixed(1)} ${y.toFixed(1)}`;
        setCurrentPath(currentPathRef.current);
      },
      onPanResponderRelease: () => {
        onDrawEnd && onDrawEnd();
        if (currentPathRef.current) {
          const updated = [...paths, currentPathRef.current];
          setPaths(updated);
          currentPathRef.current = '';
          setCurrentPath('');
          onSignatureChange && onSignatureChange(true, updated);
        }
      },
      onPanResponderTerminate: () => {
        onDrawEnd && onDrawEnd();
      },
    })
  ).current;

  const handleClear = () => {
    setPaths([]);
    setCurrentPath('');
    currentPathRef.current = '';
    onSignatureChange && onSignatureChange(false, []);
  };

  const hasSignature = paths.length > 0 || Boolean(currentPath);

  return (
    <View style={styles.container}>
      <View style={styles.headerRow}>
        <View style={styles.titleWrap}>
          <Text style={styles.label}>
            ✍️ {t('signatureLabel', currentLang)} <Text style={styles.requiredStar}>*</Text>
          </Text>
          {hasSignature ? (
            <View style={styles.signedBadge}>
              <Text style={styles.signedBadgeText}>✓ {t('signatureSigned', currentLang)}</Text>
            </View>
          ) : null}
        </View>

        {hasSignature && (
          <TouchableOpacity style={styles.clearBtn} onPress={handleClear} activeOpacity={0.7}>
            <Text style={styles.clearBtnText}>✕ {t('signatureClear', currentLang)}</Text>
          </TouchableOpacity>
        )}
      </View>

      <View
        style={[
          styles.padBox,
          isInvalid && !hasSignature && styles.padBoxInvalid,
          hasSignature && styles.padBoxValid,
        ]}
        {...panResponder.panHandlers}
      >
        <Svg style={StyleSheet.absoluteFill}>
          {paths.map((d, index) => (
            <Path
              key={index}
              d={d}
              stroke="#1A365D"
              strokeWidth={3}
              strokeLinecap="round"
              strokeLinejoin="round"
              fill="none"
            />
          ))}
          {currentPath ? (
            <Path
              d={currentPath}
              stroke="#1A365D"
              strokeWidth={3}
              strokeLinecap="round"
              strokeLinejoin="round"
              fill="none"
            />
          ) : null}
        </Svg>

        {!hasSignature && (
          <View style={styles.placeholderBox} pointerEvents="none">
            <View style={styles.baselineRow}>
              <Text style={styles.signX}>✕</Text>
              <View style={styles.signLine} />
            </View>
            <Text style={styles.signPlaceholderText}>
              {t('signatureSignHere', currentLang)}
            </Text>
          </View>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginBottom: 16,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  titleWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  label: {
    fontSize: 12.5,
    fontWeight: '800',
    color: COLORS.ink,
  },
  requiredStar: {
    color: '#E53E3E',
    fontWeight: '900',
  },
  signedBadge: {
    backgroundColor: '#E6FFFA',
    borderWidth: 1,
    borderColor: '#38B2AC',
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 1.5,
  },
  signedBadgeText: {
    fontSize: 10.5,
    fontWeight: '800',
    color: '#234E52',
  },
  clearBtn: {
    backgroundColor: '#EDF2F7',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#CBD5E0',
  },
  clearBtnText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#4A5568',
  },
  padBox: {
    height: 120,
    backgroundColor: '#FFFFFF',
    borderWidth: 1.5,
    borderColor: '#CBD5E0',
    borderRadius: 10,
    position: 'relative',
    overflow: 'hidden',
  },
  padBoxInvalid: {
    borderColor: '#E53E3E',
    backgroundColor: '#FFF5F5',
  },
  padBoxValid: {
    borderColor: '#319795',
    backgroundColor: '#FAFCFE',
  },
  placeholderBox: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    top: 0,
    justifyContent: 'flex-end',
    paddingHorizontal: 16,
    paddingBottom: 10,
  },
  baselineRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  signX: {
    fontSize: 18,
    fontWeight: '900',
    color: '#CBD5E0',
    marginRight: 6,
  },
  signLine: {
    flex: 1,
    height: 1.5,
    backgroundColor: '#E2E8F0',
    borderRadius: 1,
  },
  signPlaceholderText: {
    fontSize: 11,
    color: '#A0AEC0',
    fontWeight: '600',
  },
});
