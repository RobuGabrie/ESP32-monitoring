import { Pressable, StyleSheet, Text, View } from 'react-native';

import { theme } from '@/constants/theme';

interface Props {
  title: string;
  count: number;
  actionLabel?: string;
  onActionPress?: () => void;
}

export function SectionHeader({ title, count, actionLabel = 'Export', onActionPress }: Props) {
  return (
    <View style={styles.row}>
      <View style={styles.titleWrap}>
        <Text style={styles.title}>{title}</Text>
        <View style={styles.countBadge}>
          <Text style={styles.countText}>{count}</Text>
        </View>
      </View>
      {onActionPress ? (
        <Pressable onPress={onActionPress} style={styles.actionButton}>
          <Text style={styles.actionText}>{actionLabel}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: theme.spacing.md
  },
  titleWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8
  },
  title: {
    fontFamily: theme.font.semiBold,
    fontSize: 18,
    color: theme.colors.text
  },
  countBadge: {
    minWidth: 24,
    borderRadius: 999,
    backgroundColor: '#E6EEFF',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4
  },
  countText: {
    color: theme.colors.primary,
    fontFamily: theme.font.medium,
    fontSize: 12
  },
  actionButton: {
    backgroundColor: '#E6EEFF',
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 8
  },
  actionText: {
    color: theme.colors.primary,
    fontFamily: theme.font.medium,
    fontSize: 13
  }
});
