import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';

import { BatteryBar } from '@/components/BatteryBar';
import { FullChart } from '@/components/FullChart';
import { NetworkTable } from '@/components/NetworkTable';
import { SectionHeader } from '@/components/SectionHeader';
import { SignalBars } from '@/components/SignalBars';
import { TabHero } from '@/components/TabHero';
import { TimeRangeSelector } from '@/components/TimeRangeSelector';
import { BATTERY_CAPACITY } from '@/constants/config';
import { theme } from '@/constants/theme';
import { useESP32 } from '@/hooks/useESP32';

export default function SettingsScreen() {
  const { data, history, totalCurrentMah, peakCurrent, status, selectedRange, setTimeRange } = useESP32();

  const avgCurrent = history.currentHistory.length
    ? history.currentHistory.reduce((acc, n) => acc + n, 0) / history.currentHistory.length
    : data?.current ?? 0;

  const batteryPresent = (data?.volt ?? 0) > 2.5;
  const usedMah = batteryPresent && data?.totalMah && data.totalMah > 0 ? data.totalMah : batteryPresent ? totalCurrentMah : 0;
  const remainingMah = batteryPresent ? Math.max(BATTERY_CAPACITY - usedMah, 0) : 0;
  const fallbackPercent = (remainingMah / BATTERY_CAPACITY) * 100;
  const percent = batteryPresent
    ? data?.batteryPercent && data.batteryPercent > 0
      ? data.batteryPercent
      : fallbackPercent
    : 0;
  const fallbackRemainingHours = remainingMah / Math.max(avgCurrent, 0.1);
  const hasEstimate = batteryPresent && (((data?.batteryLifeMin ?? -1) > 0) || (percent > 0 && avgCurrent > 1));
  const remainingHours = hasEstimate
    ? (data?.batteryLifeMin && data.batteryLifeMin > 0 ? data.batteryLifeMin / 60 : fallbackRemainingHours)
    : -1;
  const quickTiles = [
    {
      key: 'rssi',
      label: 'RSSI',
      value: `${Math.round(data?.rssi ?? -99)} dBm`,
      icon: 'wifi-outline' as const,
      tone: '#E0F2FE'
    },
    {
      key: 'volt',
      label: 'Tensiune',
      value: `${(data?.volt ?? 0).toFixed(2)} V`,
      icon: 'pulse-outline' as const,
      tone: '#ECFDF5'
    },
    {
      key: 'current',
      label: 'Curent',
      value: `${Math.abs(data?.current ?? 0).toFixed(1)} mA`,
      icon: 'flash-outline' as const,
      tone: '#FEF3C7'
    },
    {
      key: 'battery',
      label: 'Baterie',
      value: `${Math.round(percent)}%`,
      icon: 'battery-half-outline' as const,
      tone: '#EDE9FE'
    }
  ];

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.content}>
        <TabHero
          title="Settings"
          subtitle="Centru unificat pentru conectivitate, energie si starea sistemului."
          statusLabel={status === 'online' ? 'Conectat' : 'Offline'}
          statusTone={status === 'online' ? 'online' : 'offline'}
          meta={[
            { label: 'SSID', value: data?.ssid ?? '--' },
            { label: 'IP', value: data?.ip ?? '--' }
          ]}
        />

        <SectionHeader title="Status rapid" count={quickTiles.length} />
        <View style={styles.quickGrid}>
          {quickTiles.map((tile) => (
            <View key={tile.key} style={styles.quickTile}>
              <View style={[styles.quickIconWrap, { backgroundColor: tile.tone }]}>
                <Ionicons name={tile.icon} size={15} color="#1E293B" />
              </View>
              <Text style={styles.quickLabel}>{tile.label}</Text>
              <Text style={styles.quickValue}>{tile.value}</Text>
            </View>
          ))}
        </View>

        <View style={styles.dualCardWrap}>
          <View style={styles.dualCard}>
            <Text style={styles.dualCardTitle}>Conexiune</Text>
            <SignalBars rssi={data?.rssi ?? -99} />
            <NetworkTable
              rows={[
                { keyLabel: 'SSID', value: data?.ssid ?? '--' },
                { keyLabel: 'IP', value: data?.ip ?? '--' },
                { keyLabel: 'MAC', value: data?.mac ?? '--' },
                { keyLabel: 'Canal', value: String(data?.channel ?? '--') },
                { keyLabel: 'RSSI', value: `${Math.round(data?.rssi ?? -99)} dBm` },
                { keyLabel: 'Status', value: status === 'online' ? 'Conectat' : 'Offline', statusTone: status === 'online' ? 'online' : 'offline' }
              ]}
            />
          </View>

          <View style={styles.dualCard}>
            <Text style={styles.dualCardTitle}>Energie</Text>
            <View style={styles.energyRows}>
              <Row label="Putere instant" value={`${(data?.powerMw ?? 0).toFixed(1)} mW`} />
              <Row label="Curent mediu" value={`${avgCurrent.toFixed(1)} mA`} />
              <Row label="Curent maxim" value={`${peakCurrent.toFixed(1)} mA`} />
            </View>
            <BatteryBar percent={percent} />
            <View style={styles.energyRows}>
              <Row label="Autonomie estimata" value={remainingHours > 0 ? `${remainingHours.toFixed(1)} h` : '--'} />
              <Row label="Capacitate folosita" value={`${usedMah.toFixed(2)} mAh`} />
            </View>
          </View>
        </View>

        <SectionHeader title="Trenduri" count={3} />
        <TimeRangeSelector value={selectedRange} onChange={setTimeRange} />
        <FullChart
          title="Tensiune alimentare (V)"
          data={history.voltHistory}
          xValues={history.timeline}
          color={theme.chart.palette.voltage}
          label={(v) => `${v.toFixed(2)} V`}
          height={190}
          showLegend
        />
        <FullChart
          title="Curent (mA)"
          data={history.currentHistory}
          xValues={history.timeline}
          color={theme.chart.palette.current}
          label={(v) => `${Math.abs(v).toFixed(1)} mA`}
          height={190}
          showLegend
        />
        <FullChart
          title="Trend RSSI (dBm)"
          data={history.rssiHistory}
          xValues={history.timeline}
          color={theme.chart.palette.rssi}
          label={(v) => `${Math.round(v)} dBm`}
          height={190}
          showLegend
        />
      </ScrollView>
    </SafeAreaView>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.row}>
      <Text style={styles.rowKey}>{label}</Text>
      <Text style={styles.rowValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: theme.colors.background },
  content: { padding: 12, paddingBottom: 96 },
  quickGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 12
  },
  quickTile: {
    flexBasis: '48%',
    minWidth: 150,
    backgroundColor: theme.colors.surfaceMuted,
    borderWidth: 1,
    borderColor: '#E3E8EF',
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 10
  },
  quickIconWrap: {
    width: 24,
    height: 24,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center'
  },
  quickLabel: {
    marginTop: 6,
    color: '#64748B',
    fontFamily: theme.font.medium,
    fontSize: 12
  },
  quickValue: {
    marginTop: 2,
    color: '#0F172A',
    fontFamily: theme.font.bold,
    fontSize: 20
  },
  dualCardWrap: {
    gap: 10,
    marginBottom: 8
  },
  dualCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: 10,
    ...theme.shadow.card
  },
  dualCardTitle: {
    color: '#0F172A',
    fontFamily: theme.font.bold,
    fontSize: 14,
    marginBottom: 6
  },
  energyRows: {
    marginBottom: 6
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 7
  },
  rowKey: {
    color: theme.colors.muted,
    fontFamily: theme.font.medium,
    fontSize: 13
  },
  rowValue: {
    color: theme.colors.text,
    fontFamily: theme.font.semiBold,
    fontSize: 13,
    textAlign: 'right',
    minWidth: 110,
    maxWidth: '58%',
    flexShrink: 1
  }
});
