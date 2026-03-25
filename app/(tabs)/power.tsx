import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { BatteryBar } from '@/components/BatteryBar';
import { FullChart } from '@/components/FullChart';
import { SectionHeader } from '@/components/SectionHeader';
import { TabHero } from '@/components/TabHero';
import { BATTERY_CAPACITY } from '@/constants/config';
import { theme } from '@/constants/theme';
import { useESP32 } from '@/hooks/useESP32';

export default function PowerScreen() {
  const { data, history, totalCurrentMah, peakCurrent, status } = useESP32();

  const avgCurrent = history.currentHistory.length
    ? history.currentHistory.reduce((acc, n) => acc + n, 0) / history.currentHistory.length
    : data?.current ?? 0;

  const usedMah = data?.totalMah && data.totalMah > 0 ? data.totalMah : totalCurrentMah;
  const remainingMah = Math.max(BATTERY_CAPACITY - usedMah, 0);
  const fallbackPercent = (remainingMah / BATTERY_CAPACITY) * 100;
  const percent = data?.batteryPercent && data.batteryPercent > 0 ? data.batteryPercent : fallbackPercent;
  const fallbackRemainingHours = remainingMah / Math.max(avgCurrent, 0.1);
  const remainingHours = data?.batteryLifeMin && data.batteryLifeMin > 0 ? data.batteryLifeMin / 60 : fallbackRemainingHours;

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.content}>
        <TabHero
          title="Power"
          subtitle="Voltage, current behavior, and battery estimates."
          statusLabel={status === 'offline' ? 'Offline' : 'Online'}
          statusTone={status === 'offline' ? 'offline' : 'online'}
          meta={[
            { label: 'Realtime', value: `${Math.round(data?.current ?? 0)}mA` },
            { label: 'Battery', value: `${Math.round(percent)}%` }
          ]}
        />

        <SectionHeader title="Power Trends" count={2} />
        <FullChart title="Supply Voltage" data={history.voltHistory.slice(-40)} color="#0F766E" label={(v) => `${v.toFixed(2)}V`} />
        <FullChart title="Current Draw" data={history.currentHistory.slice(-40)} color="#DC2626" label={(v) => `${Math.round(v)}mA`} />

        <SectionHeader title="Battery Insights" count={6} />
        <View style={styles.statsCard}>
          <Row label="Realtime current" value={`${Math.round(data?.current ?? 0)} mA`} />
          <Row label="Realtime power" value={`${Math.round(data?.powerMw ?? 0)} mW`} />
          <Row label="Average current" value={`${Math.round(avgCurrent)} mA`} />
          <Row label="Peak current" value={`${Math.round(peakCurrent)} mA`} />
          <BatteryBar percent={percent} />
          <Row label="Estimated remaining" value={`${remainingHours.toFixed(1)} h`} />
          <Row label="Capacity used" value={`${usedMah.toFixed(1)} mAh`} />
        </View>
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
  content: { padding: 16, paddingBottom: 120 },
  statsCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#E6EBF2',
    padding: 14,
    ...theme.shadow.card
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
    fontSize: 14
  }
});
