import { useRef, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { Sparkline } from '@/components/Sparkline';
import { theme } from '@/constants/theme';

interface Props {
  temperature: number;
  history: number[];
  color: string;
  enabled: boolean;
  onToggle: (value: boolean) => void;
  min?: number;
  max?: number;
}

const THERMO_GRADIENT = ['#2563EB', '#0EA5E9', '#F59E0B', '#DC2626'];

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

const hexToRgb = (hex: string) => {
  const raw = hex.replace('#', '');
  const expanded = raw.length === 3 ? raw.split('').map((s) => `${s}${s}`).join('') : raw;
  const n = parseInt(expanded, 16);
  return {
    r: (n >> 16) & 255,
    g: (n >> 8) & 255,
    b: n & 255
  };
};

const rgbToHex = ({ r, g, b }: { r: number; g: number; b: number }) => {
  const toHex = (value: number) => Math.round(value).toString(16).padStart(2, '0');
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
};

const mix = (a: string, b: string, t: number) => {
  const start = hexToRgb(a);
  const end = hexToRgb(b);
  return rgbToHex({
    r: start.r + (end.r - start.r) * t,
    g: start.g + (end.g - start.g) * t,
    b: start.b + (end.b - start.b) * t
  });
};

const colorAt = (ratio: number) => {
  const normalized = clamp(ratio, 0, 1);
  const segments = THERMO_GRADIENT.length - 1;
  const position = normalized * segments;
  const from = Math.floor(position);
  const to = Math.min(segments, from + 1);
  const localT = position - from;
  return mix(THERMO_GRADIENT[from], THERMO_GRADIENT[to], localT);
};

const getTempLabel = (value: number) => {
  if (value < 18) return 'Rece';
  if (value < 26) return 'Normal';
  if (value < 33) return 'Ridicata';
  return 'Critica';
};

export function TemperatureThermometerCard({ temperature, history, color, enabled, onToggle, min = 0, max = 50 }: Props) {
  const [chartWidth, setChartWidth] = useState(112);
  const lastWidthRef = useRef(112);
  const steps = 26;
  const clamped = clamp(temperature, min, max);
  const fillRatio = (clamped - min) / Math.max(max - min, 1);
  const stemHeight = 150;
  const fillHeightPx = Math.max(8, fillRatio * stemHeight);
  const borderTint = colorAt(fillRatio);

  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <View style={styles.titleWrap}>
          <View style={styles.iconBadge}>
            <Ionicons name="thermometer" size={16} color="#1D4ED8" />
          </View>
          <Text style={styles.title}>Temperatura</Text>
        </View>
      </View>

      <View style={styles.body}>
        <View style={styles.metricsCol}>
          <Text style={styles.value}>{clamped.toFixed(1)} °C</Text>
          <Text style={styles.state}>{enabled ? 'Modul activ' : 'Modul oprit'}</Text>
          <View style={styles.statePill}>
            <Text style={styles.statePillText}>{getTempLabel(clamped)}</Text>
          </View>

          <View
            style={styles.chartWrap}
            onLayout={(event) => {
              const w = Math.max(96, Math.floor(event.nativeEvent.layout.width) - 2);
              if (Math.abs(w - lastWidthRef.current) > 1) {
                lastWidthRef.current = w;
                setChartWidth(w);
              }
            }}
          >
            <Sparkline data={history} color={color} width={chartWidth} height={56} />
          </View>
          <Text style={styles.rangeText}>18°C - 26°C recomandat</Text>
        </View>

        <View style={styles.gaugeBlock}>
          <View style={styles.thermoWrap}>
              <View style={[styles.gaugeShell, { borderColor: borderTint }]}>
              <View style={[styles.fillMask, { height: fillHeightPx }]}>
                {Array.from({ length: steps }).map((_, index) => {
                  const rowRatio = 1 - index / Math.max(steps - 1, 1);
                  return <View key={index} style={[styles.segment, { backgroundColor: colorAt(rowRatio) }]} />;
                })}
              </View>
              <View style={styles.tickOverlay}>
                {Array.from({ length: 18 }).map((_, index) => (
                  <View key={index} style={styles.tickLine} />
                ))}
              </View>
            </View>
          </View>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    width: '100%',
    minHeight: 214,
    backgroundColor: theme.colors.card,
    borderRadius: theme.radius.lg,
    borderWidth: 1,
    borderColor: '#DCE4F0',
    padding: 12,
    marginBottom: 12
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center'
  },
  titleWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8
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
    ...theme.type.cardLabel,
    color: theme.colors.muted
  },
  body: {
    marginTop: 10,
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 8
  },
  metricsCol: {
    flex: 1,
    paddingRight: 4
  },
  value: {
    color: theme.colors.text,
    ...theme.type.cardValue,
    lineHeight: 30
  },
  state: {
    marginTop: 6,
    color: theme.colors.textSoft,
    fontFamily: theme.font.regular,
    fontSize: 12
  },
  statePill: {
    marginTop: 8,
    alignSelf: 'flex-start',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderWidth: 1,
    borderColor: '#D1FAE5',
    backgroundColor: '#ECFDF5'
  },
  statePillText: {
    color: '#047857',
    fontFamily: theme.font.semiBold,
    fontSize: 11,
    fontWeight: '600'
  },
  rangeText: {
    marginTop: 8,
    color: '#64748B',
    fontFamily: theme.font.regular,
    fontSize: 11
  },
  chartWrap: {
    marginTop: 10,
    width: '100%',
    alignItems: 'center'
  },
  gaugeBlock: {
    width: 88,
    alignItems: 'center',
    justifyContent: 'flex-start'
  },
  thermoWrap: {
    alignItems: 'center',
    justifyContent: 'flex-end'
  },
  gaugeShell: {
    position: 'relative',
    width: 36,
    height: 150,
    borderRadius: 18,
    borderWidth: 2,
    borderColor: '#95A7F6',
    backgroundColor: '#FFFFFF',
    overflow: 'hidden',
    justifyContent: 'flex-end',
    paddingBottom: 6,
    ...theme.shadow.card
  },
  fillMask: {
    width: 22,
    alignSelf: 'center',
    minHeight: 8,
    justifyContent: 'flex-end',
    borderRadius: 12,
    overflow: 'hidden'
  },
  segment: {
    width: '100%',
    flex: 1,
    minHeight: 4
  },
  tickOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'space-evenly',
    alignItems: 'center',
    paddingVertical: 8
  },
  tickLine: {
    width: 14,
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.62)'
  }
});
