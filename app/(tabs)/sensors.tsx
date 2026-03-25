import { ScrollView, StyleSheet, Text } from 'react-native';
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
          title="Senzori"
          subtitle="Telemetrie în timp real plus flux serial brut 1Hz pentru GPIO/I2C."
          statusLabel={status === 'offline' ? 'Offline' : 'Conectat'}
          statusTone={status === 'offline' ? 'offline' : 'online'}
          meta={[
            { label: 'Temperatură', value: `${(data?.temp ?? 0).toFixed(1)} °C` },
            { label: 'Lumină', value: `${(data?.lightPercent ?? data?.light ?? 0).toFixed(1)} %` }
          ]}
        />

        <SectionHeader title="Trend senzori" count={2} />
        <TimeRangeSelector value={selectedRange} onChange={setTimeRange} />
        <Text style={styles.axisHint}>Axa X reprezintă ora citirilor din intervalul selectat.</Text>
        <FullChart title="Temperatură" data={history.tempHistory} xValues={history.timeline} color="#2563EB" label={(v) => `${v.toFixed(1)} °C`} />
        <FullChart title="Intensitate lumină" data={history.lightHistory} xValues={history.timeline} color="#F59E0B" label={(v) => `${v.toFixed(1)} %`} />

        <SectionHeader title="Activitate I/O (serial)" count={ioLog.length} />
        <LogArea entries={ioLog} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: theme.colors.background },
  content: { padding: 16, paddingBottom: 120 },
  axisHint: {
    marginTop: -2,
    marginBottom: 8,
    color: '#64748B',
    fontSize: 12,
    fontFamily: theme.font.medium
  }
});
