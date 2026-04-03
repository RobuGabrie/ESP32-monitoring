import { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { AppTheme } from '@/constants/theme';
import { useAppTheme } from '@/hooks/useAppTheme';

interface Props {
  percent: number;
}

export function BatteryBar({ percent }: Props) {
  const { theme } = useAppTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const value = Math.max(0, Math.min(100, percent));
  const color = value > 50 ? '#16A34A' : value > 20 ? '#D97706' : '#DC2626';
  const label = value > 70 ? 'Nivel bun' : value > 35 ? 'Nivel mediu' : 'Nivel scazut';

  return (
    <View style={styles.wrap}>
      <View style={styles.head}>
        <Text style={styles.headTitle}>Baterie</Text>
        <Text style={styles.headValue}>{`${value.toFixed(1)}%`}</Text>
      </View>
      <View style={styles.track}>
        <View style={[styles.fill, { width: `${value}%`, backgroundColor: color }]} />
      </View>
      <View style={styles.metaRow}>
        <Text style={styles.metaText}>{label}</Text>
        <Text style={styles.metaText}>0% - 100%</Text>
      </View>
    </View>
  );
}

const createStyles = (theme: AppTheme) => StyleSheet.create({
  wrap: {
    marginTop: 6,
    marginBottom: 8,
    backgroundColor: theme.colors.surfaceMuted,
    borderRadius: theme.radius.md,
    borderWidth: 1,
    borderColor: theme.colors.border,
    paddingHorizontal: 10,
    paddingVertical: 10
  },
  head: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8
  },
  headTitle: {
    color: theme.colors.textSoft,
    fontFamily: theme.font.medium,
    fontSize: 12
  },
  headValue: {
    color: theme.colors.text,
    fontFamily: theme.font.bold,
    fontSize: 18
  },
  track: {
    width: '100%',
    height: 14,
    borderRadius: 999,
    backgroundColor: theme.colors.border,
    overflow: 'hidden'
  },
  fill: {
    height: '100%',
    borderRadius: 999
  },
  metaRow: {
    marginTop: 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between'
  },
  metaText: {
    color: theme.colors.muted,
    fontFamily: theme.font.medium,
    fontSize: 11
  }
});
