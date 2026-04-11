// Debug info exposed for troubleshooting offline mode detection

export interface DebugConnectivityInfo {
  transportMode: 'online' | 'offline' | 'disconnected' | 'unknown';
  netInfoState: {
    isConnected: boolean | null;
    isInternetReachable: boolean | null;
    ipAddress: string | null;
    ssid: string | null;
  } | null;
  mqttBroker: string;
  mqttPort: number;
}

// This variable is populated by the app at runtime
export const currentDebugInfo: DebugConnectivityInfo = {
  transportMode: 'unknown',
  netInfoState: null,
  mqttBroker: '',
  mqttPort: 0
};

export const updateDebugInfo = (info: Partial<DebugConnectivityInfo>) => {
  Object.assign(currentDebugInfo, info);
};

export const getDebugInfo = (): DebugConnectivityInfo => {
  return { ...currentDebugInfo };
};
