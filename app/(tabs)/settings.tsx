import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Dimensions,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';

import { AppTheme } from '@/constants/theme';
import {
  MQTT_BROKER,
  MQTT_PORT,
  MQTT_TOPIC,
  MQTT_CMD_TOPIC,
  MQTT_STATE_TOPIC
} from '@/constants/config';
import { useAppTheme } from '@/hooks/useAppTheme';
import { useESP32 } from '@/hooks/useESP32';
import { showToast } from '@/lib/showToast';
import { getDebugInfo } from '@/lib/debugInfo';

// ─── Types ───────────────────────────────────────────────────────────────────

type BadgeTone = 'green' | 'orange' | 'blue' | 'red' | 'gray';
type SheetId =
  | 'wifi-current'
  | 'wifi-creds'
  | 'mqtt'
  | 'firmware'
  | null;

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatUptime(seconds: number): string {
  const h = String(Math.floor(seconds / 3600)).padStart(2, '0');
  const m = String(Math.floor((seconds % 3600) / 60)).padStart(2, '0');
  const s = String(seconds % 60).padStart(2, '0');
  return `${h}:${m}:${s}`;
}

function wifiQuality(rssi: number): number {
  if (rssi >= -50) return 4;
  if (rssi >= -60) return 3;
  if (rssi >= -70) return 2;
  return 1;
}

// ─── Sub-components ──────────────────────────────────────────────────────────

function SectionLabel({ title, danger }: { title: string; danger?: boolean }) {
  const { theme } = useAppTheme();
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 18, paddingHorizontal: 4 }}>
      <Text
        style={{
          fontSize: 13,
          fontFamily: theme.font.semiBold,
          color: danger ? theme.colors.danger : theme.colors.muted,
          letterSpacing: 1.5,
          textTransform: 'uppercase'
        }}
      >
        {title}
      </Text>
      <View style={{ flex: 1, height: 1, backgroundColor: danger ? 'rgba(232,64,64,0.2)' : theme.colors.border }} />
    </View>
  );
}

function Badge({ label, tone }: { label: string; tone: BadgeTone }) {
  const { theme } = useAppTheme();
  const colors: Record<BadgeTone, { bg: string; border: string; text: string }> = {
    green:  { bg: 'rgba(61,220,132,0.12)',  border: 'rgba(61,220,132,0.25)',  text: theme.colors.success },
    orange: { bg: 'rgba(232,84,42,0.12)',   border: 'rgba(232,84,42,0.25)',   text: theme.colors.primary },
    blue:   { bg: 'rgba(56,189,248,0.12)',  border: 'rgba(56,189,248,0.25)',  text: theme.colors.info },
    red:    { bg: 'rgba(232,64,64,0.12)',   border: 'rgba(232,64,64,0.25)',   text: theme.colors.danger },
    gray:   { bg: 'rgba(255,255,255,0.06)', border: theme.colors.border,      text: theme.colors.muted }
  };
  const c = colors[tone];
  return (
    <View style={{ backgroundColor: c.bg, borderWidth: 1, borderColor: c.border, borderRadius: 20, paddingHorizontal: 10, paddingVertical: 5 }}>
      <Text style={{ fontSize: 12, fontFamily: theme.font.semiBold, color: c.text, letterSpacing: 0.3 }}>{label}</Text>
    </View>
  );
}

function IconBox({ color, children }: { color: string; children: React.ReactNode }) {
  return (
    <View style={{ width: 40, height: 40, borderRadius: 10, backgroundColor: color, alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
      {children}
    </View>
  );
}

function WifiSignalBars({ rssi }: { rssi: number }) {
  const active = wifiQuality(rssi);
  const heights = [6, 10, 14, 18];
  return (
    <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 2 }}>
      {heights.map((h, i) => (
        <View
          key={i}
          style={{
            width: 4,
            height: h,
            borderRadius: 1,
            backgroundColor: i < active ? '#3ddc84' : 'rgba(255,255,255,0.12)'
          }}
        />
      ))}
    </View>
  );
}

function Chevron({ color }: { color?: string }) {
  const { theme } = useAppTheme();
  return <Text style={{ fontSize: 18, color: color ?? theme.colors.muted, marginLeft: 2 }}>›</Text>;
}

interface SettingRowProps {
  icon: React.ReactNode;
  label: string;
  desc?: string;
  value?: string;
  right?: React.ReactNode;
  onPress?: () => void;
  isLast?: boolean;
}

function SettingRow({ icon, label, desc, value, right, onPress, isLast }: SettingRowProps) {
  const { theme } = useAppTheme();
  return (
    <Pressable
      onPress={onPress}
      android_ripple={{ color: 'rgba(255,255,255,0.04)' }}
      style={({ pressed }) => [
        {
          flexDirection: 'row',
          alignItems: 'center',
          gap: 14,
          paddingHorizontal: 18,
          paddingVertical: 16,
          minHeight: 68,
          borderBottomWidth: isLast ? 0 : 1,
          borderBottomColor: theme.colors.border,
          backgroundColor: pressed ? 'rgba(255,255,255,0.02)' : 'transparent'
        }
      ]}
    >
      {icon}
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text style={{ fontSize: 15, fontFamily: theme.font.semiBold, color: theme.colors.text }} numberOfLines={1}>
          {label}
        </Text>
        {desc && (
          <Text style={{ fontSize: 13, color: theme.colors.muted, marginTop: 2 }} numberOfLines={1}>
            {desc}
          </Text>
        )}
        {value && !desc && (
          <Text style={{ fontSize: 13, fontFamily: theme.font.mono, color: theme.colors.muted, marginTop: 2 }} numberOfLines={1}>
            {value}
          </Text>
        )}
      </View>
      {right && <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flexShrink: 0 }}>{right}</View>}
    </Pressable>
  );
}

function SettingGroup({ children }: { children: React.ReactNode }) {
  const { theme } = useAppTheme();
  const windowWidth = Dimensions.get('window').width;
  // On wider screens (tablet/laptop), show 2 columns
  const isWideScreen = windowWidth > 768;
  
  return (
    <View
      style={{
        backgroundColor: theme.colors.card,
        borderRadius: theme.radius.lg,
        borderWidth: 1,
        borderColor: theme.colors.border,
        overflow: 'hidden',
        ...theme.shadow.card
      }}
    >
      {children}
    </View>
  );
}

function DangerGroup({ children }: { children: React.ReactNode }) {
  const { theme } = useAppTheme();
  return (
    <View
      style={{
        backgroundColor: theme.colors.card,
        borderRadius: theme.radius.lg,
        borderWidth: 1,
        borderColor: 'rgba(232,64,64,0.2)',
        overflow: 'hidden',
        ...theme.shadow.card
      }}
    >
      {children}
    </View>
  );
}

// ─── Bottom Sheet ─────────────────────────────────────────────────────────────

function BottomSheet({ visible, onClose, children }: { visible: boolean; onClose: () => void; children: React.ReactNode }) {
  const { theme } = useAppTheme();
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.65)' }} onPress={onClose} />
      <View
        style={{
          backgroundColor: theme.colors.card,
          borderTopLeftRadius: 24,
          borderTopRightRadius: 24,
          borderTopWidth: 1,
          borderColor: theme.colors.border,
          maxHeight: '85%',
          paddingHorizontal: 20,
          paddingBottom: 48
        }}
      >
        <View style={{ width: 36, height: 4, borderRadius: 2, backgroundColor: theme.colors.border, alignSelf: 'center', marginTop: 14, marginBottom: 20 }} />
        <ScrollView showsVerticalScrollIndicator={false}>{children}</ScrollView>
      </View>
    </Modal>
  );
}

function SheetTitle({ title, subtitle }: { title: string; subtitle?: string }) {
  const { theme } = useAppTheme();
  return (
    <>
      <Text style={{ fontSize: 22, fontFamily: theme.font.bold, color: theme.colors.text, marginBottom: 6 }}>{title}</Text>
      {subtitle && <Text style={{ fontSize: 14, color: theme.colors.muted, marginBottom: 22 }}>{subtitle}</Text>}
    </>
  );
}

function SheetField({ label, children }: { label: string; children: React.ReactNode }) {
  const { theme } = useAppTheme();
  return (
    <View style={{ marginBottom: 18 }}>
      <Text style={{ fontSize: 13, color: theme.colors.muted, fontFamily: theme.font.semiBold, textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 9 }}>
        {label}
      </Text>
      {children}
    </View>
  );
}

function SheetInput({ placeholder, value, onChangeText, secureTextEntry }: {
  placeholder?: string;
  value?: string;
  onChangeText?: (v: string) => void;
  secureTextEntry?: boolean;
}) {
  const { theme } = useAppTheme();
  return (
    <TextInput
      style={{
        backgroundColor: theme.colors.surfaceMuted,
        borderWidth: 1,
        borderColor: theme.colors.border,
        borderRadius: 12,
        paddingHorizontal: 16,
        paddingVertical: 15,
        fontSize: 16,
        fontFamily: theme.font.mono,
        color: theme.colors.text
      }}
      placeholder={placeholder}
      placeholderTextColor={theme.colors.muted}
      value={value}
      onChangeText={onChangeText}
      secureTextEntry={secureTextEntry}
    />
  );
}

function SheetButton({ label, variant = 'primary', onPress }: { label: string; variant?: 'primary' | 'secondary' | 'danger'; onPress?: () => void }) {
  const { theme } = useAppTheme();
  const bg = variant === 'primary' ? theme.colors.primary : variant === 'danger' ? 'rgba(232,64,64,0.12)' : theme.colors.surfaceMuted;
  const textColor = variant === 'primary' ? '#fff' : variant === 'danger' ? theme.colors.danger : theme.colors.text;
  const borderColor = variant === 'secondary' ? theme.colors.border : variant === 'danger' ? 'rgba(232,64,64,0.25)' : 'transparent';
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => ({
        width: '100%',
        paddingVertical: 16,
        borderRadius: 14,
        borderWidth: 1,
        borderColor,
        backgroundColor: pressed && variant === 'primary' ? theme.colors.primaryLight : bg,
        alignItems: 'center',
        marginTop: variant === 'primary' ? 6 : 12,
        opacity: pressed ? 0.9 : 1
      })}
    >
      <Text style={{ fontSize: 16, fontFamily: theme.font.bold, color: textColor }}>{label}</Text>
    </Pressable>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  const { theme } = useAppTheme();
  return (
    <View style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 11, borderBottomWidth: 1, borderBottomColor: theme.colors.border }}>
      <Text style={{ fontSize: 14, color: theme.colors.muted, fontFamily: theme.font.medium }}>{label}</Text>
      <Text style={{ fontSize: 14, fontFamily: theme.font.mono, color: theme.colors.text }}>{value}</Text>
    </View>
  );
}

// ─── Sheet Contents ───────────────────────────────────────────────────────────

function WifiCurrentSheet({ data, status, onClose }: { data: any; status: string; onClose: () => void }) {
  const { theme } = useAppTheme();
  const statusLabel = status === 'online' ? '● Activ' : status === 'disconnected' ? 'Deconectat' : 'Offline';
  const statusTone: BadgeTone = status === 'online' ? 'green' : 'red';
  return (
    <>
      <SheetTitle title="Status WiFi" subtitle="Conexiunea curentă a ESP32" />
      <View style={{ backgroundColor: theme.colors.surfaceMuted, borderRadius: 14, borderWidth: 1, borderColor: theme.colors.border, padding: 18, marginBottom: 20 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14, marginBottom: 16 }}>
          <View style={{ width: 48, height: 48, borderRadius: 12, backgroundColor: 'rgba(56,189,248,0.12)', alignItems: 'center', justifyContent: 'center' }}>
            <Ionicons name="wifi-outline" size={24} color={theme.colors.info} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: 17, fontFamily: theme.font.bold, color: theme.colors.text }}>{data?.ssid ?? 'SUDO_AP'}</Text>
            <Text style={{ fontSize: 13, fontFamily: theme.font.mono, color: theme.colors.muted, marginTop: 3 }}>Soft Access Point Mode</Text>
          </View>
          <Badge label={statusLabel} tone={statusTone} />
        </View>
        <InfoRow label="IP" value={data?.ip ?? '--'} />
        <InfoRow label="Canal" value={`CH ${data?.channel ?? '--'}`} />
        <InfoRow label="RSSI" value={`${Math.round(data?.rssi ?? -99)} dBm`} />
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', paddingTop: 10 }}>
          <Text style={{ fontSize: 14, color: theme.colors.muted, fontFamily: theme.font.medium }}>MAC</Text>
          <Text style={{ fontSize: 14, fontFamily: theme.font.mono, color: theme.colors.text }}>{data?.mac ?? '--'}</Text>
        </View>
      </View>
      <SheetButton label="Închide" variant="secondary" onPress={onClose} />
    </>
  );
}

function WifiCredsSheet({ data, onClose, onSave }: { data: any; onClose: () => void; onSave: (payload: {
  staSsid: string;
  staPassword: string;
  apSsid: string;
  apPassword: string;
  reconnect: boolean;
}) => boolean; }) {
  const [ssid, setSsid] = useState<string>(data?.ssid ?? '');
  const [pass, setPass] = useState<string>('');
  const [apSsid, setApSsid] = useState<string>('SUDO_AP');
  const [apPass, setApPass] = useState<string>('');

  const handleSave = (reconnect: boolean) => {
    if (!ssid.trim()) {
      Alert.alert('Eroare', 'Introduceți SSID-ul rețelei');
      return;
    }
    const ok = onSave({
      staSsid: ssid.trim(),
      staPassword: pass,
      apSsid: apSsid.trim(),
      apPassword: apPass,
      reconnect
    });

    if (ok) {
      const msg = reconnect 
        ? 'Credențiale salvate. ESP32 se reconectează...' 
        : 'Credențiale salvate în ESP32.';
      showToast(msg, 'LONG');
      onClose();
    } else {
      Alert.alert('MQTT indisponibil', 'Nu se poate trimite comanda. Verificați conexiunea MQTT.');
    }
  };

  return (
    <>
      <SheetTitle title="Credențiale WiFi" subtitle="Rețeaua la care se conectează ESP32 ca stație (STA)" />
      <SheetField label="Nume rețea (SSID)">
        <SheetInput placeholder="ex: Casa_mea_WiFi" value={ssid} onChangeText={setSsid} />
      </SheetField>
      <SheetField label="Parolă WiFi">
        <SheetInput placeholder="Parola rețelei" value={pass} onChangeText={setPass} secureTextEntry />
      </SheetField>
      <SheetField label="Soft AP SSID">
        <SheetInput placeholder="Numele AP creat de ESP32" value={apSsid} onChangeText={setApSsid} />
      </SheetField>
      <SheetField label="Parolă Soft AP">
        <SheetInput placeholder="Parola pentru AP" value={apPass} onChangeText={setApPass} secureTextEntry />
      </SheetField>
      <SheetButton label="Salvează & Reconectează" variant="primary" onPress={() => handleSave(true)} />
      <SheetButton label="Doar salvează" variant="secondary" onPress={() => handleSave(false)} />
      <SheetButton label="Anulează" variant="secondary" onPress={onClose} />
    </>
  );
}

function MqttSheet({ onClose, onSave }: { onClose: () => void; onSave: (payload: {
  host: string;
  port: number;
  user: string;
  pass: string;
}) => boolean; }) {
  const [host, setHost] = useState<string>(MQTT_BROKER);
  const [port, setPort] = useState<string>(String(MQTT_PORT));
  const [user, setUser] = useState<string>('emqx');
  const [pass, setPass] = useState<string>('');

  const handleSave = () => {
    if (!host.trim() || !port.trim()) {
      Alert.alert('Eroare', 'Completați adresa și portul MQTT');
      return;
    }
    const parsedPort = Number(port);
    if (!Number.isFinite(parsedPort) || parsedPort <= 0) {
      Alert.alert('Eroare', 'Port invalid');
      return;
    }

    const ok = onSave({
      host: host.trim(),
      port: Math.round(parsedPort),
      user: user.trim(),
      pass
    });

    if (ok) {
      showToast(`Config MQTT trimisă: ${host}:${port}`, 'LONG');
      onClose();
    } else {
      Alert.alert('MQTT indisponibil', 'Nu se poate trimite comanda. Verificați conexiunea MQTT.');
    }
  };

  return (
    <>
      <SheetTitle title="Configurare MQTT" subtitle="Broker-ul la care se conectează ESP32" />
      <SheetField label="Adresă broker">
        <SheetInput value={host} onChangeText={setHost} placeholder="ex: 192.168.4.1" />
      </SheetField>
      <SheetField label="Port">
        <SheetInput value={port} onChangeText={setPort} placeholder="1883" />
      </SheetField>
      <SheetField label="Utilizator">
        <SheetInput value={user} onChangeText={setUser} placeholder="emqx" />
      </SheetField>
      <SheetField label="Parolă">
        <SheetInput value={pass} onChangeText={setPass} secureTextEntry placeholder="••••••" />
      </SheetField>
      <SheetButton label="Salvează" variant="primary" onPress={handleSave} />
      <SheetButton label="Anulează" variant="secondary" onPress={onClose} />
    </>
  );
}

function FirmwareSheet({ onClose, onCheckUpdates }: { onClose: () => void; onCheckUpdates: () => void }) {
  const { theme } = useAppTheme();

  return (
    <>
      <SheetTitle title="Firmware" subtitle="Informații versiune curentă" />
      <InfoRow label="Versiune" value="v2.1.0" />
      <InfoRow label="Build date" value="2026.04.07" />
      <InfoRow label="SDK" value="ESP-IDF 5.2" />
      <InfoRow label="Chip" value="ESP32-C3" />
      <View style={{ height: 12 }} />
      <View style={{ backgroundColor: theme.colors.surfaceMuted, borderRadius: 12, borderWidth: 1, borderColor: theme.colors.border, padding: 16 }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 10 }}>
          <Text style={{ fontSize: 14, color: theme.colors.muted, fontFamily: theme.font.medium }}>Firmware OTA</Text>
          <Badge label="Latest" tone="green" />
        </View>
        <Text style={{ fontSize: 13, color: theme.colors.muted, lineHeight: 19 }}>Ești pe cea mai recentă versiune disponibilă.</Text>
      </View>
      <SheetButton label="Verifică actualizări" variant="secondary" onPress={onCheckUpdates} />
      <SheetButton label="Închide" variant="secondary" onPress={onClose} />
    </>
  );
}

// ─── Device Info Card ─────────────────────────────────────────────────────────

function DeviceInfoCard({ data, status }: { data: any; status: string }) {
  const { theme } = useAppTheme();
  const windowWidth = Dimensions.get('window').width;
  const isWideScreen = windowWidth > 768;
  const uptimeStr = data?.uptime ? formatUptime(Math.floor(data.uptime)) : '--:--:--';

  const gridItems = [
    { label: 'IP Adresă',  value: data?.ip ?? '--',          color: theme.colors.success },
    { label: 'MAC',        value: data?.mac ?? '--',          color: theme.colors.muted,   small: true },
    { label: 'Uptime',     value: uptimeStr,                  color: theme.colors.warning },
    { label: 'Heap liber', value: '142 KB',                   color: theme.colors.primary },
    { label: 'Flash',      value: '4 MB',                     color: theme.colors.text },
    { label: 'CPU',        value: '160 MHz',                  color: theme.colors.text }
  ];

  const statusLabel = status === 'online' ? '● ONLINE' : status === 'disconnected' ? '○ DECON.' : '○ OFFLINE';
  const statusTone: BadgeTone = status === 'online' ? 'green' : 'red';

  return (
    <View style={{ backgroundColor: '#141f18', borderWidth: 1, borderColor: '#1e3328', borderRadius: theme.radius.lg, padding: 20, marginBottom: 8, overflow: 'hidden' }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 18 }}>
        <View>
          <Text style={{ fontSize: 18, fontFamily: theme.font.bold, color: theme.colors.text }}>ESP32-C3 Super Mini</Text>
          <Text style={{ fontSize: 13, color: theme.colors.muted, marginTop: 3 }}>SUDO · v2.1.0</Text>
        </View>
        <Badge label={statusLabel} tone={statusTone} />
      </View>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 16 }}>
        {gridItems.map((item) => (
          <View key={item.label} style={{ width: isWideScreen ? '23%' : '46%' }}>
            <Text style={{ fontSize: 12, color: theme.colors.muted, textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 6, fontFamily: theme.font.medium }}>
              {item.label}
            </Text>
            <Text style={{ fontSize: item.small ? 14 : 17, fontFamily: theme.font.monoMedium, color: item.color, fontWeight: '700' }} numberOfLines={1}>
              {item.value}
            </Text>
          </View>
        ))}
      </View>
      {/* glow accent */}
      <View style={{ position: 'absolute', right: -20, bottom: -20, width: 100, height: 100, borderRadius: 50, backgroundColor: 'rgba(61,220,132,0.07)' }} pointerEvents="none" />
    </View>
  );
}

// ─── Main Screen ──────────────────────────────────────────────────────────────

export default function SettingsScreen() {
  const { theme } = useAppTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const { data, status, mqttStatus, transportMode, activeMqttBroker, activeMqttPort, publishCommand, sendModuleCommand, moduleStates, lastCommandAck } = useESP32();
  const [debugExpanded, setDebugExpanded] = useState(false);
  const [debugInfo, setDebugInfo] = useState(getDebugInfo());

  // Refresh debug info periodically
  useEffect(() => {
    const interval = setInterval(() => {
      setDebugInfo(getDebugInfo());
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  const mqttBadgeLabel = mqttStatus === 'online'
    ? transportMode === 'offline'
      ? '● Local AP'
      : '● Cloud'
    : status === 'disconnected'
      ? '● Deconectat'
      : '● Offline';

  const [sheet, setSheet] = useState<SheetId>(null);
  const [softAp, setSoftAp] = useState(true);
  const [mqttAutoReconnect, setMqttAutoReconnect] = useState(true);
  const [oledEnabled, setOledEnabled] = useState(true);
  const [deepSleep, setDeepSleep] = useState(false);
  const [pendingCommands, setPendingCommands] = useState<Record<string, string>>({});

  const closeSheet = useCallback(() => setSheet(null), []);

  const publishSpecCommand = useCallback(
    (action: string, params: Record<string, unknown> = {}) => {
      const id = `cmd-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
      const ok = publishCommand({
        id,
        action,
        params,
        ts: new Date().toISOString(),
        source: 'mobile-app'
      });

      if (ok) {
        setPendingCommands((prev) => ({ ...prev, [id]: action }));
      }

      return ok;
    },
    [publishCommand]
  );

  useEffect(() => {
    if (!lastCommandAck?.id) {
      return;
    }

    const action = pendingCommands[lastCommandAck.id];
    if (!action) {
      return;
    }

    const normalizedStatus = lastCommandAck.status.trim().toLowerCase();
    const isSuccess = ['ok', 'success', 'done', 'applied'].includes(normalizedStatus);
    const text = isSuccess
      ? `ACK ${action}: ${lastCommandAck.message ?? 'OK'}`
      : `ACK ${action}: ${lastCommandAck.message ?? 'Eroare'}`;
    showToast(text, 'SHORT');

    setPendingCommands((prev) => {
      const next = { ...prev };
      delete next[lastCommandAck.id];
      return next;
    });
  }, [lastCommandAck, pendingCommands]);

  const handleRestart = () => {
    Alert.alert(
      'Restart ESP32',
      'Ești sigur că vrei să repornești dispozitivul?',
      [
        { text: 'Anulează', style: 'cancel' },
        {
          text: 'Restart',
          style: 'destructive',
          onPress: () => {
            const ok = publishSpecCommand('system.restart');
            showToast(ok ? 'Comandă restart trimisă.' : 'MQTT indisponibil. Restart netrimis.', 'LONG');
          }
        }
      ]
    );
  };

  const handleFactoryReset = () => {
    Alert.alert(
      'Factory Reset',
      'ATENȚIE: Aceasta va șterge TOATE setările salvate. Ești sigur?',
      [
        { text: 'Anulează', style: 'cancel' },
        {
          text: 'Reset',
          style: 'destructive',
          onPress: () => {
            const ok = publishSpecCommand('system.factory_reset', {
              erase_nvs: true,
              reboot: true
            });
            showToast(ok ? 'Comandă factory reset trimisă.' : 'MQTT indisponibil. Factory reset netrimis.', 'LONG');
            // Reset UI state
            setSoftAp(true);
            setMqttAutoReconnect(true);
            setOledEnabled(true);
            setDeepSleep(false);
          }
        }
      ]
    );
  };

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>

        {/* ── Header ── */}
        <View style={styles.header}>
          <View>
            <Text style={styles.headerTitle}>Setări</Text>
            <Text style={styles.headerSub}>SUDO · ESP32-C3</Text>
          </View>
        </View>

        {/* ── Device Info Card ── */}
        <DeviceInfoCard data={data} status={status} />

        {/* ══ WiFi ══ */}
        <SectionLabel title="Rețea WiFi" />
        <SettingGroup>
          <SettingRow
            icon={<IconBox color="rgba(56,189,248,0.12)"><Ionicons name="wifi-outline" size={20} color={theme.colors.info} /></IconBox>}
            label="Rețea conectată"
            value={data?.ssid ? `${data.ssid} · Soft AP Mode` : 'SUDO_AP · Soft AP Mode'}
            right={<><WifiSignalBars rssi={data?.rssi ?? -99} /><Chevron /></>}
            onPress={() => setSheet('wifi-current')}
          />
          <SettingRow
            icon={<IconBox color="rgba(232,84,42,0.12)"><Ionicons name="key-outline" size={20} color={theme.colors.primary} /></IconBox>}
            label="Credențiale WiFi"
            value={`SSID: ${data?.ssid ?? 'SUDO_Network'}`}
            right={<><Badge label="Editează" tone="orange" /><Chevron /></>}
            onPress={() => setSheet('wifi-creds')}
          />
          <SettingRow
            icon={<IconBox color="rgba(61,220,132,0.1)"><Ionicons name="radio-outline" size={20} color={theme.colors.success} /></IconBox>}
            label="Soft AP Mode"
            value={`${data?.ip ?? '192.168.4.1'} · SUDO_AP`}
            right={
              <Switch
                value={softAp}
                onValueChange={(value) => {
                  setSoftAp(value);
                  const ok = publishSpecCommand('wifi.softap.set', { enabled: value });
                  if (!ok) {
                    showToast('MQTT indisponibil. Comanda Soft AP nu a fost trimisă.', 'SHORT');
                  }
                }}
                trackColor={{ false: theme.colors.border, true: theme.colors.primary }}
                thumbColor="#fff"
              />
            }
            isLast
          />
        </SettingGroup>

        {/* ══ MQTT ══ */}
        <SectionLabel title="MQTT Broker" />
        <SettingGroup>
          <SettingRow
            icon={<IconBox color="rgba(167,139,250,0.12)"><Ionicons name="flash-outline" size={20} color="#a78bfa" /></IconBox>}
            label="Server MQTT"
            value={`${activeMqttBroker} : ${activeMqttPort}`}
            right={<><Badge label={mqttBadgeLabel} tone={mqttStatus === 'online' ? 'green' : 'red'} /><Chevron /></>}
            onPress={() => setSheet('mqtt')}
          />
          <SettingRow
            icon={<IconBox color="rgba(61,220,132,0.1)"><Ionicons name="refresh-outline" size={20} color={theme.colors.success} /></IconBox>}
            label="Auto-reconnect"
            desc="Reconectare automată la broker"
            right={
              <Switch
                value={mqttAutoReconnect}
                onValueChange={(value) => {
                  setMqttAutoReconnect(value);
                  const ok = publishSpecCommand('mqtt.set_auto_reconnect', {
                    enabled: value,
                    max_retries: 5,
                    retry_ms: 5000
                  });
                  if (!ok) {
                    showToast('MQTT indisponibil. Setarea nu a fost trimisă.', 'SHORT');
                  }
                }}
                trackColor={{ false: theme.colors.border, true: theme.colors.primary }}
                thumbColor="#fff"
              />
            }
            isLast
          />
        </SettingGroup>

        {/* ══ Sensors ══ */}
        <SectionLabel title="Senzori & Sampling" />
        <SettingGroup>
          <SettingRow
            icon={<IconBox color="rgba(245,158,11,0.12)"><Ionicons name="thermometer-outline" size={20} color={theme.colors.warning} /></IconBox>}
            label="NTC Termistor"
            value="GPIO2 · 10kΩ · ADC 12-bit"
            right={
              <Switch
                value={moduleStates.temperature}
                onValueChange={(value) => {
                  const ok = sendModuleCommand('temperature', value);
                  if (!ok) {
                    showToast('MQTT indisponibil. Comanda NTC nu a fost trimisă.', 'SHORT');
                  }
                }}
                trackColor={{ false: theme.colors.border, true: theme.colors.primary }}
                thumbColor="#fff"
              />
            }
          />
          <SettingRow
            icon={<IconBox color="rgba(56,189,248,0.12)"><Ionicons name="tv-outline" size={20} color={theme.colors.info} /></IconBox>}
            label="OLED Display"
            value="SSD1306 · 128×64 · 0x3C"
            right={
              <Switch
                value={oledEnabled}
                onValueChange={(value) => {
                  setOledEnabled(value);
                  const ok = publishSpecCommand('display.oled.set', { enabled: value });
                  if (!ok) {
                    showToast('MQTT indisponibil. Comanda OLED nu a fost trimisă.', 'SHORT');
                  }
                }}
                trackColor={{ false: theme.colors.border, true: theme.colors.primary }}
                thumbColor="#fff"
              />
            }
            isLast
          />
        </SettingGroup>

        {/* ══ System ══ */}
        <SectionLabel title="Sistem" />
        <SettingGroup>
          <SettingRow
            icon={<IconBox color="rgba(255,255,255,0.06)"><Ionicons name="cube-outline" size={20} color={theme.colors.muted} /></IconBox>}
            label="Firmware"
            value="v2.1.0 · Build 2026.04.07"
            right={<><Badge label="Latest" tone="green" /><Chevron /></>}
            onPress={() => setSheet('firmware')}
          />
          <SettingRow
            icon={<IconBox color="rgba(255,255,255,0.06)"><Ionicons name="moon-outline" size={20} color={theme.colors.muted} /></IconBox>}
            label="Deep Sleep"
            desc="Mod consum redus când e inactiv"
            right={
              <Switch
                value={deepSleep}
                onValueChange={(value) => {
                  setDeepSleep(value);
                  const ok = publishSpecCommand('system.deep_sleep.set', {
                    enabled: value,
                    idle_timeout_s: 60
                  });
                  if (!ok) {
                    showToast('MQTT indisponibil. Comanda Deep Sleep nu a fost trimisă.', 'SHORT');
                  }
                }}
                trackColor={{ false: theme.colors.border, true: theme.colors.primary }}
                thumbColor="#fff"
              />
            }
            isLast
          />
        </SettingGroup>

        {/* ══ Debug Panel ══ */}
        <SectionLabel title="Diagnostică" />
        <SettingGroup>
          <SettingRow
            icon={<IconBox color="rgba(99,102,241,0.12)"><Ionicons name="bug-outline" size={20} color="#6366f1" /></IconBox>}
            label="Informații conexiune"
            desc={`${debugInfo?.transportMode ?? 'necunoscut'} · ${debugInfo?.mqttBroker ?? '--'}:${debugInfo?.mqttPort ?? '--'}`}
            right={<Chevron />}
            onPress={() => setDebugExpanded(!debugExpanded)}
            isLast={!debugExpanded}
          />
          {debugExpanded && (
            <View style={{ paddingHorizontal: 18, paddingVertical: 16, borderTopWidth: 1, borderTopColor: theme.colors.border }}>
              <View style={{ backgroundColor: theme.colors.surfaceMuted, borderRadius: 10, borderWidth: 1, borderColor: theme.colors.border, padding: 12, marginBottom: 12 }}>
                <Text style={{ fontSize: 12, color: theme.colors.muted, fontFamily: theme.font.semiBold, marginBottom: 8, letterSpacing: 0.5, textTransform: 'uppercase' }}>
                  Moduri
                </Text>
                <Text style={{ fontSize: 14, fontFamily: theme.font.mono, color: theme.colors.text, lineHeight: 20 }}>
                  Transport: <Text style={{ color: debugInfo?.transportMode === 'online' ? theme.colors.success : debugInfo?.transportMode === 'offline' ? theme.colors.warning : theme.colors.muted, fontFamily: theme.font.bold }}>
                    {debugInfo?.transportMode ?? 'necunoscut'}
                  </Text>
                  {'\n'}
                  MQTT: <Text style={{ color: theme.colors.text, fontFamily: theme.font.bold }}>
                    {`${debugInfo?.mqttBroker ?? '--'}:${debugInfo?.mqttPort ?? '--'}`}
                  </Text>
                </Text>
              </View>

              {debugInfo?.netInfoState && (
                <View style={{ backgroundColor: theme.colors.surfaceMuted, borderRadius: 10, borderWidth: 1, borderColor: theme.colors.border, padding: 12 }}>
                  <Text style={{ fontSize: 12, color: theme.colors.muted, fontFamily: theme.font.semiBold, marginBottom: 8, letterSpacing: 0.5, textTransform: 'uppercase' }}>
                    Stare Rețea (NetInfo)
                  </Text>
                  <Text style={{ fontSize: 13, fontFamily: theme.font.mono, color: theme.colors.text, lineHeight: 18 }}>
                    Conectat: <Text style={{ color: debugInfo.netInfoState.isConnected ? theme.colors.success : theme.colors.danger, fontFamily: theme.font.bold }}>
                      {debugInfo.netInfoState.isConnected ? '✓' : '✗'}
                    </Text>
                    {'\n'}
                    Internet: <Text style={{ color: debugInfo.netInfoState.isInternetReachable ? theme.colors.success : theme.colors.muted, fontFamily: theme.font.bold }}>
                      {debugInfo.netInfoState.isInternetReachable ? '✓' : '✗'}
                    </Text>
                    {'\n'}
                    IP: <Text style={{ color: theme.colors.text, fontFamily: theme.font.bold }}>
                      {debugInfo.netInfoState.ipAddress}
                    </Text>
                    {'\n'}
                    SSID: <Text style={{ color: theme.colors.text, fontFamily: theme.font.bold }}>
                      {debugInfo.netInfoState.ssid || 'N/A'}
                    </Text>
                  </Text>
                </View>
              )}
            </View>
          )}
        </SettingGroup>

        {/* ══ Danger Zone ══ */}
        <SectionLabel title="Zona periculoasă" danger />
        <DangerGroup>
          <SettingRow
            icon={<IconBox color="rgba(245,158,11,0.12)"><Ionicons name="refresh-circle-outline" size={20} color={theme.colors.warning} /></IconBox>}
            label="Restart ESP32"
            desc="Repornești dispozitivul"
            right={<Chevron color={theme.colors.warning} />}
            onPress={handleRestart}
          />
          <SettingRow
            icon={<IconBox color="rgba(232,64,64,0.12)"><Ionicons name="warning-outline" size={20} color={theme.colors.danger} /></IconBox>}
            label="Factory Reset"
            desc="Șterge toate setările salvate"
            right={<Chevron color={theme.colors.danger} />}
            onPress={handleFactoryReset}
            isLast
          />
        </DangerGroup>

        <View style={{ height: 40 }} />
      </ScrollView>

      {/* ══ Sheets ══ */}
      <BottomSheet visible={sheet === 'wifi-current'} onClose={closeSheet}>
        <WifiCurrentSheet data={data} status={status} onClose={closeSheet} />
      </BottomSheet>
      <BottomSheet visible={sheet === 'wifi-creds'} onClose={closeSheet}>
        <WifiCredsSheet
          data={data}
          onClose={closeSheet}
          onSave={({ staSsid, staPassword, apSsid, apPassword, reconnect }) =>
            publishSpecCommand('wifi.set_credentials', {
              sta_ssid: staSsid,
              sta_password: staPassword,
              ap_ssid: apSsid,
              ap_password: apPassword,
              reconnect
            })
          }
        />
      </BottomSheet>
      <BottomSheet visible={sheet === 'mqtt'} onClose={closeSheet}>
        <MqttSheet
          onClose={closeSheet}
          onSave={({ host, port, user, pass }) =>
            publishSpecCommand('mqtt.set_broker', {
              host,
              port,
              username: user,
              password: pass,
              transport: 'tcp'
            })
          }
        />
      </BottomSheet>
      <BottomSheet visible={sheet === 'firmware'} onClose={closeSheet}>
        <FirmwareSheet
          onClose={closeSheet}
          onCheckUpdates={() => {
            const ok = publishSpecCommand('firmware.check');
            showToast(ok ? 'Cerere verificare firmware trimisă.' : 'MQTT indisponibil.', 'SHORT');
          }}
        />
      </BottomSheet>
    </SafeAreaView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const createStyles = (theme: AppTheme) => {
  const windowWidth = Dimensions.get('window').width;
  const isWideScreen = windowWidth > 768;
  
  return StyleSheet.create({
    safe: {
      flex: 1,
      backgroundColor: theme.colors.background
    },
    content: {
      paddingHorizontal: isWideScreen ? 28 : 16,
      paddingTop: 12,
      paddingBottom: 104,
      maxWidth: isWideScreen ? 1200 : '100%',
      alignSelf: 'center',
      width: '100%'
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingVertical: 16,
      paddingHorizontal: 4,
      marginBottom: 8
    },
    headerTitle: {
      fontSize: isWideScreen ? 28 : 19,
      fontFamily: theme.font.bold,
      color: theme.colors.text
    },
    headerSub: {
      fontSize: isWideScreen ? 14 : 12,
      color: theme.colors.muted,
      marginTop: 2,
      fontFamily: theme.font.medium
    }
  });
};

