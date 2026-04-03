import { useMemo } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';

import { BatteryBar } from '@/components/BatteryBar';
import { FullChart } from '@/components/FullChart';
import { NetworkTable } from '@/components/NetworkTable';
import { ScreenShell } from '@/components/ScreenShell';
import { SectionHeader } from '@/components/SectionHeader';
import { SignalBars } from '@/components/SignalBars';
import { StatusSummaryCard } from '@/components/StatusSummaryCard';
import { TabHero } from '@/components/TabHero';
import { TimeRangeSelector } from '@/components/TimeRangeSelector';
import { BATTERY_CAPACITY } from '@/constants/config';
import { AppTheme } from '@/constants/theme';
import { useAppTheme } from '@/hooks/useAppTheme';
import { useESP32 } from '@/hooks/useESP32';

export default function SettingsScreen() {
  const { theme } = useAppTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
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
      tone: 'rgba(232,84,42,0.12)'
    },
    {
      key: 'volt',
      label: 'Tensiune',
      value: `${(data?.volt ?? 0).toFixed(2)} V`,
      icon: 'pulse-outline' as const,
      tone: 'rgba(61,220,132,0.12)'
    },
    {
      key: 'current',
      label: 'Curent',
      value: `${Math.abs(data?.current ?? 0).toFixed(1)} mA`,
      icon: 'flash-outline' as const,
      tone: 'rgba(245,158,11,0.12)'
    },
    {
      key: 'battery',
      label: 'Baterie',
      value: `${Math.round(percent)}%`,
      icon: 'battery-half-outline' as const,
      tone: 'rgba(61,220,132,0.12)'
    }
  ];
  const energyTiles = [
    {
      key: 'power',
      label: 'Putere instant',
      value: `${(data?.powerMw ?? 0).toFixed(1)} mW`,
      icon: 'flash-outline' as const,
      tone: 'rgba(245,158,11,0.12)'
    },
    {
      key: 'avg',
      label: 'Curent mediu',
      value: `${avgCurrent.toFixed(1)} mA`,
      icon: 'analytics-outline' as const,
      tone: 'rgba(56,189,248,0.12)'
    },
    {
      key: 'peak',
      label: 'Curent maxim',
      value: `${peakCurrent.toFixed(1)} mA`,
      icon: 'trending-up-outline' as const,
      tone: 'rgba(232,84,42,0.12)'
    }
  ];

  const networkRows: { keyLabel: string; value: string; statusTone?: 'online' | 'offline' }[] = [
    { keyLabel: 'SSID', value: data?.ssid ?? '--' },
    { keyLabel: 'IP', value: data?.ip ?? '--' },
    { keyLabel: 'MAC', value: data?.mac ?? '--' },
    { keyLabel: 'Canal', value: String(data?.channel ?? '--') },
    { keyLabel: 'RSSI', value: `${Math.round(data?.rssi ?? -99)} dBm` },
    { keyLabel: 'Status', value: status === 'online' ? 'Conectat' : 'Offline', statusTone: status === 'online' ? 'online' : 'offline' }
  ];
  const darkModeEnabled = true;

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.content}>
        <ScreenShell
          contentStyle={styles.pageShell}
          screenTitle="Settings"
          screenSubtitle="Conectivitate, energie si configurare dashboard"
          selectedRange={selectedRange}
          onRangeChange={setTimeRange}
        >
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

          <View style={styles.panel}>
            <SectionHeader title="Status rapid" count={quickTiles.length} />
            <View style={styles.quickGrid}>
              {quickTiles.map((tile) => (
                <StatusSummaryCard
                  key={tile.key}
                  label={tile.label}
                  value={tile.value}
                  icon={tile.icon}
                  accent={tile.tone}
                  iconColor={theme.colors.text}
                  style={styles.quickTile}
                />
              ))}
            </View>
          </View>

          <View style={styles.panel}>
            <SectionHeader title="Conectivitate" count={2} />
            <View style={styles.connectivityCard}>
              <View style={styles.connectivityHead}>
                <View style={styles.connectivityTitleWrap}>
                  <View style={styles.connectivityIconWrap}>
                    <Ionicons name="wifi-outline" size={15} color={theme.colors.primary} />
                  </View>
                  <Text style={styles.connectivityTitle}>Retea Wi-Fi</Text>
                </View>
                <View style={[styles.connectivityStatusPill, status === 'online' ? styles.connectivityStatusOnline : styles.connectivityStatusOffline]}>
                  <Text style={[styles.connectivityStatusText, status === 'online' ? styles.connectivityStatusTextOnline : styles.connectivityStatusTextOffline]}>
                    {status === 'online' ? 'Conectat' : 'Offline'}
                  </Text>
                </View>
              </View>

              <SignalBars rssi={data?.rssi ?? -99} embedded />
              <View style={styles.connectivityDivider} />
              <NetworkTable rows={networkRows} embedded />
            </View>
          </View>

          <View style={styles.panel}>
            <SectionHeader title="Energie" count={1} />
            <View style={styles.energyCard}>
              <View style={styles.energyKpiGrid}>
                {energyTiles.map((tile) => (
                  <StatusSummaryCard
                    key={tile.key}
                    label={tile.label}
                    value={tile.value}
                    icon={tile.icon}
                    accent={tile.tone}
                    iconColor={theme.colors.text}
                    style={styles.energyKpi}
                  />
                ))}
              </View>
              <BatteryBar percent={percent} />
              <View style={styles.energyDivider} />
              <View style={styles.energyRows}>
                <Row label="Autonomie estimata" value={remainingHours > 0 ? `${remainingHours.toFixed(1)} h` : '--'} />
                <Row label="Capacitate folosita" value={`${usedMah.toFixed(2)} mAh`} />
              </View>
            </View>
          </View>

          <View style={styles.controlsPanel}>
            <TimeRangeSelector value={selectedRange} onChange={setTimeRange} />
          </View>

          <View style={styles.panel}>
            <SectionHeader title="Trenduri" count={3} />
            <View style={styles.trendsWrap}>
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
            </View>
          </View>
        </ScreenShell>
      </ScrollView>
    </SafeAreaView>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  const { theme } = useAppTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);

  return (
    <View style={styles.row}>
      <Text style={styles.rowKey}>{label}</Text>
      <Text style={styles.rowValue}>{value}</Text>
    </View>
  );
}

const createStyles = (theme: AppTheme) => StyleSheet.create({
  safe: { flex: 1, backgroundColor: theme.colors.background },
  content: { paddingHorizontal: 12, paddingTop: 12, paddingBottom: 104 },
  pageShell: {
    paddingHorizontal: 0,
    paddingTop: 0,
    paddingBottom: 0
  },
  panel: {
    backgroundColor: theme.colors.card,
    borderRadius: theme.radius.lg,
    borderWidth: 1,
    borderColor: theme.colors.border,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 12,
    ...theme.shadow.card
  },
  controlsPanel: {
    backgroundColor: theme.colors.card,
    borderRadius: theme.radius.lg,
    borderWidth: 1,
    borderColor: theme.colors.border,
    paddingHorizontal: 10,
    paddingVertical: 8,
    marginBottom: 12,
    ...theme.shadow.card
  },
  preferenceRow: {
    marginTop: 4,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.surfaceMuted,
    paddingHorizontal: 12,
    paddingVertical: 11,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10
  },
  preferenceTitle: {
    color: theme.colors.text,
    fontFamily: theme.font.semiBold,
    fontSize: 14
  },
  preferenceHint: {
    marginTop: 2,
    color: theme.colors.textSoft,
    fontFamily: theme.font.regular,
    fontSize: 12
  },
  quickGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 4
  },
  quickTile: {
    flexBasis: '48%',
    minWidth: 150
  },
  connectivityCard: {
    marginTop: 2,
    backgroundColor: theme.colors.surfaceMuted,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: theme.colors.border,
    paddingHorizontal: 12,
    paddingVertical: 12
  },
  connectivityHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8
  },
  connectivityTitleWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6
  },
  connectivityIconWrap: {
    width: 24,
    height: 24,
    borderRadius: 999,
    backgroundColor: 'rgba(232,84,42,0.12)',
    alignItems: 'center',
    justifyContent: 'center'
  },
  connectivityTitle: {
    color: theme.colors.text,
    fontFamily: theme.font.bold,
    fontSize: 14
  },
  connectivityStatusPill: {
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 4
  },
  connectivityStatusOnline: {
    backgroundColor: 'rgba(61,220,132,0.12)',
    borderColor: 'rgba(61,220,132,0.3)'
  },
  connectivityStatusOffline: {
    backgroundColor: 'rgba(232,64,64,0.12)',
    borderColor: 'rgba(232,64,64,0.3)'
  },
  connectivityStatusText: {
    fontFamily: theme.font.semiBold,
    fontSize: 11
  },
  connectivityStatusTextOnline: {
    color: '#3ddc84'
  },
  connectivityStatusTextOffline: {
    color: '#e84040'
  },
  connectivityDivider: {
    marginVertical: 8,
    height: 1,
    backgroundColor: theme.colors.border
  },
  energyCard: {
    marginTop: 2,
    backgroundColor: theme.colors.surfaceMuted,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: theme.colors.border,
    paddingVertical: 12,
    paddingHorizontal: 12
  },
  energyRows: {
    marginBottom: 6
  },
  energyKpiGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 8
  },
  energyKpi: {
    flexBasis: '31%',
    minWidth: 160,
    flexGrow: 1
  },
  energyDivider: {
    marginVertical: 8,
    height: 1,
    backgroundColor: theme.colors.border
  },
  trendsWrap: {
    gap: 2,
    marginTop: 2
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
