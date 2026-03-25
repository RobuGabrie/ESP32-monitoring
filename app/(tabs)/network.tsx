import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useState } from 'react';

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
  const [showRssiModal, setShowRssiModal] = useState(false);

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.content}>
        <TabHero
          title="Rețea"
          subtitle="Calitatea conexiunii, identitatea dispozitivului și stabilitatea legăturii."
          statusLabel={status === 'online' ? 'Conectat' : 'Offline'}
          statusTone={status === 'online' ? 'online' : 'offline'}
          meta={[
            { label: 'SSID', value: data?.ssid ?? '--' },
            { label: 'RSSI', value: `${Math.round(data?.rssi ?? -99)} dBm` }
          ]}
        />

        <SectionHeader title="Semnal" count={1} />
        <SignalBars rssi={data?.rssi ?? -99} />

        <SectionHeader title="Detalii conexiune" count={8} />
        <NetworkTable
          rows={[
            { keyLabel: 'SSID', value: data?.ssid ?? '--' },
            { keyLabel: 'RSSI', value: `${Math.round(data?.rssi ?? -99)} dBm` },
            { keyLabel: 'IP', value: data?.ip ?? '--' },
            { keyLabel: 'MAC', value: data?.mac ?? '--' },
            { keyLabel: 'Canal', value: String(data?.channel ?? '--') },
            { keyLabel: 'Timp activ', value: `${Math.round(data?.uptime ?? 0)} s` },
            { keyLabel: 'Timestamp', value: data?.timestamp || '--' },
            { keyLabel: 'Status', value: status === 'online' ? 'Conectat' : 'Offline', statusDot: status === 'online' }
          ]}
        />

        <SectionHeader title="Trend RSSI" count={1} />
        <TimeRangeSelector value={selectedRange} onChange={setTimeRange} />
        <Pressable onPress={() => setShowRssiModal(true)}>
          <FullChart title="Istoric RSSI" data={history.rssiHistory} xValues={history.timeline} color="#10B981" label={(v) => `${Math.round(v)} dBm`} />
        </Pressable>
      </ScrollView>

      <Modal visible={showRssiModal} transparent animationType="fade" onRequestClose={() => setShowRssiModal(false)}>
        <Pressable style={styles.modalBackdrop} onPress={() => setShowRssiModal(false)}>
          <Pressable style={styles.modalCard} onPress={(e) => e.stopPropagation()}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Trend RSSI extins</Text>
              <Pressable onPress={() => setShowRssiModal(false)}>
                <Text style={styles.modalClose}>Închide</Text>
              </Pressable>
            </View>
            <FullChart title="Istoric RSSI" height={300} data={history.rssiHistory} xValues={history.timeline} color="#10B981" label={(v) => `${Math.round(v)} dBm`} />
          </Pressable>
        </Pressable>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: theme.colors.background },
  content: { padding: 16, paddingBottom: 120 },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(15,23,42,0.45)',
    justifyContent: 'center',
    padding: 14
  },
  modalCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 12,
    borderWidth: 1,
    borderColor: '#E5EAF1',
    ...theme.shadow.floating
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6
  },
  modalTitle: {
    color: theme.colors.text,
    fontFamily: theme.font.bold,
    fontSize: 16
  },
  modalClose: {
    color: '#1D4ED8',
    fontFamily: theme.font.medium,
    fontSize: 13
  }
});
