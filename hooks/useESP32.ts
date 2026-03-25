import { format } from 'date-fns';
import { useCallback, useEffect, useMemo, useRef } from 'react';
import mqtt, { MqttClient } from 'mqtt';
import { Buffer } from 'buffer';
import process from 'process';

import {
  MQTT_BROKER,
  MQTT_CMD_TOPIC,
  MQTT_PASS,
  MQTT_STATE_TOPIC,
  MQTT_TOPIC,
  MQTT_USER,
  MQTT_WS_PROTOCOL,
  MQTT_WS_PORT,
  USE_MOCK
} from '@/constants/config';
import { ESP32Data, ModuleName, getStoreState, useStore } from '@/hooks/useStore';

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
    normalizedGpio.gpio2 = toBinary(rec.gpio2);
    normalizedGpio.gpio3 = toBinary(rec.gpio3);
    normalizedGpio.gpio4 = toBinary(rec.gpio4);
    normalizedGpio.gpio5 = toBinary(rec.gpio5);
    normalizedGpio.gpio12 = toBinary(rec.gpio12);
    normalizedGpio.gpio13 = toBinary(rec.gpio13);
    normalizedGpio.gpio14 = toBinary(rec.gpio14);
    normalizedGpio.gpio15 = toBinary(rec.gpio15);
    normalizedGpio.adc0 = Math.round(toNumber(rec.adc0, 0));
    normalizedGpio.adc1 = Math.round(toNumber(rec.adc1, 0));
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
  const next: Partial<Record<ModuleName, boolean>> = {};

  const moduleName = rec.module;
  if (isModuleName(moduleName) && typeof rec.enabled === 'boolean') {
    next[moduleName] = rec.enabled;
  }

  const modules = rec.modules;
  if (modules && typeof modules === 'object') {
    const m = modules as Record<string, unknown>;
    (['temperature', 'light', 'cpu', 'current'] as ModuleName[]).forEach((key) => {
      if (typeof m[key] === 'boolean') {
        next[key] = m[key] as boolean;
      }
    });
  }

  return Object.keys(next).length ? next : null;
};

const mockData = (t: number): ESP32Data => {
  const lightRaw = Math.round(clamp(130 + 90 * Math.sin(t / 20) + random(10), 0, 255));
  const lightPercent = toPercentFrom255(lightRaw);

  return {
  timestamp: '',
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
let sharedTick = 0;
let sharedInitialized = false;

const buildZeroReadingFromStore = (): ESP32Data => {
  const previous = getStoreState().data;
  return {
    timestamp: previous?.timestamp ?? '',
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
    client.subscribe([MQTT_TOPIC, MQTT_STATE_TOPIC], (err) => {
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

      const now = new Date();
      const reading = normalizePayload(parsed);
      if (!reading) {
        return;
      }

      sharedLastMessageAt = Date.now();
      getStoreState().setConnectionStatus('online');
      const ts = extractTimestamp(parsed) ?? format(now, 'HH:mm:ss.SSS');
      getStoreState().pushReading(reading, ts);
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
  const data = useStore((s) => s.data);
  const tempHistory = useStore((s) => s.tempHistory);
  const lightHistory = useStore((s) => s.lightHistory);
  const cpuHistory = useStore((s) => s.cpuHistory);
  const currentHistory = useStore((s) => s.currentHistory);
  const voltHistory = useStore((s) => s.voltHistory);
  const rssiHistory = useStore((s) => s.rssiHistory);
  const status = useStore((s) => s.connectionStatus);
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

  const history = useMemo(
    () => ({
      tempHistory,
      lightHistory,
      cpuHistory,
      currentHistory,
      voltHistory,
      rssiHistory
    }),
    [tempHistory, lightHistory, cpuHistory, currentHistory, voltHistory, rssiHistory]
  );

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

  return {
    data,
    history,
    status,
    ioLog,
    totalCurrentMah,
    peakCurrent,
    moduleStates,
    publishCommand,
    sendModuleCommand
  };
};
