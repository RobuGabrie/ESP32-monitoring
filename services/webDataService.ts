import axios from 'axios';
import { Platform } from 'react-native';
import mqtt, { MqttClient } from 'mqtt';

import { ESP32Data, ConnectionStatus, MqttStatus } from '@/hooks/useStore';
import { MQTT_BROKER, MQTT_PASS, MQTT_TOPIC, MQTT_USER, MQTT_WS_PORT, MQTT_WS_PROTOCOL } from '@/constants/config';

// Web service configuration
const API_BASE_URL = process.env.EXPO_PUBLIC_API_URL || 'https://api.skydiver-monitor.com';
const WS_URL = process.env.EXPO_PUBLIC_WS_URL || 'wss://api.skydiver-monitor.com';

// Types for web-specific data
export interface SkydiverAlert {
  id: string;
  type: 'danger' | 'warning' | 'info';
  message: string;
  timestamp: string;
  severity: number;
  resolved: boolean;
}

export interface AnalyticsData {
  sessionId: string;
  jumpData: ESP32Data[];
  alerts: SkydiverAlert[];
  aiPredictions: {
    fallDetected: boolean;
    rotationExcessive: boolean;
    unconscious: boolean;
    stressLevel: number;
    parachuteOpened: boolean;
    positionChanged: boolean;
  };
  statistics: {
    avgHeartRate: number;
    maxGForce: number;
    jumpDuration: number;
    landingAccuracy: number;
  };
}

export interface TeamMember {
  id: string;
  name: string;
  status: 'jumping' | 'ground' | 'offline';
  lastSeen: string;
  alerts: number;
}

class WebDataService {
  private api = axios.create({
    baseURL: API_BASE_URL,
    timeout: 10000,
  });

  private ws: WebSocket | null = null;
  private mqttClient: MqttClient | null = null;
  private mqttReconnectAttempts = 0;
  private mqttMaxReconnectAttempts = 5;
  private mqttTopicMessageHandler: ((data: any) => void) | null = null;
  private mqttStatusHandler: ((status: MqttStatus) => void) | null = null;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;

  constructor() {
    this.setupInterceptors();
  }

  private setupInterceptors() {
    this.api.interceptors.request.use((config) => {
      // Add auth token if available
      const token = this.getAuthToken();
      if (token) {
        config.headers.Authorization = `Bearer ${token}`;
      }
      return config;
    });

    this.api.interceptors.response.use(
      (response) => response,
      (error) => {
        if (error.response?.status === 401) {
          // Handle auth error
          this.handleAuthError();
        }
        return Promise.reject(error);
      }
    );
  }

  private getAuthToken(): string | null {
    // Implement token retrieval from secure storage
    return null; // Placeholder
  }

  private handleAuthError() {
    // Handle authentication error
    console.warn('Authentication failed');
  }

  // WebSocket connection for real-time updates
  connectWebSocket(onMessage: (data: any) => void, onError?: (error: any) => void) {
    if (this.ws?.readyState === WebSocket.OPEN) return;

    try {
      this.ws = new WebSocket(WS_URL);

      this.ws.onopen = () => {
        console.log('WebSocket connected');
        this.reconnectAttempts = 0;
      };

      this.ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          onMessage(data);
        } catch (error) {
          console.error('Failed to parse WebSocket message:', error);
        }
      };

      this.ws.onerror = (error) => {
        console.error('WebSocket error:', error);
        onError?.(error);
      };

      this.ws.onclose = () => {
        console.log('WebSocket closed');
        this.attemptReconnect(onMessage, onError);
      };
    } catch (error) {
      console.error('Failed to connect WebSocket:', error);
      onError?.(error);
    }
  }

  private attemptReconnect(onMessage: (data: any) => void, onError?: (error: any) => void) {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) return;

    this.reconnectAttempts++;
    setTimeout(() => {
      this.connectWebSocket(onMessage, onError);
    }, 1000 * this.reconnectAttempts);
  }

  disconnectWebSocket() {
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
  }

  private getMqttUrl() {
    return `${MQTT_WS_PROTOCOL}://${MQTT_BROKER}:${MQTT_WS_PORT}/mqtt`;
  }

  connectMqttTopic(
    onMessage: (data: any) => void,
    onStatusChange?: (status: MqttStatus) => void
  ) {
    if (Platform.OS !== 'web') {
      return;
    }

    this.mqttTopicMessageHandler = onMessage;
    this.mqttStatusHandler = onStatusChange ?? null;

    if (this.mqttClient?.connected) {
      this.mqttStatusHandler?.('online');
      return;
    }

    this.disconnectMqttTopic();

    const clientId = `esp32-web-${Math.random().toString(16).slice(2, 10)}`;
    this.mqttClient = mqtt.connect(this.getMqttUrl(), {
      clientId,
      username: MQTT_USER,
      password: MQTT_PASS,
      connectTimeout: 10000,
      reconnectPeriod: 0,
      clean: true,
      protocolVersion: 4,
    });

    this.mqttClient.on('connect', () => {
      this.mqttReconnectAttempts = 0;
      this.mqttStatusHandler?.('online');
      this.mqttClient?.subscribe(MQTT_TOPIC, (error) => {
        if (error) {
          console.error('Failed to subscribe web MQTT topic:', error);
        }
      });
    });

    this.mqttClient.on('message', (topic, payload) => {
      if (topic !== MQTT_TOPIC) {
        return;
      }

      try {
        const parsed = JSON.parse(payload.toString());

        if (parsed?.type === 'sensor' && parsed?.payload && typeof parsed.payload === 'object') {
          this.mqttTopicMessageHandler?.({
            type: 'sensor',
            payload: parsed.payload,
            source: 'mqtt',
            topic,
          });
          return;
        }

        this.mqttTopicMessageHandler?.({
          type: 'sensor',
          payload: parsed,
          source: 'mqtt',
          topic,
        });
      } catch (error) {
        console.error('Failed to parse MQTT payload:', error);
      }
    });

    this.mqttClient.on('close', () => {
      this.mqttStatusHandler?.('offline');
      this.scheduleMqttReconnect();
    });

    this.mqttClient.on('error', (error) => {
      this.mqttStatusHandler?.('offline');
      console.error('Web MQTT error:', error);
      this.scheduleMqttReconnect();
    });
  }

  private scheduleMqttReconnect() {
    if (this.mqttReconnectAttempts >= this.mqttMaxReconnectAttempts) {
      return;
    }

    this.mqttReconnectAttempts += 1;
    const delay = 1000 * this.mqttReconnectAttempts;
    setTimeout(() => {
      if (!this.mqttTopicMessageHandler) {
        return;
      }
      this.connectMqttTopic(this.mqttTopicMessageHandler, this.mqttStatusHandler ?? undefined);
    }, delay);
  }

  disconnectMqttTopic() {
    if (this.mqttClient) {
      this.mqttClient.end(true);
      this.mqttClient = null;
    }
    this.mqttStatusHandler?.('offline');
  }

  // API methods for web dashboard
  async getTeamMembers(): Promise<TeamMember[]> {
    const response = await this.api.get('/team/members');
    return response.data;
  }

  async getAnalytics(sessionId: string): Promise<AnalyticsData> {
    const response = await this.api.get(`/analytics/${sessionId}`);
    return response.data;
  }

  async getAlerts(status: 'active' | 'resolved' | 'all' = 'active'): Promise<SkydiverAlert[]> {
    const response = await this.api.get('/alerts', { params: { status } });
    return response.data;
  }

  async resolveAlert(alertId: string): Promise<void> {
    await this.api.patch(`/alerts/${alertId}/resolve`);
  }

  async getHistoricalData(
    startDate: string,
    endDate: string,
    memberId?: string
  ): Promise<ESP32Data[]> {
    const response = await this.api.get('/data/historical', {
      params: { startDate, endDate, memberId }
    });
    return response.data;
  }

  async getStatistics(timeRange: string): Promise<any> {
    const response = await this.api.get('/statistics', {
      params: { timeRange }
    });
    return response.data;
  }

  // Connection status for web (always online when connected to internet)
  getConnectionStatus(): ConnectionStatus {
    return navigator.onLine ? 'online' : 'offline';
  }

  getMqttStatus(): MqttStatus {
    return this.mqttClient?.connected ? 'online' : 'offline';
  }

  // Send command to specific team member
  async sendCommand(memberId: string, command: string, params?: any): Promise<void> {
    await this.api.post(`/team/${memberId}/command`, {
      command,
      params,
      timestamp: new Date().toISOString()
    });
  }
}

export const webDataService = new WebDataService();