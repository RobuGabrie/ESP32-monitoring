import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';

import { ScreenShell } from '@/components/ScreenShell';
import { useAppTheme } from '@/hooks/useAppTheme';
import { useConnectivity } from '@/hooks/useConnectivity';

function ActionButton({
  label,
  icon,
  onPress,
  size = 'large',
  tone = 'primary',
  loading = false,
}: {
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  onPress: () => void;
  size?: 'large' | 'small';
  tone?: 'primary' | 'danger' | 'neutral';
  loading?: boolean;
}) {
  const { theme } = useAppTheme();
  const isSmall = size === 'small';

  const backgroundColor = tone === 'danger'
    ? theme.colors.error
    : tone === 'neutral'
      ? theme.colors.surface
      : theme.colors.primary;
  const textColor = tone === 'neutral' ? theme.colors.text : '#fff';

  return (
    <Pressable
      onPress={onPress}
      disabled={loading}
      style={({ pressed }) => ({
        width: isSmall ? undefined : '100%',
        minHeight: isSmall ? 38 : 66,
        paddingHorizontal: isSmall ? 12 : 20,
        paddingVertical: isSmall ? 8 : 14,
        borderRadius: isSmall ? 14 : 22,
        backgroundColor,
        borderWidth: tone === 'neutral' ? 1 : 0,
        borderColor: tone === 'neutral' ? theme.colors.border : 'transparent',
        alignItems: 'center',
        justifyContent: 'center',
        flexDirection: 'row',
        gap: 8,
        opacity: pressed || loading ? 0.88 : 1,
        ...(tone === 'neutral' ? theme.shadow.card : theme.shadow.floating)
      })}
    >
      {loading ? <ActivityIndicator size="small" color={textColor} /> : <Ionicons name={icon} size={isSmall ? 15 : 20} color={textColor} />}
      <Text style={{ color: textColor, fontFamily: theme.font.bold, fontSize: isSmall ? 12 : 18 }}>{label}</Text>
    </Pressable>
  );
}

function MetricCard({ icon, label, value, note, tone = 'neutral' }: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  value: string;
  note: string;
  tone?: 'neutral' | 'warning' | 'success' | 'danger' | 'info';
}) {
  const { theme } = useAppTheme();

  const toneStyles = {
    neutral: { bg: theme.accents.neutral, color: theme.colors.text },
    warning: { bg: theme.accents.warning, color: theme.colors.warning },
    success: { bg: theme.accents.success, color: theme.colors.success },
    danger: { bg: 'rgba(222,83,67,0.12)', color: theme.colors.error },
    info: { bg: 'rgba(15,142,207,0.12)', color: theme.colors.info }
  }[tone];

  return (
    <View
      style={{
        flex: 1,
        minHeight: 138,
        backgroundColor: theme.colors.surfaceRaised,
        borderRadius: 24,
        borderWidth: 1,
        borderColor: theme.colors.border,
        padding: 14,
        gap: 10,
        ...theme.shadow.card
      }}
    >
      <View
        style={{
          width: 40,
          height: 40,
          borderRadius: 14,
          backgroundColor: toneStyles.bg,
          alignItems: 'center',
          justifyContent: 'center'
        }}
      >
        <Ionicons name={icon} size={18} color={toneStyles.color} />
      </View>
      <View style={{ flex: 1, justifyContent: 'space-between' }}>
        <View>
          <Text style={{ color: theme.colors.textSoft, fontSize: 12, fontFamily: theme.font.medium }}>{label}</Text>
          <Text style={{ color: theme.colors.text, fontSize: 28, lineHeight: 32, fontFamily: theme.font.bold, marginTop: 4 }} numberOfLines={1}>
            {value}
          </Text>
        </View>
        <Text style={{ color: theme.colors.textSoft, fontSize: 12, fontFamily: theme.font.medium }}>{note}</Text>
      </View>
    </View>
  );
}

function formatReading(value: number | null | undefined, fractionDigits = 0, suffix = '') {
  if (value == null || !Number.isFinite(value)) {
    return '—';
  }

  return `${value.toFixed(fractionDigits)}${suffix}`;
}

function formatDateTimeLabel(value?: string | number | null) {
  if (!value) {
    return 'Nicio recepție încă';
  }

  const date = typeof value === 'number' ? new Date(value) : new Date(value);
  if (Number.isNaN(date.getTime())) {
    return 'Nicio recepție încă';
  }

  return date.toLocaleString('ro-RO', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit'
  });
}

function getSessionStartMs(sessionId: string | null): number | null {
  if (!sessionId) {
    return null;
  }

  const match = /^dive-(\d+)-/.exec(sessionId);
  if (!match) {
    return null;
  }

  const timestamp = Number(match[1]);
  return Number.isFinite(timestamp) ? timestamp : null;
}

function formatSessionTimer(elapsedMs: number) {
  const safeMs = Math.max(0, elapsedMs);
  const totalSeconds = Math.floor(safeMs / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  if (hours > 0) {
    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds
      .toString()
      .padStart(2, '0')}`;
  }

  return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
}
function InfoRow({ label, value }: { label: string; value: string }) {
  const { theme } = useAppTheme();

  return (
    <View
      style={{
        width: '49%',
        backgroundColor: theme.colors.surface,
        borderRadius: 20,
        borderWidth: 1,
        borderColor: theme.colors.border,
        padding: 14,
        gap: 6,
        marginBottom: 12
      }}
    >
      <Text style={{ color: theme.colors.textSoft, fontSize: 11, fontFamily: theme.font.medium }}>{label}</Text>
      <Text style={{ color: theme.colors.text, fontSize: 15, fontFamily: theme.font.bold }} numberOfLines={1}>
        {value}
      </Text>
    </View>
  );
}

export default function GatewayScreen() {
  const { theme } = useAppTheme();
  const router = useRouter();
  const { currentData, connectivityState, diveSessionState, startDiveSession, stopDiveSession, sendCommand } = useConnectivity();
  const [sessionActionLoading, setSessionActionLoading] = useState(false);
  const [resetActionLoading, setResetActionLoading] = useState(false);
  const [sessionNowMs, setSessionNowMs] = useState(() => Date.now());
  const [telemetryNowMs, setTelemetryNowMs] = useState(() => Date.now());

  const isOnline = connectivityState.connectionStatus === 'online';
  const hasTelemetry = !!connectivityState.lastDataReceived;
  const lastDataAgeMs = connectivityState.lastDataReceived
    ? Math.max(0, telemetryNowMs - connectivityState.lastDataReceived.getTime())
    : null;
  const isTelemetryLive = connectivityState.dataStreamStatus === 'live';
  const isAwaitingTelemetry = isOnline && connectivityState.dataStreamStatus === 'waiting';
  const isTelemetryStale = isOnline && connectivityState.dataStreamStatus === 'stale';
  const batteryPercent = currentData?.batteryPercent;
  const batteryStatusTone = batteryPercent == null ? 'neutral' : batteryPercent <= 20 ? 'danger' : batteryPercent <= 45 ? 'warning' : 'success';
  const statusLabel = !isOnline
    ? 'Așteaptă conectarea BLE'
    : isAwaitingTelemetry
      ? 'BLE conectat - așteaptă date'
      : isTelemetryStale
        ? 'BLE conectat - flux întrerupt'
        : 'BLE live - date în timp real';
  const latestPacketLabel = useMemo(() => formatDateTimeLabel(currentData?.recordedAtMs ?? currentData?.timestamp), [currentData]);
  const sessionStartMs = useMemo(() => getSessionStartMs(diveSessionState.sessionId), [diveSessionState.sessionId]);
  const sessionElapsedMs = diveSessionState.isActive && sessionStartMs ? sessionNowMs - sessionStartMs : 0;
  const sessionTimer = formatSessionTimer(sessionElapsedMs);

  useEffect(() => {
    if (!diveSessionState.isActive) {
      setSessionNowMs(Date.now());
      return;
    }

    setSessionNowMs(Date.now());
    const timer = setInterval(() => {
      setSessionNowMs(Date.now());
    }, 1000);

    return () => clearInterval(timer);
  }, [diveSessionState.isActive, diveSessionState.sessionId]);

  useEffect(() => {
    if (!isOnline && !connectivityState.lastDataReceived) {
      setTelemetryNowMs(Date.now());
      return;
    }

    const timer = setInterval(() => {
      setTelemetryNowMs(Date.now());
    }, 1000);

    return () => clearInterval(timer);
  }, [isOnline, connectivityState.lastDataReceived]);

  const liveMetrics = useMemo(
    () => [
      {
        icon: 'thermometer-outline' as const,
        label: 'Temperatură',
        value: formatReading(currentData?.temp, 1, '°C'),
        note: 'Ultimul eșantion BLE',
        tone: 'warning' as const
      },
      {
        icon: 'pulse-outline' as const,
        label: 'Curent',
        value: formatReading(currentData?.current, 0, ' mA'),
        note: 'Măsurat de dispozitiv',
        tone: 'info' as const
      },
      {
        icon: 'flash-outline' as const,
        label: 'Putere',
        value: formatReading(currentData?.powerMw, 0, ' mW'),
        note: 'Consum instant',
        tone: 'neutral' as const
      },
      {
        icon: 'battery-half-outline' as const,
        label: 'Baterie',
        value: formatReading(batteryPercent, 0, '%'),
        note: batteryPercent == null ? 'Fără valoare primită' : 'Nivel raportat prin BLE',
        tone: batteryStatusTone
      },
      {
        icon: 'radio-outline' as const,
        label: 'Semnal',
        value: currentData?.rssi != null ? `${currentData.rssi.toFixed(0)} dBm` : '—',
        note: 'Intensitatea legăturii BLE',
        tone: isOnline ? 'success' as const : 'danger' as const
      },
      {
        icon: 'speedometer-outline' as const,
        label: 'CPU',
        value: formatReading(currentData?.cpu, 0, '%'),
        note: 'Încărcare raportată',
        tone: 'neutral' as const
      }
    ],
    [batteryPercent, batteryStatusTone, currentData, isOnline]
  );

  const detailRows = useMemo(
    () => [
      { label: 'Ultimul pachet', value: latestPacketLabel },
      { label: 'SSID', value: currentData?.ssid ?? '—' },
      { label: 'IP', value: currentData?.ip ?? '—' },
      { label: 'MAC', value: currentData?.mac ?? '—' },
      { label: 'Uptime', value: currentData?.uptime != null ? `${Math.floor(currentData.uptime / 60)} min` : '—' },
      { label: 'Lumină', value: currentData?.light != null ? `${currentData.light.toFixed(0)}` : '—' }
    ],
    [currentData, latestPacketLabel]
  );

  const handleDiveSessionToggle = async () => {
    setSessionActionLoading(true);
    try {
      if (diveSessionState.isActive) {
        await sendCommand('STOP');
        await stopDiveSession();
        Alert.alert('Sesiune încheiată', 'Datele saltului au fost salvate.');
        return;
      }

      await startDiveSession();
      try {
        await sendCommand('START');
      } catch {
        await stopDiveSession();
        throw new Error('stopwatch-start-failed');
      }
      Alert.alert('Sesiune pornită', 'Înregistrarea datelor pentru salt este activă.');
    } catch (error) {
      const message = error instanceof Error && error.message.trim()
        ? error.message
        : 'Nu s-a putut porni/opri sesiunea de salt.';
      Alert.alert('Eroare sesiune', message);
    } finally {
      setSessionActionLoading(false);
    }
  };

  const handleResetStopwatch = async () => {
    setResetActionLoading(true);
    try {
      await sendCommand('RESET');
      Alert.alert('Timer resetat', 'Cronometrul de pe ESP32 a fost resetat la 0.');
    } catch (error) {
      const message = error instanceof Error && error.message.trim()
        ? error.message
        : 'Nu s-a putut trimite comanda RESET către ESP32.';
      Alert.alert('Eroare reset', message);
    } finally {
      setResetActionLoading(false);
    }
  };

  return (
    <ScreenShell contentStyle={{ paddingHorizontal: 0, paddingTop: 0 }}>
      <SafeAreaView edges={['top', 'left', 'right']} style={{ flex: 1 }}>
        <ScrollView
          contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 8, paddingBottom: 24 }}
          showsVerticalScrollIndicator={false}
        >
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 18 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
              <View
                style={{
                  width: 36,
                  height: 36,
                  borderRadius: 12,
                  alignItems: 'center',
                  justifyContent: 'center',
                  backgroundColor: theme.colors.primary,
                  ...theme.shadow.card
                }}
              >
                <Text style={{ color: '#fff', fontSize: 16, fontFamily: theme.font.bold }}>g</Text>
              </View>
              <View>
                <Text style={{ color: theme.colors.text, fontSize: 20, fontFamily: theme.font.bold, letterSpacing: -0.4 }}>
                  skydiver.
                </Text>
                <Text style={{ color: theme.colors.textSoft, fontSize: 12, fontFamily: theme.font.medium }}>
                  {statusLabel}
                </Text>
              </View>
            </View>

            <View
              style={{
                width: 40,
                height: 40,
                borderRadius: 14,
                backgroundColor: theme.colors.surfaceRaised,
                borderWidth: 1,
                borderColor: theme.colors.border,
                alignItems: 'center',
                justifyContent: 'center',
                ...theme.shadow.card
              }}
            >
              <Ionicons name="bookmark-outline" size={18} color={theme.colors.text} />
            </View>
          </View>

          <View
            style={{
              backgroundColor: isTelemetryLive
                ? 'rgba(26,188,82,0.10)'
                : isAwaitingTelemetry
                  ? 'rgba(242,106,45,0.11)'
                  : isTelemetryStale
                    ? 'rgba(222,83,67,0.11)'
                    : theme.colors.surfaceRaised,
              borderRadius: 16,
              borderWidth: 1,
              borderColor: isTelemetryLive
                ? 'rgba(26,188,82,0.30)'
                : isAwaitingTelemetry
                  ? 'rgba(242,106,45,0.34)'
                  : isTelemetryStale
                    ? 'rgba(222,83,67,0.30)'
                    : theme.colors.border,
              paddingHorizontal: 14,
              paddingVertical: 11,
              marginBottom: 16,
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 10,
            }}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1 }}>
              <Ionicons
                name={isTelemetryLive ? 'radio-outline' : isTelemetryStale ? 'alert-circle-outline' : 'bluetooth-outline'}
                size={16}
                color={isTelemetryLive ? '#167a39' : isTelemetryStale ? theme.colors.error : theme.colors.primary}
              />
              <View style={{ flex: 1 }}>
                <Text style={{ color: theme.colors.text, fontSize: 13, fontFamily: theme.font.bold }} numberOfLines={1}>
                  {statusLabel}
                </Text>
                <Text style={{ color: theme.colors.textSoft, fontSize: 11, fontFamily: theme.font.medium }} numberOfLines={1}>
                  {!isOnline
                    ? 'Conectează dispozitivul ESP32 din pagina Conectare.'
                    : !hasTelemetry
                      ? 'Conexiune stabilită. Aștept primul pachet de telemetrie...'
                      : isTelemetryLive
                        ? `Ultimul pachet acum ${Math.round((lastDataAgeMs ?? 0) / 1000)}s`
                        : `Ultimul pachet primit acum ${Math.round((lastDataAgeMs ?? 0) / 1000)}s`}
                </Text>
              </View>
            </View>

            <Pressable
              onPress={() => router.push('/connect')}
              style={({ pressed }) => ({
                height: 34,
                paddingHorizontal: 12,
                borderRadius: 10,
                backgroundColor: theme.colors.surface,
                borderWidth: 1,
                borderColor: theme.colors.border,
                alignItems: 'center',
                justifyContent: 'center',
                opacity: pressed ? 0.75 : 1,
              })}
            >
              <Text style={{ color: theme.colors.text, fontSize: 12, fontFamily: theme.font.bold }}>
                {isOnline ? 'Gestioneaza BLE' : 'Conecteaza'}
              </Text>
            </Pressable>
          </View>

          <View
            style={{
              backgroundColor: theme.colors.surfaceRaised,
              borderRadius: 24,
              borderWidth: 1,
              borderColor: theme.colors.border,
              overflow: 'hidden',
              marginBottom: 20,
              marginTop: 0,
              ...theme.shadow.card
            }}
          >
            <View style={{ padding: 18, paddingBottom: 14, borderBottomWidth: 1, borderBottomColor: theme.colors.border }}>
              <View style={{ flexDirection: 'row', gap: 8, marginBottom: 14, justifyContent: 'center' }}>
                <View
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: 5,
                    backgroundColor: diveSessionState.isActive ? 'rgba(26,188,82,0.12)' : theme.colors.surface,
                    borderRadius: 999,
                    paddingHorizontal: 12,
                    paddingVertical: 5,
                    borderWidth: 1,
                    borderColor: theme.colors.border
                  }}
                >
                  <View
                    style={{
                      width: 6,
                      height: 6,
                      borderRadius: 3,
                      backgroundColor: diveSessionState.isActive ? '#1abc52' : theme.colors.textSoft
                    }}
                  />
                  <Text
                    style={{
                      fontSize: 11,
                      fontFamily: theme.font.bold,
                      color: diveSessionState.isActive ? '#167a39' : theme.colors.textSoft
                    }}
                  >
                    {diveSessionState.isActive ? 'Sesiune activa' : 'Sesiune inactiva'}
                  </Text>
                </View>

                {isOnline && (
                  <View
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      gap: 5,
                      backgroundColor: 'rgba(26,188,82,0.14)',
                      borderRadius: 999,
                      paddingHorizontal: 12,
                      paddingVertical: 5
                    }}
                  >
                    <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: '#1abc52' }} />
                    <Text style={{ fontSize: 11, fontFamily: theme.font.bold, color: '#167a39' }}>BLE live</Text>
                  </View>
                )}
              </View>

              <View style={{ alignItems: 'center', justifyContent: 'center' }}>
                <Text style={{ fontSize: 12, fontFamily: theme.font.bold, color: theme.colors.textSoft, letterSpacing: 0.9, marginBottom: 6 }}>
                  TIMP IN ZBOR
                </Text>

                <View
                  style={{
                    minWidth: 230,
                    borderRadius: 20,
                    borderWidth: 1,
                    borderColor: theme.colors.border,
                    backgroundColor: theme.colors.surface,
                    paddingVertical: 13,
                    paddingHorizontal: 18,
                    alignItems: 'center',
                    ...theme.shadow.card,
                  }}
                >
                  <Text style={{ fontSize: 62, lineHeight: 64, fontFamily: theme.font.mono, color: theme.colors.text, letterSpacing: -1.8 }}>
                    {sessionTimer}
                  </Text>
                  <Text style={{ fontSize: 11, color: theme.colors.textSoft, fontFamily: theme.font.medium, marginTop: 3 }}>
                    format mm:ss
                  </Text>
                </View>

                <View style={{ flexDirection: 'row', gap: 10, marginTop: 12, width: '100%' }}>
                  <View style={{ flex: 1, borderRadius: 14, borderWidth: 1, borderColor: theme.colors.border, backgroundColor: theme.colors.surface, paddingVertical: 8, paddingHorizontal: 10, alignItems: 'center' }}>
                    <Text style={{ fontSize: 10, color: theme.colors.textSoft, fontFamily: theme.font.medium }}>Altitudine est.</Text>
                    <Text style={{ fontSize: 19, fontFamily: theme.font.bold, color: theme.colors.text, marginTop: 1 }}>--</Text>
                  </View>
                  <View style={{ flex: 1, borderRadius: 14, borderWidth: 1, borderColor: theme.colors.border, backgroundColor: theme.colors.surface, paddingVertical: 8, paddingHorizontal: 10, alignItems: 'center' }}>
                    <Text style={{ fontSize: 10, color: theme.colors.textSoft, fontFamily: theme.font.medium }}>Viteza</Text>
                    <Text style={{ fontSize: 19, fontFamily: theme.font.bold, color: theme.colors.text, marginTop: 1 }}>--</Text>
                  </View>
                </View>
              </View>
            </View>

            <View style={{ flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: theme.colors.border }}>
              {[
                { label: 'Temp.', value: formatReading(currentData?.temp, 1, '°C') },
                { label: 'Putere', value: formatReading(currentData?.powerMw, 0, ' mW') },
                { label: 'Baterie', value: formatReading(batteryPercent, 0, '%') }
              ].map((stat, i) => (
                <View
                  key={stat.label}
                  style={{
                    flex: 1,
                    paddingVertical: 12,
                    alignItems: 'center',
                    borderLeftWidth: i === 0 ? 0 : 1,
                    borderLeftColor: theme.colors.border
                  }}
                >
                  <Text style={{ fontSize: 18, fontFamily: theme.font.bold, color: theme.colors.text }}>{stat.value}</Text>
                  <Text style={{ fontSize: 11, fontFamily: theme.font.medium, color: theme.colors.textSoft, marginTop: 2 }}>{stat.label}</Text>
                </View>
              ))}
            </View>

            <View style={{ flexDirection: 'row', gap: 8, padding: 12 }}>
              <Pressable
                onPress={handleDiveSessionToggle}
                disabled={sessionActionLoading}
                style={({ pressed }) => ({
                  flex: 1,
                  height: 48,
                  borderRadius: 14,
                  backgroundColor: diveSessionState.isActive ? theme.colors.error : '#F26A2D',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexDirection: 'row',
                  gap: 8,
                  opacity: pressed || sessionActionLoading ? 0.85 : 1
                })}
              >
                {sessionActionLoading
                  ? <ActivityIndicator size="small" color="#fff" />
                  : <Ionicons
                      name={diveSessionState.isActive ? 'stop-circle-outline' : 'airplane-outline'}
                      size={20}
                      color="#fff"
                    />
                }
                <Text style={{ color: '#fff', fontFamily: theme.font.bold, fontSize: 16 }}>
                  {diveSessionState.isActive ? 'Opreste saltul' : 'Start salt'}
                </Text>
              </Pressable>

              <Pressable
                onPress={handleResetStopwatch}
                disabled={resetActionLoading}
                style={({ pressed }) => ({
                  width: 48,
                  height: 48,
                  borderRadius: 14,
                  borderWidth: 1,
                  borderColor: theme.colors.border,
                  backgroundColor: theme.colors.surface,
                  alignItems: 'center',
                  justifyContent: 'center',
                  opacity: pressed || resetActionLoading ? 0.7 : 1
                })}
              >
                {resetActionLoading
                  ? <ActivityIndicator size="small" color={theme.colors.text} />
                  : <Ionicons name="refresh-outline" size={20} color={theme.colors.text} />
                }
              </Pressable>

              <Pressable
                onPress={() => router.push('/history')}
                style={({ pressed }) => ({
                  width: 48,
                  height: 48,
                  borderRadius: 14,
                  borderWidth: 1,
                  borderColor: theme.colors.border,
                  backgroundColor: theme.colors.surface,
                  alignItems: 'center',
                  justifyContent: 'center',
                  opacity: pressed ? 0.7 : 1
                })}
              >
                <Ionicons name="time-outline" size={20} color={theme.colors.text} />
              </Pressable>
            </View>

            <Text
              style={{
                fontSize: 12,
                fontFamily: theme.font.medium,
                color: theme.colors.textSoft,
                textAlign: 'center',
                paddingHorizontal: 16,
                paddingBottom: 14,
                marginTop: -4
              }}
            >
              {diveSessionState.isActive
                ? 'Sesiunea este activa - datele se salveaza automat.'
                : 'Porneste sesiunea inainte de salt pentru a salva telemetria.'}
            </Text>
          </View>

          
        </ScrollView>
      </SafeAreaView>
    </ScreenShell>
  );
}