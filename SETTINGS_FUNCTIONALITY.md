# Settings Page Functionality Status

**Dashboard:** ESP32 Monitor SUD0  
**Screen:** `app/(tabs)/settings.tsx`  
**Last Updated:** 2026-04-07

## 📋 Executive Summary

This document maps all UI controls in the Settings screen to their MQTT implementation status, showing what's **fully functional**, **partially implemented**, or **read-only**.

---

## ✅ Fully Functional Features

### 1. **NTC Termistor** (Temperature Sensor Switch)
- **UI Control:** Toggle switch
- **MQTT Topic:** `hardandsoft/esp32/cmd`
- **Message Format (Legacy):**
  ```json
  {
    "module": "temperature",
    "enabled": true
  }
  ```
- **Hook:** `sendModuleCommand('temperature', value)`
- **State Sync:** Yes - `moduleStates.temperature` updated from `hardandsoft/esp32/state`
- **Expected Response:**
  ```json
  {
    "modules": {
      "temperature": true
    }
  }
  ```
- **Status:** ✅ **Works end-to-end** if ESP32 publishes state updates

---

### 2. **Restart ESP32** (System Command)
- **UI Control:** Button with confirmation Alert
- **MQTT Topic:** `hardandsoft/esp32/cmd`
- **Message Format:**
  ```json
  {
    "id": "cmd-1712486400000-001",
    "action": "system.restart",
    "params": {},
    "ts": "2026-04-07T12:00:00Z",
    "source": "mobile-app"
  }
  ```
- **Hook:** `publishSpecCommand('system.restart')`
- **ACK Expected:** Yes, via `lastCommandAck` in state topic
- **Toast Feedback:** "Comandă restart trimisă." or "MQTT indisponibil."
- **Status:** ✅ **Works** - ESP32 should reboot and reconnect

---

### 3. **Factory Reset** (System Command)
- **UI Control:** Button with destructive confirmation Alert
- **MQTT Topic:** `hardandsoft/esp32/cmd`
- **Message Format:**
  ```json
  {
    "id": "cmd-...",
    "action": "system.factory_reset",
    "params": {
      "erase_nvs": true,
      "reboot": true
    },
    "ts": "...",
    "source": "mobile-app"
  }
  ```
- **Hook:** `publishSpecCommand('system.factory_reset', {...})`
- **Local Reset:** Yes, resets all UI switches to defaults
- **Toast Feedback:** "Comandă factory reset trimisă." or "MQTT indisponibil."
- **Status:** ✅ **Works** - ESP32 should erase NVS and reboot

---

## ⚠️ Partially Functional Features

### 4. **Credențiale WiFi** (WiFi Credentials Sheet)
- **UI Control:** Bottom sheet with 4 text inputs (STA SSID/Pass, AP SSID/Pass)
- **MQTT Topic:** `hardandsoft/esp32/cmd`
- **Message Format:**
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
- **Hook:** `publishSpecCommand('wifi.set_credentials', {...})`
- **UI Display:** Shows `data?.ssid` and `data?.ip`
- **Limitation:** UI shows current state only if ESP32 publishes updated WiFi info in state topic
- **Expected State Update:**
  ```json
  {
    "wifi": {
      "sta_ssid": "Casa_mea_WiFi",
      "ap_ssid": "SUDO_AP",
      "ip": "192.168.4.1",
      "rssi": -52,
      "mac": "AA:BB:CC:DD:EE:FF",
      "channel": 6,
      "mode": "apsta"
    }
  }
  ```
- **Status:** ⚠️ **Command sent, confirmation uncertain**

---

### 5. **Server MQTT** (Broker Configuration Sheet)
- **UI Control:** Bottom sheet with host/port/username/password inputs
- **MQTT Topic:** `hardandsoft/esp32/cmd`
- **Message Format:**
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
- **Hook:** `publishSpecCommand('mqtt.set_broker', {...})`
- **Limitation:** ⚠️ **Only changes ESP32's broker, NOT the app's broker** (app broker is hardcoded in `constants/config.ts`)
- **Use Case:** Limited - useful only if ESP32 needs to connect to a different broker than the app
- **Status:** ⚠️ **Command sent, but disconnects ESP32 if broker changes**

---

### 6. **Soft AP Mode** (Access Point Switch)
- **UI Control:** Toggle switch
- **MQTT Topic:** `hardandsoft/esp32/cmd`
- **Message Format:**
  ```json
  {
    "action": "wifi.softap.set",
    "params": {
      "enabled": true
    }
  }
  ```
- **Hook:** `publishSpecCommand('wifi.softap.set', {enabled: value})`
- **Local State:** Yes - switch updates immediately
- **Server Confirmation:** Depends on ESP32 publishing state update
- **Status:** ⚠️ **Command sent, real state uncertain**

---

### 7. **Auto-reconnect** (MQTT Auto-reconnect Switch)
- **UI Control:** Toggle switch
- **MQTT Topic:** `hardandsoft/esp32/cmd`
- **Message Format:**
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
- **Hook:** `publishSpecCommand('mqtt.set_auto_reconnect', {...})`
- **Local State:** Yes
- **Server Confirmation:** Uncertain
- **Status:** ⚠️ **Command sent, ESP32 behavior depends on implementation**

---

### 8. **OLED Display** (Display Enable Switch)
- **UI Control:** Toggle switch
- **MQTT Topic:** `hardandsoft/esp32/cmd`
- **Message Format:**
  ```json
  {
    "action": "display.oled.set",
    "params": {
      "enabled": true
    }
  }
  ```
- **Hook:** `publishSpecCommand('display.oled.set', {enabled: value})`
- **Local State:** Yes
- **Expected Response:** ESP32 should turn SSD1306 display ON/OFF
- **Status:** ⚠️ **Command sent, visual feedback depends on ESP32 ACK**

---

### 9. **Deep Sleep** (Power Management Switch)
- **UI Control:** Toggle switch
- **MQTT Topic:** `hardandsoft/esp32/cmd`
- **Message Format:**
  ```json
  {
    "action": "system.deep_sleep.set",
    "params": {
      "enabled": true,
      "idle_timeout_s": 60
    }
  }
  ```
- **Hook:** `publishSpecCommand('system.deep_sleep.set', {...})`
- **Local State:** Yes
- **Warning:** ⚠️ **If enabled, ESP32 may enter deep sleep and disconnect from MQTT after idle timeout**
- **Status:** ⚠️ **Command sent, connection may be lost**

---

### 10. **Firmware Check** (OTA Update Trigger)
- **UI Control:** Button in firmware info sheet
- **MQTT Topic:** `hardandsoft/esp32/cmd`
- **Message Format:**
  ```json
  {
    "action": "firmware.check",
    "params": {}
  }
  ```
- **Hook:** `publishSpecCommand('firmware.check')`
- **Sheet Info:** Shows hardcoded version info (`v2.1.0`, build `2026.04.07`, SDK `ESP-IDF 5.2`)
- **OTA Start:** Not implemented in UI (only check is wired)
- **Status:** ⚠️ **Command sent, OTA not fully implemented**

---

## 📖 Read-Only (Display Only)

### 11. **Rețea conectată** (Current WiFi Network)
- **UI Control:** Pressable row → opens info sheet
- **Displays:** 
  - SSID: `data?.ssid ?? 'SUDO_AP'`
  - WiFi signal bars based on RSSI
  - Mode: Soft AP Mode (hardcoded text)
- **Sheet Info:** IP / MAC / RSSI / Channel / Connection mode
- **Data Source:** `data` from `useESP32()` hook, populated by `hardandsoft/esp32/state`
- **Expected Format:**
  ```json
  {
    "wifi": {
      "sta_ssid": "Casa_mea_WiFi",
      "ap_ssid": "SUDO_AP",
      "ip": "192.168.4.1",
      "rssi": -52,
      "mac": "AA:BB:CC:DD:EE:FF",
      "channel": 6
    }
  }
  ```
- **Status:** 📖 **Display only**, no control

---

### 12. **Device Info Card** (ESP32 Hardware Info)
- **UI Control:** Non-interactive card at top of screen
- **Displays:**
  - Device: `ESP32-C3 Super Mini`
  - Firmware: `SUDO · v2.1.0`
  - Status badge: `● ONLINE` or `○ OFFLINE`
  - IP Address
  - MAC Address
  - Uptime (formatted as HH:MM:SS)
  - Heap free: `142 KB` ⚠️ **hardcoded**
  - Flash: `4 MB` ⚠️ **hardcoded**
  - CPU: `160 MHz` ⚠️ **hardcoded**
- **Data Source:** Mix of live (`data.ip`, `data.mac`, `data.uptime`) and hardcoded values
- **Status:** 📖 **Display only**, partially live

---

### 13. **MQTT Status Badge**
- **UI Control:** Badge in "Server MQTT" row
- **Displays:** `● Activ` (green) or `● Offline` (red)
- **Data Source:** `mqttStatus` from `useESP32()` (internal MQTT client connection state)
- **Real-time:** Yes - updates automatically on connect/disconnect
- **Status:** 📖 **Display only**, reflects app's MQTT connection

---

### 14. **Firmware Info Sheet**
- **UI Control:** Bottom sheet opened by "Firmware" row
- **Displays:**
  - Versiune: `v2.1.0` ⚠️ **hardcoded**
  - Build date: `2026.04.07` ⚠️ **hardcoded**
  - SDK: `ESP-IDF 5.2` ⚠️ **hardcoded**
  - Chip: `ESP32-C3` ⚠️ **hardcoded**
  - Status badge: `Latest` (green)
- **Action:** "Verifică actualizări" button sends `firmware.check` command
- **Recommendation:** ESP32 should publish real firmware info in state:
  ```json
  {
    "system": {
      "firmware": "v2.1.0",
      "build_date": "2026.04.07",
      "sdk_version": "5.2.1",
      "chip_model": "ESP32-C3"
    }
  }
  ```
- **Status:** 📖 **Mostly hardcoded**, check button works

---

## 🗑️ Removed Features (Cleaned Up)

The following features were present in the spec but **removed from UI** for simplicity:

- ❌ **Scanează rețele** - WiFi network scanning (removed)
- ❌ **Topicuri MQTT** - MQTT topics display sheet (removed, read-only redundant)
- ❌ **Interval citire** - Sampling interval fixed action (removed, not user-configurable)
- ❌ **MPU-9250 IMU config** - IMU configuration action (removed, not user-configurable)
- ❌ **Jurnal sistem** - System logs viewer (removed, not very useful)
- ❌ **Despre SUDO** - About page (removed, informational only)

---

## 🔌 MQTT Contract Summary

### Command Topic: `hardandsoft/esp32/cmd`

**Format 1 - New Spec (with ACK tracking):**
```json
{
  "id": "cmd-1712486400000-001",
  "action": "wifi.set_credentials | mqtt.set_broker | system.restart | ...",
  "params": { /* action-specific */ },
  "ts": "2026-04-07T12:00:00Z",
  "source": "mobile-app"
}
```

**Format 2 - Legacy (backward compatible module toggle):**
```json
{
  "module": "temperature" | "light" | "cpu" | "current" | "cpu_stress",
  "enabled": true | false
}
```

---

### State Topic: `hardandsoft/esp32/state`

**Full State Message (QoS 1, retain):**
```json
{
  "ts": "2026-04-07T12:00:01Z",
  "last_command": {
    "id": "cmd-1712486400000-001",
    "action": "wifi.set_credentials",
    "status": "ok" | "error" | "failed",
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
    "rssi": -52,
    "mac": "AA:BB:CC:DD:EE:FF",
    "channel": 6
  },
  "mqtt": {
    "broker": "broker.emqx.io",
    "port": 1883,
    "auto_reconnect": true,
    "connected": true
  },
  "system": {
    "deep_sleep": false,
    "firmware": "v2.1.0",
    "build_date": "2026.04.07",
    "uptime": 3600,
    "heap_free": 145408,
    "flash_size": 4194304,
    "cpu_freq_mhz": 160
  }
}
```

---

## 📝 ESP32 Implementation Checklist

To achieve full functionality, the ESP32 firmware should:

- [x] **Basic telemetry** - Publish sensor data to `hardandsoft/esp32/data`
- [x] **Module toggle** - Listen for `{"module": "temperature", "enabled": true}` on cmd topic
- [ ] **Full state publishing** - Publish complete state to `hardandsoft/esp32/state` (QoS 1, retain)
- [ ] **Command ACK** - When receiving a command with `id`, respond with `last_command` in state
- [ ] **WiFi state** - Publish current WiFi info (SSID, IP, RSSI, MAC, channel) in state
- [ ] **MQTT state** - Publish broker config in state (for sync with UI)
- [ ] **System state** - Publish uptime, heap, firmware version, deep sleep status
- [ ] **WiFi credentials** - Handle `wifi.set_credentials` action
- [ ] **Soft AP control** - Handle `wifi.softap.set` action
- [ ] **MQTT reconnect** - Handle `mqtt.set_auto_reconnect` action
- [ ] **OLED control** - Handle `display.oled.set` action
- [ ] **Deep sleep** - Handle `system.deep_sleep.set` action (with idle timeout)
- [ ] **Restart** - Handle `system.restart` action
- [ ] **Factory reset** - Handle `system.factory_reset` action (erase NVS, reboot)
- [ ] **Firmware check** - Handle `firmware.check` action (optional OTA)

---

## 🧪 Testing Commands

### Subscribe to all ESP32 topics:
```bash
mosquitto_sub -h broker.emqx.io -p 1883 -t 'hardandsoft/esp32/#' -v
```

### Test restart command:
```bash
mosquitto_pub -h broker.emqx.io -p 1883 -t hardandsoft/esp32/cmd \
  -m '{"id":"test-1","action":"system.restart"}'
```

### Test module toggle (legacy):
```bash
mosquitto_pub -h broker.emqx.io -p 1883 -t hardandsoft/esp32/cmd \
  -m '{"module":"temperature","enabled":false}'
```

### Mock state publish (for testing app):
```bash
mosquitto_pub -h broker.emqx.io -p 1883 -t hardandsoft/esp32/state -r \
  -m '{
    "ts":"2026-04-07T12:00:00Z",
    "modules":{"temperature":true,"light":true,"cpu":true,"current":true},
    "wifi":{"sta_ssid":"TestNet","ip":"192.168.1.100","rssi":-45,"mac":"AA:BB:CC:DD:EE:FF","channel":6},
    "system":{"firmware":"v2.1.0","uptime":3600,"heap_free":145408}
  }'
```

---

## 🎨 UI/UX Notes

- **Cross-platform toast**: Fixed `ToastAndroid` crash on web by creating `lib/showToast.ts` helper
- **Responsive layout**: Settings adapt to wide screens (tablets/desktop web)
- **Visual hierarchy**: Clear sections with labeled groups and danger zone separation
- **Feedback**: All actions show toast notifications (success or MQTT offline warnings)
- **State sync**: Module switches reflect real ESP32 state when available
- **Confirmation dialogs**: Destructive actions (restart, factory reset) require user confirmation

---

**For detailed MQTT message specs, see:** [SETTINGS_MQTT_SPEC.md](./SETTINGS_MQTT_SPEC.md)
