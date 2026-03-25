import { useEffect, useRef, useState } from 'react';
import { Platform, ScrollView, StyleSheet, Switch, Text, View } from 'react-native';

import { IOLogEntry } from '@/hooks/useStore';
import { theme } from '@/constants/theme';

interface Props {
  entries: IOLogEntry[];
}

export function LogArea({ entries }: Props) {
  const scrollRef = useRef<ScrollView>(null);
  const [autoScroll, setAutoScroll] = useState(true);
  const latest = entries[entries.length - 1];
  const latestTs = latest?.ts ?? '--';

  const ordered = [...entries].reverse();

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
          <Text style={styles.serialTitle}>I/O Serial Monitor</Text>
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
      </View>

      <ScrollView ref={scrollRef} style={styles.wrap} contentContainerStyle={styles.content}>
        {ordered.map((entry, idx) => {
          const gpioEntries = Object.entries(entry.gpio ?? {});
          const digitalActive = gpioEntries
            .filter(([name, value]) => name.startsWith('gpio') && Math.round(value) === 1)
            .sort(([a], [b]) => a.localeCompare(b));
          const analogEntries = gpioEntries
            .filter(([name, value]) => name.startsWith('adc') && Number.isFinite(value))
            .sort(([a], [b]) => a.localeCompare(b));

          const primaryAnalog = analogEntries[0] ?? null;
          const primaryAnalogName = primaryAnalog ? primaryAnalog[0].toUpperCase() : 'ADC';
          const primaryAnalogValue = primaryAnalog ? Math.round(primaryAnalog[1]) : 0;
          const primaryAnalogPercent = Math.max(0, Math.min(100, (primaryAnalogValue / 4095) * 100));

          return (
            <View style={styles.entryCard} key={`${entry.ts}-${idx}`}>
              <View style={styles.entryHead}>
                <Text style={styles.ts}>{entry.ts}</Text>
              </View>

              <Text style={styles.telemetryLine}>T {entry.temp.toFixed(1)} C   L {Math.round(entry.light)} %</Text>

              <View style={styles.digitalRow}>
                {digitalActive.length ? (
                  digitalActive.map(([name]) => <DigitalBadge key={name} label={name.replace('gpio', 'G')} active />)
                ) : (
                  <Text style={styles.noneText}>No active GPIO</Text>
                )}
              </View>

              {primaryAnalog ? (
                <>
                  <View style={styles.analogHead}>
                    <Text style={styles.analogLabel}>{primaryAnalogName}</Text>
                    <Text style={styles.analogValue}>{primaryAnalogValue} / 4095</Text>
                  </View>
                  <View style={styles.track}>
                    <View style={[styles.fill, { width: `${primaryAnalogPercent}%` }]} />
                  </View>
                </>
              ) : null}
            </View>
          );
        })}
      </ScrollView>
    </View>
  );
}

function DigitalBadge({ label, active }: { label: string; active: boolean }) {
  return (
    <View style={[styles.digitalBadge, active ? styles.digitalBadgeOn : styles.digitalBadgeOff]}>
      <View style={[styles.dot, active ? styles.dotOn : styles.dotOff]} />
      <Text style={[styles.digitalLabel, active ? styles.digitalLabelOn : styles.digitalLabelOff]}>
        {label} {active ? 'ON' : 'OFF'}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  shell: {
    backgroundColor: '#FFFFFF',
    borderRadius: theme.radius.lg,
    borderWidth: 1,
    borderColor: '#E5EAF1',
    padding: 12,
    ...theme.shadow.card
  },
  serialHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0'
  },
  serialTitle: {
    color: '#1F2937',
    fontSize: 13,
    letterSpacing: 0.5,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace'
  },
  autoScrollWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8
  },
  autoScrollLabel: {
    color: '#475569',
    fontSize: 12,
    fontFamily: theme.font.medium
  },
  topBar: {
    flexDirection: 'row',
    justifyContent: 'flex-start',
    alignItems: 'center',
    marginBottom: 10,
    gap: 8
  },
  infoPill: {
    backgroundColor: '#EFF6FF',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6
  },
  infoPillText: {
    color: '#1D4ED8',
    fontSize: 12,
    fontFamily: theme.font.medium
  },
  wrap: {
    minHeight: 360,
    maxHeight: 460
  },
  content: {
    gap: 10
  },
  entryCard: {
    backgroundColor: '#FAFBFD',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: 10
  },
  entryHead: {
    flexDirection: 'row',
    justifyContent: 'flex-start',
    alignItems: 'center',
    marginBottom: 6
  },
  ts: {
    color: '#2563EB',
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    fontSize: 12,
  },
  telemetryLine: {
    marginBottom: 6,
    color: '#334155',
    fontSize: 12,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  digitalRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginBottom: 8
  },
  noneText: {
    color: '#64748B',
    fontSize: 11,
    fontFamily: theme.font.medium
  },
  digitalBadge: {
    borderRadius: 999,
    paddingVertical: 6,
    paddingHorizontal: 9,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderWidth: 1
  },
  digitalBadgeOn: {
    backgroundColor: '#DCFCE7',
    borderColor: '#86EFAC'
  },
  digitalBadgeOff: {
    backgroundColor: '#F1F5F9',
    borderColor: '#CBD5E1'
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 999
  },
  dotOn: {
    backgroundColor: '#16A34A'
  },
  dotOff: {
    backgroundColor: '#64748B'
  },
  digitalLabel: {
    fontSize: 11,
    fontFamily: theme.font.medium
  },
  digitalLabelOn: {
    color: '#166534'
  },
  digitalLabelOff: {
    color: '#334155'
  },
  analogHead: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6
  },
  analogLabel: {
    color: '#475569',
    fontSize: 12,
    fontFamily: theme.font.medium
  },
  analogValue: {
    color: '#1D4ED8',
    fontSize: 12,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace'
  },
  track: {
    width: '100%',
    height: 10,
    borderRadius: 999,
    backgroundColor: '#E2E8F0',
    overflow: 'hidden'
  },
  fill: {
    height: '100%',
    borderRadius: 999,
    backgroundColor: '#2563EB'
  },
});
