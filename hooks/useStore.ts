import { useSyncExternalStore } from 'react';

import { ThemeMode } from '@/constants/theme';

export interface ESP32Data {
  timestamp: string;
  recordedAtMs?: number;
  uptime: number;
  temp: number;
  light: number;
  lightRaw: number;
  lightPercent: number;
  cpu: number;
  volt: number;
  current: number;
  powerMw: number;
  totalMah: number;
  batteryPercent: number;
  batteryLifeMin: number;
  rssi: number;
  gpio: Record<string, number>;
  ssid: string;
  ip: string;
  mac: string;
  channel: number;
  // MPU9250 IMU data
  accelX?: number;
  accelY?: number;
  accelZ?: number;
  gyroX?: number;
  gyroY?: number;
  gyroZ?: number;
  dtMs?: number;
  stationary?: boolean;
  zupt?: boolean;
  q0?: number;
  q1?: number;
  q2?: number;
  q3?: number;
  roll?: number;
  pitch?: number;
  yaw?: number;
  quaternionNorm?: number;
  imuRateHz?: number;
  imuMode?: string;
  motionMode?: string;
  linAx?: number;
  linAy?: number;
  linAz?: number;
  velX?: number;
  velY?: number;
  velZ?: number;
  posX?: number;
  posY?: number;
  posZ?: number;
  gravX?: number;
  gravY?: number;
  gravZ?: number;
}

export type ConnectionStatus = 'online' | 'offline';
export type ModuleName = 'temperature' | 'light' | 'cpu' | 'current';
export type TimeRangeKey = '60s' | '15m' | '1h' | '6h' | '24h' | '7d' | 'all';

export interface ModuleStates {
  temperature: boolean;
  light: boolean;
  cpu: boolean;
  current: boolean;
  cpuStress: boolean;
}

export interface IOLogEntry {
  ts: string;
  timeMs?: number;
  temp: number;
  light: number;
  gpio: Record<string, number>;
  pcf8591Raw?: Record<string, number>;
  ina219Raw?: Record<string, number>;
  source?: 'live' | 'history';
  rawText?: string;
}

export interface WifiScanNetwork {
  ssid: string;
  rssi: number;
  auth?: string;
}

export interface CommandAck {
  id: string;
  action?: string;
  status: string;
  message?: string;
  ts?: string;
}

const HISTORY_CAP = 2000;
const LOG_CAP = 1200;

const cap = (arr: number[], next: number, max = HISTORY_CAP) => {
  if (arr.length < max) {
    return arr.concat(next);
  }

  const out = arr.slice(1);
  out.push(next);
  return out;
};

const capLog = (arr: IOLogEntry[], next: IOLogEntry, max = LOG_CAP) => {
  if (arr.length < max) {
    return arr.concat(next);
  }

  const out = arr.slice(1);
  out.push(next);
  return out;
};

interface StoreState {
  data: ESP32Data | null;
  tempHistory: number[];
  lightHistory: number[];
  cpuHistory: number[];
  currentHistory: number[];
  voltHistory: number[];
  rssiHistory: number[];
  powerHistory: number[];
  historyTimeline: number[];
  totalCurrentMah: number;
  peakCurrent: number;
  moduleStates: ModuleStates;
  connectionStatus: ConnectionStatus;
  mqttStatus: ConnectionStatus;
  selectedRange: TimeRangeKey;
  themeMode: ThemeMode;
  ioLog: IOLogEntry[];
  wifiScanNetworks: WifiScanNetwork[] | null;
  lastCommandAck: CommandAck | null;
  pushReading: (data: ESP32Data, ts: string) => void;
  setConnectionStatus: (status: ConnectionStatus) => void;
  setMqttStatus: (status: ConnectionStatus) => void;
  setModuleState: (module: ModuleName, enabled: boolean) => void;
  setModuleStates: (states: Partial<ModuleStates>) => void;
  setTimeRange: (range: TimeRangeKey) => void;
  setThemeMode: (mode: ThemeMode) => void;
  toggleThemeMode: () => void;
  addLog: (entry: IOLogEntry) => void;
  setWifiScanNetworks: (networks: WifiScanNetwork[] | null) => void;
  setLastCommandAck: (ack: CommandAck | null) => void;
  setImuFrame: (frame: Partial<ESP32Data>) => void;
  hydrateHistory: (readings: ESP32Data[], logs: IOLogEntry[]) => void;
  reset: () => void;
}

type StoreData = Omit<
  StoreState,
  | 'pushReading'
  | 'setConnectionStatus'
  | 'setModuleState'
  | 'setModuleStates'
  | 'setTimeRange'
  | 'setThemeMode'
  | 'toggleThemeMode'
  | 'addLog'
  | 'setWifiScanNetworks'
  | 'setLastCommandAck'
  | 'setImuFrame'
  | 'hydrateHistory'
  | 'reset'
>;

const emptyReading = (): ESP32Data => ({
  timestamp: '',
  recordedAtMs: Date.now(),
  uptime: 0,
  temp: 0,
  light: 0,
  lightRaw: 0,
  lightPercent: 0,
  cpu: 0,
  volt: 0,
  current: 0,
  powerMw: 0,
  totalMah: 0,
  batteryPercent: 0,
  batteryLifeMin: 0,
  rssi: -99,
  gpio: {},
  ssid: '--',
  ip: '--',
  mac: '--',
  channel: 0
});

const baseData = (): StoreData => ({
  data: null,
  tempHistory: [],
  lightHistory: [],
  cpuHistory: [],
  currentHistory: [],
  voltHistory: [],
  rssiHistory: [],
  powerHistory: [],
  historyTimeline: [],
  totalCurrentMah: 0,
  peakCurrent: 0,
  moduleStates: {
    temperature: true,
    light: true,
    cpu: true,
    current: true,
    cpuStress: false
  },
  connectionStatus: 'offline',
  mqttStatus: 'offline',
  selectedRange: '60s',
  themeMode: 'dark',
  ioLog: [],
  wifiScanNetworks: null,
  lastCommandAck: null,
  setMqttStatus: function (status: ConnectionStatus): void {
    throw new Error('Function not implemented.');
  }
});

const listeners = new Set<() => void>();

let storeData: StoreData = baseData();

// Batch all synchronous store mutations within the same JS task into a single
// listener notification. This prevents 3+ separate re-render waves when an
// MQTT message triggers setConnectionStatus + setMqttStatus + pushReading in
// sequence, and stops IMU WebSocket frames from causing multiple render cycles
// per tick.
let emitQueued = false;
const emit = () => {
  if (emitQueued) return;
  emitQueued = true;
  Promise.resolve().then(() => {
    emitQueued = false;
    listeners.forEach((listener) => listener());
  });
};

const setData = (patch: Partial<StoreData>) => {
  storeData = { ...storeData, ...patch };
  emit();
};

const actions = {
  pushReading: (data: ESP32Data, ts: string) => {
    const current = storeData;
    const sampleTime = data.recordedAtMs ?? Date.now();
    setData({
      data,
      tempHistory: cap(current.tempHistory, data.temp),
      lightHistory: cap(current.lightHistory, data.light),
      cpuHistory: cap(current.cpuHistory, data.cpu),
      currentHistory: cap(current.currentHistory, data.current),
      voltHistory: cap(current.voltHistory, data.volt),
      rssiHistory: cap(current.rssiHistory, data.rssi),
      powerHistory: cap(current.powerHistory, data.powerMw),
      historyTimeline: cap(current.historyTimeline, sampleTime),
      totalCurrentMah: data.totalMah > 0 ? data.totalMah : current.totalCurrentMah + data.current / 3600,
      peakCurrent: Math.max(current.peakCurrent, data.current)
    });
  },
  setConnectionStatus: (status: ConnectionStatus) => {
    if (storeData.connectionStatus === status) {
      return;
    }
    setData({ connectionStatus: status });
  },
  setMqttStatus: (status: ConnectionStatus) => {
    if (storeData.mqttStatus === status) {
      return;
    }
    setData({ mqttStatus: status });
  },
  setModuleState: (module: ModuleName, enabled: boolean) => {
    setData({
      moduleStates: {
        ...storeData.moduleStates,
        [module]: enabled
      }
    });
  },
  setModuleStates: (states: Partial<ModuleStates>) => {
    setData({
      moduleStates: {
        ...storeData.moduleStates,
        ...states
      }
    });
  },
  setTimeRange: (range: TimeRangeKey) => {
    setData({ selectedRange: range });
  },
  setThemeMode: (mode: ThemeMode) => {
    if (mode === storeData.themeMode) {
      return;
    }
    setData({ themeMode: mode });
  },
  toggleThemeMode: () => {
    setData({ themeMode: storeData.themeMode === 'dark' ? 'light' : 'dark' });
  },
  addLog: (entry: IOLogEntry) => {
    setData({ ioLog: capLog(storeData.ioLog, entry) });
  },
  setWifiScanNetworks: (networks: WifiScanNetwork[] | null) => {
    setData({ wifiScanNetworks: networks });
  },
  setLastCommandAck: (ack: CommandAck | null) => {
    setData({ lastCommandAck: ack });
  },
  setImuFrame: (frame: Partial<ESP32Data>) => {
    const current = storeData.data ?? emptyReading();
    setData({
      data: {
        ...current,
        ...frame,
        recordedAtMs: frame.recordedAtMs ?? Date.now()
      }
    });
  },
  hydrateHistory: (readings: ESP32Data[], logs: IOLogEntry[]) => {
    if (!readings.length && !logs.length) {
      return;
    }

    const tempHistory = readings.map((r) => r.temp).filter((v) => Number.isFinite(v)).slice(-HISTORY_CAP);
    const lightHistory = readings.map((r) => r.light).filter((v) => Number.isFinite(v)).slice(-HISTORY_CAP);
    const cpuHistory = readings.map((r) => r.cpu).filter((v) => Number.isFinite(v)).slice(-HISTORY_CAP);
    const currentHistory = readings.map((r) => r.current).filter((v) => Number.isFinite(v)).slice(-HISTORY_CAP);
    const voltHistory = readings.map((r) => r.volt).filter((v) => Number.isFinite(v)).slice(-HISTORY_CAP);
    const rssiHistory = readings.map((r) => r.rssi).filter((v) => Number.isFinite(v)).slice(-HISTORY_CAP);
    const powerHistory = readings.map((r) => r.powerMw).filter((v) => Number.isFinite(v)).slice(-HISTORY_CAP);
    const historyTimeline = readings
      .map((r) => (Number.isFinite(r.recordedAtMs) ? (r.recordedAtMs as number) : Date.now()))
      .slice(-HISTORY_CAP);

    const currentPeak = currentHistory.length ? Math.max(...currentHistory) : storeData.peakCurrent;
    const lastReading = readings[readings.length - 1] ?? storeData.data;

    setData({
      data: lastReading,
      tempHistory,
      lightHistory,
      cpuHistory,
      currentHistory,
      voltHistory,
      rssiHistory,
      powerHistory,
      historyTimeline,
      peakCurrent: currentPeak,
      totalCurrentMah: lastReading?.totalMah ?? storeData.totalCurrentMah,
      ioLog: logs.slice(-LOG_CAP)
    });
  },
  reset: () => {
    storeData = baseData();
    emit();
  }
};

const getState = (): StoreState => ({
  ...storeData,
  ...actions
});

export const getStoreState = getState;

const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};

export const useStore = <T>(selector: (state: StoreState) => T): T => {
  return useSyncExternalStore(
    subscribe,
    () => selector(getState()),
    () => selector(getState())
  );
};
