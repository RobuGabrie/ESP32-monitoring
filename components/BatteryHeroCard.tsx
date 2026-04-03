import { useEffect, useMemo, useRef } from 'react';
import { Animated, Easing, StyleProp, StyleSheet, Text, View, ViewStyle } from 'react-native';
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
  const isLight = themeMode === 'light';
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
        style={styles.glowSvg}
        width="100%"
        height="100%"
        viewBox="0 0 320 220"
        preserveAspectRatio="none"
      >
        <Defs>
          <LinearGradient id="accentBand" x1="0%" y1="0%" x2="100%" y2="100%">
            <Stop offset="0%" stopColor={`rgba(${accentStrong},${isLight ? 0.24 : 0.16})`} />
            <Stop offset="55%" stopColor={`rgba(${accentSoft},${isLight ? 0.16 : 0.1})`} />
            <Stop offset="100%" stopColor="rgba(0,0,0,0)" />
          </LinearGradient>
          <LinearGradient id="accentSweep" x1="0%" y1="0%" x2="0%" y2="100%">
            <Stop offset="0%" stopColor={`rgba(${accentStrong},${isLight ? 0.18 : 0.14})`} />
            <Stop offset="100%" stopColor="rgba(0,0,0,0)" />
          </LinearGradient>
        </Defs>

        <Rect x="148" y="114" width="220" height="160" rx="42" fill="url(#accentBand)" transform="rotate(-18 258 194)" />
        <Rect x="224" y="-6" width="106" height="180" rx="28" fill="url(#accentSweep)" transform="rotate(20 277 84)" />
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
