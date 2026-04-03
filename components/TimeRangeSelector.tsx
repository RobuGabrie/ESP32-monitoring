import { useMemo } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { AppTheme } from '@/constants/theme';
import { useAppTheme } from '@/hooks/useAppTheme';
import { TimeRangeKey } from '@/hooks/useStore';

interface Props {
  value: TimeRangeKey;
  onChange: (value: TimeRangeKey) => void;
}

const OPTIONS: { key: TimeRangeKey; label: string }[] = [
  { key: '60s', label: '60s' },
  { key: '15m', label: '15m' },
  { key: '1h', label: '1h' },
  { key: '6h', label: '6h' },
  { key: '24h', label: '24h' },
  { key: '7d', label: '7d' },
  { key: 'all', label: 'Toate' }
];

export function TimeRangeSelector({ value, onChange }: Props) {
  const { theme } = useAppTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);

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

const createStyles = (theme: AppTheme) => StyleSheet.create({
  wrap: {
    marginBottom: theme.spacing.md
  },
  label: {
    ...theme.type.cardLabel,
    color: theme.colors.muted,
    marginBottom: 8
  },
  row: {
    gap: 10,
    paddingRight: 8
  },
  chip: {
    borderRadius: 999,
    minHeight: theme.touch.minTarget,
    paddingHorizontal: 12,
    paddingVertical: 11,
    justifyContent: 'center',
    borderWidth: 1
  },
  chipIdle: {
    backgroundColor: theme.colors.card,
    borderColor: theme.colors.border
  },
  chipActive: {
    backgroundColor: theme.accents.primary,
    borderColor: theme.colors.primary
  },
  chipText: {
    fontSize: 12,
    fontFamily: theme.font.semiBold
  },
  chipTextIdle: {
    color: theme.colors.textSoft
  },
  chipTextActive: {
    color: theme.colors.primary
  }
});
