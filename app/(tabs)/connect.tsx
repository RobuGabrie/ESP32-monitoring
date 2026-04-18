import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Animated,
  Easing,
  LayoutAnimation,
  Linking,
  Platform,
  Pressable,
  ScrollView,
  UIManager,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import Svg, { Defs, LinearGradient, Path, Stop } from 'react-native-svg';

import { ScreenShell } from '@/components/ScreenShell';
import { useAppTheme } from '@/hooks/useAppTheme';
import { useConnectivity } from '@/hooks/useConnectivity';

interface BLEDevice {
  id: string;
  name: string;
  rssi: number;
  isConnected: boolean;
  manufacturerData?: string;
  serviceData?: Record<string, string>;
}

const normalizeDevices = (raw: BLEDevice[]): BLEDevice[] => {
  const dedupe = new Map<string, BLEDevice>();

  raw.forEach((device) => {
    if (!device || typeof device !== 'object') {
      return;
    }

    if (typeof device.id !== 'string' || !device.id.trim()) {
      return;
    }

    const id = device.id.trim();
    const name =
      typeof device.name === 'string' && device.name.trim() ? device.name.trim() : 'Dispozitiv BLE fara nume';
    const rssi = Number.isFinite(device.rssi) ? device.rssi : -99;

    dedupe.set(id, {
      ...device,
      id,
      name,
      rssi,
      isConnected: Boolean(device.isConnected),
    });
  });

  return Array.from(dedupe.values()).sort((a, b) => b.rssi - a.rssi);
};

// ─── Full ConnectScreen replacement ───────────────────────────────────────────

export default function ConnectScreen() {
  const { theme } = useAppTheme();
  const { connectivityState, connect, disconnect, scanDevices } = useConnectivity();
  const router = useRouter();
  const isAndroid = Platform.OS === 'android';

  const [scanStage, setScanStage] = useState<'ready' | 'scanning' | 'results'>('ready');
  const [devices, setDevices] = useState<BLEDevice[]>([]);
  const [connectingDeviceId, setConnectingDeviceId] = useState<string | null>(null);
  const [esp32Only, setEsp32Only] = useState(true);
  const [isParamsExpanded, setIsParamsExpanded] = useState(false);
  const [scanDurationMs, setScanDurationMs] = useState(6000);
  const [scanError, setScanError] = useState<string | null>(null);
  const [lastScanAt, setLastScanAt] = useState<Date | null>(null);
  const [statusNowMs, setStatusNowMs] = useState(() => Date.now());

  const sweepAnim = useRef(new Animated.Value(0)).current;
  const pulseAnim = useRef(new Animated.Value(0)).current;
  const sheetAnim = useRef(new Animated.Value(0)).current;

  const isConnected = connectivityState.connectionStatus === 'online';
  const connectedDeviceId = connectivityState.deviceId ?? null;
  const connectedDeviceName = connectivityState.deviceName ?? null;

  useEffect(() => {
    if (!isConnected) {
      setStatusNowMs(Date.now());
      return;
    }

    const interval = setInterval(() => {
      setStatusNowMs(Date.now());
    }, 1000);

    return () => clearInterval(interval);
  }, [isConnected]);

  const streamAgeMs = connectivityState.lastDataReceived
    ? Math.max(0, statusNowMs - connectivityState.lastDataReceived.getTime())
    : null;
  const isStreamLive = connectivityState.dataStreamStatus === 'live';
  const isAwaitingData = connectivityState.dataStreamStatus === 'waiting';
  const streamLabel = !isConnected
    ? 'Nicio conexiune BLE activă'
    : isStreamLive
      ? `Date live primite ${Math.round((streamAgeMs ?? 0) / 1000)}s în urmă`
      : isAwaitingData
        ? 'Conectat, în așteptarea primului pachet de telemetrie'
        : 'Conectat, dar nu se primesc date. Verifică firmware-ul și UUID-urile caracteristicilor BLE.';
  const streamStateLabel = isStreamLive ? 'Flux activ' : isAwaitingData ? 'Asteapta primul pachet' : 'Flux intrerupt';
  const streamStateColor = isStreamLive ? theme.colors.success : isAwaitingData ? theme.colors.warning : theme.colors.error;
  const connectedAtLabel = connectivityState.connectedAt
    ? connectivityState.connectedAt.toLocaleTimeString('ro-RO')
    : '--';
  const lastPacketLabel = connectivityState.lastDataReceived
    ? `${Math.round((streamAgeMs ?? 0) / 1000)}s in urma`
    : 'Niciun pachet';
  const dataSourceLabel = connectivityState.lastDataSource ? connectivityState.lastDataSource.toUpperCase() : '--';

  useEffect(() => {
    if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
      UIManager.setLayoutAnimationEnabledExperimental(true);
    }
  }, []);

  // Sweep + pulse animations during scanning
  useEffect(() => {
    if (scanStage !== 'scanning') {
      sweepAnim.stopAnimation(); sweepAnim.setValue(0);
      pulseAnim.stopAnimation(); pulseAnim.setValue(0);
      return;
    }
    Animated.loop(Animated.timing(sweepAnim, { toValue: 1, duration: 2200, easing: Easing.linear, useNativeDriver: true })).start();
    Animated.loop(Animated.timing(pulseAnim, { toValue: 1, duration: 1800, easing: Easing.out(Easing.quad), useNativeDriver: true })).start();
  }, [scanStage]);

  // Sheet slide-in for results
  useEffect(() => {
    if (scanStage !== 'results') { sheetAnim.setValue(0); return; }
    Animated.spring(sheetAnim, { toValue: 1, useNativeDriver: true, tension: 70, friction: 12 }).start();
  }, [scanStage]);

  const sweepRotation = sweepAnim.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] });
  const pulseScale = pulseAnim.interpolate({ inputRange: [0, 1], outputRange: [0.85, 1.35] });
  const pulseOpacity = pulseAnim.interpolate({ inputRange: [0, 1], outputRange: [0.4, 0] });
  const sheetTranslateY = sheetAnim.interpolate({ inputRange: [0, 1], outputRange: [100, 0] });
  const sheetOpacity = sheetAnim.interpolate({ inputRange: [0, 1], outputRange: [0, 1] });

  const handleScan = async () => {
    setScanStage('scanning');
    setScanError(null);
    try {
      const found = await scanDevices(
        isAndroid ? { esp32Only, scanDurationMs, allowDuplicates: false, namePrefixes: ['ESP32', 'ESP32-C3', 'C3', 'Skydiver'] } : undefined
      );
      setDevices(normalizeDevices(found as BLEDevice[]));
      setLastScanAt(new Date());
      setScanStage('results');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Nu s-a putut realiza scanarea.';
      setScanError(message);
      setScanStage('ready');
      const isOff = message.toLowerCase().includes('turned off') || message.toLowerCase().includes('powered off');
      if (isOff) {
        Alert.alert('Bluetooth este oprit', 'Pornește Bluetooth, apoi încearcă din nou.', [
          { text: 'Deschide setări', onPress: () => Linking.openSettings().catch(() => {}) },
          { text: 'OK', style: 'cancel' },
        ]);
      } else {
        Alert.alert('Scanare eșuată', message);
      }
    }
  };

  const handleConnect = async (deviceId: string) => {
    setConnectingDeviceId(deviceId);
    try {
      const success = await connect(deviceId);
      if (success) {
        setDevices((prev) => prev.map((device) => ({ ...device, isConnected: device.id === deviceId })));
        Alert.alert('Conectat', 'Conectare reușită la dispozitiv. Aștept primul pachet de telemetrie.');
      }
      else Alert.alert('Conectare eșuată', 'Încearcă din nou.');
    } catch {
      Alert.alert('Conectare eșuată', 'A apărut o eroare.');
    } finally {
      setConnectingDeviceId(null);
    }
  };

  const handleDisconnect = () => {
    disconnect();
    setDevices((prev) => prev.map((device) => ({ ...device, isConnected: false })));
    setScanStage('ready');
    Alert.alert('Deconectat', 'Conexiunea BLE a fost oprită.');
  };

  const getSignalStrength = (rssi: number) => {
    if (rssi >= -50) return { label: 'Excelent', color: theme.colors.success, bars: 4 };
    if (rssi >= -60) return { label: 'Bun', color: theme.colors.success, bars: 3 };
    if (rssi >= -70) return { label: 'Mediu', color: theme.colors.warning, bars: 2 };
    return { label: 'Slab', color: theme.colors.error, bars: 1 };
  };

  const renderSignalBars = (bars: number, color: string) => (
    <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 2 }}>
      {[1, 2, 3, 4].map((b) => (
        <View key={b} style={{ width: 3, height: b * 4, borderRadius: 1, backgroundColor: b <= bars ? color : theme.colors.muted }} />
      ))}
    </View>
  );

  const paramsHint = `${esp32Only ? 'Doar ESP32/C3' : 'Toate BLE'} · ${scanDurationMs / 1000}s`;

  // ─── Shared card wrapper ──────────────────────────────────────────────────
  const Card = ({ children, animated = false, animStyle = {} }: any) => {
    const Wrapper = animated ? Animated.View : View;
    return (
      <Wrapper
        style={[
          {
            backgroundColor: theme.colors.surfaceRaised,
            borderRadius: 20,
            borderWidth: 1,
            borderColor: theme.colors.border,
            marginHorizontal: 16,
            marginTop: 14,
            overflow: 'hidden',
            ...theme.shadow.floating,
          },
          animStyle,
        ]}
      >
        {children}
      </Wrapper>
    );
  };

  // ─── Radar center icon ────────────────────────────────────────────────────
  const RadarCore = () => (
    <View style={{ width: 54, height: 54, borderRadius: 27, backgroundColor: 'rgba(242,106,45,0.10)', borderWidth: 1, borderColor: 'rgba(242,106,45,0.28)', alignItems: 'center', justifyContent: 'center', zIndex: 1 }}>
      <Ionicons name="bluetooth-outline" size={24} color={theme.colors.primary} />
    </View>
  );

  // ─── Radar rings ──────────────────────────────────────────────────────────
  const RadarRings = () => (
    <View style={{ width: 140, height: 140, alignItems: 'center', justifyContent: 'center' }}>
      {[140, 100].map((size) => (
        <View key={size} style={{ position: 'absolute', width: size, height: size, borderRadius: size, borderWidth: 0.5, borderColor: theme.colors.border }} />
      ))}
      <RadarCore />
    </View>
  );

  return (
    <ScreenShell style={{ gap: 0 }} contentStyle={{ paddingHorizontal: 0, paddingTop: 0, paddingBottom: 0 }}>
      <SafeAreaView edges={['top', 'left', 'right', 'bottom']} style={{ flex: 1, backgroundColor: theme.colors.background }}>
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 32 }}>

          {/* Top bar */}
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingTop: 14 }}>
            <Pressable
              onPress={() => {
                if (scanStage === 'results') {
                  setDevices([]);
                  setScanStage('ready');
                }

                if (router.canGoBack()) {
                  router.back();
                  return;
                }

                router.replace('/');
              }}
              style={({ pressed }) => ({
                width: 36, height: 36, borderRadius: 10, borderWidth: 1, borderColor: theme.colors.border,
                backgroundColor: theme.colors.surface, alignItems: 'center', justifyContent: 'center',
                opacity: pressed ? 0.7 : 1,
              })}
            >
              <Ionicons name="chevron-back" size={18} color={theme.colors.text} />
            </Pressable>
            <View style={{ alignItems: 'flex-end' }}>
              <Text style={{ fontSize: 17, fontFamily: theme.font.bold, color: theme.colors.text }}>Conectare BLE</Text>
              <Text style={{ fontSize: 11, fontFamily: theme.font.medium, color: theme.colors.textSoft, marginTop: 1 }}>
                {isConnected
                  ? 'Dispozitiv conectat'
                  : scanStage === 'scanning'
                    ? 'Scanare în desfășurare…'
                    : scanStage === 'results'
                      ? `${devices.length} dispozitive găsite`
                      : 'Nicio scanare activă'}
              </Text>
            </View>
          </View>

          {isConnected && (
            <Card>
              <View style={{ padding: 16, gap: 12, backgroundColor: 'rgba(26,188,82,0.06)', borderTopWidth: 1, borderTopColor: 'rgba(26,188,82,0.22)' }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: 'rgba(26,188,82,0.12)', borderWidth: 1, borderColor: 'rgba(26,188,82,0.35)', borderRadius: 999, paddingHorizontal: 10, paddingVertical: 5 }}>
                    <View style={{ width: 7, height: 7, borderRadius: 99, backgroundColor: theme.colors.success }} />
                    <Text style={{ fontSize: 12, fontFamily: theme.font.bold, color: theme.colors.success }}>CONECTAT</Text>
                  </View>
                  <View style={{ width: 34, height: 34, borderRadius: 10, backgroundColor: 'rgba(26,188,82,0.12)', alignItems: 'center', justifyContent: 'center' }}>
                    <Ionicons name={isStreamLive ? 'radio-outline' : 'checkmark-circle-outline'} size={18} color={theme.colors.success} />
                  </View>
                </View>

                <View>
                  <Text style={{ fontSize: 16, fontFamily: theme.font.bold, color: theme.colors.text }}>
                    {connectedDeviceName ?? 'Dispozitiv BLE'}
                  </Text>
                  <Text numberOfLines={1} style={{ fontSize: 11, fontFamily: theme.font.mono, color: theme.colors.textSoft, marginTop: 2 }}>
                    ID: {connectedDeviceId ?? '--'}
                  </Text>
                </View>

                <View style={{ backgroundColor: theme.colors.surfaceRaised, borderWidth: 1, borderColor: theme.colors.border, borderRadius: 14, padding: 12, gap: 8 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                    <Text style={{ fontSize: 12, fontFamily: theme.font.medium, color: theme.colors.textSoft }}>Stare flux</Text>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                      <View style={{ width: 7, height: 7, borderRadius: 99, backgroundColor: streamStateColor }} />
                      <Text style={{ fontSize: 12, fontFamily: theme.font.bold, color: streamStateColor }}>{streamStateLabel}</Text>
                    </View>
                  </View>

                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 8 }}>
                    <View style={{ flex: 1, backgroundColor: theme.colors.surface, borderRadius: 10, borderWidth: 1, borderColor: theme.colors.border, padding: 8 }}>
                      <Text style={{ fontSize: 10, fontFamily: theme.font.medium, color: theme.colors.textSoft }}>Conectat la</Text>
                      <Text style={{ fontSize: 12, fontFamily: theme.font.bold, color: theme.colors.text, marginTop: 2 }}>{connectedAtLabel}</Text>
                    </View>

                    <View style={{ flex: 1, backgroundColor: theme.colors.surface, borderRadius: 10, borderWidth: 1, borderColor: theme.colors.border, padding: 8 }}>
                      <Text style={{ fontSize: 10, fontFamily: theme.font.medium, color: theme.colors.textSoft }}>Ultimul pachet</Text>
                      <Text style={{ fontSize: 12, fontFamily: theme.font.bold, color: theme.colors.text, marginTop: 2 }}>{lastPacketLabel}</Text>
                    </View>
                  </View>

                  <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                    <Text style={{ fontSize: 10, fontFamily: theme.font.medium, color: theme.colors.textSoft }}>Sursa date</Text>
                    <Text style={{ fontSize: 11, fontFamily: theme.font.bold, color: theme.colors.text }}>{dataSourceLabel}</Text>
                  </View>
                </View>

                <Text style={{ fontSize: 11, fontFamily: theme.font.medium, color: theme.colors.textSoft }}>
                  {streamLabel}
                </Text>

                <View style={{ flexDirection: 'row' }}>
                  <Pressable
                    onPress={handleDisconnect}
                    style={({ pressed }) => ({
                      flex: 1,
                      height: 40,
                      paddingHorizontal: 12,
                      borderRadius: 12,
                      borderWidth: 1.5,
                      borderColor: 'rgba(222,83,67,0.4)',
                      backgroundColor: 'rgba(222,83,67,0.10)',
                      flexDirection: 'row',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: 6,
                      opacity: pressed ? 0.75 : 1,
                    })}
                  >
                    <Ionicons name="close-circle-outline" size={16} color={theme.colors.error} />
                    <Text style={{ color: theme.colors.error, fontSize: 13, fontFamily: theme.font.bold }}>Deconecteaza dispozitivul</Text>
                  </Pressable>
                </View>

              </View>
            </Card>
          )}

          {/* ── READY STATE ─────────────────────────────────────────────── */}
          {!isConnected && scanStage === 'ready' && (
            <Card>
              {/* Radar + heading */}
              <View style={{ alignItems: 'center', paddingTop: 28, paddingBottom: 20, paddingHorizontal: 24, gap: 18 }}>
                <RadarRings />
                <View style={{ alignItems: 'center', gap: 6 }}>
                  <Text style={{ fontSize: 18, fontFamily: theme.font.bold, color: theme.colors.text, textAlign: 'center' }}>
                    Conectează dispozitivul ESP32
                  </Text>
                  <Text style={{ fontSize: 12, fontFamily: theme.font.medium, color: theme.colors.textSoft, textAlign: 'center', lineHeight: 17, maxWidth: 240 }}>
                    Scanare BLE reală — conectează-te la orice dispozitiv detectat în apropiere.
                  </Text>
                </View>
              </View>

              {/* Params accordion */}
              <Pressable
                onPress={() => { LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut); setIsParamsExpanded((p) => !p); }}
                style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 13, borderTopWidth: 1, borderTopColor: theme.colors.border }}
              >
                <View>
                  <Text style={{ fontSize: 14, fontFamily: theme.font.bold, color: theme.colors.text }}>Parametri scanare</Text>
                  <Text style={{ fontSize: 11, fontFamily: theme.font.medium, color: theme.colors.textSoft, marginTop: 2 }}>{paramsHint}</Text>
                </View>
                <View style={{ width: 30, height: 30, borderRadius: 9, backgroundColor: theme.colors.surface, borderWidth: 1, borderColor: theme.colors.border, alignItems: 'center', justifyContent: 'center' }}>
                  <Ionicons name={isParamsExpanded ? 'chevron-up' : 'chevron-down'} size={15} color={theme.colors.text} />
                </View>
              </Pressable>

              {isParamsExpanded && (
                <View style={{ paddingHorizontal: 16, paddingBottom: 14, gap: 14, borderTopWidth: 1, borderTopColor: theme.colors.border }}>
                  <View style={{ marginTop: 14 }}>
                    <Text style={{ fontSize: 11, fontFamily: theme.font.medium, color: theme.colors.textSoft, marginBottom: 8 }}>Tip filtrare</Text>
                    <View style={{ flexDirection: 'row', gap: 8 }}>
                      {[{ key: true, label: 'Doar ESP32/C3' }, { key: false, label: 'Toate BLE' }].map(({ key, label }) => (
                        <Pressable key={String(key)} onPress={() => setEsp32Only(key)}
                          style={{ paddingHorizontal: 14, paddingVertical: 8, borderRadius: 99, backgroundColor: esp32Only === key ? theme.colors.primary : theme.colors.surfaceMuted, borderWidth: 1, borderColor: esp32Only === key ? theme.colors.primary : theme.colors.border }}
                        >
                          <Text style={{ fontSize: 12, fontFamily: theme.font.bold, color: esp32Only === key ? '#fff' : theme.colors.textSoft }}>{label}</Text>
                        </Pressable>
                      ))}
                    </View>
                  </View>
                  <View>
                    <Text style={{ fontSize: 11, fontFamily: theme.font.medium, color: theme.colors.textSoft, marginBottom: 8 }}>Durata scanare</Text>
                    <View style={{ flexDirection: 'row', gap: 8 }}>
                      {[3000, 6000, 12000].map((d) => (
                        <Pressable key={d} onPress={() => setScanDurationMs(d)} style={{ flex: 1, height: 38, borderRadius: 10, backgroundColor: scanDurationMs === d ? theme.colors.primary : theme.colors.surfaceMuted, borderWidth: 1, borderColor: scanDurationMs === d ? theme.colors.primary : theme.colors.border, alignItems: 'center', justifyContent: 'center' }}>
                          <Text style={{ fontSize: 13, fontFamily: theme.font.bold, color: scanDurationMs === d ? '#fff' : theme.colors.textSoft }}>{d / 1000}s</Text>
                        </Pressable>
                      ))}
                    </View>
                  </View>
                </View>
              )}

              {/* Error banner */}
              {scanError && (
                <View style={{ marginHorizontal: 16, marginBottom: 8, borderRadius: 12, borderWidth: 1, borderColor: 'rgba(232,64,64,0.24)', backgroundColor: 'rgba(232,64,64,0.09)', padding: 12, flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <Ionicons name="alert-circle-outline" size={16} color={theme.colors.error} />
                  <Text style={{ flex: 1, fontSize: 12, fontFamily: theme.font.medium, color: theme.colors.error }}>{scanError}</Text>
                </View>
              )}

              {/* CTA */}
              <View style={{ padding: 16, borderTopWidth: 1, borderTopColor: theme.colors.border }}>
                <Pressable onPress={handleScan}
                  style={({ pressed }) => ({ height: 50, borderRadius: 14, backgroundColor: '#F26A2D', alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 8, opacity: pressed ? 0.85 : 1 })}
                >
                  <Ionicons name="search-outline" size={18} color="#fff" />
                  <Text style={{ color: '#fff', fontSize: 16, fontFamily: theme.font.bold }}>Scanează BLE</Text>
                </Pressable>
                <Text style={{ textAlign: 'center', fontSize: 11, fontFamily: theme.font.medium, color: theme.colors.textSoft, marginTop: 8 }}>
                  {lastScanAt ? `Ultima scanare: ${lastScanAt.toLocaleTimeString('ro-RO')}` : 'Nu a fost rulată nicio scanare în această sesiune.'}
                </Text>
              </View>
            </Card>
          )}

          {/* ── SCANNING STATE ───────────────────────────────────────────── */}
          {!isConnected && scanStage === 'scanning' && (
            <Card>
              <View style={{ alignItems: 'center', paddingTop: 28, paddingBottom: 20, paddingHorizontal: 24, gap: 18 }}>
                <View style={{ width: 140, height: 140, alignItems: 'center', justifyContent: 'center' }}>
                  {[140, 100].map((size) => (
                    <View key={size} style={{ position: 'absolute', width: size, height: size, borderRadius: size, borderWidth: 0.5, borderColor: theme.colors.border }} />
                  ))}
                  {/* Pulse ring */}
                  <Animated.View style={{ position: 'absolute', width: 110, height: 110, borderRadius: 55, borderWidth: 1.5, borderColor: theme.colors.primary, transform: [{ scale: pulseScale }], opacity: pulseOpacity }} />
                  {/* Sweep */}
                  <Animated.View style={{ position: 'absolute', width: 132, height: 132, borderRadius: 66, transform: [{ rotate: sweepRotation }] }}>
                    <Svg width={132} height={132} viewBox="0 0 132 132">
                      <Defs>
                        <LinearGradient id="sweep" x1="66" y1="66" x2="66" y2="8" gradientUnits="userSpaceOnUse">
                          <Stop offset="0" stopColor="rgba(242,106,45,0)" stopOpacity="0" />
                          <Stop offset="1" stopColor="#F26A2D" stopOpacity="0.25" />
                        </LinearGradient>
                      </Defs>
                      <Path d="M66 66 L55 10 A57 57 0 0 1 77 10 Z" fill="url(#sweep)" />
                    </Svg>
                  </Animated.View>
                  <RadarCore />
                </View>
                <View style={{ alignItems: 'center', gap: 6 }}>
                  <Text style={{ fontSize: 18, fontFamily: theme.font.bold, color: theme.colors.text, textAlign: 'center' }}>
                    Se caută dispozitive BLE
                  </Text>
                  <Text style={{ fontSize: 12, fontFamily: theme.font.medium, color: theme.colors.textSoft, textAlign: 'center', lineHeight: 17 }}>
                    Menține Bluetooth activ și dispozitivul aproape în timpul scanării.
                  </Text>
                </View>
              </View>

              {/* Step checklist */}
              <View style={{ paddingHorizontal: 16, paddingBottom: 20, gap: 12, borderTopWidth: 1, borderTopColor: theme.colors.border, paddingTop: 16 }}>
                {[
                  { label: 'Permisiunile Bluetooth au fost verificate.', done: true },
                  { label: 'Se scanează pachetele de advertising din apropiere.', done: true },
                  { label: 'Se pregătește lista dispozitivelor detectate.', done: false },
                ].map((step) => (
                  <View key={step.label} style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                    <View style={{ width: 22, height: 22, borderRadius: 11, alignItems: 'center', justifyContent: 'center', backgroundColor: step.done ? 'rgba(26,188,82,0.12)' : 'transparent', borderWidth: 1, borderColor: step.done ? 'rgba(26,188,82,0.45)' : theme.colors.border }}>
                      {step.done
                        ? <Ionicons name="checkmark" size={13} color={theme.colors.success} />
                        : <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: theme.colors.muted }} />
                      }
                    </View>
                    <Text style={{ flex: 1, fontSize: 13, fontFamily: theme.font.medium, color: theme.colors.text }}>{step.label}</Text>
                  </View>
                ))}
              </View>
            </Card>
          )}

          {/* ── RESULTS STATE ────────────────────────────────────────────── */}
          {!isConnected && scanStage === 'results' && (
            <Card animated animStyle={{ transform: [{ translateY: sheetTranslateY }], opacity: sheetOpacity }}>
              {/* Header */}
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, padding: 16, borderBottomWidth: 1, borderBottomColor: theme.colors.border }}>
                <View style={{ width: 38, height: 38, borderRadius: 11, backgroundColor: 'rgba(242,106,45,0.10)', borderWidth: 1, borderColor: 'rgba(242,106,45,0.25)', alignItems: 'center', justifyContent: 'center' }}>
                  <Ionicons name="bluetooth-outline" size={20} color={theme.colors.primary} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 17, fontFamily: theme.font.bold, color: theme.colors.text }}>Dispozitive găsite</Text>
                  <Text style={{ fontSize: 11, fontFamily: theme.font.medium, color: theme.colors.textSoft, marginTop: 2 }}>
                    {devices.length === 0 ? 'Niciunul detectat' : `${devices.length} ${devices.length === 1 ? 'dispozitiv' : 'dispozitive'} · Atinge pentru împerechere`}
                  </Text>
                </View>
              </View>

              {/* Empty state */}
              {devices.length === 0 ? (
                <View style={{ alignItems: 'center', padding: 28, gap: 12 }}>
                  <View style={{ width: 64, height: 64, borderRadius: 32, backgroundColor: theme.colors.surfaceAlt, borderWidth: 1, borderColor: theme.colors.border, alignItems: 'center', justifyContent: 'center' }}>
                    <Ionicons name="bluetooth-outline" size={28} color={theme.colors.primary} />
                  </View>
                  <Text style={{ fontSize: 13, fontFamily: theme.font.medium, color: theme.colors.textSoft, textAlign: 'center', maxWidth: 240 }}>
                    Nu au fost găsite dispozitive BLE în intervalul de scanare selectat.
                  </Text>
                </View>
              ) : (
                devices.map((device, i) => {
                  const signal = getSignalStrength(device.rssi);
                  const isConnecting = connectingDeviceId === device.id;
                  const isConnectedDevice = isConnected && (device.id === connectedDeviceId || device.isConnected);
                  const isTop = i === 0;
                  return (
                    <View key={`${device.id}-${i}`} style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 13, paddingHorizontal: 16, borderBottomWidth: 1, borderBottomColor: theme.colors.border, backgroundColor: isTop ? 'rgba(242,106,45,0.04)' : 'transparent' }}>
                      <View style={{ width: 40, height: 40, borderRadius: 12, backgroundColor: 'rgba(242,106,45,0.10)', alignItems: 'center', justifyContent: 'center' }}>
                        <Ionicons name="bluetooth-outline" size={18} color={theme.colors.primary} />
                      </View>
                      <View style={{ flex: 1, minWidth: 0 }}>
                        <Text numberOfLines={1} style={{ fontSize: 14, fontFamily: theme.font.bold, color: theme.colors.text }}>{device.name}</Text>
                        <Text numberOfLines={1} style={{ fontSize: 11, fontFamily: theme.font.mono, color: theme.colors.textSoft, marginTop: 1 }}>{device.id}</Text>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 4 }}>
                          {renderSignalBars(signal.bars, signal.color)}
                          <Text style={{ fontSize: 11, fontFamily: theme.font.medium, color: theme.colors.textSoft }}>{signal.label} · {device.rssi} dBm</Text>
                        </View>
                      </View>
                      <Pressable onPress={() => handleConnect(device.id)} disabled={isConnecting || isConnectedDevice}
                        style={{
                          height: 36,
                          paddingHorizontal: 14,
                          borderRadius: 99,
                          backgroundColor: isConnectedDevice ? theme.colors.success : isConnecting ? theme.colors.muted : '#F26A2D',
                          flexDirection: 'row',
                          alignItems: 'center',
                          gap: 5,
                        }}
                      >
                        {isConnecting
                          ? <ActivityIndicator size="small" color="#fff" />
                          : <>
                              <Text style={{ color: '#fff', fontSize: 13, fontFamily: theme.font.bold }}>
                                {isConnectedDevice ? 'Conectat' : 'Conectează'}
                              </Text>
                              <Ionicons name={isConnectedDevice ? 'checkmark' : 'chevron-forward'} size={13} color="#fff" />
                            </>
                        }
                      </Pressable>
                    </View>
                  );
                })
              )}

              {/* Rescan */}
              <View style={{ padding: 14 }}>
                <Pressable onPress={() => { setDevices([]); setConnectingDeviceId(null); setScanStage('ready'); }}
                  style={({ pressed }) => ({ height: 44, borderRadius: 12, borderWidth: 1, borderColor: theme.colors.border, backgroundColor: theme.colors.surface, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, opacity: pressed ? 0.7 : 1 })}
                >
                  <Ionicons name="refresh-outline" size={16} color={theme.colors.text} />
                  <Text style={{ fontSize: 14, fontFamily: theme.font.bold, color: theme.colors.text }}>Scanare nouă</Text>
                </Pressable>
              </View>
            </Card>
          )}

        </ScrollView>
      </SafeAreaView>
    </ScreenShell>
  );
}
