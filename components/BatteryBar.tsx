import { StyleSheet, Text, View } from 'react-native';

import { theme } from '@/constants/theme';

interface Props {
  percent: number;
}

export function BatteryBar({ percent }: Props) {
  const value = Math.max(0, Math.min(100, percent));
  const color = value > 50 ? '#16A34A' : value > 20 ? '#D97706' : '#DC2626';

  return (
    <View style={styles.wrap}>
      <View style={styles.track}>
        <View style={[styles.fill, { width: `${value}%`, backgroundColor: color }]} />
      </View>
      <Text style={styles.label}>{`${value.toFixed(1)}%`}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    marginTop: 12,
    marginBottom: 8
  },
  track: {
    width: '100%',
    height: 16,
    borderRadius: 999,
    backgroundColor: theme.colors.border,
    overflow: 'hidden'
  },
  fill: {
    height: '100%',
    borderRadius: 999
  },
  label: {
    marginTop: 8,
    color: theme.colors.primary,
    fontFamily: theme.font.bold,
    fontSize: 28,
    lineHeight: 34
  }
});
