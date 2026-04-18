import AsyncStorage from '@react-native-async-storage/async-storage';
import { PermissionsAndroid, Platform } from 'react-native';
import mqtt, { MqttClient } from 'mqtt';
import { Buffer } from 'buffer';

import {
  MQTT_BROKER,
  MQTT_PASS,
  MQTT_PORT,
  MQTT_TOPIC,
  MQTT_USER,
  MQTT_WS_PORT,
  MQTT_WS_PROTOCOL
} from '@/constants/config';
import { ESP32Data, ConnectionStatus, MqttStatus } from '@/hooks/useStore';

if (!globalThis.Buffer) {
  (globalThis as typeof globalThis & { Buffer: typeof Buffer }).Buffer = Buffer;
}

// Types for mobile-specific data
export interface BLEDevice {
  id: string;
  name: string;
  rssi: number;
  isConnected: boolean;
  localName?: string;
  manufacturerData?: string;
  serviceData?: Record<string, string>;
  serviceUUIDs?: string[];
}

export interface ScanDevicesOptions {
  scanDurationMs?: number;
  allowDuplicates?: boolean;
  esp32Only?: boolean;
  serviceUUIDs?: string[];
  namePrefixes?: string[];
}

export interface WearableData extends ESP32Data {
  // Skydiver-specific fields
  heartRate?: number;
  bloodOxygen?: number;
  stressLevel?: number;
  bodyTemp?: number;
  parachuteState?: 'closed' | 'opening' | 'open';
  positionState?: 'stable' | 'falling' | 'rotating' | 'unconscious';
}

export interface CachedData {
  timestamp: string;
  data: WearableData[];
  synced: boolean;
}

export interface DiveSessionSummary {
  id: string;
  startAt: string;
  endAt?: string;
  status: 'active' | 'completed';
  deviceId?: string;
  sampleCount: number;
}

export interface DiveSessionState {
  isActive: boolean;
  sessionId: string | null;
}

type BleSensorPayload = {
  ts?: unknown;
  up?: unknown;
  temp?: unknown;
  gx?: unknown;
  gy?: unknown;
  gz?: unknown;
  q0?: unknown;
  q1?: unknown;
  q2?: unknown;
  q3?: unknown;
  roll?: unknown;
  pitch?: unknown;
  yaw?: unknown;
  stationary?: unknown;
  imu_seq?: unknown;
  v?: unknown;
  ma?: unknown;
  batt?: unknown;
  [key: string]: unknown;
};

type BleImuPayload = {
  up?: unknown;
  q0?: unknown;
  q1?: unknown;
  q2?: unknown;
  q3?: unknown;
  roll?: unknown;
  pitch?: unknown;
  yaw?: unknown;
  stationary?: unknown;
  imu_seq?: unknown;
};

const DIVE_SESSIONS_META_KEY = 'dive_sessions_meta_v1';
const DIVE_SESSIONS_ACTIVE_KEY = 'dive_session_active_id_v1';
const DIVE_SESSION_DATA_PREFIX = 'dive_session_samples_v1_';
const SKYDIVER_MONITOR_DEVICE_NAME = 'Skydiver-Monitor';
const BLE_SERVICE_UUID = '180d';
const BLE_SENSOR_CHAR_UUID = 'a0000001-1000-1000-8000-00805f9b34fb';
const BLE_IMU_CHAR_UUID = 'a0000002-1000-1000-8000-00805f9b34fb';
const BLE_STOPWATCH_CHAR_UUID = 'a0000001-1000-1000-8000-00805f9b34fb';
const BLE_BATTERY_LEVEL_CHAR_UUID = '2a19';
const BLE_TEMPERATURE_CHAR_UUID = '2a1c';
const BLE_GYRO_MIRROR_CHAR_UUID = '2a4e';

type StopwatchBleCommand = 'START' | 'STOP' | 'RESET';

const normalizeUuid = (value: unknown) => {
  if (typeof value !== 'string') {
    return '';
  }

  return value.trim().toLowerCase().replace(/[^a-f0-9]/g, '');
};

const toCanonicalUuid = (value: string) => {
  const normalized = normalizeUuid(value);
  if (normalized.length === 4) {
    return `0000${normalized}00001000800000805f9b34fb`;
  }

  return normalized;
};

const isSameUuid = (left: unknown, right: unknown) => {
  if (typeof left !== 'string' || typeof right !== 'string') {
    return false;
  }

  return toCanonicalUuid(left) === toCanonicalUuid(right);
};

class MobileDataService {
  private bleManager: any | null = null;
  private connectedDevice: any | null = null;
  private connectedDeviceId: string | null = null;
  private isScanning = false;
  private scanTimeout: ReturnType<typeof setTimeout> | null = null;
  private isConnected = false;
  private mqttBridgeEnabled = Platform.OS === 'android';
  private mqttClient: MqttClient | null = null;
  private mqttConnected = false;
  private pendingBridgePayload: Record<string, unknown> | null = null;
  private bleSubscriptions: Array<{ remove: () => void }> = [];
  private disconnectSubscription: { remove: () => void } | null = null;
  private dataListeners: ((data: WearableData) => void)[] = [];
  private connectionListeners: ((status: ConnectionStatus) => void)[] = [];
  private activeDiveSessionId: string | null = null;
  private latestTelemetry: WearableData | null = null;
  private ignoredBlePayloadCount = 0;
  private bleChunkBuffers = new Map<string, string>();
  private imuNotifyWatchdog: ReturnType<typeof setTimeout> | null = null;
  private hasReceivedImuPacket = false;

  private escapeRegExp(value: string) {
    return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  constructor() {
    this.hydrateActiveDiveSession().catch(() => {
      // Ignore hydration errors and keep the service operational.
    });

    if (Platform.OS === 'android') {
      try {
        const { BleManager } = require('react-native-ble-plx');
        this.bleManager = new BleManager();
        console.log('MobileDataService initialized (Android BLE mode)');
      } catch (error) {
        this.bleManager = null;
        console.warn('BLE native module not available. Build and run with a BLE-enabled dev client.', error);
      }
    } else {
      console.log('MobileDataService initialized (BLE scan/connect is Android-only)');
    }
  }

  private async hydrateActiveDiveSession() {
    try {
      this.activeDiveSessionId = await AsyncStorage.getItem(DIVE_SESSIONS_ACTIVE_KEY);
    } catch {
      this.activeDiveSessionId = null;
    }
  }

  private async getDiveSessionSummaries(): Promise<DiveSessionSummary[]> {
    const raw = await AsyncStorage.getItem(DIVE_SESSIONS_META_KEY);
    if (!raw) {
      return [];
    }

    try {
      const parsed = JSON.parse(raw);
      if (!Array.isArray(parsed)) {
        return [];
      }

      return parsed.filter((entry): entry is DiveSessionSummary => {
        return !!entry && typeof entry.id === 'string' && typeof entry.startAt === 'string';
      });
    } catch {
      return [];
    }
  }

  private async saveDiveSessionSummaries(summaries: DiveSessionSummary[]) {
    await AsyncStorage.setItem(DIVE_SESSIONS_META_KEY, JSON.stringify(summaries));
  }

  private getDiveSessionSamplesKey(sessionId: string) {
    return `${DIVE_SESSION_DATA_PREFIX}${sessionId}`;
  }

  private async appendDiveSample(data: WearableData) {
    if (!this.activeDiveSessionId) {
      return;
    }

    const sessionId = this.activeDiveSessionId;
    const samplesKey = this.getDiveSessionSamplesKey(sessionId);
    const rawSamples = await AsyncStorage.getItem(samplesKey);

    let samples: WearableData[] = [];
    if (rawSamples) {
      try {
        const parsed = JSON.parse(rawSamples);
        if (Array.isArray(parsed)) {
          samples = parsed;
        }
      } catch {
        samples = [];
      }
    }

    samples.push(data);
    await AsyncStorage.setItem(samplesKey, JSON.stringify(samples));

    const summaries = await this.getDiveSessionSummaries();
    const updated = summaries.map((session) =>
      session.id === sessionId
        ? {
            ...session,
            sampleCount: samples.length,
            deviceId: this.connectedDeviceId ?? session.deviceId,
          }
        : session
    );
    await this.saveDiveSessionSummaries(updated);
  }

  async startDiveSession() {
    if (this.activeDiveSessionId) {
      return this.activeDiveSessionId;
    }

    const sessionId = `dive-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`;
    const summary: DiveSessionSummary = {
      id: sessionId,
      startAt: new Date().toISOString(),
      status: 'active',
      deviceId: this.connectedDeviceId ?? undefined,
      sampleCount: 0,
    };

    const summaries = await this.getDiveSessionSummaries();
    await this.saveDiveSessionSummaries([summary, ...summaries]);
    await AsyncStorage.setItem(this.getDiveSessionSamplesKey(sessionId), JSON.stringify([]));
    await AsyncStorage.setItem(DIVE_SESSIONS_ACTIVE_KEY, sessionId);
    this.activeDiveSessionId = sessionId;

    return sessionId;
  }

  async stopDiveSession() {
    if (!this.activeDiveSessionId) {
      return null;
    }

    const sessionId = this.activeDiveSessionId;
    const summaries = await this.getDiveSessionSummaries();
    const updated = summaries.map((session) =>
      session.id === sessionId
        ? {
            ...session,
            status: 'completed' as const,
            endAt: new Date().toISOString(),
          }
        : session
    );

    await this.saveDiveSessionSummaries(updated);
    await AsyncStorage.removeItem(DIVE_SESSIONS_ACTIVE_KEY);
    this.activeDiveSessionId = null;
    return sessionId;
  }

  async getDiveSessionState(): Promise<DiveSessionState> {
    if (!this.activeDiveSessionId) {
      await this.hydrateActiveDiveSession();
    }

    return {
      isActive: !!this.activeDiveSessionId,
      sessionId: this.activeDiveSessionId,
    };
  }

  private async requestAndroidScanPermissions(): Promise<boolean> {
    if (Platform.OS !== 'android') {
      return false;
    }

    const apiLevel = Number(Platform.Version);
    if (apiLevel >= 31) {
      const results = await PermissionsAndroid.requestMultiple([
        PermissionsAndroid.PERMISSIONS.BLUETOOTH_SCAN,
        PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT,
      ]);

      return (
        results[PermissionsAndroid.PERMISSIONS.BLUETOOTH_SCAN] === PermissionsAndroid.RESULTS.GRANTED &&
        results[PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT] === PermissionsAndroid.RESULTS.GRANTED
      );
    }

    const location = await PermissionsAndroid.request(PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION);
    return location === PermissionsAndroid.RESULTS.GRANTED;
  }

  private looksLikeEsp32Device(
    name: string,
    localName?: string,
    namePrefixes: string[] = ['esp32', 'esp32-c3', 'esp32 c3', 'c3', 'skydiver']
  ) {
    const fullName = `${name} ${localName ?? ''}`
      .toLowerCase()
      .replace(/[_\s]+/g, ' ')
      .trim();

    if (!fullName) {
      return false;
    }

    return namePrefixes.some((prefix) => {
      const normalizedPrefix = prefix.toLowerCase().trim().replace(/[_\s]+/g, ' ');
      if (!normalizedPrefix) {
        return false;
      }

      // Short prefixes (e.g. "c3") should match whole tokens only.
      if (normalizedPrefix.length <= 3) {
        const tokenRegex = new RegExp(
          `(^|[^a-z0-9])${this.escapeRegExp(normalizedPrefix)}([^a-z0-9]|$)`
        );
        return tokenRegex.test(fullName);
      }

      return fullName.includes(normalizedPrefix);
    });
  }

  private normalizeBleScanError(error: unknown): Error {
    const fallback = new Error('Bluetooth scan failed. Please try again.');
    if (!error || typeof error !== 'object') {
      return fallback;
    }

    const maybeError = error as { message?: string; errorCode?: number | string };
    const message = (maybeError.message ?? '').toLowerCase();
    const code = maybeError.errorCode;

    // react-native-ble-plx may report powered-off state either by message text or error code.
    if (
      message.includes('powered off') ||
      message.includes('bluetoothle is powered off') ||
      code === 102 ||
      code === 'BluetoothPoweredOff'
    ) {
      return new Error('Bluetooth is turned off. Turn Bluetooth on, then scan again.');
    }

    if (message.includes('permission')) {
      return new Error('Bluetooth permission is required to scan for devices.');
    }

    return new Error(maybeError.message ?? fallback.message);
  }

  private async ensureBluetoothPoweredOn(): Promise<void> {
    if (Platform.OS !== 'android' || !this.bleManager) {
      return;
    }

    try {
      const state = await this.bleManager.state();
      if (state !== 'PoweredOn') {
        throw new Error('Bluetooth is turned off. Turn Bluetooth on, then scan again.');
      }
    } catch (error) {
      throw this.normalizeBleScanError(error);
    }
  }

  async scanForDevices(options: ScanDevicesOptions = {}): Promise<BLEDevice[]> {
    if (Platform.OS !== 'android') {
      return [];
    }

    if (!this.bleManager) {
      throw new Error('BLE module is not initialized. Build a development client with native BLE support.');
    }

    const hasPermissions = await this.requestAndroidScanPermissions();
    if (!hasPermissions) {
      throw new Error('Bluetooth scan permissions were denied.');
    }

    await this.ensureBluetoothPoweredOn();

    this.stopScan();

    const {
      scanDurationMs = 6000,
      allowDuplicates = false,
      esp32Only = true,
      serviceUUIDs = [],
      namePrefixes,
    } = options;

    const found = new Map<string, BLEDevice>();

    return new Promise<BLEDevice[]>((resolve, reject) => {
      let settled = false;

      const finish = () => {
        if (settled) return;
        settled = true;
        this.stopScan();

        const devices = Array.from(found.values()).sort((a, b) => b.rssi - a.rssi);
        resolve(devices);
      };

      this.isScanning = true;

      this.bleManager.startDeviceScan(
        serviceUUIDs.length ? serviceUUIDs : null,
        { allowDuplicates },
        (error: any, device: any) => {
          if (error) {
            if (settled) return;
            settled = true;
            this.stopScan();
            reject(this.normalizeBleScanError(error));
            return;
          }

          if (!device?.id) {
            return;
          }

          const name = device.name || device.localName || 'Unnamed BLE Device';
          const serviceData = device.serviceData as Record<string, string> | undefined;
          const manufacturerData = device.manufacturerData as string | undefined;
          const serviceUUIDsFromAdv = (device.serviceUUIDs as string[] | undefined) ?? undefined;

          if (
            esp32Only &&
            !this.looksLikeEsp32Device(name, device.localName, namePrefixes)
          ) {
            return;
          }

          found.set(device.id, {
            id: device.id,
            name,
            localName: device.localName ?? undefined,
            rssi: Number.isFinite(device.rssi) ? device.rssi : -99,
            isConnected: device.id === this.connectedDeviceId,
            manufacturerData,
            serviceData,
            serviceUUIDs: serviceUUIDsFromAdv,
          });
        }
      );

      this.scanTimeout = setTimeout(finish, Math.max(1500, scanDurationMs));
    });
  }

  stopScan() {
    if (this.scanTimeout) {
      clearTimeout(this.scanTimeout);
      this.scanTimeout = null;
    }

    if (this.bleManager && this.isScanning) {
      this.bleManager.stopDeviceScan();
    }

    this.isScanning = false;
  }

  async connectToDevice(deviceId: string): Promise<boolean> {
    if (Platform.OS === 'android' && this.bleManager) {
      try {
        if (this.connectedDeviceId && this.connectedDeviceId !== deviceId) {
          this.disconnectDevice();
        }

        const device = await this.bleManager.connectToDevice(deviceId, { timeout: 10000 });

        // Request larger MTU so custom JSON notifications are less likely to be truncated to 20 bytes.
        // Android default ATT MTU is typically 23 (payload 20 bytes).
        let readyDevice = device;
        try {
          if (typeof device.requestMTU === 'function') {
            readyDevice = await device.requestMTU(185);
            console.log('BLE MTU negotiated:', readyDevice?.mtu ?? 'unknown');
          }
        } catch (mtuError) {
          console.warn('BLE MTU request failed; continuing with default MTU.', mtuError);
        }

        await readyDevice.discoverAllServicesAndCharacteristics();

        this.connectedDevice = readyDevice;
        this.connectedDeviceId = deviceId;
        this.isConnected = true;

        if (this.disconnectSubscription) {
          try {
            this.disconnectSubscription.remove();
          } catch {
            // Ignore listener cleanup issues.
          }
          this.disconnectSubscription = null;
        }

        this.disconnectSubscription = this.bleManager.onDeviceDisconnected(deviceId, (error: unknown) => {
          // Ignore stale callbacks if another device is currently active.
          if (this.connectedDeviceId !== deviceId) {
            return;
          }

          if (error) {
            console.warn('BLE device disconnected with error:', error);
          } else {
            console.warn('BLE device disconnected unexpectedly.');
          }

          this.isConnected = false;
          this.connectedDevice = null;
          this.connectedDeviceId = null;
          this.stopBleTelemetryStream();
          this.notifyConnectionListeners('disconnected');
        });

        this.notifyConnectionListeners('online');

        await this.ensureMqttConnection();
        await this.startBleTelemetryStream(readyDevice);
        return true;
      } catch (error) {
        console.error('BLE connection failed:', error);
        return false;
      }
    }

    console.warn('BLE connection is only available on Android with native BLE support.');
    return false;
  }

  disconnectDevice() {
    if (this.disconnectSubscription) {
      try {
        this.disconnectSubscription.remove();
      } catch {
        // Ignore listener cleanup issues.
      }
      this.disconnectSubscription = null;
    }

    if (this.bleManager && this.connectedDeviceId) {
      this.bleManager.cancelDeviceConnection(this.connectedDeviceId).catch(() => {
        // Ignore cancellation errors if already disconnected
      });
    }

    this.isConnected = false;
    this.connectedDevice = null;
    this.connectedDeviceId = null;
    this.stopScan();
    this.stopBleTelemetryStream();
    this.disconnectMqtt();
    this.notifyConnectionListeners('disconnected');
  }

  private getMqttUrl() {
    return `${MQTT_WS_PROTOCOL}://${MQTT_BROKER}:${MQTT_WS_PORT}/mqtt`;
  }

  private async ensureMqttConnection() {
    if (!this.mqttBridgeEnabled || this.mqttClient?.connected) {
      return;
    }

    const clientId = `esp32-mobile-${Math.random().toString(16).slice(2, 10)}`;

    this.mqttClient = mqtt.connect(this.getMqttUrl(), {
      clientId,
      username: MQTT_USER,
      password: MQTT_PASS,
      connectTimeout: 10000,
      reconnectPeriod: 3000,
      clean: true,
      protocolVersion: 4
    });

    this.mqttClient.on('connect', () => {
      this.mqttConnected = true;
      console.log(`MQTT bridge online via ${MQTT_BROKER}:${MQTT_PORT}`);

      if (this.pendingBridgePayload) {
        this.mqttClient?.publish(MQTT_TOPIC, JSON.stringify(this.pendingBridgePayload), { qos: 0 });
        this.pendingBridgePayload = null;
      }
    });

    this.mqttClient.on('close', () => {
      this.mqttConnected = false;
    });

    this.mqttClient.on('error', (error) => {
      this.mqttConnected = false;
      console.error('MQTT bridge error:', error);
    });
  }

  private disconnectMqtt() {
    if (this.mqttClient) {
      this.mqttClient.end(true);
      this.mqttClient = null;
    }
    this.mqttConnected = false;
  }

  private toNumber(value: unknown, fallback = Number.NaN) {
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
  }

  private toBoolean(value: unknown, fallback = false) {
    if (typeof value === 'boolean') {
      return value;
    }

    if (typeof value === 'number' && Number.isFinite(value)) {
      return value > 0;
    }

    if (typeof value === 'string') {
      const normalized = value.trim().toLowerCase();
      if (['1', 'true', 'yes', 'y', 'on', 'stationary', 'still'].includes(normalized)) {
        return true;
      }
      if (['0', 'false', 'no', 'n', 'off', 'moving', 'motion'].includes(normalized)) {
        return false;
      }
    }

    return fallback;
  }

  private toRecordedAtMs(value: unknown) {
    if (typeof value !== 'string') {
      return Date.now();
    }

    const raw = value.trim();
    if (!raw) {
      return Date.now();
    }

    const parsedDirect = Date.parse(raw);
    if (Number.isFinite(parsedDirect)) {
      return parsedDirect;
    }

    const parsedIsoLike = Date.parse(raw.replace(' ', 'T'));
    if (Number.isFinite(parsedIsoLike)) {
      return parsedIsoLike;
    }

    return Date.now();
  }

  private buildBaseTelemetry(now = Date.now()): WearableData {
    const toNumber = (value: unknown, fallback = 0) => {
      if (typeof value === 'number' && Number.isFinite(value)) return value;
      if (typeof value === 'string') {
        const parsed = Number(value);
        if (Number.isFinite(parsed)) return parsed;
      }
      return fallback;
    };

    return {
      timestamp: new Date(now).toISOString(),
      recordedAtMs: now,
      uptime: toNumber(undefined),
      temp: toNumber(undefined),
      light: toNumber(undefined),
      lightRaw: toNumber(undefined),
      lightPercent: toNumber(undefined),
      cpu: toNumber(undefined),
      volt: toNumber(undefined),
      current: toNumber(undefined),
      powerMw: toNumber(undefined),
      totalMah: toNumber(undefined),
      batteryPercent: toNumber(undefined),
      batteryLifeMin: toNumber(undefined),
      rssi: toNumber(undefined, -99),
      gpio: {},
      ssid: '--',
      ip: '--',
      mac: '--',
      channel: toNumber(undefined),
    };
  }

  private parseSensorPayload(payload: BleSensorPayload): Partial<WearableData> | null {
    const pickFirst = (...keys: string[]) => {
      for (const key of keys) {
        if (Object.prototype.hasOwnProperty.call(payload, key)) {
          return payload[key];
        }
      }
      return undefined;
    };

    const next: Partial<WearableData> = {};

    const rawTimestamp = pickFirst('ts', 'timestamp', 'time');
    if (typeof rawTimestamp === 'string') {
      next.timestamp = rawTimestamp;
      next.recordedAtMs = this.toRecordedAtMs(rawTimestamp);
    }

    const uptime = this.toNumber(pickFirst('up', 'uptime'), Number.NaN);
    if (Number.isFinite(uptime)) {
      next.uptime = Math.max(0, Math.round(uptime));
    }

    const temp = this.toNumber(pickFirst('temp', 'temperature', 't'), Number.NaN);
    if (Number.isFinite(temp)) {
      next.temp = temp;
    }

    const gx = this.toNumber(pickFirst('gx', 'gyrox', 'gyro_x'), Number.NaN);
    if (Number.isFinite(gx)) {
      next.gyroX = gx;
    }

    const gy = this.toNumber(pickFirst('gy', 'gyroy', 'gyro_y'), Number.NaN);
    if (Number.isFinite(gy)) {
      next.gyroY = gy;
    }

    const gz = this.toNumber(pickFirst('gz', 'gyroz', 'gyro_z'), Number.NaN);
    if (Number.isFinite(gz)) {
      next.gyroZ = gz;
    }

    const q0 = this.toNumber(pickFirst('q0'), Number.NaN);
    const q1 = this.toNumber(pickFirst('q1'), Number.NaN);
    const q2 = this.toNumber(pickFirst('q2'), Number.NaN);
    const q3 = this.toNumber(pickFirst('q3'), Number.NaN);
    if ([q0, q1, q2, q3].every((value) => Number.isFinite(value))) {
      next.q0 = q0;
      next.q1 = q1;
      next.q2 = q2;
      next.q3 = q3;
    }

    const roll = this.toNumber(pickFirst('roll'), Number.NaN);
    if (Number.isFinite(roll)) {
      next.roll = roll;
    }

    const pitch = this.toNumber(pickFirst('pitch'), Number.NaN);
    if (Number.isFinite(pitch)) {
      next.pitch = pitch;
    }

    const yaw = this.toNumber(pickFirst('yaw'), Number.NaN);
    if (Number.isFinite(yaw)) {
      next.yaw = yaw;
    }

    const stationary = pickFirst('stationary');
    if (typeof stationary !== 'undefined') {
      next.stationary = this.toBoolean(stationary, false);
    }

    const imuSeq = this.toNumber(pickFirst('imu_seq', 'imuseq', 'imuSeq'), Number.NaN);
    if (Number.isFinite(imuSeq)) {
      next.imuSeq = Math.max(0, Math.round(imuSeq));
    }

    const volt = this.toNumber(pickFirst('v', 'volt', 'voltage'), Number.NaN);
    if (Number.isFinite(volt)) {
      next.volt = volt;
    }

    const current = this.toNumber(pickFirst('ma', 'current', 'curr', 'i'), Number.NaN);
    if (Number.isFinite(current)) {
      next.current = current;
    }

    const batteryPercent = this.toNumber(pickFirst('batt', 'battery', 'batterypercent', 'soc'), Number.NaN);
    if (Number.isFinite(batteryPercent)) {
      next.batteryPercent = batteryPercent;
    }

    const cpu = this.toNumber(pickFirst('cpu', 'cpu_load', 'load'), Number.NaN);
    if (Number.isFinite(cpu)) {
      next.cpu = cpu;
    }

    const light = this.toNumber(pickFirst('light', 'lux', 'ldr'), Number.NaN);
    if (Number.isFinite(light)) {
      next.light = light;
    }

    const powerMw = this.toNumber(pickFirst('powermw', 'power_mw', 'power', 'p'), Number.NaN);
    if (Number.isFinite(powerMw)) {
      next.powerMw = powerMw;
    } else if (Number.isFinite(next.volt) && Number.isFinite(next.current)) {
      next.powerMw = next.volt * next.current;
    }

    return Object.keys(next).length ? next : null;
  }

  private parseImuPayload(payload: BleImuPayload): Partial<WearableData> | null {
    const next: Partial<WearableData> = {};

    const uptime = this.toNumber(payload.up, Number.NaN);
    if (Number.isFinite(uptime)) {
      next.uptime = Math.max(0, Math.round(uptime));
    }

    const q0 = this.toNumber(payload.q0, Number.NaN);
    const q1 = this.toNumber(payload.q1, Number.NaN);
    const q2 = this.toNumber(payload.q2, Number.NaN);
    const q3 = this.toNumber(payload.q3, Number.NaN);
    if ([q0, q1, q2, q3].every((v) => Number.isFinite(v))) {
      next.q0 = q0;
      next.q1 = q1;
      next.q2 = q2;
      next.q3 = q3;
    }

    const roll = this.toNumber(payload.roll, Number.NaN);
    if (Number.isFinite(roll)) {
      next.roll = roll;
    }

    const pitch = this.toNumber(payload.pitch, Number.NaN);
    if (Number.isFinite(pitch)) {
      next.pitch = pitch;
    }

    const yaw = this.toNumber(payload.yaw, Number.NaN);
    if (Number.isFinite(yaw)) {
      next.yaw = yaw;
    }

    if (typeof payload.stationary !== 'undefined') {
      next.stationary = this.toBoolean(payload.stationary, false);
    }

    const imuSeq = this.toNumber(payload.imu_seq, Number.NaN);
    if (Number.isFinite(imuSeq)) {
      next.imuSeq = Math.max(0, Math.round(imuSeq));
    }

    return Object.keys(next).length ? next : null;
  }

  private mergeTelemetryUpdate(update: Partial<WearableData>) {
    const now = Date.now();
    const base = this.latestTelemetry ?? this.buildBaseTelemetry(now);

    const merged: WearableData = {
      ...base,
      ...update,
      timestamp: update.timestamp ?? base.timestamp ?? new Date(now).toISOString(),
      recordedAtMs: update.recordedAtMs ?? now,
    };

    this.latestTelemetry = merged;
    return merged;
  }

  private parseBlePacket(rawValue: string, characteristicUuid: string, rawBytes?: Buffer): WearableData | null {
    const normalizedCharacteristic = normalizeUuid(characteristicUuid);

    // Handle 2A19 as defined by GATT: unsigned 1-byte integer (0..100), not UTF-8 text.
    if (isSameUuid(normalizedCharacteristic, BLE_BATTERY_LEVEL_CHAR_UUID)) {
      let batteryPercent = Number.NaN;

      if (rawBytes && rawBytes.length > 0) {
        batteryPercent = rawBytes[0];
      }

      const textFallback = rawValue.trim();
      if (!Number.isFinite(batteryPercent) && textFallback.length === 1) {
        batteryPercent = textFallback.charCodeAt(0);
      }

      if (!Number.isFinite(batteryPercent)) {
        batteryPercent = this.toNumber(textFallback, Number.NaN);
      }

      if (Number.isFinite(batteryPercent)) {
        return this.mergeTelemetryUpdate({
          batteryPercent: Math.max(0, Math.min(100, Math.round(batteryPercent))),
        });
      }

      return null;
    }

    const text = rawValue.trim();
    if (!text) return null;

    if (isSameUuid(normalizedCharacteristic, BLE_TEMPERATURE_CHAR_UUID)) {
      const temperature = this.toNumber(text, Number.NaN);
      if (Number.isFinite(temperature)) {
        return this.mergeTelemetryUpdate({ temp: temperature });
      }
    }

    if (isSameUuid(normalizedCharacteristic, BLE_GYRO_MIRROR_CHAR_UUID)) {
      const gyroMagnitude = this.toNumber(text, Number.NaN);
      if (Number.isFinite(gyroMagnitude)) {
        return this.mergeTelemetryUpdate({ gyroZ: gyroMagnitude });
      }
    }

    const parseWithKnownMappers = (payload: Record<string, unknown>) => {
      if (isSameUuid(normalizedCharacteristic, BLE_SENSOR_CHAR_UUID)) {
        const sensor = this.parseSensorPayload(payload as BleSensorPayload);
        return sensor ? this.mergeTelemetryUpdate(sensor) : null;
      }

      if (isSameUuid(normalizedCharacteristic, BLE_IMU_CHAR_UUID)) {
        const imu = this.parseImuPayload(payload as BleImuPayload);
        return imu ? this.mergeTelemetryUpdate(imu) : null;
      }

      const sensor = this.parseSensorPayload(payload as BleSensorPayload);
      const imu = this.parseImuPayload(payload as BleImuPayload);
      if (sensor || imu) {
        return this.mergeTelemetryUpdate({
          ...(sensor ?? {}),
          ...(imu ?? {}),
        });
      }

      return null;
    };

    try {
      const payload = JSON.parse(text);
      if (!payload || typeof payload !== 'object') {
        return null;
      }
      this.bleChunkBuffers.delete(normalizedCharacteristic);
      return parseWithKnownMappers(payload as Record<string, unknown>);
    } catch {
      // Reassemble fragmented JSON packets emitted across multiple BLE notifications.
      const previousChunk = this.bleChunkBuffers.get(normalizedCharacteristic) ?? '';
      const startIndex = text.indexOf('{');
      const assembled = startIndex >= 0
        ? text.slice(startIndex)
        : previousChunk
          ? `${previousChunk}${text}`
          : text;

      if (assembled.length <= 4096) {
        this.bleChunkBuffers.set(normalizedCharacteristic, assembled);
      } else {
        this.bleChunkBuffers.set(normalizedCharacteristic, assembled.slice(-4096));
      }

      const jsonStart = assembled.indexOf('{');
      const jsonEnd = assembled.lastIndexOf('}');
      if (jsonStart >= 0 && jsonEnd > jsonStart) {
        const jsonCandidate = assembled.slice(jsonStart, jsonEnd + 1);
        try {
          const payload = JSON.parse(jsonCandidate);
          if (payload && typeof payload === 'object') {
            this.bleChunkBuffers.delete(normalizedCharacteristic);
            return parseWithKnownMappers(payload as Record<string, unknown>);
          }
        } catch {
          // Keep buffering until a complete JSON object is available.
        }
      }

      // Some firmware variants emit plain key-value telemetry lines (e.g. "temp:23.1,up:123").
      const kvPayload: Record<string, unknown> = {};
      const matches = text.matchAll(/([a-zA-Z0-9_]+)\s*[:=]\s*([^,;\s]+)/g);
      for (const match of matches) {
        const key = match[1]?.toLowerCase();
        const raw = match[2]?.trim();
        if (!key || !raw) {
          continue;
        }

        if (raw === 'true' || raw === 'false') {
          kvPayload[key] = raw === 'true';
          continue;
        }

        const asNumber = Number(raw);
        kvPayload[key] = Number.isFinite(asNumber) ? asNumber : raw;
      }

      if (!Object.keys(kvPayload).length) {
        return null;
      }

      return parseWithKnownMappers(kvPayload);
    }
  }

  private publishToMqtt(data: WearableData) {
    if (!this.mqttBridgeEnabled) {
      return;
    }

    const payload: Record<string, unknown> = {
      type: 'sensor',
      payload: {
        ...data,
        source: 'ble-mobile',
        bridgeDeviceId: this.connectedDeviceId,
        bridgeReceivedAt: new Date().toISOString(),
      },
    };

    if (!this.mqttClient || !this.mqttConnected) {
      this.pendingBridgePayload = payload;
      void this.ensureMqttConnection();
      return;
    }

    this.mqttClient.publish(MQTT_TOPIC, JSON.stringify(payload), { qos: 0 });
  }

  private async startBleTelemetryStream(device: any) {
    this.stopBleTelemetryStream();
    this.hasReceivedImuPacket = false;

    if (this.imuNotifyWatchdog) {
      clearTimeout(this.imuNotifyWatchdog);
      this.imuNotifyWatchdog = null;
    }

    this.imuNotifyWatchdog = setTimeout(() => {
      if (!this.hasReceivedImuPacket) {
        console.warn('No IMU notify packets received on a0000002 within 7s. Verify IMU module/firmware is enabled and notifying.');
      }
    }, 7000);

    try {
      const services = await device.services();

      const preferredService = services.find((service: any) => isSameUuid(service?.uuid, BLE_SERVICE_UUID));
      const serviceCandidates = preferredService ? [preferredService] : services;
      const seen = new Set<string>();

      for (const service of serviceCandidates) {
        const characteristics = await service.characteristics();
        const preferredCharacteristicUuids = [BLE_IMU_CHAR_UUID, BLE_SENSOR_CHAR_UUID];
        const notifiableCharacteristics = characteristics.filter(
          (characteristic: any) => characteristic?.isNotifiable || characteristic?.isIndicatable
        );

        const explicitPreferredCandidates = preferredCharacteristicUuids
          .map((targetUuid) =>
            characteristics.find((characteristic: any) => isSameUuid(characteristic?.uuid, targetUuid))
          )
          .filter(Boolean);

        const candidates = preferredService
          ? [
              ...explicitPreferredCandidates,
              ...notifiableCharacteristics,
            ]
          : notifiableCharacteristics;

        for (const characteristic of candidates) {
          const key = `${service.uuid}:${characteristic.uuid}`;
          if (seen.has(key)) {
            continue;
          }
          seen.add(key);

          if (isSameUuid(characteristic?.uuid, BLE_IMU_CHAR_UUID) || isSameUuid(characteristic?.uuid, BLE_SENSOR_CHAR_UUID)) {
            console.log('BLE monitor subscribe candidate:', {
              serviceUuid: service.uuid,
              characteristicUuid: characteristic.uuid,
              isNotifiable: characteristic?.isNotifiable,
              isIndicatable: characteristic?.isIndicatable,
            });
          }

          const subscription = device.monitorCharacteristicForService(
            service.uuid,
            characteristic.uuid,
            (error: any, updatedCharacteristic: any) => {
              if (error) {
                console.warn('BLE monitor error:', {
                  serviceUuid: service.uuid,
                  characteristicUuid: characteristic.uuid,
                  error,
                });
                return;
              }

              const encoded = updatedCharacteristic?.value;
              if (!encoded) {
                return;
              }

              try {
                const rawBytes = Buffer.from(encoded, 'base64');
                const rawHex = rawBytes.toString('hex');
                const decoded = rawBytes.toString('utf8').replace(/\u0000/g, '');
                console.log('[BLE notify raw]', {
                  serviceUuid: service.uuid,
                  characteristicUuid: updatedCharacteristic?.uuid ?? characteristic.uuid,
                  bytesHex: rawHex,
                  text: decoded,
                });

                if (isSameUuid(updatedCharacteristic?.uuid ?? characteristic.uuid, BLE_IMU_CHAR_UUID)) {
                  this.hasReceivedImuPacket = true;
                }

                const reading = this.parseBlePacket(
                  decoded,
                  updatedCharacteristic?.uuid ?? characteristic.uuid,
                  rawBytes
                );
                if (!reading) {
                  if (this.ignoredBlePayloadCount < 3) {
                    this.ignoredBlePayloadCount += 1;
                    console.warn('BLE packet received but not parsed. Sample:', decoded.slice(0, 120));
                  }
                  return;
                }

                this.notifyDataListeners(reading);
                this.cacheData(reading);
                void this.appendDiveSample(reading);
                this.publishToMqtt(reading);
              } catch {
                // Ignore payloads that are not telemetry JSON.
              }
            }
          );

          this.bleSubscriptions.push(subscription);
        }
      }

      if (!this.bleSubscriptions.length) {
        console.warn('No notifiable BLE telemetry characteristics were found.');
      }
    } catch (error) {
      console.warn('Unable to subscribe to BLE telemetry notifications:', error);
    }
  }

  private stopBleTelemetryStream() {
    if (this.imuNotifyWatchdog) {
      clearTimeout(this.imuNotifyWatchdog);
      this.imuNotifyWatchdog = null;
    }

    this.bleSubscriptions.forEach((subscription) => {
      try {
        subscription.remove();
      } catch {
        // Ignore subscription cleanup issues.
      }
    });
    this.bleSubscriptions = [];
  }

  // Data caching for offline sync
  private async cacheData(data: WearableData) {
    try {
      const cacheKey = `wearable_data_${new Date().toISOString().split('T')[0]}`;
      const existing = await AsyncStorage.getItem(cacheKey);
      const cached: CachedData = existing ? JSON.parse(existing) : {
        timestamp: new Date().toISOString(),
        data: [],
        synced: false
      };

      cached.data.push(data);

      // Keep only last 1000 entries per day
      if (cached.data.length > 1000) {
        cached.data = cached.data.slice(-1000);
      }

      await AsyncStorage.setItem(cacheKey, JSON.stringify(cached));
    } catch (error) {
      console.error('Failed to cache data:', error);
    }
  }

  async getCachedData(date: string): Promise<WearableData[]> {
    try {
      const cacheKey = `wearable_data_${date}`;
      const cached = await AsyncStorage.getItem(cacheKey);
      return cached ? JSON.parse(cached).data : [];
    } catch (error) {
      console.error('Failed to get cached data:', error);
      return [];
    }
  }

  async syncCachedData(): Promise<void> {
    // Sync cached data to cloud when online
    console.log('Syncing cached data...');
  }

  private async writeBleTextCommand(payload: string): Promise<void> {
    if (!this.connectedDeviceId || !this.bleManager) {
      throw new Error('No connected BLE device. Connect to a device before sending commands.');
    }

    const encodedPayload = Buffer.from(payload, 'utf8').toString('base64');

    try {
      await this.bleManager.writeCharacteristicWithResponseForDevice(
        this.connectedDeviceId,
        BLE_SERVICE_UUID,
        BLE_STOPWATCH_CHAR_UUID,
        encodedPayload
      );
    } catch {
      // Some firmwares expose write without response only; retry using that write mode.
      await this.bleManager.writeCharacteristicWithoutResponseForDevice(
        this.connectedDeviceId,
        BLE_SERVICE_UUID,
        BLE_STOPWATCH_CHAR_UUID,
        encodedPayload
      );
    }
  }

  async sendStopwatchCommand(command: StopwatchBleCommand): Promise<void> {
    await this.writeBleTextCommand(command);
  }

  async connectAndSendStopwatchCommand(command: StopwatchBleCommand): Promise<void> {
    const connectToStopwatchDevice = async () => {
      const scanned = await this.scanForDevices({
        scanDurationMs: 6000,
        allowDuplicates: false,
        esp32Only: false,
        namePrefixes: [SKYDIVER_MONITOR_DEVICE_NAME],
      });

      const target = scanned.find(
        (device) => device.name.trim().toLowerCase() === SKYDIVER_MONITOR_DEVICE_NAME.toLowerCase()
      );

      if (!target) {
        throw new Error(`Could not find BLE device ${SKYDIVER_MONITOR_DEVICE_NAME}.`);
      }

      const connected = await this.connectToDevice(target.id);
      if (!connected) {
        throw new Error('Unable to connect to Skydiver-Monitor over BLE.');
      }
    };

    if (!this.connectedDeviceId) {
      await connectToStopwatchDevice();
    }

    try {
      await this.sendStopwatchCommand(command);
    } catch (error) {
      const message = error instanceof Error ? error.message : '';
      const shouldReconnect =
        message.includes('No connected BLE device') ||
        message.includes('not found') ||
        message.includes('disconnected');

      if (!shouldReconnect) {
        throw error;
      }

      this.disconnectDevice();
      await connectToStopwatchDevice();
      await this.sendStopwatchCommand(command);
    }
  }

  async startStopwatch(): Promise<void> {
    await this.sendStopwatchCommand('START');
  }

  async stopStopwatch(): Promise<void> {
    await this.sendStopwatchCommand('STOP');
  }

  async resetStopwatch(): Promise<void> {
    await this.sendStopwatchCommand('RESET');
  }

  async sendCommand(command: string, params?: any): Promise<void> {
    const normalized = typeof command === 'string' ? command.trim().toUpperCase() : '';
    if (normalized === 'START' || normalized === 'STOP' || normalized === 'RESET') {
      await this.connectAndSendStopwatchCommand(normalized);
      return;
    }

    // Keep generic command support for existing UI actions that don't target stopwatch firmware commands.
    console.log('BLE command requested (non-stopwatch):', command, params);
  }

  // Event listeners
  onDataReceived(listener: (data: WearableData) => void) {
    this.dataListeners.push(listener);
    return () => {
      this.dataListeners = this.dataListeners.filter(l => l !== listener);
    };
  }

  onConnectionChange(listener: (status: ConnectionStatus) => void) {
    this.connectionListeners.push(listener);
    return () => {
      this.connectionListeners = this.connectionListeners.filter(l => l !== listener);
    };
  }

  private notifyDataListeners(data: WearableData) {
    this.dataListeners.forEach(listener => listener(data));
  }

  private notifyConnectionListeners(status: ConnectionStatus) {
    this.connectionListeners.forEach(listener => listener(status));
  }

  // Connection status
  getConnectionStatus(): ConnectionStatus {
    return this.isConnected ? 'online' : 'offline';
  }

  getMqttStatus(): MqttStatus {
    return this.mqttConnected ? 'online' : 'offline';
  }

  getConnectedDeviceInfo() {
    return {
      id: this.connectedDeviceId,
      name:
        typeof this.connectedDevice?.name === 'string' && this.connectedDevice.name.trim()
          ? this.connectedDevice.name.trim()
          : null,
      expectedName: SKYDIVER_MONITOR_DEVICE_NAME,
    };
  }

  getLatestTelemetry() {
    return this.latestTelemetry;
  }

  // Cleanup
  destroy() {
    if (this.disconnectSubscription) {
      try {
        this.disconnectSubscription.remove();
      } catch {
        // Ignore listener cleanup issues.
      }
      this.disconnectSubscription = null;
    }

    this.disconnectDevice();
    this.disconnectMqtt();
    if (this.bleManager) {
      this.bleManager.destroy();
      this.bleManager = null;
    }
  }
}

export const mobileDataService = new MobileDataService();