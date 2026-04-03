import { ReactNode, useEffect, useMemo, useRef } from 'react';
import { Animated, Easing, StyleSheet, Text, View } from 'react-native';

import { AppTheme } from '@/constants/theme';
import { useAppTheme } from '@/hooks/useAppTheme';

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
  const { theme } = useAppTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const blinkAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(blinkAnim, { toValue: 0.2, duration: 750, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
        Animated.timing(blinkAnim, { toValue: 1, duration: 750, easing: Easing.inOut(Easing.quad), useNativeDriver: true })
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [blinkAnim]);

  const ip = meta.find((m) => m.label === 'IP')?.value ?? '--';

  return (
    <View style={styles.hero}>
      {/* Header row */}
      <View style={styles.headerRow}>
        <View style={styles.headerLeft}>
          <View style={styles.avatar}>
            <Text style={styles.avatarIcon}>⚡</Text>
          </View>
          <View>
            <Text style={styles.title}>{title}</Text>
            <Text style={styles.subtitle}>{subtitle}</Text>
          </View>
        </View>

      </View>

      {/* Live row */}
      <View style={styles.liveRow}>
        <View style={styles.livePill}>
          <Animated.View style={[styles.liveDot, { opacity: blinkAnim }]} />
          <Text style={styles.livePillText}>LIVE</Text>
        </View>
        <View style={styles.connPill}>
          <Text style={styles.connPillText}>📡 {ip}</Text>
        </View>
        {statusLabel && (
          <View
            style={[
              styles.statusPill,
              statusTone === 'online' ? styles.statusOnline : styles.statusOffline
            ]}
          >
            <Text
              style={[
                styles.statusPillText,
                statusTone === 'online' ? styles.statusTextOnline : styles.statusTextOffline
              ]}
            >
              {statusLabel}
            </Text>
          </View>
        )}
      </View>

      {footer && <View style={styles.footerWrap}>{footer}</View>}
    </View>
  );
}

const createStyles = (theme: AppTheme) => StyleSheet.create({
  hero: {
    paddingHorizontal: 4,
    paddingTop: 8,
    paddingBottom: 4,
    marginBottom: 12,
    gap: 12
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between'
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 12,
    borderCurve: 'continuous',
    backgroundColor: theme.colors.primary,
    alignItems: 'center',
    justifyContent: 'center'
  },
  avatarIcon: {
    fontSize: 18,
    color: '#fff'
  },
  title: {
    color: theme.colors.text,
    fontFamily: theme.font.bold,
    fontSize: 18
  },
  subtitle: {
    color: theme.colors.textSoft,
    fontFamily: theme.font.regular,
    fontSize: 13,
    marginTop: 1
  },
  liveRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8
  },
  livePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(232,84,42,0.12)',
    borderWidth: 1,
    borderColor: 'rgba(232,84,42,0.25)',
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 20
  },
  liveDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: theme.colors.primary
  },
  livePillText: {
    color: theme.colors.primaryLight,
    fontFamily: theme.font.bold,
    fontSize: 12
  },
  connPill: {
    backgroundColor: theme.colors.card,
    borderWidth: 1,
    borderColor: theme.colors.border,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 20
  },
  connPillText: {
    color: theme.colors.textSoft,
    fontFamily: theme.font.medium,
    fontSize: 12
  },
  statusPill: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 20,
    borderWidth: 1
  },
  statusOnline: {
    backgroundColor: 'rgba(61,220,132,0.12)',
    borderColor: 'rgba(61,220,132,0.25)'
  },
  statusOffline: {
    backgroundColor: 'rgba(232,64,64,0.12)',
    borderColor: 'rgba(232,64,64,0.25)'
  },
  statusPillText: {
    fontFamily: theme.font.bold,
    fontSize: 12
  },
  statusTextOnline: {
    color: theme.colors.success
  },
  statusTextOffline: {
    color: theme.colors.danger
  },
  footerWrap: {
    marginTop: 2
  }
});
