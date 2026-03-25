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
      {rows.map((row) => (
        <View style={styles.row} key={row.keyLabel}>
          <Text style={styles.key}>{row.keyLabel}</Text>
          <View style={styles.valueWrap}>
            {row.statusDot ? <View style={styles.dot} /> : null}
            <Text style={styles.value}>{row.value}</Text>
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
    marginBottom: theme.spacing.md,
    ...theme.shadow.card
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
    gap: 8
  },
  value: {
    color: theme.colors.text,
    fontFamily: theme.font.semiBold,
    fontSize: 13
  },
  dot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#10B981'
  }
});
