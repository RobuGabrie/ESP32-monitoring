import { useSyncExternalStore } from 'react';

export interface ESP32Data {
  timestamp: string;
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

export interface ModuleStates {
  temperature: boolean;
  light: boolean;
  cpu: boolean;
  current: boolean;
}

export interface IOLogEntry {
  ts: string;
  temp: number;
  light: number;
  gpio: Record<string, number>;
}

const cap = (arr: number[], next: number, max = 40) => [...arr, next].slice(-max);
const capLog = (arr: IOLogEntry[], next: IOLogEntry, max = 200) => [...arr, next].slice(-max);

interface StoreState {
  data: ESP32Data | null;
  tempHistory: number[];
  lightHistory: number[];
  cpuHistory: number[];
  currentHistory: number[];
  voltHistory: number[];
  rssiHistory: number[];
  totalCurrentMah: number;
  peakCurrent: number;
  moduleStates: ModuleStates;
  connectionStatus: ConnectionStatus;
  ioLog: IOLogEntry[];
  pushReading: (data: ESP32Data, ts: string) => void;
  setConnectionStatus: (status: ConnectionStatus) => void;
  setModuleState: (module: ModuleName, enabled: boolean) => void;
  setModuleStates: (states: Partial<ModuleStates>) => void;
  addLog: (entry: IOLogEntry) => void;
  reset: () => void;
}

type StoreData = Omit<
  StoreState,
  'pushReading' | 'setConnectionStatus' | 'setModuleState' | 'setModuleStates' | 'addLog' | 'reset'
>;

const baseData = (): StoreData => ({
  data: null,
  tempHistory: [],
  lightHistory: [],
  cpuHistory: [],
  currentHistory: [],
  voltHistory: [],
  rssiHistory: [],
  totalCurrentMah: 0,
  peakCurrent: 0,
  moduleStates: {
    temperature: true,
    light: true,
    cpu: true,
    current: true
  },
  connectionStatus: 'offline',
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
    setData({
      data,
      tempHistory: cap(current.tempHistory, data.temp),
      lightHistory: cap(current.lightHistory, data.light),
      cpuHistory: cap(current.cpuHistory, data.cpu),
      currentHistory: cap(current.currentHistory, data.current),
      voltHistory: cap(current.voltHistory, data.volt),
      rssiHistory: cap(current.rssiHistory, data.rssi),
      totalCurrentMah: data.totalMah > 0 ? data.totalMah : current.totalCurrentMah + data.current / 3600,
      peakCurrent: Math.max(current.peakCurrent, data.current),
      ioLog: capLog(current.ioLog, {
        ts,
        temp: data.temp,
        light: data.light,
        gpio: { ...data.gpio }
      })
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
  addLog: (entry: IOLogEntry) => {
    setData({ ioLog: capLog(storeData.ioLog, entry) });
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
