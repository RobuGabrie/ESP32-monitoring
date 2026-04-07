import { useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Text, View, Pressable, Modal } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';

import { ScreenShell } from '@/components/ScreenShell';
import { AppTheme } from '@/constants/theme';
import { useAppTheme } from '@/hooks/useAppTheme';
import { useESP32 } from '@/hooks/useESP32';

type SensorDetail = {
  pin: string;
  label: string;
  sensor?: string;
  value: string | number;
  type: 'digital' | 'analog' | 'power' | 'i2c' | 'imu' | 'thermal';
  status?: 'active' | 'idle' | 'offline';
  specs?: string[];
  category?: 'gpio' | 'i2c-bus' | 'i2c-device' | 'analog' | 'power';
};

// Firmware configuration from ESP32 - Actual Hardware Setup
const ESP32_CONFIG = {
  pins: {
    I2C_SDA: 8,
    I2C_SCL: 9,
    BTN_NEXT: 3,
    BTN_PREV: 4,
    INA_INT: 10,      // INA219 interrupt pin
    THERM_PIN: 0,     // NTC Thermistor ADC input
    GPIO_PUBLISH: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 20, 21]
  },
  i2c: {
    devices: [
      { 
        name: 'MPU9250', 
        addr: '0x68', 
        type: '9-Axis IMU', 
        description: 'Gyroscope + Accelerometer + Magnetometer',
        specs: ['±2000°/s gyro', '±2g accel', '62.5Hz sample rate']
      },
      { 
        name: 'INA219', 
        addr: '0x40', 
        type: 'Power Monitor', 
        description: 'High-side current/voltage/power sensor',
        specs: ['±3.2A current', '0-26V bus voltage', 'INT on GPIO10']
      },
      { 
        name: 'DS1307 RTC', 
        addr: '0x68', 
        type: 'Real-Time Clock', 
        description: 'Battery-backed RTC with 56 bytes RAM',
        specs: ['I2C interface', 'Square wave output', 'Battery backup']
      }
    ],
    frequency: '100 kHz'
  },
  sensors: {
    thermistor: {
      pin: 0,
      type: 'NTC 10kΩ',
      bCoeff: 3950,
      calibration: '-2.0°C offset',
      connection: 'Analog ADC GPIO0'
    },
    imu: {
      model: 'MPU9250',
      gyroScale: '±2000 dps',
      accelScale: '±2g',
      magScale: '±4800 µT',
      publishRate: '16ms (62.5Hz) active, 50ms idle'
    },
    battery: {
      capacity: '3200mAh',
      range: '3.2V - 4.09V',
      monitor: 'INA219 via I2C'
    }
  },
  mqtt: {
    broker: 'broker.emqx.io:1883',
    topics: {
      data: 'hardandsoft/esp32/data',
      gpio: 'hardandsoft/esp32/gpio_raw',
      cmd: 'hardandsoft/esp32/cmd',
      state: 'hardandsoft/esp32/state',
      log: 'hardandsoft/esp32/log'
    }
  }
};

const sensorIcon = (type: SensorDetail['type']): keyof typeof Ionicons.glyphMap =>
  type === 'digital' ? 'git-commit-outline' :
  type === 'i2c' ? 'git-branch-outline' :
  type === 'imu' ? 'cube-outline' :
  type === 'thermal' ? 'thermometer-outline' :
  type === 'analog' ? 'analytics-outline' :
  'battery-charging-outline';

// Compact SensorTile - tapping opens the detail modal
function SensorTile({ sensor, onPress, theme }: {
  sensor: SensorDetail;
  onPress: () => void;
  theme: AppTheme;
}) {
  const styles = useMemo(() => createStyles(theme), [theme]);

  return (
    <Pressable
      style={({ pressed }) => [styles.sensorTile, pressed && styles.sensorTilePressed]}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${sensor.label} – ${sensor.sensor ?? sensor.type}`}
    >
      <View style={styles.sensorTileRow}>
        <View style={styles.sensorTileIcon}>
          <Ionicons name={sensorIcon(sensor.type)} size={16} color={theme.colors.textSoft} />
        </View>
        <View style={styles.sensorTileMeta}>
          <Text style={styles.sensorTileLabel} numberOfLines={1}>{sensor.label}</Text>
          {sensor.sensor && (
            <Text style={styles.sensorTileType} numberOfLines={1}>{sensor.sensor}</Text>
          )}
        </View>
        {sensor.status === 'active' && <View style={styles.sensorTileActiveDot} />}
      </View>

      <View style={styles.sensorTileValueRow}>
        <Text style={styles.sensorTileValue}>{sensor.value}</Text>
        {sensor.type === 'digital' && (
          <Text style={[styles.digitalStateText, sensor.status === 'active' && styles.digitalStateTextHigh]}>
            {sensor.status === 'active' ? 'HIGH' : 'LOW'}
          </Text>
        )}
      </View>
    </Pressable>
  );
}

// Full-screen modal showing sensor detail
function SensorDetailModal({ sensor, visible, onClose, theme }: {
  sensor: SensorDetail | undefined;
  visible: boolean;
  onClose: () => void;
  theme: AppTheme;
}) {
  const styles = useMemo(() => createStyles(theme), [theme]);
  if (!sensor) return null;

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <View style={styles.modalContainer}>
        {/* Drag handle hint */}
        <View style={styles.modalHandle} />

        {/* Header */}
        <View style={styles.modalHeader}>
          <View style={styles.modalIconWrap}>
            <Ionicons name={sensorIcon(sensor.type)} size={22} color={theme.colors.text} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.modalTitle}>{sensor.label}</Text>
            {sensor.sensor && <Text style={styles.modalSubtitle}>{sensor.sensor}</Text>}
          </View>
          <Pressable
            onPress={onClose}
            style={({ pressed }) => [styles.modalCloseBtn, pressed && { opacity: 0.6 }]}
            hitSlop={12}
            accessibilityRole="button"
            accessibilityLabel="Close"
          >
            <Ionicons name="close" size={20} color={theme.colors.text} />
          </Pressable>
        </View>

        {/* Live value */}
        <View style={styles.modalValueCard}>
          <Text style={styles.modalValueLabel}>Current Value</Text>
          <View style={styles.modalValueRow}>
            <Text style={styles.modalValueText}>{sensor.value}</Text>
            {sensor.status && (
              <View style={styles.modalStatusRow}>
                <View style={[styles.statusDot, sensor.status === 'active' && styles.statusDotActive]} />
                <Text style={styles.modalStatusText}>{sensor.status === 'active' ? 'Active' : 'Idle'}</Text>
              </View>
            )}
          </View>
          <Text style={styles.modalTypeTag}>{sensor.type.toUpperCase()}</Text>
        </View>

        {/* Specs list */}
        {sensor.specs && sensor.specs.length > 0 && (
          <View style={styles.modalSpecsSection}>
            <Text style={styles.modalSpecsSectionTitle}>Hardware Specs</Text>
            {sensor.specs.map((spec, idx) => (
              <View key={idx} style={styles.modalSpecRow}>
                <View style={styles.modalSpecBullet} />
                <Text style={styles.modalSpecText}>{spec}</Text>
              </View>
            ))}
          </View>
        )}

        {/* Spacer + close */}
        <View style={{ flex: 1 }} />
        <Pressable
          onPress={onClose}
          style={({ pressed }) => [styles.modalDoneBtn, pressed && { opacity: 0.7 }]}
        >
          <Text style={styles.modalDoneBtnText}>Done</Text>
        </Pressable>
      </View>
    </Modal>
  );
}

export default function SensorsScreen() {
  const { theme } = useAppTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const { ioLog, status, data, selectedRange, setTimeRange } = useESP32();
  const [selectedPin, setSelectedPin] = useState<string | null>(null);

  const entries = ioLog.filter((entry) => entry.rawText || Object.keys(entry.gpio ?? {}).length > 0 || Object.keys(entry.pcf8591Raw ?? {}).length > 0 || Object.keys(entry.ina219Raw ?? {}).length > 0);
  const latest = [...entries].reverse().find((entry) => Object.keys(entry.gpio ?? {}).length > 0 || Object.keys(entry.pcf8591Raw ?? {}).length > 0 || Object.keys(entry.ina219Raw ?? {}).length > 0);

  const gpioPairs = Object.entries(latest?.gpio ?? {}).sort(([a], [b]) => a.localeCompare(b));
  const pcfPairs = Object.entries(latest?.pcf8591Raw ?? {}).sort(([a], [b]) => a.localeCompare(b));
  const inaPairs = Object.entries(latest?.ina219Raw ?? {}).sort(([a], [b]) => a.localeCompare(b));

  const sensorDetails = useMemo<SensorDetail[]>(() => {
    const details: SensorDetail[] = [];

    gpioPairs.forEach(([pin, value]) => {
      const pinNum = parseInt(pin.replace(/\D/g, ''));
      let sensorType = 'Digital I/O';
      let category: SensorDetail['category'] = 'gpio';
      let type: SensorDetail['type'] = 'digital';
      let specs: string[] = [];
      
      if (pinNum === ESP32_CONFIG.pins.I2C_SDA) {
        sensorType = 'I2C Data Line (SDA)';
        category = 'i2c-bus';
        type = 'i2c';
        specs = [
          `GPIO ${ESP32_CONFIG.pins.I2C_SDA}`, 
          ESP32_CONFIG.i2c.frequency, 
          `${ESP32_CONFIG.i2c.devices.length} devices connected`,
          'MPU9250, INA219, RTC'
        ];
      } else if (pinNum === ESP32_CONFIG.pins.I2C_SCL) {
        sensorType = 'I2C Clock Line (SCL)';
        category = 'i2c-bus';
        type = 'i2c';
        specs = [`GPIO ${ESP32_CONFIG.pins.I2C_SCL}`, ESP32_CONFIG.i2c.frequency, 'Serial clock signal'];
      } else if (pinNum === ESP32_CONFIG.pins.BTN_NEXT) {
        sensorType = 'Navigation Button';
        specs = [`GPIO ${ESP32_CONFIG.pins.BTN_NEXT}`, 'Next button', '200ms debounce'];
      } else if (pinNum === ESP32_CONFIG.pins.BTN_PREV) {
        sensorType = 'Navigation Button';
        specs = [`GPIO ${ESP32_CONFIG.pins.BTN_PREV}`, 'Previous button', '200ms debounce'];
      } else if (pinNum === ESP32_CONFIG.pins.INA_INT) {
        sensorType = 'INA219 Interrupt';
        category = 'power';
        specs = [`GPIO ${ESP32_CONFIG.pins.INA_INT}`, 'Power alert interrupt', 'Configurable thresholds'];
      } else if (pinNum === ESP32_CONFIG.pins.THERM_PIN) {
        sensorType = 'NTC Thermistor';
        type = 'thermal';
        category = 'analog';
        specs = [
          `GPIO ${ESP32_CONFIG.pins.THERM_PIN} (ADC)`, 
          ESP32_CONFIG.sensors.thermistor.type, 
          `β = ${ESP32_CONFIG.sensors.thermistor.bCoeff}`,
          ESP32_CONFIG.sensors.thermistor.calibration
        ];
      } else if (ESP32_CONFIG.pins.GPIO_PUBLISH.includes(pinNum)) {
        sensorType = 'Monitored GPIO';
        specs = [`GPIO ${pinNum}`, 'Published to MQTT'];
      }

      details.push({
        pin,
        label: pin.toUpperCase(),
        sensor: sensorType,
        value,
        type,
        status: value > 0 ? 'active' : 'idle',
        specs,
        category
      });
    });

    // PCF8591 is not present in this hardware configuration
    // Keeping code structure for potential future expansion
    if (pcfPairs.length > 0) {
      pcfPairs.forEach(([name, value]) => {
        details.push({
          pin: name,
          label: `ADC ${name.toUpperCase()}`,
          sensor: 'Analog Input',
          value,
          type: 'analog',
          status: 'active',
          category: 'i2c-device',
          specs: ['External ADC channel']
        });
      });
    }

    inaPairs.forEach(([name, value]) => {
      const isPower = name.toLowerCase().includes('power') || name.toLowerCase().includes('mw');
      const isCurrent = name.toLowerCase().includes('current') || name.toLowerCase().includes('ma');
      const isVoltage = name.toLowerCase().includes('voltage') || name.toLowerCase().includes('v');
      
      details.push({
        pin: name,
        label: `INA219 ${name.toUpperCase()}`,
        sensor: isPower ? 'Power Monitor' : isCurrent ? 'Current Monitor' : 'Voltage Monitor',
        value,
        type: 'power',
        status: 'active',
        category: 'power',
        specs: ['I2C Address: 0x40', ESP32_CONFIG.sensors.battery.range, 'High-side current sensing']
      });
    });

    return details;
  }, [gpioPairs, pcfPairs, inaPairs]);

  const handlePinPress = (pin: string) => {
    setSelectedPin(pin);
  };

  const selectedSensor = sensorDetails.find((s) => s.pin === selectedPin);
  const activeGpioCount = gpioPairs.filter(([, v]) => v > 0).length;

  // Group sensors by category
  const groupedSensors = useMemo(() => {
    const groups: {
      'i2c-bus': SensorDetail[];
      'i2c-device': SensorDetail[];
      'power': SensorDetail[];
      'analog': SensorDetail[];
      'gpio': SensorDetail[];
    } = {
      'i2c-bus': [],
      'i2c-device': [],
      'power': [],
      'analog': [],
      'gpio': []
    };

    sensorDetails.forEach(sensor => {
      const cat = sensor.category || 'gpio';
      if (cat in groups) {
        groups[cat as keyof typeof groups].push(sensor);
      }
    });

    return groups;
  }, [sensorDetails]);

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.content}>
        <ScreenShell
          contentStyle={styles.pageShell}
          screenTitle="Senzori / I/O"
          screenSubtitle="Monitorizare live GPIO si senzori"
          selectedRange={selectedRange}
          onRangeChange={setTimeRange}
        >

          {/* Quick stats bar */}
          <View style={styles.quickStats}>
            <View style={styles.quickStatItem}>
              <Text style={styles.quickStatValue}>{activeGpioCount}</Text>
              <Text style={styles.quickStatLabel}>GPIO Active</Text>
            </View>
            <View style={styles.quickStatDivider} />
            <View style={styles.quickStatItem}>
              <Text style={styles.quickStatValue}>{ESP32_CONFIG.i2c.devices.length}</Text>
              <Text style={styles.quickStatLabel}>I2C Devices</Text>
            </View>
            <View style={styles.quickStatDivider} />
            <View style={styles.quickStatItem}>
              <Text style={styles.quickStatValue}>{sensorDetails.length}</Text>
              <Text style={styles.quickStatLabel}>Monitored</Text>
            </View>
          </View>

          {/* I2C Devices - compact list */}
          <View style={styles.panel}>
            <Text style={styles.panelTitle}>I2C Bus</Text>
            <Text style={styles.panelCaption}>SDA {ESP32_CONFIG.pins.I2C_SDA} / SCL {ESP32_CONFIG.pins.I2C_SCL} · {ESP32_CONFIG.i2c.frequency}</Text>

            <View style={styles.i2cList}>
              {ESP32_CONFIG.i2c.devices.map((device, idx) => (
                <View key={idx} style={styles.i2cRow}>
                  <Ionicons
                    name={
                      device.type.includes('IMU') ? 'cube-outline' :
                      device.type.includes('Power') ? 'flash-outline' :
                      device.type.includes('RTC') ? 'time-outline' : 'hardware-chip-outline'
                    }
                    size={18}
                    color={theme.colors.textSoft}
                  />
                  <View style={styles.i2cRowText}>
                    <Text style={styles.i2cName}>{device.name}</Text>
                    <Text style={styles.i2cType}>{device.type}</Text>
                  </View>
                  <Text style={styles.i2cAddr}>{device.addr}</Text>
                </View>
              ))}
            </View>
          </View>

          {/* Live Sensor Grid — grouped by category */}
          <View style={styles.panel}>
            <Text style={styles.panelTitle}>Live Data</Text>

            {(['i2c-bus', 'i2c-device', 'power', 'analog', 'gpio'] as const).map((cat) => {
              const items = groupedSensors[cat];
              if (items.length === 0) return null;
              const label =
                cat === 'i2c-bus' ? 'I2C Bus' :
                cat === 'i2c-device' ? 'I2C Devices' :
                cat === 'power' ? 'Power' :
                cat === 'analog' ? 'Analog' : 'GPIO';
              return (
                <View key={cat}>
                  <Text style={styles.categoryLabel}>{label}</Text>
                  <View style={styles.sensorsGrid}>
                    {items.map((sensor) => (
                      <SensorTile
                        key={sensor.pin}
                        sensor={sensor}
                        onPress={() => handlePinPress(sensor.pin)}
                        theme={theme}
                      />
                    ))}
                  </View>
                </View>
              );
            })}

            {sensorDetails.length === 0 && (
              <View style={styles.emptyState}>
                <Ionicons name="radio-outline" size={28} color={theme.colors.textSoft} />
                <Text style={styles.emptyText}>Waiting for ESP32 data...</Text>
                <Text style={styles.emptySubtext}>Check MQTT at {ESP32_CONFIG.mqtt.broker}</Text>
              </View>
            )}
          </View>
        </ScreenShell>
      </ScrollView>

      {/* Sensor detail modal */}
      <SensorDetailModal
        sensor={selectedSensor}
        visible={!!selectedSensor}
        onClose={() => setSelectedPin(null)}
        theme={theme}
      />
    </SafeAreaView>
  );
}

const createStyles = (theme: AppTheme) => StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: theme.colors.background
  },
  content: {
    paddingHorizontal: 12,
    paddingTop: 12,
    paddingBottom: 112
  },
  pageShell: {
    paddingHorizontal: 0,
    paddingTop: 0,
    paddingBottom: 0
  },

  /* ── Quick stats bar ── */
  quickStats: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 16,
    paddingVertical: 12,
    paddingHorizontal: 16,
    backgroundColor: theme.colors.card,
    borderRadius: theme.radius.md,
    borderWidth: 1,
    borderColor: theme.colors.border,
    marginBottom: 12,
    ...theme.shadow.card
  },
  quickStatItem: {
    alignItems: 'center',
    gap: 3
  },
  quickStatValue: {
    fontFamily: theme.font.mono,
    fontSize: 22,
    color: theme.colors.text
  },
  quickStatLabel: {
    fontFamily: theme.font.medium,
    fontSize: 11,
    color: theme.colors.textSoft
  },
  quickStatDivider: {
    width: 1,
    height: 28,
    backgroundColor: theme.colors.border
  },

  /* ── Panel ── */
  panel: {
    backgroundColor: theme.colors.card,
    borderRadius: theme.radius.lg,
    borderWidth: 1,
    borderColor: theme.colors.border,
    paddingHorizontal: 14,
    paddingVertical: 14,
    marginBottom: 12,
    ...theme.shadow.card
  },
  panelTitle: {
    fontFamily: theme.font.bold,
    fontSize: 16,
    color: theme.colors.text,
    marginBottom: 2
  },
  panelCaption: {
    fontFamily: theme.font.medium,
    fontSize: 12,
    color: theme.colors.textSoft,
    marginBottom: 12
  },

  /* ── I2C compact list ── */
  i2cList: {
    gap: 0
  },
  i2cRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 11,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: theme.colors.border
  },
  i2cRowText: {
    flex: 1,
    gap: 1
  },
  i2cName: {
    fontFamily: theme.font.semiBold,
    fontSize: 14,
    color: theme.colors.text
  },
  i2cType: {
    fontFamily: theme.font.medium,
    fontSize: 11,
    color: theme.colors.textSoft
  },
  i2cAddr: {
    fontFamily: theme.font.mono,
    fontSize: 11,
    color: theme.colors.textSoft
  },

  /* ── Category label ── */
  categoryLabel: {
    fontFamily: theme.font.semiBold,
    fontSize: 12,
    color: theme.colors.textSoft,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    marginTop: 16,
    marginBottom: 8
  },

  /* ── Sensor grid ── */
  sensorsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10
  },
  sensorTile: {
    flex: 1,
    minWidth: 155,
    backgroundColor: theme.colors.surfaceMuted,
    borderRadius: theme.radius.md,
    borderWidth: 1,
    borderColor: theme.colors.border,
    padding: 12,
    gap: 8
  },
  sensorTilePressed: {
    opacity: 0.65
  },
  sensorTileRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10
  },
  sensorTileIcon: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: theme.colors.card,
    borderWidth: 1,
    borderColor: theme.colors.border,
    justifyContent: 'center',
    alignItems: 'center'
  },
  sensorTileMeta: {
    flex: 1,
    gap: 1
  },
  sensorTileLabel: {
    fontFamily: theme.font.semiBold,
    fontSize: 13,
    color: theme.colors.text,
    textTransform: 'uppercase'
  },
  sensorTileType: {
    fontFamily: theme.font.medium,
    fontSize: 11,
    color: theme.colors.textSoft
  },
  sensorTileActiveDot: {
    width: 7,
    height: 7,
    borderRadius: 999,
    backgroundColor: theme.colors.success
  },
  sensorTileValueRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between'
  },
  sensorTileValue: {
    fontFamily: theme.font.mono,
    fontSize: 20,
    color: theme.colors.text
  },
  digitalStateText: {
    fontFamily: theme.font.semiBold,
    fontSize: 10,
    color: theme.colors.textSoft
  },
  digitalStateTextHigh: {
    color: theme.colors.success
  },

  /* ── Empty state ── */
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 40,
    gap: 8
  },
  emptyText: {
    fontFamily: theme.font.medium,
    fontSize: 14,
    color: theme.colors.textSoft
  },
  emptySubtext: {
    fontFamily: theme.font.medium,
    fontSize: 12,
    color: theme.colors.textSoft
  },

  /* ── Modal ── */
  modalContainer: {
    flex: 1,
    backgroundColor: theme.colors.background,
    paddingHorizontal: 20,
    paddingTop: 14,
    paddingBottom: 32
  },
  modalHandle: {
    alignSelf: 'center',
    width: 36,
    height: 5,
    borderRadius: 3,
    backgroundColor: theme.colors.border,
    marginBottom: 20
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    marginBottom: 24
  },
  modalIconWrap: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: theme.colors.card,
    borderWidth: 1,
    borderColor: theme.colors.border,
    justifyContent: 'center',
    alignItems: 'center'
  },
  modalTitle: {
    fontFamily: theme.font.bold,
    fontSize: 20,
    color: theme.colors.text
  },
  modalSubtitle: {
    fontFamily: theme.font.medium,
    fontSize: 13,
    color: theme.colors.textSoft,
    marginTop: 2
  },
  modalCloseBtn: {
    width: 36,
    height: 36,
    borderRadius: 999,
    backgroundColor: theme.colors.card,
    borderWidth: 1,
    borderColor: theme.colors.border,
    justifyContent: 'center',
    alignItems: 'center'
  },

  /* ── Modal value card ── */
  modalValueCard: {
    backgroundColor: theme.colors.card,
    borderRadius: theme.radius.lg,
    borderWidth: 1,
    borderColor: theme.colors.border,
    padding: 18,
    marginBottom: 16
  },
  modalValueLabel: {
    fontFamily: theme.font.medium,
    fontSize: 12,
    color: theme.colors.textSoft,
    marginBottom: 6
  },
  modalValueRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between'
  },
  modalValueText: {
    fontFamily: theme.font.mono,
    fontSize: 32,
    color: theme.colors.text
  },
  modalStatusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 999,
    backgroundColor: theme.colors.border
  },
  statusDotActive: {
    backgroundColor: theme.colors.success
  },
  modalStatusText: {
    fontFamily: theme.font.medium,
    fontSize: 13,
    color: theme.colors.textSoft
  },
  modalTypeTag: {
    fontFamily: theme.font.mono,
    fontSize: 11,
    color: theme.colors.textSoft,
    marginTop: 8
  },

  /* ── Modal specs ── */
  modalSpecsSection: {
    backgroundColor: theme.colors.card,
    borderRadius: theme.radius.lg,
    borderWidth: 1,
    borderColor: theme.colors.border,
    padding: 16
  },
  modalSpecsSectionTitle: {
    fontFamily: theme.font.semiBold,
    fontSize: 14,
    color: theme.colors.text,
    marginBottom: 12
  },
  modalSpecRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    paddingVertical: 5
  },
  modalSpecBullet: {
    width: 5,
    height: 5,
    borderRadius: 999,
    backgroundColor: theme.colors.textSoft,
    marginTop: 6
  },
  modalSpecText: {
    flex: 1,
    fontFamily: theme.font.medium,
    fontSize: 13,
    color: theme.colors.text,
    lineHeight: 18
  },

  /* ── Modal done button ── */
  modalDoneBtn: {
    paddingVertical: 14,
    backgroundColor: theme.colors.card,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.radius.md,
    alignItems: 'center'
  },
  modalDoneBtnText: {
    fontFamily: theme.font.semiBold,
    fontSize: 15,
    color: theme.colors.text
  }
});
