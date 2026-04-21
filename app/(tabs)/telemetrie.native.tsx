import { useEffect, useMemo, useState } from 'react';
import { ImageBackground, Pressable, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as Location from 'expo-location';
import Svg, { Circle, Defs, Path, RadialGradient, Stop } from 'react-native-svg';

import { useConnectivity } from '@/hooks/useConnectivity';

const MAX_ROUTE_POINTS = 28;
const MAP_WIDTH = 390;
const MAP_HEIGHT = 760;
const MAP_PADDING = 24;

type RoutePoint = {
  latitude: number;
  longitude: number;
};

function formatValue(value: number | null | undefined, fractionDigits = 0, suffix = '') {
  if (value == null || !Number.isFinite(value)) return '—';
  return `${value.toFixed(fractionDigits)}${suffix}`;
}

function formatTimestamp(date: Date) {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
}

function formatCoordinate(value: number | null | undefined, type: 'lat' | 'lon') {
  if (value == null || !Number.isFinite(value)) return '—';
  const suffix = type === 'lat' ? (value >= 0 ? 'N' : 'S') : (value >= 0 ? 'E' : 'V');
  return `${Math.abs(value).toFixed(5)}° ${suffix}`;
}

function toMapPoints(points: RoutePoint[]) {
  if (points.length === 0) {
    return [];
  }

  const latitudes = points.map((point) => point.latitude);
  const longitudes = points.map((point) => point.longitude);
  const minLat = Math.min(...latitudes);
  const maxLat = Math.max(...latitudes);
  const minLon = Math.min(...longitudes);
  const maxLon = Math.max(...longitudes);
  const latRange = Math.max(maxLat - minLat, 0.00001);
  const lonRange = Math.max(maxLon - minLon, 0.00001);
  const usableWidth = MAP_WIDTH - MAP_PADDING * 2;
  const usableHeight = MAP_HEIGHT - MAP_PADDING * 2;

  return points.map((point) => {
    const x = MAP_PADDING + ((point.longitude - minLon) / lonRange) * usableWidth;
    const y = MAP_HEIGHT - MAP_PADDING - ((point.latitude - minLat) / latRange) * usableHeight;
    return { x, y };
  });
}

export default function Telemetrie() {
  const router = useRouter();
  const { currentData, diveSessionState } = useConnectivity();

  const [locationStatus, setLocationStatus] = useState<'idle' | 'requesting' | 'granted' | 'denied'>('idle');
  const [locationError, setLocationError] = useState<string | null>(null);
  const [locationCoords, setLocationCoords] = useState<Location.LocationObjectCoords | null>(null);
  const [lastSampleTimestamp, setLastSampleTimestamp] = useState<number | null>(null);
  const [routePoints, setRoutePoints] = useState<RoutePoint[]>([]);
  const [isInfoCollapsed, setIsInfoCollapsed] = useState(true);

  useEffect(() => {
    let mounted = true;
    let subscription: Location.LocationSubscription | null = null;

    const addPoint = (coords: Location.LocationObjectCoords) => {
      setRoutePoints((previous) => {
        const next = [...previous, { latitude: coords.latitude, longitude: coords.longitude }];
        return next.slice(-MAX_ROUTE_POINTS);
      });
    };

    const startTracking = async () => {
      setLocationStatus('requesting');
      setLocationError(null);

      const permission = await Location.requestForegroundPermissionsAsync();
      if (!mounted) {
        return;
      }

      if (permission.status !== 'granted') {
        setLocationStatus('denied');
        setLocationError('Permisiunea GPS este necesară pentru poziționare reală.');
        return;
      }

      setLocationStatus('granted');

      const initialPosition = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });

      if (!mounted) {
        return;
      }

      setLocationCoords(initialPosition.coords);
      setLastSampleTimestamp(initialPosition.timestamp);
      addPoint(initialPosition.coords);

      subscription = await Location.watchPositionAsync(
        {
          accuracy: Location.Accuracy.Balanced,
          distanceInterval: 3,
          timeInterval: 2000,
        },
        (position) => {
          if (!mounted) {
            return;
          }

          setLocationCoords(position.coords);
          setLastSampleTimestamp(position.timestamp);
          addPoint(position.coords);
        },
      );
    };

    startTracking().catch((error) => {
      if (!mounted) {
        return;
      }

      setLocationStatus('denied');
      setLocationError(error instanceof Error ? error.message : 'GPS indisponibil momentan.');
    });

    return () => {
      mounted = false;
      subscription?.remove();
    };
  }, []);

  const altitude = useMemo(() => {
    if (locationCoords?.altitude != null && Number.isFinite(locationCoords.altitude)) {
      return formatValue(locationCoords.altitude, 0);
    }
    return formatValue(currentData?.posZ ?? null, 0);
  }, [currentData?.posZ, locationCoords?.altitude]);

  const lastUpdate = useMemo(
    () => (lastSampleTimestamp ? formatTimestamp(new Date(lastSampleTimestamp)) : '—'),
    [lastSampleTimestamp],
  );

  const gpsDotColor = useMemo(() => {
    if (locationStatus === 'requesting') return '#FFB547';
    if (locationStatus === 'granted' && locationCoords) return '#2FCFB4';
    return '#FF5D7C';
  }, [locationCoords, locationStatus]);

  const gpsStatusLabel = useMemo(() => {
    if (locationStatus === 'requesting') return 'GPS Pornire';
    if (locationStatus === 'granted' && locationCoords) return 'GPS Activ';
    return 'GPS Oprit';
  }, [locationCoords, locationStatus]);

  const mappedPoints = useMemo(() => toMapPoints(routePoints), [routePoints]);
  const routePath = useMemo(() => {
    if (mappedPoints.length < 2) return '';
    return mappedPoints
      .map((point, index) => `${index === 0 ? 'M' : 'L'} ${point.x.toFixed(1)} ${point.y.toFixed(1)}`)
      .join(' ');
  }, [mappedPoints]);
  const currentMarker = mappedPoints[mappedPoints.length - 1];

  const speedKmh = useMemo(() => {
    if (locationCoords?.speed == null || !Number.isFinite(locationCoords.speed) || locationCoords.speed < 0) {
      return '—';
    }
    return formatValue(locationCoords.speed * 3.6, 1);
  }, [locationCoords?.speed]);

  const accuracy = useMemo(() => formatValue(locationCoords?.accuracy ?? null, 0), [locationCoords?.accuracy]);
  const heading = useMemo(() => {
    if (locationCoords?.heading == null || !Number.isFinite(locationCoords.heading) || locationCoords.heading < 0) {
      return '—';
    }
    return formatValue(locationCoords.heading, 0);
  }, [locationCoords?.heading]);

  return (
    <View style={{ flex: 1, backgroundColor: '#1A2030' }}>
      <SafeAreaView edges={['top', 'left', 'right', 'bottom']} style={{ flex: 1 }}>
        <ImageBackground
          source={require('../../reference/reference.jpg')}
          resizeMode="cover"
          style={{ flex: 1 }}
          imageStyle={{ opacity: 0.55 }}
        >
          <View style={{ position: 'absolute', inset: 0, backgroundColor: 'rgba(20,28,46,0.38)' }} />

          <View
            style={{
              paddingHorizontal: 16,
              paddingTop: 10,
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'space-between',
              zIndex: 10,
            }}
          >
            <Pressable
              onPress={() => router.replace('/')}
              style={{
                width: 38,
                height: 38,
                borderRadius: 13,
                backgroundColor: 'rgba(255,255,255,0.18)',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Ionicons name="chevron-back" size={20} color="#fff" />
            </Pressable>

            <Text style={{ color: '#fff', fontSize: 16, fontWeight: '800', letterSpacing: 0.1 }}>
              Poziție GPS
            </Text>

            <View
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: 5,
                backgroundColor: '#fff',
                paddingHorizontal: 11,
                paddingVertical: 6,
                borderRadius: 999,
                shadowColor: '#000',
                shadowOpacity: 0.12,
                shadowRadius: 8,
                elevation: 3,
              }}
            >
              <View
                style={{
                  width: 7,
                  height: 7,
                  borderRadius: 4,
                  backgroundColor: gpsDotColor,
                }}
              />
              <Text style={{ fontSize: 12, fontWeight: '800', color: '#171717' }}>{gpsStatusLabel}</Text>
            </View>
          </View>

          <Svg
            width="100%"
            height="100%"
            viewBox={`0 0 ${MAP_WIDTH} ${MAP_HEIGHT}`}
            preserveAspectRatio="none"
            style={{ position: 'absolute', inset: 0 }}
          >
            <Defs>
              <RadialGradient id="glow" cx="50%" cy="50%" r="50%">
                <Stop offset="0%" stopColor="#2FCFB4" stopOpacity="0.5" />
                <Stop offset="100%" stopColor="#2FCFB4" stopOpacity="0" />
              </RadialGradient>
            </Defs>

            {routePath ? (
              <>
                <Path
                  d={routePath}
                  stroke="rgba(47,207,180,0.22)"
                  strokeWidth="16"
                  strokeLinecap="round"
                  fill="none"
                />
                <Path
                  d={routePath}
                  stroke="rgba(255,255,255,0.88)"
                  strokeWidth="2.5"
                  strokeDasharray="9 6"
                  strokeLinecap="round"
                  fill="none"
                />
                <Path
                  d={routePath}
                  stroke="#2FCFB4"
                  strokeWidth="2.5"
                  strokeDasharray="9 6"
                  strokeLinecap="round"
                  fill="none"
                  opacity={0.55}
                />
              </>
            ) : null}

            {currentMarker ? (
              <>
                <Circle cx={currentMarker.x} cy={currentMarker.y} r="18" fill="url(#glow)" />
                <Circle cx={currentMarker.x} cy={currentMarker.y} r="9" fill="#fff" />
                <Circle cx={currentMarker.x} cy={currentMarker.y} r="5" fill="#2FCFB4" />
              </>
            ) : (
              <>
                <Circle cx={MAP_WIDTH / 2} cy={MAP_HEIGHT / 2} r="18" fill="url(#glow)" />
                <Circle cx={MAP_WIDTH / 2} cy={MAP_HEIGHT / 2} r="9" fill="#fff" />
                <Circle cx={MAP_WIDTH / 2} cy={MAP_HEIGHT / 2} r="5" fill="#2FCFB4" />
              </>
            )}
          </Svg>

          <View
            style={{
              position: 'absolute',
              left: 0,
              right: 0,
              bottom: 0,
              backgroundColor: 'rgba(255,255,255,0.97)',
              borderTopLeftRadius: 30,
              borderTopRightRadius: 30,
              paddingHorizontal: 16,
              paddingTop: 12,
              paddingBottom: 18,
              shadowColor: '#000',
              shadowOpacity: 0.18,
              shadowRadius: 30,
              shadowOffset: { width: 0, height: -8 },
              elevation: 16,
            }}
          >
            <Pressable
              onPress={() => setIsInfoCollapsed((value) => !value)}
              style={{ paddingBottom: 10 }}
            >
              <View
                style={{
                  width: 36,
                  height: 4,
                  borderRadius: 2,
                  backgroundColor: '#E0E3EA',
                  alignSelf: 'center',
                  marginBottom: 10,
                }}
              />
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                <View>
                  <Text
                    style={{
                      fontSize: 10,
                      fontWeight: '700',
                      color: '#9DA3B4',
                      textTransform: 'uppercase',
                      letterSpacing: 0.8,
                    }}
                  >
                    Telemetrie GPS
                  </Text>
                  <Text style={{ fontSize: 16, fontWeight: '900', color: '#171717', marginTop: 2 }}>
                    {formatCoordinate(locationCoords?.latitude, 'lat')} · {formatCoordinate(locationCoords?.longitude, 'lon')}
                  </Text>
                </View>
                <Ionicons name={isInfoCollapsed ? 'chevron-up' : 'chevron-down'} size={18} color="#9DA3B4" />
              </View>
            </Pressable>

            {!isInfoCollapsed ? (
              <>
                <View style={{ flexDirection: 'row', gap: 10 }}>
                  <View style={{ flex: 1, backgroundColor: '#F5F6F9', borderRadius: 16, padding: 12 }}>
                    <Text style={{ fontSize: 10, fontWeight: '700', color: '#9DA3B4', textTransform: 'uppercase', letterSpacing: 0.7 }}>
                      Altitudine
                    </Text>
                    <Text style={{ fontSize: 24, fontWeight: '900', color: '#171717', lineHeight: 28 }}>{altitude}</Text>
                    <Text style={{ fontSize: 12, fontWeight: '600', color: '#9DA3B4' }}>metri</Text>
                  </View>

                  <View style={{ flex: 1, backgroundColor: '#F5F6F9', borderRadius: 16, padding: 12 }}>
                    <Text style={{ fontSize: 10, fontWeight: '700', color: '#9DA3B4', textTransform: 'uppercase', letterSpacing: 0.7 }}>
                      Ultima actualizare
                    </Text>
                    <Text style={{ fontSize: 24, fontWeight: '900', color: '#171717', lineHeight: 28 }}>{lastUpdate}</Text>
                    <Text style={{ fontSize: 12, fontWeight: '600', color: '#9DA3B4' }}>
                      {diveSessionState.isActive ? 'salt activ' : 'salt inactiv'}
                    </Text>
                  </View>
                </View>

                <View
                  style={{
                    marginTop: 10,
                    borderRadius: 14,
                    backgroundColor: '#fff',
                    borderWidth: 1,
                    borderColor: '#E8E9EF',
                    padding: 12,
                    gap: 6,
                  }}
                >
                  <Text style={{ fontSize: 13, fontWeight: '800', color: '#171717' }}>Date GPS reale</Text>
                  <Text style={{ fontSize: 12, color: '#4B5160' }}>
                    Precizie: {accuracy} m · Viteză: {speedKmh} km/h · Direcție: {heading}°
                  </Text>
                  {locationError ? (
                    <Text style={{ fontSize: 12, color: '#C64A60' }}>{locationError}</Text>
                  ) : null}
                </View>
              </>
            ) : null}
          </View>
        </ImageBackground>
      </SafeAreaView>
    </View>
  );
}
