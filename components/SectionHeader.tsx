import { useMemo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { AppTheme } from '@/constants/theme';
import { useAppTheme } from '@/hooks/useAppTheme';

interface Props {
  title: string;
  count: number;
  countLabel?: string;
  actionLabel?: string;
  onActionPress?: () => void;
}

export function SectionHeader({ title, count, countLabel, actionLabel = 'Export', onActionPress }: Props) {
  const { theme } = useAppTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const countText = countLabel ? `${count} ${countLabel}` : String(count);

  return (
    <View style={styles.row}>
      <View style={styles.titleWrap}>
        <Text style={styles.title}>{title}</Text>
        <View style={styles.countBadge}>
          <Text style={styles.countText}>{countText}</Text>
        </View>
      </View>
      {onActionPress ? (
        <Pressable onPress={onActionPress} style={({ pressed }) => [styles.actionButton, pressed ? styles.actionButtonPressed : null]}>
          <Text style={styles.actionText}>{actionLabel}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const createStyles = (theme: AppTheme) => StyleSheet.create({
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: theme.spacing.sm,
    marginBottom: theme.spacing.md
  },
  titleWrap: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: theme.spacing.sm
  },
  title: {
    ...theme.type.sectionTitle,
    color: theme.colors.text
  },
  countBadge: {
    minWidth: 24,
    borderRadius: 999,
    backgroundColor: theme.accents.primary,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: theme.spacing.sm,
    paddingVertical: theme.spacing.xs
  },
  countText: {
    color: theme.colors.primary,
    ...theme.type.bodySm
  },
  actionButton: {
    minHeight: theme.touch.minTarget,
    backgroundColor: theme.accents.primary,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: 999,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
    justifyContent: 'center'
  },
  actionButtonPressed: {
    opacity: 0.92
  },
  actionText: {
    color: theme.colors.primary,
    ...theme.type.bodySm
  }
});
