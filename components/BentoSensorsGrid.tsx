import { useMemo } from 'react';
import { StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Svg, { Defs, LinearGradient, Rect, Stop } from 'react-native-svg';

import { AppTheme } from '@/constants/theme';
import { useAppTheme } from '@/hooks/useAppTheme';
import { ESP32Data } from '@/hooks/useStore';

interface Props {
  data: ESP32Data | null;
  isConnected: boolean;
}

// ─── Disconnected overlay ────────────────────────────────────────────────────

function DisconnectedOverlay({ theme }: { theme: AppTheme }) {
  return (
    <View style={disconnectedStyles.overlay}>
      <Ionicons name="cloud-offline-outline" size={22} color={theme.colors.muted} />
      <Text style={[disconnectedStyles.label, { color: theme.colors.muted, fontFamily: theme.font.medium }]}>
        No data
      </Text>
    </View>
  );
}

const disconnectedStyles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    zIndex: 2,
    flexDirection: 'column',
    backgroundColor: 'transparent'
  },
  label: {
    fontSize: 13,
    letterSpacing: 0.5,
    fontWeight: '500'
  }
});

// ─── Base sensor card ────────────────────────────────────────────────────────

interface SensorCardProps {
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  iconColor: string;
  isDisconnected: boolean;
  theme: AppTheme;
  children: React.ReactNode;
  style?: object;
}

function SensorCard({ label, icon, iconColor, isDisconnected, theme, children, style }: SensorCardProps) {
  const s = useMemo(() => cardStyles(theme, isDisconnected), [theme, isDisconnected]);

  return (
    <View style={[s.card, style]}>
      <View style={s.header}>
        <Ionicons name={icon} size={16} color={isDisconnected ? theme.colors.muted : iconColor} />
        <Text style={s.labelText}>{label}</Text>
      </View>
      <View style={{ flex: 1, opacity: isDisconnected ? 0.25 : 1 }}>
        {children}
      </View>
      {isDisconnected && <DisconnectedOverlay theme={theme} />}
    </View>
  );
}

const cardStyles = (theme: AppTheme, isDisconnected: boolean) =>
  StyleSheet.create({
    card: {
      backgroundColor: isDisconnected ? theme.colors.surfaceMuted : theme.colors.card,
      borderRadius: theme.radius.lg,
      borderWidth: 1,
      borderColor: isDisconnected
        ? 'rgba(232,84,42,0.22)'
        : theme.colors.border,
      borderStyle: isDisconnected ? 'dashed' : 'solid',
      padding: 18,
      height: 190,
      overflow: 'hidden',
      position: 'relative',
      ...theme.shadow.card
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 7,
      marginBottom: 14
    },
    labelText: {
      fontSize: 13,
      letterSpacing: 1,
      color: theme.colors.textSoft,
      fontFamily: theme.font.bold
    }
  });

// ─── Typed card sub-components ───────────────────────────────────────────────

function BigValue({ value, unit, theme, color }: { value: string; unit?: string; theme: AppTheme; color: string }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 4, marginTop: 3 }}>
      <Text style={{ fontSize: 32, lineHeight: 36, fontFamily: theme.font.mono, color, fontWeight: '600' }}>
        {value}
      </Text>
      {unit ? (
        <Text style={{ fontSize: 14, lineHeight: 20, fontFamily: theme.font.medium, color: theme.colors.textSoft, paddingBottom: 2 }}>
          {unit}
        </Text>
      ) : null}
    </View>
  );
}

function MetaRow({ items, theme }: { items: { label: string; value: string }[]; theme: AppTheme }) {
  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: 10 }}>
      {items.map((item) => (
        <View key={item.label} style={{ flexDirection: 'column', gap: 3 }}>
          <Text style={{ fontSize: 11, color: theme.colors.muted, fontFamily: theme.font.medium, letterSpacing: 0.5 }}>
            {item.label}
          </Text>
          <Text style={{ fontSize: 13, color: theme.colors.text, fontFamily: theme.font.mono, fontWeight: '500' }}>
            {item.value}
          </Text>
        </View>
      ))}
    </View>
  );
}

function StatusPill({ ok, labelOk, labelFail, theme }: { ok: boolean; labelOk: string; labelFail: string; theme: AppTheme }) {
  return (
    <View
      style={{
        alignSelf: 'flex-start',
        paddingHorizontal: 10,
        paddingVertical: 5,
        borderRadius: 999,
        backgroundColor: ok ? theme.accents.success : theme.accents.warning,
        borderWidth: 1.5,
        borderColor: ok ? 'rgba(61,220,132,0.4)' : 'rgba(249,115,22,0.4)',
        marginTop: 8
      }}
    >
      <Text style={{ fontSize: 12, fontFamily: theme.font.bold, color: ok ? theme.colors.success : theme.colors.warning, letterSpacing: 0.5 }}>
        {ok ? labelOk : labelFail}
      </Text>
    </View>
  );
}

function TemperatureHeatLine({ value, max, theme }: { value: number; max: number; theme: AppTheme }) {
  const normalized = Math.max(0, Math.min(1, value / Math.max(1, max)));
  const fillPercent = `${(normalized * 100).toFixed(1)}%` as `${number}%`;

  return (
    <View style={{ marginTop: 12, gap: 6 }}>
      <View
        style={{
          height: 8,
          borderRadius: 999,
          backgroundColor: theme.colors.surfaceMuted,
          borderWidth: 1,
          borderColor: theme.colors.border,
          overflow: 'hidden'
        }}
      >
        <View style={{ width: fillPercent, height: '100%' }}>
          <Svg width="100%" height="100%" preserveAspectRatio="none">
            <Defs>
              <LinearGradient id="tempHeatGradient" x1="0%" y1="0%" x2="100%" y2="0%">
                <Stop offset="0%" stopColor={theme.colors.info} />
                <Stop offset="58%" stopColor={theme.colors.warning} />
                <Stop offset="100%" stopColor={theme.chart.palette.temperature} />
              </LinearGradient>
            </Defs>
            <Rect x={0} y={0} width="100%" height="100%" rx={999} fill="url(#tempHeatGradient)" />
          </Svg>
        </View>
      </View>

      <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
        <Text style={{ fontSize: 11, color: theme.colors.muted, fontFamily: theme.font.medium, letterSpacing: 0.5 }}>0°C</Text>
        <Text style={{ fontSize: 11, color: theme.colors.text, fontFamily: theme.font.medium, fontWeight: '500' }}>{max}°C</Text>
      </View>
    </View>
  );
}


// ─── Bento grid ──────────────────────────────────────────────────────────────

export function BentoSensorsGrid({ data, isConnected }: Props) {
  const { theme } = useAppTheme();
  const { width } = useWindowDimensions();
  const isDesktop = width >= 768;

  const gap = 10;
  // On desktop, constrain to 920px max and center it

  const col = (fraction: number) => ({
    flex: isDesktop ? fraction : 1,
    minWidth: 0
  });

  // Derived sensor values ────────────────────────────────────────────────────
  const offline = !isConnected || !data;

  const temp = data?.temp ?? 0;
  const volt = data?.volt ?? 0;
  const current = data?.current ?? 0;
  const powerW = (data?.powerMw ?? 0) / 1000;
  const batteryPercent = data?.batteryPercent ?? 0;
  const batteryLifeMin = data?.batteryLifeMin ?? 0;
  const cpu = data?.cpu ?? 0;
  const rssi = data?.rssi ?? -99;

  // Individual disconnected states ───────────────────────────────────────────
  const noTemp = offline || temp === 0;
  const noVolt = offline || volt === 0;
  const noCurrent = offline || (current === 0 && volt === 0);
  const noWifi = offline || !data?.ip || data.ip === '--';
  const noCpu = offline || cpu === 0;
  const noBattery = offline || (batteryPercent === 0 && volt === 0);

  const rssiQuality = (db: number) => {
    if (db >= -50) return 'Excellent';
    if (db >= -65) return 'Good';
    if (db >= -75) return 'Fair';
    return 'Weak';
  };

  const s = useMemo(() => createStyles(theme, gap, isDesktop), [theme, gap, isDesktop]);

  return (
    <View style={[s.outerContainer, isDesktop && { alignSelf: 'center', width: '100%' }]}>

      {/* ─ Row 1: Temperature (large) + Voltage + Current ────────────────── */}
      <View style={s.row}>

        {/* Temperature — takes 2 flex units */}
        <SensorCard
          label="TEMPERATURE"
          icon="thermometer-outline"
          iconColor={theme.chart.palette.temperature}
          isDisconnected={noTemp}
          theme={theme}
          style={col(2)}
        >
          <BigValue
            value={noTemp ? '--.-' : temp.toFixed(1)}
            unit="°C"
            theme={theme}
            color={theme.chart.palette.temperature}
          />
          <TemperatureHeatLine
            value={noTemp ? 0 : temp}
            max={35}
            theme={theme}
          />
          <StatusPill
            ok={temp < 40}
            labelOk="Normal"
            labelFail="High temp"
            theme={theme}
          />
        </SensorCard>

        {/* Voltage */}
        <SensorCard
          label="VOLTAGE"
          icon="flash-outline"
          iconColor={theme.chart.palette.voltage}
          isDisconnected={noVolt}
          theme={theme}
          style={col(1)}
        >
          <BigValue
            value={noVolt ? '--.-' : volt.toFixed(2)}
            unit="V"
            theme={theme}
            color={theme.chart.palette.voltage}
          />
          <StatusPill
            ok={volt >= 3.3}
            labelOk="Normal"
            labelFail="Low"
            theme={theme}
          />
        </SensorCard>

        {/* Current */}
          <SensorCard
          label="CPU LOAD"
          icon="hardware-chip-outline"
          iconColor={theme.chart.palette.cpu}
          isDisconnected={noCpu}
          theme={theme}
          style={col(1)}
        >
          <BigValue
            value={noCpu ? '--' : cpu.toFixed(1)}
            unit="%"
            theme={theme}
            color={theme.chart.palette.cpu}
          />
          <View style={{ marginTop: 12, height: 8, borderRadius: 4, backgroundColor: theme.colors.surfaceMuted, overflow: 'hidden', borderWidth: 1, borderColor: theme.colors.border }}>
            <View style={{ width: `${Math.min(100, cpu)}%`, height: '100%', backgroundColor: theme.chart.palette.cpu, borderRadius: 4 }} />
          </View>
        </SensorCard>
        
      </View>

      {/* ─ Row 2: WiFi (wide) + Battery + CPU ───────────────────────────── */}
      <View style={s.row}>

        {/* WiFi */}
        <SensorCard
          label="WI-FI"
          icon="wifi-outline"
          iconColor={theme.chart.palette.rssi}
          isDisconnected={noWifi}
          theme={theme}
          style={col(3)}
        >
          <View style={{ flexDirection: 'column', gap: 2, marginTop: 1 }}>
            <Text style={{ fontSize: 13, color: theme.colors.muted, fontFamily: theme.font.medium, letterSpacing: 0.5 }}>
              NETWORK
            </Text>
            <Text style={{ fontSize: 18, lineHeight: 22, fontFamily: theme.font.mono, color: theme.chart.palette.rssi, fontWeight: '600' }}>
              {noWifi ? '--' : data?.ssid ?? '--'}
            </Text>
          </View>
          <MetaRow
            items={[
              { label: 'IP', value: noWifi ? '--' : (data?.ip ?? '--') },
              { label: 'RSSI', value: noWifi ? '--' : `${Math.round(rssi)} dBm` },
              { label: 'SIGNAL', value: noWifi ? '--' : rssiQuality(rssi) },
              { label: 'CH', value: noWifi ? '--' : String(data?.channel ?? '--') },
              { label: 'MAC', value: noWifi ? '--' : (data?.mac ?? '--') }
            ]}
            theme={theme}
          />
        </SensorCard>

        {/* Battery */}
        <SensorCard
          label="BATTERY"
          icon="battery-half-outline"
          iconColor={theme.colors.success}
          isDisconnected={noBattery}
          theme={theme}
          style={col(1)}
        >
          <BigValue
            value={noBattery ? '--' : Math.round(batteryPercent).toString()}
            unit="%"
            theme={theme}
            color={theme.colors.success}
          />
          <MetaRow
            items={[{ label: 'EST', value: noBattery ? '--' : `${(batteryLifeMin / 60).toFixed(1)}h` }]}
            theme={theme}
          />
        </SensorCard>

        {/* CPU */}
       <SensorCard
          label="CURRENT"
          icon="battery-charging-outline"
          iconColor={theme.chart.palette.current}
          isDisconnected={noCurrent}
          theme={theme}
          style={col(1)}
        >
          <BigValue
            value={noCurrent ? '---' : current.toFixed(0)}
            unit="mA"
            theme={theme}
            color={theme.chart.palette.current}
          />
          <MetaRow
            items={[{ label: 'PWR', value: noCurrent ? '--' : `${powerW.toFixed(2)}W` }]}
            theme={theme}
          />
        </SensorCard>
      </View>

    

    </View>
  );
}

const createStyles = (theme: AppTheme, gap: number, isDesktop: boolean) =>
  StyleSheet.create({
    outerContainer: {
      gap,
      width: '100%'
    },
    row: {
      flexDirection: 'row',
      gap,
      alignItems: 'stretch',
      flexWrap: 'wrap'
    }
  });
