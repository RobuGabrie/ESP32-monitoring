import { useEffect } from 'react';
import { ImageBackground, Pressable, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';

import { useAppTheme } from '@/hooks/useAppTheme';
import { useConnectivity } from '@/hooks/useConnectivity';

export default function StartScreen() {
  const { theme } = useAppTheme();
  const { connectivityState, startupConnectionState } = useConnectivity();
  const router = useRouter();
  const isOnline = connectivityState.connectionStatus === 'online';

  useEffect(() => {
    AsyncStorage.setItem('app.start.completed', '1').catch(() => {});
  }, []);

  useEffect(() => {
    if (isOnline) {
      router.replace('/');
    }
  }, [isOnline, router]);

  return (
    <View style={{ flex: 1, backgroundColor: '#1C2230' }}>
      <ImageBackground
        source={require('../../assets/start.jpg')}
        resizeMode="cover"
        style={{ flex: 1 }}
        imageStyle={{ opacity: 0.65 }}
      >
        <View style={{ position: 'absolute', left: 0, right: 0, top: 0, bottom: 0, backgroundColor: 'rgba(28,34,48,0.52)' }} />
        <View style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: 280, backgroundColor: 'rgba(28,34,48,0.74)' }} />

        <SafeAreaView edges={['top', 'left', 'right', 'bottom']} style={{ flex: 1 }}>
          <View style={{ flex: 1, paddingHorizontal: 28, paddingBottom: 30 }}>
            <View style={{marginTop: 'auto', gap: 12 }}>
              <Text
                style={{
                  color: '#fff',
                  fontSize: 46,
                  lineHeight: 46,
                  fontFamily: theme.font.bold,
                  letterSpacing: -1.1
                }}
              >
                Monitor.
                {'\n'}
                Protect.
                {'\n'}
                Fly Safe.
              </Text>
              <Text style={{ color: 'rgba(255,255,255,0.58)', fontSize: 14, lineHeight: 21, fontFamily: theme.font.medium }}>
                Monitorizare în timp real pentru salt, senzori și siguranță.
              </Text>

              <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
                <View style={{ backgroundColor: 'rgba(255,255,255,0.14)', borderRadius: 999, paddingVertical: 6, paddingHorizontal: 10 }}>
                  <Text style={{ color: '#fff', fontSize: 11, fontFamily: theme.font.bold }}>
                    {startupConnectionState.hasRememberedDevice ? 'Dispozitiv memorat' : 'Fără dispozitiv memorat'}
                  </Text>
                </View>
                <View style={{ backgroundColor: 'rgba(255,255,255,0.14)', borderRadius: 999, paddingVertical: 6, paddingHorizontal: 10 }}>
                  <Text style={{ color: '#fff', fontSize: 11, fontFamily: theme.font.bold }}>
                    {isOnline ? 'Conectat' : 'Offline'}
                  </Text>
                </View>
              </View>
            </View>

            <View style={{ marginTop: 22, gap: 10 }}>
              <Pressable
                onPress={() => router.push('/connect')}
                style={({ pressed }) => ({
                  height: 58,
                  borderRadius: 999,
                  backgroundColor: '#2FCFB4',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexDirection: 'row',
                  gap: 10,
                  opacity: pressed ? 0.9 : 1,
                  shadowColor: '#2FCFB4',
                  shadowOpacity: 0.35,
                  shadowRadius: 18,
                  shadowOffset: { width: 0, height: 8 },
                  elevation: 9
                })}
              >
                <Text style={{ color: '#fff', fontSize: 16, fontFamily: theme.font.bold }}>Conectează-te</Text>
                <View style={{ width: 28, height: 28, borderRadius: 14, backgroundColor: 'rgba(255,255,255,0.22)', alignItems: 'center', justifyContent: 'center' }}>
                  <Ionicons name="arrow-forward" size={13} color="#fff" />
                </View>
              </Pressable>

              {isOnline && (
                <Pressable
                  onPress={() => router.replace('/')}
                  style={({ pressed }) => ({
                    height: 44,
                    borderRadius: 14,
                    backgroundColor: 'rgba(255,255,255,0.08)',
                    borderWidth: 1,
                    borderColor: 'rgba(255,255,255,0.22)',
                    alignItems: 'center',
                    justifyContent: 'center',
                    opacity: pressed ? 0.85 : 1
                  })}
                >
                  <Text style={{ color: '#fff', fontSize: 13, fontFamily: theme.font.bold }}>
                    Continuă la dashboard (deja conectat)
                  </Text>
                </Pressable>
              )}
            </View>
          </View>
        </SafeAreaView>
      </ImageBackground>
    </View>
  );
}
