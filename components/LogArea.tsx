import { useEffect, useMemo, useRef, useState } from 'react';
import { Platform, ScrollView, StyleSheet, Switch, Text, View } from 'react-native';

import { IOLogEntry } from '@/hooks/useStore';
import { theme } from '@/constants/theme';

interface Props {
  entries: IOLogEntry[];
}

export function LogArea({ entries }: Props) {
  const scrollRef = useRef<ScrollView>(null);
  const [autoScroll, setAutoScroll] = useState(true);
  const serialEntries = useMemo(
    () => entries.filter((entry) => {
      if (entry.rawText) return true;
      if (Object.keys(entry.gpio ?? {}).length > 0) return true;
      if (Object.keys(entry.pcf8591Raw ?? {}).length > 0) return true;
      if (Object.keys(entry.ina219Raw ?? {}).length > 0) return true;
      return false;
    }),
    [entries]
  );
  const latest = serialEntries[serialEntries.length - 1];
  const latestTs = latest?.ts ?? '--';

  const ordered = [...serialEntries].reverse();

  useEffect(() => {
    if (!autoScroll) {
      return;
    }

    scrollRef.current?.scrollTo({ y: 0, animated: true });
  }, [autoScroll, entries]);

  return (
    <View style={styles.shell}>
      <View style={styles.serialHeader}>
        <View>
          <Text style={styles.serialTitle}>SERIAL MONITOR</Text>
          <Text style={styles.serialMeta}>hardandsoft/esp32/gpio_raw @ 1Hz</Text>
        </View>
        <View style={styles.autoScrollWrap}>
          <Text style={styles.autoScrollLabel}>Auto-scroll</Text>
          <Switch
            value={autoScroll}
            onValueChange={setAutoScroll}
            thumbColor={autoScroll ? '#FFFFFF' : '#D1D5DB'}
            trackColor={{ false: '#CBD5E1', true: '#93C5FD' }}
          />
        </View>
      </View>

      <View style={styles.topBar}>
        <View style={styles.infoPill}>
          <Text style={styles.infoPillText}>Last Updated {latestTs}</Text>
        </View>
        <View style={styles.infoPill}>
          <Text style={styles.infoPillText}>Lines {serialEntries.length}</Text>
        </View>
      </View>

      <ScrollView ref={scrollRef} style={styles.wrap} contentContainerStyle={styles.content}>
        {ordered.map((entry, idx) => {
          const gpioEntries = Object.entries(entry.gpio ?? {}).sort(([a], [b]) => a.localeCompare(b));
          const pcfEntries = Object.entries(entry.pcf8591Raw ?? {}).sort(([a], [b]) => a.localeCompare(b));
          const inaEntries = Object.entries(entry.ina219Raw ?? {}).sort(([a], [b]) => a.localeCompare(b));
          const gpioLine = gpioEntries.map(([name, value]) => `${name}=${value}`).join(' ');
          const pcfLine = pcfEntries.map(([k, v]) => `${k}=${v}`).join(' ');
          const inaLine = inaEntries.map(([k, v]) => `${k}=${v}`).join(' ');
          const isHistory = entry.source === 'history';

          return (
            <View style={styles.entryCard} key={`${entry.ts}-${idx}`}>
              <View style={styles.entryHead}>
                <Text style={[styles.ts, isHistory ? styles.tsHistory : null]}>
                  [{entry.ts}] {isHistory ? 'DB HIST' : 'RX RAW'}
                </Text>
              </View>

              {entry.rawText ? <Text style={[styles.rawLine, styles.rawLineHistory]}>{entry.rawText}</Text> : null}

              {!entry.rawText ? <Text style={styles.rawLine}>GPIO    {gpioLine || '--'}</Text> : null}
              {!entry.rawText && pcfEntries.length ? <Text style={styles.rawLine}>PCF8591 {pcfLine}</Text> : null}
              {!entry.rawText && inaEntries.length ? <Text style={styles.rawLine}>INA219  {inaLine}</Text> : null}
            </View>
          );
        })}

        {!ordered.length ? <Text style={styles.empty}>Waiting for raw data...</Text> : null}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  shell: {
    backgroundColor: '#050A0F',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#113247',
    padding: 10,
    ...theme.shadow.card
  },
  serialHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#16384D'
  },
  serialTitle: {
    color: '#7DD3FC',
    fontSize: 14,
    letterSpacing: 0.5,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace'
  },
  serialMeta: {
    marginTop: 2,
    color: '#38BDF8',
    fontSize: 11,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace'
  },
  autoScrollWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8
  },
  autoScrollLabel: {
    color: '#94A3B8',
    fontSize: 12,
    fontFamily: theme.font.medium
  },
  topBar: {
    flexDirection: 'row',
    justifyContent: 'flex-start',
    alignItems: 'center',
    marginBottom: 8,
    gap: 8
  },
  infoPill: {
    backgroundColor: '#0C1A24',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderWidth: 1,
    borderColor: '#16384D'
  },
  infoPillText: {
    color: '#67E8F9',
    fontSize: 11,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace'
  },
  wrap: {
    minHeight: 360,
    maxHeight: 460
  },
  content: {
    gap: 6
  },
  entryCard: {
    backgroundColor: '#0A1118',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#173246',
    paddingVertical: 8,
    paddingHorizontal: 10
  },
  entryHead: {
    flexDirection: 'row',
    justifyContent: 'flex-start',
    alignItems: 'center',
    marginBottom: 4
  },
  ts: {
    color: '#22D3EE',
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    fontSize: 12,
    letterSpacing: 0.2
  },
  tsHistory: {
    color: '#A78BFA'
  },
  rawLine: {
    color: '#86EFAC',
    fontSize: 12,
    lineHeight: 18,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace'
  },
  rawLineHistory: {
    color: '#E2E8F0'
  },
  empty: {
    color: '#94A3B8',
    fontSize: 12,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    paddingVertical: 10
  }
});
