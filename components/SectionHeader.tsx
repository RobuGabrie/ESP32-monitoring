import { Pressable, StyleSheet, Text, View } from 'react-native';

import { theme } from '@/constants/theme';

interface Props {
  title: string;
  count: number;
  countLabel?: string;
  actionLabel?: string;
  onActionPress?: () => void;
}

export function SectionHeader({ title, count, countLabel, actionLabel = 'Export', onActionPress }: Props) {
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

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 10,
    marginBottom: theme.spacing.md
  },
  titleWrap: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 8
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
    paddingHorizontal: 10,
    paddingVertical: 4
  },
  countText: {
    color: theme.colors.primary,
    fontFamily: theme.font.medium,
    fontSize: 12
  },
  actionButton: {
    minHeight: theme.touch.minTarget,
    backgroundColor: '#EFF6FF',
    borderWidth: 1,
    borderColor: '#BFDBFE',
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 10,
    justifyContent: 'center'
  },
  actionButtonPressed: {
    opacity: 0.92
  },
  actionText: {
    color: '#1D4ED8',
    fontFamily: theme.font.semiBold,
    fontSize: 13
  }
});
