import { useEffect, useMemo, useRef, useState } from 'react';
import { Animated, Easing, Pressable, ScrollView, StyleSheet, Switch, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { IOLogEntry } from '@/hooks/useStore';
import { theme } from '@/constants/theme';

interface Props {
  entries: IOLogEntry[];
}

const renderKvTokens = (line: string) => {
  const parts = line.split(/(\s+)/);
  return parts.map((part, idx) => {
    if (!part.length) {
      return null;
    }

    if (/^\s+$/.test(part)) {
      return <Text key={`space-${idx}`}>{part}</Text>;
    }

    const kvMatch = part.match(/^([^=]+)=([^=]+)$/);
    if (!kvMatch) {
      return <Text key={`raw-${idx}`} style={styles.kvNeutral}>{part}</Text>;
    }

    const [, key, value] = kvMatch;
    const numeric = Number(value);
    const active = Number.isFinite(numeric) && numeric > 0;

    return (
      <Text key={`kv-${idx}`}>
        <Text style={styles.kvKey}>{`${key}=`}</Text>
        <Text style={[styles.kvValue, active ? styles.kvOn : styles.kvOff]}>{value}</Text>
      </Text>
    );
  });
};

export function LogArea({ entries }: Props) {
  const PAGE_SIZE = 50;
  const scrollRef = useRef<ScrollView>(null);
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const prevCountRef = useRef(0);
  const [autoScroll, setAutoScroll] = useState(true);
  const [renderLimit, setRenderLimit] = useState(PAGE_SIZE);
  const [isStreamingView, setIsStreamingView] = useState(true);
  const [msgRate, setMsgRate] = useState(0);
  const [clearCursor, setClearCursor] = useState(0);
  const [frozenEntries, setFrozenEntries] = useState<IOLogEntry[]>([]);
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
  const displaySource = isStreamingView ? serialEntries.slice(clearCursor) : frozenEntries;

  const ordered = useMemo(() => [...displaySource].reverse(), [displaySource]);
  const visibleEntries = ordered.slice(0, renderLimit);

  useEffect(() => {
    if (!autoScroll) {
      return;
    }

    setRenderLimit(PAGE_SIZE);

    scrollRef.current?.scrollTo({ y: 0, animated: true });
  }, [autoScroll, entries, isStreamingView]);

  useEffect(() => {
    prevCountRef.current = serialEntries.length;
    const timer = setInterval(() => {
      const delta = serialEntries.length - prevCountRef.current;
      prevCountRef.current = serialEntries.length;
      setMsgRate(Math.max(0, delta));
    }, 1000);

    return () => clearInterval(timer);
  }, [serialEntries.length]);

  useEffect(() => {
    if (!isStreamingView) {
      pulseAnim.setValue(1);
      return;
    }

    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1.5,
          duration: 650,
          easing: Easing.out(Easing.quad),
          useNativeDriver: true
        }),
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 650,
          easing: Easing.in(Easing.quad),
          useNativeDriver: true
        })
      ])
    );

    loop.start();
    return () => loop.stop();
  }, [isStreamingView, pulseAnim]);

  return (
    <View style={styles.shell}>
      <View style={styles.serialHeader}>
        <View style={styles.headerLeft}>
          <View style={styles.titleRow}>
            <Ionicons name="terminal" size={15} color="#B6C2D3" />
            <Text style={styles.serialTitle}>SERIAL MONITOR</Text>
          </View>
          <Text style={styles.serialMeta}>hardandsoft/esp32/gpio_raw @ 1Hz</Text>
          <View style={styles.liveRow}>
            <Animated.View style={[styles.liveDot, { transform: [{ scale: pulseAnim }] }]} />
            <Text style={styles.liveText}>{isStreamingView ? `LIVE ${msgRate}/s` : 'PAUZAT'}</Text>
          </View>
        </View>
        <View style={styles.controlsWrap}>
          <View style={styles.controlsRow}>
            <Pressable
              style={[styles.btnPrimary, !isStreamingView ? styles.btnPrimaryPaused : null]}
              onPress={() => {
                if (isStreamingView) {
                  setFrozenEntries(serialEntries.slice(clearCursor));
                  setIsStreamingView(false);
                } else {
                  setIsStreamingView(true);
                  setRenderLimit(PAGE_SIZE);
                }
              }}
            >
              <Text style={styles.btnPrimaryText}>{isStreamingView ? 'Pauza flux' : 'Reia flux'}</Text>
            </Pressable>
            <Pressable
              style={styles.btnSecondary}
              onPress={() => {
                if (isStreamingView) {
                  setClearCursor(serialEntries.length);
                } else {
                  setFrozenEntries([]);
                }
                setRenderLimit(PAGE_SIZE);
                scrollRef.current?.scrollTo({ y: 0, animated: true });
              }}
            >
              <Text style={styles.btnSecondaryText}>Sterge</Text>
            </Pressable>
          </View>
          <View style={styles.controlsRow}>
            <View style={styles.autoScrollWrap}>
              <Text style={styles.autoScrollLabel}>Auto-scroll</Text>
              <Switch
                value={autoScroll}
                onValueChange={setAutoScroll}
                thumbColor={autoScroll ? '#FFFFFF' : '#D1D5DB'}
                trackColor={{ false: '#374151', true: '#22C55E' }}
              />
            </View>
          </View>
        </View>
      </View>

      <ScrollView
        ref={scrollRef}
        style={styles.wrap}
        contentContainerStyle={styles.content}
        scrollEventThrottle={16}
        onScroll={({ nativeEvent }) => {
          const nearBottom = nativeEvent.layoutMeasurement.height + nativeEvent.contentOffset.y >= nativeEvent.contentSize.height - 80;
          if (!nearBottom) return;

          setRenderLimit((prev) => {
            if (prev >= ordered.length) return prev;
            return Math.min(prev + PAGE_SIZE, ordered.length);
          });
        }}
      >
        {visibleEntries.map((entry, idx) => {
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

              {!entry.rawText ? (
                <View style={styles.signalRow}>
                  <Text style={styles.signalPrefix}>GPIO</Text>
                  <View style={styles.signalValueWrap}>
                    <Text style={styles.rawLine}>{renderKvTokens(gpioLine || '--')}</Text>
                  </View>
                </View>
              ) : null}
              {!entry.rawText && pcfEntries.length ? (
                <View style={styles.signalRow}>
                  <Text style={styles.signalPrefix}>PCF8591</Text>
                  <View style={styles.signalValueWrap}>
                    <Text style={styles.rawLine}>{renderKvTokens(pcfLine)}</Text>
                  </View>
                </View>
              ) : null}
              {!entry.rawText && inaEntries.length ? (
                <View style={styles.signalRow}>
                  <Text style={styles.signalPrefix}>INA219</Text>
                  <View style={styles.signalValueWrap}>
                    <Text style={styles.rawLine}>{renderKvTokens(inaLine)}</Text>
                  </View>
                </View>
              ) : null}
            </View>
          );
        })}

        {!visibleEntries.length ? <Text style={styles.empty}>Waiting for raw data...</Text> : null}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  shell: {
    backgroundColor: '#0A0F1B',
    borderRadius: theme.radius.lg,
    borderWidth: 1,
    borderColor: '#1E293B',
    borderLeftWidth: 3,
    borderLeftColor: '#334155',
    padding: 10,
    ...theme.shadow.card
  },
  headerLeft: {
    gap: 2
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6
  },
  serialHeader: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 8,
    paddingBottom: 10,
    gap: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#1E293B'
  },
  serialTitle: {
    color: '#E2E8F0',
    fontSize: 14,
    letterSpacing: 0.4,
    fontFamily: 'JetBrainsMono_500Medium'
  },
  serialMeta: {
    marginTop: 2,
    color: '#9CA3AF',
    fontSize: 11,
    fontFamily: 'JetBrainsMono_400Regular'
  },
  liveRow: {
    marginTop: 4,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6
  },
  liveDot: {
    width: 8,
    height: 8,
    borderRadius: 999,
    backgroundColor: '#22C55E'
  },
  liveText: {
    color: '#86EFAC',
    fontSize: 11,
    fontFamily: 'JetBrainsMono_500Medium'
  },
  controlsWrap: {
    alignItems: 'flex-end',
    gap: 6,
    width: '100%',
    marginTop: 4
  },
  controlsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: 8,
    width: '100%',
    flexWrap: 'wrap'
  },
  btnSecondary: {
    backgroundColor: '#111827',
    borderColor: '#334155',
    borderWidth: 1,
    borderRadius: 10,
    minHeight: 48,
    paddingHorizontal: 14,
    paddingVertical: 11,
    justifyContent: 'center'
  },
  btnSecondaryText: {
    color: '#F8FAFC',
    fontSize: 13,
    fontFamily: theme.font.semiBold
  },
  btnPrimary: {
    backgroundColor: '#334155',
    borderColor: '#475569',
    borderWidth: 1,
    borderRadius: 10,
    minHeight: 48,
    paddingHorizontal: 14,
    paddingVertical: 11,
    justifyContent: 'center'
  },
  btnPrimaryPaused: {
    backgroundColor: '#0F172A',
    borderColor: '#334155'
  },
  btnPrimaryText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontFamily: theme.font.semiBold
  },
  autoScrollWrap: {
    minHeight: 48,
    minWidth: 170,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#334155',
    backgroundColor: '#111827',
    paddingHorizontal: 10,
    paddingVertical: 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8
  },
  autoScrollLabel: {
    color: '#CBD5E1',
    fontSize: 13,
    fontFamily: theme.font.medium
  },
  wrap: {
    marginTop: 2,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#334155',
    backgroundColor: '#030712',
    minHeight: 280,
    maxHeight: 420
  },
  content: {
    gap: 8,
    padding: 8
  },
  entryCard: {
    backgroundColor: '#0B1220',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#1E293B',
    paddingVertical: 7,
    paddingHorizontal: 10,
    overflow: 'hidden'
  },
  entryHead: {
    flexDirection: 'row',
    justifyContent: 'flex-start',
    alignItems: 'center',
    marginBottom: 4
  },
  ts: {
    color: '#A7F3D0',
    fontFamily: 'JetBrainsMono_500Medium',
    fontSize: 11,
    letterSpacing: 0.2
  },
  tsHistory: {
    color: '#CBD5E1'
  },
  rawLine: {
    color: '#A7F3D0',
    fontSize: 11,
    lineHeight: 16,
    fontFamily: 'JetBrainsMono_400Regular',
    flexShrink: 1,
    width: '100%'
  },
  rawLineHistory: {
    color: '#E2E8F0'
  },
  signalRow: {
    marginTop: 4,
    flexDirection: 'row',
    gap: 8,
    alignItems: 'flex-start',
    width: '100%'
  },
  signalPrefix: {
    width: 52,
    minWidth: 52,
    color: '#94A3B8',
    fontSize: 10,
    fontFamily: 'JetBrainsMono_500Medium'
  },
  signalValueWrap: {
    flex: 1,
    minWidth: 0
  },
  kvKey: {
    color: '#94A3B8',
    fontFamily: 'JetBrainsMono_400Regular'
  },
  kvValue: {
    fontFamily: 'JetBrainsMono_500Medium'
  },
  kvOn: {
    color: '#34D399'
  },
  kvOff: {
    color: '#F87171'
  },
  kvNeutral: {
    color: '#E2E8F0',
    fontFamily: 'JetBrainsMono_400Regular'
  },
  empty: {
    color: '#94A3B8',
    fontSize: 12,
    fontFamily: 'JetBrainsMono_400Regular',
    paddingVertical: 10,
    textAlign: 'center'
  }
});
