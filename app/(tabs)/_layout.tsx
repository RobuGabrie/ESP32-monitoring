import { Tabs, usePathname, useRouter } from 'expo-router';
import { Pressable, Text, useWindowDimensions, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { useAppTheme } from '@/hooks/useAppTheme';

const NAV_ITEMS = [
  { route: '/', icon: 'grid-outline' as const, label: 'Dashboard' },
  { route: '/cube', icon: 'cube-outline' as const, label: '3D Cube' },
  { route: '/sensors', icon: 'hardware-chip-outline' as const, label: 'Sensors' },
  { route: '/settings', icon: 'settings-outline' as const, label: 'Settings' }
] as const;

function Sidebar() {
  const { theme } = useAppTheme();
  const pathname = usePathname();
  const router = useRouter();

  return (
    <View
      style={{
        width: 60,
        backgroundColor: theme.colors.surfaceRaised,
        borderRightWidth: 1,
        borderRightColor: theme.colors.border,
        paddingVertical: 20,
        alignItems: 'center',
        gap: 8
      }}
    >
      <View
        style={{
          width: 36,
          height: 36,
          backgroundColor: theme.colors.primary,
          borderRadius: 10,
          borderCurve: 'continuous',
          alignItems: 'center',
          justifyContent: 'center',
          marginBottom: 16
        }}
      >
        <Text style={{ fontSize: 16, color: '#fff' }}>⚡</Text>
      </View>

      {NAV_ITEMS.slice(0, 3).map((item) => {
        const active = pathname === item.route || (item.route === '/' && pathname === '/index');
        return (
          <Pressable
            key={item.route}
            onPress={() => {
              if (active) {
                return;
              }
              router.push(item.route as '/');
            }}
            style={{
              width: 40,
              height: 40,
              borderRadius: 10,
              borderCurve: 'continuous',
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: active ? theme.colors.surfaceMuted : 'transparent'
            }}
          >
            <Ionicons
              name={item.icon}
              size={20}
              color={active ? theme.colors.text : theme.colors.muted}
            />
          </Pressable>
        );
      })}

      <View
        style={{
          width: 24,
          height: 1,
          backgroundColor: theme.colors.border,
          marginVertical: 8
        }}
      />

      {NAV_ITEMS.slice(3).map((item) => {
        const active = pathname === item.route;
        return (
          <Pressable
            key={item.route}
            onPress={() => {
              if (active) {
                return;
              }
              router.push(item.route as '/');
            }}
            style={{
              width: 40,
              height: 40,
              borderRadius: 10,
              borderCurve: 'continuous',
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: active ? theme.colors.surfaceMuted : 'transparent'
            }}
          >
            <Ionicons
              name={item.icon}
              size={20}
              color={active ? theme.colors.text : theme.colors.muted}
            />
          </Pressable>
        );
      })}
    </View>
  );
}

export default function TabsLayout() {
  const { theme, themeMode } = useAppTheme();
  const { width } = useWindowDimensions();
  const isDesktop = width >= 768;

  return (
    <View style={{ flex: 1, flexDirection: 'row', backgroundColor: theme.colors.background }}>
      {isDesktop && <Sidebar />}
      <View style={{ flex: 1 }}>
        <Tabs
          screenOptions={{
            headerShown: false,
            tabBarActiveTintColor: theme.colors.primary,
            tabBarInactiveTintColor: theme.colors.muted,
            tabBarStyle: isDesktop
              ? { display: 'none' }
              : {
                  height: 52,
                  borderTopWidth: 1,
                  borderTopColor: theme.colors.border,
                  backgroundColor: themeMode === 'dark' ? 'rgba(20,20,20,0.95)' : 'rgba(247,236,222,0.96)',
                  paddingBottom: 4,
                  paddingTop: 4
                },
            tabBarItemStyle: {
              paddingVertical: 0,
              marginVertical: -1
            },
            tabBarLabelStyle: {
              fontFamily: theme.font.medium,
              fontSize: 10,
              marginTop: 0,
              marginBottom: 0
            },
            sceneStyle: {
              backgroundColor: theme.colors.background
            }
          }}
        >
          <Tabs.Screen
            name="index"
            options={{
              title: 'Dashboard',
              tabBarIcon: ({ color }) => <Ionicons name="grid-outline" size={22} color={color} />
            }}
          />
          <Tabs.Screen
            name="cube"
            options={{
              title: '3D Cube',
              tabBarIcon: ({ color }) => <Ionicons name="cube-outline" size={22} color={color} />
            }}
          />
          <Tabs.Screen
            name="sensors"
            options={{
              title: 'Sensors',
              tabBarIcon: ({ color }) => <Ionicons name="hardware-chip-outline" size={22} color={color} />
            }}
          />
          <Tabs.Screen
            name="connect"
            options={{ href: null }}
          />
          <Tabs.Screen
            name="telemetrie"
            options={{
              title: 'Telemetrie',
              tabBarIcon: ({ color }) => <Ionicons name="pulse-outline" size={22} color={color} />
            }}
          />
          <Tabs.Screen
            name="settings"
            options={{
              title: 'Settings',
              tabBarIcon: ({ color }) => <Ionicons name="settings-outline" size={22} color={color} />
            }}
          />
          <Tabs.Screen name="safety" options={{ href: null }} />
        </Tabs>
      </View>
    </View>
  );
}
