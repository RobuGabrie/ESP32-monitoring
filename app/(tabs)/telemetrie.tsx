import { Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';

import { useTelemetry } from '@/hooks/TelemetryContext';

const formatCoordinate = (value: number, positiveLabel: string, negativeLabel: string) => {
  const label = value >= 0 ? positiveLabel : negativeLabel;
  return `${Math.abs(value).toFixed(5)}° ${label}`;
};

export default function TelemetrieWeb() {
  const router = useRouter();
  const { isTracking, currentLocation, routePoints, startLocation, endLocation } = useTelemetry();
  const hasLocation = !!currentLocation || !!startLocation || !!endLocation;
  const activePoint = currentLocation ?? startLocation ?? endLocation ?? null;

  return (
    <View style={{ flex: 1, backgroundColor: '#0E1726' }}>
      <SafeAreaView edges={['top', 'left', 'right', 'bottom']} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 28, gap: 14 }} showsVerticalScrollIndicator={false}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
            <Pressable onPress={() => router.back()} style={{ width: 40, height: 40, borderRadius: 14, backgroundColor: 'rgba(255,255,255,0.10)', alignItems: 'center', justifyContent: 'center' }}>
              <Ionicons name="chevron-back" size={18} color="#fff" />
            </Pressable>
            <View style={{ alignItems: 'center' }}>
              <Text style={{ color: '#2FCFB4', fontSize: 11, letterSpacing: 1.2, textTransform: 'uppercase', fontWeight: '800' }}>GPS Live</Text>
              <Text style={{ color: '#fff', fontSize: 18, fontWeight: '800', marginTop: 4 }}>Harta web</Text>
            </View>
            <View style={{ width: 40 }} />
          </View>

          <View style={{ borderRadius: 28, backgroundColor: 'rgba(16,24,37,0.92)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)', padding: 18, gap: 14 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
              <View>
                <Text style={{ color: 'rgba(255,255,255,0.62)', fontSize: 11, fontWeight: '700', textTransform: 'uppercase' }}>Stare</Text>
                <Text style={{ color: '#fff', fontSize: 16, fontWeight: '800', marginTop: 6 }}>{isTracking ? 'Urmărire activă' : 'Vizualizare live'}</Text>
              </View>
              <View style={{ paddingHorizontal: 12, paddingVertical: 8, borderRadius: 999, backgroundColor: isTracking ? 'rgba(47,207,180,0.16)' : 'rgba(66,141,255,0.16)' }}>
                <Text style={{ color: isTracking ? '#2FCFB4' : '#428DFF', fontSize: 12, fontWeight: '800' }}>{isTracking ? 'Timer pornit' : 'Timer oprit'}</Text>
              </View>
            </View>

            {activePoint ? (
              <View style={{ gap: 8 }}>
                <Text style={{ color: '#fff', fontSize: 15, fontWeight: '800' }}>Poziție curentă</Text>
                <Text style={{ color: 'rgba(255,255,255,0.72)', fontSize: 14, lineHeight: 21 }}>
                  {formatCoordinate(activePoint.latitude, 'N', 'S')} · {formatCoordinate(activePoint.longitude, 'E', 'W')}
                </Text>
                <Text style={{ color: 'rgba(255,255,255,0.62)', fontSize: 13 }}>Altitudine {typeof activePoint.altitude === 'number' ? `${Math.round(activePoint.altitude)} m` : '—'}</Text>
              </View>
            ) : (
              <View style={{ borderRadius: 20, padding: 16, backgroundColor: 'rgba(255,255,255,0.05)', gap: 8 }}>
                <Text style={{ color: '#fff', fontSize: 15, fontWeight: '800' }}>Așteptare GPS</Text>
                <Text style={{ color: 'rgba(255,255,255,0.72)', fontSize: 13, lineHeight: 20 }}>
                  Nu există încă o poziție fixată. După ce telefonul primește un semnal GPS, datele vor apărea aici chiar și fără timer.
                </Text>
              </View>
            )}
          </View>

          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
            <View style={{ width: '48.5%', borderRadius: 22, backgroundColor: 'rgba(255,255,255,0.07)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)', padding: 14 }}>
              <Text style={{ color: 'rgba(255,255,255,0.58)', fontSize: 11, fontWeight: '700', textTransform: 'uppercase' }}>Rută</Text>
              <Text style={{ color: '#fff', fontSize: 17, fontWeight: '800', marginTop: 8 }}>{routePoints.length}</Text>
              <Text style={{ color: 'rgba(255,255,255,0.64)', fontSize: 12, marginTop: 6 }}>puncte salvate</Text>
            </View>
            <View style={{ width: '48.5%', borderRadius: 22, backgroundColor: 'rgba(255,255,255,0.07)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)', padding: 14 }}>
              <Text style={{ color: 'rgba(255,255,255,0.58)', fontSize: 11, fontWeight: '700', textTransform: 'uppercase' }}>Stare GPS</Text>
              <Text style={{ color: '#fff', fontSize: 17, fontWeight: '800', marginTop: 8 }}>{hasLocation ? 'Activ' : 'Inactiv'}</Text>
              <Text style={{ color: 'rgba(255,255,255,0.64)', fontSize: 12, marginTop: 6 }}>sursă live</Text>
            </View>
          </View>

          <View style={{ borderRadius: 24, backgroundColor: 'rgba(16,24,37,0.88)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)', padding: 16, gap: 10 }}>
            <Text style={{ color: '#fff', fontSize: 15, fontWeight: '800' }}>Ce urmează</Text>
            <Text style={{ color: 'rgba(255,255,255,0.72)', fontSize: 13, lineHeight: 20 }}>
              Pe web vezi acum doar telemetria și starea actuală. Harta detaliată rămâne disponibilă pe aplicația nativă, unde GPS-ul este urmărit direct.
            </Text>
          </View>
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}
