import { useEffect, useRef } from 'react';
import { Animated, View, StyleSheet, Text } from 'react-native';
import { theme } from '@/constants/theme';

interface Props {
  accelX?: number;
  accelY?: number;
  accelZ?: number;
  gyroX?: number;
  gyroY?: number;
  gyroZ?: number;
}

export function IMUCube({
  accelX = 0,
  accelY = 0,
  accelZ = 0,
  gyroX = 0,
  gyroY = 0,
  gyroZ = 0
}: Props) {
  const rotateRef = useRef(new Animated.Value(0)).current;
  const tiltRef = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    // Use gyro for rotation, fallback to accel
    const targetRotate = (gyroZ || 0) * 5 + (gyroX || 0) * 2;
    const targetTilt = (gyroY || accelY * 10) * 2;

    Animated.parallel([
      Animated.timing(rotateRef, {
        toValue: targetRotate,
        duration: 100,
        useNativeDriver: true
      }),
      Animated.timing(tiltRef, {
        toValue: targetTilt,
        duration: 150,
        useNativeDriver: true
      })
    ]).start();
  }, [accelX, accelY, accelZ, gyroX, gyroY, gyroZ, rotateRef, tiltRef]);

  const rotate = rotateRef.interpolate({
    inputRange: [-360, 360],
    outputRange: ['-360deg', '360deg']
  });

  const tilt = tiltRef.interpolate({
    inputRange: [-360, 360],
    outputRange: ['-360deg', '360deg']
  });

  return (
    <View style={styles.container}>
      <View style={styles.sceneContainer}>
        {/* Outer frame for perspective */}
        <Animated.View
          style={[
            styles.outerFrame,
            {
              transform: [{ perspective: 1000 }, { rotateY: tilt }]
            }
          ]}
        >
          {/* Rotating cube */}
          <Animated.View
            style={[
              styles.cube,
              {
                transform: [{ perspective: 800 }, { rotateZ: rotate }]
              }
            ]}
          >
            {/* Front face with gradient */}
            <View style={[styles.face, styles.front]}>
              <View style={styles.faceLabel}>
                <Text style={styles.faceText}>FRONT</Text>
              </View>
            </View>

            {/* Rotated squares behind for depth */}
            <View style={[styles.backFace, styles.backFace1]} />
            <View style={[styles.backFace, styles.backFace2]} />
          </Animated.View>
        </Animated.View>
      </View>

      {/* Sensor readings */}
      <View style={styles.dataPanel}>
        <View style={styles.sensorRow}>
          <View style={styles.sensorCol}>
            <Text style={styles.sensorLabel}>Accel</Text>
            <Text style={styles.sensorValue}>
              {`X: ${(accelX ?? 0).toFixed(2)}g`}
            </Text>
            <Text style={styles.sensorValue}>
              {`Y: ${(accelY ?? 0).toFixed(2)}g`}
            </Text>
            <Text style={styles.sensorValue}>
              {`Z: ${(accelZ ?? 0).toFixed(2)}g`}
            </Text>
          </View>
          <View style={styles.divider} />
          <View style={styles.sensorCol}>
            <Text style={styles.sensorLabel}>Gyro</Text>
            <Text style={styles.sensorValue}>
              {`X: ${(gyroX ?? 0).toFixed(2)}°/s`}
            </Text>
            <Text style={styles.sensorValue}>
              {`Y: ${(gyroY ?? 0).toFixed(2)}°/s`}
            </Text>
            <Text style={styles.sensorValue}>
              {`Z: ${(gyroZ ?? 0).toFixed(2)}°/s`}
            </Text>
          </View>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: '100%',
    alignItems: 'center',
    gap: 16
  },
  sceneContainer: {
    width: 280,
    height: 280,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.colors.card,
    borderRadius: theme.radius.lg,
    borderWidth: 1,
    borderColor: '#E6EBF2',
    ...theme.shadow.floating,
    overflow: 'hidden'
  },
  outerFrame: {
    width: '100%',
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center'
  },
  cube: {
    width: 140,
    height: 140,
    position: 'relative'
  },
  face: {
    position: 'absolute',
    width: 140,
    height: 140,
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.4)',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(37, 99, 235, 0.9)'
  },
  front: {
    top: 0,
    left: 0,
    zIndex: 10
  },
  faceLabel: {
    alignItems: 'center'
  },
  faceText: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 14,
    fontFamily: theme.font.bold,
    fontWeight: '700'
  },
  backFace: {
    position: 'absolute',
    width: 140,
    height: 140,
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.2)'
  },
  backFace1: {
    top: 6,
    left: 6,
    backgroundColor: 'rgba(59, 130, 246, 0.6)',
    zIndex: 5
  },
  backFace2: {
    top: 12,
    left: 12,
    backgroundColor: 'rgba(96, 165, 250, 0.4)',
    zIndex: 2
  },
  dataPanel: {
    width: '100%',
    backgroundColor: theme.colors.card,
    borderRadius: theme.radius.lg,
    borderWidth: 1,
    borderColor: '#E6EBF2',
    padding: 12,
    ...theme.shadow.card
  },
  sensorRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start'
  },
  sensorCol: {
    flex: 1
  },
  divider: {
    width: 1,
    height: 80,
    backgroundColor: '#E6EBF2',
    marginHorizontal: 12
  },
  sensorLabel: {
    color: theme.colors.muted,
    fontFamily: theme.font.semiBold,
    fontSize: 11,
    marginBottom: 6,
    textTransform: 'uppercase',
    letterSpacing: 0.5
  },
  sensorValue: {
    color: theme.colors.text,
    fontFamily: 'JetBrainsMono_400Regular',
    fontSize: 11,
    marginBottom: 4,
    lineHeight: 16
  }
});
