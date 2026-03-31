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
  const gaugeHeight = 240;
  const fillHeightPx = Math.max(8, fillRatio * gaugeHeight);
  const markerBottomPx = Math.max(0, Math.min(gaugeHeight - 10, fillRatio * gaugeHeight - 5));

  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <View style={styles.titleWrap}>
          <View style={styles.iconBadge}>
            <Ionicons name="thermometer" size={16} color="#1D4ED8" />
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
            <View style={[styles.fillMask, { height: fillHeightPx }]}>
              {Array.from({ length: steps }).map((_, index) => {
                const rowRatio = index / Math.max(steps - 1, 1);
                return <View key={index} style={[styles.segment, { backgroundColor: colorAt(rowRatio) }]} />;
              })}
            </View>
            <View style={[styles.marker, { bottom: markerBottomPx }]}>
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
    borderLeftWidth: 4,
    borderLeftColor: '#1D4ED8',
    padding: 14,
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
    width: 32,
    height: 32,
    borderRadius: 999,
    backgroundColor: 'rgba(29, 78, 216, 0.1)',
    alignItems: 'center',
    justifyContent: 'center'
  },
  title: {
    color: theme.colors.text,
    fontFamily: theme.font.semiBold,
    fontSize: 13,
    letterSpacing: 0.2
  },
  body: {
    marginTop: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12
  },
  metricsCol: {
    flex: 1,
    paddingRight: 2
  },
  value: {
    color: theme.colors.text,
    ...theme.type.cardValue,
    lineHeight: 34,
    fontSize: 28
  },
  state: {
    marginTop: 6,
    color: theme.colors.textSoft,
    fontFamily: theme.font.regular,
    fontSize: 12
  },
  statePill: {
    marginTop: 10,
    alignSelf: 'flex-start',
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 5,
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
    marginTop: 10,
    color: '#64748B',
    fontFamily: theme.font.regular,
    fontSize: 11
  },
  gaugeBlock: {
    width: 100,
    alignItems: 'center',
    justifyContent: 'center'
  },
  gaugeShell: {
    position: 'relative',
    width: 52,
    height: 240,
    borderRadius: 999,
    borderWidth: 2.5,
    borderColor: 'rgba(29, 78, 216, 0.2)',
    backgroundColor: '#F8FAFC',
    overflow: 'hidden',
    justifyContent: 'flex-end',
    ...theme.shadow.card
  },
  fillMask: {
    width: '100%',
    minHeight: 8,
    justifyContent: 'flex-end'
  },
  segment: {
    width: '100%',
    flex: 1,
    minHeight: 4
  },
  marker: {
    position: 'absolute',
    left: -40,
    right: -32,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5
  },
  markerDot: {
    width: 10,
    height: 10,
    borderRadius: 999,
    backgroundColor: '#1D4ED8',
    ...theme.shadow.floating
  },
  markerText: {
    color: '#1D4ED8',
    fontFamily: theme.font.bold,
    fontSize: 12,
    fontWeight: '700'
  },
  maxTick: {
    marginBottom: 8,
    color: '#4B5563',
    fontFamily: theme.font.semiBold,
    fontSize: 12,
    fontWeight: '600'
  },
  minTick: {
    marginTop: 8,
    color: '#4B5563',
    fontFamily: theme.font.semiBold,
    fontSize: 12,
    fontWeight: '600'
  }
});
