import { MutableRefObject, useEffect, useRef, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { GLView, ExpoWebGLRenderingContext } from 'expo-gl';
import { Renderer } from 'expo-three';
import * as THREE from 'three';
import { theme } from '@/constants/theme';
import type { ImuMotionSample } from '../hooks/useImuQuaternion';

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

const createShadowTexture = (size = 128) => {
  const data = new Uint8Array(size * size * 4);
  const half = size / 2;

  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      const dx = (x - half) / half;
      const dy = (y - half) / half;
      const edgeDistance = Math.max(Math.abs(dx), Math.abs(dy));
      const alpha = clamp(1 - edgeDistance, 0, 1);
      const softened = alpha * alpha * 0.9;
      const idx = (y * size + x) * 4;

      data[idx] = 12;
      data[idx + 1] = 18;
      data[idx + 2] = 32;
      data[idx + 3] = Math.round(softened * 255);
    }
  }

  const texture = new THREE.DataTexture(data, size, size, THREE.RGBAFormat);
  texture.needsUpdate = true;
  return texture;
};

interface Props {
  imuQRef?: MutableRefObject<{ x: number; y: number; z: number; w: number }>;
  imuMotionRef?: MutableRefObject<ImuMotionSample>;
  themeMode?: 'light' | 'immersive';
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
    positionAlphaRef.current = clamp(safeDtMs / 300, 0.08, 0.16);
    const hasPosition = [posX, posY, posZ].every((v) => typeof v === 'number' && Number.isFinite(v));

    if (hasPosition) {
      const visualScale = 0.2;
      const currentPosition = new THREE.Vector3(posX as number, posY as number, posZ as number).multiplyScalar(visualScale);
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
  }, [accelX, accelY, accelZ, velX, velY, velZ, posX, posY, posZ, dtMs, stationary]);

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
      scene.background = new THREE.Color(isImmersive ? '#070F1D' : '#EEF4FB');
      scene.fog = new THREE.Fog(isImmersive ? '#070F1D' : '#EEF4FB', 6.5, 15);

      const camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 100);
      camera.position.set(0, 2.35, 4.25);
      camera.lookAt(0, 0, 0);

      const renderer = new Renderer({ gl }) as unknown as THREE.WebGLRenderer;
      renderer.setSize(width, height);
      renderer.setPixelRatio(1);
      rendererRef.current = renderer;

      const ambient = new THREE.AmbientLight(isImmersive ? '#9FB2D6' : '#B7C7DE', isImmersive ? 0.4 : 0.58);
      const key = new THREE.DirectionalLight(isImmersive ? '#EAF1FF' : '#FFFFFF', isImmersive ? 1.05 : 1.12);
      key.position.set(2.4, 4.2, 3.2);
      const fill = new THREE.DirectionalLight(isImmersive ? '#7F9CC9' : '#8EA9D3', isImmersive ? 0.34 : 0.4);
      fill.position.set(-2.5, 2.2, -2.4);
      scene.add(ambient, key, fill);

      const geometry = new THREE.BoxGeometry(1.55, 1.55, 1.55);
      const faceMaterials = [
        new THREE.MeshStandardMaterial({ color: isImmersive ? '#2A5FAF' : '#3E73C8', roughness: 0.34, metalness: 0.14 }),
        new THREE.MeshStandardMaterial({ color: isImmersive ? '#2E66BA' : '#4A7FD0', roughness: 0.34, metalness: 0.14 }),
        new THREE.MeshStandardMaterial({ color: isImmersive ? '#24559E' : '#3569BB', roughness: 0.36, metalness: 0.12 }),
        new THREE.MeshStandardMaterial({ color: isImmersive ? '#356FC5' : '#5A8CD9', roughness: 0.32, metalness: 0.14 }),
        new THREE.MeshStandardMaterial({ color: isImmersive ? '#224D92' : '#345FA9', roughness: 0.38, metalness: 0.1 }),
        new THREE.MeshStandardMaterial({ color: isImmersive ? '#4B80CF' : '#6B9BE2', roughness: 0.3, metalness: 0.12 })
      ];

      const cube = new THREE.Mesh(geometry, faceMaterials);
      cubeRef.current = cube;
      scene.add(cube);

      const edges = new THREE.LineSegments(
        new THREE.EdgesGeometry(geometry),
        new THREE.LineBasicMaterial({ color: isImmersive ? '#D7E4FB' : '#A4BCDB', transparent: true, opacity: isImmersive ? 0.14 : 0.22 })
      );
      cube.add(edges);

      const floor = new THREE.Mesh(
        new THREE.PlaneGeometry(4.1, 4.1),
        new THREE.MeshStandardMaterial({ color: isImmersive ? '#0D1A30' : '#DCE8F6', roughness: 0.92, metalness: 0.06, transparent: true, opacity: isImmersive ? 0.96 : 0.98 })
      );
      floor.rotation.x = -Math.PI / 2;
      floor.position.y = -1.12;
      scene.add(floor);

      const deckFrame = new THREE.LineSegments(
        new THREE.EdgesGeometry(new THREE.PlaneGeometry(4.1, 4.1)),
        new THREE.LineBasicMaterial({ color: isImmersive ? '#5D7FAF' : '#9BB4D5', transparent: true, opacity: isImmersive ? 0.22 : 0.28 })
      );
      deckFrame.rotation.x = -Math.PI / 2;
      deckFrame.position.y = -1.115;
      scene.add(deckFrame);

      const shadowTexture = createShadowTexture(160);
      const shadow = new THREE.Mesh(
        new THREE.PlaneGeometry(1.9, 1.2),
        new THREE.MeshBasicMaterial({ map: shadowTexture, transparent: true, opacity: isImmersive ? 0.34 : 0.22, depthWrite: false })
      );
      shadow.rotation.x = -Math.PI / 2;
      shadow.position.y = -1.108;
      scene.add(shadow);

      const grid = new THREE.GridHelper(4.4, 8, isImmersive ? '#243A5E' : '#A9BDDA', isImmersive ? '#15243D' : '#C4D3E8');
      grid.position.y = -1.12;
      grid.material.transparent = true;
      (grid.material as THREE.Material).opacity = isImmersive ? 0.09 : 0.24;
      scene.add(grid);

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
            positionAlphaRef.current = clamp(externalMotion.dtMs / 220, 0.08, 0.22);
            targetPositionRef.current.set(
              clamp(externalMotion.x, -1.5, 1.5),
              clamp(externalMotion.y, -1.5, 1.5),
              clamp(externalMotion.z, -1.5, 1.5)
            );
          }

          if (hasExternalQuaternion) {
            // External stream is already time-smoothed in the IMU service, so copy directly to keep latency low.
            currentQuaternionRef.current.copy(targetQuaternionRef.current);
          } else {
            currentQuaternionRef.current.slerp(targetQuaternionRef.current, quaternionAlphaRef.current);
          }
          cubeRef.current.quaternion.copy(currentQuaternionRef.current);
          cubeRef.current.position.lerp(targetPositionRef.current, positionAlphaRef.current);
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
        (floor.geometry as THREE.BufferGeometry).dispose();
        (floor.material as THREE.Material).dispose();
        (deckFrame.geometry as THREE.BufferGeometry).dispose();
        (deckFrame.material as THREE.Material).dispose();
        shadowTexture.dispose();
        (shadow.geometry as THREE.BufferGeometry).dispose();
        (shadow.material as THREE.Material).dispose();
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
    <View style={styles.container}>
      <GLView style={styles.glView} onContextCreate={onContextCreate} />
      <View style={[styles.vignette, themeMode === 'immersive' ? styles.vignetteImmersive : styles.vignetteLight]} />
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
    overflow: 'hidden'
  },
  glView: {
    flex: 1
  },
  vignette: {
    ...StyleSheet.absoluteFillObject
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
    paddingHorizontal: 16
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
    rowGap: 2
  },
  hudLine: {
    ...theme.type.bodyMd,
    color: theme.accents.neutral,
    fontFamily: theme.font.medium,
    lineHeight: 18
  }
});
