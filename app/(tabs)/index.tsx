import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Alert, Animated, Easing, Modal, Pressable, ScrollView, Share, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { DeviceCard } from '@/components/DeviceCard';
import { FullChart } from '@/components/FullChart';
import { SectionHeader } from '@/components/SectionHeader';
import { theme } from '@/constants/theme';
import { useESP32 } from '@/hooks/useESP32';
import { ModuleName } from '@/hooks/useStore';

type DashboardCard = {
  icon: string;
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
  const { data, history, status, ioLog, moduleStates, sendModuleCommand } = useESP32();
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const [selectedCard, setSelectedCard] = useState<DashboardCard | null>(null);

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

  const lightRaw = Math.max(0, Math.min(255, Math.round(data?.lightRaw ?? 0)));
  const lightPercent = Math.max(0, Math.min(100, Math.round(((255 - lightRaw) / 255) * 100)));

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
        title: 'ESP32 Telemetry Export',
        message: JSON.stringify(snapshot, null, 2)
      });
    } catch {
      Alert.alert('Export failed', 'Could not share telemetry snapshot. Please try again.');
    }
  }, [data, history, ioLog, moduleStates, status]);

  const cards = useMemo<DashboardCard[]>(
    () => [
      {
        icon: '🌡️',
        title: 'Temperature',
        cmd: 'temperature' as ModuleName,
        source: 'DHT22',
        value: `${(data?.temp ?? 0).toFixed(1)} °C`,
        color: '#2563EB',
        history: history.tempHistory,
        detailLabel: (v) => `${v.toFixed(1)} °C`
      },
      {
        icon: '☀️',
        title: 'Light',
        cmd: 'light' as ModuleName,
        source: 'LDR',
        value: `${lightPercent}% (${lightRaw}/255)`,
        color: '#F59E0B',
        history: history.lightHistory,
        detailLabel: (v) => `${Math.round(v)} %`
      },
      {
        icon: '⚙️',
        title: 'CPU Load',
        cmd: 'cpu' as ModuleName,
        source: 'ESP32-C3',
        value: `${Math.round(data?.cpu ?? 0)} %`,
        color: '#10B981',
        history: history.cpuHistory,
        detailLabel: (v) => `${Math.round(v)} %`
      },
      {
        icon: '🔌',
        title: 'Current',
        cmd: 'current' as ModuleName,
        source: 'INA219',
        value: `${Math.round(data?.current ?? 0)} mA`,
        color: '#EF4444',
        history: history.currentHistory,
        detailLabel: (v) => `${Math.round(v)} mA`
      }
    ],
    [data, history, lightPercent, lightRaw]
  );

  const environmentCards = cards.slice(0, 2);
  const systemCards = cards.slice(2, 4);

  const lastUpdated = data?.timestamp && data.timestamp.trim().length ? data.timestamp : '--';

  const summaryCards = useMemo(
    () => [
      { key: 'status', label: 'Connection', value: status === 'offline' ? 'Offline' : 'Online' },
      { key: 'uptime', label: 'Uptime', value: `${Math.round(data?.uptime ?? 0)} s` },
      { key: 'power', label: 'Power', value: `${Math.round(data?.powerMw ?? 0)} mW` },
      { key: 'battery', label: 'Battery', value: `${Math.round(data?.batteryPercent ?? 0)}%` }
    ],
    [data?.batteryPercent, data?.powerMw, data?.uptime, status]
  );

  const selectedSeries = selectedCard?.history.slice(-90) ?? [];
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
        <View style={styles.hero}>
          <View style={styles.heroTop}>
            <Text style={styles.heroTitle}>ESP32 Dashboard</Text>
            <View style={[styles.statusBadge, status === 'offline' ? styles.statusBadgeOffline : styles.statusBadgeOnline]}>
              <Text style={[styles.statusText, status === 'offline' ? styles.statusTextOffline : styles.statusTextOnline]}>
                {status === 'offline' ? 'Offline' : 'Online'}
              </Text>
            </View>
          </View>
          <Text style={styles.heroSubtitle}>Live monitoring and module control in one place.</Text>

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
              <Text style={styles.healthText}>Connection {status === 'offline' ? 'Offline' : 'Stable'}</Text>
            </View>
            <Text style={styles.healthText}>Last Updated {lastUpdated}</Text>
          </View>

          <View style={styles.metaRow}>
            <Text style={styles.metaText}>IP: {data?.ip ?? '--'}</Text>
            <Text style={styles.metaText}>SSID: {data?.ssid ?? '--'}</Text>
          </View>
        </View>

        <View style={styles.summaryGrid}>
          {summaryCards.map((item) => (
            <View key={item.key} style={styles.summaryCard}>
              <Text style={styles.summaryLabel}>{item.label}</Text>
              <Text style={styles.summaryValue}>{item.value}</Text>
            </View>
          ))}
        </View>

        <SectionHeader title="Environment Sensors" count={environmentCards.length} onActionPress={onExportPress} actionLabel="Export JSON" />
        <View style={styles.cardRow}>
          {environmentCards.map((item) => (
            <View key={item.title} style={styles.cardWrap}>
              <DeviceCard
                {...item}
                enabled={moduleStates[item.cmd]}
                onPress={() => setSelectedCard(item)}
                onToggle={(value) => {
                  sendModuleCommand(item.cmd, value);
                }}
              />
            </View>
          ))}
        </View>

        <SectionHeader title="Power & System" count={systemCards.length} />
        <View style={styles.cardRow}>
          {systemCards.map((item) => (
            <View key={item.title} style={styles.cardWrap}>
              <DeviceCard
                {...item}
                enabled={moduleStates[item.cmd]}
                onPress={() => setSelectedCard(item)}
                onToggle={(value) => {
                  sendModuleCommand(item.cmd, value);
                }}
              />
            </View>
          ))}
        </View>
      </ScrollView>

      <Modal visible={!!selectedCard} transparent animationType="fade" onRequestClose={() => setSelectedCard(null)}>
        <Pressable style={styles.modalBackdrop} onPress={() => setSelectedCard(null)}>
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
                    <Text style={styles.modalTitle}>{selectedCard.icon} {selectedCard.title}</Text>
                    <Text style={styles.modalSubtitle}>Detaliu extins cu scala 0 - {selectedCard.detailLabel(modalScaleMax)}</Text>
                  </View>
                  <Pressable style={styles.closeButton} onPress={() => setSelectedCard(null)}>
                    <Text style={styles.closeText}>Inchide</Text>
                  </Pressable>
                </View>

                <FullChart
                  title="Ultimele valori"
                  data={selectedSeries}
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
  content: { padding: 16, paddingBottom: 110 },
  hero: {
    backgroundColor: theme.colors.card,
    borderRadius: theme.radius.lg,
    padding: 14,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#E8ECF2',
    ...theme.shadow.card
  },
  heroTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between'
  },
  heroTitle: {
    color: theme.colors.text,
    fontFamily: theme.font.bold,
    fontSize: 24
  },
  heroSubtitle: {
    marginTop: 4,
    color: theme.colors.muted,
    fontFamily: theme.font.regular,
    fontSize: 13
  },
  metaRow: {
    marginTop: 10,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10
  },
  metaText: {
    color: '#4B5563',
    fontFamily: theme.font.medium,
    fontSize: 12
  },
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999
  },
  statusBadgeOnline: {
    backgroundColor: '#DCFCE7'
  },
  statusBadgeOffline: {
    backgroundColor: '#FEE2E2'
  },
  statusText: {
    fontFamily: theme.font.medium,
    fontSize: 12
  },
  statusTextOnline: {
    color: '#166534'
  },
  statusTextOffline: {
    color: '#B91C1C'
  },
  summaryGrid: {
    marginBottom: 16,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10
  },
  summaryCard: {
    width: '47.8%',
    backgroundColor: '#FAFBFD',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#E5EAF1',
    paddingVertical: 10,
    paddingHorizontal: 12
  },
  summaryLabel: {
    color: '#64748B',
    fontFamily: theme.font.medium,
    fontSize: 12
  },
  summaryValue: {
    marginTop: 4,
    color: theme.colors.text,
    fontFamily: theme.font.bold,
    fontSize: 18
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
    fontSize: 12
  },
  cardRow: {
    flexDirection: 'row',
    gap: 12
  },
  cardWrap: { flex: 1 },
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
    maxHeight: '92%'
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
    width: '48.5%',
    backgroundColor: '#F8FAFC',
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
