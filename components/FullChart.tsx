import { useEffect, useMemo, useRef } from 'react';
import { Animated, Easing, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { Circle, Defs, Line, LinearGradient, Path, Stop, Svg } from 'react-native-svg';
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
  showLegend?: boolean;
  showEventMarker?: boolean;
  eventDeltaThreshold?: number;
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

const buildSmoothPath = (points: { x: number; y: number }[]) => {
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
  xValues,
  showLegend = false,
  showEventMarker = false,
  eventDeltaThreshold
}: Props) {
  const { width: windowWidth } = useWindowDimensions();
  const values = useMemo(() => {
    if (!data.length) {
      return [0, 0];
    }

    // Preserve index alignment with xValues by replacing invalid samples,
    // not removing them from the series.
    const sanitized: number[] = [];
    for (let i = 0; i < data.length; i += 1) {
      const v = data[i];
      if (Number.isFinite(v)) {
        sanitized.push(v);
      } else if (sanitized.length) {
        sanitized.push(sanitized[sanitized.length - 1]);
      } else {
        sanitized.push(0);
      }
    }

    return smoothSeries(sanitized);
  }, [data]);

  const chartHeight = Math.max(height - 70, 120);
  const safeTickCount = Math.max(4, chartHeight < 155 ? yTickCount - 1 : yTickCount);
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
  const yLabelWidth = useMemo(() => {
    const samples = [label(min), label(max), label(min + range / 2)];
    const longest = samples.reduce((acc, item) => Math.max(acc, item.length), 0);
    return Math.min(72, Math.max(42, Math.ceil(longest * 5.2) + 8));
  }, [label, max, min, range]);

  const chartWidth = Math.max(windowWidth - 32 - 24, 220);
  const leftPad = yLabelWidth;
  const rightPad = 10;
  const topPad = 8;
  const bottomPad = 26;
  const innerW = chartWidth - leftPad - rightPad;
  const innerH = chartHeight - topPad - bottomPad;
  const chartAnim = useRef(new Animated.Value(0)).current;
  const animatedOnce = useRef(false);

  const { linePath, areaPath, lastPoint, latestValue } = useMemo(() => {
    const points = values
      .map((v, i) => {
        const x = leftPad + (i / Math.max(values.length - 1, 1)) * innerW;
        const y = topPad + (1 - (v - min) / range) * innerH;
        return { x, y };
      })
      .filter((p) => Number.isFinite(p.x) && Number.isFinite(p.y));

    if (!points.length) {
      return { linePath: '', areaPath: '', lastPoint: null, latestValue: 0 };
    }

    const line = buildSmoothPath(points);
    const area = `${line} L ${points[points.length - 1].x} ${topPad + innerH} L ${points[0].x} ${topPad + innerH} Z`;

    return { linePath: line, areaPath: area, lastPoint: points[points.length - 1], latestValue: values[values.length - 1] ?? 0 };
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
    const normalizeEpoch = (value: number) => {
      if (!Number.isFinite(value)) {
        return Number.NaN;
      }
      if (value > 1_000_000_000_000) {
        return value;
      }
      if (value > 1_000_000_000) {
        return value * 1000;
      }
      return Number.NaN;
    };

    const timeline = Array.isArray(xValues) && xValues.length === values.length
      ? xValues
      : Array.from({ length: values.length }, (_, i) => i);

    const realTimes = timeline
      .map((v) => normalizeEpoch(v))
      .filter((v): v is number => Number.isFinite(v));
    const tMin = realTimes.length ? Math.min(...realTimes) : NaN;
    const tMax = realTimes.length ? Math.max(...realTimes) : NaN;
    const hasRealRange = Number.isFinite(tMin) && Number.isFinite(tMax) && tMax >= tMin;

    const spanMs = hasRealRange ? Math.abs((tMax as number) - (tMin as number)) : 0;
    const formatX = (v: number) => {
      const normalized = normalizeEpoch(v);
      if (Number.isFinite(normalized)) {
        if (spanMs > 24 * 60 * 60 * 1000) {
          return formatDate(normalized, 'dd/MM HH:mm');
        }
        if (spanMs > 2 * 60 * 60 * 1000) {
          return formatDate(normalized, 'HH:mm');
        }
        return formatDate(normalized, 'HH:mm:ss');
      }
      return String(v);
    };

    if (hasRealRange) {
      const start = tMin as number;
      const end = tMax as number;
      const mid = start + (end - start) / 2;
      return [
        { idx: 0, x: leftPad, label: formatX(start) },
        { idx: 1, x: leftPad + innerW / 2, label: formatX(mid) },
        { idx: 2, x: leftPad + innerW, label: formatX(end) }
      ];
    }

    const last = timeline.length - 1;
    const mid = Math.floor(last / 2);
    const idxs = [...new Set([0, mid, last])].filter((idx) => idx >= 0);
    return idxs.map((idx) => {
      const x = leftPad + (idx / Math.max(values.length - 1, 1)) * innerW;
      return { idx, x, label: formatX(timeline[idx] ?? idx) };
    });
  }, [innerW, leftPad, values.length, xValues]);

  const chartStats = useMemo(() => {
    if (!values.length) {
      return null;
    }

    return {
      minV: Math.min(...values),
      maxV: Math.max(...values)
    };
  }, [values]);

  const eventMarker = useMemo(() => {
    if (!showEventMarker || !lastPoint || values.length < 2) {
      return null;
    }

    const prev = values[values.length - 2] ?? latestValue;
    const delta = latestValue - prev;
    const threshold = typeof eventDeltaThreshold === 'number' ? eventDeltaThreshold : Math.max(range * 0.18, 1);

    if (Math.abs(delta) < threshold) {
      return null;
    }

    return {
      delta,
      label: delta < 0 ? 'Scadere brusca' : 'Crestere brusca'
    };
  }, [eventDeltaThreshold, lastPoint, latestValue, range, showEventMarker, values]);

  return (
    <View style={[styles.card, { height }]}> 
      {title ? <Text style={styles.title}>{title}</Text> : null}
      {showLegend && chartStats ? (
        <View style={styles.legendRow}>
          <Text style={styles.legendText}>Min: {label(chartStats.minV)}</Text>
          <Text style={styles.legendText}>Max: {label(chartStats.maxV)}</Text>
          <Text style={styles.legendText}>Acum: {label(latestValue)}</Text>
        </View>
      ) : null}
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
              <Stop offset="0%" stopColor={color} stopOpacity={theme.chart.fillOpacity.start} />
              <Stop offset="100%" stopColor={color} stopOpacity={theme.chart.fillOpacity.end} />
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
              strokeWidth={theme.chart.strokeWidth.normal}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          ) : null}
          {eventMarker && lastPoint ? (
            <Line
              x1={lastPoint.x}
              y1={topPad}
              x2={lastPoint.x}
              y2={topPad + innerH}
              stroke={eventMarker.delta < 0 ? theme.colors.warning : theme.colors.info}
              strokeDasharray="3 4"
              strokeOpacity={0.8}
              strokeWidth={1.1}
            />
          ) : null}
          {lastPoint ? (
            <>
              <Circle cx={lastPoint.x} cy={lastPoint.y} r={5.5} fill={color} opacity={0.18} />
              <Circle cx={lastPoint.x} cy={lastPoint.y} r={3.2} fill={color} />
            </>
          ) : null}
        </Svg>

        {lastPoint ? (
          <View
            style={[
              styles.valuePill,
              {
                left: Math.max(leftPad + 6, Math.min(lastPoint.x + 8, chartWidth - 92)),
                top: Math.max(topPad + 2, lastPoint.y - 16)
              }
            ]}
          >
            <Text style={styles.valuePillText}>{label(latestValue)}</Text>
          </View>
        ) : null}

        {eventMarker && lastPoint ? (
          <View
            style={[
              styles.eventPill,
              {
                left: Math.max(leftPad + 4, Math.min(lastPoint.x - 58, chartWidth - 128)),
                top: Math.max(topPad + 2, lastPoint.y + 8),
                backgroundColor: eventMarker.delta < 0 ? '#FEF3C7' : '#E0F2FE'
              }
            ]}
          >
            <Text style={[styles.eventPillText, { color: eventMarker.delta < 0 ? '#92400E' : '#0C4A6E' }]}>{eventMarker.label}</Text>
          </View>
        ) : null}

        <View style={styles.yLabels} pointerEvents="none">
          {yTicks.map((tick, idx) => (
            idx % (chartHeight < 155 ? 2 : 1) === 0 ? (
              <Text key={`tick-${idx}`} style={[styles.tick, { top: yLines[idx] - (chartHeight < 155 ? 6 : 8), fontSize: chartHeight < 155 ? 9 : 10 }]}>
                {label(tick)}
              </Text>
            ) : null
          ))}
        </View>

        <View style={[styles.xLabels, { left: leftPad, right: rightPad }]} pointerEvents="none">
          {xTicks.map((tick, tickIndex) => {
            const isFirst = tickIndex === 0;
            const isLast = tickIndex === xTicks.length - 1;
            const tickWidth = tick.label.length > 7 ? 78 : 48;
            const offset = isFirst ? 0 : isLast ? tickWidth : tickWidth / 2;

            return (
              <Text key={`x-${tick.idx}`} style={[styles.xTick, { width: tickWidth, left: tick.x - leftPad - offset }]}>
              {tick.label}
              </Text>
            );
          })}
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
    borderWidth: 1,
    borderColor: '#E6EBF2',
    overflow: 'hidden',
    borderLeftWidth: 3,
    borderLeftColor: '#E2E8F0'
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
  legendRow: {
    marginTop: 8,
    marginBottom: 4,
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 6,
    backgroundColor: theme.colors.surfaceAlt,
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 6
  },
  legendText: {
    fontSize: 10,
    color: theme.colors.textSoft,
    fontFamily: theme.font.medium
  },
  valuePill: {
    position: 'absolute',
    backgroundColor: '#0F172A',
    borderRadius: 999,
    paddingHorizontal: 7,
    paddingVertical: 4
  },
  valuePillText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontFamily: theme.font.semiBold
  },
  eventPill: {
    position: 'absolute',
    borderRadius: 999,
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderWidth: 1,
    borderColor: '#FDE68A'
  },
  eventPillText: {
    fontSize: 10,
    fontFamily: theme.font.semiBold
  },
  yLabels: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    width: 72
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
    fontFamily: theme.font.regular,
    textAlign: 'center'
  }
});
