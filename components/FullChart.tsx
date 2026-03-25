import { useEffect, useMemo, useRef } from 'react';
import { Animated, Easing, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { Defs, Line, LinearGradient, Path, Stop, Svg } from 'react-native-svg';
import { format as formatDate } from 'date-fns';

import { theme } from '@/constants/theme';

interface Props {
  data: number[];
  color: string;
  label: (v: number) => string;
  height?: number;
  title?: string;
  minValue?: number;
  maxValue?: number;
  yTickCount?: number;
  includeZero?: boolean;
  xValues?: number[];
}

const smoothSeries = (input: number[], alpha = 0.3) => {
  if (input.length < 3) {
    return input;
  }

  const out: number[] = [input[0]];
  for (let i = 1; i < input.length; i += 1) {
    out[i] = alpha * input[i] + (1 - alpha) * out[i - 1];
  }
  return out;
};

const buildSmoothPath = (points: Array<{ x: number; y: number }>) => {
  if (!points.length) {
    return '';
  }

  if (points.length === 1) {
    return `M ${points[0].x} ${points[0].y}`;
  }

  let d = `M ${points[0].x} ${points[0].y}`;
  for (let i = 0; i < points.length - 1; i += 1) {
    const p0 = points[i - 1] ?? points[i];
    const p1 = points[i];
    const p2 = points[i + 1];
    const p3 = points[i + 2] ?? p2;

    const c1x = p1.x + (p2.x - p0.x) / 6;
    const c1y = p1.y + (p2.y - p0.y) / 6;
    const c2x = p2.x - (p3.x - p1.x) / 6;
    const c2y = p2.y - (p3.y - p1.y) / 6;

    d += ` C ${c1x} ${c1y}, ${c2x} ${c2y}, ${p2.x} ${p2.y}`;
  }

  return d;
};

const niceStep = (roughStep: number) => {
  if (!Number.isFinite(roughStep) || roughStep <= 0) {
    return 1;
  }

  const exponent = Math.floor(Math.log10(roughStep));
  const base = 10 ** exponent;
  const fraction = roughStep / base;

  if (fraction <= 1) return 1 * base;
  if (fraction <= 2) return 2 * base;
  if (fraction <= 5) return 5 * base;
  return 10 * base;
};

export function FullChart({
  data,
  color,
  label,
  height = 220,
  title,
  minValue,
  maxValue,
  yTickCount = 6,
  includeZero = true,
  xValues
}: Props) {
  const { width: windowWidth } = useWindowDimensions();
  const values = useMemo(() => {
    const finite = data.filter((v) => Number.isFinite(v));
    const base = finite.length ? finite : [0, 0];
    return smoothSeries(base);
  }, [data]);

  const safeTickCount = Math.max(4, yTickCount);
  const rawMin = Math.min(...values);
  const rawMax = Math.max(...values);

  const baseMin = typeof minValue === 'number' ? minValue : rawMin;
  const baseMax = typeof maxValue === 'number' ? maxValue : rawMax;

  let preMin = includeZero ? Math.min(baseMin, 0) : baseMin;
  let preMax = includeZero ? Math.max(baseMax, 0) : baseMax;

  if (preMin === preMax) {
    const pad = Math.max(Math.abs(preMax) * 0.1, 1);
    preMin -= pad;
    preMax += pad;
  }

  const roughStep = (preMax - preMin) / (safeTickCount - 1);
  const step = niceStep(roughStep);
  const min = Math.floor(preMin / step) * step;
  const max = Math.ceil(preMax / step) * step;
  const range = Math.max(max - min, step);

  const chartWidth = Math.max(windowWidth - 32 - 24, 220);
  const chartHeight = Math.max(height - 70, 120);
  const leftPad = 42;
  const rightPad = 10;
  const topPad = 8;
  const bottomPad = 26;
  const innerW = chartWidth - leftPad - rightPad;
  const innerH = chartHeight - topPad - bottomPad;
  const chartAnim = useRef(new Animated.Value(0)).current;
  const animatedOnce = useRef(false);

  const { linePath, areaPath } = useMemo(() => {
    const points = values
      .map((v, i) => {
        const x = leftPad + (i / Math.max(values.length - 1, 1)) * innerW;
        const y = topPad + (1 - (v - min) / range) * innerH;
        return { x, y };
      })
      .filter((p) => Number.isFinite(p.x) && Number.isFinite(p.y));

    if (!points.length) {
      return { linePath: '', areaPath: '' };
    }

    const line = buildSmoothPath(points);
    const area = `${line} L ${points[points.length - 1].x} ${topPad + innerH} L ${points[0].x} ${topPad + innerH} Z`;

    return { linePath: line, areaPath: area };
  }, [innerH, innerW, leftPad, min, range, topPad, values]);

  useEffect(() => {
    if (animatedOnce.current) {
      return;
    }

    animatedOnce.current = true;
    chartAnim.setValue(0);

    Animated.timing(chartAnim, {
      toValue: 1,
      duration: 360,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true
    }).start();
  }, [chartAnim]);

  const yTicks = Array.from({ length: safeTickCount }, (_, index) => {
    const ratio = index / (safeTickCount - 1);
    return max - ratio * range;
  });
  const yLines = Array.from({ length: safeTickCount }, (_, index) => {
    const ratio = index / (safeTickCount - 1);
    return topPad + ratio * innerH;
  });
  const gradientId = useMemo(
    () => `chartFill-${color.replace('#', '')}-${Math.round(chartWidth)}-${Math.round(chartHeight)}`,
    [chartHeight, chartWidth, color]
  );

  const xTicks = useMemo(() => {
    const timeline = Array.isArray(xValues) && xValues.length === values.length
      ? xValues
      : Array.from({ length: values.length }, (_, i) => i);

    const last = timeline.length - 1;
    const mid = Math.floor(last / 2);
    const idxs = [...new Set([0, mid, last])].filter((idx) => idx >= 0);

    const formatX = (v: number) => {
      if (v > 1_000_000_000_000) {
        return formatDate(v, 'HH:mm');
      }
      return String(v);
    };

    return idxs.map((idx) => {
      const x = leftPad + (idx / Math.max(values.length - 1, 1)) * innerW;
      return { idx, x, label: formatX(timeline[idx] ?? idx) };
    });
  }, [innerW, leftPad, values.length, xValues]);

  return (
    <View style={[styles.card, { height }]}> 
      {title ? <Text style={styles.title}>{title}</Text> : null}
      <Animated.View
        style={[
          styles.chartWrap,
          {
            opacity: chartAnim,
            transform: [
              {
                translateY: chartAnim.interpolate({
                  inputRange: [0, 1],
                  outputRange: [6, 0]
                })
              }
            ]
          }
        ]}
      >
        <Svg width={chartWidth} height={chartHeight}>
          <Defs>
            <LinearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
              <Stop offset="0%" stopColor={color} stopOpacity="0.22" />
              <Stop offset="100%" stopColor={color} stopOpacity="0.035" />
            </LinearGradient>
          </Defs>

          {yLines.map((y, idx) => (
            <Line
              key={`line-${idx}`}
              x1={leftPad}
              y1={y}
              x2={leftPad + innerW}
              y2={y}
              stroke={theme.colors.border}
              strokeDasharray={idx === Math.floor(safeTickCount / 2) ? '3 5' : '2 6'}
              strokeOpacity={idx === Math.floor(safeTickCount / 2) ? 0.65 : 0.38}
              strokeWidth={idx === Math.floor(safeTickCount / 2) ? 0.95 : 0.75}
            />
          ))}

          {xTicks.map((tick, idx) => (
            <Line
              key={`x-line-${idx}`}
              x1={tick.x}
              y1={topPad}
              x2={tick.x}
              y2={topPad + innerH}
              stroke={theme.colors.border}
              strokeDasharray="2 6"
              strokeOpacity={0.22}
              strokeWidth={0.75}
            />
          ))}

          {areaPath ? <Path d={areaPath} fill={`url(#${gradientId})`} /> : null}
          {linePath ? (
            <Path
              d={linePath}
              fill="none"
              stroke={color}
              strokeWidth={2.7}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          ) : null}
        </Svg>

        <View style={styles.yLabels} pointerEvents="none">
          {yTicks.map((tick, idx) => (
            <Text key={`tick-${idx}`} style={[styles.tick, { top: yLines[idx] - 8 }]}>
              {label(tick)}
            </Text>
          ))}
        </View>

        <View style={[styles.xLabels, { left: leftPad, right: rightPad }]} pointerEvents="none">
          {xTicks.map((tick) => (
            <Text key={`x-${tick.idx}`} style={[styles.xTick, { left: tick.x - leftPad - 16 }]}>
              {tick.label}
            </Text>
          ))}
        </View>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: theme.colors.card,
    borderRadius: theme.radius.lg,
    paddingTop: 8,
    paddingHorizontal: 12,
    marginBottom: theme.spacing.md,
    overflow: 'hidden',
    ...theme.shadow.card
  },
  title: {
    marginTop: 10,
    marginLeft: 2,
    color: theme.colors.text,
    fontSize: 16,
    fontFamily: theme.font.semiBold
  },
  chartWrap: {
    marginTop: 6,
    marginBottom: 8
  },
  yLabels: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    width: 40
  },
  tick: {
    position: 'absolute',
    color: theme.colors.muted,
    fontSize: 10,
    fontFamily: theme.font.regular
  },
  xLabels: {
    position: 'absolute',
    bottom: 0,
    height: 14
  },
  xTick: {
    position: 'absolute',
    color: theme.colors.muted,
    fontSize: 10,
    fontFamily: theme.font.regular
  }
});
