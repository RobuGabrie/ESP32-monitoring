import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';

import { SectionHeader } from '@/components/SectionHeader';
import { ScreenShell } from '@/components/ScreenShell';
import { TabHero } from '@/components/TabHero';
import { theme } from '@/constants/theme';
import { useESP32 } from '@/hooks/useESP32';

type SensorCard = {
  key: string;
  label: string;
  value: string;
  tone: 'primary' | 'neutral' | 'success';
};

const formatKvLine = (obj: Record<string, number> | undefined) => {
  const pairs = Object.entries(obj ?? {}).sort(([a], [b]) => a.localeCompare(b));
  if (!pairs.length) return '--';
  return pairs.map(([k, v]) => `${k.toUpperCase()}: ${v}`).join('   ');
};

const getSignalTone = (value: number) => {
  if (value > 0) return 'HIGH';
  return 'LOW';
};

export default function SensorsScreen() {
  const { ioLog, status, data } = useESP32();
  const entries = ioLog.filter((entry) => entry.rawText || Object.keys(entry.gpio ?? {}).length > 0 || Object.keys(entry.pcf8591Raw ?? {}).length > 0 || Object.keys(entry.ina219Raw ?? {}).length > 0);
  const latest = [...entries].reverse().find((entry) => Object.keys(entry.gpio ?? {}).length > 0 || Object.keys(entry.pcf8591Raw ?? {}).length > 0 || Object.keys(entry.ina219Raw ?? {}).length > 0);
  const gpioValues = Object.values(latest?.gpio ?? {});
  const activeCount = gpioValues.filter((v) => Number(v) > 0).length;
  const summaryCards: SensorCard[] = [
    {
      key: 'temp',
      label: 'Temperatura',
      value: data ? `${data.temp.toFixed(1)} °C` : '--',
      tone: 'primary'
    },
    {
      key: 'light',
      label: 'Lumina',
      value: data ? `${(data.lightPercent ?? data.light).toFixed(1)} %` : '--',
      tone: 'neutral'
    },
    {
      key: 'gpio',
      label: 'GPIO active',
      value: latest ? String(activeCount) : '--',
      tone: 'success'
    }
  ];
  const recentEntries = [...entries].reverse().slice(0, 6);
  const gpioPairs = Object.entries(latest?.gpio ?? {}).sort(([a], [b]) => a.localeCompare(b));
  const pcfPairs = Object.entries(latest?.pcf8591Raw ?? {}).sort(([a], [b]) => a.localeCompare(b));
  const inaPairs = Object.entries(latest?.ina219Raw ?? {}).sort(([a], [b]) => a.localeCompare(b));
  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.content}>
        <ScreenShell contentStyle={styles.pageShell}>
          <TabHero
            title="Senzori / I/O"
            subtitle="Monitorizare live pentru GPIO si senzori analogici, intr-un layout compact si usor de scanat."
            statusLabel={status === 'offline' ? 'Offline' : 'Conectat'}
            statusTone={status === 'offline' ? 'offline' : 'online'}
            meta={[
              { label: 'Canal', value: 'hardandsoft/esp32/gpio_raw' },
              { label: 'Cadenta', value: '1Hz stream' }
            ]}
          />

          <View style={styles.panel}>
            <SectionHeader title="Snapshot senzori" count={summaryCards.length} />
            <View style={styles.summaryGrid}>
              {summaryCards.map((item) => (
                <View
                  key={item.key}
                  style={[
                    styles.metricCard,
                    item.tone === 'primary' ? styles.metricPrimary : item.tone === 'success' ? styles.metricSuccess : styles.metricNeutral
                  ]}
                >
                  <Text style={styles.metricLabel}>{item.label}</Text>
                  <Text style={styles.metricValue}>{item.value}</Text>
                </View>
              ))}
            </View>
          </View>

          <View style={styles.panel}>
            <SectionHeader title="GPIO live" count={gpioPairs.length} countLabel="semnale" />
            <View style={styles.gpioGrid}>
              {gpioPairs.map(([pin, value]) => (
                <View key={pin} style={[styles.gpioCard, value > 0 ? styles.gpioCardHigh : styles.gpioCardLow]}>
                  <View style={[styles.gpioDot, value > 0 ? styles.gpioDotHigh : styles.gpioDotLow]} />
                  <Text style={styles.gpioLabel}>{pin.toUpperCase()}</Text>
                  <Text style={styles.gpioValue}>{value}</Text>
                  <Text style={[styles.gpioState, value > 0 ? styles.gpioStateHigh : styles.gpioStateLow]}>{getSignalTone(value)}</Text>
                </View>
              ))}
              {!gpioPairs.length ? (
                <View style={styles.emptyCard}>
                  <Ionicons name="information-circle-outline" size={16} color="#64748B" />
                  <Text style={styles.emptyText}>Nu exista inca valori GPIO.</Text>
                </View>
              ) : null}
            </View>
          </View>

          {(pcfPairs.length || inaPairs.length) ? (
            <View style={styles.panel}>
              <SectionHeader title="Senzori analogici" count={pcfPairs.length + inaPairs.length} />
              {pcfPairs.length ? (
                <View style={styles.sensorGroup}>
                  <Text style={styles.sensorBlockTitle}>PCF8591</Text>
                  <View style={styles.sensorChipWrap}>
                    {pcfPairs.map(([name, value]) => (
                      <View key={name} style={styles.sensorChip}>
                        <Text style={styles.sensorChipKey}>{name.toUpperCase()}</Text>
                        <Text style={styles.sensorChipValue}>{value}</Text>
                      </View>
                    ))}
                  </View>
                </View>
              ) : null}

              {inaPairs.length ? (
                <View style={styles.sensorGroup}>
                  <Text style={styles.sensorBlockTitle}>INA219</Text>
                  <View style={styles.sensorChipWrap}>
                    {inaPairs.map(([name, value]) => (
                      <View key={name} style={styles.sensorChip}>
                        <Text style={styles.sensorChipKey}>{name.toUpperCase()}</Text>
                        <Text style={styles.sensorChipValue}>{value}</Text>
                      </View>
                    ))}
                  </View>
                </View>
              ) : null}
            </View>
          ) : null}

          <View style={styles.panel}>
            <SectionHeader title="Intrari serial recente" count={recentEntries.length} countLabel="mesaje" />
            <View style={styles.entriesWrap}>
              {recentEntries.map((entry, index) => (
                <View style={styles.entryCard} key={`${entry.ts}-${index}`}>
                  <View style={styles.entryHead}>
                    <View style={styles.entryBadge}>
                      <Ionicons name="radio-outline" size={13} color="#1E40AF" />
                      <Text style={styles.entryBadgeText}>{entry.source === 'history' ? 'HISTORY' : 'LIVE'}</Text>
                    </View>
                    <Text style={styles.entryTs}>{entry.ts}</Text>
                  </View>

                  {entry.rawText ? <Text style={styles.rawText}>{entry.rawText}</Text> : null}

                  <View style={styles.kvRow}>
                    <Text style={styles.dataLabel}>GPIO</Text>
                    <Text style={styles.dataValue}>{formatKvLine(entry.gpio)}</Text>
                  </View>

                  {!!Object.keys(entry.pcf8591Raw ?? {}).length && (
                    <View style={styles.kvRow}>
                      <Text style={styles.dataLabel}>PCF8591</Text>
                      <Text style={styles.dataValue}>{formatKvLine(entry.pcf8591Raw)}</Text>
                    </View>
                  )}

                  {!!Object.keys(entry.ina219Raw ?? {}).length && (
                    <View style={styles.kvRow}>
                      <Text style={styles.dataLabel}>INA219</Text>
                      <Text style={styles.dataValue}>{formatKvLine(entry.ina219Raw)}</Text>
                    </View>
                  )}
                </View>
              ))}

              {!recentEntries.length && (
                <View style={styles.emptyCard}>
                  <Ionicons name="information-circle-outline" size={16} color="#64748B" />
                  <Text style={styles.emptyText}>Nu exista inca date seriale.</Text>
                </View>
              )}
            </View>
          </View>
        </ScreenShell>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: theme.colors.background },
  content: { paddingHorizontal: 12, paddingTop: 12, paddingBottom: 112 },
  pageShell: {
    paddingHorizontal: 0,
    paddingTop: 0,
    paddingBottom: 0
  },
  panel: {
    backgroundColor: '#FFFFFF',
    borderRadius: theme.radius.lg,
    borderWidth: 1,
    borderColor: '#D6E4F3',
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 12,
    ...theme.shadow.card
  },
  summaryGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 9,
    marginTop: 4
  },
  metricCard: {
    flexBasis: '48%',
    minWidth: 145,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#D8E3F0',
    paddingHorizontal: 12,
    paddingVertical: 11,
    minHeight: 84
  },
  metricPrimary: {
    backgroundColor: '#E7F0FF',
    borderColor: '#C6DBFF'
  },
  metricNeutral: {
    backgroundColor: '#F8FBFF'
  },
  metricSuccess: {
    backgroundColor: '#EAFBF2'
  },
  metricLabel: {
    color: '#51637A',
    fontFamily: theme.font.medium,
    fontSize: 12
  },
  metricValue: {
    marginTop: 5,
    color: '#0F172A',
    fontFamily: theme.font.bold,
    fontSize: 24
  },
  gpioGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 9,
    marginTop: 4
  },
  gpioCard: {
    flexBasis: '31%',
    minWidth: 96,
    borderRadius: 14,
    borderWidth: 1,
    paddingVertical: 11,
    paddingHorizontal: 8,
    alignItems: 'center'
  },
  gpioDot: {
    width: 8,
    height: 8,
    borderRadius: 999,
    marginBottom: 4
  },
  gpioDotHigh: {
    backgroundColor: '#10B981'
  },
  gpioDotLow: {
    backgroundColor: '#94A3B8'
  },
  gpioCardHigh: {
    backgroundColor: '#EAFBF2',
    borderColor: '#A9E6C6'
  },
  gpioCardLow: {
    backgroundColor: '#F6F9FD',
    borderColor: '#DFE8F1'
  },
  gpioLabel: {
    color: '#475569',
    fontFamily: theme.font.medium,
    fontSize: 11
  },
  gpioValue: {
    marginTop: 3,
    color: '#0F172A',
    fontFamily: theme.font.bold,
    fontSize: 28,
    lineHeight: 33
  },
  gpioState: {
    marginTop: 2,
    fontFamily: theme.font.semiBold,
    fontSize: 11
  },
  gpioStateHigh: {
    color: '#047857'
  },
  gpioStateLow: {
    color: '#475569'
  },
  sensorGroup: {
    gap: 8,
    marginTop: 4
  },
  sensorBlockTitle: {
    color: '#334A64',
    fontFamily: theme.font.semiBold,
    fontSize: 13,
    marginBottom: 2
  },
  sensorChipWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 7
  },
  sensorChip: {
    backgroundColor: '#EEF4FF',
    borderRadius: 11,
    borderWidth: 1,
    borderColor: '#C9D6F5',
    paddingHorizontal: 10,
    paddingVertical: 9,
    minWidth: 92
  },
  sensorChipKey: {
    color: '#5B6B84',
    fontFamily: theme.font.medium,
    fontSize: 10
  },
  sensorChipValue: {
    marginTop: 1,
    color: '#111827',
    fontFamily: theme.font.bold,
    fontSize: 18
  },
  entriesWrap: {
    gap: 9,
    marginTop: 4
  },
  entryCard: {
    backgroundColor: '#FAFCFF',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#D4E1F0',
    padding: 12,
    gap: 8
  },
  entryHead: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 8
  },
  entryBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 999,
    backgroundColor: '#E9F0FF',
    borderWidth: 1,
    borderColor: '#CCDCF9'
  },
  entryBadgeText: {
    color: '#1E40AF',
    fontFamily: theme.font.semiBold,
    fontSize: 11
  },
  entryTs: {
    color: '#475569',
    fontFamily: theme.font.medium,
    fontSize: 12
  },
  rawText: {
    color: '#0F172A',
    fontFamily: 'JetBrainsMono_400Regular',
    fontSize: 14,
    lineHeight: 20
  },
  kvRow: {
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#E0E8F2',
    backgroundColor: '#F5F8FC',
    paddingHorizontal: 8,
    paddingVertical: 7,
    gap: 4
  },
  dataLabel: {
    color: '#64748B',
    fontFamily: theme.font.medium,
    fontSize: 11,
    textTransform: 'uppercase'
  },
  dataValue: {
    color: '#111827',
    fontFamily: 'JetBrainsMono_400Regular',
    fontSize: 14,
    lineHeight: 19
  },
  emptyCard: {
    backgroundColor: '#F8FBFF',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#DEE8F3',
    padding: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8
  },
  emptyText: {
    color: '#475569',
    fontFamily: theme.font.medium,
    fontSize: 14
  }
});
