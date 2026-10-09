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

  // Balken: Grün (<= 100%), Gelb (101% - 110%), Rot (> 110%)
  let activeColor = COLORS.green;
  if (progress > 110) {
    activeColor = COLORS.red;
  } else if (progress > 100) {
    activeColor = '#EAB308';
  }

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
