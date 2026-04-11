import { useCallback, useEffect, useRef, useState } from 'react';

type Q = { x: number; y: number; z: number; w: number };
type V3 = { x: number; y: number; z: number };

export type ImuWsStatus =
  | 'idle'
  | 'connecting'
  | 'connected'
  | 'stale'
  | 'reconnecting'
  | 'disconnected'
  | 'offline'
  | 'error';

export type ImuAxisMapping = {
  flipX?: boolean;
  flipY?: boolean;
  flipZ?: boolean;
  swapXY?: boolean;
  swapYZ?: boolean;
  swapXZ?: boolean;
};

export type ImuAxisPreset = 'default' | 'invert-yaw' | 'invert-z' | 'swap-yz';

export type ImuMotionSample = {
  x: number;
  y: number;
  z: number;
  dtMs: number;
  stationary: boolean;
  timestamp: number;
};

export type ImuDerivedEuler = {
  roll: number;
  pitch: number;
  yaw: number;
};

export type ImuStats = {
  hz: number;
  dropped: number;
  parseErrors: number;
  outliers: number;
  jitterMs: number;
  lastFrameTs: number;
  frameAgeMs: number;
};

export type ImuLogEvent = {
  ts: number;
  level: 'info' | 'warn' | 'error';
  message: string;
};

type ImuFrameSample = {
  timestamp: number;
  dtMs: number;
  quaternion: Q;
  quaternionNorm: number;
  stationary: boolean;
  position: V3;
  velocity: V3;
};

// IMU stream world frame: x=right, y=forward, z=up.
// Scene frame (Three): x=right, y=up, z=towards camera (forward is -z).
const mapImuWorldToScene = (v: V3): V3 => ({
  x: v.y,
  y: v.z,
  z: v.x
});

const POSITION_VISUAL_GAIN = 12;
const VELOCITY_VISUAL_GAIN = 0.8;
const LINEAR_ACCEL_VISUAL_GAIN = 0;

type Options = {
  maxBufferedFrames?: number;
  heartbeatMs?: number;
  staleAfterMs?: number;
  disconnectAfterMs?: number;
  reconnectBaseMs?: number;
  reconnectMaxMs?: number;
  maxAngularJumpDeg?: number;
};

const clamp = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v));

const softDeadzone = (value: number, threshold: number) => {
  const abs = Math.abs(value);
  if (abs <= threshold) {
    return 0;
  }
  const sign = Math.sign(value);
  const normalized = (abs - threshold) / (1 - threshold);
  return sign * normalized;
};

const normalizeQ = (q: Q): Q => {
  const n = Math.hypot(q.x, q.y, q.z, q.w) || 1;
  return { x: q.x / n, y: q.y / n, z: q.z / n, w: q.w / n };
};

const dotQ = (a: Q, b: Q) => a.x * b.x + a.y * b.y + a.z * b.z + a.w * b.w;

const mulQ = (a: Q, b: Q): Q => ({
  w: a.w * b.w - a.x * b.x - a.y * b.y - a.z * b.z,
  x: a.w * b.x + a.x * b.w + a.y * b.z - a.z * b.y,
  y: a.w * b.y - a.x * b.z + a.y * b.w + a.z * b.x,
  z: a.w * b.z + a.x * b.y - a.y * b.x + a.z * b.w
});

const invertUnitQ = (q: Q): Q => ({ x: -q.x, y: -q.y, z: -q.z, w: q.w });

const averageQuaternions = (samples: Q[]): Q => {
  if (!samples.length) {
    return { x: 0, y: 0, z: 0, w: 1 };
  }

  const reference = samples[0];
  let sx = 0;
  let sy = 0;
  let sz = 0;
  let sw = 0;

  for (const sample of samples) {
    const aligned = dotQ(reference, sample) < 0
      ? { x: -sample.x, y: -sample.y, z: -sample.z, w: -sample.w }
      : sample;
    sx += aligned.x;
    sy += aligned.y;
    sz += aligned.z;
    sw += aligned.w;
  }

  return normalizeQ({ x: sx, y: sy, z: sz, w: sw });
};

const slerpQ = (a: Q, b: Q, t: number): Q => {
  let bx = b.x;
  let by = b.y;
  let bz = b.z;
  let bw = b.w;

  let cosHalfTheta = dotQ(a, b);
  if (cosHalfTheta < 0) {
    cosHalfTheta = -cosHalfTheta;
    bx = -bx;
    by = -by;
    bz = -bz;
    bw = -bw;
  }

  if (cosHalfTheta > 0.9995) {
    return normalizeQ({
      x: a.x + t * (bx - a.x),
      y: a.y + t * (by - a.y),
      z: a.z + t * (bz - a.z),
      w: a.w + t * (bw - a.w)
    });
  }

  const halfTheta = Math.acos(clamp(cosHalfTheta, -1, 1));
  const sinHalfTheta = Math.sqrt(1 - cosHalfTheta * cosHalfTheta);
  if (Math.abs(sinHalfTheta) < 0.001) {
    return normalizeQ({
      x: (a.x + bx) * 0.5,
      y: (a.y + by) * 0.5,
      z: (a.z + bz) * 0.5,
      w: (a.w + bw) * 0.5
    });
  }

  const ratioA = Math.sin((1 - t) * halfTheta) / sinHalfTheta;
  const ratioB = Math.sin(t * halfTheta) / sinHalfTheta;
  return {
    x: a.x * ratioA + bx * ratioB,
    y: a.y * ratioA + by * ratioB,
    z: a.z * ratioA + bz * ratioB,
    w: a.w * ratioA + bw * ratioB
  };
};

const toFinite = (value: unknown): number | null => {
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

const toBoolean = (value: unknown): boolean | null => {
  if (typeof value === 'boolean') {
    return value;
  }
  if (typeof value === 'number') {
    return value !== 0;
  }
  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase();
    if (normalized === '1' || normalized === 'true' || normalized === 'yes') {
      return true;
    }
    if (normalized === '0' || normalized === 'false' || normalized === 'no') {
      return false;
    }
  }
  return null;
};

const pickNumber = (source: Record<string, unknown>, keys: string[]) => {
  for (const key of keys) {
    const parsed = toFinite(source[key]);
    if (parsed !== null) {
      return parsed;
    }
  }
  return null;
};

const presetToMapping = (preset: ImuAxisPreset): ImuAxisMapping => {
  if (preset === 'invert-yaw') {
    return { flipZ: true };
  }
  if (preset === 'invert-z') {
    return { flipZ: true };
  }
  if (preset === 'swap-yz') {
    return { swapYZ: true };
  }
  return {};
};

const applyAxisMapping = (q: Q, mapping: ImuAxisMapping): Q => {
  let next = { ...q };
  if (mapping.swapXY) {
    next = { ...next, x: next.y, y: next.x };
  }
  if (mapping.swapXZ) {
    next = { ...next, x: next.z, z: next.x };
  }
  if (mapping.swapYZ) {
    next = { ...next, y: next.z, z: next.y };
  }
  if (mapping.flipX) {
    next.x *= -1;
  }
  if (mapping.flipY) {
    next.y *= -1;
  }
  if (mapping.flipZ) {
    next.z *= -1;
  }
  return normalizeQ(next);
};

const quaternionToEuler = (q: Q): ImuDerivedEuler => {
  const sinrCosp = 2 * (q.w * q.x + q.y * q.z);
  const cosrCosp = 1 - 2 * (q.x * q.x + q.y * q.y);
  const roll = Math.atan2(sinrCosp, cosrCosp);

  const sinp = 2 * (q.w * q.y - q.z * q.x);
  const pitch = Math.abs(sinp) >= 1 ? Math.sign(sinp) * Math.PI / 2 : Math.asin(sinp);

  const sinyCosp = 2 * (q.w * q.z + q.x * q.y);
  const cosyCosp = 1 - 2 * (q.y * q.y + q.z * q.z);
  const yaw = Math.atan2(sinyCosp, cosyCosp);

  return {
    roll: (roll * 180) / Math.PI,
    pitch: (pitch * 180) / Math.PI,
    yaw: (yaw * 180) / Math.PI
  };
};

export function useImuQuaternion(initialWsUrl: string, options: Options = {}) {
  const {
    maxBufferedFrames = 120,
    heartbeatMs = 120,
    staleAfterMs = 500,
    disconnectAfterMs = 2000,
    reconnectBaseMs = 500,
    reconnectMaxMs = 8000,
    maxAngularJumpDeg = 120
  } = options;

  const [activeUrl, setActiveUrl] = useState(initialWsUrl);
  const [connectionStatus, setConnectionStatus] = useState<ImuWsStatus>('idle');

  const quaternionRef = useRef<Q>({ x: 0, y: 0, z: 0, w: 1 });
  const filteredEulerRef = useRef<ImuDerivedEuler>({ roll: 0, pitch: 0, yaw: 0 });
  const rawFrameRef = useRef<Record<string, unknown> | null>(null);
  const motionRef = useRef<ImuMotionSample>({ x: 0, y: 0, z: 0, dtMs: 16, stationary: true, timestamp: Date.now() });
  const frameBufferRef = useRef<ImuFrameSample[]>([]);
  const eventLogRef = useRef<ImuLogEvent[]>([]);

  const statsRef = useRef<ImuStats>({
    hz: 0,
    dropped: 0,
    parseErrors: 0,
    outliers: 0,
    jitterMs: 0,
    lastFrameTs: 0,
    frameAgeMs: 0
  });

  const prevIncomingQRef = useRef<Q>({ x: 0, y: 0, z: 0, w: 1 });
  const prevOutputQRef = useRef<Q>({ x: 0, y: 0, z: 0, w: 1 });
  const posOriginRef = useRef<V3 | null>(null);
  const lastPosSceneRef = useRef<V3 | null>(null);
  const lastRawPosRef = useRef<V3>({ x: 0, y: 0, z: 0 });
  const velocityRef = useRef<V3>({ x: 0, y: 0, z: 0 });
  const motionFilteredRef = useRef<V3>({ x: 0, y: 0, z: 0 });
  const stationaryFramesRef = useRef(0);
  const stationaryVotesRef = useRef(0);
  const stationaryDebouncedRef = useRef(true);
  const startupFramesRef = useRef(0);

  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const heartbeatTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const reconnectAttemptRef = useRef(0);
  const shouldReconnectRef = useRef(true);
  const lastMessageAtRef = useRef(0);
  const frameTimesRef = useRef<number[]>([]);
  const frameDeltasRef = useRef<number[]>([]);
  const yawOffsetDegRef = useRef(0);
  const frozenRef = useRef(false);
  // Calibrated profile for current board mount:
  // x' = y, y' = z, z' = x  (preserves yaw that is currently correct, fixes roll/pitch pairing).
  const axisMappingRef = useRef<ImuAxisMapping>({ swapXY: true, swapYZ: true });
  const orientationOffsetRef = useRef<Q>({ x: 0, y: 0, z: 0, w: 1 });
  const autoLevelPendingRef = useRef(true);
  const calibrationSamplesRef = useRef<Q[]>([]);
  const lastFrameCounterRef = useRef<number | null>(null);

  useEffect(() => {
    setActiveUrl((prev) => (prev === initialWsUrl ? prev : initialWsUrl));
  }, [initialWsUrl]);

  const pushEvent = useCallback((level: 'info' | 'warn' | 'error', message: string) => {
    const next = eventLogRef.current;
    next.push({ ts: Date.now(), level, message });
    if (next.length > 300) {
      next.shift();
    }
  }, []);

  const setStatus = useCallback((next: ImuWsStatus) => {
    setConnectionStatus((prev) => {
      if (prev !== next) {
        pushEvent(next === 'error' ? 'error' : next === 'stale' ? 'warn' : 'info', `status:${next}`);
      }
      return next;
    });
  }, [pushEvent]);

  const recenterPosition = useCallback(() => {
    posOriginRef.current = {
      x: lastRawPosRef.current.x,
      y: lastRawPosRef.current.y,
      z: lastRawPosRef.current.z
    };
    lastPosSceneRef.current = {
      x: lastRawPosRef.current.x,
      y: lastRawPosRef.current.y,
      z: lastRawPosRef.current.z
    };
    velocityRef.current = { x: 0, y: 0, z: 0 };
    stationaryVotesRef.current = 0;
    stationaryDebouncedRef.current = true;
    motionRef.current = {
      ...motionRef.current,
      x: 0,
      y: 0,
      z: 0,
      timestamp: Date.now()
    };
    pushEvent('info', 'recenter-position');
  }, [pushEvent]);

  const recalibrateOrientation = useCallback(() => {
    // Recalibrate using the next valid IMU frame to avoid sampling stale/zero data.
    autoLevelPendingRef.current = true;
    orientationOffsetRef.current = { x: 0, y: 0, z: 0, w: 1 };
    calibrationSamplesRef.current = [];
    prevIncomingQRef.current = { x: 0, y: 0, z: 0, w: 1 };
    prevOutputQRef.current = { x: 0, y: 0, z: 0, w: 1 };
    quaternionRef.current = { x: 0, y: 0, z: 0, w: 1 };
    filteredEulerRef.current = { roll: 0, pitch: 0, yaw: 0 };
    yawOffsetDegRef.current = 0;
    pushEvent('info', 'recalibrate-orientation-pending');
  }, [pushEvent]);

  const recenterYaw = useCallback(() => {
    const current = quaternionToEuler(prevOutputQRef.current);
    yawOffsetDegRef.current = -current.yaw;
    pushEvent('info', `recenter-yaw:${current.yaw.toFixed(1)}`);
  }, [pushEvent]);

  const setAxisMapping = useCallback((mappingOrPreset: ImuAxisMapping | ImuAxisPreset) => {
    axisMappingRef.current = typeof mappingOrPreset === 'string' ? presetToMapping(mappingOrPreset) : mappingOrPreset;
    pushEvent('info', 'axis-mapping-updated');
  }, [pushEvent]);

  const setFrozen = useCallback((next: boolean) => {
    frozenRef.current = next;
    pushEvent('info', next ? 'freeze-stream' : 'unfreeze-stream');
  }, [pushEvent]);

  const resetFilters = useCallback(() => {
    prevIncomingQRef.current = { x: 0, y: 0, z: 0, w: 1 };
    prevOutputQRef.current = { x: 0, y: 0, z: 0, w: 1 };
    quaternionRef.current = { x: 0, y: 0, z: 0, w: 1 };
    yawOffsetDegRef.current = 0;
    orientationOffsetRef.current = { x: 0, y: 0, z: 0, w: 1 };
    autoLevelPendingRef.current = true;
    statsRef.current.outliers = 0;
    pushEvent('info', 'reset-filters');
  }, [pushEvent]);

  const disconnectImu = useCallback(() => {
    shouldReconnectRef.current = false;
    if (reconnectTimerRef.current) {
      clearTimeout(reconnectTimerRef.current);
      reconnectTimerRef.current = null;
    }
    if (heartbeatTimerRef.current) {
      clearInterval(heartbeatTimerRef.current);
      heartbeatTimerRef.current = null;
    }
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }
    setStatus('disconnected');
  }, [setStatus]);

  const connectImu = useCallback((url: string) => {
    shouldReconnectRef.current = true;
    setActiveUrl(url);
  }, []);

  useEffect(() => {
    if (!activeUrl) {
      setStatus('offline');
      return undefined;
    }

    shouldReconnectRef.current = true;

    const clearTimers = () => {
      if (reconnectTimerRef.current) {
        clearTimeout(reconnectTimerRef.current);
        reconnectTimerRef.current = null;
      }
      if (heartbeatTimerRef.current) {
        clearInterval(heartbeatTimerRef.current);
        heartbeatTimerRef.current = null;
      }
    };

    const scheduleReconnect = () => {
      if (!shouldReconnectRef.current) {
        return;
      }
      const attempt = reconnectAttemptRef.current;
      const backoff = Math.min(reconnectMaxMs, reconnectBaseMs * 2 ** attempt);
      const jitter = Math.floor(Math.random() * 180);
      reconnectAttemptRef.current += 1;
      setStatus('reconnecting');
      reconnectTimerRef.current = setTimeout(connect, backoff + jitter);
    };

    const handleMessage = (rawData: unknown) => {
      if (typeof rawData !== 'string') {
        return;
      }

      let payload: unknown;
      try {
        payload = JSON.parse(rawData);
      } catch {
        statsRef.current.parseErrors += 1;
        return;
      }

      if (!payload || typeof payload !== 'object') {
        statsRef.current.parseErrors += 1;
        return;
      }

      const frame = payload as Record<string, unknown>;
      rawFrameRef.current = frame;

      const frameNo = toFinite(frame.frame);
      if (frameNo !== null) {
        if (lastFrameCounterRef.current !== null && frameNo < lastFrameCounterRef.current) {
          statsRef.current.dropped += 1;
          return;
        }
        if (lastFrameCounterRef.current !== null && frameNo > lastFrameCounterRef.current + 1) {
          statsRef.current.dropped += frameNo - lastFrameCounterRef.current - 1;
        }
        lastFrameCounterRef.current = frameNo;
      }

      const now = Date.now();
      lastMessageAtRef.current = now;
      statsRef.current.lastFrameTs = now;

      frameTimesRef.current.push(now);
      while (frameTimesRef.current.length && now - frameTimesRef.current[0] > 1000) {
        frameTimesRef.current.shift();
      }
      statsRef.current.hz = frameTimesRef.current.length;

      if (frameTimesRef.current.length >= 2) {
        const dt = frameTimesRef.current[frameTimesRef.current.length - 1] - frameTimesRef.current[frameTimesRef.current.length - 2];
        frameDeltasRef.current.push(dt);
        if (frameDeltasRef.current.length > 40) {
          frameDeltasRef.current.shift();
        }
        const avg = frameDeltasRef.current.reduce((acc, v) => acc + v, 0) / frameDeltasRef.current.length;
        const variance = frameDeltasRef.current.reduce((acc, v) => acc + (v - avg) * (v - avg), 0) / frameDeltasRef.current.length;
        statsRef.current.jitterMs = Math.sqrt(variance);
      }

      const imu = (frame.imu && typeof frame.imu === 'object' ? frame.imu : frame) as Record<string, unknown>;
      const dtMsValue = clamp(
        pickNumber(imu, ['dt_ms', 'dtMs', 'dt']) ?? pickNumber(frame, ['dt_ms', 'dtMs', 'dt']) ?? 16,
        4,
        120
      );
      const dtSec = dtMsValue / 1000;

      const stationaryFlag = toBoolean(imu.stationary) ?? toBoolean(frame.stationary) ?? false;
      const zuptFlag = toBoolean(imu.zupt) ?? toBoolean(frame.zupt) ?? false;
      const stationaryCandidate = stationaryFlag || zuptFlag;
      stationaryVotesRef.current = clamp(stationaryVotesRef.current + (stationaryCandidate ? 1 : -1), -6, 6);
      if (stationaryVotesRef.current >= 1) {
        stationaryDebouncedRef.current = true;
      } else if (stationaryVotesRef.current <= -1) {
        stationaryDebouncedRef.current = false;
      }
      const stationary = stationaryDebouncedRef.current;
      startupFramesRef.current += 1;
      const warmupActive = startupFramesRef.current < 14;

      const posXRaw = pickNumber(imu, ['pos_x', 'posX']) ?? pickNumber(frame, ['pos_x', 'posX']);
      const posYRaw = pickNumber(imu, ['pos_y', 'posY']) ?? pickNumber(frame, ['pos_y', 'posY']);
      const posZRaw = pickNumber(imu, ['pos_z', 'posZ']) ?? pickNumber(frame, ['pos_z', 'posZ']);
      const hasPosStream = posXRaw !== null && posYRaw !== null && posZRaw !== null;

      const posImu: V3 = {
        x: posXRaw ?? 0,
        y: posYRaw ?? 0,
        z: posZRaw ?? 0
      };
      let pos = mapImuWorldToScene(posImu);
      if (lastPosSceneRef.current) {
        const maxPosJumpPerFrame = clamp((dtMsValue / 1000) * (stationary ? 1.0 : 5.0), 0.03, 0.22);
        const dx = pos.x - lastPosSceneRef.current.x;
        const dy = pos.y - lastPosSceneRef.current.y;
        const dz = pos.z - lastPosSceneRef.current.z;
        const jump = Math.hypot(dx, dy, dz);
        if (jump > maxPosJumpPerFrame && jump > 1e-6) {
          const t = maxPosJumpPerFrame / jump;
          pos = {
            x: lastPosSceneRef.current.x + dx * t,
            y: lastPosSceneRef.current.y + dy * t,
            z: lastPosSceneRef.current.z + dz * t
          };
        }
      }
      lastPosSceneRef.current = pos;
      lastRawPosRef.current = pos;

      if (warmupActive) {
        if (hasPosStream) {
          posOriginRef.current = { ...pos };
        }
        velocityRef.current = { x: 0, y: 0, z: 0 };
        motionFilteredRef.current = { x: 0, y: 0, z: 0 };
        stationaryFramesRef.current = 0;
        motionRef.current = {
          x: 0,
          y: 0,
          z: 0,
          dtMs: dtMsValue,
          stationary: true,
          timestamp: now
        };
      }

      const velXRaw = pickNumber(imu, ['vel_x', 'velX']) ?? pickNumber(frame, ['vel_x', 'velX']);
      const velYRaw = pickNumber(imu, ['vel_y', 'velY']) ?? pickNumber(frame, ['vel_y', 'velY']);
      const velZRaw = pickNumber(imu, ['vel_z', 'velZ']) ?? pickNumber(frame, ['vel_z', 'velZ']);
      const hasVelStream = velXRaw !== null && velYRaw !== null && velZRaw !== null;

      const velStreamImu: V3 = {
        x: velXRaw ?? 0,
        y: velYRaw ?? 0,
        z: velZRaw ?? 0
      };
      const velStream = mapImuWorldToScene(velStreamImu);

      const linAccImu: V3 = {
        x: pickNumber(imu, ['lin_ax', 'linAx']) ?? pickNumber(frame, ['lin_ax', 'linAx']) ?? 0,
        y: pickNumber(imu, ['lin_ay', 'linAy']) ?? pickNumber(frame, ['lin_ay', 'linAy']) ?? 0,
        z: pickNumber(imu, ['lin_az', 'linAz']) ?? pickNumber(frame, ['lin_az', 'linAz']) ?? 0
      };
      const hasLinStream =
        pickNumber(imu, ['lin_ax', 'linAx']) !== null &&
        pickNumber(imu, ['lin_ay', 'linAy']) !== null &&
        pickNumber(imu, ['lin_az', 'linAz']) !== null;
      const linAcc = mapImuWorldToScene(linAccImu);

      if (posOriginRef.current === null) {
        posOriginRef.current = { ...pos };
      }

      if (warmupActive) {
        velocityRef.current = { x: 0, y: 0, z: 0 };
        motionFilteredRef.current = { x: 0, y: 0, z: 0 };
        stationaryFramesRef.current = 0;
        if (hasPosStream) {
          posOriginRef.current = { ...pos };
        }
        motionRef.current = {
          x: 0,
          y: 0,
          z: 0,
          dtMs: dtMsValue,
          stationary: true,
          timestamp: now
        };
      } else {
        // Keep a moving baseline so long-term bias does not accumulate into visible drift.
        if (hasPosStream) {
          const originFollow = stationary ? 0.12 : 0.04;
          posOriginRef.current = {
            x: (posOriginRef.current?.x ?? 0) + (pos.x - (posOriginRef.current?.x ?? 0)) * originFollow,
            y: (posOriginRef.current?.y ?? 0) + (pos.y - (posOriginRef.current?.y ?? 0)) * originFollow,
            z: (posOriginRef.current?.z ?? 0) + (pos.z - (posOriginRef.current?.z ?? 0)) * originFollow
          };
        }

        const velocityBlend = clamp(dtMsValue / 55, 0.18, 0.55);
        velocityRef.current = {
          x: velocityRef.current.x + (velStream.x - velocityRef.current.x) * velocityBlend,
          y: velocityRef.current.y + (velStream.y - velocityRef.current.y) * velocityBlend,
          z: velocityRef.current.z + (velStream.z - velocityRef.current.z) * velocityBlend
        };

        if (stationary) {
          const damping = Math.exp(-dtSec / 0.09);
          velocityRef.current = {
            x: velocityRef.current.x * damping,
            y: velocityRef.current.y * damping,
            z: velocityRef.current.z * damping
          };
          stationaryFramesRef.current += 1;
        } else {
          stationaryFramesRef.current = 0;
        }

        const relativePos = {
          x: pos.x - (posOriginRef.current?.x ?? 0),
          y: pos.y - (posOriginRef.current?.y ?? 0),
          z: pos.z - (posOriginRef.current?.z ?? 0)
        };

        // Translation is driven strictly by WS IMU vectors (pos/vel/lin), not by raw body acceleration fallback.
        const rpX = softDeadzone(relativePos.x, stationary ? 0.012 : 0.006);
        const rpY = softDeadzone(relativePos.y, stationary ? 0.012 : 0.006);
        const rpZ = softDeadzone(relativePos.z, stationary ? 0.012 : 0.006);

        const posTerm: V3 = hasPosStream
          ? {
              x: rpX * POSITION_VISUAL_GAIN,
              y: rpY * POSITION_VISUAL_GAIN,
              z: rpZ * POSITION_VISUAL_GAIN
            }
          : { x: 0, y: 0, z: 0 };

        const velTerm: V3 = hasVelStream
          ? {
              x: velocityRef.current.x * VELOCITY_VISUAL_GAIN,
              y: velocityRef.current.y * VELOCITY_VISUAL_GAIN,
              z: velocityRef.current.z * VELOCITY_VISUAL_GAIN
            }
          : { x: 0, y: 0, z: 0 };

        const linTerm: V3 = hasLinStream
          ? {
              x: linAcc.x * LINEAR_ACCEL_VISUAL_GAIN,
              y: linAcc.y * LINEAR_ACCEL_VISUAL_GAIN,
              z: linAcc.z * LINEAR_ACCEL_VISUAL_GAIN
            }
          : { x: 0, y: 0, z: 0 };

        const rawTargetMotion: V3 = {
          x: clamp(posTerm.x + velTerm.x + linTerm.x, -1.15, 1.15),
          y: clamp(posTerm.y + velTerm.y + linTerm.y, -1.15, 1.15),
          z: clamp(posTerm.z + velTerm.z + linTerm.z, -1.15, 1.15)
        };

        const maxMotionStepPerFrame = clamp((dtMsValue / 1000) * (stationary ? 1.8 : 6.4), 0.08, 0.3);
        const mx = rawTargetMotion.x - motionFilteredRef.current.x;
        const my = rawTargetMotion.y - motionFilteredRef.current.y;
        const mz = rawTargetMotion.z - motionFilteredRef.current.z;
        const motionDelta = Math.hypot(mx, my, mz);
        const targetMotion: V3 = motionDelta > maxMotionStepPerFrame && motionDelta > 1e-6
          ? {
              x: motionFilteredRef.current.x + (mx / motionDelta) * maxMotionStepPerFrame,
              y: motionFilteredRef.current.y + (my / motionDelta) * maxMotionStepPerFrame,
              z: motionFilteredRef.current.z + (mz / motionDelta) * maxMotionStepPerFrame
            }
          : rawTargetMotion;

        const deltaToTarget = Math.hypot(
          targetMotion.x - motionFilteredRef.current.x,
          targetMotion.y - motionFilteredRef.current.y,
          targetMotion.z - motionFilteredRef.current.z
        );
        const baseMotionAlpha = stationary ? 0.18 : clamp(dtMsValue / 60, 0.22, 0.48);
        const catchupBoost = clamp(deltaToTarget * 0.18, 0, 0.14);
        const motionAlpha = clamp(baseMotionAlpha + catchupBoost, 0.18, 0.56);
        motionFilteredRef.current = {
          x: motionFilteredRef.current.x + (targetMotion.x - motionFilteredRef.current.x) * motionAlpha,
          y: motionFilteredRef.current.y + (targetMotion.y - motionFilteredRef.current.y) * motionAlpha,
          z: motionFilteredRef.current.z + (targetMotion.z - motionFilteredRef.current.z) * motionAlpha
        };

        // Snap smoothly to origin after sustained stationary frames to remove residual drift.
        if (stationaryFramesRef.current > 8) {
          motionFilteredRef.current = {
            x: motionFilteredRef.current.x * 0.78,
            y: motionFilteredRef.current.y * 0.78,
            z: motionFilteredRef.current.z * 0.78
          };
        }

        motionRef.current = {
          x: clamp(motionFilteredRef.current.x, -1.15, 1.15),
          y: clamp(motionFilteredRef.current.y, -1.15, 1.15),
          z: clamp(motionFilteredRef.current.z, -1.15, 1.15),
          dtMs: dtMsValue,
          stationary,
          timestamp: now
        };
      }

      const q0 = pickNumber(imu, ['q0', 'quat0']);
      const q1 = pickNumber(imu, ['q1', 'quat1']);
      const q2 = pickNumber(imu, ['q2', 'quat2']);
      const q3 = pickNumber(imu, ['q3', 'quat3']);
      if (q0 === null || q1 === null || q2 === null || q3 === null) {
        return;
      }

      if (frozenRef.current) {
        return;
      }

      // Payload mapping: q0=w, q1=x, q2=y, q3=z.
      let incoming = { x: q1, y: q2, z: q3, w: q0 };
      const norm = Math.hypot(incoming.x, incoming.y, incoming.z, incoming.w);
      if (norm < 1e-5) {
        statsRef.current.dropped += 1;
        return;
      }
      incoming = normalizeQ(incoming);
      incoming = applyAxisMapping(incoming, axisMappingRef.current);

      const gx = pickNumber(imu, ['gx']) ?? 0;
      const gy = pickNumber(imu, ['gy']) ?? 0;
      const gz = pickNumber(imu, ['gz']) ?? 0;
      const angularSpeed = Math.hypot(gx, gy, gz);

      if (autoLevelPendingRef.current) {
        const stationaryForCalibration = stationary || angularSpeed < 6;
        if (stationaryForCalibration) {
          calibrationSamplesRef.current.push(incoming);
          if (calibrationSamplesRef.current.length > 18) {
            calibrationSamplesRef.current.shift();
          }
        }

        if (calibrationSamplesRef.current.length >= 10) {
          const averaged = averageQuaternions(calibrationSamplesRef.current);
          orientationOffsetRef.current = invertUnitQ(averaged);
          autoLevelPendingRef.current = false;
          calibrationSamplesRef.current = [];
          pushEvent('info', 'recalibrate-orientation-ready');
        }
      }

      incoming = normalizeQ(mulQ(orientationOffsetRef.current, incoming));

      if (dotQ(prevIncomingQRef.current, incoming) < 0) {
        incoming = { x: -incoming.x, y: -incoming.y, z: -incoming.z, w: -incoming.w };
      }
      prevIncomingQRef.current = incoming;

      const dtFactor = clamp(dtMsValue / 16, 0, 1);
      const speedFactor = clamp(angularSpeed / 360, 0, 1);
      let alpha = clamp(0.15 + dtFactor * 0.14 + speedFactor * 0.16, 0.15, 0.45);

      const d = clamp(Math.abs(dotQ(prevOutputQRef.current, incoming)), 0, 1);
      const deltaDeg = (2 * Math.acos(d) * 180) / Math.PI;
      if (deltaDeg > maxAngularJumpDeg) {
        statsRef.current.outliers += 1;
        alpha = clamp(alpha * 0.2, 0.03, 0.12);
      }

      let blended = normalizeQ(slerpQ(prevOutputQRef.current, incoming, alpha));

      // Yaw recenter is applied as an extra quaternion offset around Z axis.
      if (Math.abs(yawOffsetDegRef.current) > 0.001) {
        const half = (yawOffsetDegRef.current * Math.PI) / 360;
        const yawOffsetQ: Q = { x: 0, y: 0, z: Math.sin(half), w: Math.cos(half) };
        blended = normalizeQ(mulQ(yawOffsetQ, blended));
      }

      // If sensor is stationary and close to level, damp residual roll/pitch drift while preserving yaw.
      if (stationary) {
        const e = quaternionToEuler(blended);
        if (Math.abs(e.roll) < 8 && Math.abs(e.pitch) < 8) {
          const yawHalf = (e.yaw * Math.PI) / 360;
          const yawOnly: Q = { x: 0, y: 0, z: Math.sin(yawHalf), w: Math.cos(yawHalf) };
          blended = normalizeQ(slerpQ(blended, yawOnly, 0.09));
        }
      }

      prevOutputQRef.current = blended;
      quaternionRef.current = blended;
      filteredEulerRef.current = quaternionToEuler(blended);

      const sample: ImuFrameSample = {
        timestamp: now,
        dtMs: dtMsValue,
        quaternion: blended,
        quaternionNorm: norm,
        stationary,
        position: { ...pos },
        velocity: { ...velocityRef.current }
      };
      const nextBuffer = frameBufferRef.current;
      nextBuffer.push(sample);
      if (nextBuffer.length > maxBufferedFrames) {
        nextBuffer.shift();
      }
    };

    const connect = () => {
      clearTimers();
      try {
        setStatus(reconnectAttemptRef.current > 0 ? 'reconnecting' : 'connecting');
        const ws = new WebSocket(activeUrl);
        wsRef.current = ws;

        ws.onopen = () => {
          reconnectAttemptRef.current = 0;
          lastMessageAtRef.current = Date.now();
          startupFramesRef.current = 0;
          autoLevelPendingRef.current = true;
          orientationOffsetRef.current = { x: 0, y: 0, z: 0, w: 1 };
          calibrationSamplesRef.current = [];
          setStatus('connected');

          heartbeatTimerRef.current = setInterval(() => {
            const age = Date.now() - lastMessageAtRef.current;
            statsRef.current.frameAgeMs = age;

            if (age > disconnectAfterMs) {
              setStatus('disconnected');
              if (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING) {
                ws.close();
              }
              return;
            }
            if (age > staleAfterMs) {
              setStatus('stale');
            } else if (ws.readyState === WebSocket.OPEN) {
              setStatus('connected');
            }

            if (ws.readyState === WebSocket.OPEN) {
              try {
                ws.send('{"type":"ping"}');
              } catch {
                // No-op.
              }
            }
          }, heartbeatMs);
        };

        ws.onmessage = (event) => {
          handleMessage(event.data);
        };

        ws.onerror = () => {
          setStatus('error');
        };

        ws.onclose = () => {
          clearTimers();
          wsRef.current = null;
          if (!shouldReconnectRef.current) {
            setStatus('offline');
            return;
          }
          scheduleReconnect();
        };
      } catch {
        setStatus('error');
        scheduleReconnect();
      }
    };

    connect();

    return () => {
      shouldReconnectRef.current = false;
      clearTimers();
      if (wsRef.current) {
        wsRef.current.close();
        wsRef.current = null;
      }
      setStatus('offline');
    };
  }, [
    activeUrl,
    maxBufferedFrames,
    heartbeatMs,
    staleAfterMs,
    disconnectAfterMs,
    reconnectBaseMs,
    reconnectMaxMs,
    maxAngularJumpDeg,
    setStatus
  ]);

  return {
    quaternionRef,
    filteredEulerRef,
    rawFrameRef,
    motionRef,
    frameBufferRef,
    eventLogRef,
    statsRef,
    connectionStatus,
    isFrozen: frozenRef,
    connectImu,
    disconnectImu,
    recalibrateOrientation,
    recenterPosition,
    recenterYaw,
    resetFilters,
    setFrozen,
    setAxisMapping
  };
}

export function useImuRealtime(initialWsUrl: string, options: Options = {}) {
  return useImuQuaternion(initialWsUrl, options);
}
