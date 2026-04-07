import { useMemo, useRef, useState } from 'react';
import { ScrollView, StyleSheet, Text, View, Pressable, Modal, useWindowDimensions } from 'react-native';
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

// ─── ESP32-C3 Super Mini Pinout (matches physical board layout) ─────────────

type PinCategory = 'i2c' | 'button' | 'adc' | 'interrupt' | 'gpio' | 'power' | 'spi';

const PIN_COLORS: Record<PinCategory, string> = {
  power:     '#5E5CE6',
  i2c:       '#4A9EFF',
  spi:       '#BF5AF2',
  button:    '#FF9F0A',
  adc:       '#30D158',
  interrupt: '#FF453A',
  gpio:      '#8E8E93',
};

type PinDef = {
  gpio: string;     // e.g. "GPIO5"
  alt: string;      // e.g. "A3" or "D3"
  fn: string;       // e.g. "SDA" or user-assigned function
  category: PinCategory;
};

// Left side — top (USB) to bottom — as seen on the reference image
const LEFT_PINS: PinDef[] = [
  { gpio: 'GPIO5',  alt: 'A3 / D3',   fn: 'GPIO 5',    category: 'gpio'   },
  { gpio: 'GPIO6',  alt: 'SDA / D4',   fn: 'GPIO 6',    category: 'gpio'   },
  { gpio: 'GPIO7',  alt: 'SCL / D5',   fn: 'GPIO 7',    category: 'gpio'   },
  { gpio: 'GPIO8',  alt: 'SCK / D8',   fn: 'I2C SDA',   category: 'i2c'    },
  { gpio: 'GPIO9',  alt: 'MISO / D9',  fn: 'I2C SCL',   category: 'i2c'    },
  { gpio: 'GPIO10', alt: 'MOSI / D10', fn: 'INA INT',    category: 'interrupt' },
  { gpio: 'GPIO20', alt: 'RX / D7',    fn: 'GPIO 20',   category: 'gpio'   },
  { gpio: 'GPIO21', alt: 'TX / D6',    fn: 'GPIO 21',   category: 'gpio'   },
];

// Right side — top (USB) to bottom
const RIGHT_PINS: PinDef[] = [
  { gpio: '5V',     alt: '',           fn: 'VIN',        category: 'power'  },
  { gpio: 'GND',    alt: '',           fn: 'Ground',     category: 'power'  },
  { gpio: '3V3',    alt: '',           fn: '3.3V Out',   category: 'power'  },
  { gpio: 'GPIO4',  alt: 'A2 / D2',   fn: 'BTN Prev',   category: 'button' },
  { gpio: 'GPIO3',  alt: 'A1 / D1',   fn: 'BTN Next',   category: 'button' },
  { gpio: 'GPIO2',  alt: 'A0 / D0',   fn: 'GPIO 2',     category: 'gpio'   },
  { gpio: 'GPIO1',  alt: 'ADC1-1',    fn: 'GPIO 1',     category: 'gpio'   },
  { gpio: 'GPIO0',  alt: 'ADC1-0',    fn: 'Thermistor', category: 'adc'    },
];

const LEGEND: { cat: PinCategory; label: string }[] = [
  { cat: 'power',     label: 'Power'      },
  { cat: 'i2c',       label: 'I2C Bus'    },
  { cat: 'button',    label: 'Button'     },
  { cat: 'adc',       label: 'Thermistor' },
  { cat: 'interrupt', label: 'INA Alert'  },
  { cat: 'gpio',      label: 'GPIO'       },
];

function PinConnector({ color, pointRight }: { color: string; pointRight: boolean }) {
  // A dashed line with a small triangular arrowhead pointing toward the chip
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
      {pointRight && (
        <View style={{
          width: 0, height: 0,
          borderTopWidth: 4, borderBottomWidth: 4, borderLeftWidth: 5,
          borderTopColor: 'transparent', borderBottomColor: 'transparent',
          borderLeftColor: color,
          marginRight: 1,
        }} />
      )}
      <View style={{
        width: 16,
        height: 1,
        borderStyle: 'dashed',
        borderTopWidth: 1,
        borderColor: color,
      }} />
      {!pointRight && (
        <View style={{
          width: 0, height: 0,
          borderTopWidth: 4, borderBottomWidth: 4, borderRightWidth: 5,
          borderTopColor: 'transparent', borderBottomColor: 'transparent',
          borderRightColor: color,
          marginLeft: 1,
        }} />
      )}
    </View>
  );
}

function PinLabel({ pin, side, styles }: {
  pin: PinDef;
  side: 'left' | 'right';
  styles: ReturnType<typeof createStyles>;
}) {
  const c = PIN_COLORS[pin.category];
  const isLeft = side === 'left';

  // Left reads outward:  fn → alt →──▶ [badge] → chip
  // Right reads outward: chip → [badge] ▶──→ alt → fn
  if (isLeft) {
    return (
      <View style={[styles.pinLabelRow, styles.pinLabelRowLeft]}>
        <Text style={[styles.pinFnText, { textAlign: 'right' }]} numberOfLines={1}>{pin.fn}</Text>
        {pin.alt ? (
          <Text style={[styles.pinAltText, { textAlign: 'right' }]} numberOfLines={1}>{pin.alt}</Text>
        ) : (
          <View style={styles.pinAltSpacer} />
        )}
        <PinConnector color={c + 'AA'} pointRight={false} />
        <View style={[styles.pinBadge, { backgroundColor: c + '20', borderColor: c + '55' }]}>
          <Text style={[styles.pinBadgeText, { color: c }]}>{pin.gpio}</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.pinLabelRow, styles.pinLabelRowRight]}>
      <View style={[styles.pinBadge, { backgroundColor: c + '20', borderColor: c + '55' }]}>
        <Text style={[styles.pinBadgeText, { color: c }]}>{pin.gpio}</Text>
      </View>
      <PinConnector color={c + 'AA'} pointRight={true} />
      {pin.alt ? (
        <Text style={[styles.pinAltText, { textAlign: 'left' }]} numberOfLines={1}>{pin.alt}</Text>
      ) : (
        <View style={styles.pinAltSpacer} />
      )}
      <Text style={[styles.pinFnText, { textAlign: 'left' }]} numberOfLines={1}>{pin.fn}</Text>
    </View>
  );
}

function PinoutCard({ theme }: { theme: AppTheme }) {
  const styles = useMemo(() => createStyles(theme), [theme]);

  return (
    <View style={styles.pinoutCard}>
      {/* Header */}
      <View style={styles.pinoutHeaderRow}>
        <View style={styles.pinoutTitleWrap}>
          <Ionicons name="hardware-chip-outline" size={18} color={theme.colors.primary} />
          <Text style={styles.pinoutTitle}>ESP32-C3 Super Mini</Text>
        </View>
        <Text style={styles.pinoutSubtitle}>RISC-V · 160 MHz · Wi-Fi / BLE</Text>
      </View>

      {/* Board diagram */}
      <View style={styles.boardContainer}>
        {/* Left column */}
        <View style={styles.boardSide}>
          {LEFT_PINS.map((p) => (
            <PinLabel key={p.gpio} pin={p} side="left" styles={styles} />
          ))}
        </View>

        {/* Central chip representation */}
        <View style={styles.boardChip}>
          {/* USB-C hint */}
          <View style={styles.usbStub}>
            <Text style={styles.usbText}>USB-C</Text>
          </View>
          {/* Pin dots — left */}
          <View style={styles.chipPinCol}>
            {LEFT_PINS.map((p, i) => (
              <View key={i} style={[styles.chipPinDot, { backgroundColor: PIN_COLORS[p.category] }]} />
            ))}
          </View>
          {/* Chip label */}
          <View style={styles.chipCenter}>
            <Text style={styles.chipMainLabel}>ESP32</Text>
            <Text style={styles.chipSubLabel}>C3</Text>
          </View>
          {/* Pin dots — right */}
          <View style={styles.chipPinCol}>
            {RIGHT_PINS.map((p, i) => (
              <View key={i} style={[styles.chipPinDot, { backgroundColor: PIN_COLORS[p.category] }]} />
            ))}
          </View>
        </View>

        {/* Right column */}
        <View style={styles.boardSide}>
          {RIGHT_PINS.map((p) => (
            <PinLabel key={p.gpio} pin={p} side="right" styles={styles} />
          ))}
        </View>
      </View>

      {/* Legend */}
      <View style={styles.pinoutLegend}>
        {LEGEND.map(({ cat, label }) => (
          <View key={cat} style={styles.legendItem}>
            <View style={[styles.legendDot, { backgroundColor: PIN_COLORS[cat] }]} />
            <Text style={styles.legendLabel}>{label}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

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
      onPressIn={onPress}
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
  const { ioLog, status, data, selectedRange, setTimeRange, mqttStatus } = useESP32();
  const [selectedPin, setSelectedPin] = useState<string | null>(null);
  const [serialOpen, setSerialOpen] = useState(false);
  const serialScrollRef = useRef<ScrollView>(null);

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
          mqttStatus={mqttStatus}
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

          {/* Serial monitor button */}
          <Pressable
            style={({ pressed }) => [styles.serialBtn, pressed && styles.serialBtnPressed]}
            onPressIn={() => setSerialOpen(true)}
          >
            <Ionicons name="terminal-outline" size={16} color={theme.colors.textSoft} />
            <Text style={styles.serialBtnText}>Serial Monitor</Text>
            <View style={styles.serialBtnBadge}>
              <Text style={styles.serialBtnBadgeText}>{entries.length}</Text>
            </View>
            <Ionicons name="chevron-forward" size={14} color={theme.colors.muted} style={{ marginLeft: 'auto' }} />
          </Pressable>

          <PinoutCard theme={theme} />

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

      {/* Serial monitor modal */}
      <Modal
        visible={serialOpen}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setSerialOpen(false)}
      >
        <SafeAreaView style={styles.serialContainer}>
          <View style={styles.serialHeader}>
            <View style={styles.serialHeaderLeft}>
              <View style={styles.serialIconWrap}>
                <Ionicons name="terminal-outline" size={20} color={theme.colors.primary} />
              </View>
              <View>
                <Text style={styles.serialTitle}>Serial Monitor</Text>
                <Text style={styles.serialSubtitle}>{entries.length} packets captured</Text>
              </View>
            </View>
            <Pressable
              style={styles.serialCloseBtn}
              onPressIn={() => setSerialOpen(false)}
              hitSlop={12}
            >
              <Ionicons name="close" size={20} color={theme.colors.textSoft} />
            </Pressable>
          </View>

          <ScrollView
            ref={serialScrollRef}
            style={styles.serialScroll}
            contentContainerStyle={styles.serialScrollContent}
            showsVerticalScrollIndicator={false}
          >
            {[...entries].reverse().map((entry, idx) => (
              <View key={idx} style={[styles.serialRow, idx === 0 && styles.serialRowFirst]}>
                <Text style={styles.serialTs}>{entry.ts}</Text>
                <Text style={styles.serialRaw} selectable>
                  {entry.rawText ?? JSON.stringify({ gpio: entry.gpio, temp: entry.temp, light: entry.light })}
                </Text>
              </View>
            ))}
            {entries.length === 0 && (
              <View style={styles.serialEmpty}>
                <Ionicons name="radio-outline" size={32} color={theme.colors.muted} />
                <Text style={styles.serialEmptyText}>No packets yet</Text>
              </View>
            )}
          </ScrollView>
        </SafeAreaView>
      </Modal>

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
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 120
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
    gap: 20,
    paddingVertical: 14,
    paddingHorizontal: 20,
    backgroundColor: theme.colors.card,
    borderRadius: theme.radius.md,
    borderWidth: 1,
    borderColor: theme.colors.border,
    marginBottom: 14,
    ...theme.shadow.card
  },
  quickStatItem: {
    alignItems: 'center',
    gap: 4
  },
  quickStatValue: {
    fontFamily: theme.font.mono,
    fontSize: 24,
    color: theme.colors.text
  },
  quickStatLabel: {
    fontFamily: theme.font.medium,
    fontSize: 13,
    color: theme.colors.textSoft
  },
  quickStatDivider: {
    width: 1,
    height: 32,
    backgroundColor: theme.colors.border
  },

  /* ── Panel ── */
  panel: {
    backgroundColor: theme.colors.card,
    borderRadius: theme.radius.lg,
    borderWidth: 1,
    borderColor: theme.colors.border,
    paddingHorizontal: 16,
    paddingVertical: 16,
    marginBottom: 14,
    ...theme.shadow.card
  },
  panelTitle: {
    fontFamily: theme.font.bold,
    fontSize: 18,
    color: theme.colors.text,
    marginBottom: 3
  },
  panelCaption: {
    fontFamily: theme.font.medium,
    fontSize: 13,
    color: theme.colors.textSoft,
    marginBottom: 14
  },

  /* ── I2C compact list ── */
  i2cList: {
    gap: 0
  },
  i2cRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: theme.colors.border
  },
  i2cRowText: {
    flex: 1,
    gap: 2
  },
  i2cName: {
    fontFamily: theme.font.semiBold,
    fontSize: 15,
    color: theme.colors.text
  },
  i2cType: {
    fontFamily: theme.font.medium,
    fontSize: 13,
    color: theme.colors.textSoft
  },
  i2cAddr: {
    fontFamily: theme.font.mono,
    fontSize: 13,
    color: theme.colors.textSoft
  },

  /* ── Category label ── */
  categoryLabel: {
    fontFamily: theme.font.semiBold,
    fontSize: 13,
    color: theme.colors.textSoft,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginTop: 18,
    marginBottom: 10
  },

  /* ── Sensor grid ── */
  sensorsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12
  },
  sensorTile: {
    flex: 1,
    minWidth: 170,
    backgroundColor: theme.colors.surfaceMuted,
    borderRadius: theme.radius.md,
    borderWidth: 1,
    borderColor: theme.colors.border,
    padding: 14,
    gap: 10
  },
  sensorTilePressed: {
    opacity: 0.65
  },
  sensorTileRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12
  },
  sensorTileIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: theme.colors.card,
    borderWidth: 1,
    borderColor: theme.colors.border,
    justifyContent: 'center',
    alignItems: 'center'
  },
  sensorTileMeta: {
    flex: 1,
    gap: 2
  },
  sensorTileLabel: {
    fontFamily: theme.font.semiBold,
    fontSize: 15,
    color: theme.colors.text,
    textTransform: 'uppercase'
  },
  sensorTileType: {
    fontFamily: theme.font.medium,
    fontSize: 13,
    color: theme.colors.textSoft
  },
  sensorTileActiveDot: {
    width: 8,
    height: 8,
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
    fontSize: 22,
    color: theme.colors.text
  },
  digitalStateText: {
    fontFamily: theme.font.semiBold,
    fontSize: 12,
    color: theme.colors.textSoft
  },
  digitalStateTextHigh: {
    color: theme.colors.success
  },

  /* ── ESP32 Pinout Card ── */
  pinoutCard: {
    backgroundColor: theme.colors.card,
    borderRadius: theme.radius.lg,
    borderWidth: 1,
    borderColor: theme.colors.border,
    paddingHorizontal: 16,
    paddingVertical: 16,
    marginBottom: 14,
    ...theme.shadow.card
  },
  pinoutHeaderRow: {
    marginBottom: 16,
  },
  pinoutTitleWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 3,
  },
  pinoutTitle: {
    fontFamily: theme.font.bold,
    fontSize: 18,
    color: theme.colors.text,
  },
  pinoutSubtitle: {
    fontFamily: theme.font.medium,
    fontSize: 13,
    color: theme.colors.textSoft,
  },

  /* Board layout */
  boardContainer: {
    flexDirection: 'row',
    alignItems: 'stretch',
    marginBottom: 16,
  },
  boardSide: {
    flex: 1,
    justifyContent: 'space-between',
  },

  /* Pin label rows */
  pinLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    height: 34,
  },
  pinLabelRowLeft: {
    justifyContent: 'flex-end',
  },
  pinLabelRowRight: {
    justifyContent: 'flex-start',
  },
  pinBadge: {
    borderWidth: 1,
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 3,
    minWidth: 58,
    alignItems: 'center',
  },
  pinBadgeText: {
    fontFamily: theme.font.mono,
    fontSize: 12,
    fontWeight: '700',
  },
  pinAltText: {
    fontFamily: theme.font.mono,
    fontSize: 10,
    color: theme.colors.muted,
    minWidth: 56,
  },
  pinAltSpacer: {
    minWidth: 56,
  },
  pinFnText: {
    fontFamily: theme.font.semiBold,
    fontSize: 13,
    color: theme.colors.text,
    flex: 1,
  },

  /* Central chip */
  boardChip: {
    width: 64,
    backgroundColor: theme.colors.surfaceMuted,
    borderWidth: 1.5,
    borderColor: theme.colors.border,
    borderRadius: 10,
    flexDirection: 'row',
    alignItems: 'stretch',
    overflow: 'hidden',
    marginHorizontal: 6,
  },
  usbStub: {
    position: 'absolute',
    top: -1,
    left: '50%',
    marginLeft: -18,
    width: 36,
    height: 14,
    backgroundColor: theme.colors.border,
    borderBottomLeftRadius: 4,
    borderBottomRightRadius: 4,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1,
  },
  usbText: {
    fontFamily: theme.font.mono,
    fontSize: 6,
    color: theme.colors.textSoft,
    letterSpacing: 0.5,
  },
  chipPinCol: {
    width: 12,
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 20,
  },
  chipPinDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  chipCenter: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chipMainLabel: {
    fontFamily: theme.font.bold,
    fontSize: 10,
    color: theme.colors.textSoft,
  },
  chipSubLabel: {
    fontFamily: theme.font.mono,
    fontSize: 9,
    color: theme.colors.muted,
  },

  /* Legend */
  pinoutLegend: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    paddingTop: 10,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: theme.colors.border,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  legendDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  legendLabel: {
    fontFamily: theme.font.medium,
    fontSize: 13,
    color: theme.colors.textSoft,
  },

  /* ── Empty state ── */
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 48,
    gap: 10
  },
  emptyText: {
    fontFamily: theme.font.medium,
    fontSize: 16,
    color: theme.colors.textSoft
  },
  emptySubtext: {
    fontFamily: theme.font.medium,
    fontSize: 13,
    color: theme.colors.textSoft
  },

  /* ── Modal ── */
  modalContainer: {
    flex: 1,
    backgroundColor: theme.colors.background,
    paddingHorizontal: 24,
    paddingTop: 16,
    paddingBottom: 36
  },
  modalHandle: {
    alignSelf: 'center',
    width: 40,
    height: 5,
    borderRadius: 3,
    backgroundColor: theme.colors.border,
    marginBottom: 22
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    marginBottom: 28
  },
  modalIconWrap: {
    width: 48,
    height: 48,
    borderRadius: 14,
    backgroundColor: theme.colors.card,
    borderWidth: 1,
    borderColor: theme.colors.border,
    justifyContent: 'center',
    alignItems: 'center'
  },
  modalTitle: {
    fontFamily: theme.font.bold,
    fontSize: 22,
    color: theme.colors.text
  },
  modalSubtitle: {
    fontFamily: theme.font.medium,
    fontSize: 14,
    color: theme.colors.textSoft,
    marginTop: 3
  },
  modalCloseBtn: {
    width: 40,
    height: 40,
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
    padding: 20,
    marginBottom: 18
  },
  modalValueLabel: {
    fontFamily: theme.font.medium,
    fontSize: 13,
    color: theme.colors.textSoft,
    marginBottom: 8
  },
  modalValueRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between'
  },
  modalValueText: {
    fontFamily: theme.font.mono,
    fontSize: 36,
    color: theme.colors.text
  },
  modalStatusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8
  },
  statusDot: {
    width: 10,
    height: 10,
    borderRadius: 999,
    backgroundColor: theme.colors.border
  },
  statusDotActive: {
    backgroundColor: theme.colors.success
  },
  modalStatusText: {
    fontFamily: theme.font.medium,
    fontSize: 14,
    color: theme.colors.textSoft
  },
  modalTypeTag: {
    fontFamily: theme.font.mono,
    fontSize: 12,
    color: theme.colors.textSoft,
    marginTop: 10
  },

  /* ── Modal specs ── */
  modalSpecsSection: {
    backgroundColor: theme.colors.card,
    borderRadius: theme.radius.lg,
    borderWidth: 1,
    borderColor: theme.colors.border,
    padding: 18
  },
  modalSpecsSectionTitle: {
    fontFamily: theme.font.semiBold,
    fontSize: 16,
    color: theme.colors.text,
    marginBottom: 14
  },
  modalSpecRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    paddingVertical: 6
  },
  modalSpecBullet: {
    width: 6,
    height: 6,
    borderRadius: 999,
    backgroundColor: theme.colors.textSoft,
    marginTop: 7
  },
  modalSpecText: {
    flex: 1,
    fontFamily: theme.font.medium,
    fontSize: 14,
    color: theme.colors.text,
    lineHeight: 20
  },

  /* ── Modal done button ── */
  modalDoneBtn: {
    paddingVertical: 16,
    backgroundColor: theme.colors.card,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.radius.md,
    alignItems: 'center'
  },
  modalDoneBtnText: {
    fontFamily: theme.font.semiBold,
    fontSize: 16,
    color: theme.colors.text
  },

  /* ── Serial monitor button ── */
  serialBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: theme.colors.card,
    borderRadius: theme.radius.md,
    borderWidth: 1,
    borderColor: theme.colors.border,
    paddingHorizontal: 16,
    paddingVertical: 12,
    marginBottom: 14,
    ...theme.shadow.card
  },
  serialBtnPressed: {
    opacity: 0.6
  },
  serialBtnText: {
    fontFamily: theme.font.semiBold,
    fontSize: 14,
    color: theme.colors.textSoft
  },
  serialBtnBadge: {
    backgroundColor: theme.colors.surfaceMuted,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: theme.colors.border,
    paddingHorizontal: 8,
    paddingVertical: 2
  },
  serialBtnBadgeText: {
    fontFamily: theme.font.mono,
    fontSize: 12,
    color: theme.colors.textSoft
  },

  /* ── Serial monitor modal ── */
  serialContainer: {
    flex: 1,
    backgroundColor: '#0d1117'
  },
  serialHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#30363d'
  },
  serialHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12
  },
  serialIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: '#161b22',
    borderWidth: 1,
    borderColor: '#30363d',
    justifyContent: 'center',
    alignItems: 'center'
  },
  serialTitle: {
    fontFamily: theme.font.bold,
    fontSize: 17,
    color: '#e6edf3'
  },
  serialSubtitle: {
    fontFamily: theme.font.medium,
    fontSize: 12,
    color: '#8b949e',
    marginTop: 1
  },
  serialCloseBtn: {
    width: 36,
    height: 36,
    borderRadius: 999,
    backgroundColor: '#161b22',
    borderWidth: 1,
    borderColor: '#30363d',
    justifyContent: 'center',
    alignItems: 'center'
  },
  serialScroll: {
    flex: 1
  },
  serialScrollContent: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 2
  },
  serialRow: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 6,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#21262d'
  },
  serialRowFirst: {
    backgroundColor: '#161b22'
  },
  serialTs: {
    fontFamily: theme.font.mono,
    fontSize: 11,
    color: '#8b949e',
    marginBottom: 4
  },
  serialRaw: {
    fontFamily: theme.font.mono,
    fontSize: 13,
    color: '#7ee787',
    lineHeight: 20
  },
  serialEmpty: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
    gap: 12
  },
  serialEmptyText: {
    fontFamily: theme.font.medium,
    fontSize: 15,
    color: '#8b949e'
  }
});
