import { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { AppTheme } from '@/constants/theme';
import { useAppTheme } from '@/hooks/useAppTheme';

interface Row {
  keyLabel: string;
  value: string;
  statusTone?: 'online' | 'offline';
}

interface Props {
  rows: Row[];
  embedded?: boolean;
}

export function NetworkTable({ rows, embedded = false }: Props) {
  const { theme } = useAppTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);

  return (
    <View style={[styles.card, embedded ? styles.cardEmbedded : null]}>
      {rows.map((row, index) => (
        <View style={[styles.row, index === rows.length - 1 ? styles.rowLast : null]} key={row.keyLabel}>
          <Text style={styles.key}>{row.keyLabel}</Text>
          <View style={styles.valueWrap}>
            {row.statusTone ? (
              <View style={[styles.statusPill, row.statusTone === 'online' ? styles.statusPillOnline : styles.statusPillOffline]}>
                <Text style={[styles.statusText, row.statusTone === 'online' ? styles.statusTextOnline : styles.statusTextOffline]}>{row.value}</Text>
              </View>
            ) : (
              <Text style={styles.value} numberOfLines={1} ellipsizeMode="middle">{row.value}</Text>
            )}
          </View>
        </View>
      ))}
    </View>
  );
}

const createStyles = (theme: AppTheme) => StyleSheet.create({
  card: {
    backgroundColor: theme.colors.card,
    borderRadius: theme.radius.lg,
    padding: 14,
    borderWidth: 1,
    borderColor: theme.colors.border,
    marginBottom: theme.spacing.md,
    borderLeftWidth: 3,
    borderLeftColor: theme.accents.primary
  },
  cardEmbedded: {
    marginBottom: 0,
    borderLeftWidth: 0,
    borderLeftColor: 'transparent',
    backgroundColor: 'transparent',
    borderColor: 'transparent',
    paddingHorizontal: 0,
    paddingTop: 0,
    paddingBottom: 2
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
    fontFamily: theme.font.regular,
    fontSize: 12
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
  statusPill: {
    borderRadius: 999,
    paddingVertical: 4,
    paddingHorizontal: 10
  },
  statusPillOnline: {
    backgroundColor: 'rgba(61,220,132,0.12)'
  },
  statusPillOffline: {
    backgroundColor: 'rgba(232,64,64,0.12)'
  },
  statusText: {
    fontFamily: theme.font.semiBold,
    fontSize: 12
  },
  statusTextOnline: {
    color: '#3ddc84'
  },
  statusTextOffline: {
    color: '#e84040'
  }
});
