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
  { cat: 'power',     label: 'Putere'      },
  { cat: 'i2c',       label: 'Bus I2C'    },
  { cat: 'button',    label: 'Buton'     },
  { cat: 'adc',       label: 'Termistor' },
  { cat: 'interrupt', label: 'Alertă INA'  },
  { cat: 'gpio',      label: 'GPIO'       },
];

function PinLabel({ pin, side, styles, onPress, isSelected, isOffline }: {
  pin: PinDef;
  side: 'left' | 'right';
  styles: ReturnType<typeof createStyles>;
  onPress?: () => void;
  isSelected?: boolean;
  isOffline?: boolean;
}) {
  const c = isOffline ? PIN_COLORS.gpio + '40' : PIN_COLORS[pin.category];

  if (side === 'left') {
    return (
      <Pressable
        onPress={onPress}
        style={({ pressed }) => [
          styles.pinLabelRow,
          styles.pinLabelRowLeft,
          pressed && { opacity: 0.6 },
          isSelected && styles.pinLabelSelected,
          isOffline && styles.pinLabelOffline,
        ]}
        accessibilityRole="button"
        accessibilityLabel={`${pin.gpio} – ${pin.fn}${isOffline ? ' (offline)' : ''}`}
      >
        <Text style={styles.pinFnText} numberOfLines={1}>{pin.fn}</Text>
        <View style={[styles.pinConnectorLine, { backgroundColor: c + '50' }]} />
        <View style={[styles.pinBadge, { backgroundColor: c + '18', borderColor: c + '60' }]}>
          <View style={[styles.pinColorDot, { backgroundColor: c }]} />
          <Text style={[styles.pinBadgeText, { color: c }]} numberOfLines={1}>{pin.gpio}</Text>
        </View>
      </Pressable>
    );
  }

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.pinLabelRow,
        styles.pinLabelRowRight,
        pressed && { opacity: 0.6 },
        isSelected && styles.pinLabelSelected,
        isOffline && styles.pinLabelOffline,
      ]}
      accessibilityRole="button"
      accessibilityLabel={`${pin.gpio} – ${pin.fn}${isOffline ? ' (offline)' : ''}`}
    >
      <View style={[styles.pinBadge, { backgroundColor: c + '18', borderColor: c + '60' }]}>
        <View style={[styles.pinColorDot, { backgroundColor: c }]} />
        <Text style={[styles.pinBadgeText, { color: c }]} numberOfLines={1}>{pin.gpio}</Text>
      </View>
      <View style={[styles.pinConnectorLine, { backgroundColor: c + '50' }]} />
      <Text style={styles.pinFnText} numberOfLines={1}>{pin.fn}</Text>
    </Pressable>
  );
}



// Compact SensorTile - tapping opens the detail modal
function SensorTile({ sensor, onPress, theme }: {
  sensor: SensorDetail;
  onPress: () => void;
  theme: AppTheme;
}) {
  const { width } = useWindowDimensions();
  const styles = useMemo(() => createStyles(theme, width), [theme, width]);
  
  // Map sensor category to pin category colors
  const getCategoryColor = (cat?: SensorDetail['category']): string => {
    if (!cat) return PIN_COLORS.gpio;
    switch (cat) {
      case 'i2c-bus': return PIN_COLORS.i2c;
      case 'i2c-device': return PIN_COLORS.i2c;
      case 'analog': return PIN_COLORS.adc;
      case 'power': return PIN_COLORS.power;
      case 'gpio': return PIN_COLORS.gpio;
      default: return PIN_COLORS.gpio;
    }
  };

  const categoryColor = getCategoryColor(sensor.category);

  return (
    <Pressable
      style={({ pressed }) => [styles.sensorTile, pressed && styles.sensorTilePressed]}
      onPressIn={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${sensor.label} – ${sensor.sensor ?? sensor.type}`}
    >
      <View style={styles.sensorTileRow}>
        <View style={[styles.sensorTileIcon, { 
          backgroundColor: categoryColor + '15',
          borderColor: categoryColor + '30'
        }]}>
          <Ionicons name={sensorIcon(sensor.type)} size={18} color={categoryColor} />
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
  const { width } = useWindowDimensions();
  const styles = useMemo(() => createStyles(theme, width), [theme, width]);
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
          <Text style={styles.modalValueLabel}>Valoare Curentă</Text>
          <View style={styles.modalValueRow}>
            <Text style={styles.modalValueText}>{sensor.value}</Text>
            {sensor.status && (
              <View style={styles.modalStatusRow}>
                <View style={[styles.statusDot, sensor.status === 'active' && styles.statusDotActive]} />
                <Text style={styles.modalStatusText}>{sensor.status === 'active' ? 'Activ' : 'Inactiv'}</Text>
              </View>
            )}
          </View>
          <Text style={styles.modalTypeTag}>{sensor.type.toUpperCase()}</Text>
        </View>

        {/* Specs list */}
        {sensor.specs && sensor.specs.length > 0 && (
          <View style={styles.modalSpecsSection}>
            <Text style={styles.modalSpecsSectionTitle}>Specificații Hardware</Text>
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
          <Text style={styles.modalDoneBtnText}>Gata</Text>
        </Pressable>
      </View>
    </Modal>
  );
}

// Pin detail modal — shows when tapping a pin on the board
function PinDetailModal({ pin, visible, onClose, liveValue, theme }: {
  pin: PinDef | null;
  visible: boolean;
  onClose: () => void;
  liveValue?: string | number;
  theme: AppTheme;
}) {
  const { width } = useWindowDimensions();
  const styles = useMemo(() => createStyles(theme, width), [theme, width]);
  if (!pin) return null;

  const c = PIN_COLORS[pin.category];

  // Resolve pin-specific info from firmware config
  const pinNum = parseInt(pin.gpio.replace(/\D/g, ''));
  const getSpecs = (): string[] => {
    if (pinNum === ESP32_CONFIG.pins.I2C_SDA) return ['I2C Data Line', ESP32_CONFIG.i2c.frequency, 'MPU9250, INA219, RTC'];
    if (pinNum === ESP32_CONFIG.pins.I2C_SCL) return ['I2C Clock Line', ESP32_CONFIG.i2c.frequency];
    if (pinNum === ESP32_CONFIG.pins.BTN_NEXT) return ['Navigation Button', '200ms debounce'];
    if (pinNum === ESP32_CONFIG.pins.BTN_PREV) return ['Navigation Button', '200ms debounce'];
    if (pinNum === ESP32_CONFIG.pins.INA_INT) return ['Power Alert Interrupt', 'Configurable thresholds'];
    if (pinNum === ESP32_CONFIG.pins.THERM_PIN) return ['NTC 10kΩ', `β = ${ESP32_CONFIG.sensors.thermistor.bCoeff}`, ESP32_CONFIG.sensors.thermistor.calibration];
    if (pin.category === 'power') return [pin.fn];
    return ['Published to MQTT'];
  };

  const specs = getSpecs();

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <View style={styles.modalContainer}>
        <View style={styles.modalHandle} />

        {/* Pin header */}
        <View style={styles.modalHeader}>
          <View style={[styles.modalIconWrap, { backgroundColor: c + '15', borderColor: c + '30' }]}>
            <Ionicons
              name={
                pin.category === 'i2c' ? 'git-branch-outline' :
                pin.category === 'button' ? 'radio-button-on-outline' :
                pin.category === 'adc' ? 'thermometer-outline' :
                pin.category === 'interrupt' ? 'flash-outline' :
                pin.category === 'power' ? 'battery-charging-outline' :
                'git-commit-outline'
              }
              size={22}
              color={c}
            />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.modalTitle}>{pin.gpio}</Text>
            <Text style={styles.modalSubtitle}>{pin.fn}</Text>
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

        {/* Live value if available */}
        <View style={styles.modalValueCard}>
          <Text style={styles.modalValueLabel}>Valoare Live</Text>
          <View style={styles.modalValueRow}>
            <Text style={styles.modalValueText}>{liveValue ?? '—'}</Text>
            <View style={[styles.pinDetailBadge, { backgroundColor: c + '20', borderColor: c + '50' }]}>
              <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: c }} />
              <Text style={[styles.pinDetailBadgeText, { color: c }]}>
                {pin.category.toUpperCase()}
              </Text>
            </View>
          </View>
          {pin.alt ? <Text style={styles.modalTypeTag}>{pin.alt}</Text> : null}
        </View>

        {/* Specs */}
        <View style={styles.modalSpecsSection}>
          <Text style={styles.modalSpecsSectionTitle}>Detalii Pin</Text>
          {specs.map((spec, idx) => (
            <View key={idx} style={styles.modalSpecRow}>
              <View style={[styles.modalSpecBullet, { backgroundColor: c }]} />
              <Text style={styles.modalSpecText}>{spec}</Text>
            </View>
          ))}
        </View>

        <View style={{ flex: 1 }} />
        <Pressable
          onPress={onClose}
          style={({ pressed }) => [styles.modalDoneBtn, pressed && { opacity: 0.7 }]}
        >
          <Text style={styles.modalDoneBtnText}>Gata</Text>
        </Pressable>
      </View>
    </Modal>
  );
}

export default function SensorsScreen() {
  const { theme } = useAppTheme();
  const { width } = useWindowDimensions();
  const styles = useMemo(() => createStyles(theme, width), [theme, width]);
  const { ioLog, status, data, selectedRange, setTimeRange, mqttStatus } = useESP32();
  const [selectedPin, setSelectedPin] = useState<string | null>(null);
  const [selectedBoardPin, setSelectedBoardPin] = useState<PinDef | null>(null);
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
      let sensorType = 'I/O Digital';
      let category: SensorDetail['category'] = 'gpio';
      let type: SensorDetail['type'] = 'digital';
      let specs: string[] = [];
      
      if (pinNum === ESP32_CONFIG.pins.I2C_SDA) {
        sensorType = 'Linie Date I2C (SDA)';
        category = 'i2c-bus';
        type = 'i2c';
        specs = [
          `GPIO ${ESP32_CONFIG.pins.I2C_SDA}`, 
          ESP32_CONFIG.i2c.frequency, 
          `${ESP32_CONFIG.i2c.devices.length} devices connected`,
          'MPU9250, INA219, RTC'
        ];
      } else if (pinNum === ESP32_CONFIG.pins.I2C_SCL) {
        sensorType = 'Linie Ceas I2C (SCL)';
        category = 'i2c-bus';
        type = 'i2c';
        specs = [`GPIO ${ESP32_CONFIG.pins.I2C_SCL}`, ESP32_CONFIG.i2c.frequency, 'Semnal ceas serial'];
      } else if (pinNum === ESP32_CONFIG.pins.BTN_NEXT) {
        sensorType = 'Buton Navigare';
        specs = [`GPIO ${ESP32_CONFIG.pins.BTN_NEXT}`, 'Buton Înainte', '200ms debounce'];
      } else if (pinNum === ESP32_CONFIG.pins.BTN_PREV) {
        sensorType = 'Buton Navigare';
        specs = [`GPIO ${ESP32_CONFIG.pins.BTN_PREV}`, 'Buton Înapoi', '200ms debounce'];
      } else if (pinNum === ESP32_CONFIG.pins.INA_INT) {
        sensorType = 'Întrerupere INA219';
        category = 'power';
        specs = [`GPIO ${ESP32_CONFIG.pins.INA_INT}`, 'Alertă putere', 'Praguri configurabile'];
      } else if (pinNum === ESP32_CONFIG.pins.THERM_PIN) {
        sensorType = 'Termistor NTC';
        type = 'thermal';
        category = 'analog';
        specs = [
          `GPIO ${ESP32_CONFIG.pins.THERM_PIN} (ADC)`, 
          ESP32_CONFIG.sensors.thermistor.type, 
          `β = ${ESP32_CONFIG.sensors.thermistor.bCoeff}`,
          ESP32_CONFIG.sensors.thermistor.calibration
        ];
      } else if (ESP32_CONFIG.pins.GPIO_PUBLISH.includes(pinNum)) {
        sensorType = 'GPIO Monitorizat';
        specs = [`GPIO ${pinNum}`, 'Publicat pe MQTT'];
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
          sensor: 'Intrare Analogică',
          value,
          type: 'analog',
          status: 'active',
          category: 'i2c-device',
          specs: ['Canal ADC extern']
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
        sensor: isPower ? 'Monitor Putere' : isCurrent ? 'Monitor Curent' : 'Monitor Tensiune',
        value,
        type: 'power',
        status: 'active',
        category: 'power',
        specs: ['Adresă I2C: 0x40', ESP32_CONFIG.sensors.battery.range, 'Senzor curent high-side']
      });
    });

    return details;
  }, [gpioPairs, pcfPairs, inaPairs]);

  const selectedSensor = sensorDetails.find((s) => s.pin === selectedPin);
  const activeGpioCount = gpioPairs.filter(([, v]) => v > 0).length;

  // Live value lookup for board pin modal
  const getBoardPinLiveValue = (pin: PinDef): string | number | undefined => {
    const pinNum = pin.gpio.replace(/\D/g, '');
    const match = gpioPairs.find(([k]) => k.replace(/\D/g, '') === pinNum);
    return match ? match[1] : undefined;
  };

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

          {/* Quick stats — compact inline row */}
      

          {/* Interactive board + utilities — responsive row */}
          <View style={styles.responsiveRow}>
            {/* Pinout card */}
         

            {/* Utilities — serial + I2C inline */}
            <View style={[styles.responsiveRowItem, { justifyContent: 'space-between' }]}>
              <View style={styles.quickStats}>
            <View style={styles.quickStatItem}>
              <Text style={styles.quickStatValue}>{activeGpioCount}</Text>
              <Text style={styles.quickStatLabel}>Activ</Text>
            </View>
            <View style={styles.quickStatDivider} />
            <View style={styles.quickStatItem}>
              <Text style={styles.quickStatValue}>{ESP32_CONFIG.i2c.devices.length}</Text>
              <Text style={styles.quickStatLabel}>I2C</Text>
            </View>
            <View style={styles.quickStatDivider} />
            <View style={styles.quickStatItem}>
              <Text style={styles.quickStatValue}>{sensorDetails.length}</Text>
              <Text style={styles.quickStatLabel}>Total</Text>
            </View>
          </View>

              <View style={[styles.utilRow, { marginBottom: 0, flexDirection: 'column', gap: 12 }]}>
            <Pressable
              style={({ pressed }) => [styles.utilCard, pressed && styles.utilCardPressed]}
              onPressIn={() => setSerialOpen(true)}
            >
              <View style={styles.utilIconWrap}>
                <Ionicons name="terminal-outline" size={16} color={theme.colors.primary} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.utilCardTitle}>Serial</Text>
                <Text style={styles.utilCardSub}>{entries.length} pachete</Text>
              </View>
              <Ionicons name="chevron-forward" size={14} color={theme.colors.muted} />
            </Pressable>

            <View style={styles.utilCard}>
              <View style={styles.utilIconWrap}>
                <Ionicons name="git-branch-outline" size={16} color={PIN_COLORS.i2c} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.utilCardTitle}>Bus I2C</Text>
                <Text style={styles.utilCardSub}>{ESP32_CONFIG.i2c.frequency}</Text>
              </View>
            </View>
              </View>
            </View>
            </View>

            {/* I2C Devices */}
        
          
          {/* Live Sensor Grid — grouped by category */}
          {sensorDetails.length > 0 && (
            <View style={styles.panel}>
              <Text style={styles.panelTitle}>Date Live</Text>
              {(['power', 'i2c-bus', 'analog', 'gpio'] as const).map((cat) => {
                const items = groupedSensors[cat];
                if (items.length === 0) return null;
                const label =
                  cat === 'i2c-bus' ? 'Bus I2C' :
                  cat === 'power' ? 'Putere' :
                  cat === 'analog' ? 'Analogic' : 'GPIO';
                return (
                  <View key={cat}>
                    <Text style={styles.categoryLabel}>{label}</Text>
                    <View style={styles.sensorsGrid}>
                      {items.map((sensor) => (
                        <SensorTile
                          key={sensor.pin}
                          sensor={sensor}
                          onPress={() => setSelectedPin(sensor.pin)}
                          theme={theme}
                        />
                      ))}
                    </View>
                  </View>
                );
              })}
            </View>
          )}

          {sensorDetails.length === 0 && (
            <View style={[styles.panel, styles.emptyState]}>
              <Ionicons name="radio-outline" size={28} color={theme.colors.textSoft} />
              <Text style={styles.emptyText}>Waiting for ESP32 data...</Text>
              <Text style={styles.emptySubtext}>Check MQTT at {ESP32_CONFIG.mqtt.broker}</Text>
            </View>
          )}
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

      {/* Board pin detail modal */}
      <PinDetailModal
        pin={selectedBoardPin}
        visible={!!selectedBoardPin}
        onClose={() => setSelectedBoardPin(null)}
        liveValue={selectedBoardPin ? getBoardPinLiveValue(selectedBoardPin) : undefined}
        theme={theme}
      />
    </SafeAreaView>
  );
}

const createStyles = (theme: AppTheme, screenWidth: number = 400) => {
  const isCompact = screenWidth < 500;
  const isWide = screenWidth >= 900;

  return StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: theme.colors.background
  },
  content: {
    paddingHorizontal: isCompact ? 12 : 16,
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
    gap: 0,
    backgroundColor: theme.colors.card,
    borderRadius: theme.radius.md,
    borderWidth: 1,
    borderColor: theme.colors.border,
    marginBottom: 12,
    ...theme.shadow.card
  },
  quickStatItem: {
    flex: 1,
    alignItems: 'center',
    gap: 1,
    paddingVertical: 10,
  },
  quickStatValue: {
    fontFamily: theme.font.mono,
    fontSize: 22,
    color: theme.colors.text
  },
  quickStatLabel: {
    fontFamily: theme.font.medium,
    fontSize: 13,
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
    paddingHorizontal: 16,
    paddingVertical: 14,
    marginBottom: 14,
    ...theme.shadow.card
  },
  panelTitle: {
    fontFamily: theme.font.bold,
    fontSize: 18,
    color: theme.colors.text,
    marginBottom: 10
  },
  panelCaption: {
    fontFamily: theme.font.medium,
    fontSize: 12,
    color: theme.colors.textSoft,
    marginBottom: 12
  },

  /* ── Responsive sections container ── */
  responsiveRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 14,
    flexWrap: 'wrap',
  },
  responsiveRowItem: {
    flex: 1,
    minWidth: 260,
  },
  /* ── Utility row ── */
  utilRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 0,
  },
  utilCard: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: theme.colors.card,
    borderRadius: theme.radius.md,
    borderWidth: 1,
    borderColor: theme.colors.border,
    paddingHorizontal: 10,
    paddingVertical: 10,
  },
  utilCardPressed: {
    opacity: 0.6,
  },
  utilIconWrap: {
    width: 30,
    height: 30,
    borderRadius: 8,
    backgroundColor: theme.colors.surfaceMuted,
    justifyContent: 'center',
    alignItems: 'center',
  },
  utilCardTitle: {
    fontFamily: theme.font.semiBold,
    fontSize: 14,
    color: theme.colors.text,
  },
  utilCardSub: {
    fontFamily: theme.font.mono,
    fontSize: 12,
    color: theme.colors.textSoft,
  },

  /* ── I2C compact list ── */
  i2cList: {
    gap: 0
  },
  i2cRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: theme.colors.border
  },
  i2cIconWrap: {
    width: 32,
    height: 32,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
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
  i2cAddrBadge: {
    backgroundColor: theme.colors.surfaceMuted,
    borderRadius: 5,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  i2cAddr: {
    fontFamily: theme.font.mono,
    fontSize: 13,
    color: theme.colors.textSoft
  },

  /* ── Category label ── */
  categoryLabel: {
    fontFamily: theme.font.semiBold,
    fontSize: 14,
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
    gap: isCompact ? 10 : 14
  },
  sensorTile: {
    flexGrow: 1,
    flexShrink: 0,
    minWidth: isCompact ? 140 : 200,
    maxWidth: isWide ? 300 : undefined,
    backgroundColor: theme.colors.card,
    borderRadius: theme.radius.lg,
    borderWidth: 1,
    borderColor: theme.colors.border,
    padding: isCompact ? 12 : 16,
    gap: 10,
    ...theme.shadow.card
  },
  sensorTilePressed: {
    opacity: 0.7,
    transform: [{ scale: 0.98 }]
  },
  sensorTileRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12
  },
  sensorTileIcon: {
    width: 44,
    height: 44,
    borderRadius: 12,
    borderWidth: 1.5,
    justifyContent: 'center',
    alignItems: 'center'
  },
  sensorTileMeta: {
    flex: 1,
    gap: 4
  },
  sensorTileLabel: {
    fontFamily: theme.font.bold,
    fontSize: 14,
    color: theme.colors.text,
    textTransform: 'uppercase',
    letterSpacing: 0.6
  },
  sensorTileType: {
    fontFamily: theme.font.medium,
    fontSize: 13,
    color: theme.colors.textSoft,
    lineHeight: 18
  },
  sensorTileActiveDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: theme.colors.success,
    borderWidth: 2,
    borderColor: theme.colors.success + '40'
  },
  sensorTileValueRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    marginTop: 4
  },
  sensorTileValue: {
    fontFamily: theme.font.mono,
    fontSize: 28,
    fontWeight: '700',
    color: theme.colors.text,
    letterSpacing: -0.5
  },
  digitalStateText: {
    fontFamily: theme.font.bold,
    fontSize: 11,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 6,
    backgroundColor: theme.colors.surfaceMuted,
    color: theme.colors.textSoft,
    overflow: 'hidden',
    letterSpacing: 0.3
  },
  digitalStateTextHigh: {
    backgroundColor: theme.colors.success + '20',
    color: theme.colors.success
  },

  /* ── ESP32 Pinout Card ── */
  pinoutCard: {
    backgroundColor: theme.colors.card,
    borderRadius: theme.radius.lg,
    borderWidth: 1,
    borderColor: theme.colors.border,
    padding: isCompact ? 8 : 12,
    marginBottom: 0,
    overflow: 'hidden',
    ...theme.shadow.card
  },
  pinoutHeaderRow: {
    marginBottom: 12,
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border + '30',
  },
  pinoutTitleWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  pinoutIconWrap: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: theme.colors.primary + '15',
    borderWidth: 1,
    borderColor: theme.colors.primary + '30',
    justifyContent: 'center',
    alignItems: 'center',
  },
  pinoutTitle: {
    fontFamily: theme.font.bold,
    fontSize: 16,
    color: theme.colors.text,
    marginBottom: 0,
  },
  pinoutSubtitle: {
    fontFamily: theme.font.medium,
    fontSize: 12,
    color: theme.colors.textSoft,
  },

  /* Board layout */
  boardContainer: {
    flexDirection: 'row',
    alignItems: 'stretch',
    marginBottom: 10,
    gap: 0,
    overflow: 'hidden',
  },
  boardSide: {
    flex: 1,
    gap: 0,
    minWidth: 0,
  },

  /* Pin label rows — compact, tappable */
  pinLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: isCompact ? 2 : 4,
    height: isCompact ? 30 : 34,
    paddingHorizontal: isCompact ? 1 : 3,
  },
  pinLabelRowLeft: {
    justifyContent: 'flex-end',
  },
  pinLabelRowRight: {
    justifyContent: 'flex-start',
  },
  pinLabelSelected: {
    backgroundColor: theme.colors.surfaceMuted,
    borderRadius: 8,
  },
  pinLabelOffline: {
    opacity: 0.45,
  },
  pinConnectorLine: {
    width: isCompact ? 8 : 16,
    height: 2,
    borderRadius: 1,
  },
  pinBadge: {
    borderWidth: 1,
    borderRadius: 5,
    paddingHorizontal: isCompact ? 3 : 5,
    paddingVertical: 3,
    minWidth: isCompact ? 38 : 48,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    justifyContent: 'center',
  },
  pinColorDot: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
  },
  pinBadgeText: {
    fontFamily: theme.font.mono,
    fontSize: isCompact ? 8 : 10,
    fontWeight: '600',
  },
  pinAltText: {
    fontFamily: theme.font.mono,
    fontSize: 8,
    color: theme.colors.textSoft,
  },
  pinFnText: {
    fontFamily: theme.font.medium,
    fontSize: isCompact ? 9 : 12,
    color: theme.colors.textSoft,
    flexShrink: 1,
  },

  /* Central chip — compact, real ESP32 green */
  boardChip: {
    width: isCompact ? 80 : 120,
    alignItems: 'center',
    justifyContent: 'flex-start',
  },
  chipBody: {
    width: '100%',
    height: isCompact ? 140 : 160,
    backgroundColor: '#0a3a0a',
    borderWidth: 2,
    borderColor: '#2d6a2d',
    borderRadius: 10,
    flexDirection: 'row',
    alignItems: 'stretch',
    paddingVertical: isCompact ? 8 : 12,
    paddingHorizontal: isCompact ? 3 : 5,
    gap: 3,
  },
  usbStub: {
    width: isCompact ? 32 : 42,
    height: 14,
    backgroundColor: '#1a5a1a',
    borderWidth: 1.5,
    borderTopWidth: 0,
    borderColor: '#3d7a3d',
    borderBottomLeftRadius: 5,
    borderBottomRightRadius: 5,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 2,
  },
  usbPort: {
    width: 12,
    height: 6,
    backgroundColor: theme.colors.primary + '40',
    borderRadius: 2,
    borderWidth: 1,
    borderColor: theme.colors.primary + '60',
  },
  usbText: {
    fontFamily: theme.font.bold,
    fontSize: 6,
    color: '#5ad85a',
    letterSpacing: 0.5,
  },
  chipPinCol: {
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 3,
    paddingVertical: 4,
    marginHorizontal: 3,
  },
  chipPinWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 1,
  },
  chipPinDot: {
    width: 4,
    height: 4,
    borderRadius: 2,
  },
  chipPinPad: {
    width: 7,
    height: 7,
    borderRadius: 1.5,
    borderWidth: 1.2,
  },
  chipCenter: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    paddingVertical: 6,
  },
  chipLogoContainer: {
    width: 28,
    height: 28,
    borderRadius: 6,
    backgroundColor: '#1a5a1a',
    borderWidth: 1,
    borderColor: '#3d7a3d',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 1,
  },
  chipMainLabel: {
    fontFamily: theme.font.bold,
    fontSize: 11,
    color: '#5ad85a',
    letterSpacing: 0.3,
  },
  chipSubLabel: {
    fontFamily: theme.font.mono,
    fontSize: 9,
    color: '#3d8a3d',
  },
  chipDotPattern: {
    marginTop: 6,
    gap: 2,
  },
  chipDotRow: {
    flexDirection: 'row',
    gap: 2,
  },
  chipTinyDot: {
    width: 2,
    height: 2,
    borderRadius: 1,
    backgroundColor: theme.colors.border,
  },

  /* Legend */
  pinoutLegend: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: theme.colors.border + '30',
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 8,
    paddingVertical: 4,
    backgroundColor: theme.colors.surfaceMuted,
    borderRadius: 5,
  },
  legendDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  legendLabel: {
    fontFamily: theme.font.medium,
    fontSize: 12,
    color: theme.colors.text,
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
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 28
  },
  modalHandle: {
    alignSelf: 'center',
    width: 40,
    height: 5,
    borderRadius: 3,
    backgroundColor: theme.colors.border,
    marginBottom: 20
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    marginBottom: 24
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
    fontSize: 20,
    color: theme.colors.text
  },
  modalSubtitle: {
    fontFamily: theme.font.medium,
    fontSize: 14,
    color: theme.colors.textSoft,
    marginTop: 4
  },
  modalCloseBtn: {
    width: 44,
    height: 44,
    borderRadius: 999,
    backgroundColor: theme.colors.card,
    borderWidth: 1,
    borderColor: theme.colors.border,
    justifyContent: 'center',
    alignItems: 'center'
  },

  /* ── Pin detail badge ── */
  pinDetailBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    alignSelf: 'flex-start',
    borderRadius: 8,
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 5,
    marginTop: 10,
  },
  pinDetailBadgeText: {
    fontFamily: theme.font.mono,
    fontSize: 12,
    fontWeight: '600',
    textTransform: 'uppercase',
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
    fontSize: 32,
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
};
