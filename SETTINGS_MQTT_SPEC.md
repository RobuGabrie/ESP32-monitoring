# Settings MQTT Spec

This document defines the MQTT topics and message contracts needed to make all options in `app/(tabs)/settings.tsx` functional.

## 1. Current MQTT Topics In App

These are already defined in `constants/config.ts` and partially used by `hooks/useESP32.ts`:

- `hardandsoft/esp32/data` (`MQTT_TOPIC`): telemetry publish from ESP32
- `hardandsoft/esp32/imu` (`MQTT_IMU_TOPIC`): IMU stream (currently consumed by WS path, keep for compatibility)
- `hardandsoft/esp32/gpio_raw` (`MQTT_RAW_TOPIC`): raw IO samples publish from ESP32
- `hardandsoft/esp32/cmd` (`MQTT_CMD_TOPIC`): command publish from app to ESP32
- `hardandsoft/esp32/state` (`MQTT_STATE_TOPIC`): state publish from ESP32 to app

## 2. Recommended Topic Contract For Settings

Use these topics and keep all settings traffic under one command and one state topic for simplicity.

| Topic | Direction | Purpose |
|---|---|---|
| `hardandsoft/esp32/cmd` | App -> ESP32 | Commands triggered by settings actions |
| `hardandsoft/esp32/state` | ESP32 -> App | Current state + command acks |
| `hardandsoft/esp32/log` | ESP32 -> App (optional) | System log lines for "Jurnal sistem" |

Suggested QoS/retain:

- `cmd`: QoS 1, retain false
- `state`: QoS 1, retain true
- `log`: QoS 0, retain false

## 3. Common Message Envelope

Use a common envelope so app and firmware can match requests and responses.

### 3.1 Command message (`hardandsoft/esp32/cmd`)

```json
{
  "id": "cmd-1712486400000-001",
  "action": "wifi.set_credentials",
  "params": {},
  "ts": "2026-04-07T12:00:00Z",
  "source": "mobile-app"
}
```

### 3.2 Ack/state message (`hardandsoft/esp32/state`)

```json
{
  "ts": "2026-04-07T12:00:01Z",
  "last_command": {
    "id": "cmd-1712486400000-001",
    "action": "wifi.set_credentials",
    "status": "ok",
    "message": "saved"
  },
  "modules": {
    "temperature": true,
    "light": true,
    "cpu": true,
    "current": true,
    "cpu_stress": false
  },
  "wifi": {
    "mode": "apsta",
    "sta_ssid": "Casa_mea_WiFi",
    "ap_ssid": "SUDO_AP",
    "ip": "192.168.4.1",
    "rssi": -52
  },
  "mqtt": {
    "broker": "broker.emqx.io",
    "port": 1883,
    "auto_reconnect": true,
    "connected": true
  },
  "sampling": {
    "interval_ms": 1000
  },
  "system": {
    "deep_sleep": false,
    "firmware": "v2.1.0"
  }
}
```

Note: `hooks/useESP32.ts` already parses `module`/`enabled` and `modules` object from `MQTT_STATE_TOPIC`.

## 4. Settings Option -> MQTT Action Map

## WiFi section

### 4.1 "Credentiale WiFi" (Save and reconnect)

Action:

```json
{
  "action": "wifi.set_credentials",
  "params": {
    "sta_ssid": "Casa_mea_WiFi",
    "sta_password": "your-pass",
    "ap_ssid": "SUDO_AP",
    "ap_password": "your-ap-pass",
    "reconnect": true
  }
}
```

Expected state update fields:

- `wifi.sta_ssid`
- `wifi.ap_ssid`
- `wifi.mode`
- `wifi.ip`

### 4.2 "Scaneaza retele"

Request:

```json
{
  "action": "wifi.scan.start",
  "params": {
    "max_results": 20,
    "timeout_ms": 5000
  }
}
```

Response (can be in `state` or a dedicated scan result event):

```json
{
  "action": "wifi.scan.result",
  "networks": [
    { "ssid": "Casa_mea_WiFi", "rssi": -45, "auth": "WPA2" },
    { "ssid": "Guest_WiFi", "rssi": -65, "auth": "OPEN" }
  ]
}
```

### 4.3 "Soft AP Mode" switch

```json
{
  "action": "wifi.softap.set",
  "params": {
    "enabled": true
  }
}
```

## MQTT section

### 4.4 "Server MQTT" (broker config)

```json
{
  "action": "mqtt.set_broker",
  "params": {
    "host": "broker.emqx.io",
    "port": 1883,
    "username": "emqx",
    "password": "public",
    "transport": "tcp"
  }
}
```

### 4.5 "Topicuri MQTT" (if editable later)

```json
{
  "action": "mqtt.set_topics",
  "params": {
    "data": "hardandsoft/esp32/data",
    "raw": "hardandsoft/esp32/gpio_raw",
    "state": "hardandsoft/esp32/state",
    "cmd": "hardandsoft/esp32/cmd"
  }
}
```

### 4.6 "Auto-reconnect" switch

```json
{
  "action": "mqtt.set_auto_reconnect",
  "params": {
    "enabled": true,
    "max_retries": 5,
    "retry_ms": 5000
  }
}
```

## Sensors and Sampling section

### 4.7 "Interval citire"

```json
{
  "action": "sampling.set_interval",
  "params": {
    "interval_ms": 1000
  }
}
```

### 4.8 "MPU-9250 IMU" config

```json
{
  "action": "imu.configure",
  "params": {
    "enabled": true,
    "filter": "madgwick",
    "i2c_address": "0x69",
    "int_gpio": 10,
    "rate_hz": 100
  }
}
```

### 4.9 "NTC Termistor" switch

Two valid options:

1. Reuse existing module contract already supported by app:

```json
{
  "module": "temperature",
  "enabled": true
}
```

2. Explicit action style:

```json
{
  "action": "sensor.ntc.set",
  "params": {
    "enabled": true
  }
}
```

### 4.10 "OLED Display" switch

```json
{
  "action": "display.oled.set",
  "params": {
    "enabled": true
  }
}
```

## System section

### 4.11 "Deep Sleep" switch

```json
{
  "action": "system.deep_sleep.set",
  "params": {
    "enabled": true,
    "idle_timeout_s": 60
  }
}
```

### 4.12 "Firmware" actions

Check:

```json
{
  "action": "firmware.check"
}
```

Start OTA:

```json
{
  "action": "firmware.ota.start",
  "params": {
    "url": "https://example.com/firmware.bin",
    "sha256": "..."
  }
}
```

### 4.13 "Restart ESP32"

```json
{
  "action": "system.restart"
}
```

### 4.14 "Factory Reset"

```json
{
  "action": "system.factory_reset",
  "params": {
    "erase_nvs": true,
    "reboot": true
  }
}
```

### 4.15 "Jurnal sistem"

Publish device logs to `hardandsoft/esp32/log`:

```json
{
  "ts": "2026-04-07T12:05:00Z",
  "level": "WARN",
  "code": "WIFI_WEAK_SIGNAL",
  "message": "WiFi signal weak: -78 dBm"
}
```

## 5. Minimal Backward-Compatible Support (Required)

To work with current app parsing in `hooks/useESP32.ts`, ESP32 should at least support:

1. Command topic `hardandsoft/esp32/cmd` with payloads:
   - `{ "module": "temperature"|"light"|"cpu"|"current", "enabled": boolean }`
   - `{ "module": "cpu_stress", "enabled": boolean }`
2. State topic `hardandsoft/esp32/state` with either:
   - `{ "module": "temperature", "enabled": true }`
   - or `{ "modules": { "temperature": true, "light": true, "cpu": true, "current": true, "cpu_stress": false } }`
3. Telemetry topic `hardandsoft/esp32/data` and raw topic `hardandsoft/esp32/gpio_raw` as already consumed.

## 6. Quick MQTT CLI Tests

Subscribe:

```bash
mosquitto_sub -h broker.emqx.io -p 1883 -t 'hardandsoft/esp32/#' -v
```

Send restart command:

```bash
mosquitto_pub -h broker.emqx.io -p 1883 -t hardandsoft/esp32/cmd -m '{"id":"test-1","action":"system.restart"}'
```

Send module toggle (already app-compatible):

```bash
mosquitto_pub -h broker.emqx.io -p 1883 -t hardandsoft/esp32/cmd -m '{"module":"temperature","enabled":false}'
```
