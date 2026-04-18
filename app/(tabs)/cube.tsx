import { useEffect, useMemo, useRef, useState } from 'react';
import { Platform, Pressable, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useIsFocused } from '@react-navigation/native';

import { IMU_WS_PORT, IMU_WS_URL } from '@/constants/config';
import { AppTheme } from '@/constants/theme';
import { useAppTheme } from '@/hooks/useAppTheme';
import { useImuQuaternion } from '@/hooks/useImuQuaternion';
import { useStore } from '@/hooks/useStore';

type SceneTone = 'system' | 'cinematic';

export default function CubeScreen() {
  const { width } = useWindowDimensions();
  const isFocused = useIsFocused();
  const { theme, themeMode } = useAppTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const isMobileView = Platform.OS !== 'web' && width < 900;

  const [sceneTone, setSceneTone] = useState<SceneTone>('system');
  const [IMUCubeComponent, setIMUCubeComponent] = useState<typeof import('../../components/IMUCube').IMUCube | null>(null);

  useEffect(() => {
    let mounted = true;

    if (!isFocused) {
      setIMUCubeComponent(null);
      return () => {
        mounted = false;
      };
    }

    import('../../components/IMUCube')
      .then((module) => {
        if (mounted) {
          setIMUCubeComponent(() => module.IMUCube);
        }
      })
      .catch(() => {
        if (mounted) {
          setIMUCubeComponent(null);
        }
      });

    return () => {
      mounted = false;
    };
  }, [isFocused]);

  const deviceIp = useStore((s) => s.data?.ip);
  const appConnectionStatus = useStore((s) => s.connectionStatus);

  const wsUrl = deviceIp && deviceIp !== '--' ? `ws://${deviceIp}:${IMU_WS_PORT}` : IMU_WS_URL;
  const activeWsUrl = isFocused ? wsUrl : '';

  const {
    quaternionRef,
    filteredEulerRef,
    rawFrameRef,
    motionRef,
    connectionStatus,
    recalibrateOrientation,
    recenterPosition,
    setAxisMapping
  } = useImuQuaternion(activeWsUrl);

  const sceneMode = sceneTone === 'cinematic' ? 'immersive' : themeMode === 'dark' ? 'immersive' : 'light';

  const [displayAccel, setDisplayAccel] = useState({ x: 0, y: 0, z: 0 });
  const accelTargetRef = useRef({ x: 0, y: 0, z: 0 });
  const accelWarmupRef = useRef(0);

  const toFinite = (value: unknown) => {
    if (typeof value === 'number' && Number.isFinite(value)) {
      return value;
    }
    if (typeof value === 'string') {
      const parsed = Number(value);
      if (Number.isFinite(parsed)) {
        return parsed;
      }
    }
    return null;
  };

  useEffect(() => {
    setAxisMapping({ swapXY: true, swapYZ: true });
    recalibrateOrientation();
    recenterPosition();
  }, [recalibrateOrientation, recenterPosition, setAxisMapping]);

  useEffect(() => {
    if (connectionStatus === 'connected') {
      accelWarmupRef.current = 0;
    }
  }, [connectionStatus]);

  useEffect(() => {
    if (!isFocused) {
      setDisplayAccel({ x: 0, y: 0, z: 0 });
      return undefined;
    }

    const readLiveAcceleration = () => {
      const frame = rawFrameRef.current;
      const imu = (frame?.imu && typeof frame.imu === 'object' ? frame.imu : frame) as Record<string, unknown> | null;

      if (imu) {
        const x = toFinite(imu.lin_ax) ?? toFinite(imu.linAx) ?? toFinite(imu.ax);
        const y = toFinite(imu.lin_ay) ?? toFinite(imu.linAy) ?? toFinite(imu.ay);
        const z = toFinite(imu.lin_az) ?? toFinite(imu.linAz) ?? toFinite(imu.az);
        if (x !== null && y !== null && z !== null) {
          return { x, y, z };
        }
      }

      return { x: 0, y: 0, z: 0 };
    };

    const timer = setInterval(() => {
      if (accelWarmupRef.current < 6) {
        accelWarmupRef.current += 1;
        setDisplayAccel({ x: 0, y: 0, z: 0 });
        return;
      }

      accelTargetRef.current = readLiveAcceleration();
      setDisplayAccel((prev) => ({
        x: prev.x + (accelTargetRef.current.x - prev.x) * 0.52,
        y: prev.y + (accelTargetRef.current.y - prev.y) * 0.52,
        z: prev.z + (accelTargetRef.current.z - prev.z) * 0.52
      }));
    }, 120);

    return () => clearInterval(timer);
  }, [isFocused, rawFrameRef]);

  return (
    <SafeAreaView edges={['top', 'left', 'right']} style={styles.safeArea}>
      <View style={styles.screenBgLayer} />
      <View style={styles.stage}>
        {isFocused && IMUCubeComponent ? (
          <IMUCubeComponent
            key={`${sceneMode}-${sceneTone}`}
            showHud={false}
            imuQRef={quaternionRef}
            imuMotionRef={motionRef}
            themeMode={sceneMode}
            mobileView={isMobileView}
          />
        ) : (
          <View style={styles.stateCard}>
            <Ionicons
              name={isFocused ? 'alert-circle-outline' : 'pause-circle-outline'}
              size={20}
              color={theme.colors.primary}
            />
            <Text style={styles.stateTitle}>{isFocused ? '3D Engine Unavailable' : 'Cube Stream Paused'}</Text>
            <Text style={styles.stateDescription}>
              {isFocused
                ? 'This build cannot initialize GL rendering. Use a dev or production build for full 3D support.'
                : 'The IMU websocket and rendering are suspended while this tab is not active.'}
            </Text>
          </View>
        )}

        <View style={styles.topBar}>
          <View style={styles.titleChip}>
            <Ionicons name="cube-outline" size={17} color={theme.colors.primary} />
            <Text style={styles.titleText}>IMU Spatial Cube</Text>
          </View>

          <View style={styles.topActions}>
            <Pressable
              style={styles.modeToggle}
              onPress={() => setSceneTone((prev) => (prev === 'system' ? 'cinematic' : 'system'))}
            >
              <Ionicons
                name={sceneTone === 'cinematic' ? 'sparkles-outline' : 'contrast-outline'}
                size={15}
                color={theme.colors.text}
              />
              <Text style={styles.modeToggleText}>{sceneTone === 'cinematic' ? 'Cinematic' : 'System'}</Text>
            </Pressable>

            <View style={[styles.connectionChip, connectionStatus === 'connected' ? styles.connectionChipOnline : styles.connectionChipMuted]}>
              <Text style={styles.connectionChipText}>{connectionStatus === 'connected' ? 'LIVE' : connectionStatus.toUpperCase()}</Text>
            </View>
          </View>
        </View>

        <View style={styles.metricsRail}>
          <MetricPill label="ROLL" value={`${(filteredEulerRef.current.roll ?? 0).toFixed(1)} deg`} styles={styles} />
          <MetricPill label="PITCH" value={`${(filteredEulerRef.current.pitch ?? 0).toFixed(1)} deg`} styles={styles} />
          <MetricPill label="YAW" value={`${(filteredEulerRef.current.yaw ?? 0).toFixed(1)} deg`} styles={styles} />
        </View>

        <View style={styles.bottomCard}>
          <Text style={styles.bottomTitle}>Linear Acceleration</Text>
          <View style={styles.accelRow}>
            <AccelItem axis="X" value={displayAccel.y} styles={styles} />
            <AccelItem axis="Y" value={displayAccel.z} styles={styles} />
            <AccelItem axis="Z" value={displayAccel.x} styles={styles} />
          </View>

          <View style={styles.bottomActionsRow}>
            <Text style={styles.bottomHint}>{`Gateway: ${appConnectionStatus}`}</Text>
            <View style={styles.controlsRow}>
              <Pressable style={styles.actionButton} onPress={recenterPosition}>
                <Ionicons name="locate-outline" size={16} color={theme.colors.text} />
                <Text style={styles.actionText}>Recenter</Text>
              </Pressable>
              <Pressable style={styles.actionButton} onPress={recalibrateOrientation}>
                <Ionicons name="sync-outline" size={16} color={theme.colors.text} />
                <Text style={styles.actionText}>Calibrate</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </View>
    </SafeAreaView>
  );
}

function MetricPill({ label, value, styles }: { label: string; value: string; styles: ReturnType<typeof createStyles> }) {
  return (
    <View style={styles.metricPill}>
      <Text style={styles.metricLabel}>{label}</Text>
      <Text style={styles.metricValue}>{value}</Text>
    </View>
  );
}

function AccelItem({ axis, value, styles }: { axis: string; value: number; styles: ReturnType<typeof createStyles> }) {
  return (
    <View style={styles.accelItem}>
      <Text style={styles.accelAxis}>{axis}</Text>
      <Text style={styles.accelValue}>{`${value.toFixed(2)} m/s^2`}</Text>
    </View>
  );
}

const createStyles = (theme: AppTheme) =>
  StyleSheet.create({
    safeArea: {
      flex: 1,
      backgroundColor: theme.colors.background
    },
    screenBgLayer: {
      ...StyleSheet.absoluteFillObject,
      backgroundColor: theme.colors.background,
      opacity: 0.96
    },
    stage: {
      flex: 1,
      position: 'relative'
    },
    stateCard: {
      position: 'absolute',
      top: 84,
      left: 16,
      right: 16,
      borderRadius: theme.radius.md,
      borderCurve: 'continuous',
      borderWidth: 1,
      borderColor: theme.colors.border,
      backgroundColor: theme.colors.surfaceRaised,
      paddingHorizontal: 14,
      paddingVertical: 12,
      gap: 6,
      zIndex: 6
    },
    stateTitle: {
      color: theme.colors.text,
      fontFamily: theme.font.semiBold,
      fontSize: 16
    },
    stateDescription: {
      color: theme.colors.textSoft,
      fontFamily: theme.font.medium,
      fontSize: 14,
      lineHeight: 20
    },
    topBar: {
      position: 'absolute',
      top: 10,
      left: 10,
      right: 10,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      zIndex: 8
    },
    titleChip: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 7,
      borderRadius: 999,
      borderCurve: 'continuous',
      borderWidth: 1,
      borderColor: theme.colors.border,
      backgroundColor: theme.colors.surfaceRaised,
      paddingHorizontal: 12,
      paddingVertical: 8
    },
    titleText: {
      color: theme.colors.text,
      fontFamily: theme.font.semiBold,
      fontSize: 15
    },
    topActions: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8
    },
    modeToggle: {
      minHeight: theme.touch.minTarget,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      borderRadius: 999,
      borderCurve: 'continuous',
      borderWidth: 1,
      borderColor: theme.colors.border,
      backgroundColor: theme.colors.card,
      paddingHorizontal: 12,
      paddingVertical: 8
    },
    modeToggleText: {
      color: theme.colors.text,
      fontFamily: theme.font.medium,
      fontSize: 13
    },
    connectionChip: {
      borderRadius: 999,
      borderCurve: 'continuous',
      borderWidth: 1,
      paddingHorizontal: 11,
      paddingVertical: 8
    },
    connectionChipOnline: {
      borderColor: theme.colors.success,
      backgroundColor: theme.accents.success
    },
    connectionChipMuted: {
      borderColor: theme.colors.border,
      backgroundColor: theme.colors.surfaceMuted
    },
    connectionChipText: {
      color: theme.colors.text,
      fontFamily: theme.font.semiBold,
      fontSize: 13
    },
    metricsRail: {
      position: 'absolute',
      top: 76,
      right: 10,
      gap: 8,
      zIndex: 8
    },
    metricPill: {
      minWidth: 112,
      borderRadius: 12,
      borderCurve: 'continuous',
      borderWidth: 1,
      borderColor: theme.colors.border,
      backgroundColor: theme.colors.surfaceRaised,
      paddingHorizontal: 10,
      paddingVertical: 8
    },
    metricLabel: {
      color: theme.colors.muted,
      fontFamily: theme.font.medium,
      fontSize: 12
    },
    metricValue: {
      marginTop: 2,
      color: theme.colors.text,
      fontFamily: theme.font.monoMedium,
      fontSize: 17,
      fontVariant: ['tabular-nums']
    },
    bottomCard: {
      position: 'absolute',
      left: 10,
      right: 10,
      bottom: 10,
      borderRadius: theme.radius.lg,
      borderCurve: 'continuous',
      borderWidth: 1,
      borderColor: theme.colors.border,
      backgroundColor: theme.colors.surfaceRaised,
      paddingHorizontal: 12,
      paddingVertical: 12,
      gap: 10,
      zIndex: 8
    },
    bottomTitle: {
      color: theme.colors.text,
      fontFamily: theme.font.semiBold,
      fontSize: 16
    },
    accelRow: {
      flexDirection: 'row',
      gap: 8
    },
    accelItem: {
      flex: 1,
      borderRadius: 12,
      borderCurve: 'continuous',
      borderWidth: 1,
      borderColor: theme.colors.border,
      backgroundColor: theme.colors.surfaceAlt,
      paddingHorizontal: 10,
      paddingVertical: 8
    },
    accelAxis: {
      color: theme.colors.primary,
      fontFamily: theme.font.semiBold,
      fontSize: 13
    },
    accelValue: {
      marginTop: 2,
      color: theme.colors.text,
      fontFamily: theme.font.mono,
      fontSize: 16,
      fontVariant: ['tabular-nums']
    },
    bottomActionsRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 8
    },
    bottomHint: {
      flex: 1,
      color: theme.colors.textSoft,
      fontFamily: theme.font.medium,
      fontSize: 13,
      textTransform: 'uppercase'
    },
    controlsRow: {
      flexDirection: 'row',
      gap: 8
    },
    actionButton: {
      minHeight: theme.touch.minTarget,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      borderRadius: 10,
      borderCurve: 'continuous',
      borderWidth: 1,
      borderColor: theme.colors.border,
      backgroundColor: theme.colors.card,
      paddingHorizontal: 11,
      paddingVertical: 8
    },
    actionText: {
      color: theme.colors.text,
      fontFamily: theme.font.semiBold,
      fontSize: 13
    }
  });
