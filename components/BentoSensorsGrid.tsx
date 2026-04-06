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
  title?: string;
  subtitle?: string;
}

// ─── Disconnected overlay ────────────────────────────────────────────────────

function DisconnectedOverlay({ theme }: { theme: AppTheme }) {
  return (
    <View style={disconnectedStyles.overlay}>
      <Ionicons name="cloud-offline-outline" size={22} color={theme.colors.muted} />
      <Text style={[{ ...theme.type.bodySm, letterSpacing: 0.5, fontWeight: '500' }, { color: theme.colors.muted, fontFamily: theme.font.medium }]}>
        Fără date
      </Text>
    </View>
  );
}

const disconnectedStyles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    zIndex: 2,
    flexDirection: 'column',
    backgroundColor: 'transparent'
  }
});

// ─── Accent stripe ───────────────────────────────────────────────────────────

function AccentStripe({ color }: { color: string }) {
  const id = `stripe_${color.replace('#', '')}`;
  return (
    <View style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 2, overflow: 'hidden', borderTopLeftRadius: 18, borderTopRightRadius: 18 }}>
      <Svg width="100%" height="2" preserveAspectRatio="none">
        <Defs>
          <LinearGradient id={id} x1="0%" y1="0%" x2="100%" y2="0%">
            <Stop offset="0%" stopColor={color} stopOpacity={0} />
            <Stop offset="30%" stopColor={color} stopOpacity={0.6} />
            <Stop offset="70%" stopColor={color} stopOpacity={0.6} />
            <Stop offset="100%" stopColor={color} stopOpacity={0} />
          </LinearGradient>
        </Defs>
        <Rect x={0} y={0} width="100%" height="2" fill={`url(#${id})`} />
      </Svg>
    </View>
  );
}

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
      {!isDisconnected && <AccentStripe color={iconColor} />}
      <View style={s.header}>
        <View style={[s.iconWrap, { backgroundColor: isDisconnected ? 'transparent' : `${iconColor}15` }]}>
          <Ionicons name={icon} size={14} color={isDisconnected ? theme.colors.muted : iconColor} />
        </View>
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
      padding: theme.spacing.lg,
      height: 190,
      overflow: 'hidden',
      position: 'relative',
      ...theme.shadow.card
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: theme.spacing.xs,
      marginBottom: theme.spacing.sm
    },
    iconWrap: {
      width: 26,
      height: 26,
      borderRadius: 7,
      alignItems: 'center',
      justifyContent: 'center'
    },
    labelText: {
      ...theme.type.caption,
      letterSpacing: 1.2,
      color: theme.colors.textSoft,
      fontFamily: theme.font.bold
    }
  });

// ─── Typed card sub-components ───────────────────────────────────────────────

function BigValue({ value, unit, theme }: { value: string; unit?: string; theme: AppTheme }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 4 }}>
      <Text style={{ ...theme.type.cardValueLarge, color: theme.colors.text, fontFamily: theme.font.monoMedium }}>
        {value}
      </Text>
      {unit ? (
        <Text style={{ ...theme.type.cardValueLarge, color: theme.colors.text, fontFamily: theme.font.mono }}>
          {unit}
        </Text>
      ) : null}
    </View>
  );
}

function MetaRow({ items, theme }: { items: { label: string; value: string }[]; theme: AppTheme }) {
  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: theme.spacing.sm, marginTop: theme.spacing.sm }}>
      {items.map((item) => (
        <View key={item.label} style={{ flexDirection: 'column', gap: 2 }}>
          <Text style={{ ...theme.type.caption, color: theme.colors.muted, letterSpacing: 0.5 }}>
            {item.label}
          </Text>
          <Text style={{ ...theme.type.bodySm, color: theme.colors.text, fontFamily: theme.font.mono }}>
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
        paddingHorizontal: theme.spacing.sm,
        paddingVertical: 3,
        borderRadius: 999,
        backgroundColor: ok ? theme.accents.success : theme.accents.warning,
        marginTop: theme.spacing.xs
      }}
    >
      <Text style={{ ...theme.type.caption, fontFamily: theme.font.bold, color: ok ? theme.colors.success : theme.colors.warning, letterSpacing: 0.5 }}>
        {ok ? labelOk : labelFail}
      </Text>
    </View>
  );
}

// ─── Unique card visuals ─────────────────────────────────────────────────────

function TemperatureHeatLine({ value, max, theme }: { value: number; max: number; theme: AppTheme }) {
  const normalized = Math.max(0, Math.min(1, value / Math.max(1, max)));
  const fillPercent = normalized * 100;

  return (
    <View style={{ marginTop: 10, gap: 4 }}>
      <View
        style={{
          height: 6,
          borderRadius: 3,
          backgroundColor: theme.colors.surfaceMuted,
          overflow: 'hidden'
        }}
      >
        <View style={{ width: `${fillPercent.toFixed(1)}%` as `${number}%`, height: '100%' }}>
          <Svg width="100%" height="100%" preserveAspectRatio="none">
            <Defs>
              <LinearGradient id="tempGrad" x1="0%" y1="0%" x2="100%" y2="0%">
                <Stop offset="0%" stopColor="#38BDF8" />
                <Stop offset="35%" stopColor="#a3e635" />
                <Stop offset="60%" stopColor="#facc15" />
                <Stop offset="80%" stopColor="#f59e0b" />
                <Stop offset="100%" stopColor="#ef4444" />
              </LinearGradient>
            </Defs>
            <Rect x={0} y={0} width="100%" height="100%" rx={3} fill="url(#tempGrad)" />
          </Svg>
        </View>
      </View>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
        <Text style={{ ...theme.type.caption, color: theme.colors.muted }}>0°</Text>
        <Text style={{ ...theme.type.caption, color: theme.colors.muted }}>{max}°</Text>
      </View>
    </View>
  );
}

function VoltageRange({ value, min, max, theme }: { value: number; min: number; max: number; theme: AppTheme }) {
  const normalized = Math.max(0, Math.min(1, (value - min) / Math.max(0.01, max - min)));
  const pct = (normalized * 100).toFixed(1);
  return (
    <View style={{ marginTop: 10, gap: 4 }}>
      <View style={{ height: 6, borderRadius: 3, backgroundColor: theme.colors.surfaceMuted, overflow: 'hidden' }}>
        <View style={{ width: `${pct}%` as `${number}%`, height: '100%', backgroundColor: theme.chart.palette.voltage, borderRadius: 3, opacity: 0.8 }} />
      </View>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
        <Text style={{ ...theme.type.caption, color: theme.colors.muted }}>{min}V</Text>
        <Text style={{ ...theme.type.caption, color: theme.colors.muted }}>{max}V</Text>
      </View>
    </View>
  );
}

function CpuBar({ percent, theme }: { percent: number; theme: AppTheme }) {
  const clamped = Math.min(100, Math.max(0, percent));
  return (
    <View style={{ marginTop: 10 }}>
      <View style={{ height: 6, borderRadius: 3, backgroundColor: theme.colors.surfaceMuted, overflow: 'hidden' }}>
        <View style={{ width: `${clamped}%` as `${number}%`, height: '100%' }}>
          <Svg width="100%" height="100%" preserveAspectRatio="none">
            <Defs>
              <LinearGradient id="cpuGrad" x1="0%" y1="0%" x2="100%" y2="0%">
                <Stop offset="0%" stopColor={theme.chart.palette.cpu} stopOpacity={0.4} />
                <Stop offset="100%" stopColor={theme.chart.palette.cpu} />
              </LinearGradient>
            </Defs>
            <Rect x={0} y={0} width="100%" height="100%" rx={3} fill="url(#cpuGrad)" />
          </Svg>
        </View>
      </View>
    </View>
  );
}

function BatterySegments({ percent, theme }: { percent: number; theme: AppTheme }) {
  const segments = 5;
  const filled = Math.ceil((percent / 100) * segments);
  const color = percent > 20 ? theme.colors.success : theme.colors.warning;
  return (
    <View style={{ flexDirection: 'row', gap: 3, marginTop: 10 }}>
      {Array.from({ length: segments }).map((_, i) => (
        <View
          key={i}
          style={{
            flex: 1,
            height: 6,
            borderRadius: 2,
            backgroundColor: i < filled ? color : theme.colors.surfaceMuted,
            opacity: i < filled ? 0.5 + ((i + 1) / segments) * 0.5 : 0.3
          }}
        />
      ))}
    </View>
  );
}

function MiniSignalBars({ rssi, theme }: { rssi: number; theme: AppTheme }) {
  const strength = rssi >= -50 ? 4 : rssi >= -65 ? 3 : rssi >= -75 ? 2 : 1;
  return (
    <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 2 }}>
      {[1, 2, 3, 4].map((level) => (
        <View
          key={level}
          style={{
            width: 3,
            height: 4 + level * 3,
            borderRadius: 1.5,
            backgroundColor: level <= strength ? theme.chart.palette.rssi : theme.colors.surfaceMuted
          }}
        />
      ))}
    </View>
  );
}

function PowerMeter({ watts, maxWatts, theme }: { watts: number; maxWatts: number; theme: AppTheme }) {
  const normalized = Math.max(0, Math.min(1, watts / Math.max(0.01, maxWatts)));
  return (
    <View style={{ marginTop: 10 }}>
      <View style={{ height: 6, borderRadius: 3, backgroundColor: theme.colors.surfaceMuted, overflow: 'hidden' }}>
        <View style={{ width: `${(normalized * 100).toFixed(1)}%` as `${number}%`, height: '100%' }}>
          <Svg width="100%" height="100%" preserveAspectRatio="none">
            <Defs>
              <LinearGradient id="powerGrad" x1="0%" y1="0%" x2="100%" y2="0%">
                <Stop offset="0%" stopColor={theme.chart.palette.current} stopOpacity={0.3} />
                <Stop offset="100%" stopColor={theme.chart.palette.current} />
              </LinearGradient>
            </Defs>
            <Rect x={0} y={0} width="100%" height="100%" rx={3} fill="url(#powerGrad)" />
          </Svg>
        </View>
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
    flexBasis: isDesktop
      ? undefined
      : fraction >= 2
        ? '100%'
        : '48%',
    maxWidth: isDesktop
      ? undefined
      : fraction >= 2
        ? '100%'
        : '48%',
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
    if (db >= -50) return 'Excelent';
    if (db >= -65) return 'Bun';
    if (db >= -75) return 'Mediu';
    return 'Slab';
  };

  const s = useMemo(() => createStyles(theme, gap, isDesktop), [theme, gap, isDesktop]);

  return (
    <View style={[s.outerContainer, isDesktop && { alignSelf: 'center', width: '100%' }]}>

      {/* ─ Row 1: Temperature (large) + Voltage + Current ────────────────── */}
      <View style={s.row}>

        {/* Temperature — takes 2 flex units */}
        <SensorCard
          label="Temperatură"
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
          />
          <TemperatureHeatLine
            value={noTemp ? 0 : temp}
            max={35}
            theme={theme}
          />
          <StatusPill
            ok={temp < 40}
            labelOk="Normal"
            labelFail="Ridicat"
            theme={theme}
          />
        </SensorCard>

        {/* Voltage */}
        <SensorCard
          label="Tensiune"
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
          />
          <VoltageRange value={noVolt ? 0 : volt} min={3.0} max={4.2} theme={theme} />
        </SensorCard>

        {/* CPU */}
        <SensorCard
          label="Procesor"
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
          />
          <CpuBar percent={noCpu ? 0 : cpu} theme={theme} />
        </SensorCard>
        
      </View>

      {/* ─ Row 2: WiFi (wide) + Battery + CPU ───────────────────────────── */}
      <View style={s.row}>

        {/* WiFi */}
        <SensorCard
          label="Wi-Fi"
          icon="wifi-outline"
          iconColor={theme.chart.palette.rssi}
          isDisconnected={noWifi}
          theme={theme}
          style={col(3)}
        >
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
            <View style={{ flexDirection: 'column', gap: 2, flex: 1 }}>
              <Text style={{ ...theme.type.caption, color: theme.colors.muted, letterSpacing: 0.5 }}>
                REȚEA
              </Text>
              <Text style={{ ...theme.type.sectionTitle, lineHeight: 22, fontFamily: theme.font.mono, color: theme.colors.text, fontWeight: '600' }} numberOfLines={1}>
                {noWifi ? '--' : data?.ssid ?? '--'}
              </Text>
            </View>
            {!noWifi && <MiniSignalBars rssi={rssi} theme={theme} />}
          </View>
          <MetaRow
            items={[
              { label: 'IP', value: noWifi ? '--' : (data?.ip ?? '--') },
              { label: 'RSSI', value: noWifi ? '--' : `${Math.round(rssi)} dBm` },
              { label: 'SEMNAL', value: noWifi ? '--' : rssiQuality(rssi) },
              { label: 'CH', value: noWifi ? '--' : String(data?.channel ?? '--') },
              { label: 'MAC', value: noWifi ? '--' : (data?.mac ?? '--') }
            ]}
            theme={theme}
          />
        </SensorCard>

        {/* Battery */}
        <SensorCard
          label="Baterie"
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
          />
          <BatterySegments percent={noBattery ? 0 : batteryPercent} theme={theme} />
          <MetaRow
            items={[{ label: 'ESTIMAT', value: noBattery ? '--' : `${(batteryLifeMin / 60).toFixed(1)}h` }]}
            theme={theme}
          />
        </SensorCard>

        {/* Current */}
        <SensorCard
          label="Curent"
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
          />
          <PowerMeter watts={noCurrent ? 0 : powerW} maxWatts={2} theme={theme} />
          <MetaRow
            items={[{ label: 'PUTERE', value: noCurrent ? '--' : `${powerW.toFixed(2)}W` }]}
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
