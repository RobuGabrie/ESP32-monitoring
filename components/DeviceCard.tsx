import { useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Sparkline } from '@/components/Sparkline';
import { ToggleSwitch } from '@/components/ToggleSwitch';
import { theme } from '@/constants/theme';

interface Props {
  icon: string;
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
          <Text style={styles.icon}>{icon}</Text>
          <Text style={styles.title}>{title}</Text>
        </View>
        <ToggleSwitch value={enabled} onChange={onToggle} />
      </View>

      <Text style={styles.value}>{value}</Text>
      <Text style={styles.source}>{source}</Text>
      {onPress ? <Text style={styles.hint}>Tap pentru detalii</Text> : null}

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
    backgroundColor: theme.colors.card,
    borderRadius: theme.radius.lg,
    padding: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#E6EBF2',
    ...theme.shadow.card
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
  icon: {
    fontSize: 18
  },
  title: {
    fontSize: 14,
    color: theme.colors.muted,
    fontFamily: theme.font.medium
  },
  value: {
    marginTop: 8,
    fontSize: 22,
    color: theme.colors.text,
    fontFamily: theme.font.bold
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
    marginTop: 5,
    color: '#64748B',
    fontFamily: theme.font.medium,
    fontSize: 11
  },
  chartWrap: {
    marginTop: 10,
    width: '100%',
    alignItems: 'center',
    overflow: 'hidden'
  }
});
