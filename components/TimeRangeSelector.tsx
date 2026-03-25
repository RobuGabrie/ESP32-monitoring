import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { theme } from '@/constants/theme';
import { TimeRangeKey } from '@/hooks/useStore';

interface Props {
  value: TimeRangeKey;
  onChange: (value: TimeRangeKey) => void;
}

const OPTIONS: Array<{ key: TimeRangeKey; label: string }> = [
  { key: '15m', label: '15m' },
  { key: '1h', label: '1h' },
  { key: '6h', label: '6h' },
  { key: '24h', label: '24h' },
  { key: '7d', label: '7d' },
  { key: 'all', label: 'Toate' }
];

export function TimeRangeSelector({ value, onChange }: Props) {
  return (
    <View style={styles.wrap}>
      <Text style={styles.label}>Interval de timp</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.row}>
        {OPTIONS.map((option) => {
          const active = option.key === value;
          return (
            <Pressable
              key={option.key}
              onPress={() => onChange(option.key)}
              style={[styles.chip, active ? styles.chipActive : styles.chipIdle]}
            >
              <Text style={[styles.chipText, active ? styles.chipTextActive : styles.chipTextIdle]}>{option.label}</Text>
            </Pressable>
          );
        })}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    marginBottom: theme.spacing.md
  },
  label: {
    fontSize: 12,
    color: theme.colors.muted,
    fontFamily: theme.font.medium,
    marginBottom: 8
  },
  row: {
    gap: 8,
    paddingRight: 8
  },
  chip: {
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderWidth: 1
  },
  chipIdle: {
    backgroundColor: '#FFFFFF',
    borderColor: '#D9E2EC'
  },
  chipActive: {
    backgroundColor: '#DBEAFE',
    borderColor: '#60A5FA'
  },
  chipText: {
    fontSize: 12,
    fontFamily: theme.font.semiBold
  },
  chipTextIdle: {
    color: '#334155'
  },
  chipTextActive: {
    color: '#1D4ED8'
  }
});
