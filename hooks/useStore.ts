import { useSyncExternalStore } from 'react';

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
}

export type ConnectionStatus = 'online' | 'offline';
export type ModuleName = 'temperature' | 'light' | 'cpu' | 'current';
export type TimeRangeKey = '15m' | '1h' | '6h' | '24h' | '7d' | 'all';

export interface ModuleStates {
  temperature: boolean;
  light: boolean;
  cpu: boolean;
  current: boolean;
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

const cap = (arr: number[], next: number, max = 5000) => [...arr, next].slice(-max);
const capLog = (arr: IOLogEntry[], next: IOLogEntry, max = 1500) => [...arr, next].slice(-max);

interface StoreState {
  data: ESP32Data | null;
  tempHistory: number[];
  lightHistory: number[];
  cpuHistory: number[];
  currentHistory: number[];
  voltHistory: number[];
  rssiHistory: number[];
  historyTimeline: number[];
  totalCurrentMah: number;
  peakCurrent: number;
  moduleStates: ModuleStates;
  connectionStatus: ConnectionStatus;
  selectedRange: TimeRangeKey;
  ioLog: IOLogEntry[];
  pushReading: (data: ESP32Data, ts: string) => void;
  setConnectionStatus: (status: ConnectionStatus) => void;
  setModuleState: (module: ModuleName, enabled: boolean) => void;
  setModuleStates: (states: Partial<ModuleStates>) => void;
  setTimeRange: (range: TimeRangeKey) => void;
  addLog: (entry: IOLogEntry) => void;
  hydrateHistory: (readings: ESP32Data[], logs: IOLogEntry[]) => void;
  reset: () => void;
}

type StoreData = Omit<
  StoreState,
  'pushReading' | 'setConnectionStatus' | 'setModuleState' | 'setModuleStates' | 'setTimeRange' | 'addLog' | 'hydrateHistory' | 'reset'
>;

const baseData = (): StoreData => ({
  data: null,
  tempHistory: [],
  lightHistory: [],
  cpuHistory: [],
  currentHistory: [],
  voltHistory: [],
  rssiHistory: [],
  historyTimeline: [],
  totalCurrentMah: 0,
  peakCurrent: 0,
  moduleStates: {
    temperature: true,
    light: true,
    cpu: true,
    current: true
  },
  connectionStatus: 'offline',
  selectedRange: '1h',
  ioLog: []
});

const listeners = new Set<() => void>();

let storeData: StoreData = baseData();

const emit = () => {
  listeners.forEach((listener) => listener());
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
      historyTimeline: cap(current.historyTimeline, sampleTime),
      totalCurrentMah: data.totalMah > 0 ? data.totalMah : current.totalCurrentMah + data.current / 3600,
      peakCurrent: Math.max(current.peakCurrent, data.current)
    });
  },
  setConnectionStatus: (status: ConnectionStatus) => {
    setData({ connectionStatus: status });
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
  addLog: (entry: IOLogEntry) => {
    setData({ ioLog: capLog(storeData.ioLog, entry) });
  },
  hydrateHistory: (readings: ESP32Data[], logs: IOLogEntry[]) => {
    if (!readings.length && !logs.length) {
      return;
    }

    const tempHistory = readings.map((r) => r.temp).filter((v) => Number.isFinite(v)).slice(-5000);
    const lightHistory = readings.map((r) => r.light).filter((v) => Number.isFinite(v)).slice(-5000);
    const cpuHistory = readings.map((r) => r.cpu).filter((v) => Number.isFinite(v)).slice(-5000);
    const currentHistory = readings.map((r) => r.current).filter((v) => Number.isFinite(v)).slice(-5000);
    const voltHistory = readings.map((r) => r.volt).filter((v) => Number.isFinite(v)).slice(-5000);
    const rssiHistory = readings.map((r) => r.rssi).filter((v) => Number.isFinite(v)).slice(-5000);
    const historyTimeline = readings
      .map((r) => (Number.isFinite(r.recordedAtMs) ? (r.recordedAtMs as number) : Date.now()))
      .slice(-5000);

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
      historyTimeline,
      peakCurrent: currentPeak,
      totalCurrentMah: lastReading?.totalMah ?? storeData.totalCurrentMah,
      ioLog: logs.slice(-1500)
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
