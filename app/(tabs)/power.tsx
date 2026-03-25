import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { BatteryBar } from '@/components/BatteryBar';
import { FullChart } from '@/components/FullChart';
import { SectionHeader } from '@/components/SectionHeader';
import { TabHero } from '@/components/TabHero';
import { TimeRangeSelector } from '@/components/TimeRangeSelector';
import { BATTERY_CAPACITY } from '@/constants/config';
import { theme } from '@/constants/theme';
import { useESP32 } from '@/hooks/useESP32';

export default function PowerScreen() {
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

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.content}>
        <TabHero
          title="Putere"
          subtitle="Tensiune, curent și estimări pentru baterie."
          statusLabel={status === 'offline' ? 'Offline' : 'Conectat'}
          statusTone={status === 'offline' ? 'offline' : 'online'}
          meta={[
            { label: 'Curent', value: `${(data?.current ?? 0).toFixed(1)} mA` },
            { label: 'Baterie', value: `${Math.round(percent)}%` }
          ]}
        />

        <SectionHeader title="Trend putere" count={2} />
        <TimeRangeSelector value={selectedRange} onChange={setTimeRange} />
        <FullChart title="Tensiune alimentare" data={history.voltHistory} xValues={history.timeline} color="#0F766E" label={(v) => `${v.toFixed(2)}V`} />
        <FullChart title="Curent consumat" data={history.currentHistory} xValues={history.timeline} color="#DC2626" label={(v) => `${v.toFixed(1)}mA`} />

        <SectionHeader title="Informații baterie" count={6} />
        <View style={styles.statsCard}>
          <Row label="Curent instant" value={`${(data?.current ?? 0).toFixed(1)} mA`} />
          <Row label="Putere instant" value={`${(data?.powerMw ?? 0).toFixed(1)} mW`} />
          <Row label="Curent mediu" value={`${avgCurrent.toFixed(1)} mA`} />
          <Row label="Curent maxim" value={`${peakCurrent.toFixed(1)} mA`} />
          <BatteryBar percent={percent} />
          <Row label="Autonomie estimată" value={remainingHours > 0 ? `${remainingHours.toFixed(1)} h` : '--'} />
          <Row label="Capacitate folosită" value={`CP: ${usedMah.toFixed(2)} mAh`} />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.row}>
      <Text style={styles.rowKey}>{label}</Text>
      <Text style={styles.rowValue} numberOfLines={1}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: theme.colors.background },
  content: { padding: 16, paddingBottom: 120 },
  statsCard: {
    backgroundColor: theme.colors.surfaceMuted,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#E6EBF2',
    padding: 14,
    borderLeftWidth: 3,
    borderLeftColor: '#CFFAFE'
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10
  },
  rowKey: {
    color: theme.colors.muted,
    fontFamily: theme.font.medium,
    fontSize: 14
  },
  rowValue: {
    color: theme.colors.text,
    fontFamily: theme.font.semiBold,
    fontSize: 14,
    textAlign: 'right',
    minWidth: 120,
    flexShrink: 0
  }
});
