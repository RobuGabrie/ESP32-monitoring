import { ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { theme } from '@/constants/theme';

interface MetaItem {
  label: string;
  value: string;
}

interface Props {
  title: string;
  subtitle: string;
  statusLabel?: string;
  statusTone?: 'online' | 'offline' | 'neutral';
  meta?: MetaItem[];
  footer?: ReactNode;
}

export function TabHero({ title, subtitle, statusLabel, statusTone = 'neutral', meta = [], footer }: Props) {
  return (
    <View style={styles.hero}>
      <View style={styles.topRow}>
        <Text style={styles.title}>{title}</Text>
        {statusLabel ? (
          <View
            style={[
              styles.badge,
              statusTone === 'online' ? styles.badgeOnline : null,
              statusTone === 'offline' ? styles.badgeOffline : null,
              statusTone === 'neutral' ? styles.badgeNeutral : null
            ]}
          >
            <Text
              style={[
                styles.badgeText,
                statusTone === 'online' ? styles.badgeTextOnline : null,
                statusTone === 'offline' ? styles.badgeTextOffline : null,
                statusTone === 'neutral' ? styles.badgeTextNeutral : null
              ]}
            >
              {statusLabel}
            </Text>
          </View>
        ) : null}
      </View>

      <Text style={styles.subtitle}>{subtitle}</Text>

      {meta.length ? (
        <View style={styles.metaWrap}>
          {meta.map((item) => (
            <View key={`${item.label}:${item.value}`} style={styles.metaChip}>
              <Text style={styles.metaLabel}>{item.label}</Text>
              <Text style={styles.metaValue}>{item.value}</Text>
            </View>
          ))}
        </View>
      ) : null}

      {footer ? <View style={styles.footerWrap}>{footer}</View> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  hero: {
    backgroundColor: theme.colors.card,
    borderRadius: theme.radius.lg,
    padding: 14,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#E8ECF2',
    borderLeftWidth: 1,
    borderLeftColor: '#E8ECF2'
  },
  topRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center'
  },
  title: {
    color: theme.colors.text,
    fontFamily: theme.font.bold,
    fontSize: 23
  },
  subtitle: {
    marginTop: 4,
    color: theme.colors.muted,
    fontFamily: theme.font.regular,
    fontSize: 13
  },
  metaWrap: {
    marginTop: 10,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10
  },
  metaChip: {
    backgroundColor: theme.colors.surfaceMuted,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    paddingHorizontal: 9,
    paddingVertical: 6,
    minWidth: 108
  },
  metaLabel: {
    color: theme.colors.textSoft,
    fontFamily: theme.font.medium,
    fontSize: 11
  },
  metaValue: {
    marginTop: 2,
    color: theme.colors.text,
    fontFamily: theme.font.semiBold,
    fontSize: 13
  },
  footerWrap: {
    marginTop: 10
  },
  badge: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999
  },
  badgeOnline: {
    backgroundColor: '#DCFCE7'
  },
  badgeOffline: {
    backgroundColor: '#FEE2E2'
  },
  badgeNeutral: {
    backgroundColor: '#E2E8F0'
  },
  badgeText: {
    fontFamily: theme.font.medium,
    fontSize: 12
  },
  badgeTextOnline: {
    color: '#166534'
  },
  badgeTextOffline: {
    color: '#B91C1C'
  },
  badgeTextNeutral: {
    color: '#334155'
  }
});
