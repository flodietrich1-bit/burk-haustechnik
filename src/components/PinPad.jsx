import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { COLORS } from '../constants/theme';

export default function PinPad({ pin = '', onDigitPress, onDeletePress, maxDigits = 4 }) {
  const digits = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '', '0', '⌫'];

  return (
    <View style={styles.container}>
      {/* 4 Pin Dots */}
      <View style={styles.dotsContainer}>
        {Array.from({ length: maxDigits }).map((_, index) => {
          const isFilled = index < pin.length;
          return (
            <View
              key={index}
              style={[
                styles.dot,
                isFilled ? styles.dotFilled : styles.dotEmpty,
              ]}
            />
          );
        })}
      </View>

      {/* 3x4 Keypad */}
      <View style={styles.grid}>
        {digits.map((item, index) => {
          if (item === '') {
            return <View key={index} style={styles.keyPlaceholder} />;
          }
          if (item === '⌫') {
            return (
              <TouchableOpacity
                key={index}
                style={[styles.key, styles.keyAction]}
                onPress={onDeletePress}
                activeOpacity={0.6}
              >
                <Text style={styles.actionText}>⌫</Text>
              </TouchableOpacity>
            );
          }
          return (
            <TouchableOpacity
              key={index}
              style={styles.key}
              onPress={() => onDigitPress(item)}
              activeOpacity={0.6}
            >
              <Text style={styles.digitText}>{item}</Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    width: '100%',
    paddingVertical: 10,
  },
  dotsContainer: {
    flexDirection: 'row',
    gap: 16,
    marginBottom: 28,
  },
  dot: {
    width: 16,
    height: 16,
    borderRadius: 8,
  },
  dotEmpty: {
    borderWidth: 2,
    borderColor: COLORS.border,
    backgroundColor: 'transparent',
  },
  dotFilled: {
    backgroundColor: COLORS.amber,
    borderColor: COLORS.amber,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    width: 280,
    gap: 14,
  },
  key: {
    width: 74,
    height: 74,
    borderRadius: 37,
    backgroundColor: '#FFFFFF',
    borderWidth: 1.5,
    borderColor: COLORS.line,
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 2,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 4,
  },
  keyPlaceholder: {
    width: 74,
    height: 74,
  },
  keyAction: {
    backgroundColor: '#F1F4F7',
    borderColor: '#E2E7EC',
  },
  digitText: {
    fontSize: 26,
    fontWeight: '700',
    color: COLORS.ink,
  },
  actionText: {
    fontSize: 22,
    fontWeight: '600',
    color: COLORS.muted,
  },
});
