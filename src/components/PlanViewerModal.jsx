import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  Modal,
  SafeAreaView,
  TouchableOpacity,
  StyleSheet,
  PanResponder,
  Animated,
  Dimensions,
  Linking,
  Platform,
} from 'react-native';
import Svg, {
  G,
  Rect,
  Path,
  Line,
  Text as SvgText,
  Circle,
  Polygon,
} from 'react-native-svg';
import { COLORS } from '../constants/theme';
import { t } from '../locales/i18n';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');
const CANVAS_WIDTH = 1000;
const CANVAS_HEIGHT = 750;

export default function PlanViewerModal({
  visible,
  plan,
  floor = 'UG',
  room = null,
  currentLang = 'de',
  onClose,
}) {
  const [scale, setScale] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [currentZoomLabel, setCurrentZoomLabel] = useState('100%');

  // Refs for tracking pinch & pan
  const scaleRef = useRef(1);
  const panRef = useRef({ x: 0, y: 0 });
  const initialDistanceRef = useRef(null);
  const initialScaleRef = useRef(1);
  const lastTouchPosRef = useRef({ x: 0, y: 0 });

  useEffect(() => {
    if (visible) {
      // Reset zoom on open
      setScale(1);
      setPan({ x: 0, y: 0 });
      scaleRef.current = 1;
      panRef.current = { x: 0, y: 0 };
      setCurrentZoomLabel('100%');
    }
  }, [visible, plan?.id]);

  const updateZoomState = (newScale, newPan) => {
    const clampedScale = Math.min(6.0, Math.max(0.8, newScale));
    setScale(clampedScale);
    scaleRef.current = clampedScale;
    setCurrentZoomLabel(`${Math.round(clampedScale * 100)}%`);

    if (newPan) {
      // Clamping pan bounds based on zoom
      const maxPanX = ((CANVAS_WIDTH * clampedScale) - SCREEN_WIDTH) / 2 + 100;
      const maxPanY = ((CANVAS_HEIGHT * clampedScale) - SCREEN_HEIGHT) / 2 + 150;
      const clampedX = Math.max(-maxPanX, Math.min(maxPanX, newPan.x));
      const clampedY = Math.max(-maxPanY, Math.min(maxPanY, newPan.y));
      setPan({ x: clampedX, y: clampedY });
      panRef.current = { x: clampedX, y: clampedY };
    }
  };

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: (evt) => {
        const touches = evt.nativeEvent.touches;
        if (touches.length === 2) {
          // Pinch start
          const dx = touches[0].pageX - touches[1].pageX;
          const dy = touches[0].pageY - touches[1].pageY;
          initialDistanceRef.current = Math.hypot(dx, dy);
          initialScaleRef.current = scaleRef.current;
        } else if (touches.length === 1) {
          // Pan start
          lastTouchPosRef.current = { x: touches[0].pageX, y: touches[0].pageY };
        }
      },
      onPanResponderMove: (evt) => {
        const touches = evt.nativeEvent.touches;
        if (touches.length === 2) {
          // Continuous Pinch-to-Zoom
          const dx = touches[0].pageX - touches[1].pageX;
          const dy = touches[0].pageY - touches[1].pageY;
          const currentDistance = Math.hypot(dx, dy);

          if (initialDistanceRef.current && initialDistanceRef.current > 0) {
            const distanceRatio = currentDistance / initialDistanceRef.current;
            const nextScale = initialScaleRef.current * distanceRatio;
            updateZoomState(nextScale, panRef.current);
          }
        } else if (touches.length === 1) {
          // Single-finger Pan (dragging the plan)
          const currentX = touches[0].pageX;
          const currentY = touches[0].pageY;
          const deltaX = currentX - lastTouchPosRef.current.x;
          const deltaY = currentY - lastTouchPosRef.current.y;
          lastTouchPosRef.current = { x: currentX, y: currentY };

          const nextPan = {
            x: panRef.current.x + deltaX,
            y: panRef.current.y + deltaY,
          };
          updateZoomState(scaleRef.current, nextPan);
        }
      },
      onPanResponderRelease: () => {
        initialDistanceRef.current = null;
      },
    })
  ).current;

  // Zoom Button Controls
  const handleZoomIn = () => {
    updateZoomState(scaleRef.current + 0.5, panRef.current);
  };

  const handleZoomOut = () => {
    updateZoomState(scaleRef.current - 0.5, panRef.current);
  };

  const handleResetZoom = () => {
    updateZoomState(1.0, { x: 0, y: 0 });
  };

  const handleMaxZoom = () => {
    updateZoomState(3.5, { x: 0, y: 0 });
  };

  const handleOpenExternalPdf = async () => {
    const uri = plan?.localUri || plan?.pdfUrl || plan?.downloadUrl;
    if (!uri) return;
    try {
      const supported = await Linking.canOpenURL(uri);
      if (supported) {
        await Linking.openURL(uri);
      } else {
        await Linking.openURL(uri);
      }
    } catch (e) {
      console.warn('Could not open external PDF viewer:', e);
    }
  };

  if (!visible) return null;

  const floorLabel = floor?.toUpperCase() || 'UG';
  const planName = plan?.name || `${t('planViewerTitle', currentLang)} ${floorLabel}`;
  const isLocalReady = Boolean(plan?.localUri);

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="fullScreen">
      <SafeAreaView style={styles.container}>
        {/* Top Header Bar */}
        <View style={styles.header}>
          <View style={styles.headerTitleBox}>
            <View style={styles.titleRow}>
              <Text style={styles.headerTitle} numberOfLines={1}>
                {planName}
              </Text>
              <View style={styles.floorBadge}>
                <Text style={styles.floorBadgeText}>{floorLabel}</Text>
              </View>
            </View>
            <View style={styles.metaRow}>
              <Text style={styles.statusBadge}>
                {isLocalReady ? t('planOfflineBadge', currentLang) : `☁️ ${plan?.fileName || 'PDF Online'}`}
              </Text>
              {plan?.size ? (
                <Text style={styles.fileSizeText}>
                  · {(plan.size / (1024 * 1024)).toFixed(1)} MB
                </Text>
              ) : null}
            </View>
          </View>

          <TouchableOpacity
            style={styles.closeBtn}
            onPress={onClose}
            activeOpacity={0.7}
            hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
          >
            <Text style={styles.closeBtnText}>✕</Text>
          </TouchableOpacity>
        </View>

        {/* CAD Blueprint Pinch-to-Zoom Viewport */}
        <View style={styles.viewport} {...panResponder.panHandlers}>
          <Animated.View
            style={[
              styles.canvasWrapper,
              {
                transform: [
                  { translateX: pan.x },
                  { translateY: pan.y },
                  { scale: scale },
                ],
              },
            ]}
          >
            {/* SVG Montageplan Blueprint */}
            <Svg width={CANVAS_WIDTH} height={CANVAS_HEIGHT} viewBox="0 0 1000 750">
              {/* CAD Blueprint Background */}
              <Rect width="1000" height="750" fill="#0F172A" />

              {/* Grid Lines */}
              {Array.from({ length: 20 }).map((_, i) => (
                <Line
                  key={`gx_${i}`}
                  x1={i * 50}
                  y1="0"
                  x2={i * 50}
                  y2="750"
                  stroke="#1E293B"
                  strokeWidth="1"
                  strokeDasharray="2,2"
                />
              ))}
              {Array.from({ length: 15 }).map((_, i) => (
                <Line
                  key={`gy_${i}`}
                  x1="0"
                  y1={i * 50}
                  x2="1000"
                  y2={i * 50}
                  stroke="#1E293B"
                  strokeWidth="1"
                  strokeDasharray="2,2"
                />
              ))}

              {/* Outer Plan Border */}
              <Rect
                x="30"
                y="30"
                width="940"
                height="690"
                fill="none"
                stroke="#38BDF8"
                strokeWidth="2.5"
              />

              {/* Title Block Bottom Right */}
              <Rect x="640" y="610" width="310" height="90" fill="#1E293B" stroke="#38BDF8" strokeWidth="1.5" />
              <SvgText x="655" y="635" fill="#38BDF8" fontSize="13" fontWeight="bold">
                BURK HAUSTECHNIK GMBH
              </SvgText>
              <SvgText x="655" y="655" fill="#E2E8F0" fontSize="11">
                Vorhaben: Hallenbad Weingarten · {floorLabel}
              </SvgText>
              <SvgText x="655" y="675" fill="#94A3B8" fontSize="10">
                Plan: {planName} · Maßstab 1:50
              </SvgText>
              <SvgText x="655" y="692" fill="#22C55E" fontSize="9">
                ✓ Freigegeben zur Montage · Stand 2026
              </SvgText>

              {/* ======================================================== */}
              {/* ARCHITECTURE & ROOM WALLS */}
              {/* ======================================================== */}

              {/* Room 1: UG-101 / WC-Bereich */}
              <Rect
                x="70"
                y="80"
                width="280"
                height="240"
                fill={room?.code === 'UG-101' ? 'rgba(56, 189, 248, 0.15)' : '#1E293B'}
                stroke={room?.code === 'UG-101' ? '#38BDF8' : '#94A3B8'}
                strokeWidth={room?.code === 'UG-101' ? '3' : '2'}
              />
              <SvgText x="85" y="110" fill="#38BDF8" fontSize="14" fontWeight="bold">
                UG-101 · WC-Bereich
              </SvgText>
              <SvgText x="85" y="130" fill="#64748B" fontSize="11">
                A = 18.5 m² · RH = 2.80 m
              </SvgText>

              {/* Room 2: UG-102 / Technikraum */}
              <Rect
                x="380"
                y="80"
                width="310"
                height="240"
                fill={room?.code === 'UG-102' ? 'rgba(56, 189, 248, 0.15)' : '#1E293B'}
                stroke={room?.code === 'UG-102' ? '#38BDF8' : '#94A3B8'}
                strokeWidth={room?.code === 'UG-102' ? '3' : '2'}
              />
              <SvgText x="395" y="110" fill="#38BDF8" fontSize="14" fontWeight="bold">
                UG-102 · Technikraum / Verteiler
              </SvgText>
              <SvgText x="395" y="130" fill="#64748B" fontSize="11">
                A = 24.0 m² · Grauwasser-Hebeanlage
              </SvgText>

              {/* Room 3: UG-103 / Flur */}
              <Rect
                x="70"
                y="340"
                width="620"
                height="90"
                fill={room?.code === 'UG-103' ? 'rgba(56, 189, 248, 0.15)' : '#132036'}
                stroke={room?.code === 'UG-103' ? '#38BDF8' : '#64748B'}
                strokeWidth="1.5"
              />
              <SvgText x="85" y="380" fill="#94A3B8" fontSize="13" fontWeight="bold">
                UG-103 · Haupttrasse Flur
              </SvgText>

              {/* Room 4: Schacht & Vorbereitung */}
              <Rect
                x="710"
                y="80"
                width="230"
                height="350"
                fill="#1E293B"
                stroke="#94A3B8"
                strokeWidth="2"
              />
              <SvgText x="725" y="110" fill="#38BDF8" fontSize="13" fontWeight="bold">
                Steigeschacht S-01
              </SvgText>
              <SvgText x="725" y="130" fill="#64748B" fontSize="10">
                Steigstränge zu EG/OG/DG
              </SvgText>

              {/* Room 5: Unterer Bereich / Duschen & Umkleiden */}
              <Rect
                x="70"
                y="450"
                width="540"
                height="230"
                fill="#1E293B"
                stroke="#94A3B8"
                strokeWidth="2"
              />
              <SvgText x="85" y="480" fill="#38BDF8" fontSize="14" fontWeight="bold">
                UG-104 / 105 · Duschbereich & Nasszellen
              </SvgText>
              <SvgText x="85" y="500" fill="#64748B" fontSize="11">
                Abläufe DN 70 / Bodeneinläufe
              </SvgText>

              {/* ======================================================== */}
              {/* PIPE CONDUITS & TRASSEN WITH DIMENSIONS */}
              {/* ======================================================== */}

              {/* 1. ABWASSER GRUNDLEITUNG / SCHMUTZWASSER (Orange/Braun) */}
              <Path
                d="M 120 280 L 120 380 L 450 380 L 450 250 L 750 250 L 750 140"
                stroke="#F97316"
                strokeWidth="6"
                fill="none"
              />
              <Circle cx="120" cy="280" r="7" fill="#F97316" />
              <Circle cx="450" cy="250" r="7" fill="#F97316" />
              <Circle cx="750" cy="140" r="7" fill="#F97316" />

              {/* Abwasser Dimension Labels */}
              <Rect x="200" y="360" width="85" height="18" fill="#F97316" rx="4" />
              <SvgText x="205" y="373" fill="#FFFFFF" fontSize="10" fontWeight="bold">
                DN 100 HT 2%
              </SvgText>

              <Rect x="540" y="235" width="85" height="18" fill="#F97316" rx="4" />
              <SvgText x="545" y="248" fill="#FFFFFF" fontSize="10" fontWeight="bold">
                DN 100 SML
              </SvgText>

              <Rect x="130" y="240" width="65" height="16" fill="#EA580C" rx="3" />
              <SvgText x="135" y="252" fill="#FFFFFF" fontSize="9" fontWeight="bold">
                DN 50 Abw.
              </SvgText>

              {/* 2. TRINKWASSER KALT (Blau) */}
              <Path
                d="M 420 180 L 420 365 L 100 365 L 100 200 L 220 200"
                stroke="#0284C7"
                strokeWidth="4"
                fill="none"
              />
              <Circle cx="420" cy="180" r="5" fill="#0284C7" />
              <Circle cx="220" cy="200" r="5" fill="#0284C7" />

              <Rect x="250" y="348" width="80" height="15" fill="#0284C7" rx="3" />
              <SvgText x="255" y="359" fill="#FFFFFF" fontSize="9" fontWeight="bold">
                TW-K DN 28x1.2
              </SvgText>

              {/* 3. TRINKWASSER WARM & ZIRKULATION (Rot & Violett) */}
              <Path
                d="M 435 180 L 435 355 L 110 355 L 110 215 L 220 215"
                stroke="#EF4444"
                strokeWidth="3.5"
                fill="none"
              />
              <Rect x="250" y="330" width="80" height="15" fill="#EF4444" rx="3" />
              <SvgText x="255" y="341" fill="#FFFFFF" fontSize="9" fontWeight="bold">
                TW-W DN 22x1.2
              </SvgText>

              {/* Verteiler Station in UG-102 */}
              <Rect x="480" y="150" width="120" height="80" fill="#0F766E" stroke="#2DD4BF" strokeWidth="2" rx="6" />
              <SvgText x="490" y="175" fill="#FFFFFF" fontSize="11" fontWeight="bold">
                HEIZ- & SANITÄR
              </SvgText>
              <SvgText x="490" y="195" fill="#99F6E4" fontSize="10">
                VERTEILER V-UG
              </SvgText>
              <SvgText x="490" y="215" fill="#FFFFFF" fontSize="9">
                6 Heizkr. / 4 Sanitär
              </SvgText>

              {/* Geberit Duofix Installationswand in UG-101 */}
              <Line x1="100" y1="150" x2="100" y2="270" stroke="#E2E8F0" strokeWidth="8" />
              <Circle cx="100" cy="170" r="10" fill="#3B82F6" />
              <SvgText x="120" y="174" fill="#E2E8F0" fontSize="10">
                WC 1 (Geberit 111.003)
              </SvgText>
              <Circle cx="100" cy="210" r="10" fill="#3B82F6" />
              <SvgText x="120" y="214" fill="#E2E8F0" fontSize="10">
                WC 2 (Geberit 111.003)
              </SvgText>
              <Circle cx="100" cy="250" r="10" fill="#3B82F6" />
              <SvgText x="120" y="254" fill="#E2E8F0" fontSize="10">
                WC 3 (Barrierefrei)
              </SvgText>

              {/* Massketten / Dimension Strings */}
              <Line x1="70" y1="65" x2="350" y2="65" stroke="#64748B" strokeWidth="1" />
              <Line x1="70" y1="60" x2="70" y2="70" stroke="#64748B" strokeWidth="1" />
              <Line x1="350" y1="60" x2="350" y2="70" stroke="#64748B" strokeWidth="1" />
              <SvgText x="190" y="60" fill="#94A3B8" fontSize="10" textAnchor="middle">
                5.60 m
              </SvgText>

              <Line x1="380" y1="65" x2="690" y2="65" stroke="#64748B" strokeWidth="1" />
              <Line x1="380" y1="60" x2="380" y2="70" stroke="#64748B" strokeWidth="1" />
              <Line x1="690" y1="60" x2="690" y2="70" stroke="#64748B" strokeWidth="1" />
              <SvgText x="525" y="60" fill="#94A3B8" fontSize="10" textAnchor="middle">
                6.20 m
              </SvgText>

              {/* Legend Bottom Left */}
              <Rect x="45" y="620" width="380" height="90" fill="#1E293B" stroke="#475569" strokeWidth="1" rx="4" />
              <SvgText x="55" y="638" fill="#E2E8F0" fontSize="11" fontWeight="bold">
                LEGENDE & TRASSENFARBEN
              </SvgText>

              <Line x1="55" y1="655" x2="85" y2="655" stroke="#F97316" strokeWidth="4" />
              <SvgText x="95" y="659" fill="#CBD5E1" fontSize="10">
                Schmutzwasser / Grundleitung (DN 50 - DN 100)
              </SvgText>

              <Line x1="55" y1="675" x2="85" y2="675" stroke="#0284C7" strokeWidth="3" />
              <SvgText x="95" y="679" fill="#CBD5E1" fontSize="10">
                Kaltwasser Edelstahl PEX (DN 15 - DN 28)
              </SvgText>

              <Line x1="55" y1="695" x2="85" y2="695" stroke="#EF4444" strokeWidth="3" />
              <SvgText x="95" y="699" fill="#CBD5E1" fontSize="10">
                Warmwasser / Zirkulation gedämmt
              </SvgText>
            </Svg>
          </Animated.View>
        </View>

        {/* Floating Zoom & Action Controls Bar */}
        <View style={styles.controlsBar}>
          <View style={styles.zoomButtonsGroup}>
            <TouchableOpacity style={styles.zoomBtn} onPress={handleZoomOut} activeOpacity={0.7}>
              <Text style={styles.zoomBtnText}>−</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.zoomResetBtn} onPress={handleResetZoom} activeOpacity={0.7}>
              <Text style={styles.zoomResetText}>{currentZoomLabel}</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.zoomBtn} onPress={handleZoomIn} activeOpacity={0.7}>
              <Text style={styles.zoomBtnText}>+</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.zoomMaxBtn} onPress={handleMaxZoom} activeOpacity={0.7}>
              <Text style={styles.zoomMaxText}>🔍 3.5x</Text>
            </TouchableOpacity>
          </View>

          <TouchableOpacity
            style={styles.externalPdfBtn}
            onPress={handleOpenExternalPdf}
            activeOpacity={0.8}
          >
            <Text style={styles.externalPdfText}>↗ {t('planOpenExternal', currentLang)}</Text>
          </TouchableOpacity>
        </View>

        {/* Footer Hint */}
        <View style={styles.footerHintBar}>
          <Text style={styles.footerHintText}>
            📐 {t('planPinchHint', currentLang)} · {floorLabel}
          </Text>
        </View>
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#090D16',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#0F172A',
    borderBottomWidth: 1,
    borderBottomColor: '#1E293B',
  },
  headerTitleBox: {
    flex: 1,
    marginRight: 12,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#F8FAFC',
    flexShrink: 1,
  },
  floorBadge: {
    backgroundColor: '#0284C7',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
  },
  floorBadgeText: {
    color: '#FFFFFF',
    fontWeight: '800',
    fontSize: 11,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 3,
  },
  statusBadge: {
    fontSize: 11,
    color: '#38BDF8',
    fontWeight: '600',
  },
  fileSizeText: {
    fontSize: 11,
    color: '#64748B',
    marginLeft: 4,
  },
  closeBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: 'rgba(255,255,255,0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeBtnText: {
    color: '#F8FAFC',
    fontSize: 18,
    fontWeight: '700',
  },
  viewport: {
    flex: 1,
    overflow: 'hidden',
    backgroundColor: '#090D16',
    alignItems: 'center',
    justifyContent: 'center',
  },
  canvasWrapper: {
    width: CANVAS_WIDTH,
    height: CANVAS_HEIGHT,
    alignItems: 'center',
    justifyContent: 'center',
  },
  controlsBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 10,
    backgroundColor: '#0F172A',
    borderTopWidth: 1,
    borderTopColor: '#1E293B',
    gap: 10,
  },
  zoomButtonsGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  zoomBtn: {
    width: 38,
    height: 38,
    borderRadius: 8,
    backgroundColor: '#1E293B',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#334155',
  },
  zoomBtnText: {
    color: '#F8FAFC',
    fontSize: 20,
    fontWeight: '700',
  },
  zoomResetBtn: {
    paddingHorizontal: 10,
    height: 38,
    borderRadius: 8,
    backgroundColor: '#1E293B',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#334155',
  },
  zoomResetText: {
    color: '#38BDF8',
    fontSize: 12,
    fontWeight: '800',
  },
  zoomMaxBtn: {
    paddingHorizontal: 8,
    height: 38,
    borderRadius: 8,
    backgroundColor: 'rgba(2, 132, 199, 0.2)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#0284C7',
  },
  zoomMaxText: {
    color: '#38BDF8',
    fontSize: 11,
    fontWeight: '700',
  },
  externalPdfBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#0284C7',
    paddingHorizontal: 12,
    height: 38,
    borderRadius: 8,
  },
  externalPdfText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
  },
  footerHintBar: {
    backgroundColor: '#090D16',
    paddingVertical: 6,
    alignItems: 'center',
  },
  footerHintText: {
    fontSize: 11,
    color: '#64748B',
    fontWeight: '500',
  },
});
