import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useState } from 'react';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';

import { IMUCube } from '@/components/IMUCube';
import { IMU_WS_PORT, IMU_WS_URL } from '@/constants/config';
import { theme } from '@/constants/theme';
import { useImuQuaternion } from '../../hooks/useImuQuaternion';
import { useESP32 } from '@/hooks/useESP32';

export default function CubeScreen() {
  const { data, status } = useESP32();
  const wsUrl = data?.ip && data.ip !== '--' ? `ws://${data.ip}:${IMU_WS_PORT}` : IMU_WS_URL;
  const {
    quaternionRef,
    motionRef,
    connectionStatus,
    recenterPosition,
    recenterYaw,
    resetFilters,
    setFrozen,
    isFrozen,
    statsRef
  } = useImuQuaternion(wsUrl);
  const [sceneMode, setSceneMode] = useState<'light' | 'immersive'>('light');

  return (
    <SafeAreaView style={sceneMode === 'immersive' ? styles.safeImmersive : styles.safeLight}>
      <View style={styles.stage}>
        <IMUCube
          key={sceneMode}
          showHud={false}
          imuQRef={quaternionRef}
          imuMotionRef={motionRef}
          themeMode={sceneMode}
        />

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
          <HudValue label="Roll" value={`${(data?.roll ?? 0).toFixed(1)}°`} mode={sceneMode} />
          <HudValue label="Pitch" value={`${(data?.pitch ?? 0).toFixed(1)}°`} mode={sceneMode} />
          <HudValue label="Yaw" value={`${(data?.yaw ?? 0).toFixed(1)}°`} mode={sceneMode} />
        </View>

        <View style={sceneMode === 'immersive' ? styles.bottomOverlayImmersive : styles.bottomOverlayLight}>
          <Text style={sceneMode === 'immersive' ? styles.bottomLineImmersive : styles.bottomLineLight}>{`Rata ${statsRef.current.hz.toFixed(0)} Hz • dt ${Math.round(data?.dtMs ?? 0)} ms • q ${(data?.quaternionNorm ?? 0).toFixed(3)}`}</Text>
          <Text style={sceneMode === 'immersive' ? styles.bottomLineSoftImmersive : styles.bottomLineSoftLight}>{`LinAcc X ${(data?.linAx ?? 0).toFixed(2)} | Y ${(data?.linAy ?? 0).toFixed(2)} | Z ${(data?.linAz ?? 0).toFixed(2)} m/s²`}</Text>
          <Text style={sceneMode === 'immersive' ? styles.bottomLineSoftImmersive : styles.bottomLineSoftLight}>{`Age ${Math.round(statsRef.current.frameAgeMs)} ms • jitter ${statsRef.current.jitterMs.toFixed(1)} ms • outliers ${statsRef.current.outliers}`}</Text>
          <View style={styles.bottomActionsRow}>
            <Text style={sceneMode === 'immersive' ? styles.bottomStatusHintImmersive : styles.bottomStatusHintLight}>{`ESP32: ${status}`}</Text>
            <Pressable style={sceneMode === 'immersive' ? styles.recenterButtonImmersive : styles.recenterButtonLight} onPress={recenterPosition}>
              <Ionicons name="locate-outline" size={13} color={sceneMode === 'immersive' ? '#DBEAFE' : '#1E3A8A'} />
              <Text style={sceneMode === 'immersive' ? styles.recenterTextImmersive : styles.recenterTextLight}>Recenter</Text>
            </Pressable>
          </View>
          <View style={styles.toolsRow}>
            <Pressable style={sceneMode === 'immersive' ? styles.toolButtonImmersive : styles.toolButtonLight} onPress={recenterYaw}>
              <Text style={sceneMode === 'immersive' ? styles.toolTextImmersive : styles.toolTextLight}>Recenter yaw</Text>
            </Pressable>
            <Pressable style={sceneMode === 'immersive' ? styles.toolButtonImmersive : styles.toolButtonLight} onPress={() => setFrozen(!isFrozen.current)}>
              <Text style={sceneMode === 'immersive' ? styles.toolTextImmersive : styles.toolTextLight}>{isFrozen.current ? 'Unfreeze' : 'Freeze'}</Text>
            </Pressable>
            <Pressable style={sceneMode === 'immersive' ? styles.toolButtonImmersive : styles.toolButtonLight} onPress={resetFilters}>
              <Text style={sceneMode === 'immersive' ? styles.toolTextImmersive : styles.toolTextLight}>Reset filtre</Text>
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
    backgroundColor: 'transparent'
  },
  topOverlay: {
    position: 'absolute',
    top: theme.spacing.sm,
    left: theme.spacing.sm,
    right: theme.spacing.sm,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center'
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
    gap: 8
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
    paddingVertical: 10
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
    paddingVertical: 10
  },
  bottomLineLight: {
    color: '#1E3A8A',
    fontFamily: theme.font.semiBold,
    fontSize: 12
  },
  bottomLineImmersive: {
    color: '#DBEAFE',
    fontFamily: theme.font.semiBold,
    fontSize: 12
  },
  bottomLineSoftLight: {
    marginTop: 4,
    color: '#64748B',
    fontFamily: theme.font.medium,
    fontSize: 11
  },
  bottomLineSoftImmersive: {
    marginTop: 4,
    color: '#94A3B8',
    fontFamily: theme.font.medium,
    fontSize: 11
  },
  bottomActionsRow: {
    marginTop: 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between'
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
  },
  toolsRow: {
    marginTop: 8,
    flexDirection: 'row',
    gap: 8
  },
  toolButtonLight: {
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#C6D8EE',
    backgroundColor: '#F1F6FD',
    paddingHorizontal: 8,
    paddingVertical: 6
  },
  toolButtonImmersive: {
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(147,197,253,0.35)',
    backgroundColor: 'rgba(10,18,38,0.55)',
    paddingHorizontal: 8,
    paddingVertical: 6
  },
  toolTextLight: {
    color: '#1E3A8A',
    fontFamily: theme.font.semiBold,
    fontSize: 11
  },
  toolTextImmersive: {
    color: '#DBEAFE',
    fontFamily: theme.font.semiBold,
    fontSize: 11
  }
});
