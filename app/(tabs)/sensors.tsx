import { ScrollView, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { FullChart } from '@/components/FullChart';
import { LogArea } from '@/components/LogArea';
import { SectionHeader } from '@/components/SectionHeader';
import { TabHero } from '@/components/TabHero';
import { TimeRangeSelector } from '@/components/TimeRangeSelector';
import { theme } from '@/constants/theme';
import { useESP32 } from '@/hooks/useESP32';

export default function SensorsScreen() {
  const { history, ioLog, data, status, selectedRange, setTimeRange } = useESP32();

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.content}>
        <TabHero
          title="Sensors"
          subtitle="Real-time telemetry plus 1Hz raw serial stream for GPIO/I2C I/O."
          statusLabel={status === 'offline' ? 'Offline' : 'Online'}
          statusTone={status === 'offline' ? 'offline' : 'online'}
          meta={[
            { label: 'Temp', value: `${(data?.temp ?? 0).toFixed(1)}°C` },
            { label: 'Light', value: `${Math.round(data?.lightPercent ?? data?.light ?? 0)}%` }
          ]}
        />

        <SectionHeader title="Sensor Trends" count={2} />
        <TimeRangeSelector value={selectedRange} onChange={setTimeRange} />
        <FullChart title="Temperature" data={history.tempHistory} xValues={history.timeline} color="#2563EB" label={(v) => `${v.toFixed(1)}°`} />
        <FullChart title="Light Intensity" data={history.lightHistory} xValues={history.timeline} color="#F59E0B" label={(v) => `${Math.round(v)}%`} />

        <SectionHeader title="I/O Activity (Serial)" count={Math.min(ioLog.length, 60)} />
        <LogArea entries={ioLog.slice(-60)} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: theme.colors.background },
  content: { padding: 16, paddingBottom: 120 }
});
