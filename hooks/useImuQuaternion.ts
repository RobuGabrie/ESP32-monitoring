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
  swapYZ?: boolean;
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
  const lastRawPosRef = useRef<V3>({ x: 0, y: 0, z: 0 });
  const velocityRef = useRef<V3>({ x: 0, y: 0, z: 0 });

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
  const axisMappingRef = useRef<ImuAxisMapping>({});
  const lastFrameCounterRef = useRef<number | null>(null);

  useEffect(() => {
    if (initialWsUrl && initialWsUrl !== activeUrl) {
      setActiveUrl(initialWsUrl);
    }
  }, [initialWsUrl, activeUrl]);

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
    velocityRef.current = { x: 0, y: 0, z: 0 };
    motionRef.current = {
      ...motionRef.current,
      x: 0,
      y: 0,
      z: 0,
      timestamp: Date.now()
    };
    pushEvent('info', 'recenter-position');
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

      const stationary = toBoolean(imu.stationary) ?? toBoolean(frame.stationary) ?? false;

      const pos: V3 = {
        x: pickNumber(imu, ['pos_x', 'posX']) ?? pickNumber(frame, ['pos_x', 'posX']) ?? 0,
        y: pickNumber(imu, ['pos_y', 'posY']) ?? pickNumber(frame, ['pos_y', 'posY']) ?? 0,
        z: pickNumber(imu, ['pos_z', 'posZ']) ?? pickNumber(frame, ['pos_z', 'posZ']) ?? 0
      };
      lastRawPosRef.current = pos;

      const velStream: V3 = {
        x: pickNumber(imu, ['vel_x', 'velX']) ?? pickNumber(frame, ['vel_x', 'velX']) ?? 0,
        y: pickNumber(imu, ['vel_y', 'velY']) ?? pickNumber(frame, ['vel_y', 'velY']) ?? 0,
        z: pickNumber(imu, ['vel_z', 'velZ']) ?? pickNumber(frame, ['vel_z', 'velZ']) ?? 0
      };

      if (posOriginRef.current === null) {
        posOriginRef.current = { ...pos };
      }

      const velocityBlend = clamp(dtMsValue / 40, 0.12, 0.45);
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
      }

      const relativePos = {
        x: pos.x - (posOriginRef.current?.x ?? 0),
        y: pos.y - (posOriginRef.current?.y ?? 0),
        z: pos.z - (posOriginRef.current?.z ?? 0)
      };

      const posScale = stationary ? 0.12 : 0.2;
      const velScale = stationary ? 0.012 : 0.03;
      motionRef.current = {
        x: clamp(relativePos.x * posScale + velocityRef.current.x * velScale, -1.5, 1.5),
        y: clamp(relativePos.y * posScale + velocityRef.current.y * velScale, -1.5, 1.5),
        z: clamp(relativePos.z * posScale + velocityRef.current.z * velScale, -1.5, 1.5),
        dtMs: dtMsValue,
        stationary,
        timestamp: now
      };

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

      if (dotQ(prevIncomingQRef.current, incoming) < 0) {
        incoming = { x: -incoming.x, y: -incoming.y, z: -incoming.z, w: -incoming.w };
      }
      prevIncomingQRef.current = incoming;

      const gx = pickNumber(imu, ['gx']) ?? 0;
      const gy = pickNumber(imu, ['gy']) ?? 0;
      const gz = pickNumber(imu, ['gz']) ?? 0;
      const angularSpeed = Math.hypot(gx, gy, gz);
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
