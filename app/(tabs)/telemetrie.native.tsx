import { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

import { useTelemetry } from '@/hooks/TelemetryContext';

const formatCoordinate = (value: number, positiveLabel: string, negativeLabel: string) => {
  const label = value >= 0 ? positiveLabel : negativeLabel;
  return `${Math.abs(value).toFixed(5)}° ${label}`;
};

const formatAltitude = (value?: number | null) => {
  if (typeof value !== 'number' || Number.isNaN(value)) {
    return '—';
  }

  return `${Math.round(value)} m`;
};

const formatTrackLength = (points: { latitude: number; longitude: number }[]) => {
  if (points.length < 2) {
    return '0';
  }

  let totalMeters = 0;
  for (let index = 1; index < points.length; index += 1) {
    const previous = points[index - 1];
    const next = points[index];
    const earthRadius = 6371000;
    const lat1 = (previous.latitude * Math.PI) / 180;
    const lat2 = (next.latitude * Math.PI) / 180;
    const deltaLat = ((next.latitude - previous.latitude) * Math.PI) / 180;
    const deltaLon = ((next.longitude - previous.longitude) * Math.PI) / 180;
    const a =
      Math.sin(deltaLat / 2) * Math.sin(deltaLat / 2) +
      Math.cos(lat1) * Math.cos(lat2) * Math.sin(deltaLon / 2) * Math.sin(deltaLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    totalMeters += earthRadius * c;
  }

  return totalMeters < 1000 ? `${Math.round(totalMeters)} m` : `${(totalMeters / 1000).toFixed(2)} km`;
};

export default function Telemetrie() {
  const router = useRouter();
  const { isTracking, currentLocation, routePoints, startLocation, endLocation } = useTelemetry();
  const [isRouteExpanded, setIsRouteExpanded] = useState(true);

  const mapPoint = currentLocation ?? startLocation ?? endLocation ?? null;
  const hasRoute = routePoints.length > 1;
  const routePreviewPoints = useMemo(() => {
    if (hasRoute) {
      return routePoints.slice(-5);
    }

    return mapPoint ? [mapPoint] : [];
  }, [hasRoute, mapPoint, routePoints]);
  const routeDistance = useMemo(() => formatTrackLength(routePoints), [routePoints]);

  if (!mapPoint) {
    return (
      <View style={styles.screen}>
        <SafeAreaView edges={['top', 'left', 'right', 'bottom']} style={styles.safeArea}>
          <View style={styles.heroShell}>
            <View style={styles.orbLarge} />
            <View style={styles.orbSmall} />
            <View style={styles.emptyCard}>
              <View style={styles.emptyIconWrap}>
                <Ionicons name="location-outline" size={26} color="#2FCFB4" />
              </View>
              <Text style={styles.emptyTitle}>GPS Live</Text>
              <Text style={styles.emptyText}>
                Aștept semnalul GPS. Când telefonul primește o poziție, harta se activează automat chiar dacă timerul nu a pornit încă.
              </Text>
              <Pressable onPress={() => router.back()} style={styles.secondaryButton}>
                <Text style={styles.secondaryButtonText}>Înapoi</Text>
              </Pressable>
            </View>
          </View>
        </SafeAreaView>
      </View>
    );
  }

  return (
    <View style={styles.screen}>
      <SafeAreaView edges={['top', 'left', 'right', 'bottom']} style={styles.safeArea}>
        <View style={styles.backgroundTopBlob} />
        <View style={styles.backgroundBottomBlob} />

        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
          <View style={styles.headerRow}>
            <Pressable onPress={() => router.back()} style={styles.backButton}>
              <Ionicons name="chevron-back" size={18} color="#fff" />
            </Pressable>

            <View style={styles.titleBlock}>
              <Text style={styles.kicker}>GPS Live</Text>
              <Text style={styles.pageTitle}>{isTracking ? 'Urmărire activă' : 'Poziție curentă'}</Text>
            </View>

            <View style={styles.headerSpacer} />
          </View>

          <View style={styles.statusStrip}>
            <View style={[styles.statusPill, { backgroundColor: isTracking ? 'rgba(47,207,180,0.16)' : 'rgba(66,141,255,0.16)' }]}>
              <View style={[styles.statusDot, { backgroundColor: isTracking ? '#2FCFB4' : '#428DFF' }]} />
              <Text style={styles.statusText}>{isTracking ? 'Timer pornit' : 'Fără timer'}</Text>
            </View>
            <View style={styles.coordPill}>
              <Ionicons name="navigate-outline" size={14} color="#2FCFB4" />
              <Text style={styles.coordPillText}>{formatCoordinate(mapPoint.latitude, 'N', 'S')}</Text>
            </View>
          </View>

          <View style={styles.mapCard}>
            <View style={styles.mapFrame}>
              <View style={styles.gridOverlay} />
              <View style={styles.mapGlow} />

              <View style={styles.previewTag}>
                <Ionicons name="map-outline" size={14} color="#2FCFB4" />
                <Text style={styles.previewTagText}>Previzualizare GPS</Text>
              </View>

              <View style={styles.centerCrosshair} />

              <View style={styles.routeRibbon}>
                {hasRoute ? (
                  <View style={styles.routePath}>
                    {routePreviewPoints.map((point, index) => {
                      const isLast = index === routePreviewPoints.length - 1;
                      return (
                        <View
                          key={`${point.latitude}-${point.longitude}-${index}`}
                          style={[
                            styles.routeNode,
                            isLast ? styles.routeNodeActive : null,
                            { left: `${10 + index * (70 / Math.max(routePreviewPoints.length, 1))}%` },
                          ]}
                        >
                          <View style={[styles.routeNodeInner, isLast ? styles.routeNodeInnerActive : null]} />
                        </View>
                      );
                    })}
                    <View style={styles.routeLine} />
                  </View>
                ) : (
                  <View style={styles.idleRouteState}>
                    <Ionicons name="location-outline" size={20} color="#2FCFB4" />
                    <Text style={styles.idleRouteText}>Se așteaptă primul punct GPS</Text>
                  </View>
                )}
              </View>

              <View style={[styles.mapPin, { top: '18%', left: '18%' }]}>
                <Text style={styles.mapPinLabel}>Start</Text>
              </View>
              <View style={[styles.mapPin, { top: '56%', left: '66%', backgroundColor: 'rgba(255,93,124,0.18)' }]}>
                <Text style={styles.mapPinLabel}>Curent</Text>
              </View>
              <View style={[styles.mapPin, { top: '72%', left: '32%', backgroundColor: 'rgba(66,141,255,0.18)' }]}>
                <Text style={styles.mapPinLabel}>Final</Text>
              </View>

              <View style={styles.mapLegend}>
                <View style={styles.legendRow}>
                  <View style={[styles.legendDot, { backgroundColor: '#2FCFB4' }]} />
                  <Text style={styles.legendText}>Locație activă</Text>
                </View>
                <View style={styles.legendRow}>
                  <View style={[styles.legendDot, { backgroundColor: '#FFB547' }]} />
                  <Text style={styles.legendText}>Start sesiune</Text>
                </View>
                <View style={styles.legendRow}>
                  <View style={[styles.legendDot, { backgroundColor: '#FF5D7C' }]} />
                  <Text style={styles.legendText}>Final sesiune</Text>
                </View>
              </View>
            </View>

            <View style={styles.mapOverlay}>
              <Text style={styles.overlayLabel}>Coordonate</Text>
              <Text style={styles.overlayValue}>{formatCoordinate(mapPoint.latitude, 'N', 'S')} · {formatCoordinate(mapPoint.longitude, 'E', 'W')}</Text>
              <Text style={styles.overlayMeta}>Altitudine {formatAltitude(mapPoint.altitude)}</Text>
            </View>
          </View>

          <View style={styles.statsGrid}>
            <View style={styles.statCard}>
              <Text style={styles.statLabel}>Stare</Text>
              <Text style={styles.statValue}>{isTracking ? 'Înregistrare' : 'Vizualizare live'}</Text>
              <Text style={styles.statHint}>{isTracking ? 'Se salvează traseul.' : 'Traseul încă nu se salvează.'}</Text>
            </View>
            <View style={styles.statCard}>
              <Text style={styles.statLabel}>Rută</Text>
              <Text style={styles.statValue}>{routePoints.length}</Text>
              <Text style={styles.statHint}>puncte GPS</Text>
            </View>
            <View style={styles.statCard}>
              <Text style={styles.statLabel}>Distanță</Text>
              <Text style={styles.statValue}>{routeDistance}</Text>
              <Text style={styles.statHint}>calculat din traseu</Text>
            </View>
            <View style={styles.statCard}>
              <Text style={styles.statLabel}>Altitudine</Text>
              <Text style={styles.statValue}>{formatAltitude(mapPoint.altitude)}</Text>
              <Text style={styles.statHint}>punct activ</Text>
            </View>
          </View>

          <View style={styles.routePanel}>
            <Pressable onPress={() => setIsRouteExpanded((value) => !value)} style={styles.routeHeader}>
              <View>
                <Text style={styles.routeTitle}>Traseu</Text>
                <Text style={styles.routeSubtitle}>
                  {hasRoute ? `${routePoints.length} puncte înregistrate` : 'Niciun traseu înregistrat încă'}
                </Text>
              </View>
              <Ionicons name={isRouteExpanded ? 'chevron-up' : 'chevron-down'} size={18} color="#D3D9E6" />
            </Pressable>

            {isRouteExpanded && (
              <View style={styles.routeBody}>
                {routePoints.slice(-6).map((point, index) => (
                  <View key={`${point.latitude}-${point.longitude}-${index}`} style={styles.routeRow}>
                    <View style={styles.routeIndexBubble}>
                      <Text style={styles.routeIndexText}>{Math.max(routePoints.length - 5 + index, 1)}</Text>
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.routePointText}>{formatCoordinate(point.latitude, 'N', 'S')} · {formatCoordinate(point.longitude, 'E', 'W')}</Text>
                      <Text style={styles.routePointMeta}>Altitudine {formatAltitude(point.altitude)}</Text>
                    </View>
                  </View>
                ))}
                {!hasRoute && (
                  <View style={styles.routeEmptyState}>
                    <Ionicons name="trail-sign-outline" size={18} color="#7B869A" />
                    <Text style={styles.routeEmptyText}>Pornește timerul pentru a salva puncte în traseu.</Text>
                  </View>
                )}
              </View>
            )}
          </View>
        </ScrollView>

        <View style={styles.bottomBar}>
          <View style={styles.bottomBarContent}>
            <View>
              <Text style={styles.bottomBarLabel}>GPS activ</Text>
              <Text style={styles.bottomBarValue}>{formatCoordinate(mapPoint.latitude, 'N', 'S')} · {formatCoordinate(mapPoint.longitude, 'E', 'W')}</Text>
            </View>
            <Pressable onPress={() => router.back()} style={styles.bottomButton}>
              <Ionicons name="arrow-back" size={16} color="#0E1726" />
              <Text style={styles.bottomButtonText}>Înapoi</Text>
            </Pressable>
          </View>
        </View>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#0E1726',
  },
  safeArea: {
    flex: 1,
  },
  heroShell: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 20,
  },
  orbLarge: {
    position: 'absolute',
    width: 240,
    height: 240,
    borderRadius: 240,
    backgroundColor: 'rgba(47,207,180,0.18)',
    top: 50,
    left: -90,
  },
  orbSmall: {
    position: 'absolute',
    width: 180,
    height: 180,
    borderRadius: 180,
    backgroundColor: 'rgba(66,141,255,0.14)',
    right: -60,
    bottom: 100,
  },
  emptyCard: {
    backgroundColor: 'rgba(16,24,37,0.92)',
    borderRadius: 28,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    padding: 22,
    alignItems: 'center',
  },
  emptyIconWrap: {
    width: 64,
    height: 64,
    borderRadius: 20,
    backgroundColor: 'rgba(47,207,180,0.14)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
  },
  emptyTitle: {
    color: '#fff',
    fontSize: 24,
    fontWeight: '800',
    marginBottom: 10,
  },
  emptyText: {
    color: 'rgba(255,255,255,0.72)',
    fontSize: 14,
    lineHeight: 21,
    textAlign: 'center',
    marginBottom: 18,
  },
  secondaryButton: {
    paddingHorizontal: 18,
    paddingVertical: 12,
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
  secondaryButtonText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '700',
  },
  backgroundTopBlob: {
    position: 'absolute',
    top: -70,
    left: -70,
    width: 220,
    height: 220,
    borderRadius: 220,
    backgroundColor: 'rgba(47,207,180,0.16)',
  },
  backgroundBottomBlob: {
    position: 'absolute',
    bottom: 110,
    right: -90,
    width: 240,
    height: 240,
    borderRadius: 240,
    backgroundColor: 'rgba(66,141,255,0.12)',
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 110,
    gap: 14,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.10)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerSpacer: {
    width: 40,
  },
  titleBlock: {
    alignItems: 'center',
  },
  kicker: {
    color: '#2FCFB4',
    fontSize: 11,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    fontWeight: '800',
  },
  pageTitle: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '800',
    marginTop: 4,
  },
  statusStrip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    justifyContent: 'space-between',
  },
  statusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 999,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 8,
  },
  statusText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '700',
  },
  coordPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
  coordPillText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '700',
  },
  mapCard: {
    borderRadius: 28,
    overflow: 'hidden',
    backgroundColor: '#0B1220',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  mapFrame: {
    height: 340,
    backgroundColor: '#0B1220',
    overflow: 'hidden',
    justifyContent: 'center',
    alignItems: 'center',
  },
  gridOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'transparent',
    opacity: 0.35,
    borderWidth: 0,
    borderColor: 'rgba(255,255,255,0.03)',
    backgroundImage: 'none' as unknown as undefined,
  },
  mapGlow: {
    position: 'absolute',
    width: 220,
    height: 220,
    borderRadius: 220,
    backgroundColor: 'rgba(47,207,180,0.16)',
    opacity: 0.9,
  },
  previewTag: {
    position: 'absolute',
    top: 16,
    left: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: 'rgba(10,16,26,0.82)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  previewTagText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '700',
  },
  centerCrosshair: {
    position: 'absolute',
    width: 88,
    height: 88,
    borderRadius: 88,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.18)',
    borderStyle: 'dashed',
  },
  routeRibbon: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: '50%',
    height: 1,
    transform: [{ translateY: -1 }],
    alignItems: 'center',
    justifyContent: 'center',
  },
  routePath: {
    position: 'relative',
    width: '82%',
    height: 90,
    justifyContent: 'center',
  },
  routeLine: {
    position: 'absolute',
    left: 18,
    right: 18,
    top: 45,
    height: 3,
    borderRadius: 999,
    backgroundColor: 'rgba(47,207,180,0.35)',
  },
  routeNode: {
    position: 'absolute',
    top: 38,
    width: 14,
    height: 14,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  routeNodeActive: {
    transform: [{ scale: 1.15 }],
  },
  routeNodeInner: {
    width: 10,
    height: 10,
    borderRadius: 10,
    backgroundColor: '#2FCFB4',
  },
  routeNodeInnerActive: {
    backgroundColor: '#fff',
    borderWidth: 3,
    borderColor: '#2FCFB4',
  },
  idleRouteState: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
  },
  idleRouteText: {
    color: 'rgba(255,255,255,0.70)',
    fontSize: 12,
    fontWeight: '700',
  },
  mapPin: {
    position: 'absolute',
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: 'rgba(47,207,180,0.18)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  mapPinLabel: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '800',
  },
  mapLegend: {
    position: 'absolute',
    right: 14,
    bottom: 14,
    gap: 6,
    padding: 12,
    borderRadius: 18,
    backgroundColor: 'rgba(10,16,26,0.82)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  legendRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  legendDot: {
    width: 8,
    height: 8,
    borderRadius: 8,
  },
  legendText: {
    color: 'rgba(255,255,255,0.74)',
    fontSize: 11,
    fontWeight: '700',
  },
  mapOverlay: {
    padding: 16,
    backgroundColor: 'rgba(10,16,26,0.92)',
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.06)',
  },
  overlayLabel: {
    color: 'rgba(255,255,255,0.60)',
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  overlayValue: {
    color: '#fff',
    fontSize: 16,
    lineHeight: 22,
    fontWeight: '800',
    marginTop: 6,
  },
  overlayMeta: {
    color: 'rgba(255,255,255,0.68)',
    fontSize: 13,
    marginTop: 6,
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  statCard: {
    width: '48.5%',
    borderRadius: 22,
    backgroundColor: 'rgba(255,255,255,0.07)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    padding: 14,
  },
  statLabel: {
    color: 'rgba(255,255,255,0.58)',
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  statValue: {
    color: '#fff',
    fontSize: 17,
    fontWeight: '800',
    marginTop: 8,
  },
  statHint: {
    color: 'rgba(255,255,255,0.64)',
    fontSize: 12,
    marginTop: 6,
  },
  routePanel: {
    borderRadius: 24,
    backgroundColor: 'rgba(16,24,37,0.88)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    overflow: 'hidden',
  },
  routeHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(255,255,255,0.08)',
  },
  routeTitle: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '800',
  },
  routeSubtitle: {
    color: 'rgba(255,255,255,0.62)',
    fontSize: 12,
    marginTop: 4,
  },
  routeBody: {
    padding: 16,
    gap: 10,
  },
  routeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 12,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.05)',
  },
  routeIndexBubble: {
    width: 30,
    height: 30,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(47,207,180,0.16)',
  },
  routeIndexText: {
    color: '#2FCFB4',
    fontSize: 12,
    fontWeight: '800',
  },
  routePointText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '700',
  },
  routePointMeta: {
    color: 'rgba(255,255,255,0.58)',
    fontSize: 11,
    marginTop: 4,
  },
  routeEmptyState: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: 10,
    borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.04)',
  },
  routeEmptyText: {
    color: 'rgba(255,255,255,0.60)',
    fontSize: 12,
    flex: 1,
  },
  bottomBar: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: 16,
    paddingBottom: 12,
    paddingTop: 10,
    backgroundColor: 'rgba(14,23,38,0.90)',
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.06)',
  },
  bottomBarContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  bottomBarLabel: {
    color: 'rgba(255,255,255,0.58)',
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  bottomBarValue: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '700',
    marginTop: 4,
  },
  bottomButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 11,
    borderRadius: 999,
    backgroundColor: '#2FCFB4',
  },
  bottomButtonText: {
    color: '#0E1726',
    fontSize: 13,
    fontWeight: '800',
  },
});
