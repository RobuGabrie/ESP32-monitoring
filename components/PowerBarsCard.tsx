import { useEffect, useMemo, useRef } from 'react';
import { Animated, StyleProp, StyleSheet, Text, View, ViewStyle } from 'react-native';

import { AppTheme } from '@/constants/theme';
import { useAppTheme } from '@/hooks/useAppTheme';

interface Props {
  currentMa: number;
  batteryPercent: number;
  voltage: number;
  powerW: number;
  estimatedHours: number;
  deltaPercent?: number;
  style?: StyleProp<ViewStyle>;
}

export function PowerBarsCard({ currentMa, batteryPercent, voltage, powerW, estimatedHours, deltaPercent = 0, style }: Props) {
  const { theme } = useAppTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const bar1Width = useRef(new Animated.Value(0)).current;
  const bar2Width = useRef(new Animated.Value(0)).current;

  const currentFill = Math.min(100, Math.max(5, (currentMa / 200) * 100));
  const batteryFill = Math.min(100, Math.max(5, batteryPercent));

  useEffect(() => {
    Animated.parallel([
      Animated.timing(bar1Width, { toValue: currentFill, duration: 1200, useNativeDriver: false }),
      Animated.timing(bar2Width, { toValue: batteryFill, duration: 1200, useNativeDriver: false })
    ]).start();
  }, [bar1Width, bar2Width, currentFill, batteryFill]);

  const isNeg = deltaPercent >= 0;
  const hoursLabel = estimatedHours > 0 ? `~${Math.round(estimatedHours)}h` : '--';

  return (
    <View style={[styles.card, style]}>
      <Text style={styles.title}>Consum Putere</Text>
      <Text style={styles.sub}>
        Față de ora precedentă{' '}
        <Text style={isNeg ? styles.deltaNeg : styles.deltaPos}>
          {isNeg ? '▲' : '▼'} {isNeg ? '+' : ''}{Math.abs(deltaPercent).toFixed(1)}%
        </Text>
      </Text>

      {/* Current bar */}
      <View style={styles.barSection}>
        <View style={styles.barLabelRow}>
          <Text style={styles.barLabel}>Curent activ</Text>
          <Text selectable style={styles.barValue}>{Math.round(currentMa)} mA</Text>
        </View>
        <View style={styles.barTrack}>
          <Animated.View
            style={[
              styles.barFillOrange,
              { width: bar1Width.interpolate({ inputRange: [0, 100], outputRange: ['0%', '100%'] }) }
            ]}
          >
            <Text style={styles.barInnerText}>ESP32-C3 · OLED · IMU</Text>
          </Animated.View>
        </View>
      </View>

      {/* Battery bar */}
      <View style={styles.barSection}>
        <View style={styles.barLabelRow}>
          <Text style={styles.barLabel}>Baterie rămasă</Text>
          <Text selectable style={styles.barValue}>{Math.round(batteryPercent)}%</Text>
        </View>
        <View style={styles.barTrack}>
          <Animated.View
            style={[
              styles.barFillGreen,
              { width: bar2Width.interpolate({ inputRange: [0, 100], outputRange: ['0%', '100%'] }) }
            ]}
          >
            <Text style={styles.barInnerText}>{voltage.toFixed(2)}V · {hoursLabel} autonomie</Text>
          </Animated.View>
        </View>
      </View>

      {/* Footer */}
      <View style={styles.footer}>
        <View>
          <Text style={styles.footerLabel}>Putere totală</Text>
          <Text selectable style={styles.footerVal}>{powerW.toFixed(2)} W</Text>
        </View>
        <Text style={[styles.footerDelta, isNeg ? styles.deltaNeg : styles.deltaPos]}>
          {isNeg ? '↙' : '↗'} {Math.abs(deltaPercent).toFixed(1)}%
        </Text>
      </View>
    </View>
  );
}

const createStyles = (theme: AppTheme) => StyleSheet.create({
  card: {
    backgroundColor: theme.colors.card,
    borderRadius: 18,
    borderCurve: 'continuous',
    padding: 18,
    overflow: 'hidden',
    marginBottom: 12
  },
  title: {
    color: theme.colors.text,
    fontFamily: theme.font.bold,
    fontSize: 17,
    marginBottom: 3
  },
  sub: {
    color: theme.colors.textSoft,
    fontFamily: theme.font.medium,
    fontSize: 13,
    marginBottom: 14
  },
  deltaNeg: {
    color: theme.colors.primary,
    fontFamily: theme.font.bold,
    fontSize: 12
  },
  deltaPos: {
    color: theme.colors.success,
    fontFamily: theme.font.bold,
    fontSize: 12
  },
  barSection: {
    marginBottom: 8
  },
  barLabelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4
  },
  barLabel: {
    color: theme.colors.textSoft,
    fontFamily: theme.font.medium,
    fontSize: 13
  },
  barValue: {
    color: theme.colors.text,
    fontFamily: theme.font.mono,
    fontSize: 14,
    fontWeight: '600'
  },
  barTrack: {
    height: 36,
    backgroundColor: theme.colors.surfaceMuted,
    borderRadius: 8,
    borderCurve: 'continuous',
    overflow: 'hidden'
  },
  barFillOrange: {
    height: '100%',
    backgroundColor: theme.colors.primary,
    borderRadius: 8,
    borderCurve: 'continuous',
    justifyContent: 'center',
    paddingHorizontal: 14
  },
  barFillGreen: {
    height: '100%',
    backgroundColor: theme.colors.success,
    borderRadius: 8,
    borderCurve: 'continuous',
    justifyContent: 'center',
    paddingHorizontal: 14
  },
  barInnerText: {
    color: 'rgba(255,255,255,0.85)',
    fontFamily: theme.font.bold,
    fontSize: 12
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: theme.colors.border,
    marginTop: 4
  },
  footerLabel: {
    color: theme.colors.textSoft,
    fontFamily: theme.font.medium,
    fontSize: 12,
    marginBottom: 3
  },
  footerVal: {
    color: theme.colors.text,
    fontFamily: theme.font.mono,
    fontSize: 17,
    fontWeight: '700'
  },
  footerDelta: {
    fontSize: 20,
    fontWeight: '700'
  }
});
