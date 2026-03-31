import { StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { ToggleSwitch } from '@/components/ToggleSwitch';
import { theme } from '@/constants/theme';

interface Props {
  temperature: number;
  enabled: boolean;
  onToggle: (value: boolean) => void;
  min?: number;
  max?: number;
}

const GRADIENT = ['#1D4ED8', '#0EA5E9', '#10B981', '#F59E0B', '#EF4444'];

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
  const segments = GRADIENT.length - 1;
  const position = normalized * segments;
  const from = Math.floor(position);
  const to = Math.min(segments, from + 1);
  const localT = position - from;
  return mix(GRADIENT[from], GRADIENT[to], localT);
};

const getTempLabel = (value: number) => {
  if (value < 18) return 'Rece';
  if (value < 26) return 'Normal';
  if (value < 33) return 'Ridicata';
  return 'Critica';
};

export function TemperatureThermometerCard({ temperature, enabled, onToggle, min = 0, max = 50 }: Props) {
  const steps = 32;
  const clamped = clamp(temperature, min, max);
  const fillRatio = (clamped - min) / Math.max(max - min, 1);
  const markerBottom = `${Math.max(0, Math.min(100, fillRatio * 100))}%`;
  const fillHeight = `${Math.max(4, fillRatio * 100)}%`;

  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <View style={styles.titleWrap}>
          <View style={styles.iconBadge}>
            <Ionicons name="thermometer" size={16} color="#3F4A5A" />
          </View>
          <Text style={styles.title}>Temperatura</Text>
        </View>
        <ToggleSwitch value={enabled} onChange={onToggle} />
      </View>

      <View style={styles.body}>
        <View style={styles.metricsCol}>
          <Text style={styles.value}>{clamped.toFixed(1)} °C</Text>
          <Text style={styles.state}>{enabled ? 'Modul activ' : 'Modul oprit'}</Text>
          <View style={styles.statePill}>
            <Text style={styles.statePillText}>{getTempLabel(clamped)}</Text>
          </View>
          <Text style={styles.rangeText}>Interval recomandat: 18°C - 26°C</Text>
        </View>

        <View style={styles.gaugeBlock}>
          <Text style={styles.maxTick}>{max}°</Text>
          <View style={styles.gaugeShell}>
            <View style={[styles.fillMask, { height: fillHeight }]}>
              {Array.from({ length: steps }).map((_, index) => {
                const rowRatio = index / Math.max(steps - 1, 1);
                return <View key={index} style={[styles.segment, { backgroundColor: colorAt(rowRatio) }]} />;
              })}
            </View>
            <View style={[styles.marker, { bottom: markerBottom }]}>
              <View style={styles.markerDot} />
              <Text style={styles.markerText}>{clamped.toFixed(1)}°</Text>
            </View>
          </View>
          <Text style={styles.minTick}>{min}°</Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    width: '100%',
    backgroundColor: theme.colors.card,
    borderRadius: theme.radius.lg,
    borderWidth: 1,
    borderColor: '#E6EBF2',
    borderLeftWidth: 3,
    borderLeftColor: '#D6DEE8',
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
    color: theme.colors.muted,
    fontFamily: theme.font.medium,
    fontSize: 12
  },
  body: {
    marginTop: 10,
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 8
  },
  metricsCol: {
    flex: 1,
    paddingRight: 8
  },
  value: {
    color: theme.colors.text,
    ...theme.type.cardValue,
    lineHeight: 34
  },
  state: {
    marginTop: 4,
    color: theme.colors.textSoft,
    fontFamily: theme.font.medium,
    fontSize: 11
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
    fontSize: 11
  },
  rangeText: {
    marginTop: 8,
    color: '#64748B',
    fontFamily: theme.font.medium,
    fontSize: 12
  },
  gaugeBlock: {
    width: 86,
    alignItems: 'center'
  },
  gaugeShell: {
    position: 'relative',
    width: 44,
    height: 210,
    borderRadius: 999,
    borderWidth: 2,
    borderColor: '#D6DEE8',
    backgroundColor: '#F1F5F9',
    overflow: 'hidden',
    justifyContent: 'flex-end'
  },
  fillMask: {
    width: '100%',
    minHeight: 6,
    justifyContent: 'flex-end'
  },
  segment: {
    width: '100%',
    flex: 1,
    minHeight: 3
  },
  marker: {
    position: 'absolute',
    left: -32,
    right: -40,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4
  },
  markerDot: {
    width: 8,
    height: 8,
    borderRadius: 999,
    backgroundColor: '#0F172A'
  },
  markerText: {
    color: '#0F172A',
    fontFamily: theme.font.semiBold,
    fontSize: 11
  },
  maxTick: {
    marginBottom: 6,
    color: '#64748B',
    fontFamily: theme.font.medium,
    fontSize: 11
  },
  minTick: {
    marginTop: 6,
    color: '#64748B',
    fontFamily: theme.font.medium,
    fontSize: 11
  }
});
