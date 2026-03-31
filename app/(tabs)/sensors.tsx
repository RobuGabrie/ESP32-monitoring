import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';

import { SectionHeader } from '@/components/SectionHeader';
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
        <TabHero
          title="Senzori / I/O"
          subtitle="Valori GPIO si senzori afisate clar, in carduri mari, pentru citire instant."
          statusLabel={status === 'offline' ? 'Offline' : 'Conectat'}
          statusTone={status === 'offline' ? 'offline' : 'online'}
          meta={[
            { label: 'Canal', value: 'hardandsoft/esp32/gpio_raw' },
            { label: 'Cadenta', value: '1Hz stream' }
          ]}
        />

        <SectionHeader title="Snapshot senzori" count={summaryCards.length} />
        <View style={styles.summaryGrid}>
          {summaryCards.map((item) => (
            <View key={item.key} style={[styles.metricCard, item.tone === 'primary' ? styles.metricPrimary : item.tone === 'success' ? styles.metricSuccess : styles.metricNeutral]}>
              <Text style={styles.metricLabel}>{item.label}</Text>
              <Text style={styles.metricValue}>{item.value}</Text>
            </View>
          ))}
        </View>

        <SectionHeader title="GPIO live" count={gpioPairs.length} countLabel="semnale" />
        <View style={styles.gpioGrid}>
          {gpioPairs.map(([pin, value]) => (
            <View key={pin} style={[styles.gpioCard, value > 0 ? styles.gpioCardHigh : styles.gpioCardLow]}>
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

        {(pcfPairs.length || inaPairs.length) ? <SectionHeader title="Senzori analogici" count={pcfPairs.length + inaPairs.length} /> : null}
        {pcfPairs.length ? (
          <View style={styles.sensorBlock}>
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
          <View style={styles.sensorBlock}>
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

        <SectionHeader title="Intrari serial recente" count={recentEntries.length} countLabel="mesaje" />
        <View style={styles.entriesWrap}>
          {recentEntries.map((entry, index) => (
            <View style={styles.entryCard} key={`${entry.ts}-${index}`}>
              <View style={styles.entryHead}>
                <View style={styles.entryBadge}>
                  <Ionicons name="radio-outline" size={13} color="#1D4ED8" />
                  <Text style={styles.entryBadgeText}>{entry.source === 'history' ? 'HISTORY' : 'LIVE'}</Text>
                </View>
                <Text style={styles.entryTs}>{entry.ts}</Text>
              </View>

              {entry.rawText ? <Text style={styles.rawText}>{entry.rawText}</Text> : null}

              <View style={styles.dataRow}>
                <Text style={styles.dataLabel}>GPIO</Text>
                <Text style={styles.dataValue}>{formatKvLine(entry.gpio)}</Text>
              </View>

              {!!Object.keys(entry.pcf8591Raw ?? {}).length && (
                <View style={styles.dataRow}>
                  <Text style={styles.dataLabel}>PCF8591</Text>
                  <Text style={styles.dataValue}>{formatKvLine(entry.pcf8591Raw)}</Text>
                </View>
              )}

              {!!Object.keys(entry.ina219Raw ?? {}).length && (
                <View style={styles.dataRow}>
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
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: theme.colors.background },
  content: { padding: 14, paddingBottom: 104 },
  summaryGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginBottom: 12
  },
  metricCard: {
    flexBasis: '48%',
    minWidth: 145,
    borderRadius: theme.radius.md,
    borderWidth: 1,
    borderColor: '#DCE6F2',
    paddingHorizontal: 12,
    paddingVertical: 11
  },
  metricPrimary: {
    backgroundColor: '#E8F0FF'
  },
  metricNeutral: {
    backgroundColor: '#F8FAFC'
  },
  metricSuccess: {
    backgroundColor: '#ECFDF5'
  },
  metricLabel: {
    color: '#475569',
    fontFamily: theme.font.medium,
    fontSize: 12
  },
  metricValue: {
    marginTop: 3,
    color: '#0F172A',
    fontFamily: theme.font.bold,
    fontSize: 23
  },
  gpioGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginBottom: 14
  },
  gpioCard: {
    flexBasis: '31%',
    minWidth: 96,
    borderRadius: theme.radius.md,
    borderWidth: 1,
    paddingVertical: 10,
    paddingHorizontal: 8,
    alignItems: 'center'
  },
  gpioCardHigh: {
    backgroundColor: '#ECFDF5',
    borderColor: '#A7F3D0'
  },
  gpioCardLow: {
    backgroundColor: '#F8FAFC',
    borderColor: '#E2E8F0'
  },
  gpioLabel: {
    color: '#475569',
    fontFamily: theme.font.medium,
    fontSize: 11
  },
  gpioValue: {
    marginTop: 2,
    color: '#0F172A',
    fontFamily: theme.font.bold,
    fontSize: 29,
    lineHeight: 34
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
  sensorBlock: {
    marginBottom: 12,
    backgroundColor: '#FFFFFF',
    borderRadius: theme.radius.md,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: 10
  },
  sensorBlockTitle: {
    color: '#334155',
    fontFamily: theme.font.semiBold,
    fontSize: 13,
    marginBottom: 8
  },
  sensorChipWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8
  },
  sensorChip: {
    backgroundColor: '#EEF2FF',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#D6DBFF',
    paddingHorizontal: 10,
    paddingVertical: 8,
    minWidth: 92
  },
  sensorChipKey: {
    color: '#475569',
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
    gap: 10,
    marginBottom: 14
  },
  entryCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: theme.radius.md,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: 12,
    gap: 8,
    ...theme.shadow.card
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
    backgroundColor: '#EAF2FF'
  },
  entryBadgeText: {
    color: '#1D4ED8',
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
  dataRow: {
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
    backgroundColor: '#FFFFFF',
    borderRadius: theme.radius.md,
    borderWidth: 1,
    borderColor: '#E2E8F0',
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
