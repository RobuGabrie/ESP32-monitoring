import { Platform, Pressable, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { useEffect, useRef, useState } from 'react';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useIsFocused } from '@react-navigation/native';

import { IMU_WS_PORT, IMU_WS_URL } from '@/constants/config';
import { IMUCubeLite } from '@/components/IMUCubeLite';
import { theme } from '@/constants/theme';
import { useImuQuaternion } from '../../hooks/useImuQuaternion';
import { useStore } from '@/hooks/useStore';

export default function CubeScreen() {
  const { width } = useWindowDimensions();
  const isFocused = useIsFocused();
  const isMobileView = Platform.OS !== 'web' && width < 900;
  const [IMUCubeComponent, setIMUCubeComponent] = useState<typeof import('../../components/IMUCube').IMUCube | null>(null);

  useEffect(() => {
    let mounted = true;
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
  }, []);

  const deviceIp = useStore((s) => s.data?.ip);
  const status = useStore((s) => s.connectionStatus);
  const [displayAccel, setDisplayAccel] = useState({ x: 0, y: 0, z: 0 });
  const accelTargetRef = useRef({ x: 0, y: 0, z: 0 });
  const accelWarmupRef = useRef(0);
  const wsUrl = deviceIp && deviceIp !== '--' ? `ws://${deviceIp}:${IMU_WS_PORT}` : IMU_WS_URL;
  const {
    quaternionRef,
    filteredEulerRef,
    rawFrameRef,
    motionRef,
    connectionStatus,
    recalibrateOrientation,
    recenterPosition,
    setAxisMapping
  } = useImuQuaternion(isFocused ? wsUrl : '');
  const [sceneMode, setSceneMode] = useState<'light' | 'immersive'>('light');

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

      return {
        x: 0,
        y: 0,
        z: 0
      };
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
    <SafeAreaView style={sceneMode === 'immersive' ? styles.safeImmersive : styles.safeLight}>
      <View style={styles.stage}>
        {isFocused && IMUCubeComponent ? (
          <IMUCubeComponent
            key={sceneMode}
            showHud={false}
            imuQRef={quaternionRef}
            imuMotionRef={motionRef}
            themeMode={sceneMode}
            mobileView={isMobileView}
          />
        ) : isFocused ? (
          <>
            <IMUCubeLite imuQRef={quaternionRef} imuMotionRef={motionRef} themeMode={sceneMode} mobileView={isMobileView} />
            <View style={styles.glUnavailableCard}>
              <Ionicons name="information-circle-outline" size={18} color="#1E3A8A" />
              <Text style={styles.glUnavailableTitle}>Mod compatibil Expo Go</Text>
              <Text style={styles.glUnavailableText}>Randare 3D software activa. Pentru varianta GL completa foloseste EAS Build.</Text>
            </View>
          </>
        ) : (
          <View style={styles.pausedCard}>
            <Ionicons name="pause-circle-outline" size={20} color="#1E3A8A" />
            <Text style={styles.pausedTitle}>Vizualizare IMU in pauza</Text>
            <Text style={styles.pausedText}>Tab-ul nu este activ, randarea 3D si fluxul IMU sunt suspendate.</Text>
          </View>
        )}

        <View style={styles.topOverlay}>
          <View style={sceneMode === 'immersive' ? styles.titleChipImmersive : styles.titleChipLight}>
            <Ionicons name="cube-outline" size={14} color={sceneMode === 'immersive' ? '#BFDBFE' : '#1E3A8A'} />
            <Text style={sceneMode === 'immersive' ? styles.titleTextImmersive : styles.titleTextLight}>IMU Spatial View</Text>
          </View>
          <View style={styles.topActions}>
            <Pressable style={sceneMode === 'immersive' ? styles.modeButtonImmersive : styles.modeButtonLight} onPress={() => setSceneMode((prev) => (prev === 'light' ? 'immersive' : 'light'))}>
              <Ionicons name={sceneMode === 'light' ? 'moon-outline' : 'sunny-outline'} size={13} color={sceneMode === 'immersive' ? '#DBEAFE' : '#1E3A8A'} />
              <Text style={sceneMode === 'immersive' ? styles.modeButtonTextImmersive : styles.modeButtonTextLight}>
                {sceneMode === 'light' ? 'Immersive' : 'Light'}
              </Text>
            </Pressable>
            <View style={[styles.statusChip, connectionStatus === 'connected' ? styles.statusChipOnline : styles.statusChipOffline, sceneMode === 'light' ? styles.statusChipLightShell : null]}>
              <Text style={[styles.statusText, connectionStatus === 'connected' ? styles.statusTextOnline : styles.statusTextOffline]}>
              {connectionStatus === 'connected' ? 'Live' : connectionStatus}
              </Text>
            </View>
          </View>
        </View>

        <View style={styles.rightOverlay}>
          <HudValue label="Roll" value={`${(filteredEulerRef.current.roll ?? 0).toFixed(1)}°`} mode={sceneMode} />
          <HudValue label="Pitch" value={`${(filteredEulerRef.current.pitch ?? 0).toFixed(1)}°`} mode={sceneMode} />
          <HudValue label="Yaw" value={`${(filteredEulerRef.current.yaw ?? 0).toFixed(1)}°`} mode={sceneMode} />
        </View>

        <View style={sceneMode === 'immersive' ? styles.bottomOverlayImmersive : styles.bottomOverlayLight}>
          <View style={sceneMode === 'immersive' ? styles.accelCardImmersive : styles.accelCardLight}>
            <Text style={sceneMode === 'immersive' ? styles.bottomAccelImmersive : styles.bottomAccelLight}>
              {`Acceleratie  X ${displayAccel.x.toFixed(2)}  Y ${displayAccel.y.toFixed(2)}  Z ${displayAccel.z.toFixed(2)} m/s²`}
            </Text>
          </View>
          <View style={styles.bottomActionsRow}>
            <Text style={sceneMode === 'immersive' ? styles.bottomStatusHintImmersive : styles.bottomStatusHintLight}>{`ESP32: ${status}`}</Text>
            <Pressable style={sceneMode === 'immersive' ? styles.recenterButtonImmersive : styles.recenterButtonLight} onPress={recenterPosition}>
              <Ionicons name="locate-outline" size={13} color={sceneMode === 'immersive' ? '#DBEAFE' : '#1E3A8A'} />
              <Text style={sceneMode === 'immersive' ? styles.recenterTextImmersive : styles.recenterTextLight}>Recenter</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </SafeAreaView>
  );
}

function HudValue({ label, value, mode }: { label: string; value: string; mode: 'light' | 'immersive' }) {
  return (
    <View style={mode === 'immersive' ? styles.hudValueCardImmersive : styles.hudValueCardLight}>
      <Text style={mode === 'immersive' ? styles.hudValueLabelImmersive : styles.hudValueLabelLight}>{label}</Text>
      <Text style={mode === 'immersive' ? styles.hudValueTextImmersive : styles.hudValueTextLight}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  safeLight: { flex: 1, backgroundColor: '#EFF4FB' },
  safeImmersive: { flex: 1, backgroundColor: '#030712' },
  stage: {
    flex: 1,
    backgroundColor: 'transparent',
    position: 'relative'
  },
  glUnavailableCard: {
    position: 'absolute',
    left: 16,
    right: 16,
    top: 92,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#C6D8EE',
    backgroundColor: 'rgba(239,246,255,0.94)',
    paddingHorizontal: 14,
    paddingVertical: 10,
    gap: 4,
    zIndex: 5,
    elevation: 5
  },
  glUnavailableTitle: {
    color: '#1E3A8A',
    fontFamily: theme.font.semiBold,
    fontSize: 13
  },
  glUnavailableText: {
    color: '#334155',
    fontFamily: theme.font.medium,
    fontSize: 11,
    lineHeight: 16
  },
  pausedCard: {
    position: 'absolute',
    left: 16,
    right: 16,
    top: 92,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#C6D8EE',
    backgroundColor: 'rgba(239,246,255,0.94)',
    paddingHorizontal: 14,
    paddingVertical: 12,
    gap: 4,
    zIndex: 5,
    elevation: 5
  },
  pausedTitle: {
    color: '#1E3A8A',
    fontFamily: theme.font.semiBold,
    fontSize: 13
  },
  pausedText: {
    color: '#334155',
    fontFamily: theme.font.medium,
    fontSize: 11,
    lineHeight: 16
  },
  topOverlay: {
    position: 'absolute',
    top: theme.spacing.sm,
    left: theme.spacing.sm,
    right: theme.spacing.sm,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    zIndex: 4,
    elevation: 4
  },
  titleChipLight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#C7D8EE',
    backgroundColor: 'rgba(255,255,255,0.88)',
    paddingHorizontal: 12,
    paddingVertical: 8
  },
  titleChipImmersive: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: 'rgba(147,197,253,0.35)',
    backgroundColor: 'rgba(2,6,23,0.62)',
    paddingHorizontal: 12,
    paddingVertical: 8
  },
  titleTextLight: {
    color: '#1E3A8A',
    fontFamily: theme.font.semiBold,
    fontSize: 12
  },
  titleTextImmersive: {
    color: '#DBEAFE',
    fontFamily: theme.font.semiBold,
    fontSize: 12
  },
  topActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8
  },
  modeButtonLight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#C7D8EE',
    backgroundColor: 'rgba(255,255,255,0.88)',
    paddingHorizontal: 10,
    paddingVertical: 7
  },
  modeButtonImmersive: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: 'rgba(147,197,253,0.35)',
    backgroundColor: 'rgba(2,6,23,0.62)',
    paddingHorizontal: 10,
    paddingVertical: 7
  },
  modeButtonTextLight: {
    color: '#1E3A8A',
    fontFamily: theme.font.semiBold,
    fontSize: 11
  },
  modeButtonTextImmersive: {
    color: '#DBEAFE',
    fontFamily: theme.font.semiBold,
    fontSize: 11
  },
  statusChip: {
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 11,
    paddingVertical: 7
  },
  statusChipLightShell: {
    backgroundColor: 'rgba(255,255,255,0.86)'
  },
  statusChipOnline: {
    borderColor: 'rgba(74,222,128,0.48)',
    backgroundColor: 'rgba(22,101,52,0.32)'
  },
  statusChipOffline: {
    borderColor: 'rgba(252,165,165,0.45)',
    backgroundColor: 'rgba(127,29,29,0.35)'
  },
  statusText: {
    fontFamily: theme.font.semiBold,
    fontSize: 11
  },
  statusTextOnline: {
    color: '#BBF7D0'
  },
  statusTextOffline: {
    color: '#FECACA'
  },
  rightOverlay: {
    position: 'absolute',
    right: theme.spacing.sm,
    top: 72,
    gap: 8,
    zIndex: 4,
    elevation: 4
  },
  hudValueCardLight: {
    minWidth: 96,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#CEDCED',
    backgroundColor: 'rgba(255,255,255,0.88)',
    paddingHorizontal: 10,
    paddingVertical: 8
  },
  hudValueCardImmersive: {
    minWidth: 96,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(148,163,184,0.28)',
    backgroundColor: 'rgba(15,23,42,0.52)',
    paddingHorizontal: 10,
    paddingVertical: 8
  },
  hudValueLabelLight: {
    color: '#64748B',
    fontFamily: theme.font.medium,
    fontSize: 10,
    textTransform: 'uppercase'
  },
  hudValueLabelImmersive: {
    color: '#94A3B8',
    fontFamily: theme.font.medium,
    fontSize: 10,
    textTransform: 'uppercase'
  },
  hudValueTextLight: {
    marginTop: 2,
    color: '#1F2937',
    fontFamily: theme.font.bold,
    fontSize: 15
  },
  hudValueTextImmersive: {
    marginTop: 2,
    color: '#E2E8F0',
    fontFamily: theme.font.bold,
    fontSize: 15
  },
  bottomOverlayLight: {
    position: 'absolute',
    left: theme.spacing.sm,
    right: theme.spacing.sm,
    bottom: theme.spacing.sm,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#CEDCED',
    backgroundColor: 'rgba(255,255,255,0.9)',
    paddingHorizontal: 12,
    paddingVertical: 10,
    zIndex: 4,
    elevation: 4
  },
  bottomOverlayImmersive: {
    position: 'absolute',
    left: theme.spacing.sm,
    right: theme.spacing.sm,
    bottom: theme.spacing.sm,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(148,163,184,0.26)',
    backgroundColor: 'rgba(2,6,23,0.58)',
    paddingHorizontal: 12,
    paddingVertical: 10,
    zIndex: 4,
    elevation: 4
  },
  bottomActionsRow: {
    marginTop: 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between'
  },
  bottomAccelLight: {
    color: '#1E3A8A',
    fontFamily: theme.font.semiBold,
    fontSize: 16,
    letterSpacing: 0.2
  },
  bottomAccelImmersive: {
    color: '#DBEAFE',
    fontFamily: theme.font.semiBold,
    fontSize: 16,
    letterSpacing: 0.2
  },
  accelCardLight: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#C6D8EE',
    backgroundColor: 'rgba(230,239,251,0.92)',
    paddingHorizontal: 12,
    paddingVertical: 10
  },
  accelCardImmersive: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(147,197,253,0.28)',
    backgroundColor: 'rgba(30,58,138,0.26)',
    paddingHorizontal: 12,
    paddingVertical: 10
  },
  bottomStatusHintLight: {
    color: '#64748B',
    fontFamily: theme.font.medium,
    fontSize: 11,
    textTransform: 'uppercase'
  },
  bottomStatusHintImmersive: {
    color: '#64748B',
    fontFamily: theme.font.medium,
    fontSize: 11,
    textTransform: 'uppercase'
  },
  recenterButtonLight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#C6D8EE',
    backgroundColor: '#E6EFFB',
    paddingHorizontal: 10,
    paddingVertical: 6
  },
  recenterButtonImmersive: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(147,197,253,0.28)',
    backgroundColor: 'rgba(30,58,138,0.3)',
    paddingHorizontal: 10,
    paddingVertical: 6
  },
  recenterTextLight: {
    color: '#1E3A8A',
    fontFamily: theme.font.semiBold,
    fontSize: 11
  },
  recenterTextImmersive: {
    color: '#DBEAFE',
    fontFamily: theme.font.semiBold,
    fontSize: 11
  }
});
