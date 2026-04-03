import { useCallback, useMemo, useState } from 'react';
import { Alert, Modal, Pressable, ScrollView, Share, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';

import { BarChart } from '@/components/BarChart';
import { BatteryHeroCard } from '@/components/BatteryHeroCard';
import { FullChart } from '@/components/FullChart';
import { PowerBarsCard } from '@/components/PowerBarsCard';
import { ScreenShell } from '@/components/ScreenShell';
import { SensorMiniGrid } from '@/components/SensorMiniGrid';
import { AppTheme } from '@/constants/theme';
import { useAppTheme } from '@/hooks/useAppTheme';
import { useESP32 } from '@/hooks/useESP32';
import { ModuleName, TimeRangeKey } from '@/hooks/useStore';

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

const getNiceMax = (value: number, step: number, floor: number) => {
  const scaled = Math.ceil(Math.max(value, floor) / step) * step;
  return Number.isFinite(scaled) ? scaled : floor;
};

export default function OverviewScreen() {
  const { theme } = useAppTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const { data, history, status, ioLog, moduleStates, totalCurrentMah, peakCurrent, selectedRange, setTimeRange } = useESP32();
  const { width } = useWindowDimensions();
  const [selectedCmd, setSelectedCmd] = useState<ModuleName | null>(null);
  const isDesktop = width >= 768;
  const renderWindow = isDesktop ? 900 : 480;

  const onExportPress = useCallback(async () => {
    try {
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
  }, [data, history, ioLog, moduleStates, status]);

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

  const sensorItems = useMemo(() => [
    {
      label: 'TEMPERATURĂ NTC',
      value: (data?.temp ?? 0).toFixed(1),
      unit: '°C',
      barPercent: Math.min(100, ((data?.temp ?? 0) / 50) * 100),
      barColor: 'orange' as const,
      paletteKey: 'temperature' as const,
      trend: `${(data?.temp ?? 0) >= 35 ? '⚠ Ridicat' : '✓ Normal'}`,
      icon: 'thermometer-outline' as const
    },
    {
      label: 'TENSIUNE INA219',
      value: (data?.volt ?? 0).toFixed(2),
      unit: 'V',
      barPercent: Math.min(100, ((data?.volt ?? 0) / 5) * 100),
      barColor: 'green' as const,
      paletteKey: 'voltage' as const,
      trend: `${(data?.volt ?? 0) >= 3.3 ? '✓ Normal' : '⚠ Scăzut'}`,
      icon: 'flash-outline' as const
    },
    {
      label: 'CURENT TOTAL',
      value: (data?.current ?? 0).toFixed(0),
      unit: 'mA',
      barPercent: Math.min(100, ((data?.current ?? 0) / 300) * 100),
      barColor: 'orange' as const,
      paletteKey: 'current' as const,
      trend: `${((data?.powerMw ?? 0) / 1000).toFixed(2)} W · ${(data?.volt ?? 0).toFixed(2)} V`,
      icon: 'battery-charging-outline' as const
    },
    {
      label: 'IMU ROLL',
      value: (data?.roll ?? 0).toFixed(1),
      unit: '°',
      barPercent: Math.min(100, Math.max(0, (Math.abs(data?.roll ?? 0) / 180) * 100)),
      barColor: 'green' as const,
      paletteKey: 'imu' as const,
      icon: 'compass-outline' as const,
    },
    {
      label: 'IMU PITCH',
      value: (data?.pitch ?? 0).toFixed(1),
      unit: '°',
      barPercent: Math.min(100, Math.max(0, (Math.abs(data?.pitch ?? 0) / 90) * 100)),
      barColor: 'green' as const,
      paletteKey: 'imu' as const,
      icon: 'compass-outline' as const,
    },
    {
      label: 'UPTIME ESP32',
      value: formatUptime(data?.uptime ?? 0),
      unit: '',
      barPercent: Math.min(100, ((data?.uptime ?? 0) / 86400) * 100),
      barColor: 'orange' as const,
      paletteKey: 'uptime' as const,
      icon: 'time-outline' as const,
    }
  ], [data]);

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
          screenSubtitle="Telemetrie în timp real · SUDO"
          onExport={onExportPress}
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
                maxValue={50}
                yTickCount={6}
                showLegend
                showEventMarker
                eventDeltaThreshold={2}
              />
            </Pressable>
          </View>
        </View>

        {/* Row 2: Bar Chart + Battery % Card */}
        <View style={[styles.heroRow, isDesktop && styles.heroRowDesktop]}>
          <View style={[styles.heroCol, isDesktop && styles.barChartCol]}>
            <BarChart
              style={styles.rowCard}
              cpuHistory={visibleHistory.cpuHistory}
              currentHistory={visibleHistory.currentHistory}
              historyTimeline={visibleHistory.timeline}
              title="CPU Load"
              subtitle="CPU % (orange) vs current draw (blue) over time"
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

        {/* Row 3: Sensor mini cards */}
        <SensorMiniGrid
          items={sensorItems}
          onItemPress={(item) => {
            const cmd = item.label === 'CURENT TOTAL' ? 'current'
              : item.label === 'TEMPERATURĂ NTC' ? 'temperature'
              : item.label === 'CPU LOAD' ? 'cpu'
              : null;
            if (cmd) {
              setSelectedCmd(cmd as ModuleName);
            } else {
              Alert.alert(item.label, `${item.value} ${item.unit}${item.trend ? `\n${item.trend}` : ''}`);
            }
          }}
        />

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
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 120
  },
  pageShell: {
    paddingHorizontal: 0,
    paddingTop: 0,
    paddingBottom: 0
  },
  heroRow: {
    flexDirection: 'column',
    gap: 12,
    marginBottom: 12,
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
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    justifyContent: 'center',
    padding: 14
  },
  modalCard: {
    backgroundColor: theme.colors.card,
    borderRadius: 18,
    padding: 12,
    borderWidth: 1,
    borderColor: theme.colors.border,
    maxHeight: '92%',
    ...theme.shadow.floating
  },
  modalHeader: {
    marginBottom: 6,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8
  },
  modalTitle: {
    color: theme.colors.text,
    fontFamily: theme.font.bold,
    fontSize: 19
  },
  modalTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6
  },
  modalSubtitle: {
    marginTop: 2,
    color: theme.colors.muted,
    fontFamily: theme.font.medium,
    fontSize: 12
  },
  closeButton: {
    borderRadius: 999,
    backgroundColor: theme.colors.surfaceAlt,
    paddingHorizontal: 10,
    paddingVertical: 6
  },
  closeText: {
    color: theme.colors.primary,
    fontFamily: theme.font.medium,
    fontSize: 12
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8
  },
  statItem: {
    flexBasis: '48%',
    minWidth: 140,
    backgroundColor: theme.colors.surfaceMuted,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: 12,
    paddingVertical: 8,
    paddingHorizontal: 10
  },
  statLabel: {
    color: theme.colors.muted,
    fontFamily: theme.font.medium,
    fontSize: 11
  },
  statValue: {
    marginTop: 2,
    color: theme.colors.text,
    fontFamily: theme.font.bold,
    fontSize: 14
  },
  modalFootnote: {
    marginTop: 10,
    color: theme.colors.muted,
    fontFamily: theme.font.regular,
    fontSize: 11
  }
});
