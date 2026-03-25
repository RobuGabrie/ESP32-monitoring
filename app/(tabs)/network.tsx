import { ScrollView, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { FullChart } from '@/components/FullChart';
import { NetworkTable } from '@/components/NetworkTable';
import { SectionHeader } from '@/components/SectionHeader';
import { SignalBars } from '@/components/SignalBars';
import { TabHero } from '@/components/TabHero';
import { TimeRangeSelector } from '@/components/TimeRangeSelector';
import { theme } from '@/constants/theme';
import { useESP32 } from '@/hooks/useESP32';

export default function NetworkScreen() {
  const { data, history, status, selectedRange, setTimeRange } = useESP32();

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.content}>
        <TabHero
          title="Network"
          subtitle="Connection quality, identity, and link stability."
          statusLabel={status === 'online' ? 'Connected' : 'Offline'}
          statusTone={status === 'online' ? 'online' : 'offline'}
          meta={[
            { label: 'SSID', value: data?.ssid ?? '--' },
            { label: 'RSSI', value: `${Math.round(data?.rssi ?? -99)} dBm` }
          ]}
        />

        <SectionHeader title="Signal" count={1} />
        <SignalBars rssi={data?.rssi ?? -99} />

        <SectionHeader title="Connection Details" count={8} />
        <NetworkTable
          rows={[
            { keyLabel: 'SSID', value: data?.ssid ?? '--' },
            { keyLabel: 'RSSI', value: `${Math.round(data?.rssi ?? -99)} dBm` },
            { keyLabel: 'IP', value: data?.ip ?? '--' },
            { keyLabel: 'MAC', value: data?.mac ?? '--' },
            { keyLabel: 'Channel', value: String(data?.channel ?? '--') },
            { keyLabel: 'Uptime', value: `${Math.round(data?.uptime ?? 0)} s` },
            { keyLabel: 'Timestamp', value: data?.timestamp || '--' },
            { keyLabel: 'Status', value: status === 'online' ? 'Connected' : 'Offline', statusDot: status === 'online' }
          ]}
        />

        <SectionHeader title="RSSI Trend" count={1} />
        <TimeRangeSelector value={selectedRange} onChange={setTimeRange} />
        <FullChart title="RSSI History" data={history.rssiHistory} xValues={history.timeline} color="#10B981" label={(v) => `${Math.round(v)} dBm`} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: theme.colors.background },
  content: { padding: 16, paddingBottom: 120 }
});
