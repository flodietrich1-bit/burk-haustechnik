import React, { useRef } from 'react';
import { View, StyleSheet, PanResponder } from 'react-native';
import { COLORS } from '../constants/theme';

export default function ProgressBar({
  progress = 0, // 0 to 100
  isOver = false,
  height = 6,
  borderRadius = 4,
  trackColor = '#EDF1F4',
  interactive = false,
  onSlideRatio,
  onDragStateChange,
  style,
}) {
  const clampedProgress = Math.min(100, Math.max(0, Number(progress) || 0));
  const trackWidthRef = useRef(0);
  const startXRef = useRef(0);

  const interactiveRef = useRef(interactive);
  interactiveRef.current = interactive;

  const onSlideRatioRef = useRef(onSlideRatio);
  onSlideRatioRef.current = onSlideRatio;

  const onDragStateChangeRef = useRef(onDragStateChange);
  onDragStateChangeRef.current = onDragStateChange;

  const emitRatioFromX = (x) => {
    const w = trackWidthRef.current;
    if (!w || w <= 0 || !onSlideRatioRef.current) return;
    let ratio = x / w;
    if (ratio >= 0.985) {
      ratio = 1;
    } else if (ratio <= 0.015) {
      ratio = 0;
    } else {
      ratio = Math.max(0, Math.min(1, ratio));
    }
    onSlideRatioRef.current(ratio);
  };

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => Boolean(interactiveRef.current),
      onMoveShouldSetPanResponder: () => Boolean(interactiveRef.current),
      onPanResponderTerminationRequest: () => false,
      onShouldBlockNativeResponder: () => true,
      onPanResponderGrant: (evt) => {
        if (!interactiveRef.current) return;
        onDragStateChangeRef.current?.(true);
        startXRef.current = evt.nativeEvent.locationX;
        emitRatioFromX(startXRef.current);
      },
      onPanResponderMove: (_evt, gestureState) => {
        if (!interactiveRef.current) return;
        emitRatioFromX(startXRef.current + gestureState.dx);
      },
      onPanResponderRelease: () => {
        onDragStateChangeRef.current?.(false);
      },
      onPanResponderTerminate: () => {
        onDragStateChangeRef.current?.(false);
      },
    })
  ).current;

  // Balken: Grün (<= 100%), Gelb (101% - 110%), Rot (> 110%)
  let activeColor = COLORS.green;
  if (progress > 110) {
    activeColor = COLORS.red;
  } else if (progress > 100) {
    activeColor = '#EAB308';
  }

  if (!interactive) {
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

  const interactiveHeight = Math.max(height, 8);

  return (
    <View
      style={[styles.interactiveContainer, style]}
      onLayout={(e) => {
        trackWidthRef.current = e.nativeEvent.layout.width;
      }}
      {...panResponder.panHandlers}
    >
      <View
        pointerEvents="none"
        style={[
          styles.track,
          {
            height: interactiveHeight,
            borderRadius: interactiveHeight / 2,
            backgroundColor: trackColor,
          },
        ]}
      >
        <View
          style={[
            styles.fill,
            {
              width: `${clampedProgress}%`,
              height: interactiveHeight,
              borderRadius: interactiveHeight / 2,
              backgroundColor: activeColor,
            },
          ]}
        />
      </View>
      <View
        pointerEvents="none"
        style={[
          styles.thumb,
          {
            left: `${clampedProgress}%`,
            borderColor: activeColor,
          },
        ]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  interactiveContainer: {
    width: '100%',
    paddingVertical: 10,
    justifyContent: 'center',
    position: 'relative',
  },
  track: {
    width: '100%',
    overflow: 'hidden',
  },
  fill: {
    height: '100%',
  },
  thumb: {
    position: 'absolute',
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: '#FFFFFF',
    borderWidth: 3,
    marginLeft: -10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 2,
    elevation: 3,
  },
});
