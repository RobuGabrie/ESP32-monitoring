import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Alert, Animated, Easing, Modal, Pressable, ScrollView, Share, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { format } from 'date-fns';
import { Ionicons } from '@expo/vector-icons';

import { DeviceCard } from '@/components/DeviceCard';
import { FullChart } from '@/components/FullChart';
import { SectionHeader } from '@/components/SectionHeader';
import { ScreenShell } from '@/components/ScreenShell';
import { StatusSummaryCard } from '@/components/StatusSummaryCard';
import { TabHero } from '@/components/TabHero';
import { TemperatureThermometerCard } from '@/components/TemperatureThermometerCard';
import { TimeRangeSelector } from '@/components/TimeRangeSelector';
import { theme } from '@/constants/theme';
import { useESP32 } from '@/hooks/useESP32';
import { ModuleName } from '@/hooks/useStore';

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

type SummaryCard = {
  key: string;
  label: string;
  value: string;
  icon: keyof typeof Ionicons.glyphMap;
  accent: string;
};

const cardMeta = {
  temperature: {
    icon: 'thermometer',
    title: 'Temperatură',
    source: 'Termistor',
    color: '#2563EB',
    detailLabel: (v: number) => `${v.toFixed(1)} °C`
  },
  cpu: {
    icon: 'cog',
    title: 'Încărcare CPU',
    source: 'ESP32-C3 SuperMini',
    color: '#10B981',
    detailLabel: (v: number) => `${v.toFixed(1)} %`
  },
  current: {
    icon: 'flash',
    title: 'Curent',
    source: 'INA219',
    color: '#EF4444',
    detailLabel: (v: number) => `${v.toFixed(1)} mA`
  }
} as const;

const getNiceMax = (value: number, step: number, floor: number) => {
  const scaled = Math.ceil(Math.max(value, floor) / step) * step;
  return Number.isFinite(scaled) ? scaled : floor;
};

export default function OverviewScreen() {
  const { data, history, status, ioLog, moduleStates, sendModuleCommand, sendCpuStressCommand, selectedRange, setTimeRange } = useESP32();
  const { width } = useWindowDimensions();
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const [selectedCmd, setSelectedCmd] = useState<ModuleName | null>(null);
  const isDesktop = width >= 1024;

  useEffect(() => {
    if (status !== 'offline') {
      const pulse = Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, {
            toValue: 1.4,
            duration: 800,
            easing: Easing.out(Easing.quad),
            useNativeDriver: true
          }),
          Animated.timing(pulseAnim, {
            toValue: 1,
            duration: 800,
            easing: Easing.in(Easing.quad),
            useNativeDriver: true
          })
        ])
      );
      pulse.start();
      return () => pulse.stop();
    }

    pulseAnim.setValue(1);
    return undefined;
  }, [pulseAnim, status]);

  const onExportPress = useCallback(async () => {
    try {
      const snapshot = {
        exportedAt: new Date().toISOString(),
        status,
        data,
        moduleStates,
        history: {
          temp: history.tempHistory.slice(-80),
          light: history.lightHistory.slice(-80),
          cpu: history.cpuHistory.slice(-80),
          current: history.currentHistory.slice(-80),
          volt: history.voltHistory.slice(-80),
          rssi: history.rssiHistory.slice(-80)
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

  const summaryCards = useMemo<SummaryCard[]>(
    () => [
      {
        key: 'status',
        label: 'Conexiune',
        value: status === 'offline' ? 'Offline' : 'Conectat',
        icon: status === 'offline' ? 'cloud-offline' : 'cloud-done',
        accent: status === 'offline' ? '#FEE2E2' : '#DCFCE7'
      },
      {
        key: 'uptime',
        label: 'Timp activ',
        value: `${Math.round(data?.uptime ?? 0)} s`,
        icon: 'time',
        accent: '#DBEAFE'
      },
      {
        key: 'power',
        label: 'Putere',
        value: `${(data?.powerMw ?? 0).toFixed(1)} mW`,
        icon: 'flash',
        accent: '#FEF3C7'
      },
      {
        key: 'battery',
        label: 'Baterie',
        value: `${Math.round(data?.batteryPercent ?? 0)}%`,
        icon: 'battery-half',
        accent: '#E2E8F0'
      }
    ],
    [data?.batteryPercent, data?.powerMw, data?.uptime, status]
  );

  const cards = useMemo<DashboardCard[]>(
    () => [
      {
        icon: cardMeta.temperature.icon,
        title: cardMeta.temperature.title,
        cmd: 'temperature' as ModuleName,
        source: cardMeta.temperature.source,
        value: `${(data?.temp ?? 0).toFixed(1)} °C`,
        color: cardMeta.temperature.color,
        history: history.tempHistory,
        detailLabel: cardMeta.temperature.detailLabel
      },
      {
        icon: cardMeta.cpu.icon,
        title: cardMeta.cpu.title,
        cmd: 'cpu' as ModuleName,
        source: cardMeta.cpu.source,
        value: `${(data?.cpu ?? 0).toFixed(1)} %`,
        color: cardMeta.cpu.color,
        history: history.cpuHistory,
        detailLabel: cardMeta.cpu.detailLabel
      },
      {
        icon: cardMeta.current.icon,
        title: cardMeta.current.title,
        cmd: 'current' as ModuleName,
        source: cardMeta.current.source,
        value: `${(data?.current ?? 0).toFixed(1)} mA`,
        color: cardMeta.current.color,
        history: history.currentHistory,
        detailLabel: cardMeta.current.detailLabel
      }
    ],
    [data, history]
  );

  const temperatureCard = cards.find((item) => item.cmd === 'temperature') ?? null;
  const systemCards = cards.filter((item) => item.cmd !== 'temperature');

  const lastUpdated = data?.recordedAtMs
    ? format(data.recordedAtMs, 'dd.MM.yyyy HH:mm:ss')
    : data?.timestamp && data.timestamp.trim().length
      ? data.timestamp
      : '--';

  const selectedCard = useMemo(() => cards.find((c) => c.cmd === selectedCmd) ?? null, [cards, selectedCmd]);
  const selectedSeries = useMemo(() => selectedCard?.history.slice(-5000) ?? [], [selectedCard]);
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
    if (selectedCard.cmd === 'cpu' || selectedCard.cmd === 'light') {
      return 100;
    }

    if (selectedCard.cmd === 'temperature') {
      return getNiceMax(peak * 1.1, 5, 40);
    }

    return getNiceMax(peak * 1.1, 50, 200);
  }, [selectedCard, selectedSeries]);

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.content}>
        <ScreenShell contentStyle={styles.pageShell}>
        <TabHero
          title="Panou ESP32"
          subtitle="Monitorizare live și control module într-un singur loc."
          statusLabel={status === 'offline' ? 'Offline' : 'Online'}
          statusTone={status === 'offline' ? 'offline' : 'online'}
          meta={[
            { label: 'IP', value: data?.ip ?? '--' },
            { label: 'SSID', value: data?.ssid ?? '--' }
          ]}
          footer={(
            <View style={styles.healthRow}>
              <View style={styles.healthItem}>
                <Animated.View
                  style={[
                    styles.healthDot,
                    status === 'offline' ? styles.healthDotOffline : styles.healthDotOnline,
                    {
                      transform: [{ scale: pulseAnim }],
                      opacity: pulseAnim.interpolate({
                        inputRange: [1, 1.4],
                        outputRange: [1, 0.65]
                      })
                    }
                  ]}
                />
                <Text style={styles.healthText}>Conexiune {status === 'offline' ? 'Offline' : 'Stabila'}</Text>
              </View>
              <Text style={styles.healthText}>Ultima actualizare {lastUpdated}</Text>
            </View>
          )}
        />

        <View style={styles.panel}>
          <View style={styles.summaryGrid}>
            {summaryCards.map((item) => (
              <StatusSummaryCard
                key={item.key}
                label={item.label}
                value={item.value}
                icon={item.icon}
                accent={item.accent}
                style={isDesktop ? styles.summaryCardDesktop : styles.summaryCardMobile}
              />
            ))}
          </View>
        </View>

        <View style={styles.controlsPanel}>
          <TimeRangeSelector value={selectedRange} onChange={setTimeRange} />
        </View>

        <View style={styles.panel}>
          <SectionHeader title="Senzori de mediu" count={temperatureCard ? 1 : 0} onActionPress={onExportPress} actionLabel="Export JSON" />
          {temperatureCard ? (
            <Pressable onPress={() => setSelectedCmd('temperature')}>
              <TemperatureThermometerCard
                temperature={data?.temp ?? 0}
                history={temperatureCard.history}
                color={temperatureCard.color}
                enabled={moduleStates.temperature}
                onToggle={(value) => {
                  sendModuleCommand('temperature', value);
                }}
                min={0}
                max={50}
              />
            </Pressable>
          ) : null}
        </View>

        <View style={styles.panel}>
          <SectionHeader title="Putere și sistem" count={systemCards.length} />
          <View style={styles.cardRow}>
            {systemCards.map((item) => (
              <View key={item.title} style={[styles.cardWrap, isDesktop ? styles.cardWrapDesktop : styles.cardWrapMobile]}>
                <DeviceCard
                  {...item}
                  cardStyle={styles.systemCardFlat}
                  enabled={moduleStates[item.cmd]}
                  onPress={() => setSelectedCmd(item.cmd)}
                  onToggle={(value) => {
                    sendModuleCommand(item.cmd, value);
                  }}
                />
              </View>
            ))}
          </View>

          <View style={[styles.cpuStressCard, isDesktop ? styles.cpuStressCardDesktop : null]}>
            <View style={styles.cpuStressHead}>
              <View style={styles.cpuStressTitleRow}>
                <Ionicons name="hardware-chip-outline" size={16} color="#0F172A" />
                <Text style={styles.cpuStressTitle}>CPU Stress Test</Text>
              </View>
              <View style={[styles.cpuStressBadge, moduleStates.cpuStress ? styles.cpuStressBadgeOn : styles.cpuStressBadgeOff]}>
                <Text style={[styles.cpuStressBadgeText, moduleStates.cpuStress ? styles.cpuStressBadgeTextOn : styles.cpuStressBadgeTextOff]}>
                  {moduleStates.cpuStress ? 'ACTIV' : 'OPRIT'}
                </Text>
              </View>
            </View>
            <Text style={styles.cpuStressHint}>Pornește testul și urmărește cardul CPU: încărcarea trebuie să urce vizibil dacă măsurarea este corectă.</Text>
            <Pressable
              style={[styles.cpuStressButton, moduleStates.cpuStress ? styles.cpuStressButtonOn : styles.cpuStressButtonOff]}
              onPress={() => {
                sendCpuStressCommand(!moduleStates.cpuStress);
              }}
            >
              <Ionicons name={moduleStates.cpuStress ? 'pause-circle-outline' : 'play-circle-outline'} size={16} color="#FFFFFF" />
              <Text style={styles.cpuStressButtonText}>{moduleStates.cpuStress ? 'Opreste CPU Stress' : 'Porneste CPU Stress'}</Text>
            </Pressable>
          </View>
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
                      <Ionicons name={selectedCard.icon} size={18} color="#1D4ED8" />
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
                  xValues={history.timeline.slice(-5000)}
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

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: theme.colors.background },
  content: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 120,
    alignItems: 'center'
  },
  pageShell: {
    paddingHorizontal: 0,
    paddingTop: 0,
    paddingBottom: 0
  },
  panel: {
    backgroundColor: '#FFFFFF',
    borderRadius: theme.radius.lg,
    borderWidth: 1,
    borderColor: '#DEE8F3',
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 12,
    ...theme.shadow.card
  },
  controlsPanel: {
    backgroundColor: '#FFFFFF',
    borderRadius: theme.radius.lg,
    borderWidth: 1,
    borderColor: '#DEE8F3',
    paddingHorizontal: 10,
    paddingVertical: 8,
    marginBottom: 12,
    ...theme.shadow.card
  },
  summaryGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 9
  },
  summaryCardMobile: {
    flexBasis: '48%',
    minWidth: 150
  },
  summaryCardDesktop: {
    flexBasis: '23%',
    minWidth: 150
  },
  healthRow: {
    marginTop: 10,
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8
  },
  healthItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8
  },
  healthDot: {
    width: 10,
    height: 10,
    borderRadius: 999
  },
  healthDotOnline: {
    backgroundColor: '#16A34A'
  },
  healthDotOffline: {
    backgroundColor: '#DC2626'
  },
  healthText: {
    color: '#334155',
    fontFamily: theme.font.medium,
    fontSize: 13
  },
  cardRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    alignItems: 'stretch',
    marginTop: 2
  },
  cardWrap: {
    flexGrow: 1
  },
  cardWrapMobile: {
    flexBasis: '100%'
  },
  cardWrapDesktop: {
    flexBasis: '48%',
    minWidth: 320
  },
  systemCardFlat: {
    shadowColor: 'transparent',
    shadowOpacity: 0,
    shadowRadius: 0,
    shadowOffset: { width: 0, height: 0 },
    elevation: 0,
    backgroundColor: '#F9FBFE'
  },
  cpuStressCard: {
    marginTop: 10,
    backgroundColor: '#F7FAFD',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#DCE5F0',
    paddingVertical: 10,
    paddingHorizontal: 12,
    width: '100%',
    maxWidth: 560,
    alignSelf: 'center'
  },
  cpuStressCardDesktop: {
    maxWidth: 720
  },
  cpuStressHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8
  },
  cpuStressTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6
  },
  cpuStressTitle: {
    color: '#0F172A',
    fontFamily: theme.font.semiBold,
    fontSize: 14
  },
  cpuStressBadge: {
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 8,
    paddingVertical: 3
  },
  cpuStressBadgeOn: {
    backgroundColor: '#DCFCE7',
    borderColor: '#86EFAC'
  },
  cpuStressBadgeOff: {
    backgroundColor: '#E2E8F0',
    borderColor: '#CBD5E1'
  },
  cpuStressBadgeText: {
    fontFamily: theme.font.semiBold,
    fontSize: 11
  },
  cpuStressBadgeTextOn: {
    color: '#166534'
  },
  cpuStressBadgeTextOff: {
    color: '#334155'
  },
  cpuStressHint: {
    marginTop: 8,
    color: '#475569',
    fontFamily: theme.font.regular,
    fontSize: 12
  },
  cpuStressButton: {
    marginTop: 10,
    borderRadius: 10,
    minHeight: 44,
    paddingHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8
  },
  cpuStressButtonOn: {
    backgroundColor: '#B91C1C'
  },
  cpuStressButtonOff: {
    backgroundColor: '#334155'
  },
  cpuStressButtonText: {
    color: '#FFFFFF',
    fontFamily: theme.font.semiBold,
    fontSize: 13
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.45)',
    justifyContent: 'center',
    padding: 14
  },
  modalCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    padding: 12,
    borderWidth: 1,
    borderColor: '#E5EAF1',
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
    color: '#64748B',
    fontFamily: theme.font.medium,
    fontSize: 12
  },
  closeButton: {
    borderRadius: 999,
    backgroundColor: '#EEF2FF',
    paddingHorizontal: 10,
    paddingVertical: 6
  },
  closeText: {
    color: '#1E3A8A',
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
    borderColor: '#E2E8F0',
    borderRadius: 12,
    paddingVertical: 8,
    paddingHorizontal: 10
  },
  statLabel: {
    color: '#64748B',
    fontFamily: theme.font.medium,
    fontSize: 11
  },
  statValue: {
    marginTop: 2,
    color: '#0F172A',
    fontFamily: theme.font.bold,
    fontSize: 14
  },
  modalFootnote: {
    marginTop: 10,
    color: '#64748B',
    fontFamily: theme.font.regular,
    fontSize: 11
  }
});
