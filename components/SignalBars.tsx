import { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { AppTheme } from '@/constants/theme';
import { useAppTheme } from '@/hooks/useAppTheme';

interface Props {
  rssi: number | string | null | undefined;
  embedded?: boolean;
}

const toSafeRssi = (value: Props['rssi']) => {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === 'string') {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }

  return -99;
};

const levelFromRssi = (rssi: Props['rssi']) => {
  const safeRssi = toSafeRssi(rssi);
  if (safeRssi >= -60) return 4;
  if (safeRssi >= -70) return 3;
  if (safeRssi >= -80) return 2;
  if (safeRssi >= -90) return 1;
  return 0;
};

const labelFromLevel = (level: number) => {
  if (level >= 4) return 'Excelent';
  if (level === 3) return 'Bun';
  if (level === 2) return 'Mediu';
  if (level === 1) return 'Slab';
  return 'Foarte slab';
};

export function SignalBars({ rssi, embedded = false }: Props) {
  const { theme } = useAppTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const safeRssi = toSafeRssi(rssi);
  const level = levelFromRssi(rssi);
  const levelLabel = labelFromLevel(level);

  return (
    <View style={[styles.wrap, embedded ? styles.wrapEmbedded : null]}>
      <View style={styles.barsRow}>
        {[1, 2, 3, 4].map((n) => (
          <Bar key={n} index={n} level={level} withRightSpacing={n < 4} styles={styles} />
        ))}
      </View>
      <View style={styles.labelWrap}>
        <Text style={styles.value}>{`${Math.round(safeRssi)} dBm`}</Text>
        <View style={styles.levelPill}>
          <Text style={styles.levelPillText}>{levelLabel}</Text>
        </View>
        <Text style={styles.label}>Calitate semnal Wi-Fi</Text>
      </View>
    </View>
  );
}

function Bar({
  index,
  level,
  withRightSpacing,
  styles
}: {
  index: number;
  level: number;
  withRightSpacing: boolean;
  styles: ReturnType<typeof createStyles>;
}) {
  return (
    <View
      style={[
        styles.bar,
        withRightSpacing && styles.barSpacing,
        { height: 8 + index * 7 },
        level >= index ? styles.barOn : styles.barOff
      ]}
    />
  );
}

const createStyles = (theme: AppTheme) => StyleSheet.create({
  wrap: {
    backgroundColor: theme.colors.card,
    borderRadius: 18,
    padding: 14,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderLeftWidth: 3,
    borderLeftColor: 'rgba(61,220,132,0.3)',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    marginBottom: 14
  },
  wrapEmbedded: {
    marginBottom: 0,
    borderLeftWidth: 1,
    borderLeftColor: theme.colors.border,
    backgroundColor: theme.colors.surfaceMuted
  },
  barsRow: {
    flexDirection: 'row',
    alignItems: 'flex-end'
  },
  labelWrap: {
    alignItems: 'flex-end'
  },
  value: {
    color: theme.colors.text,
    fontFamily: theme.font.bold,
    fontSize: 18
  },
  label: {
    marginTop: 4,
    color: theme.colors.textSoft,
    fontFamily: theme.font.medium,
    fontSize: 12
  },
  levelPill: {
    marginTop: 4,
    borderRadius: 999,
    backgroundColor: 'rgba(61,220,132,0.12)',
    borderWidth: 1,
    borderColor: 'rgba(61,220,132,0.3)',
    paddingHorizontal: 9,
    paddingVertical: 3
  },
  levelPillText: {
    color: '#3ddc84',
    fontFamily: theme.font.semiBold,
    fontSize: 11
  },
  bar: {
    width: 16,
    borderRadius: 4
  },
  barSpacing: {
    marginRight: 8
  },
  barOn: {
    backgroundColor: '#3ddc84'
  },
  barOff: {
    backgroundColor: '#333333'
  }
});
