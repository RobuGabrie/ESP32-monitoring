import { useMemo } from 'react';
import { Pressable, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { AppTheme } from '@/constants/theme';
import { useAppTheme } from '@/hooks/useAppTheme';

interface SensorItem {
  label: string;
  value: string;
  unit: string;
  barPercent: number;
  barColor: 'orange' | 'green';
  paletteKey?: keyof AppTheme['chart']['palette'];
  trend?: string;
  trendTone?: 'up' | 'down' | 'stable';
  icon?: keyof typeof Ionicons.glyphMap;
  accentColor?: string;
}

interface Props {
  items: SensorItem[];
  onItemPress?: (item: SensorItem) => void;
}

export function SensorMiniGrid({ items, onItemPress }: Props) {
  const { theme } = useAppTheme();
  const { width } = useWindowDimensions();
  const isDesktop = width >= 768;
  const styles = useMemo(() => createStyles(theme), [theme]);

  return (
    <View style={[styles.grid, isDesktop && styles.gridDesktop]}>
      {items.map((item) => {
        const accent = item.paletteKey
          ? theme.chart.palette[item.paletteKey]
          : item.accentColor ?? (item.barColor === 'orange' ? theme.colors.primary : theme.colors.success);
        return (
          <Pressable
            key={item.label}
            onPress={() => onItemPress?.(item)}
            style={[
              styles.card,
              isDesktop && styles.cardDesktop
            ]}
          >
            <View style={styles.labelRow}>
              {item.icon && (
                <Ionicons name={item.icon} size={14} color={accent} style={{ marginRight: 6 }} />
              )}
              <Text style={styles.label}>{item.label}</Text>
            </View>
            <View style={styles.valueRow}>
              <Text selectable style={styles.value}>{item.value}</Text>
              <Text style={styles.unit}>{item.unit}</Text>
            </View>
            <View style={styles.barTrack}>
              <View
                style={[
                  styles.barFill,
                  {
                    width: `${Math.min(100, Math.max(2, item.barPercent))}%`,
                    backgroundColor: accent
                  }
                ]}
              />
            </View>
            {item.trend && (
              <Text
                style={[
                  styles.trend,
                  { color: accent }
                ]}
              >
                {item.trend}
              </Text>
            )}
          </Pressable>
        );
      })}
    </View>
  );
}

const createStyles = (theme: AppTheme) => StyleSheet.create({
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginBottom: 12
  },
  gridDesktop: {
    gap: 12
  },
  card: {
    flexBasis: '48%',
    flexGrow: 1,
    minWidth: 150,
    backgroundColor: theme.colors.surfaceMuted,
    borderRadius: 14,
    borderCurve: 'continuous',
    borderWidth: 1,
    borderColor: theme.colors.border,
    padding: 14
  },
  cardDesktop: {
    flexBasis: '31%',
    minWidth: 180
  },
  label: {
    fontSize: 12,
    color: theme.colors.textSoft,
    fontFamily: theme.font.medium,
    textTransform: 'uppercase',
    letterSpacing: 0.8
  },
  labelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8
  },
  valueRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 2
  },
  value: {
    fontSize: 24,
    fontFamily: theme.font.mono,
    fontWeight: '700',
    color: theme.colors.text
  },
  unit: {
    fontSize: 13,
    color: theme.colors.textSoft,
    fontFamily: theme.font.medium
  },
  barTrack: {
    height: 3,
    backgroundColor: theme.colors.border,
    borderRadius: 2,
    marginTop: 10,
    overflow: 'hidden'
  },
  barFill: {
    height: '100%',
    borderRadius: 2
  },
  trend: {
    fontSize: 11,
    fontFamily: theme.font.medium,
    marginTop: 6
  }
});
