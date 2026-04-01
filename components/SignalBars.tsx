import { StyleSheet, Text, View } from 'react-native';

import { theme } from '@/constants/theme';

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
  const safeRssi = toSafeRssi(rssi);
  const level = levelFromRssi(rssi);
  const levelLabel = labelFromLevel(level);

  return (
    <View style={[styles.wrap, embedded ? styles.wrapEmbedded : null]}>
      <View style={styles.barsRow}>
        {[1, 2, 3, 4].map((n) => (
          <Bar key={n} index={n} level={level} withRightSpacing={n < 4} />
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

function Bar({ index, level, withRightSpacing }: { index: number; level: number; withRightSpacing: boolean }) {
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

const styles = StyleSheet.create({
  wrap: {
    backgroundColor: theme.colors.card,
    borderRadius: 18,
    padding: 14,
    borderWidth: 1,
    borderColor: '#E6EBF2',
    borderLeftWidth: 3,
    borderLeftColor: '#D1FAE5',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    marginBottom: 14
  },
  wrapEmbedded: {
    marginBottom: 0,
    borderLeftWidth: 1,
    borderLeftColor: '#DCE4F0',
    backgroundColor: '#F8FAFC'
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
    backgroundColor: '#ECFDF5',
    borderWidth: 1,
    borderColor: '#A7F3D0',
    paddingHorizontal: 9,
    paddingVertical: 3
  },
  levelPillText: {
    color: '#065F46',
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
    backgroundColor: '#22C55E'
  },
  barOff: {
    backgroundColor: '#D1D5DB'
  }
});
