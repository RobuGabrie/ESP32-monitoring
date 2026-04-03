import { MutableRefObject, useEffect, useRef, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { GLView, ExpoWebGLRenderingContext } from 'expo-gl';
import { Renderer } from 'expo-three';
import * as THREE from 'three';
import { theme } from '@/constants/theme';
import type { ImuMotionSample } from '../hooks/useImuQuaternion';

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

interface Props {
  imuQRef?: MutableRefObject<{ x: number; y: number; z: number; w: number }>;
  imuMotionRef?: MutableRefObject<ImuMotionSample>;
  themeMode?: 'light' | 'immersive';
  mobileView?: boolean;
  showHud?: boolean;
  accelX?: number;
  accelY?: number;
  accelZ?: number;
  gyroX?: number;
  gyroY?: number;
  gyroZ?: number;
  dtMs?: number;
  stationary?: boolean;
  q0?: number;
  q1?: number;
  q2?: number;
  q3?: number;
  roll?: number;
  pitch?: number;
  yaw?: number;
  quaternionNorm?: number;
  imuRateHz?: number;
  imuMode?: string;
  motionMode?: string;
  velX?: number;
  velY?: number;
  velZ?: number;
  posX?: number;
  posY?: number;
  posZ?: number;
}

export function IMUCube({
  imuQRef,
  imuMotionRef,
  themeMode = 'light',
  mobileView = false,
  showHud = true,
  accelX = 0,
  accelY = 0,
  accelZ = 0,
  gyroX = 0,
  gyroY = 0,
  gyroZ = 0,
  dtMs = 40,
  stationary = false,
  q0,
  q1,
  q2,
  q3,
  roll,
  pitch,
  yaw,
  quaternionNorm,
  imuRateHz,
  imuMode,
  motionMode,
  velX = 0,
  velY = 0,
  velZ = 0,
  posX,
  posY,
  posZ
}: Props) {
  const targetQuaternionRef = useRef(new THREE.Quaternion());
  const currentQuaternionRef = useRef(new THREE.Quaternion());
  const fusedQuaternionRef = useRef(new THREE.Quaternion());
  const animationFrameRef = useRef<number | null>(null);
  const cubeRef = useRef<THREE.Mesh | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const targetPositionRef = useRef(new THREE.Vector3(0, 0, 0));
  const positionOriginRef = useRef<THREE.Vector3 | null>(null);
  const cleanupRef = useRef<(() => void) | null>(null);
  const quaternionFilteredRef = useRef({ w: 1, x: 0, y: 0, z: 0 });
  const externalQuaternionRef = useRef(new THREE.Quaternion(0, 0, 0, 1));
  const quaternionAlphaRef = useRef(0.18);
  const positionAlphaRef = useRef(0.12);
  const translationGainRef = useRef(1);
  const [renderError, setRenderError] = useState<string | null>(null);

  useEffect(() => {
    const safeDtMs = clamp(Number.isFinite(dtMs) ? dtMs : 40, 8, 120);
    quaternionAlphaRef.current = clamp(safeDtMs / 200, 0.12, 0.22);

    const hasQuaternion = [q0, q1, q2, q3].every((v) => typeof v === 'number' && Number.isFinite(v));

    if (hasQuaternion) {
      const qw = q0 as number;
      const qx = q1 as number;
      const qy = q2 as number;
      const qz = q3 as number;
      const norm = Math.sqrt(qw * qw + qx * qx + qy * qy + qz * qz);

      if (norm > 1e-6) {
        const invNorm = 1 / norm;
        const next = {
          w: qw * invNorm,
          x: qx * invNorm,
          y: qy * invNorm,
          z: qz * invNorm
        };

        const alpha = 0.2;
        quaternionFilteredRef.current = {
          w: quaternionFilteredRef.current.w + alpha * (next.w - quaternionFilteredRef.current.w),
          x: quaternionFilteredRef.current.x + alpha * (next.x - quaternionFilteredRef.current.x),
          y: quaternionFilteredRef.current.y + alpha * (next.y - quaternionFilteredRef.current.y),
          z: quaternionFilteredRef.current.z + alpha * (next.z - quaternionFilteredRef.current.z)
        };

        const filteredNorm = Math.sqrt(
          quaternionFilteredRef.current.w * quaternionFilteredRef.current.w +
            quaternionFilteredRef.current.x * quaternionFilteredRef.current.x +
            quaternionFilteredRef.current.y * quaternionFilteredRef.current.y +
            quaternionFilteredRef.current.z * quaternionFilteredRef.current.z
        );

        if (filteredNorm > 1e-6) {
          targetQuaternionRef.current.set(
            quaternionFilteredRef.current.x / filteredNorm,
            quaternionFilteredRef.current.y / filteredNorm,
            quaternionFilteredRef.current.z / filteredNorm,
            quaternionFilteredRef.current.w / filteredNorm
          );
          return;
        }
      }
    }

    if (
      typeof roll === 'number' &&
      Number.isFinite(roll) &&
      typeof pitch === 'number' &&
      Number.isFinite(pitch) &&
      typeof yaw === 'number' &&
      Number.isFinite(yaw)
    ) {
      const fallbackQuat = new THREE.Quaternion().setFromEuler(
        new THREE.Euler(
          THREE.MathUtils.degToRad(pitch),
          THREE.MathUtils.degToRad(yaw),
          THREE.MathUtils.degToRad(roll),
          'XYZ'
        )
      );
      targetQuaternionRef.current.copy(fallbackQuat).normalize();
      return;
    }

    const dt = safeDtMs / 1000;

    const gyroEuler = new THREE.Euler(
      THREE.MathUtils.degToRad(gyroX) * dt,
      THREE.MathUtils.degToRad(gyroY) * dt,
      THREE.MathUtils.degToRad(gyroZ) * dt,
      'XYZ'
    );
    const gyroDelta = new THREE.Quaternion().setFromEuler(gyroEuler);
    fusedQuaternionRef.current.multiply(gyroDelta).normalize();

    const gravityNorm = Math.sqrt(accelX * accelX + accelY * accelY + accelZ * accelZ);
    if (gravityNorm > 0.0001) {
      const nx = accelX / gravityNorm;
      const ny = accelY / gravityNorm;
      const nz = accelZ / gravityNorm;

      const pitch = Math.atan2(-nx, Math.sqrt(ny * ny + nz * nz));
      const roll = Math.atan2(ny, nz);

      const currentEuler = new THREE.Euler().setFromQuaternion(fusedQuaternionRef.current, 'XYZ');
      const accelQuat = new THREE.Quaternion().setFromEuler(new THREE.Euler(pitch, currentEuler.y, roll, 'XYZ'));
      fusedQuaternionRef.current.slerp(accelQuat, 0.05);
    }

    targetQuaternionRef.current.copy(fusedQuaternionRef.current).normalize();
  }, [accelX, accelY, accelZ, gyroX, gyroY, gyroZ, q0, q1, q2, q3, roll, pitch, yaw, dtMs]);

  useEffect(() => {
    const safeDtMs = clamp(Number.isFinite(dtMs) ? dtMs : 40, 8, 120);
    positionAlphaRef.current = clamp(safeDtMs / 260, 0.06, 0.12);
    translationGainRef.current = mobileView ? 0.95 : 0.9;
    const hasPosition = [posX, posY, posZ].every((v) => typeof v === 'number' && Number.isFinite(v));

    if (hasPosition) {
      const basePosition = new THREE.Vector3(posX as number, posY as number, posZ as number);
      const posMagnitude = basePosition.length();
      const adaptiveBoost = posMagnitude < 0.02 ? 8.5 : posMagnitude < 0.06 ? 4.8 : posMagnitude < 0.12 ? 2.8 : 1.8;
      const currentPosition = basePosition.multiplyScalar(adaptiveBoost);
      if (!positionOriginRef.current) {
        positionOriginRef.current = currentPosition.clone();
      }

      if (positionOriginRef.current) {
        positionOriginRef.current.lerp(currentPosition, stationary ? 0.12 : 0.02);
      }

      const relative = currentPosition.clone().sub(positionOriginRef.current as THREE.Vector3);

      const velocityScale = stationary ? 0.01 : 0.03;
      const velocityContribution = new THREE.Vector3(velX, velY, velZ).multiplyScalar(velocityScale);
      const next = relative.multiplyScalar(stationary ? 0.35 : 1).add(velocityContribution);

      targetPositionRef.current.set(
        clamp(next.x, -1.5, 1.5),
        clamp(next.y, -1.5, 1.5),
        clamp(next.z, -1.5, 1.5)
      );
      return;
    }

    positionOriginRef.current = null;

    // Fallback movement path when position stream is not available.
    const tx = clamp(accelX * 0.8 + velX * 0.05, -1.5, 1.5);
    const ty = clamp(-accelY * 0.8 + velY * 0.05, -1.5, 1.5);
    const tz = clamp((accelZ - 1) * 1.05 + velZ * 0.04, -1.5, 1.5);
    const fallbackPosition = new THREE.Vector3(tx, ty, tz);
    if (stationary) {
      fallbackPosition.multiplyScalar(0.25);
    }
    targetPositionRef.current.copy(fallbackPosition);
  }, [accelX, accelY, accelZ, velX, velY, velZ, posX, posY, posZ, dtMs, stationary, mobileView]);

  useEffect(() => {
    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
      cleanupRef.current?.();
      cleanupRef.current = null;
    };
  }, []);

  const onContextCreate = async (gl: ExpoWebGLRenderingContext) => {
    try {
      setRenderError(null);
      const { drawingBufferWidth: width, drawingBufferHeight: height } = gl;
      const isImmersive = themeMode === 'immersive';
      const scene = new THREE.Scene();
      scene.background = new THREE.Color(isImmersive ? '#07101A' : '#EEF4FA');
      scene.fog = new THREE.Fog(isImmersive ? '#07101A' : '#EEF4FA', 7.2, 18);

      const camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 100);
      const mobileLike = mobileView;
      camera.position.set(0, mobileLike ? 2.62 : 2.22, mobileLike ? 6.7 : 5.1);
      camera.lookAt(0, 0.1, 0);

      const renderer = new Renderer({ gl }) as unknown as THREE.WebGLRenderer;
      renderer.setSize(width, height);
      renderer.setPixelRatio(1);
      rendererRef.current = renderer;

      const ambient = new THREE.AmbientLight(isImmersive ? '#C1D1E7' : '#D8E2EF', isImmersive ? 0.55 : 0.72);
      const key = new THREE.DirectionalLight(isImmersive ? '#F4F8FF' : '#FFFFFF', isImmersive ? 1.08 : 1.18);
      key.position.set(2.8, 4.6, 4.2);
      const fill = new THREE.DirectionalLight(isImmersive ? '#86A2CB' : '#91AACC', isImmersive ? 0.24 : 0.3);
      fill.position.set(-3.4, 2.4, -3.2);
      const rim = new THREE.DirectionalLight(isImmersive ? '#8BB0F0' : '#7FA6E4', isImmersive ? 0.12 : 0.1);
      rim.position.set(0.8, 1.7, -4.8);
      scene.add(ambient, key, fill, rim);

      const prismWidth = mobileLike ? 1.5 : 1.9;
      const prismHeight = mobileLike ? 0.86 : 1.02;
      const prismDepth = mobileLike ? 1.1 : 1.28;
      const geometry = new THREE.BoxGeometry(prismWidth, prismHeight, prismDepth);
      const faceMaterials = [
        new THREE.MeshStandardMaterial({ color: '#468FEA', emissive: '#2F74D9', emissiveIntensity: 0.16, roughness: 0.32, metalness: 0.08 }),
        new THREE.MeshStandardMaterial({ color: '#5BA0F0', emissive: '#3F86E3', emissiveIntensity: 0.15, roughness: 0.32, metalness: 0.08 }),
        new THREE.MeshStandardMaterial({ color: '#74B1F5', emissive: '#5C9EF0', emissiveIntensity: 0.14, roughness: 0.31, metalness: 0.07 }),
        new THREE.MeshStandardMaterial({ color: '#2F79D8', emissive: '#2564BF', emissiveIntensity: 0.15, roughness: 0.33, metalness: 0.08 }),
        new THREE.MeshStandardMaterial({ color: '#8FC2FA', emissive: '#71ADF2', emissiveIntensity: 0.13, roughness: 0.3, metalness: 0.06 }),
        new THREE.MeshStandardMaterial({ color: '#1F66C9', emissive: '#194FA8', emissiveIntensity: 0.14, roughness: 0.34, metalness: 0.08 })
      ];

      const cube = new THREE.Mesh(geometry, faceMaterials);
      cubeRef.current = cube;
      scene.add(cube);

      const edges = new THREE.LineSegments(
        new THREE.EdgesGeometry(geometry),
        new THREE.LineBasicMaterial({ color: '#B7D3FB', transparent: true, opacity: isImmersive ? 0.18 : 0.22 })
      );
      cube.add(edges);

      const originDot = new THREE.Mesh(
        new THREE.SphereGeometry(0.045, 12, 12),
        new THREE.MeshBasicMaterial({ color: isImmersive ? '#DCEAFF' : '#6B93C9' })
      );
      scene.add(originDot);

      const grid = new THREE.GridHelper(6.2, 20, isImmersive ? '#6C97D0' : '#7FA5D6', isImmersive ? '#274C82' : '#C2D7F0');
      grid.position.y = -1.18;
      grid.material.transparent = true;
      (grid.material as THREE.Material).opacity = isImmersive ? 0.22 : 0.28;
      scene.add(grid);

      const gridGlow = new THREE.Mesh(
        new THREE.PlaneGeometry(6.2, 6.2),
        new THREE.MeshBasicMaterial({
          color: isImmersive ? '#16345E' : '#EDF5FE',
          transparent: true,
          opacity: isImmersive ? 0.12 : 0.08,
          side: THREE.DoubleSide,
          depthWrite: false
        })
      );
      gridGlow.rotation.x = -Math.PI / 2;
      gridGlow.position.y = -1.18;
      scene.add(gridGlow);

      const render = () => {
        animationFrameRef.current = requestAnimationFrame(render);
        if (cubeRef.current) {
          const externalQ = imuQRef?.current;
          let hasExternalQuaternion = false;
          if (externalQ) {
            externalQuaternionRef.current.set(externalQ.x, externalQ.y, externalQ.z, externalQ.w).normalize();
            targetQuaternionRef.current.copy(externalQuaternionRef.current);
            hasExternalQuaternion = true;
          }

          const externalMotion = imuMotionRef?.current;
          if (externalMotion) {
            quaternionAlphaRef.current = clamp(externalMotion.dtMs / 180, 0.08, 0.24);
            positionAlphaRef.current = clamp(externalMotion.dtMs / 80, 0.18, 0.34);
            const gain = externalMotion.stationary ? translationGainRef.current * 0.8 : translationGainRef.current;
            targetPositionRef.current.set(
              clamp(externalMotion.x * gain, -1.5, 1.5),
              clamp(externalMotion.y * gain, -1.5, 1.5),
              clamp(externalMotion.z * gain, -1.5, 1.5)
            );
          }

          if (hasExternalQuaternion) {
            // External stream is already time-smoothed in the IMU service, so copy directly to keep latency low.
            currentQuaternionRef.current.copy(targetQuaternionRef.current);
          } else {
            currentQuaternionRef.current.slerp(targetQuaternionRef.current, quaternionAlphaRef.current);
          }
          cubeRef.current.quaternion.copy(currentQuaternionRef.current);
          const positionDelta = cubeRef.current.position.distanceTo(targetPositionRef.current);
          const adaptivePositionAlpha = clamp(positionAlphaRef.current + positionDelta * 0.14, 0.18, 0.45);
          cubeRef.current.position.lerp(targetPositionRef.current, adaptivePositionAlpha);
        }
        renderer.render(scene, camera);
        gl.endFrameEXP();
      };

      render();

      cleanupRef.current = () => {
        if (animationFrameRef.current) {
          cancelAnimationFrame(animationFrameRef.current);
          animationFrameRef.current = null;
        }
        cubeRef.current = null;
        geometry.dispose();
        faceMaterials.forEach((material) => material.dispose());
        (edges.geometry as THREE.BufferGeometry).dispose();
        (edges.material as THREE.Material).dispose();
        (originDot.geometry as THREE.BufferGeometry).dispose();
        (originDot.material as THREE.Material).dispose();
        (gridGlow.geometry as THREE.BufferGeometry).dispose();
        (gridGlow.material as THREE.Material).dispose();
        grid.geometry.dispose();
        (grid.material as THREE.Material).dispose();
        renderer.dispose();
        rendererRef.current = null;
      };
    } catch {
      setRenderError('3D engine failed to initialize');
    }
  };

  return (
    <View style={[styles.container, themeMode === 'immersive' ? styles.containerImmersive : styles.containerLight]}>
      <GLView style={styles.glView} onContextCreate={onContextCreate} />
      <View pointerEvents="none" style={[styles.vignette, themeMode === 'immersive' ? styles.vignetteImmersive : styles.vignetteLight]} />
      {renderError ? (
        <View style={styles.errorOverlay}>
          <Text style={styles.errorTitle}>3D indisponibil</Text>
          <Text style={styles.errorText}>{renderError}</Text>
        </View>
      ) : null}
      {showHud ? (
        <View style={styles.hud}>
          <Text style={styles.hudLine}>
            {`Mod: ${imuMode ?? '--'} | Miscare: ${motionMode ?? '--'}`}
          </Text>
          <Text style={styles.hudLine}>
            {`Rata: ${(imuRateHz ?? 0).toFixed(1)} Hz | dt: ${Math.round(dtMs ?? 0)} ms | Norma q: ${(quaternionNorm ?? 0).toFixed(3)}`}
          </Text>
          <Text style={styles.hudLine}>
            {`Stationary: ${stationary ? 'yes' : 'no'} | Pos: ${clamp(targetPositionRef.current.x, -1.5, 1.5).toFixed(2)}, ${clamp(targetPositionRef.current.y, -1.5, 1.5).toFixed(2)}, ${clamp(targetPositionRef.current.z, -1.5, 1.5).toFixed(2)}`}
          </Text>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    width: '100%',
    overflow: 'hidden',
    position: 'relative'
  },
  containerLight: {
    backgroundColor: '#EFF4FB'
  },
  containerImmersive: {
    backgroundColor: '#030712'
  },
  glView: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 0
  },
  vignette: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 1
  },
  vignetteImmersive: {
    backgroundColor: 'rgba(4, 10, 24, 0.08)'
  },
  vignetteLight: {
    backgroundColor: 'rgba(255, 255, 255, 0.06)'
  },
  errorOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.82)',
    paddingHorizontal: 16,
    zIndex: 3,
    elevation: 3
  },
  errorTitle: {
    ...theme.type.bodyMd,
    color: theme.colors.text,
    fontFamily: theme.font.bold,
    marginBottom: 4
  },
  errorText: {
    ...theme.type.bodySm,
    color: theme.colors.textSoft,
    fontFamily: theme.font.regular,
    textAlign: 'center'
  },
  hud: {
    position: 'absolute',
    left: theme.spacing.sm,
    right: theme.spacing.sm,
    bottom: theme.spacing.sm,
    borderRadius: theme.radius.sm,
    backgroundColor: 'rgba(2, 6, 23, 0.78)',
    paddingHorizontal: theme.spacing.sm,
    paddingVertical: theme.spacing.xs,
    rowGap: 2,
    zIndex: 3,
    elevation: 3
  },
  hudLine: {
    ...theme.type.bodyMd,
    color: theme.accents.neutral,
    fontFamily: theme.font.medium,
    lineHeight: 18
  }
});
