import React from 'react';
import { View, StyleSheet } from 'react-native';
import { COLORS } from '../constants/theme';

export default function ProgressBar({
  progress = 0, // 0 to 100
  isOver = false,
  height = 6,
  borderRadius = 4,
  trackColor = '#EDF1F4',
  style,
}) {
  const clampedProgress = Math.min(100, Math.max(0, progress));
  const activeColor = isOver ? COLORS.red : COLORS.green;

  return (
    <View style={[styles.track, { height, borderRadius, backgroundColor: trackColor }, style]}>
      <View
        style={[
          styles.fill,
          {
            width: `${clampedProgress}%`,
            height,
            borderRadius,
            backgroundColor: activeColor,
          },
        ]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  track: {
    width: '100%',
    overflow: 'hidden',
  },
  fill: {
    height: '100%',
  },
});
