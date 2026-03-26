import { useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { Sparkline } from '@/components/Sparkline';
import { ToggleSwitch } from '@/components/ToggleSwitch';
import { theme } from '@/constants/theme';

interface Props {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  source: string;
  value: string;
  color: string;
  history: number[];
  enabled: boolean;
  onToggle: (value: boolean) => void;
  onPress?: () => void;
}

export function DeviceCard({ icon, title, source, value, color, history, enabled, onToggle, onPress }: Props) {
  const [chartWidth, setChartWidth] = useState(108);
  const lastWidthRef = useRef(108);

  return (
    <Pressable
      style={({ pressed }) => [styles.card, onPress ? styles.cardInteractive : null, pressed && onPress ? styles.cardPressed : null]}
      onPress={onPress}
      disabled={!onPress}
    >
      <View style={styles.topRow}>
        <View style={styles.titleWrap}>
          <View style={styles.iconBadge}>
              <Ionicons name={icon} size={16} color="#3F4A5A" />
          </View>
          <Text style={styles.title}>{title}</Text>
        </View>
        <ToggleSwitch value={enabled} onChange={onToggle} />
      </View>

      <Text style={styles.value}>{value}</Text>
      <Text style={styles.source}>{source}</Text>
      <Text style={styles.stateHint}>{enabled ? 'Modul activ' : 'Modul oprit'}</Text>
      {onPress ? (
        <View style={styles.hintRow}>
          <Text style={styles.hint}>Tap pentru detalii</Text>
          <Ionicons name="chevron-forward" size={13} color="#64748B" />
        </View>
      ) : null}

      <View
        style={styles.chartWrap}
        onLayout={(event) => {
          const w = Math.max(90, Math.floor(event.nativeEvent.layout.width) - 6);
          if (Math.abs(w - lastWidthRef.current) > 1) {
            lastWidthRef.current = w;
            setChartWidth(w);
          }
        }}
      >
        <Sparkline data={history} color={color} width={chartWidth} height={50} />
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    flex: 1,
    minHeight: 214,
    backgroundColor: theme.colors.card,
    borderRadius: theme.radius.lg,
    padding: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#E6EBF2',
    borderLeftWidth: 3,
    borderLeftColor: '#D6DEE8'
  },
  cardInteractive: {
    borderColor: '#DCE4F0'
  },
  cardPressed: {
    transform: [{ scale: 0.992 }],
    opacity: 0.96
  },
  topRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center'
  },
  titleWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6
  },
  iconBadge: {
    width: 26,
    height: 26,
    borderRadius: 999,
    backgroundColor: '#EEF2F6',
    alignItems: 'center',
    justifyContent: 'center'
  },
  title: {
    fontSize: 12,
    color: theme.colors.muted,
    fontFamily: theme.font.medium
  },
  value: {
    marginTop: 8,
    ...theme.type.cardValue,
    color: theme.colors.text,
    lineHeight: 30
  },
  source: {
    alignSelf: 'flex-start',
    marginTop: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
    backgroundColor: '#EEF2F7',
    fontSize: 11,
    color: '#516071',
    fontFamily: theme.font.medium
  },
  hint: {
    color: '#64748B',
    fontFamily: theme.font.medium,
    fontSize: 12
  },
  hintRow: {
    marginTop: 7,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2
  },
  stateHint: {
    marginTop: 6,
    color: theme.colors.textSoft,
    fontFamily: theme.font.medium,
    fontSize: 11
  },
  chartWrap: {
    marginTop: 10,
    width: '100%',
    alignItems: 'center',
    paddingBottom: 2,
    overflow: 'hidden'
  }
});
