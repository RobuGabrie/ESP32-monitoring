import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';

import { LogArea } from '@/components/LogArea';
import { SectionHeader } from '@/components/SectionHeader';
import { TabHero } from '@/components/TabHero';
import { theme } from '@/constants/theme';
import { useESP32 } from '@/hooks/useESP32';

export default function SensorsScreen() {
  const { ioLog, status } = useESP32();

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.content}>
        <TabHero
          title="Senzori / I/O"
          subtitle="Tab dedicat fluxului serial brut si activitatii I/O in timp real."
          statusLabel={status === 'offline' ? 'Offline' : 'Conectat'}
          statusTone={status === 'offline' ? 'offline' : 'online'}
          meta={[
            { label: 'Canal', value: 'hardandsoft/esp32/gpio_raw' },
            { label: 'Cadenta', value: '1Hz stream' }
          ]}
        />

        <View style={styles.infoCard}>
          <View style={styles.infoRow}>
            <Ionicons name="information-circle-outline" size={15} color="#4B5563" />
            <Text style={styles.infoText}>Valorile de senzori sunt disponibile in Monitor/Putere/Rețea.</Text>
          </View>
          <View style={styles.infoDivider} />
          <View style={styles.infoRow}>
            <Ionicons name="terminal-outline" size={15} color="#4B5563" />
            <Text style={styles.infoText}>Aici este pastrat doar fluxul brut pentru debug hardware.</Text>
          </View>
        </View>

        <View style={styles.serialShell}>
          <SectionHeader title="Activitate I/O (serial)" count={ioLog.length} countLabel="mesaje" />
          <LogArea entries={ioLog} />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: theme.colors.background },
  content: { padding: 16, paddingBottom: 120 },
  infoCard: {
    marginBottom: 12,
    borderRadius: theme.radius.md,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    backgroundColor: theme.colors.card,
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 8
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 6
  },
  infoDivider: {
    height: 1,
    backgroundColor: '#E2E8F0'
  },
  infoText: {
    color: '#334155',
    fontSize: 13,
    fontFamily: theme.font.medium
  },
  serialShell: {
    borderRadius: theme.radius.md,
    backgroundColor: '#F1F5F9',
    borderWidth: 1,
    borderColor: '#D9E2EC',
    padding: 10
  }
});
