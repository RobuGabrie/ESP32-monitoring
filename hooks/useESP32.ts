import { format } from 'date-fns';
import { useCallback, useEffect, useMemo, useRef } from 'react';
import axios from 'axios';
import mqtt, { MqttClient } from 'mqtt';
import { Buffer } from 'buffer';
import process from 'process';

import {
  HISTORY_LIMIT,
  MQTT_BROKER,
  MQTT_CMD_TOPIC,
  MQTT_PASS,
  MQTT_RAW_TOPIC,
  MQTT_STATE_TOPIC,
  MQTT_TOPIC,
  MQTT_USER,
  MQTT_WS_PROTOCOL,
  MQTT_WS_PORT,
  SUPABASE_ANON_KEY,
  SUPABASE_URL,
  USE_MOCK
} from '@/constants/config';
import { ESP32Data, IOLogEntry, ModuleName, TimeRangeKey, getStoreState, useStore } from '@/hooks/useStore';

if (!globalThis.Buffer) {
  (globalThis as typeof globalThis & { Buffer: typeof Buffer }).Buffer = Buffer;
}

if (!globalThis.process) {
  (globalThis as typeof globalThis & { process: typeof process }).process = process;
}

const random = (n = 1) => Math.random() * n;

const toNumber = (value: unknown, fallback = 0) => {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === 'string') {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }

  return fallback;
};

const toBinary = (value: unknown): 0 | 1 => (toNumber(value, 0) > 0 ? 1 : 0);

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

const toEpochMs = (value: unknown, fallback = Date.now()) => {
  if (typeof value === 'number' && Number.isFinite(value)) {
    if (value > 1_000_000_000_000) {
      return value;
    }
    if (value > 1_000_000_000) {
      return value * 1000;
    }
    return value;
  }

  if (typeof value === 'string' && value.trim()) {
    const s = value.trim();
    if (/^\d+(\.\d+)?$/.test(s)) {
      const raw = Number(s);
      if (Number.isFinite(raw)) {
        if (raw > 1_000_000_000_000) {
          return raw;
        }
        if (raw > 1_000_000_000) {
          return raw * 1000;
        }
      }
    }

    const direct = Date.parse(s);
    if (Number.isFinite(direct)) {
      return direct;
    }

    // Common ESP format: YYYY-MM-DD HH:mm:ss
    const m = s.match(/^(\d{4})-(\d{2})-(\d{2})\s(\d{2}):(\d{2}):(\d{2})$/);
    if (m) {
      const parsed = new Date(
        Number(m[1]),
        Number(m[2]) - 1,
        Number(m[3]),
        Number(m[4]),
        Number(m[5]),
        Number(m[6])
      ).getTime();
      if (Number.isFinite(parsed)) {
        return parsed;
      }
    }

    const parsed = Date.parse(s.replace(' ', 'T'));
    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }

  return fallback;
};

// LDR on this board is inverted: lower ADC means brighter, higher ADC means darker.
const toPercentFrom255 = (value: number) => ((255 - clamp(value, 0, 255)) / 255) * 100;

const normalizeGpioRecord = (payload: Record<string, unknown>) => {
  const out: Record<string, number> = {};

  Object.entries(payload).forEach(([key, value]) => {
    const n = toNumber(value, Number.NaN);
    if (Number.isFinite(n)) {
      out[key.toLowerCase()] = n;
    }
  });

  return out;
};

const normalizeRawRecord = (payload: unknown) => {
  if (!payload || typeof payload !== 'object') {
    return {} as Record<string, number>;
  }
  return normalizeGpioRecord(payload as Record<string, unknown>);
};

const normalizeRawIoPayload = (payload: unknown) => {
  if (!payload || typeof payload !== 'object') {
    return null;
  }

  const rec = payload as Record<string, unknown>;
  const gpio = normalizeRawRecord(rec.gpio);
  const pcf8591Raw = normalizeRawRecord(rec.pcf8591_raw);
  const ina219Raw = normalizeRawRecord(rec.ina219_raw);

  if (!Object.keys(gpio).length && !Object.keys(pcf8591Raw).length && !Object.keys(ina219Raw).length) {
    return null;
  }

  const ts = extractTimestamp(rec) ?? format(new Date(), 'HH:mm:ss.SSS');
  return { ts, gpio, pcf8591Raw, ina219Raw };
};

const normalizePayload = (payload: unknown): ESP32Data | null => {
  if (!payload || typeof payload !== 'object') {
    return null;
  }

  const rec = payload as Record<string, unknown>;
  const gpioRec = (rec.gpio as Record<string, unknown> | undefined) ?? {};
  const normalizedGpio = normalizeGpioRecord(gpioRec);

  // Backward compatibility for payloads that expose gpio fields at root level.
  Object.entries(rec).forEach(([key, value]) => {
    const lower = key.toLowerCase();
    if (lower.startsWith('gpio') || lower.startsWith('adc')) {
      const n = toNumber(value, Number.NaN);
      if (Number.isFinite(n)) {
        normalizedGpio[lower] = n;
      }
    }
  });

  if (!Object.keys(normalizedGpio).length) {
    // Keep GPIO empty when payload does not provide real I/O fields.
    // Raw GPIO data is consumed from the dedicated MQTT raw topic.
  }

  const rawReading = toNumber(rec.light_raw ?? rec.ldr, Number.NaN);
  const genericLight = toNumber(rec.light ?? rec.lux, Number.NaN);
  const explicitPercent = toNumber(rec.light_percent ?? rec.ldr_pct, Number.NaN);

  const lightPercent = Number.isFinite(explicitPercent)
    ? clamp(explicitPercent, 0, 100)
    : Number.isFinite(rawReading)
      ? toPercentFrom255(rawReading)
      : Number.isFinite(genericLight)
        ? genericLight <= 100
          ? clamp(genericLight, 0, 100)
          : toPercentFrom255(genericLight)
        : 0;

  const lightRaw = Number.isFinite(rawReading)
    ? Math.round(clamp(rawReading, 0, 255))
    : Math.round(((100 - clamp(lightPercent, 0, 100)) / 100) * 255);

  return {
    timestamp: typeof rec.timestamp === 'string' ? rec.timestamp : typeof rec.ts === 'string' ? rec.ts : '',
    recordedAtMs: toEpochMs(rec.created_at ?? rec.timestamp ?? rec.ts, Date.now()),
    uptime: Math.round(toNumber(rec.uptime ?? rec.up, 0)),
    temp: toNumber(rec.temp ?? rec.temperature, 0),
    light: lightPercent,
    lightRaw,
    lightPercent,
    cpu: toNumber(rec.cpu ?? rec.cpuLoad ?? rec.cpu_load, 0),
    volt: toNumber(rec.volt ?? rec.voltage ?? rec.v, 0),
    current: toNumber(rec.current ?? rec.currentMa ?? rec.current_ma ?? rec.ma, 0),
    powerMw: toNumber(rec.power_mw ?? rec.mw, 0),
    totalMah: toNumber(rec.total_mah ?? rec.mah, 0),
    batteryPercent: toNumber(rec.battery_percent ?? rec.batt, 0),
    batteryLifeMin: toNumber(rec.battery_life_min ?? rec.batt_min, 0),
    rssi: toNumber(rec.rssi ?? rec.wifi_rssi, -99),
    gpio: normalizedGpio,
    ssid: typeof rec.ssid === 'string' ? rec.ssid : typeof rec.wifi_ssid === 'string' ? rec.wifi_ssid : '--',
    ip: typeof rec.ip === 'string' ? rec.ip : typeof rec.wifi_ip === 'string' ? rec.wifi_ip : '--',
    mac: typeof rec.mac === 'string' ? rec.mac : typeof rec.wifi_mac === 'string' ? rec.wifi_mac : '--',
    channel: Math.round(toNumber(rec.channel ?? rec.wifi_channel, 0))
  };
};

const extractTimestamp = (payload: unknown) => {
  if (!payload || typeof payload !== 'object') {
    return null;
  }

  const rec = payload as Record<string, unknown>;
  if (typeof rec.timestamp === 'string') {
    return rec.timestamp;
  }
  return typeof rec.ts === 'string' ? rec.ts : null;
};

const isModuleName = (value: unknown): value is ModuleName => {
  return value === 'temperature' || value === 'light' || value === 'cpu' || value === 'current';
};

const normalizeStatePayload = (payload: unknown) => {
  if (!payload || typeof payload !== 'object') {
    return null;
  }

  const rec = payload as Record<string, unknown>;
  const next: Partial<ReturnType<typeof getStoreState>['moduleStates']> = {};

  const moduleName = rec.module;
  if (isModuleName(moduleName) && typeof rec.enabled === 'boolean') {
    next[moduleName] = rec.enabled;
  }
  if (moduleName === 'cpu_stress' && typeof rec.enabled === 'boolean') {
    next.cpuStress = rec.enabled;
  }

  const modules = rec.modules;
  if (modules && typeof modules === 'object') {
    const m = modules as Record<string, unknown>;
    (['temperature', 'light', 'cpu', 'current'] as ModuleName[]).forEach((key) => {
      if (typeof m[key] === 'boolean') {
        next[key] = m[key] as boolean;
      }
    });
    if (typeof m.cpu_stress === 'boolean') {
      next.cpuStress = m.cpu_stress;
    }
  }

  return Object.keys(next).length ? next : null;
};

const mockData = (t: number): ESP32Data => {
  const lightRaw = Math.round(clamp(130 + 90 * Math.sin(t / 20) + random(10), 0, 255));
  const lightPercent = toPercentFrom255(lightRaw);

  return {
  timestamp: '',
    recordedAtMs: Date.now(),
  uptime: t,
  temp: 22 + 4 * Math.sin(t / 30) + random(0.5),
  lightRaw,
  lightPercent,
  light: lightPercent,
  cpu: 15 + 20 * Math.abs(Math.sin(t / 10)) + random(5),
  volt: 3.28 + 0.1 * Math.sin(t / 60),
  current: 80 + 40 * Math.abs(Math.sin(t / 8)) + random(10),
  powerMw: (3.28 + 0.1 * Math.sin(t / 60)) * (80 + 40 * Math.abs(Math.sin(t / 8)) + random(10)),
  totalMah: Math.max(0, t * 0.03),
  batteryPercent: Math.max(0, Math.min(100, 95 - t * 0.01)),
  batteryLifeMin: Math.max(0, Math.round(1500 - t * 0.2)),
  rssi: -55 - 10 * Math.abs(Math.sin(t / 40)),
  gpio: {
    gpio2: Math.sin(t / 5) > 0 ? 1 : 0,
    gpio3: Math.sin(t / 7) > 0 ? 1 : 0,
    gpio4: Math.sin(t / 9) > 0 ? 1 : 0,
    gpio5: Math.sin(t / 4) > 0 ? 1 : 0,
    gpio12: Math.sin(t / 11) > 0 ? 1 : 0,
    gpio13: Math.sin(t / 13) > 0 ? 1 : 0,
    gpio14: Math.sin(t / 15) > 0 ? 1 : 0,
    gpio15: Math.sin(t / 17) > 0 ? 1 : 0,
    adc0: Math.round(3200 + 120 * Math.sin(t / 6) + random(50)),
    adc1: Math.round(1800 + 100 * Math.sin(t / 8) + random(40))
  },
  ssid: 'ESP32-C3-LAB',
  ip: '192.168.1.155',
  mac: '24:6F:28:AB:CD:EF',
  channel: 6
  };
};

const endpoints = [
  { protocol: MQTT_WS_PROTOCOL, port: MQTT_WS_PORT, useAuth: true },
  { protocol: MQTT_WS_PROTOCOL, port: MQTT_WS_PORT, useAuth: false },
  { protocol: 'ws', port: 8083, useAuth: true },
  { protocol: 'ws', port: 8083, useAuth: false }
] as const;

let sharedClient: MqttClient | null = null;
let sharedReconnectTimer: ReturnType<typeof setTimeout> | null = null;
let sharedStaleTimer: ReturnType<typeof setInterval> | null = null;
let sharedMockTimer: ReturnType<typeof setInterval> | null = null;
let sharedEndpointIndex = 0;
let sharedLastMessageAt = 0;
let sharedLastRawTs = '';
let sharedLastRawAtMs = 0;
let sharedTick = 0;
let sharedInitialized = false;
let sharedHistoryLoaded = false;

interface SupabaseReadingRow {
  created_at: string;
  device_ts: string;
  uptime_s: number;
  temp_c: number | null;
  ldr_raw: number | null;
  ldr_pct: number | null;
  rssi_dbm: number | null;
  cpu_pct: number | null;
  voltage_v: number | null;
  current_ma: number | null;
  power_mw: number | null;
  used_mah: number | null;
  battery_pct: number | null;
  battery_min: number | null;
}

const buildHistoryEntry = (row: SupabaseReadingRow): ESP32Data => {
  const lightPercent = toNumber(row.ldr_pct, 0);
  const lightRaw = toNumber(row.ldr_raw, Math.round(((100 - clamp(lightPercent, 0, 100)) / 100) * 255));

  return {
    timestamp: row.device_ts || row.created_at,
    recordedAtMs: toEpochMs(row.created_at, Date.now()),
    uptime: Math.max(0, Math.round(toNumber(row.uptime_s, 0))),
    temp: toNumber(row.temp_c, 0),
    light: clamp(lightPercent, 0, 100),
    lightRaw: Math.round(clamp(lightRaw, 0, 255)),
    lightPercent: clamp(lightPercent, 0, 100),
    cpu: toNumber(row.cpu_pct, 0),
    volt: toNumber(row.voltage_v, 0),
    current: toNumber(row.current_ma, 0),
    powerMw: toNumber(row.power_mw, 0),
    totalMah: toNumber(row.used_mah, 0),
    batteryPercent: toNumber(row.battery_pct, 0),
    batteryLifeMin: toNumber(row.battery_min, 0),
    rssi: toNumber(row.rssi_dbm, -99),
    gpio: {},
    ssid: '--',
    ip: '--',
    mac: '--',
    channel: 0
  };
};

const buildHistoryLog = (row: SupabaseReadingRow): IOLogEntry => {
  const created = row.created_at ? new Date(row.created_at) : new Date();
  const ts = format(created, 'HH:mm:ss');

  const rawText = [
    `DB ts=${row.device_ts || '--'} up=${Math.round(toNumber(row.uptime_s, 0))}s`,
    `temp_c=${toNumber(row.temp_c, 0).toFixed(2)} ldr_raw=${Math.round(toNumber(row.ldr_raw, 0))} ldr_pct=${toNumber(row.ldr_pct, 0).toFixed(2)}`,
    `rssi_dbm=${Math.round(toNumber(row.rssi_dbm, -99))} cpu_pct=${toNumber(row.cpu_pct, 0).toFixed(2)}`,
    `voltage_v=${toNumber(row.voltage_v, 0).toFixed(3)} current_ma=${toNumber(row.current_ma, 0).toFixed(2)} power_mw=${toNumber(row.power_mw, 0).toFixed(2)}`,
    `used_mah=${toNumber(row.used_mah, 0).toFixed(2)} battery_pct=${toNumber(row.battery_pct, 0).toFixed(1)} battery_min=${Math.round(toNumber(row.battery_min, 0))}`
  ].join(' | ');

  return {
    ts,
    timeMs: created.getTime(),
    temp: toNumber(row.temp_c, 0),
    light: toNumber(row.ldr_pct, 0),
    gpio: {},
    source: 'history',
    rawText
  };
};

const loadSupabaseHistory = async () => {
  if (sharedHistoryLoaded || USE_MOCK) {
    return;
  }

  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    return;
  }

  try {
    const response = await axios.get<SupabaseReadingRow[]>(`${SUPABASE_URL}/rest/v1/sensor_readings`, {
      headers: {
        apikey: SUPABASE_ANON_KEY,
        Authorization: `Bearer ${SUPABASE_ANON_KEY}`
      },
      params: {
        select:
          'created_at,device_ts,uptime_s,temp_c,ldr_raw,ldr_pct,rssi_dbm,cpu_pct,voltage_v,current_ma,power_mw,used_mah,battery_pct,battery_min',
        order: 'created_at.desc',
        limit: HISTORY_LIMIT
      }
    });

    const rows = (response.data ?? []).slice().reverse();
    if (!rows.length) {
      sharedHistoryLoaded = true;
      return;
    }

    const readings = rows.map(buildHistoryEntry);
    const logs = rows.map(buildHistoryLog);
    getStoreState().hydrateHistory(readings, logs);
    sharedHistoryLoaded = true;
  } catch {
    // Keep live stream functional even when history API fails.
  }
};

const buildZeroReadingFromStore = (): ESP32Data => {
  const previous = getStoreState().data;
  return {
    timestamp: previous?.timestamp ?? '',
    recordedAtMs: previous?.recordedAtMs ?? Date.now(),
    uptime: previous?.uptime ?? 0,
    temp: 0,
    light: 0,
    lightRaw: 0,
    lightPercent: 0,
    cpu: 0,
    volt: 0,
    current: 0,
    powerMw: 0,
    totalMah: previous?.totalMah ?? 0,
    batteryPercent: previous?.batteryPercent ?? 0,
    batteryLifeMin: previous?.batteryLifeMin ?? 0,
    rssi: previous?.rssi ?? -99,
    gpio: Object.fromEntries(
      Object.keys(
        previous?.gpio ?? {
          gpio2: 0,
          gpio3: 0,
          gpio4: 0,
          gpio5: 0,
          gpio12: 0,
          gpio13: 0,
          gpio14: 0,
          gpio15: 0,
          adc0: 0,
          adc1: 0
        }
      ).map((key) => [key, 0])
    ),
    ssid: previous?.ssid ?? '--',
    ip: previous?.ip ?? '--',
    mac: previous?.mac ?? '--',
    channel: previous?.channel ?? 0
  };
};

const closeSharedClient = () => {
  if (!sharedClient) {
    return;
  }
  sharedClient.removeAllListeners();
  sharedClient.end(true);
  sharedClient = null;
};

const clearSharedReconnect = () => {
  if (sharedReconnectTimer) {
    clearTimeout(sharedReconnectTimer);
    sharedReconnectTimer = null;
  }
};

const scheduleSharedReconnect = () => {
  if (sharedReconnectTimer) {
    return;
  }

  sharedReconnectTimer = setTimeout(() => {
    sharedReconnectTimer = null;
    connectSharedMQTT();
  }, 1500);
};

const connectSharedMQTT = () => {
  closeSharedClient();

  const endpoint = endpoints[sharedEndpointIndex % endpoints.length];
  const url = `${endpoint.protocol}://${MQTT_BROKER}:${endpoint.port}/mqtt`;

  const options = {
    clean: true,
    connectTimeout: 12_000,
    keepalive: 30,
    reconnectPeriod: 0,
    clientId: `hardnsoft_${Math.random().toString(16).slice(2, 10)}`,
    manualConnect: true,
    ...(endpoint.useAuth ? { username: MQTT_USER, password: MQTT_PASS } : {})
  };

  const client = mqtt.connect(url, options);
  let hasConnected = false;
  let handledDisconnect = false;

  const advanceEndpoint = () => {
    sharedEndpointIndex = (sharedEndpointIndex + 1) % endpoints.length;
  };

  const handleDisconnect = (advance: boolean) => {
    if (handledDisconnect) {
      return;
    }
    handledDisconnect = true;
    if (advance) {
      advanceEndpoint();
    }
    getStoreState().setConnectionStatus('offline');
    scheduleSharedReconnect();
  };

  sharedClient = client;

  const rawStream = (client as unknown as { stream?: { on?: (event: string, listener: (...args: unknown[]) => void) => void } }).stream;
  rawStream?.on?.('error', () => {
    handleDisconnect(true);
  });

  client.on('connect', () => {
    hasConnected = true;
    sharedLastMessageAt = Date.now();
    clearSharedReconnect();
    getStoreState().setConnectionStatus('online');
    client.subscribe([MQTT_TOPIC, MQTT_RAW_TOPIC, MQTT_STATE_TOPIC], (err) => {
      if (err) {
        handleDisconnect(true);
      }
    });
  });

  client.on('message', (topic, payload) => {
    try {
      const parsed = JSON.parse(payload.toString());

      if (topic === MQTT_STATE_TOPIC) {
        const nextState = normalizeStatePayload(parsed);
        if (nextState) {
          getStoreState().setModuleStates(nextState);
        }
        return;
      }

      if (topic === MQTT_RAW_TOPIC) {
        const raw = normalizeRawIoPayload(parsed);
        if (!raw) {
          return;
        }

        if (raw.ts === sharedLastRawTs) {
          return;
        }
        sharedLastRawTs = raw.ts;
        sharedLastRawAtMs = Date.now();

        sharedLastMessageAt = Date.now();
        getStoreState().setConnectionStatus('online');
        const snapshot = getStoreState().data;
        getStoreState().addLog({
          ts: raw.ts,
          // Use client receive time for live filtering to avoid drops when device clock is wrong.
          timeMs: Date.now(),
          temp: snapshot?.temp ?? 0,
          light: snapshot?.lightPercent ?? snapshot?.light ?? 0,
          gpio: raw.gpio,
          pcf8591Raw: raw.pcf8591Raw,
          ina219Raw: raw.ina219Raw,
          source: 'live'
        });
        return;
      }

      const now = new Date();
      const reading = normalizePayload(parsed);
      if (!reading) {
        return;
      }

      sharedLastMessageAt = Date.now();
      getStoreState().setConnectionStatus('online');
      const ts = extractTimestamp(parsed) ?? format(now, 'HH:mm:ss.SSS');
      getStoreState().pushReading(reading, ts);

      // Fallback: if raw topic is missing/delayed, keep serial monitor alive with MQTT data topic lines.
      if (Date.now() - sharedLastRawAtMs > 3000) {
        getStoreState().addLog({
          ts: format(now, 'HH:mm:ss'),
          timeMs: Date.now(),
          temp: reading.temp,
          light: reading.light,
          gpio: reading.gpio,
          source: 'live',
          rawText: [
            `MQTT data ts=${reading.timestamp || '--'} up=${Math.round(reading.uptime)}s`,
            `temp=${reading.temp.toFixed(2)}C ldr_raw=${Math.round(reading.lightRaw)} ldr_pct=${reading.lightPercent.toFixed(2)}`,
            `rssi=${Math.round(reading.rssi)} cpu=${reading.cpu.toFixed(2)} v=${reading.volt.toFixed(3)} i=${reading.current.toFixed(2)} mA`
          ].join(' | ')
        });
      }
    } catch {
      // Ignore malformed payloads and keep the stream alive.
    }
  });

  client.on('close', () => {
    handleDisconnect(!hasConnected);
  });

  client.on('error', () => {
    handleDisconnect(true);
  });

  client.connect();
};

const ensureSharedConnection = () => {
  if (sharedInitialized) {
    return;
  }
  sharedInitialized = true;

  if (USE_MOCK) {
    const pushMock = () => {
      sharedTick += 1;
      const now = new Date();
      const ts = format(now, 'HH:mm:ss.SSS');
      getStoreState().setConnectionStatus('online');
      getStoreState().pushReading(mockData(sharedTick), ts);
    };

    pushMock();
    sharedMockTimer = setInterval(pushMock, 1000);
    return;
  }

  void loadSupabaseHistory();
  connectSharedMQTT();

  sharedStaleTimer = setInterval(() => {
    const last = sharedLastMessageAt;
    if (!last) {
      return;
    }

    const staleMs = Date.now() - last;
    if (staleMs >= 5000) {
      const ts = format(new Date(), 'HH:mm:ss.SSS');
      const socketConnected = Boolean(sharedClient?.connected);
      getStoreState().setConnectionStatus(socketConnected ? 'online' : 'offline');
      getStoreState().pushReading(buildZeroReadingFromStore(), ts);
      sharedLastMessageAt = Date.now();
    }
  }, 1000);
};

export const useESP32 = () => {
  const clientRef = useRef<MqttClient | null>(null);
  const setModuleState = useStore((s) => s.setModuleState);
  const setModuleStates = useStore((s) => s.setModuleStates);
  const data = useStore((s) => s.data);
  const tempHistory = useStore((s) => s.tempHistory);
  const lightHistory = useStore((s) => s.lightHistory);
  const cpuHistory = useStore((s) => s.cpuHistory);
  const currentHistory = useStore((s) => s.currentHistory);
  const voltHistory = useStore((s) => s.voltHistory);
  const rssiHistory = useStore((s) => s.rssiHistory);
  const historyTimeline = useStore((s) => s.historyTimeline);
  const status = useStore((s) => s.connectionStatus);
  const selectedRange = useStore((s) => s.selectedRange);
  const setTimeRange = useStore((s) => s.setTimeRange);
  const ioLog = useStore((s) => s.ioLog);
  const totalCurrentMah = useStore((s) => s.totalCurrentMah);
  const peakCurrent = useStore((s) => s.peakCurrent);
  const moduleStates = useStore((s) => s.moduleStates);

  useEffect(() => {
    ensureSharedConnection();
    clientRef.current = sharedClient;
  }, []);

  const publishCommand = useCallback((command: Record<string, unknown>) => {
    const client = sharedClient ?? clientRef.current;
    if (!client || !client.connected) {
      return false;
    }

    client.publish(MQTT_CMD_TOPIC, JSON.stringify(command));
    return true;
  }, []);

  const rangeMsMap: Record<Exclude<TimeRangeKey, 'all'>, number> = {
    '15m': 15 * 60 * 1000,
    '1h': 60 * 60 * 1000,
    '6h': 6 * 60 * 60 * 1000,
    '24h': 24 * 60 * 60 * 1000,
    '7d': 7 * 24 * 60 * 60 * 1000
  };

  const historyStartIndex = useMemo(() => {
    if (selectedRange === 'all') {
      return 0;
    }

    const cutoff = Date.now() - rangeMsMap[selectedRange];
    const idx = historyTimeline.findIndex((ms) => ms >= cutoff);
    return idx >= 0 ? idx : historyTimeline.length;
  }, [historyTimeline, selectedRange]);

  const history = useMemo(
    () => ({
      tempHistory: tempHistory.slice(historyStartIndex),
      lightHistory: lightHistory.slice(historyStartIndex),
      cpuHistory: cpuHistory.slice(historyStartIndex),
      currentHistory: currentHistory.slice(historyStartIndex),
      voltHistory: voltHistory.slice(historyStartIndex),
      rssiHistory: rssiHistory.slice(historyStartIndex),
      timeline: historyTimeline.slice(historyStartIndex)
    }),
    [tempHistory, lightHistory, cpuHistory, currentHistory, voltHistory, rssiHistory, historyTimeline, historyStartIndex]
  );

  const filteredLog = useMemo(() => {
    if (selectedRange === 'all') {
      return ioLog;
    }

    const cutoff = Date.now() - rangeMsMap[selectedRange];
    return ioLog.filter((entry) => (entry.timeMs ?? Date.now()) >= cutoff);
  }, [ioLog, selectedRange]);

  const sendModuleCommand = useCallback(
    (module: ModuleName, enabled: boolean) => {
      const published = publishCommand({ module, enabled });
      if (published) {
        setModuleState(module, enabled);
      }
      return published;
    },
    [publishCommand, setModuleState]
  );

  const sendCpuStressCommand = useCallback(
    (enabled: boolean) => {
      const published = publishCommand({ module: 'cpu_stress', enabled });
      if (published) {
        setModuleStates({ cpuStress: enabled });
      }
      return published;
    },
    [publishCommand, setModuleStates]
  );

  return {
    data,
    history,
    status,
    ioLog: filteredLog,
    selectedRange,
    setTimeRange,
    totalCurrentMah,
    peakCurrent,
    moduleStates,
    publishCommand,
    sendModuleCommand,
    sendCpuStressCommand
  };
};