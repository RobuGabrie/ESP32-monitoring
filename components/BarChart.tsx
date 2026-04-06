import React, { useMemo } from 'react';
import { StyleProp, StyleSheet, Text, View, ViewStyle } from 'react-native';
import Svg, { Line, Rect } from 'react-native-svg';

import { AppTheme } from '@/constants/theme';
import { useAppTheme } from '@/hooks/useAppTheme';

interface Props {
  cpuHistory: number[];
  currentHistory: number[];
  historyTimeline?: number[];
  title?: string;
  subtitle?: string;
  style?: StyleProp<ViewStyle>;
}

const BAR_HEIGHT = 180;
const GAP = 5;
const BUCKET_COUNT = 12;
const CPU_MAX = 100;
const SVG_W = 360;
const MIN_CURRENT_MAX = 150;

function bucketize(data: number[], buckets: number): number[] {
  if (data.length === 0) return Array(buckets).fill(0);
  return Array.from({ length: buckets }, (_, i) => {
    const start = Math.floor((i * data.length) / buckets);
    const end = Math.floor(((i + 1) * data.length) / buckets);
    const slice = data.slice(start, Math.max(start + 1, end));
    return slice.length > 0 ? slice.reduce((a, b) => a + b, 0) / slice.length : 0;
  });
}

function niceUpperBound(value: number): number {
  if (value <= 0) return MIN_CURRENT_MAX;
  const magnitude = Math.pow(10, Math.floor(Math.log10(value)));
  const normalized = value / magnitude;
  const rounded =
    normalized <= 1 ? 1 :
    normalized <= 2 ? 2 :
    normalized <= 5 ? 5 : 10;
  return Math.max(MIN_CURRENT_MAX, rounded * magnitude);
}

function formatRelativeTime(ms: number): string {
  const s = Math.round(ms / 1000);
  if (s < 60) return `${s}s`;
  const m = Math.round(s / 60);
  if (m < 60) return `${m}m`;
  return `${Math.round(m / 60)}h`;
}

export function BarChart({ cpuHistory, currentHistory, historyTimeline, title, subtitle, style }: Props) {
  const { theme } = useAppTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);

  const cpuBuckets = useMemo(() => bucketize(cpuHistory, BUCKET_COUNT), [cpuHistory]);
  const currentBuckets = useMemo(() => bucketize(currentHistory, BUCKET_COUNT), [currentHistory]);
  const currentAxisMax = useMemo(
    () => niceUpperBound(Math.max(0, ...currentHistory, ...currentBuckets)),
    [currentHistory, currentBuckets]
  );

  const highLoadCount = useMemo(() => cpuBuckets.filter(v => v >= 80).length, [cpuBuckets]);
  const lastCpu = cpuHistory.length > 0 ? cpuHistory[cpuHistory.length - 1] : 0;
  const avgCpu = cpuHistory.length > 0
    ? cpuHistory.reduce((a, b) => a + b, 0) / cpuHistory.length
    : 0;
  const peakCpu = cpuHistory.length > 0 ? Math.max(...cpuHistory) : 0;
  const lastCurrent = currentHistory.length > 0 ? currentHistory[currentHistory.length - 1] : 0;

  const timeLabels = useMemo((): string[] => {
    if (!historyTimeline || historyTimeline.length < 2) {
      return Array.from({ length: BUCKET_COUNT }, (_, i) =>
        i === BUCKET_COUNT - 1 ? 'acum' : ''
      );
    }
    const now = historyTimeline[historyTimeline.length - 1];
    return Array.from({ length: BUCKET_COUNT }, (_, i) => {
      const idx = Math.min(
        Math.floor((i * historyTimeline.length) / BUCKET_COUNT),
        historyTimeline.length - 1
      );
      const delta = now - historyTimeline[idx];
      if (i === BUCKET_COUNT - 1) return 'acum';
      // only show label at a few positions to avoid clutter
      if (i % 3 !== 0) return '';
      return `-${formatRelativeTime(delta)}`;
    });
  }, [historyTimeline]);

  const barWidth = (SVG_W - (BUCKET_COUNT - 1) * GAP) / BUCKET_COUNT;
  const pairWidth = (barWidth - 2) / 2;

  // guide line Y positions within SVG coordinate space
  const y100 = 2;
  const y80 = BAR_HEIGHT - (80 / CPU_MAX) * (BAR_HEIGHT - 4);
  const yCurrentHalf = BAR_HEIGHT - (0.5 * (BAR_HEIGHT - 4));

  return (
    <View style={[styles.card, style]}>
      {/* Antet */}
      <View style={styles.titleRow}>
        <Text style={styles.title} numberOfLines={1}>
          {title ?? 'Încărcare CPU'}
        </Text>
        {highLoadCount > 0 && (
          <View style={styles.badge}>
            <Text style={styles.badgeText}>⚡ {highLoadCount} vârfuri</Text>
          </View>
        )}
      </View>
      <Text style={styles.sub}>
        {subtitle ?? 'Încărcare CPU (albastru) și consum curent (portocaliu) în ultimele ore'}
      </Text>

      {/* Legendă */}
      <View style={styles.legend}>
        <View style={styles.legendItem}>
          <View style={[styles.legendDot, { backgroundColor: theme.chart.palette.cpu }]} />
          <Text style={styles.legendLabel}>CPU %</Text>
        </View>
        <View style={styles.legendItem}>
          <View style={[styles.legendDot, { backgroundColor: theme.chart.palette.current }]} />
          <Text style={styles.legendLabel}>Curent (mA)</Text>
        </View>
        <View style={styles.legendItem}>
          <View style={[styles.legendDot, { backgroundColor: theme.colors.warning, width: 16, height: 1, borderRadius: 0 }]} />
          <Text style={styles.legendLabel}>Prag 80%</Text>
        </View>
      </View>

      {/* Zonă grafic */}
      <View style={styles.chartArea}>
        {/* Etichete axa Y (CPU) */}
        <View style={styles.yAxis}>
          <Text style={[styles.yLabel, { position: 'absolute', top: y100 - 2, right: 2 }]}>100</Text>
          <Text style={[styles.yLabel, { position: 'absolute', top: y80 - 5, right: 2 }]}>80</Text>
          <Text style={[styles.yLabel, { position: 'absolute', bottom: 0, right: 2 }]}>0</Text>
        </View>

        {/* Grafic SVG */}
        <View style={styles.chartWrap}>
          <Svg width="100%" height={BAR_HEIGHT} viewBox={`0 0 ${SVG_W} ${BAR_HEIGHT}`} preserveAspectRatio="none">
            {/* Linie ghid 100% */}
            <Line x1={0} y1={y100} x2={SVG_W} y2={y100} stroke={theme.colors.border} strokeWidth={0.5} />
            {/* Prag pericol 80% */}
            <Line
              x1={0} y1={y80} x2={SVG_W} y2={y80}
              stroke={theme.colors.warning}
              strokeWidth={0.6}
              strokeDasharray="4,4"
              opacity={0.6}
            />
            {/* Linie ghid jumătate scală curent */}
            <Line
              x1={0} y1={yCurrentHalf} x2={SVG_W} y2={yCurrentHalf}
              stroke={theme.colors.border}
              strokeWidth={0.4}
              strokeDasharray="2,6"
              opacity={0.35}
            />

            {cpuBuckets.map((cpu, i) => {
              const curr = currentBuckets[i];
              const x = i * (barWidth + GAP);

              // CPU pe scală fixă 0–100
              const cpuH = Math.max(2, (cpu / CPU_MAX) * (BAR_HEIGHT - 4));
              // Curent pe scală dedicată mA
              const currH = Math.max(2, (curr / currentAxisMax) * (BAR_HEIGHT - 4));

              const cpuColor =
                cpu >= 90 ? theme.colors.danger :
                cpu >= 70 ? theme.colors.warning :
                theme.chart.palette.cpu;

              return (
                <React.Fragment key={i}>
                  <Rect
                    x={x}
                    y={BAR_HEIGHT - cpuH}
                    width={pairWidth}
                    height={cpuH}
                    rx={3}
                    fill={cpuColor}
                    opacity={0.92}
                  />
                  <Rect
                    x={x + pairWidth + 2}
                    y={BAR_HEIGHT - currH}
                    width={pairWidth}
                    height={currH}
                    rx={3}
                    fill={theme.chart.palette.current}
                    opacity={0.7}
                  />
                </React.Fragment>
              );
            })}
          </Svg>

          {/* Etichete timp sub grafic */}
          <View style={styles.timeRow}>
            {timeLabels.map((label, i) => (
              <Text key={i} style={styles.timeLabel}>{label}</Text>
            ))}
          </View>
        </View>

        {/* Etichete axa Y (Curent mA) */}
        <View style={styles.yAxisRight}>
          <Text style={[styles.yLabel, { position: 'absolute', top: y100 - 2, left: 2 }]}>
            {currentAxisMax.toFixed(0)}
          </Text>
          <Text style={[styles.yLabel, { position: 'absolute', top: yCurrentHalf - 5, left: 2 }]}>
            {(currentAxisMax / 2).toFixed(0)}
          </Text>
          <Text style={[styles.yLabel, { position: 'absolute', bottom: 0, left: 2 }]}>0 mA</Text>
        </View>
      </View>

      {/* Statistici subsol */}
      <View style={styles.footer}>
        <View style={styles.footerStat}>
          <Text style={styles.footerLabel}>ACUM</Text>
          <Text style={[styles.footerVal, {
            color: lastCpu >= 90 ? theme.colors.danger :
                   lastCpu >= 70 ? theme.colors.warning :
                   theme.colors.text
          }]}>{lastCpu.toFixed(0)}%</Text>
        </View>
        <View style={styles.footerStat}>
          <Text style={styles.footerLabel}>MEDIE</Text>
          <Text style={styles.footerVal}>{avgCpu.toFixed(0)}%</Text>
        </View>
        <View style={styles.footerStat}>
          <Text style={styles.footerLabel}>VÂRF</Text>
          <Text style={[styles.footerVal, {
            color: peakCpu >= 80 ? theme.colors.warning : theme.colors.text
          }]}>{peakCpu.toFixed(0)}%</Text>
        </View>
        <View style={styles.footerStat}>
          <Text style={styles.footerLabel}>CURENT</Text>
          <Text style={[styles.footerVal, { color: theme.chart.palette.current }]}>
            {lastCurrent.toFixed(0)} mA
          </Text>
        </View>
      </View>
    </View>
  );
}

const createStyles = (theme: AppTheme) => StyleSheet.create({
  card: {
    backgroundColor: theme.colors.card,
    borderRadius: theme.radius.lg,
    padding: theme.spacing.lg,
    marginBottom: theme.spacing.md,
    width: '100%',
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.sm,
    marginBottom: theme.spacing.xs,
  },
  title: {
    color: theme.colors.text,
    ...theme.type.sectionTitle,
    flex: 1,
  },
  badge: {
    backgroundColor: theme.accents.warning,
    borderRadius: theme.radius.sm,
    paddingHorizontal: theme.spacing.sm,
    paddingVertical: theme.spacing.xs,
  },
  badgeText: {
    color: theme.colors.warning,
    ...theme.type.caption,
  },
  sub: {
    color: theme.colors.textSoft,
    ...theme.type.bodySm,
    marginBottom: theme.spacing.sm,
  },
  legend: {
    flexDirection: 'row',
    gap: theme.spacing.md,
    marginBottom: theme.spacing.md,
    flexWrap: 'wrap',
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.xs,
  },
  legendDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  legendLabel: {
    color: theme.colors.textSoft,
    ...theme.type.caption,
  },
  chartArea: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  yAxis: {
    width: 30,
    height: BAR_HEIGHT,
    marginRight: theme.spacing.xs,
  },
  yAxisRight: {
    width: 38,
    height: BAR_HEIGHT,
    marginLeft: theme.spacing.xs,
  },
  yLabel: {
    color: theme.colors.muted,
    fontFamily: theme.font.mono,
    fontSize: 10,
    lineHeight: 12,
  },
  chartWrap: {
    flex: 1,
  },
  timeRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 4,
    marginBottom: theme.spacing.sm,
  },
  timeLabel: {
    fontSize: 9,
    color: theme.colors.muted,
    fontFamily: theme.font.mono,
    flex: 1,
    textAlign: 'center',
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    paddingTop: theme.spacing.md,
    borderTopWidth: 1,
    borderTopColor: theme.colors.border,
  },
  footerStat: {
    flex: 1,
    alignItems: 'center',
  },
  footerLabel: {
    ...theme.type.caption,
    color: theme.colors.textSoft,
    marginBottom: theme.spacing.xs,
  },
  footerVal: {
    fontSize: 20,
    color: theme.colors.text,
    fontFamily: theme.font.mono,
    fontWeight: '700',
  },
});
