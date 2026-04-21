import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
  Animated,
  Dimensions,
  Image,
  PanResponder,
  Pressable,
  ScrollView,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRouter } from 'expo-router';
import { useTelemetry } from '@/hooks/TelemetryContext';
import { useAppTheme } from '@/hooks/useAppTheme';
import { useConnectivity } from '@/hooks/useConnectivity';

const { width: SCREEN_W } = Dimensions.get('window');
// ~2.6 cards visible at once
const CARD_W = (SCREEN_W - 32 - 20) / 2.6;
const CARD_GAP = 8;

// ─── helpers ──────────────────────────────────────────────
function fv(v: number | null | undefined, digits = 0, suffix = '') {
  if (v == null || !Number.isFinite(v)) return '—';
  return `${v.toFixed(digits)}${suffix}`;
}

function formatTimer(ms: number) {
  const s = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  if (h > 0)
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
  return `${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
}

// ─── StatusBadge ──────────────────────────────────────────
function StatusBadge({ label, active }: { label: string; active: boolean }) {
  return (
    <View style={{
      flexDirection: 'row', alignItems: 'center', gap: 5,
      paddingHorizontal: 9, paddingVertical: 4, borderRadius: 999,
      backgroundColor: active ? 'rgba(47,207,180,0.13)' : '#E8E9EE',
      borderWidth: 1, borderColor: active ? 'rgba(47,207,180,0.28)' : 'transparent',
    }}>
      <View style={{ width: 5, height: 5, borderRadius: 3, backgroundColor: active ? '#2FCFB4' : '#9DA3B4' }} />
      <Text style={{ fontSize: 10, fontWeight: '800', color: active ? '#2FCFB4' : '#9DA3B4', letterSpacing: 0.3 }}>
        {label}
      </Text>
    </View>
  );
}

// ─── SensorCard (compact) ─────────────────────────────────
type SensorCardProps = {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  value: string;
  unit?: string;
  accent: string;
  barPercent?: number;
  delay?: number;
};

function SensorCard({ icon, label, value, unit, accent, barPercent, delay = 0 }: SensorCardProps) {
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(12)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, { toValue: 1, duration: 380, delay, useNativeDriver: true }),
      Animated.timing(slideAnim, { toValue: 0, duration: 340, delay, useNativeDriver: true }),
    ]).start();
  }, []);

  return (
    <Animated.View style={{
      opacity: fadeAnim,
      transform: [{ translateY: slideAnim }],
      width: CARD_W,
      backgroundColor: '#fff',
      borderRadius: 18,
      padding: 13,
      shadowColor: '#000',
      shadowOpacity: 0.06,
      shadowRadius: 10,
      shadowOffset: { width: 0, height: 4 },
      elevation: 3,
      marginRight: CARD_GAP,
    }}>
      <View style={{
        width: 30, height: 30, borderRadius: 10,
        backgroundColor: `${accent}18`,
        alignItems: 'center', justifyContent: 'center',
        marginBottom: 8,
      }}>
        <Ionicons name={icon} size={15} color={accent} />
      </View>

      <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 2 }}>
        <Text style={{ fontSize: 22, fontWeight: '900', color: '#171717', letterSpacing: -0.5, lineHeight: 24 }}>
          {value}
        </Text>
        {unit ? (
          <Text style={{ fontSize: 11, fontWeight: '600', color: '#9DA3B4', marginBottom: 1 }}>{unit}</Text>
        ) : null}
      </View>

      <Text style={{ fontSize: 10, fontWeight: '700', color: '#9DA3B4', marginTop: 2, textTransform: 'uppercase', letterSpacing: 0.5 }}>
        {label}
      </Text>

      {barPercent != null ? (
        <View style={{ marginTop: 8, height: 2, backgroundColor: '#EDEEF2', borderRadius: 2, overflow: 'hidden' }}>
          <View style={{ width: `${Math.min(100, Math.max(0, barPercent))}%`, height: '100%', backgroundColor: accent, borderRadius: 2 }} />
        </View>
      ) : null}
    </Animated.View>
  );
}

// ─── PositionRow ──────────────────────────────────────────
const POSITIONS = [
  { key: 'freefall', icon: 'arrow-down' as const, ro: 'Cădere liberă' , accent: '#FF5D7C' },
  { key: 'glide',    icon: 'navigate'   as const, ro: 'Planare',       accent: '#2FCFB4' },
  { key: 'tracking', icon: 'compass'    as const, ro: 'Urmărire'   , accent: '#4B9EFF' },
  { key: 'upright',  icon: 'person'     as const, ro: 'Vertical'      , accent: '#A78BFA' },
];

function PositionRow({ active }: { active: string }) {
  return (
    <View style={{ flexDirection: 'row', gap: 7 }}>
      {POSITIONS.map((p) => {
        const on = p.key === active;
        return (
          <View key={p.key} style={{
            flex: 1,
            backgroundColor: on ? `${p.accent}12` : '#fff',
            borderRadius: 16,
            borderWidth: 1,
            borderColor: on ? `${p.accent}38` : '#E8E9EE',
            padding: 9, alignItems: 'center', gap: 5,
          }}>
            <View style={{
              width: 22, height: 12, borderRadius: 9,
              backgroundColor: on ? `${p.accent}18` : '#F2F3F7',
              alignItems: 'center', justifyContent: 'center',
            }}>
              <Ionicons name={p.icon} size={13} color={on ? p.accent : '#9DA3B4'} />
            </View>
            <Text style={{ fontSize: 10, fontWeight: '800', color: on ? p.accent : '#9DA3B4', textAlign: 'center', lineHeight: 12 }}>
              {p.ro}
            </Text>
          
          </View>
        );
      })}
    </View>
  );
}

// ─── JumpTimerModal ───────────────────────────────────────
function JumpTimerModal({
  visible, elapsed, countdown, onStop,
}: { visible: boolean; elapsed: number; countdown: number | null; onStop: () => void; }) {
  const overlayAnim = useRef(new Animated.Value(0)).current;
  const cardAnim    = useRef(new Animated.Value(80)).current;
  const swipeY      = useRef(new Animated.Value(0)).current;
  const pulseAnim   = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    const loop = Animated.loop(Animated.sequence([
      Animated.timing(pulseAnim, { toValue: 1.15, duration: 850, useNativeDriver: true }),
      Animated.timing(pulseAnim, { toValue: 1,    duration: 850, useNativeDriver: true }),
    ]));
    loop.start();
    return () => loop.stop();
  }, []);

  useEffect(() => {
    if (visible) {
      swipeY.setValue(0);
      Animated.parallel([
        Animated.timing(overlayAnim, { toValue: 1, duration: 300, useNativeDriver: true }),
        Animated.spring(cardAnim, { toValue: 0, tension: 75, friction: 11, useNativeDriver: true }),
      ]).start();
    } else {
      Animated.parallel([
        Animated.timing(overlayAnim, { toValue: 0, duration: 200, useNativeDriver: true }),
        Animated.timing(cardAnim, { toValue: 80, duration: 200, useNativeDriver: true }),
      ]).start();
    }
  }, [visible]);

  const pan = useRef(PanResponder.create({
    onStartShouldSetPanResponder: () => true,
    onMoveShouldSetPanResponder: (_, gs) => Math.abs(gs.dy) > 4,
    onPanResponderMove: (_, gs) => { if (gs.dy > 0) swipeY.setValue(gs.dy); },
    onPanResponderRelease: (_, gs) => {
      if (gs.dy > 90) { onStop(); }
      else { Animated.spring(swipeY, { toValue: 0, tension: 120, friction: 8, useNativeDriver: true }).start(); }
    },
  })).current;

  if (!visible) return null;

  return (
    <Animated.View style={{
      position: 'absolute', left: 0, right: 0, top: 0, bottom: 0,
      backgroundColor: 'rgba(8,10,16,0.86)',
      opacity: overlayAnim,
      alignItems: 'center', justifyContent: 'flex-end', paddingBottom: 36,
    }}>
      <Animated.View {...pan.panHandlers} style={{
        transform: [{ translateY: Animated.add(cardAnim, swipeY) }],
        width: SCREEN_W - 28,
        backgroundColor: '#fff',
        borderRadius: 30, padding: 24, alignItems: 'center',
        shadowColor: '#000', shadowOpacity: 0.3, shadowRadius: 44,
        shadowOffset: { width: 0, height: 18 }, elevation: 22,
      }}>
        {/* Handle */}
        <View style={{ width: 36, height: 4, borderRadius: 2, backgroundColor: '#EDEEF2', marginBottom: 20 }} />

        {countdown != null && countdown > 0 ? (
          <>
            <Text style={{ fontSize: 11, fontWeight: '800', letterSpacing: 3, color: '#9DA3B4', textTransform: 'uppercase', marginBottom: 16 }}>
              Pregătire salt
            </Text>
            <Animated.View style={{
              transform: [{ scale: pulseAnim }],
              width: 106, height: 106, borderRadius: 53,
              backgroundColor: 'rgba(47,207,180,0.11)',
              alignItems: 'center', justifyContent: 'center', marginBottom: 10,
            }}>
              <Text style={{ fontSize: 66, fontWeight: '900', color: '#2FCFB4', lineHeight: 74 }}>{countdown}</Text>
            </Animated.View>
            <Text style={{ fontSize: 13, color: '#9DA3B4', fontWeight: '600', marginTop: 6 }}>
              Inițializare senzori…
            </Text>
            <Pressable onPress={onStop} style={{
              marginTop: 20, paddingHorizontal: 28, paddingVertical: 12,
              borderRadius: 999, backgroundColor: '#F2F3F7',
            }}>
              <Text style={{ fontSize: 13, fontWeight: '800', color: '#9DA3B4' }}>Anulează</Text>
            </Pressable>
          </>
        ) : (
          <>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 4 }}>
              <View style={{ width: 7, height: 7, borderRadius: 4, backgroundColor: '#2FCFB4' }} />
              <Text style={{ fontSize: 11, fontWeight: '800', color: '#2FCFB4', letterSpacing: 2, textTransform: 'uppercase' }}>
                Salt activ
              </Text>
            </View>

            <Text style={{ fontSize: 56, fontWeight: '900', color: '#171717', letterSpacing: -2, lineHeight: 64, marginBottom: 2 }}>
              {formatTimer(elapsed)}
            </Text>

            <Text style={{ fontSize: 12, fontWeight: '600', color: '#9DA3B4', marginBottom: 20 }}>
              Flux BLE activ · Glisează în jos pentru a opri
            </Text>

            <View style={{ flexDirection: 'row', gap: 7, width: '100%', marginBottom: 22 }}>
              {[
                { label: 'Altitudine', value: '3840 m', accent: '#2FCFB4' },
                { label: 'Puls',       value: '118 bpm', accent: '#FF5D7C' },
                { label: 'SpO₂',       value: '96%',    accent: '#4B9EFF' },
              ].map((s) => (
                <View key={s.label} style={{ flex: 1, backgroundColor: '#F5F6F9', borderRadius: 13, padding: 10, alignItems: 'center' }}>
                  <Text style={{ fontSize: 15, fontWeight: '900', color: s.accent }}>{s.value}</Text>
                  <Text style={{ fontSize: 10, fontWeight: '700', color: '#9DA3B4', marginTop: 2 }}>{s.label}</Text>
                </View>
              ))}
            </View>

            <View style={{ alignItems: 'center', gap: 3 }}>
              <Ionicons name="chevron-down" size={18} color="#C8CDD8" />
              <Text style={{ fontSize: 11, color: '#C8CDD8', fontWeight: '600' }}>Glisează în jos pentru a opri</Text>
            </View>
          </>
        )}
      </Animated.View>
    </Animated.View>
  );
}

// ─── DashboardScreen ──────────────────────────────────────
export default function DashboardScreen() {
  const { theme } = useAppTheme();
  const {
    currentData, connectivityState, diveSessionState,
    startupConnectionState, startDiveSession, stopDiveSession, sendCommand,
  } = useConnectivity();
  const router = useRouter();

 const { startTrackingSession, stopTrackingSession, isTracking } = useTelemetry();

  const handleStartTimer = async () => {
    // Start your timer logic here
    await startTrackingSession();
  };

  const handleStopTimer = async () => {
    // Stop your timer logic here
    await stopTrackingSession();
  };
  const [nowMs, setNowMs]                     = useState(() => Date.now());
  const [jumpActionLoading, setJumpActionLoading] = useState(false);
  const [countdown, setCountdown]             = useState<number | null>(null);
  const [modalVisible, setModalVisible]       = useState(false);

  const scrollX  = useRef(new Animated.Value(0)).current;
  const heroFade = useRef(new Animated.Value(0)).current;
  const heroSlide = useRef(new Animated.Value(20)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(heroFade,  { toValue: 1, duration: 480, delay: 60, useNativeDriver: true }),
      Animated.timing(heroSlide, { toValue: 0, duration: 420, delay: 60, useNativeDriver: true }),
    ]).start();
  }, []);

  const isBleOnline   = connectivityState.connectionStatus === 'online';
  const hasWifiBridge = connectivityState.lastDataSource === 'mqtt';
  const signalBars    = currentData?.rssi != null
    ? (currentData.rssi >= -55 ? 4 : currentData.rssi >= -65 ? 3 : currentData.rssi >= -75 ? 2 : 1) : 0;

  const sessionStartMs   = diveSessionState.sessionId
    ? Number(/^dive-(\d+)-/.exec(diveSessionState.sessionId)?.[1] ?? 0) : 0;
  const sessionElapsedMs = diveSessionState.isActive && sessionStartMs ? nowMs - sessionStartMs : 0;

  const stressPercent = useMemo(() => {
    const hr = currentData?.heartRate;
    if (hr == null || !Number.isFinite(hr)) return 42;
    return Math.max(20, Math.min(95, Math.round((hr / 180) * 100)));
  }, [currentData]);

  const stressLabel = stressPercent < 40 ? 'Scăzut' : stressPercent < 70 ? 'Moderat' : 'Ridicat';
  const stressColor = stressPercent < 40 ? '#2FCFB4' : stressPercent < 70 ? '#FFB547' : '#FF5D7C';

  const sensorCards = [
    { icon: 'layers-outline'       as const, label: 'Altitudine',     value: currentData?.posZ != null ? fv(currentData.posZ, 0) : '3840', unit: 'm',   accent: '#2FCFB4', barPercent: Math.min(100, ((currentData?.posZ ?? 3840) / 5000) * 100) },
    { icon: 'heart-outline'        as const, label: 'Puls',           value: fv(currentData?.heartRate ?? 118, 0),                          unit: 'bpm', accent: '#FF5D7C', barPercent: Math.min(100, ((currentData?.heartRate ?? 118) / 200) * 100) },
    { icon: 'water-outline'        as const, label: 'SpO₂',           value: fv(96, 0),                                unit: '%',   accent: '#4B9EFF', barPercent: 96 },
    { icon: 'thermometer-outline'  as const, label: 'Temperatură',    value: fv(currentData?.temp ?? 36.8, 1),                              unit: '°C',  accent: '#FFB547', barPercent: Math.min(100, (((currentData?.temp ?? 36.8) - 35) / 5) * 100) },
    { icon: 'battery-half-outline' as const, label: 'Baterie',        value: fv(currentData?.batteryPercent ?? 73, 0),                      unit: '%',   accent: (currentData?.batteryPercent ?? 73) < 20 ? '#FF5D7C' : '#2FCFB4', barPercent: currentData?.batteryPercent ?? 73 },
    { icon: 'speedometer-outline'  as const, label: 'Viteză cădere',  value: fv(Math.abs(currentData?.velZ ?? 12), 1),                      unit: 'm/s', accent: '#A78BFA', barPercent: Math.min(100, (Math.abs(currentData?.velZ ?? 12) / 60) * 100) },
  ];

  useEffect(() => {
    const t = setInterval(() => setNowMs(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    let mounted = true;
    if (startupConnectionState.checkingRememberedDevice || startupConnectionState.isAutoReconnectRunning) return;
    AsyncStorage.getItem('app.start.completed').then((v) => { if (!mounted || v) return; router.replace('/start'); });
    return () => { mounted = false; };
  }, [router, startupConnectionState.checkingRememberedDevice, startupConnectionState.isAutoReconnectRunning]);

  useEffect(() => {
    if (countdown == null || countdown <= 0) return;
    const t = setTimeout(() => setCountdown((c) => (c == null ? null : c - 1)), 1000);
    return () => clearTimeout(t);
  }, [countdown]);

  useEffect(() => {
    if (countdown !== 0) return;
    const run = async () => {
      try {
        await startDiveSession();
        await sendCommand('START');
      } catch (error) {
        Alert.alert('Eroare pornire', error instanceof Error ? error.message : 'Salt neinițiat.');
        setModalVisible(false);
      } finally { setCountdown(null); setJumpActionLoading(false); }
    };
    void run();
  }, [countdown, sendCommand, startDiveSession]);

  const doStop = async () => {
    setJumpActionLoading(true);
    try {
      await sendCommand('STOP');
      await stopDiveSession();
    } catch (error) {
      Alert.alert('Eroare oprire', error instanceof Error ? error.message : 'Oprire eșuată.');
    } finally { setModalVisible(false); setJumpActionLoading(false); }
  };

  const handleStartStopJump = async () => {
    if (jumpActionLoading || countdown != null) return;
    if (diveSessionState.isActive) { setModalVisible(true); return; }
    setJumpActionLoading(true);
    setModalVisible(true);
    setCountdown(3);
  };

  const handleModalStop = () => {
    if (countdown != null && countdown > 0) { setCountdown(null); setJumpActionLoading(false); setModalVisible(false); }
    else { void doStop(); }
  };

  return (
    <View style={{ flex: 1, backgroundColor: '#EDEEF2' }}>
      <SafeAreaView edges={['top', 'left', 'right', 'bottom']} style={{ flex: 1 }}>
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 32 }}>

          {/* ── Header ── */}
          <View style={{
            flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
            paddingHorizontal: 16, paddingTop: 10, paddingBottom: 10,
          }}>
            <View>
              <Text style={{ fontSize: 20, fontWeight: '900', color: '#171717', letterSpacing: -0.4 }}>
                Monitor Salt
              </Text>
              <View style={{ flexDirection: 'row', gap: 5, marginTop: 5 }}>
                <StatusBadge label="BLE Activ" active={isBleOnline} />
                <StatusBadge label="Wi-Fi Punte" active={hasWifiBridge} />
              </View>
            </View>

            {/* GPS + Settings */}
            <View style={{ flexDirection: 'row', gap: 8 }}>
              <Pressable
                onPress={() => router.push('/telemetrie')}
                style={({ pressed }) => ({
                  width: 40, height: 40, borderRadius: 13,
                  backgroundColor: pressed ? '#D8F5F1' : '#fff',
                  alignItems: 'center', justifyContent: 'center',
                  shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 8, elevation: 2,
                })}>
                <Ionicons name="navigate" size={18} color="#2FCFB4" />
              </Pressable>
              <Pressable
                onPress={() => router.push('/settings')}
                style={({ pressed }) => ({
                  width: 40, height: 40, borderRadius: 13,
                  backgroundColor: pressed ? '#EDEEF2' : '#fff',
                  alignItems: 'center', justifyContent: 'center',
                  shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 8, elevation: 2,
                })}>
                <Ionicons name="settings-outline" size={18} color="#555B6E" />
              </Pressable>
            </View>
          </View>

          {/* ── Hero card ── */}
          <Animated.View style={{
            opacity: heroFade, transform: [{ translateY: heroSlide }],
            marginHorizontal: 16, borderRadius: 26, overflow: 'hidden', height: 200,
            shadowColor: '#000', shadowOpacity: 0.13, shadowRadius: 22,
            shadowOffset: { width: 0, height: 8 }, elevation: 7,
          }}>
            <Image
              source={require('../../assets/splash.png')}
              resizeMode="cover"
              style={{ width: '100%', height: '100%' }}
            />
            <View style={{ position: 'absolute', inset: 0, backgroundColor: 'rgba(0,0,0,0.20)' }} />
            <View style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: 110, backgroundColor: 'rgba(0,0,0,0.52)' }} />

            {/* LIVE badge */}
            <View style={{
              position: 'absolute', top: 12, right: 12,
              flexDirection: 'row', alignItems: 'center', gap: 4,
              backgroundColor: '#2FCFB4', paddingHorizontal: 9, paddingVertical: 4, borderRadius: 999,
            }}>
              <View style={{ width: 5, height: 5, borderRadius: 3, backgroundColor: '#fff' }} />
              <Text style={{ color: '#fff', fontSize: 10, fontWeight: '800', letterSpacing: 0.5 }}>LIVE</Text>
            </View>

            {/* Signal bars in hero */}
            <View style={{ position: 'absolute', top: 12, left: 12, flexDirection: 'row', alignItems: 'flex-end', gap: 2 }}>
              {[1, 2, 3, 4].map((b) => (
                <View key={b} style={{
                  width: 3, height: b * 4, borderRadius: 2,
                  backgroundColor: signalBars >= b ? '#2FCFB4' : 'rgba(255,255,255,0.3)',
                }} />
              ))}
            </View>

            <View style={{ position: 'absolute', left: 16, bottom: 14 }}>
              <Text style={{ color: '#fff', fontSize: 18, fontWeight: '900', lineHeight: 22, letterSpacing: -0.3 }}>
                Gabriel M.{' '}
                <Text style={{ fontSize: 13, fontWeight: '600', opacity: 0.75 }}>
                  {diveSessionState.sessionId ? `#${diveSessionState.sessionId.split('-')[1]}` : '#Salt 47'}
                </Text>
              </Text>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3, marginTop: 3 }}>
                <Ionicons name="location" size={10} color="rgba(255,255,255,0.7)" />
                <Text style={{ color: 'rgba(255,255,255,0.7)', fontSize: 11, fontWeight: '600' }}>
                  Zonă parașutism Alpin, România
                </Text>
              </View>
            </View>
          </Animated.View>

          

          {/* ── Poziție parașutist ── */}
          <View style={{ paddingHorizontal: 16, marginTop: 18 }}>
            <Text style={{ fontSize: 11, fontWeight: '800', color: '#9DA3B4', textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 9 }}>
              Poziție parașutist
            </Text>
            <PositionRow active="glide" />
          </View>

          {/* ── Nivel stres ── */}
          <View style={{ paddingHorizontal: 16, marginTop: 10 }}>
            <View style={{
              backgroundColor: '#fff', borderRadius: 16, padding: 13,
              borderWidth: 1, borderColor: '#E8E9EE',
              
            }}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 9 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <Ionicons name="pulse-outline" size={14} color={stressColor} />
                  <Text style={{ fontSize: 12, fontWeight: '800', color: '#555B6E' }}>Nivel stres estimat</Text>
                </View>
                <Text style={{ fontSize: 12, fontWeight: '900', color: stressColor }}>
                  {stressLabel} · {stressPercent}%
                </Text>
              </View>
              <View style={{ height: 5, backgroundColor: '#EDEEF2', borderRadius: 3, overflow: 'hidden' }}>
                <View style={{ width: `${stressPercent}%`, height: '100%', backgroundColor: stressColor, borderRadius: 3 }} />
              </View>
              
         
            </View>
            <View>
            <Text
            style={{ fontSize: 11, fontWeight: '600', color: '#9DA3B4', marginTop: 6, paddingHorizontal:10 }}
            >
              Nivelul de stres estimativ trebuie sa fie sub 70% pentru a avea un salt în siguranță.
            </Text>
            </View>
          </View>

          {/* ── Acțiuni ── */}
          <View style={{ flexDirection: 'row', gap: 10, paddingHorizontal: 16, marginTop: 16 }}>
            {/* Favorite / salvare sesiune */}
            <Pressable style={({ pressed }) => ({
              width: 52, height: 52, borderRadius: 16,
              backgroundColor: pressed ? '#FFE8EE' : '#fff',
              alignItems: 'center', justifyContent: 'center',
              shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 8, elevation: 2,
            })}>
              <Ionicons name="heart" size={20} color="#FF5D7C" />
            </Pressable>

            {/* Start / Stop salt */}
            <Pressable
              onPress={handleStartStopJump}
              disabled={jumpActionLoading}
              style={({ pressed }) => ({
                flex: 1, height: 52, borderRadius: 16,
                backgroundColor: diveSessionState.isActive ? '#FF5D7C' : '#2FCFB4',
                alignItems: 'center', justifyContent: 'center',
                opacity: pressed || jumpActionLoading ? 0.88 : 1,
                shadowColor: diveSessionState.isActive ? '#FF5D7C' : '#2FCFB4',
                shadowOpacity: 0.32, shadowRadius: 16,
                shadowOffset: { width: 0, height: 6 }, elevation: 7,
              })}>
              <Text style={{ color: '#fff', fontSize: 14, fontWeight: '900', letterSpacing: 0.2 }}>
                {jumpActionLoading ? '…' : diveSessionState.isActive ? 'Oprește saltul' : 'Pornește saltul'}
              </Text>
            </Pressable>

           
          </View>
          {/* ── Sensor Cards ── */}
          <View style={{ marginTop: 16 }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16, marginBottom: 9 }}>
              <Text style={{ fontSize: 11, fontWeight: '800', color: '#9DA3B4', textTransform: 'uppercase', letterSpacing: 0.8 }}>
                Date senzori
              </Text>
              <Text style={{ fontSize: 10, fontWeight: '600', color: '#C0C4D0' }}>← Glisează</Text>
            </View>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              decelerationRate="fast"
              snapToInterval={CARD_W + CARD_GAP}
              snapToAlignment="start"
              contentContainerStyle={{ paddingLeft: 16, paddingRight: 8, paddingBottom: 4 }}
              onScroll={Animated.event(
                [{ nativeEvent: { contentOffset: { x: scrollX } } }],
                { useNativeDriver: false }
              )}
              scrollEventThrottle={16}>
              {sensorCards.map((card, i) => (
                <SensorCard key={card.label} {...card} delay={i * 55} />
              ))}
            </ScrollView>

            {/* Indicator dots */}
            <View style={{ flexDirection: 'row', justifyContent: 'center', gap: 4, marginTop: 9 }}>
              {sensorCards.map((_, i) => {
                const range = [(i - 1) * (CARD_W + CARD_GAP), i * (CARD_W + CARD_GAP), (i + 1) * (CARD_W + CARD_GAP)];
                const w  = scrollX.interpolate({ inputRange: range, outputRange: [5, 14, 5], extrapolate: 'clamp' });
                const bg = scrollX.interpolate({ inputRange: range, outputRange: ['#D0D6E2', '#2FCFB4', '#D0D6E2'], extrapolate: 'clamp' });
                return <Animated.View key={i} style={{ width: w, height: 4, borderRadius: 2, backgroundColor: bg }} />;
              })}
            </View>
          </View>

        </ScrollView>
      </SafeAreaView>

      {/* ── Modal timer salt ── */}
      <JumpTimerModal
        visible={modalVisible || diveSessionState.isActive}
        elapsed={sessionElapsedMs}
        countdown={countdown}
        onStop={handleModalStop}
      />
    </View>
  );
}