import { useEffect, useState, useCallback } from 'react';
import { Platform } from 'react-native';

import { mobileDataService, ScanDevicesOptions } from '@/services/mobileDataService';
import { webDataService } from '@/services/webDataService';
import { ESP32Data, ConnectionStatus, MqttStatus } from '@/hooks/useStore';

// Unified types that work for both platforms
export type UnifiedSensorData = ESP32Data & {
  // Skydiver-specific fields
  heartRate?: number;
  bloodOxygen?: number;
  stressLevel?: number;
  bodyTemp?: number;
  parachuteState?: 'closed' | 'opening' | 'open';
  positionState?: 'stable' | 'falling' | 'rotating' | 'unconscious';
};

export interface UnifiedAnalytics {
  alerts: any[];
  predictions: {
    fallDetected: boolean;
    rotationExcessive: boolean;
    unconscious: boolean;
    stressLevel: number;
    parachuteOpened: boolean;
    positionChanged: boolean;
  };
  statistics: any;
}

export interface ConnectivityState {
  connectionStatus: ConnectionStatus;
  mqttStatus: MqttStatus;
  isOnline: boolean;
  connectedAt: Date | null;
  lastDataReceived: Date | null;
  hasReceivedData: boolean;
  dataStreamStatus: 'idle' | 'waiting' | 'live' | 'stale';
  deviceName?: string;
  deviceId?: string;
  lastDataSource?: 'ble' | 'websocket' | 'mqtt';
  lastMqttTopic?: string;
  mqttMessagesReceived: number;
}

export interface DiveSessionState {
  isActive: boolean;
  sessionId: string | null;
}

// Platform-specific service selector
const getDataService = () => {
  return Platform.OS === 'web' ? webDataService : mobileDataService;
};

export const useConnectivity = () => {
  const WAITING_FIRST_PACKET_TIMEOUT_MS = 12000;
  const initialMobileConnectedInfo = Platform.OS === 'web' ? null : mobileDataService.getConnectedDeviceInfo();
  const initialMobileConnectionStatus = Platform.OS === 'web' ? 'disconnected' : mobileDataService.getConnectionStatus();
  const initialMobileTelemetry = Platform.OS === 'web' ? null : mobileDataService.getLatestTelemetry();
  const initialConnectedAt = initialMobileConnectionStatus === 'online' ? new Date() : null;
  const initialLastDataReceived = initialMobileTelemetry ? new Date(initialMobileTelemetry.recordedAtMs ?? Date.now()) : null;

  const [connectivityState, setConnectivityState] = useState<ConnectivityState>({
    connectionStatus: Platform.OS === 'web' ? 'disconnected' : initialMobileConnectionStatus,
    mqttStatus: Platform.OS === 'web' ? 'offline' : mobileDataService.getMqttStatus(),
    isOnline: Platform.OS === 'web' ? false : initialMobileConnectionStatus === 'online',
    connectedAt: initialConnectedAt,
    lastDataReceived: initialLastDataReceived,
    hasReceivedData: !!initialMobileTelemetry,
    dataStreamStatus:
      Platform.OS === 'web'
        ? 'idle'
        : initialMobileConnectionStatus !== 'online'
          ? 'idle'
          : initialMobileTelemetry
            ? 'live'
            : 'waiting',
    deviceId: initialMobileConnectedInfo?.id ?? undefined,
    deviceName: initialMobileConnectedInfo?.name ?? undefined,
    lastDataSource: initialMobileTelemetry ? 'ble' : undefined,
    mqttMessagesReceived: 0,
  });

  const [currentData, setCurrentData] = useState<UnifiedSensorData | null>(initialMobileTelemetry);
  const [analytics, setAnalytics] = useState<UnifiedAnalytics | null>(null);
  const [diveSessionState, setDiveSessionState] = useState<DiveSessionState>({
    isActive: false,
    sessionId: null,
  });

  const service = getDataService();

  // Initialize connectivity monitoring
  useEffect(() => {
    const updateConnectivity = () => {
      const mqttStatus = service.getMqttStatus();
      const connectionStatus = Platform.OS === 'web'
        ? (mqttStatus === 'online' ? 'online' : 'offline')
        : service.getConnectionStatus();
      const isOnline = connectionStatus === 'online';
      const connectedInfo = Platform.OS === 'web' ? { id: undefined, name: undefined } : mobileDataService.getConnectedDeviceInfo();
      const now = Date.now();

      setConnectivityState(prev => ({
        ...prev,
        connectionStatus,
        mqttStatus,
        isOnline,
        connectedAt: isOnline ? (prev.connectedAt ?? new Date()) : null,
        dataStreamStatus: !isOnline
          ? 'idle'
          : !prev.lastDataReceived
            ? prev.connectedAt && now - prev.connectedAt.getTime() > WAITING_FIRST_PACKET_TIMEOUT_MS
              ? 'stale'
              : 'waiting'
            : Date.now() - prev.lastDataReceived.getTime() <= 7000
              ? 'live'
              : 'stale',
        deviceId: connectedInfo.id ?? undefined,
        deviceName: connectedInfo.name ?? prev.deviceName,
      }));
    };

    // Initial check
    updateConnectivity();

    // Set up periodic checks
    const interval = setInterval(updateConnectivity, 5000);

    return () => clearInterval(interval);
  }, [service]);

  // Set up data listeners
  useEffect(() => {
    if (Platform.OS === 'web') {
      // Web: Consume only MQTT topic data pushed by mobile BLE bridge.
      const handleMqttMessage = (data: any) => {
        if (data.type === 'sensor') {
          setCurrentData(data.payload);
          setConnectivityState(prev => ({
            ...prev,
            lastDataReceived: new Date(),
            hasReceivedData: true,
            dataStreamStatus: 'live',
            lastDataSource: 'mqtt',
            lastMqttTopic: data.topic ?? prev.lastMqttTopic,
            mqttMessagesReceived: prev.mqttMessagesReceived + 1,
          }));
        }
      };

      webDataService.connectMqttTopic(handleMqttMessage, (status) => {
        const now = Date.now();
        setConnectivityState(prev => ({
          ...prev,
          mqttStatus: status,
          connectionStatus: status === 'online' ? 'online' : 'offline',
          isOnline: status === 'online',
          connectedAt: status === 'online' ? (prev.connectedAt ?? new Date()) : null,
          dataStreamStatus: status === 'online'
            ? prev.lastDataReceived
              ? (Date.now() - prev.lastDataReceived.getTime() <= 7000 ? 'live' : 'stale')
              : prev.connectedAt && now - prev.connectedAt.getTime() > WAITING_FIRST_PACKET_TIMEOUT_MS
                ? 'stale'
                : 'waiting'
            : 'idle',
        }));
      });

      return () => {
        webDataService.disconnectMqttTopic();
      };
    } else {
      // Mobile: Set up BLE data listeners
      const unsubscribeData = mobileDataService.onDataReceived((data: UnifiedSensorData) => {
        setCurrentData(data);
        setConnectivityState(prev => ({
          ...prev,
          lastDataReceived: new Date(),
          hasReceivedData: true,
          dataStreamStatus: 'live',
          lastDataSource: 'ble',
        }));
      });

      const unsubscribeConnection = mobileDataService.onConnectionChange((status: ConnectionStatus) => {
        const now = Date.now();
        setConnectivityState(prev => ({
          ...prev,
          connectionStatus: status,
          isOnline: status === 'online',
          connectedAt: status === 'online' ? (prev.connectedAt ?? new Date()) : null,
          dataStreamStatus: status !== 'online'
            ? 'idle'
            : prev.lastDataReceived
              ? (Date.now() - prev.lastDataReceived.getTime() <= 7000 ? 'live' : 'stale')
              : prev.connectedAt && now - prev.connectedAt.getTime() > WAITING_FIRST_PACKET_TIMEOUT_MS
                ? 'stale'
                : 'waiting',
          ...(status === 'online'
            ? null
            : {
                deviceName: undefined,
                deviceId: undefined,
              }),
        }));
      });

      return () => {
        unsubscribeData();
        unsubscribeConnection();
      };
    }
  }, []);

  useEffect(() => {
    if (Platform.OS === 'web') {
      return;
    }

    let mounted = true;
    mobileDataService.getDiveSessionState().then((state) => {
      if (!mounted) return;
      setDiveSessionState(state);
    }).catch(() => {
      if (!mounted) return;
      setDiveSessionState({ isActive: false, sessionId: null });
    });

    return () => {
      mounted = false;
    };
  }, []);

  // Platform-specific methods
  const connect = useCallback(async (deviceId?: string) => {
    if (Platform.OS === 'web') {
      // Web doesn't need explicit connection - it's always online
      return true;
    } else {
      // Mobile: Connect to BLE device
      if (!deviceId) return false;
      const success = await mobileDataService.connectToDevice(deviceId);
      if (success) {
        const info = mobileDataService.getConnectedDeviceInfo();
        setConnectivityState(prev => ({
          ...prev,
          connectionStatus: 'online',
          isOnline: true,
          connectedAt: prev.connectedAt ?? new Date(),
          dataStreamStatus: prev.lastDataReceived ? 'live' : 'waiting',
          deviceId: info.id ?? deviceId,
          deviceName: info.name ?? prev.deviceName,
        }));
      }
      return success;
    }
  }, []);

  const disconnect = useCallback(() => {
    if (Platform.OS === 'web') {
      webDataService.disconnectMqttTopic();
    } else {
      mobileDataService.disconnectDevice();
      setConnectivityState(prev => ({
        ...prev,
        connectionStatus: 'disconnected',
        isOnline: false,
        connectedAt: null,
        dataStreamStatus: 'idle',
        deviceId: undefined,
        deviceName: undefined,
      }));
    }
  }, []);

  const sendCommand = useCallback(async (command: string, params?: any) => {
    if (Platform.OS === 'web') {
      // Web: Send command via API (to specific team member)
      await webDataService.sendCommand('all', command, params);
    } else {
      // Mobile: Send command via BLE
      await mobileDataService.sendCommand(command, params);
    }
  }, []);

  const scanDevices = useCallback(async (options?: ScanDevicesOptions) => {
    if (Platform.OS === 'web') {
      // Web doesn't scan for devices
      return [];
    } else {
      return await mobileDataService.scanForDevices(options);
    }
  }, []);

  const getAnalytics = useCallback(async (sessionId?: string) => {
    if (Platform.OS === 'web') {
      if (!sessionId) return null;
      return await webDataService.getAnalytics(sessionId);
    } else {
      // Mobile: Return cached analytics or null
      return null;
    }
  }, []);

  const getTeamMembers = useCallback(async () => {
    if (Platform.OS === 'web') {
      return await webDataService.getTeamMembers();
    } else {
      // Mobile: No team concept in BLE mode
      return [];
    }
  }, []);

  const getHistoricalData = useCallback(async (startDate: string, endDate: string) => {
    if (Platform.OS === 'web') {
      return await webDataService.getHistoricalData(startDate, endDate);
    } else {
      // Mobile: Return cached data for the date range
      const start = new Date(startDate);
      const end = new Date(endDate);
      const dates: string[] = [];

      for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
        dates.push(d.toISOString().split('T')[0]);
      }

      const allData: UnifiedSensorData[] = [];
      for (const date of dates) {
        const dayData = await mobileDataService.getCachedData(date);
        allData.push(...dayData);
      }

      return allData;
    }
  }, []);

  const startDiveSession = useCallback(async () => {
    if (Platform.OS === 'web') {
      return null;
    }

    const sessionId = await mobileDataService.startDiveSession();
    setDiveSessionState({ isActive: true, sessionId });
    return sessionId;
  }, []);

  const stopDiveSession = useCallback(async () => {
    if (Platform.OS === 'web') {
      return null;
    }

    const sessionId = await mobileDataService.stopDiveSession();
    setDiveSessionState({ isActive: false, sessionId: null });
    return sessionId;
  }, []);

  return {
    // State
    connectivityState,
    currentData,
    analytics,
    diveSessionState,

    // Methods
    connect,
    disconnect,
    sendCommand,
    scanDevices,
    getAnalytics,
    getTeamMembers,
    getHistoricalData,
    startDiveSession,
    stopDiveSession,

    // Platform info
    isWeb: Platform.OS === 'web',
    isMobile: Platform.OS !== 'web',
  };
};