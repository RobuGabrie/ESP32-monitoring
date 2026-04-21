import { useEffect, useRef, useState } from 'react';
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
  Text,
  UIManager,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import Svg, { Defs, LinearGradient, Path, Stop } from 'react-native-svg';

import { useAppTheme } from '@/hooks/useAppTheme';
import { useConnectivity } from '@/hooks/useConnectivity';

interface BLEDevice {
  id: string;
  name: string;
  rssi: number;
  isConnected: boolean;
}

const normalizeDevices = (raw: BLEDevice[]) => {
  const dedupe = new Map<string, BLEDevice>();
  raw.forEach((device) => {
    if (!device?.id) return;
    const id = device.id.trim();
    if (!id) return;
    dedupe.set(id, {
      ...device,
      id,
      name: device.name?.trim() ? device.name.trim() : 'Dispozitiv BLE fără nume',
      rssi: Number.isFinite(device.rssi) ? device.rssi : -99,
      isConnected: Boolean(device.isConnected),
    });
  });
  return Array.from(dedupe.values()).sort((a, b) => b.rssi - a.rssi);
};

export default function ConnectScreen() {
  const { theme } = useAppTheme();
  const { connectivityState, connect, disconnect, scanDevices, startupConnectionState } = useConnectivity();
  const router = useRouter();
  const isAndroid = Platform.OS === 'android';

  const [scanStage, setScanStage] = useState<'ready' | 'scanning' | 'results'>('ready');
  const [devices, setDevices] = useState<BLEDevice[]>([]);
  const [scanDurationMs, setScanDurationMs] = useState(6000);
  const [esp32Only, setEsp32Only] = useState(true);
  const [isParamsExpanded, setIsParamsExpanded] = useState(false);
  const [scanError, setScanError] = useState<string | null>(null);
  const [connectingDeviceId, setConnectingDeviceId] = useState<string | null>(null);

  const sweepAnim = useRef(new Animated.Value(0)).current;
  const pulseAnim = useRef(new Animated.Value(0)).current;
  const listAnim = useRef(new Animated.Value(0)).current;

  const isConnected = connectivityState.connectionStatus === 'online';

  useEffect(() => {
    if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
      UIManager.setLayoutAnimationEnabledExperimental(true);
    }
  }, []);

  useEffect(() => {
    if (scanStage !== 'scanning') {
      sweepAnim.stopAnimation();
      sweepAnim.setValue(0);
      pulseAnim.stopAnimation();
      pulseAnim.setValue(0);
      return;
    }
    Animated.loop(Animated.timing(sweepAnim, { toValue: 1, duration: 2200, easing: Easing.linear, useNativeDriver: true })).start();
    Animated.loop(Animated.timing(pulseAnim, { toValue: 1, duration: 1600, easing: Easing.out(Easing.quad), useNativeDriver: true })).start();
  }, [scanStage, pulseAnim, sweepAnim]);

  useEffect(() => {
    if (scanStage !== 'results') {
      listAnim.setValue(0);
      return;
    }
    Animated.spring(listAnim, { toValue: 1, useNativeDriver: true, tension: 70, friction: 10 }).start();
  }, [listAnim, scanStage]);

  const sweepRotation = sweepAnim.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] });
  const pulseScale = pulseAnim.interpolate({ inputRange: [0, 1], outputRange: [0.85, 1.35] });
  const pulseOpacity = pulseAnim.interpolate({ inputRange: [0, 1], outputRange: [0.35, 0] });
  const listTranslateY = listAnim.interpolate({ inputRange: [0, 1], outputRange: [80, 0] });

  const handleScan = async () => {
    setScanError(null);
    setDevices([]);
    setScanStage('scanning');
    try {
      const found = await scanDevices(
        isAndroid ? { esp32Only, scanDurationMs, allowDuplicates: false, namePrefixes: ['ESP32', 'ESP32-C3', 'C3', 'Skydiver', 'skywatch'] } : undefined
      );
      setDevices(normalizeDevices(found as BLEDevice[]));
      setScanStage('results');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Nu s-a putut realiza scanarea.';
      setScanError(message);
      setScanStage('ready');
      if (message.toLowerCase().includes('turned off') || message.toLowerCase().includes('powered off')) {
        Alert.alert('Bluetooth este oprit', 'Pornește Bluetooth, apoi încearcă din nou.', [
          { text: 'Deschide setări', onPress: () => Linking.openSettings().catch(() => {}) },
          { text: 'OK', style: 'cancel' },
        ]);
      }
    }
  };

  const handleConnect = async (deviceId: string) => {
    setConnectingDeviceId(deviceId);
    try {
      const success = await connect(deviceId);
      if (success) {
        router.replace('/');
      } else {
        Alert.alert('Conectare eșuată', 'Nu s-a putut stabili conexiunea.');
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'A apărut o eroare la conectare.';
      Alert.alert('Conectare eșuată', message);
    } finally {
      setConnectingDeviceId(null);
    }
  };

  const handleDisconnect = () => {
    disconnect();
    setDevices((prev) => prev.map((d) => ({ ...d, isConnected: false })));
    setScanStage('ready');
  };

  const getSignalStrength = (rssi: number) => {
    if (rssi >= -52) return { label: 'Excelent', color: '#2FCFB4', bars: 4 };
    if (rssi >= -62) return { label: 'Bun', color: '#2FCFB4', bars: 3 };
    if (rssi >= -72) return { label: 'Mediu', color: '#FFB547', bars: 2 };
    return { label: 'Slab', color: '#FF5D7C', bars: 1 };
  };

  return (
    <View style={{ flex: 1, backgroundColor: '#0F1726' }}>
      <SafeAreaView edges={['top', 'left', 'right', 'bottom']} style={{ flex: 1 }}>
        <View style={{ position: 'absolute', left: -80, top: -120, width: 320, height: 320, borderRadius: 300, backgroundColor: 'rgba(47,207,180,0.18)' }} />
        <View style={{ position: 'absolute', right: -120, top: 120, width: 340, height: 340, borderRadius: 300, backgroundColor: 'rgba(66,141,255,0.14)' }} />

        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 20 }}>
          <View style={{ paddingHorizontal: 18, paddingTop: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
            <Pressable
              onPress={() => {
                if (router.canGoBack()) router.back();
                else router.replace('/start');
              }}
              style={{ width: 36, height: 36, borderRadius: 12, backgroundColor: 'rgba(255,255,255,0.12)', alignItems: 'center', justifyContent: 'center' }}
            >
              <Ionicons name="chevron-back" size={18} color="#fff" />
            </Pressable>

            <View style={{ alignItems: 'center' }}>
              <Text style={{ color: '#fff', fontSize: 16, fontFamily: theme.font.bold }}>Conectare BLE</Text>
              <Text style={{ color: 'rgba(255,255,255,0.65)', fontSize: 11, fontFamily: theme.font.medium }}>
                {scanStage === 'scanning' ? 'Scanare în curs' : scanStage === 'results' ? `${devices.length} dispozitive` : 'Pregătit de scanare'}
              </Text>
            </View>

            <View style={{ width: 36 }} />
          </View>

          {!isConnected && (
            <View style={{ marginTop: 16, marginHorizontal: 16, borderRadius: 28, backgroundColor: 'rgba(14,25,40,0.82)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.12)', overflow: 'hidden' }}>
              {scanStage === 'ready' && (
                <>
                  <View style={{ paddingHorizontal: 22, paddingTop: 26, paddingBottom: 20, alignItems: 'center', gap: 14 }}>
                    <View style={{ width: 140, height: 140, alignItems: 'center', justifyContent: 'center' }}>
                      {[140, 102].map((size) => (
                        <View key={size} style={{ position: 'absolute', width: size, height: size, borderRadius: size, borderWidth: 1, borderColor: 'rgba(255,255,255,0.2)' }} />
                      ))}
                      <View style={{ width: 58, height: 58, borderRadius: 30, backgroundColor: 'rgba(47,207,180,0.20)', borderWidth: 1, borderColor: 'rgba(47,207,180,0.45)', alignItems: 'center', justifyContent: 'center' }}>
                        <Ionicons name="bluetooth-outline" size={26} color="#2FCFB4" />
                      </View>
                    </View>
                    <Text style={{ color: '#fff', fontSize: 21, fontFamily: theme.font.bold, textAlign: 'center' }}>
                      Scanează și alege dispozitivul
                    </Text>
                    <Text style={{ color: 'rgba(255,255,255,0.72)', fontSize: 13, lineHeight: 19, textAlign: 'center', fontFamily: theme.font.medium }}>
                      {startupConnectionState.hasRememberedDevice
                        ? 'Ai un dispozitiv memorat, dar selecția rămâne manuală din listă.'
                        : 'Pornim scanarea BLE și apoi alegi manual dispozitivul dorit.'}
                    </Text>
                  </View>

                  <Pressable
                    onPress={() => {
                      LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
                      setIsParamsExpanded((value) => !value);
                    }}
                    style={{ borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.12)', paddingHorizontal: 16, paddingVertical: 13, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}
                  >
                    <View>
                      <Text style={{ color: '#fff', fontSize: 14, fontFamily: theme.font.bold }}>Parametri scanare</Text>
                      <Text style={{ color: 'rgba(255,255,255,0.62)', fontSize: 11, fontFamily: theme.font.medium }}>{esp32Only ? 'Doar ESP32/C3' : 'Toate BLE'} · {scanDurationMs / 1000}s</Text>
                    </View>
                    <Ionicons name={isParamsExpanded ? 'chevron-up' : 'chevron-down'} size={18} color="#fff" />
                  </Pressable>

                  {isParamsExpanded && (
                    <View style={{ borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.10)', paddingHorizontal: 16, paddingTop: 12, paddingBottom: 14, gap: 12 }}>
                      <View style={{ flexDirection: 'row', gap: 8 }}>
                        {[{ label: 'Doar ESP32/C3', value: true }, { label: 'Toate BLE', value: false }].map((option) => (
                          <Pressable
                            key={option.label}
                            onPress={() => setEsp32Only(option.value)}
                            style={{ flex: 1, paddingVertical: 10, borderRadius: 12, borderWidth: 1, borderColor: esp32Only === option.value ? 'rgba(47,207,180,0.5)' : 'rgba(255,255,255,0.20)', backgroundColor: esp32Only === option.value ? 'rgba(47,207,180,0.16)' : 'rgba(255,255,255,0.08)', alignItems: 'center' }}
                          >
                            <Text style={{ color: '#fff', fontSize: 12, fontFamily: theme.font.bold }}>{option.label}</Text>
                          </Pressable>
                        ))}
                      </View>
                      <View style={{ flexDirection: 'row', gap: 8 }}>
                        {[3000, 6000, 12000].map((duration) => (
                          <Pressable
                            key={duration}
                            onPress={() => setScanDurationMs(duration)}
                            style={{ flex: 1, paddingVertical: 10, borderRadius: 12, borderWidth: 1, borderColor: scanDurationMs === duration ? 'rgba(47,207,180,0.5)' : 'rgba(255,255,255,0.20)', backgroundColor: scanDurationMs === duration ? 'rgba(47,207,180,0.16)' : 'rgba(255,255,255,0.08)', alignItems: 'center' }}
                          >
                            <Text style={{ color: '#fff', fontSize: 12, fontFamily: theme.font.bold }}>{duration / 1000}s</Text>
                          </Pressable>
                        ))}
                      </View>
                    </View>
                  )}

                  {scanError && (
                    <View style={{ marginHorizontal: 16, marginBottom: 10, borderRadius: 12, padding: 10, backgroundColor: 'rgba(255,93,124,0.15)', borderWidth: 1, borderColor: 'rgba(255,93,124,0.3)' }}>
                      <Text style={{ color: '#FFD2DC', fontSize: 12, fontFamily: theme.font.medium }}>{scanError}</Text>
                    </View>
                  )}

                  <View style={{ padding: 16, borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.12)' }}>
                    <Pressable
                      onPress={handleScan}
                      style={({ pressed }) => ({
                        height: 54,
                        borderRadius: 999,
                        backgroundColor: '#2FCFB4',
                        alignItems: 'center',
                        justifyContent: 'center',
                        flexDirection: 'row',
                        gap: 8,
                        opacity: pressed ? 0.85 : 1,
                      })}
                    >
                      <Ionicons name="radio-outline" size={19} color="#fff" />
                      <Text style={{ color: '#fff', fontSize: 15, fontFamily: theme.font.bold }}>Începe scanarea BLE</Text>
                    </Pressable>
                  </View>
                </>
              )}

              {scanStage === 'scanning' && (
                <View style={{ paddingHorizontal: 20, paddingVertical: 28, alignItems: 'center' }}>
                  <View style={{ width: 150, height: 150, alignItems: 'center', justifyContent: 'center' }}>
                    {[150, 108].map((size) => (
                      <View key={size} style={{ position: 'absolute', width: size, height: size, borderRadius: size, borderWidth: 1, borderColor: 'rgba(255,255,255,0.2)' }} />
                    ))}
                    <Animated.View style={{ position: 'absolute', width: 114, height: 114, borderRadius: 57, borderWidth: 1.5, borderColor: '#2FCFB4', transform: [{ scale: pulseScale }], opacity: pulseOpacity }} />
                    <Animated.View style={{ position: 'absolute', width: 138, height: 138, borderRadius: 70, transform: [{ rotate: sweepRotation }] }}>
                      <Svg width={138} height={138} viewBox="0 0 138 138">
                        <Defs>
                          <LinearGradient id="sweepBle" x1="69" y1="69" x2="69" y2="8" gradientUnits="userSpaceOnUse">
                            <Stop offset="0" stopColor="rgba(47,207,180,0)" />
                            <Stop offset="1" stopColor="rgba(47,207,180,0.38)" />
                          </LinearGradient>
                        </Defs>
                        <Path d="M69 69 L57 10 A59 59 0 0 1 81 10 Z" fill="url(#sweepBle)" />
                      </Svg>
                    </Animated.View>
                    <View style={{ width: 60, height: 60, borderRadius: 30, backgroundColor: 'rgba(47,207,180,0.20)', borderWidth: 1, borderColor: 'rgba(47,207,180,0.45)', alignItems: 'center', justifyContent: 'center' }}>
                      <Ionicons name="bluetooth-outline" size={26} color="#2FCFB4" />
                    </View>
                  </View>
                  <Text style={{ color: '#fff', fontSize: 19, marginTop: 18, fontFamily: theme.font.bold }}>Scanare în desfășurare</Text>
                  <Text style={{ color: 'rgba(255,255,255,0.7)', fontSize: 13, marginTop: 6, textAlign: 'center', fontFamily: theme.font.medium }}>
                    Căutăm dispozitive BLE din proximitate...
                  </Text>
                </View>
              )}

              {scanStage === 'results' && (
                <Animated.View style={{ transform: [{ translateY: listTranslateY }], opacity: listAnim }}>
                  <View style={{ padding: 16, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.12)' }}>
                    <Text style={{ color: '#fff', fontSize: 18, fontFamily: theme.font.bold }}>Dispozitive găsite</Text>
                    <Text style={{ color: 'rgba(255,255,255,0.65)', fontSize: 12, fontFamily: theme.font.medium, marginTop: 2 }}>
                      Selectează dispozitivul și apasă conectare.
                    </Text>
                  </View>

                  {devices.length === 0 ? (
                    <View style={{ padding: 24, alignItems: 'center', gap: 8 }}>
                      <Ionicons name="bluetooth-outline" size={28} color="rgba(255,255,255,0.64)" />
                      <Text style={{ color: 'rgba(255,255,255,0.8)', fontSize: 13, fontFamily: theme.font.medium }}>Nu am găsit dispozitive BLE.</Text>
                    </View>
                  ) : (
                    devices.map((device, index) => {
                      const signal = getSignalStrength(device.rssi);
                      const isConnecting = connectingDeviceId === device.id;
                      return (
                        <View key={`${device.id}-${index}`} style={{ paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.10)', flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                          <View style={{ width: 40, height: 40, borderRadius: 12, backgroundColor: 'rgba(47,207,180,0.15)', alignItems: 'center', justifyContent: 'center' }}>
                            <Ionicons name="bluetooth-outline" size={18} color="#2FCFB4" />
                          </View>
                          <View style={{ flex: 1, minWidth: 0 }}>
                            <Text numberOfLines={1} style={{ color: '#fff', fontSize: 14, fontFamily: theme.font.bold }}>{device.name}</Text>
                            <Text numberOfLines={1} style={{ color: 'rgba(255,255,255,0.6)', fontSize: 11, fontFamily: theme.font.mono, marginTop: 1 }}>{device.id}</Text>
                            <Text style={{ color: signal.color, fontSize: 11, fontFamily: theme.font.bold, marginTop: 2 }}>{signal.label} · {device.rssi} dBm</Text>
                          </View>
                          <Pressable
                            onPress={() => handleConnect(device.id)}
                            disabled={isConnecting}
                            style={{ height: 36, borderRadius: 999, paddingHorizontal: 14, alignItems: 'center', justifyContent: 'center', backgroundColor: isConnecting ? 'rgba(255,255,255,0.28)' : '#2FCFB4' }}
                          >
                            {isConnecting ? <ActivityIndicator color="#fff" /> : <Text style={{ color: '#fff', fontSize: 12, fontFamily: theme.font.bold }}>Conectează</Text>}
                          </Pressable>
                        </View>
                      );
                    })
                  )}

                  <View style={{ padding: 16, flexDirection: 'row', gap: 10 }}>
                    <Pressable
                      onPress={() => {
                        setScanStage('ready');
                        setDevices([]);
                      }}
                      style={{ flex: 1, height: 44, borderRadius: 12, borderWidth: 1, borderColor: 'rgba(255,255,255,0.2)', backgroundColor: 'rgba(255,255,255,0.08)', alignItems: 'center', justifyContent: 'center' }}
                    >
                      <Text style={{ color: '#fff', fontSize: 13, fontFamily: theme.font.bold }}>Înapoi</Text>
                    </Pressable>
                    <Pressable onPress={handleScan} style={{ flex: 1, height: 44, borderRadius: 12, backgroundColor: '#2FCFB4', alignItems: 'center', justifyContent: 'center' }}>
                      <Text style={{ color: '#fff', fontSize: 13, fontFamily: theme.font.bold }}>Scanează din nou</Text>
                    </Pressable>
                  </View>
                </Animated.View>
              )}
            </View>
          )}

          {isConnected && (
            <View style={{ marginTop: 16, marginHorizontal: 16, borderRadius: 24, backgroundColor: 'rgba(14,25,40,0.82)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.12)', padding: 16, gap: 10 }}>
              <Text style={{ color: '#fff', fontSize: 18, fontFamily: theme.font.bold }}>Dispozitiv conectat</Text>
              <Text style={{ color: 'rgba(255,255,255,0.7)', fontSize: 13, fontFamily: theme.font.medium }}>
                {connectivityState.deviceName ?? 'ESP32'} este conectat. Poți intra în dashboard.
              </Text>
              <View style={{ flexDirection: 'row', gap: 10 }}>
                <Pressable onPress={handleDisconnect} style={{ flex: 1, height: 44, borderRadius: 12, borderWidth: 1, borderColor: 'rgba(255,93,124,0.35)', backgroundColor: 'rgba(255,93,124,0.16)', alignItems: 'center', justifyContent: 'center' }}>
                  <Text style={{ color: '#FFD2DC', fontSize: 13, fontFamily: theme.font.bold }}>Deconectează</Text>
                </Pressable>
                <Pressable onPress={() => router.replace('/')} style={{ flex: 1, height: 44, borderRadius: 12, backgroundColor: '#2FCFB4', alignItems: 'center', justifyContent: 'center' }}>
                  <Text style={{ color: '#fff', fontSize: 13, fontFamily: theme.font.bold }}>Dashboard</Text>
                </Pressable>
              </View>
            </View>
          )}
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}
