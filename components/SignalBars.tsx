import { StyleSheet, View } from 'react-native';

interface Props {
  rssi: number | string | null | undefined;
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

export function SignalBars({ rssi }: Props) {
  const level = levelFromRssi(rssi);

  return (
    <View style={styles.wrap}>
      {[1, 2, 3, 4].map((n) => (
        <Bar key={n} index={n} level={level} withRightSpacing={n < 4} />
      ))}
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
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    padding: 14,
    flexDirection: 'row',
    alignItems: 'flex-end',
    marginBottom: 14
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
