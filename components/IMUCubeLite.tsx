import { MutableRefObject, useEffect, useMemo, useRef, useState } from 'react';
import { LayoutChangeEvent, StyleSheet, View } from 'react-native';
import Svg, { Polygon } from 'react-native-svg';

import type { ImuMotionSample } from '@/hooks/useImuQuaternion';

type Quaternion = { x: number; y: number; z: number; w: number };
type Vec3 = { x: number; y: number; z: number };

type Props = {
  imuQRef?: MutableRefObject<Quaternion>;
  imuMotionRef?: MutableRefObject<ImuMotionSample>;
  themeMode?: 'light' | 'immersive';
  mobileView?: boolean;
};

type FaceDef = {
  key: string;
  indices: [number, number, number, number];
  light: string;
  dark: string;
};

const BASE_VERTICES: Vec3[] = [
  { x: -1, y: -1, z: -1 },
  { x: 1, y: -1, z: -1 },
  { x: 1, y: 1, z: -1 },
  { x: -1, y: 1, z: -1 },
  { x: -1, y: -1, z: 1 },
  { x: 1, y: -1, z: 1 },
  { x: 1, y: 1, z: 1 },
  { x: -1, y: 1, z: 1 }
];

const FACES: FaceDef[] = [
  { key: 'front', indices: [4, 5, 6, 7], light: '#5B8FD6', dark: '#2B4D7D' },
  { key: 'back', indices: [0, 1, 2, 3], light: '#3E6BAF', dark: '#223D63' },
  { key: 'left', indices: [0, 4, 7, 3], light: '#4E7FC3', dark: '#284A77' },
  { key: 'right', indices: [1, 5, 6, 2], light: '#6A9DE0', dark: '#365A8C' },
  { key: 'top', indices: [3, 2, 6, 7], light: '#7BA7E8', dark: '#3B5E8F' },
  { key: 'bottom', indices: [0, 1, 5, 4], light: '#3B669F', dark: '#203753' }
];

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

function rotateByQuaternion(v: Vec3, q: Quaternion): Vec3 {
  const qx = q.x;
  const qy = q.y;
  const qz = q.z;
  const qw = q.w;

  const tx = 2 * (qy * v.z - qz * v.y);
  const ty = 2 * (qz * v.x - qx * v.z);
  const tz = 2 * (qx * v.y - qy * v.x);

  return {
    x: v.x + qw * tx + (qy * tz - qz * ty),
    y: v.y + qw * ty + (qz * tx - qx * tz),
    z: v.z + qw * tz + (qx * ty - qy * tx)
  };
}

function normalizeQuaternion(q: Quaternion): Quaternion {
  const n = Math.hypot(q.x, q.y, q.z, q.w);
  if (n < 1e-6) {
    return { x: 0, y: 0, z: 0, w: 1 };
  }
  return { x: q.x / n, y: q.y / n, z: q.z / n, w: q.w / n };
}

export function IMUCubeLite({ imuQRef, imuMotionRef, themeMode = 'light', mobileView = false }: Props) {
  const [size, setSize] = useState({ width: 300, height: 300 });
  const [frameTick, setFrameTick] = useState(0);
  const smoothMotionRef = useRef({ x: 0, y: 0 });

  useEffect(() => {
    let mounted = true;
    let raf = 0;

    const loop = () => {
      if (!mounted) {
        return;
      }
      setFrameTick((prev) => prev + 1);
      raf = requestAnimationFrame(loop);
    };

    raf = requestAnimationFrame(loop);
    return () => {
      mounted = false;
      if (raf) {
        cancelAnimationFrame(raf);
      }
    };
  }, []);

  const onLayout = (event: LayoutChangeEvent) => {
    const { width, height } = event.nativeEvent.layout;
    if (width > 20 && height > 20) {
      setSize({ width, height });
    }
  };

  const polygons = useMemo(() => {
    void frameTick;

    const q = normalizeQuaternion(imuQRef?.current ?? { x: 0, y: 0, z: 0, w: 1 });
    const motion = imuMotionRef?.current;

    const deadzone = 0.035;
    const rawX = motion?.x ?? 0;
    const rawY = motion?.y ?? 0;
    const targetX = Math.abs(rawX) < deadzone ? 0 : rawX;
    const targetY = Math.abs(rawY) < deadzone ? 0 : rawY;

    // Low-pass + spring-back to prevent long-term position drift in Expo Go fallback.
    smoothMotionRef.current.x = smoothMotionRef.current.x * 0.9 + targetX * 0.1;
    smoothMotionRef.current.y = smoothMotionRef.current.y * 0.9 + targetY * 0.1;

    const stabilizedX = clamp(smoothMotionRef.current.x, -0.34, 0.34);
    const stabilizedY = clamp(smoothMotionRef.current.y, -0.34, 0.34);

    const centerX = size.width / 2 + stabilizedX * 12;
    const centerY = size.height / 2 - stabilizedY * 12;

    const cameraDistance = mobileView ? 5.6 : 4.9;
    const scale = Math.min(size.width, size.height) * (mobileView ? 0.145 : 0.18);

    const rotated = BASE_VERTICES.map((v) => rotateByQuaternion(v, q));
    const projected = rotated.map((v) => {
      const z = v.z + cameraDistance;
      const perspective = cameraDistance / clamp(z, 1.5, 9);
      return {
        x: centerX + v.x * scale * perspective,
        y: centerY - v.y * scale * perspective,
        z: v.z
      };
    });

    return FACES.map((face) => {
      const pts = face.indices.map((i) => projected[i]);
      const avgZ = pts.reduce((acc, p) => acc + p.z, 0) / pts.length;
      return {
        key: face.key,
        points: pts.map((p) => `${p.x.toFixed(2)},${p.y.toFixed(2)}`).join(' '),
        depth: avgZ,
        fill: themeMode === 'immersive' ? face.dark : face.light
      };
    }).sort((a, b) => a.depth - b.depth);
  }, [frameTick, imuMotionRef, imuQRef, mobileView, size.height, size.width, themeMode]);

  return (
    <View style={styles.wrap} onLayout={onLayout}>
      <Svg width="100%" height="100%" viewBox={`0 0 ${size.width} ${size.height}`}>
        {polygons.map((poly) => (
          <Polygon
            key={poly.key}
            points={poly.points}
            fill={poly.fill}
            stroke={themeMode === 'immersive' ? '#9FB9E0' : '#A8C1E3'}
            strokeWidth={1.3}
          />
        ))}
      </Svg>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    ...StyleSheet.absoluteFillObject
  }
});
