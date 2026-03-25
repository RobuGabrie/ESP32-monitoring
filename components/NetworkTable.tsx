import { StyleSheet, Text, View } from 'react-native';

import { theme } from '@/constants/theme';

interface Row {
  keyLabel: string;
  value: string;
  statusDot?: boolean;
}

interface Props {
  rows: Row[];
}

export function NetworkTable({ rows }: Props) {
  return (
    <View style={styles.card}>
      {rows.map((row, index) => (
        <View style={[styles.row, index === rows.length - 1 ? styles.rowLast : null]} key={row.keyLabel}>
          <Text style={styles.key}>{row.keyLabel}</Text>
          <View style={styles.valueWrap}>
            {row.statusDot ? <View style={styles.dot} /> : null}
            <Text style={styles.value} numberOfLines={1} ellipsizeMode="middle">{row.value}</Text>
          </View>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: theme.colors.card,
    borderRadius: theme.radius.lg,
    padding: 14,
    borderWidth: 1,
    borderColor: '#E6EBF2',
    marginBottom: theme.spacing.md,
    borderLeftWidth: 3,
    borderLeftColor: '#DBEAFE'
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
    paddingVertical: 9
  },
  key: {
    color: theme.colors.muted,
    fontFamily: theme.font.medium,
    fontSize: 13
  },
  valueWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    maxWidth: '60%',
    flexShrink: 1
  },
  value: {
    color: theme.colors.text,
    fontFamily: theme.font.semiBold,
    fontSize: 13,
    flexShrink: 1
  },
  rowLast: {
    borderBottomWidth: 0,
    paddingBottom: 0
  },
  dot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#10B981'
  }
});
