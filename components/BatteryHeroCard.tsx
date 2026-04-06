import { useEffect, useMemo, useRef } from 'react';
import { Animated, Easing, StyleProp, StyleSheet, Text, View, ViewStyle } from 'react-native';
import { useWindowDimensions } from 'react-native';
import Svg, { Defs, LinearGradient, Rect, Stop } from 'react-native-svg';

import { AppTheme } from '@/constants/theme';
import { useAppTheme } from '@/hooks/useAppTheme';

interface Props {
  percent: number;
  voltage: number;
  current: number;
  powerW: number;
  estimatedHours: number;
  style?: StyleProp<ViewStyle>;
}

export function BatteryHeroCard({ percent, voltage, current, powerW, estimatedHours, style }: Props) {
  const { theme, themeMode } = useAppTheme();
  const { width } = useWindowDimensions();
  const gradientIdRef = useRef(`batteryGlow${Math.random().toString(36).slice(2, 9)}`);
  const isLight = themeMode === 'light';
  const isCompact = width < 390;
  const styles = useMemo(() => createStyles(theme, isLight), [theme, isLight]);
  const blinkAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(blinkAnim, { toValue: 0.2, duration: 750, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
        Animated.timing(blinkAnim, { toValue: 1, duration: 750, easing: Easing.inOut(Easing.quad), useNativeDriver: true })
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [blinkAnim]);

  const safePercent = Math.max(0, Math.min(100, Math.round(percent)));
  const hoursLabel = estimatedHours > 0 ? `${Math.round(estimatedHours)}` : '--';
  const accentStrong = isLight ? '232,84,42' : '61,220,132';
  const accentSoft = isLight ? '217,119,6' : '34,197,94';
  const glowLayerOpacity = isCompact ? (isLight ? 0.58 : 0.5) : 0.78;
  const bandStartAlpha = isCompact ? (isLight ? 0.12 : 0.1) : isLight ? 0.18 : 0.14;
  const bandMidAlpha = isCompact ? (isLight ? 0.07 : 0.06) : isLight ? 0.12 : 0.09;
  const sweepStartAlpha = isCompact ? (isLight ? 0.09 : 0.08) : isLight ? 0.14 : 0.12;
  const bandId = `${gradientIdRef.current}-band`;
  const sweepId = `${gradientIdRef.current}-sweep`;
  const bandRect = isCompact
    ? { x: 118, y: 118, width: 198, height: 148, radius: 38, rotate: -14, cx: 217, cy: 192 }
    : { x: 148, y: 114, width: 220, height: 160, radius: 42, rotate: -18, cx: 258, cy: 194 };
  const sweepRect = isCompact
    ? { x: 196, y: -8, width: 96, height: 168, radius: 24, rotate: 14, cx: 244, cy: 76 }
    : { x: 224, y: -6, width: 106, height: 180, radius: 28, rotate: 20, cx: 277, cy: 84 };

  return (
    <View style={[styles.card, style]}>
      <View style={styles.header}>
        <View style={styles.badge}>
          <Animated.View style={[styles.badgeDot, { opacity: blinkAnim }]} />
          <Text style={styles.badgeText}>Nivel baterie</Text>
        </View>
        <View style={styles.plusBtn}>
          <Text style={styles.plusBtnText}>+</Text>
        </View>
      </View>

      <View style={styles.pctRow}>
        <Text selectable style={styles.pctNumber}>{safePercent}</Text>
        <Text style={styles.pctSign}>%</Text>
          <Text style={styles.pctArrow}>↗</Text>
      </View>

      <View style={{ justifyContent: 'space-between', flex: 1 }}>
        <Text style={styles.record}>Autonomie estimată: {hoursLabel} ore</Text>

        <View style={styles.statsRow}>
          <View style={styles.statBlock}>
            <Text style={styles.statLabel}>Tensiune</Text>
            <Text selectable style={styles.statVal}>{voltage.toFixed(2)} V</Text>
          </View>
          <View style={styles.statBlock}>
            <Text style={styles.statLabel}>Consum</Text>
            <Text selectable style={styles.statVal}>{Math.round(current)} mA</Text>
          </View>
          <View style={styles.statBlock}>
            <Text style={styles.statLabel}>Putere</Text>
            <Text selectable style={styles.statVal}>{powerW.toFixed(2)} W</Text>
          </View>
          </View>
      </View>

      {/* Glow overlay - radial gradients for a true fade-out effect */}
      <Svg
        pointerEvents="none"
        style={[styles.glowSvg, { opacity: glowLayerOpacity }]}
        width="100%"
        height="100%"
        viewBox="0 0 320 220"
        preserveAspectRatio="none"
      >
        <Defs>
          <LinearGradient id={bandId} x1="0%" y1="0%" x2="100%" y2="100%">
            <Stop offset="0%" stopColor={`rgb(${accentStrong})`} stopOpacity={bandStartAlpha} />
            <Stop offset="52%" stopColor={`rgb(${accentSoft})`} stopOpacity={bandMidAlpha} />
            <Stop offset="100%" stopColor={`rgb(${accentSoft})`} stopOpacity={0} />
          </LinearGradient>
          <LinearGradient id={sweepId} x1="0%" y1="0%" x2="0%" y2="100%">
            <Stop offset="0%" stopColor={`rgb(${accentStrong})`} stopOpacity={sweepStartAlpha} />
            <Stop offset="58%" stopColor={`rgb(${accentSoft})`} stopOpacity={isCompact ? 0.03 : 0.05} />
            <Stop offset="100%" stopColor={`rgb(${accentSoft})`} stopOpacity={0} />
          </LinearGradient>
        </Defs>

        <Rect
          x={bandRect.x}
          y={bandRect.y}
          width={bandRect.width}
          height={bandRect.height}
          rx={bandRect.radius}
          fill={`url(#${bandId})`}
          transform={`rotate(${bandRect.rotate} ${bandRect.cx} ${bandRect.cy})`}
        />
        <Rect
          x={sweepRect.x}
          y={sweepRect.y}
          width={sweepRect.width}
          height={sweepRect.height}
          rx={sweepRect.radius}
          fill={`url(#${sweepId})`}
          transform={`rotate(${sweepRect.rotate} ${sweepRect.cx} ${sweepRect.cy})`}
        />
      </Svg>
    </View>
  );
}

const createStyles = (theme: AppTheme, isLight: boolean) => StyleSheet.create({
  card: {
    backgroundColor: isLight ? theme.colors.surfaceAlt : '#141f18',
    borderRadius: 18,
    borderCurve: 'continuous',
    borderWidth: 1,
    borderColor: isLight ? theme.colors.border : '#1e3328',
    padding: 14,
    overflow: 'hidden',
    marginBottom: 12,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6
  },
  plusBtn: {
    width: 28,
    height: 28,
    backgroundColor: isLight ? 'rgba(22,163,74,0.16)' : theme.colors.success,
    borderWidth: isLight ? 1 : 0,
    borderColor: isLight ? 'rgba(22,163,74,0.3)' : 'transparent',
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center'
  },
  plusBtnText: {
    fontSize: 16,
    color: isLight ? theme.colors.success : '#111',
    fontWeight: '700',
    lineHeight: 18
  },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: isLight ? 'rgba(22,163,74,0.1)' : 'rgba(61,220,132,0.12)',
    borderWidth: 1,
    borderColor: isLight ? 'rgba(22,163,74,0.2)' : 'rgba(61,220,132,0.2)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 20
  },
  badgeDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: theme.colors.success
  },
  badgeText: {
    color: theme.colors.success,
    fontFamily: theme.font.bold,
    fontSize: 13
  },
  pctRow: {
    flexDirection: 'row',
    alignItems: 'flex-start'
  },
  pctNumber: {
    fontSize: 60,
    fontFamily: theme.font.mono,
    fontWeight: '700',
    color: theme.colors.text,
    lineHeight: 66
  },
  pctSign: {
    fontSize: 60,
    fontFamily: theme.font.mono,
    fontWeight: '700',
    color: theme.colors.text,
    lineHeight: 66,
    marginLeft: 4
  },
  pctArrow: {
    fontSize: 24,
    color: theme.colors.success,
    marginTop: 10,
    marginLeft: 8
  },
  record: {
    color: theme.colors.success,
    fontFamily: theme.font.bold,
    fontSize: 14,
    marginTop: 6,
    marginBottom: 4
  },
  statsRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 6
  },
  statBlock: {
    flex: 1,
    backgroundColor: isLight ? theme.colors.surfaceMuted : 'rgba(61,220,132,0.08)',
    borderWidth: 1,
    borderColor: isLight ? theme.colors.border : 'rgba(61,220,132,0.2)',
    borderRadius: 10,
    paddingVertical: 8,
    paddingHorizontal: 10
  },
  statLabel: {
    color: theme.colors.textSoft,
    fontFamily: theme.font.medium,
    fontSize: 11,
    marginBottom: 2
  },
  statVal: {
    color: theme.colors.text,
    fontFamily: theme.font.mono,
    fontSize: 15,
    fontWeight: '700'
  },
  glowSvg: {
    ...StyleSheet.absoluteFillObject,
  }
});
