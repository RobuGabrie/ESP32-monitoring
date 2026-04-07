import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Alert, Animated, Easing, Modal, Pressable, ScrollView, Share, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import Svg, { Defs, LinearGradient, Rect, Stop } from 'react-native-svg';

import { BarChart } from '@/components/BarChart';
import { BatteryHeroCard } from '@/components/BatteryHeroCard';
import { BentoSensorsGrid } from '@/components/BentoSensorsGrid';
import { FullChart } from '@/components/FullChart';
import { ScreenShell } from '@/components/ScreenShell';
import { AppTheme } from '@/constants/theme';
import { useAppTheme } from '@/hooks/useAppTheme';
import { useESP32 } from '@/hooks/useESP32';
import { ModuleName, TimeRangeKey, getStoreState } from '@/hooks/useStore';

type DashboardCard = {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  cmd: ModuleName;
  source: string;
  value: string;
  color: string;
  history: number[];
  detailLabel: (v: number) => string;
};

const parsePayloadTimestamp = (value?: string, fallbackMs?: number): Date | null => {
  if (value && value.trim()) {
    const trimmed = value.trim();
    const asNumber = Number(trimmed);

    if (Number.isFinite(asNumber) && /^\d+(\.\d+)?$/.test(trimmed)) {
      const epochMs = asNumber > 1_000_000_000_000 ? asNumber : asNumber > 1_000_000_000 ? asNumber * 1000 : asNumber;
      const date = new Date(epochMs);
      if (Number.isFinite(date.getTime())) {
        return date;
      }
    }

    const direct = new Date(trimmed);
    if (Number.isFinite(direct.getTime())) {
      return direct;
    }

    const withIsoSeparator = new Date(trimmed.replace(' ', 'T'));
    if (Number.isFinite(withIsoSeparator.getTime())) {
      return withIsoSeparator;
    }
  }

  if (typeof fallbackMs === 'number' && Number.isFinite(fallbackMs) && fallbackMs > 0) {
    const fallbackDate = new Date(fallbackMs);
    if (Number.isFinite(fallbackDate.getTime())) {
      return fallbackDate;
    }
  }

  return null;
};

const formatClockTime = (date: Date) => {
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  const seconds = String(date.getSeconds()).padStart(2, '0');
  return `${hours}:${minutes}:${seconds}`;
};

const formatCalendarDate = (date: Date) => {
  const day = String(date.getDate()).padStart(2, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const year = date.getFullYear();
  return `${day}.${month}.${year}`;
};

const getNiceMax = (value: number, step: number, floor: number) => {
  const scaled = Math.ceil(Math.max(value, floor) / step) * step;
  return Number.isFinite(scaled) ? scaled : floor;
};

export default function OverviewScreen() {
  const { theme } = useAppTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const { data, history, status, mqttStatus, moduleStates, totalCurrentMah, peakCurrent, selectedRange, setTimeRange } = useESP32();
  const { width } = useWindowDimensions();
  const [selectedCmd, setSelectedCmd] = useState<ModuleName | null>(null);
  const livePulse = useRef(new Animated.Value(1)).current;
  const isDesktop = width >= 768;
  const isCompactDesktopRtc = isDesktop && width < 1220;
  const renderWindow = isDesktop ? 900 : 480;

  const onExportPress = useCallback(async () => {
    try {
      const ioLog = getStoreState().ioLog;
      const snapshot = {
        exportedAt: new Date().toISOString(),
        status,
        data,
        moduleStates,
        history: {
          temp: history.tempHistory.slice(-80),
          cpu: history.cpuHistory.slice(-80),
          current: history.currentHistory.slice(-80),
          volt: history.voltHistory.slice(-80),
          rssi: history.rssiHistory.slice(-80),
          power: history.powerHistory.slice(-80)
        },
        ioLog: ioLog.slice(-120)
      };

      await Share.share({
        title: 'Export telemetrie ESP32',
        message: JSON.stringify(snapshot, null, 2)
      });
    } catch {
      Alert.alert('Export eșuat', 'Nu s-a putut exporta snapshot-ul de telemetrie. Încearcă din nou.');
    }
  }, [data, history, moduleStates, status]);

  const rangeSubtitleMap: Record<TimeRangeKey, string> = {
    '60s': 'ultimele 60 secunde',
    '15m': 'ultimele 15 minute',
    '1h': 'ultima ora',
    '6h': 'ultimele 6 ore',
    '24h': 'ultimele 24 ore',
    '7d': 'ultimele 7 zile',
    all: 'toata perioada'
  };
  const rangeSubtitle = rangeSubtitleMap[selectedRange] ?? 'ultimele 60 secunde';

  const visibleHistory = useMemo(() => {
    const from = Math.max(0, history.timeline.length - renderWindow);
    return {
      tempHistory: history.tempHistory.slice(from),
      lightHistory: history.lightHistory.slice(from),
      cpuHistory: history.cpuHistory.slice(from),
      currentHistory: history.currentHistory.slice(from),
      voltHistory: history.voltHistory.slice(from),
      rssiHistory: history.rssiHistory.slice(from),
      powerHistory: history.powerHistory.slice(from),
      timeline: history.timeline.slice(from)
    };
  }, [history, renderWindow]);

  const temperatureDetailCard = useMemo<DashboardCard>(() => ({
    icon: 'thermometer',
    title: 'Temperatură',
    cmd: 'temperature' as ModuleName,
    source: 'Termistor',
    value: `${(data?.temp ?? 0).toFixed(1)} °C`,
    color: '#e8542a',
    history: visibleHistory.tempHistory,
    detailLabel: (v: number) => `${v.toFixed(1)} °C`
  }), [data, visibleHistory.tempHistory]);
  const cpuDetailCard = useMemo<DashboardCard>(() => ({
    icon: 'hardware-chip',
    title: 'CPU Load',
    cmd: 'cpu' as ModuleName,
    source: 'ESP32',
    value: `${(data?.cpu ?? 0).toFixed(1)} %`,
    color: theme.chart.palette.cpu,
    history: visibleHistory.cpuHistory,
    detailLabel: (v: number) => `${v.toFixed(1)} %`
  }), [data, visibleHistory.cpuHistory, theme]);

  const allCards = useMemo(() => [temperatureDetailCard, cpuDetailCard], [temperatureDetailCard, cpuDetailCard]);
  const selectedCard = useMemo(() => allCards.find((c) => c.cmd === selectedCmd) ?? null, [allCards, selectedCmd]);
  const selectedSeries = useMemo(() => selectedCard?.history ?? [], [selectedCard]);
  const detailStats = useMemo(() => {
    if (!selectedSeries.length) {
      return { min: 0, max: 0, avg: 0, points: 0 };
    }

    const min = Math.min(...selectedSeries);
    const max = Math.max(...selectedSeries);
    const avg = selectedSeries.reduce((acc, value) => acc + value, 0) / selectedSeries.length;
    return { min, max, avg, points: selectedSeries.length };
  }, [selectedSeries]);

  const modalScaleMax = useMemo(() => {
    if (!selectedCard) {
      return 100;
    }

    const peak = Math.max(0, ...selectedSeries);
    if (selectedCard.cmd === 'cpu') {
      return 100;
    }

    if (selectedCard.cmd === 'temperature') {
      return getNiceMax(peak * 1.1, 5, 40);
    }

    return getNiceMax(peak * 1.1, 50, 200);
  }, [selectedCard, selectedSeries]);

  const formatUptime = (seconds: number) => {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = Math.floor(seconds % 60);
    return h > 0 ? `${h}h ${m}m` : `${m}m ${s}s`;
  };

  const offline = mqttStatus === 'offline';
  const rtcDate = parsePayloadTimestamp(data?.timestamp, data?.recordedAtMs);
  const rtcAgeSeconds = rtcDate ? Math.max(0, (Date.now() - rtcDate.getTime()) / 1000) : null;
  const rtcIsFresh = typeof rtcAgeSeconds === 'number' ? rtcAgeSeconds <= 90 : false;
  const rtcAgeLabel = typeof rtcAgeSeconds === 'number'
    ? rtcAgeSeconds < 60
      ? `${Math.floor(rtcAgeSeconds)}s in urma`
      : `${Math.floor(rtcAgeSeconds / 60)}m in urma`
    : 'fara sincronizare';
  const rtcFreshnessPercent = rtcDate ? Math.max(0, 100 - Math.min(100, ((rtcAgeSeconds ?? 0) / 180) * 100)) : 0;

  useEffect(() => {
    if (!rtcIsFresh || offline || !rtcDate) {
      livePulse.setValue(1);
      return;
    }

    const pulse = Animated.loop(
      Animated.sequence([
        Animated.timing(livePulse, { toValue: 0.25, duration: 640, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
        Animated.timing(livePulse, { toValue: 1, duration: 640, easing: Easing.inOut(Easing.quad), useNativeDriver: true })
      ])
    );
    pulse.start();
    return () => pulse.stop();
  }, [rtcIsFresh, offline, rtcDate, livePulse]);

  const sensorItems = useMemo(() => [
    {
      label: 'WIFI LINK',
      value: data?.ip && data.ip !== '--' ? data.ip : '--',
      unit: '',
      barPercent: Math.min(100, Math.max(0, ((data?.channel ?? 0) / 13) * 100)),
      barColor: 'green' as const,
      accentColor: theme.chart.palette.rssi,
      trend: `CH ${(data?.channel ?? 0) > 0 ? data?.channel : '--'} · MAC ${data?.mac ?? '--'}`,
      icon: 'link-outline' as const,
      layout: 'wide' as const,
      isStale: offline || !data?.ip || data.ip === '--'
    },
    {
      label: 'TEMPERATURĂ NTC',
      value: (data?.temp ?? 0).toFixed(1),
      unit: '°C',
      barPercent: Math.min(100, ((data?.temp ?? 0) / 50) * 100),
      barColor: 'orange' as const,
      paletteKey: 'temperature' as const,
      trend: `${(data?.temp ?? 0) >= 35 ? '⚠ Ridicat' : '✓ Normal'}`,
      icon: 'thermometer-outline' as const,
      layout: 'tall' as const,
      isStale: offline || (data?.temp ?? 0) === 0
    },
    {
      label: 'WIFI RSSI',
      value: Math.round(data?.rssi ?? -99).toString(),
      unit: 'dBm',
      barPercent: Math.min(100, Math.max(0, ((data?.rssi ?? -99) + 100) * 2)),
      barColor: 'green' as const,
      accentColor: (data?.rssi ?? -99) > -70 ? theme.colors.success : theme.colors.primary,
      trend: `SSID ${data?.ssid ?? '--'}`,
      icon: 'wifi-outline' as const,
      layout: 'tall' as const,
      isStale: offline || (data?.rssi ?? -99) <= -99
    },
    {
      label: 'CURENT TOTAL',
      value: (data?.current ?? 0).toFixed(0),
      unit: 'mA',
      barPercent: Math.min(100, ((data?.current ?? 0) / 300) * 100),
      barColor: 'orange' as const,
      paletteKey: 'current' as const,
      trend: `${((data?.powerMw ?? 0) / 1000).toFixed(2)} W · ${(data?.volt ?? 0).toFixed(2)} V`,
      icon: 'battery-charging-outline' as const,
      layout: 'wide' as const,
      isStale: offline || ((data?.current ?? 0) === 0 && (data?.volt ?? 0) === 0)
    },
    {
      label: 'TENSIUNE INA219',
      value: (data?.volt ?? 0).toFixed(2),
      unit: 'V',
      barPercent: Math.min(100, ((data?.volt ?? 0) / 5) * 100),
      barColor: 'green' as const,
      paletteKey: 'voltage' as const,
      trend: `${(data?.volt ?? 0) >= 3.3 ? '✓ Normal' : '⚠ Scăzut'}`,
      icon: 'flash-outline' as const,
      layout: 'small' as const,
      isStale: offline || (data?.volt ?? 0) === 0
    },
    {
      label: 'IMU ROLL',
      value: (data?.roll ?? 0).toFixed(1),
      unit: '°',
      barPercent: Math.min(100, Math.max(0, (Math.abs(data?.roll ?? 0) / 180) * 100)),
      barColor: 'green' as const,
      paletteKey: 'imu' as const,
      icon: 'compass-outline' as const,
      layout: 'small' as const,
      isStale: offline || data?.imuMode === undefined
    },
    {
      label: 'UPTIME ESP32',
      value: formatUptime(data?.uptime ?? 0),
      unit: '',
      barPercent: Math.min(100, ((data?.uptime ?? 0) / 86400) * 100),
      barColor: 'orange' as const,
      paletteKey: 'uptime' as const,
      icon: 'time-outline' as const,
      layout: 'small' as const,
      isStale: offline || (data?.uptime ?? 0) === 0
    }
  ], [data, theme, offline]);

  const batteryPercent = data?.batteryPercent ?? 0;
  const currentMa = data?.current ?? 0;
  const voltage = data?.volt ?? 0;
  const powerW = (data?.powerMw ?? 0) / 1000;
  const estimatedHours = data?.batteryLifeMin ? data.batteryLifeMin / 60 : 0;

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.content}>
        <ScreenShell
          contentStyle={styles.pageShell}
          screenTitle="ESP32 Monitor"
          screenSubtitle={status === 'offline' ? 'ESP32 deconectat · date vechi' : 'Telemetrie în timp real · SUDO'}
          onExport={onExportPress}
          mqttStatus={mqttStatus}
          selectedRange={selectedRange}
          onRangeChange={setTimeRange}
        >

        {/* Row 1: Power Cost + Temperature Area Chart */}
        <View style={[styles.heroRow, isDesktop && styles.heroRowDesktop]}>
          
          <Pressable
            style={[styles.heroCol, isDesktop && styles.batteryCol]}
            onPress={() => Alert.alert('Baterie', `Nivel: ${batteryPercent}%\nTensiune: ${voltage.toFixed(2)} V\nConsum: ${currentMa.toFixed(1)} mA\nPutere: ${powerW.toFixed(2)} W\nAutonomie: ${estimatedHours.toFixed(1)} ore`)}
          >
            <BatteryHeroCard
              style={styles.rowCard}
              percent={batteryPercent}
              voltage={voltage}
              current={currentMa}
              powerW={powerW}
              estimatedHours={estimatedHours}
            />
          </Pressable>
          <View style={[styles.heroCol, isDesktop && styles.heroColDesktop, styles.heroColSymmetric]}>
            <Pressable onPress={() => setSelectedCmd('temperature')}>
              <FullChart
                title="Grafic Temperatură"
                subtitle={`Variație NTC · ${rangeSubtitle}`}
                data={visibleHistory.tempHistory}
                xValues={visibleHistory.timeline}
                color={theme.chart.palette.temperature}
                label={temperatureDetailCard.detailLabel}
                height={260}
                minValue={0}
                maxValue={30}
                yTickCount={6}
                showLegend
                showEventMarker
                eventDeltaThreshold={2}
              />
            </Pressable>
          </View>
        </View>
          {/* Row 4: Bento sensor grid */}
        

        {/* Row 2: Bar Chart + Battery % Card */}
        <View style={[styles.heroRow, isDesktop && styles.heroRowDesktop]}>
          <View style={[styles.heroCol, isDesktop && styles.barChartCol]}>
            <BarChart
              style={styles.rowCard}
              cpuHistory={visibleHistory.cpuHistory}
              currentHistory={visibleHistory.currentHistory}
              historyTimeline={visibleHistory.timeline}
              title="CPU Load in comparatie cu Curent"
              subtitle="CPU Load vs Curent consumat · ultimele 60 secunde"
            />
          </View>
          <View style={[styles.heroCol, isDesktop && styles.heroColDesktop, styles.heroColSymmetric]}>
            <Pressable onPress={() => setSelectedCmd('cpu')}>
              <FullChart
                title="Grafic CPU Load"
                subtitle={`Variație CPU · ${rangeSubtitle}`}
                data={visibleHistory.cpuHistory}
                xValues={visibleHistory.timeline}
                color={theme.chart.palette.cpu}
                label={cpuDetailCard.detailLabel}
                height={310}
                minValue={0}
                maxValue={100}
                yTickCount={6}
                showLegend
                showEventMarker
                eventDeltaThreshold={2}
              />
            </Pressable>
          </View>
        </View>

      
<View style={[styles.bentoSection, isDesktop && styles.bentoSectionDesktop]}>
          <BentoSensorsGrid data={data} isConnected={!offline} />
        </View>
        </ScreenShell>
      </ScrollView>

      <Modal visible={!!selectedCard} transparent animationType="fade" onRequestClose={() => setSelectedCmd(null)}>
        <Pressable style={styles.modalBackdrop} onPress={() => setSelectedCmd(null)}>
          <Pressable
            style={styles.modalCard}
            onPress={(event) => {
              event.stopPropagation();
            }}
          >
            {selectedCard ? (
              <>
                <View style={styles.modalHeader}>
                  <View>
                    <View style={styles.modalTitleRow}>
                      <Ionicons name={selectedCard.icon} size={18} color={theme.colors.primary} />
                      <Text style={styles.modalTitle}>{selectedCard.title}</Text>
                    </View>
                    <Text style={styles.modalSubtitle}>Detaliu extins cu scala 0 - {selectedCard.detailLabel(modalScaleMax)}</Text>
                  </View>
                  <Pressable style={styles.closeButton} onPress={() => setSelectedCmd(null)}>
                    <Text style={styles.closeText}>Închide</Text>
                  </Pressable>
                </View>

                <FullChart
                  title="Ultimele valori"
                  data={selectedSeries}
                  xValues={visibleHistory.timeline}
                  color={selectedCard.color}
                  label={selectedCard.detailLabel}
                  height={290}
                  minValue={0}
                  maxValue={modalScaleMax}
                  yTickCount={6}
                />

                <View style={styles.statsGrid}>
                  <View style={styles.statItem}>
                    <Text style={styles.statLabel}>Acum</Text>
                    <Text style={styles.statValue}>{selectedCard.value}</Text>
                  </View>
                  <View style={styles.statItem}>
                    <Text style={styles.statLabel}>Min</Text>
                    <Text style={styles.statValue}>{selectedCard.detailLabel(detailStats.min)}</Text>
                  </View>
                  <View style={styles.statItem}>
                    <Text style={styles.statLabel}>Max</Text>
                    <Text style={styles.statValue}>{selectedCard.detailLabel(detailStats.max)}</Text>
                  </View>
                  <View style={styles.statItem}>
                    <Text style={styles.statLabel}>Medie</Text>
                    <Text style={styles.statValue}>{selectedCard.detailLabel(detailStats.avg)}</Text>
                  </View>
                </View>

                <Text style={styles.modalFootnote}>Puncte analizate: {detailStats.points}. Graficul foloseste o scala mai precisa decat in cardul sumar.</Text>
              </>
            ) : null}
          </Pressable>
        </Pressable>
      </Modal>
    </SafeAreaView>
  );
}

const createStyles = (theme: AppTheme) => StyleSheet.create({
  safe: { flex: 1, backgroundColor: theme.colors.background },
  content: {
    paddingHorizontal: theme.spacing.lg,
    paddingTop: theme.spacing.lg,
    paddingBottom: 120
  },
  pageShell: {
    paddingHorizontal: 0,
    paddingTop: 0,
    paddingBottom: 0
  },
  heroRow: {
    flexDirection: 'column',
    gap: theme.spacing.md,
    marginBottom: theme.spacing.md,
    width: '100%'
  },
  heroRowDesktop: {
    flexDirection: 'row',
    alignItems: 'stretch'
  },
  heroCol: {
    flex: 1
  },
  heroColDesktop: {
    flexBasis: '48%'
  },
  heroColSymmetric: {
    minHeight: 280
  },
  barChartCol: {
    flexBasis: '58%'
  },
  batteryCol: {
    flexBasis: '40%'
  },
  rowCard: {
    flex: 1,
    marginBottom: 0
  },
  sensorRtcRow: {
    flexDirection: 'column',
    gap: theme.spacing.md,
    marginBottom: theme.spacing.md
  },
  sensorRtcRowDesktop: {
    flexDirection: 'row',
    alignItems: 'stretch'
  },
  sensorGridCol: {
    flex: 1,
    minWidth: 0,
    overflow: 'hidden'
  },
  sensorGridColDesktop: {
    flexBasis: '70%',
    flexShrink: 1
  },
  rtcCard: {
    marginTop: 2,
    marginBottom: 0,
    paddingVertical: theme.spacing.md,
    paddingHorizontal: theme.spacing.md,
    borderRadius: theme.radius.md,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.surfaceMuted,
    overflow: 'hidden',
    position: 'relative',
    ...theme.shadow.card
  },
  rtcCardDesktop: {
    flexBasis: '30%',
    maxWidth: 360,
    minWidth: 270
  },
  rtcCardDesktopCompact: {
    flexBasis: '34%',
    minWidth: 250,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm
  },
  rtcGlowSvg: {
    ...StyleSheet.absoluteFillObject
  },
  rtcCardStale: {
    borderColor: 'rgba(232,64,64,0.22)',
    backgroundColor: 'rgba(232,64,64,0.04)',
    borderStyle: 'dashed' as const
  },
  rtcHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between'
  },
  rtcTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.xs
  },
  rtcTitle: {
    ...theme.type.caption,
    color: theme.colors.textSoft,
    letterSpacing: 0.8
  },
  rtcBadge: {
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: theme.spacing.sm,
    paddingVertical: theme.spacing.xs,
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.xs
  },
  rtcLivePulseDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#06B6D4'
  },
  rtcBadgeLive: {
    borderColor: 'rgba(6,182,212,0.35)',
    backgroundColor: 'rgba(6,182,212,0.14)'
  },
  rtcBadgeLate: {
    borderColor: 'rgba(232,84,42,0.35)',
    backgroundColor: 'rgba(232,84,42,0.12)'
  },
  rtcBadgeText: {
    ...theme.type.caption,
    fontFamily: theme.font.bold,
    letterSpacing: 0.6
  },
  rtcBadgeTextLive: {
    color: '#0e7490'
  },
  rtcBadgeTextLate: {
    color: theme.colors.primary
  },
  rtcTimeValue: {
    marginTop: theme.spacing.sm,
    ...theme.type.cardValueLarge,
    color: theme.colors.text,
    fontWeight: '700'
  },
  rtcTimeValueCompact: {
    fontSize: 26,
    lineHeight: 31
  },
  rtcTimeValueStale: {
    color: theme.colors.muted
  },
  rtcMetaRow: {
    marginTop: theme.spacing.sm,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: theme.spacing.sm
  },
  rtcAgeWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.xs
  },
  rtcDateText: {
    ...theme.type.bodySm,
    color: theme.colors.textSoft
  },
  rtcAgeText: {
    ...theme.type.bodySm,
    color: theme.colors.muted
  },
  rtcFreshTrack: {
    height: 4,
    borderRadius: 3,
    marginTop: theme.spacing.sm,
    backgroundColor: theme.colors.border,
    overflow: 'hidden'
  },
  rtcFreshFill: {
    height: '100%',
    borderRadius: 3
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    justifyContent: 'center',
    padding: theme.spacing.md
  },
  modalCard: {
    backgroundColor: theme.colors.card,
    borderRadius: theme.radius.lg,
    padding: theme.spacing.md,
    borderWidth: 1,
    borderColor: theme.colors.border,
    maxHeight: '92%',
    ...theme.shadow.floating
  },
  modalHeader: {
    marginBottom: theme.spacing.xs,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: theme.spacing.sm
  },
  modalTitle: {
    color: theme.colors.text,
    fontFamily: theme.font.bold,
    fontSize: 19
  },
  modalTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.xs
  },
  modalSubtitle: {
    marginTop: 2,
    color: theme.colors.muted,
    ...theme.type.bodySm
  },
  closeButton: {
    borderRadius: 999,
    backgroundColor: theme.colors.surfaceAlt,
    paddingHorizontal: theme.spacing.sm,
    paddingVertical: theme.spacing.xs
  },
  closeText: {
    color: theme.colors.primary,
    ...theme.type.bodySm
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: theme.spacing.sm
  },
  statItem: {
    flexBasis: '48%',
    minWidth: 140,
    backgroundColor: theme.colors.surfaceMuted,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.radius.md,
    paddingVertical: theme.spacing.sm,
    paddingHorizontal: theme.spacing.sm
  },
  statLabel: {
    color: theme.colors.muted,
    ...theme.type.caption
  },
  statValue: {
    marginTop: 2,
    color: theme.colors.text,
    fontWeight: 'bold',
    ...theme.type.bodyMd
  },
  modalFootnote: {
    marginTop: theme.spacing.sm,
    color: theme.colors.muted,
    ...theme.type.caption
  },
  bentoSection: {
    marginBottom: theme.spacing.md
  },
  bentoSectionDesktop: {
    alignItems: 'center'
  }
});
