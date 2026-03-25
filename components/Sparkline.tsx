import { useMemo } from 'react';
import { Circle, Defs, LinearGradient, Path, Stop, Svg } from 'react-native-svg';

interface Props {
  data: number[];
  color: string;
  width: number;
  height: number;
}

const smoothSeries = (input: number[], alpha = 0.35) => {
  if (input.length < 3) {
    return input;
  }

  const out: number[] = [input[0]];
  for (let i = 1; i < input.length; i += 1) {
    out[i] = alpha * input[i] + (1 - alpha) * out[i - 1];
  }
  return out;
};

const buildSmoothPath = (points: Array<{ x: number; y: number }>) => {
  if (!points.length) {
    return '';
  }

  if (points.length === 1) {
    return `M ${points[0].x} ${points[0].y}`;
  }

  let d = `M ${points[0].x} ${points[0].y}`;
  for (let i = 0; i < points.length - 1; i += 1) {
    const p0 = points[i - 1] ?? points[i];
    const p1 = points[i];
    const p2 = points[i + 1];
    const p3 = points[i + 2] ?? p2;

    const c1x = p1.x + (p2.x - p0.x) / 6;
    const c1y = p1.y + (p2.y - p0.y) / 6;
    const c2x = p2.x - (p3.x - p1.x) / 6;
    const c2y = p2.y - (p3.y - p1.y) / 6;

    d += ` C ${c1x} ${c1y}, ${c2x} ${c2y}, ${p2.x} ${p2.y}`;
  }

  return d;
};

export function Sparkline({ data, color, width, height }: Props) {
  const { linePath, areaPath, lastPoint } = useMemo(() => {
    const base = data.length ? data : [0, 0];
    const values = smoothSeries(base);

    const min = Math.min(...values);
    const max = Math.max(...values);
    const range = max - min || 1;

    const points = values.map((value, i) => {
      const x = (i / Math.max(values.length - 1, 1)) * width;
      const y = height - ((value - min) / range) * (height - 4) - 2;
      return { x, y };
    });

    const linePath = buildSmoothPath(points);
    const areaPath = points.length
      ? `${linePath} L ${points[points.length - 1].x} ${height} L ${points[0].x} ${height} Z`
      : '';

    return {
      linePath,
      areaPath,
      lastPoint: points[points.length - 1] ?? { x: width, y: height / 2 }
    };
  }, [data, height, width]);

  const gradientId = useMemo(
    () => `sparkGradient-${color.replace('#', '')}-${Math.round(width)}-${Math.round(height)}`,
    [color, height, width]
  );

  return (
    <Svg width={width} height={height}>
      <Defs>
        <LinearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0%" stopColor={color} stopOpacity="0.31" />
          <Stop offset="100%" stopColor={color} stopOpacity="0.02" />
        </LinearGradient>
      </Defs>
      {areaPath ? <Path d={areaPath} fill={`url(#${gradientId})`} /> : null}
      {linePath ? (
        <Path
          d={linePath}
          fill="none"
          stroke={color}
          strokeWidth={2.15}
          strokeLinejoin="round"
          strokeLinecap="round"
        />
      ) : null}
      <Circle cx={lastPoint.x} cy={lastPoint.y} r={4.4} fill={color} opacity={0.18} />
      <Circle cx={lastPoint.x} cy={lastPoint.y} r={2.5} fill={color} />
    </Svg>
  );
}
