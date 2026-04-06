import { useMemo } from 'react';
import { StyleProp, StyleSheet, Text, View, ViewStyle } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { AppTheme } from '@/constants/theme';
import { useAppTheme } from '@/hooks/useAppTheme';

type StatusSummaryCardProps = {
  label: string;
  value: string;
  icon: keyof typeof Ionicons.glyphMap;
  accent: string;
  iconColor?: string;
  style?: StyleProp<ViewStyle>;
};

export function StatusSummaryCard({
  label,
  value,
  icon,
  accent,
  iconColor = '#f0f0f0',
  style
}: StatusSummaryCardProps) {
  const { theme } = useAppTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);

  return (
    <View style={[styles.card, style]}>
      <View style={styles.header}>
        <View style={[styles.iconWrap, { backgroundColor: accent }]}> 
          <Ionicons name={icon} size={13} color={iconColor} />
        </View>
        <Text style={styles.label}>{label}</Text>
      </View>
      <Text style={styles.value}>{value}</Text>
    </View>
  );
}

const createStyles = (theme: AppTheme) => StyleSheet.create({
  card: {
    flexGrow: 1,
    minWidth: 150,
    backgroundColor: theme.colors.surfaceMuted,
    borderRadius: theme.radius.md,
    borderWidth: 1,
    borderColor: theme.colors.border,
    paddingVertical: theme.spacing.md,
    paddingHorizontal: theme.spacing.md,
    minHeight: 86
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.xs
  },
  iconWrap: {
    width: 20,
    height: 20,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center'
  },
  label: {
    color: theme.colors.textSoft,
    ...theme.type.cardLabel
  },
  value: {
    marginTop: theme.spacing.sm,
    color: theme.colors.text,
    ...theme.type.cardValue
  }
});
