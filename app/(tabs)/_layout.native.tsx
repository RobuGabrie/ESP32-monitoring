import { Tabs, usePathname, useRouter } from 'expo-router';
import { Platform, Pressable, Text, useWindowDimensions, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useAppTheme } from '@/hooks/useAppTheme';

const NAV_ITEMS = [
  { route: '/', icon: 'home-outline' as const, label: 'Acasă' },
  { route: '/telemetrie', icon: 'pulse-outline' as const, label: 'Telemetrie' },
  { route: '/safety', icon: 'shield-checkmark-outline' as const, label: 'Siguranță' },
  { route: '/sensors', icon: 'hardware-chip-outline' as const, label: 'Senzori' },
  { route: '/settings', icon: 'settings-outline' as const, label: 'Setări' }
] as const;

function Sidebar() {
  const { theme } = useAppTheme();
  const pathname = usePathname();
  const router = useRouter();

  return (
    <View
      style={{
        width: 72,
        backgroundColor: theme.colors.surfaceRaised,
        borderRightWidth: 1,
        borderRightColor: theme.colors.border,
        paddingVertical: 18,
        alignItems: 'center',
        gap: 10
      }}
    >
      <View
        style={{
          width: 36,
          height: 36,
          backgroundColor: theme.colors.primary,
          borderRadius: 14,
          borderCurve: 'continuous',
          alignItems: 'center',
          justifyContent: 'center',
          marginBottom: 18,
          ...theme.shadow.card
        }}
      >
        <Text style={{ fontSize: 16, color: '#fff' }}>⚡</Text>
      </View>

      {NAV_ITEMS.map((item) => {
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
              width: 44,
              height: 44,
              borderRadius: 14,
              borderCurve: 'continuous',
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: active ? theme.colors.surfaceMuted : 'transparent'
            }}
          >
            <Ionicons
              name={item.icon}
              size={21}
              color={active ? theme.colors.text : theme.colors.muted}
            />
          </Pressable>
        );
      })}
    </View>
  );
}

export default function NativeTabsLayout() {
  const { theme } = useAppTheme();
  const { width } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const isDesktop = width >= 768;
  const bottomInset = insets.bottom;
  const tabBarBottomPadding = Platform.OS === 'android' ? Math.max(bottomInset, 8) : Math.max(bottomInset, 8);

  return (
    <View style={{ flex: 1, flexDirection: 'row', backgroundColor: theme.colors.background }}>
      {isDesktop && <Sidebar />}
      <View style={{ flex: 1 }}>
        <Tabs
          screenOptions={{
            headerShown: false,
            tabBarActiveTintColor: theme.colors.primary,
            tabBarInactiveTintColor: theme.colors.muted,
            tabBarShowLabel: false,
            tabBarStyle: isDesktop
              ? { display: 'none' }
              : {
                  position: 'absolute',
                  left: 12,
                  right: 12,
                  bottom: tabBarBottomPadding,
                  height: 60,
                  borderTopWidth: 0,
                  borderRadius: 22,
                  backgroundColor: 'rgba(255,248,240,0.98)',
                  paddingBottom: 1,
                  paddingTop: 7,
                  paddingHorizontal: 4,
                  ...theme.shadow.floating
                },
            tabBarItemStyle: {
              paddingVertical: 2,
              marginVertical: 0,
              marginHorizontal: 0,
              flex: 1,
              alignItems: 'center',
              justifyContent: 'center'
            },
            tabBarIconStyle: {
              marginTop: 2,
              alignSelf: 'center'
            },
            sceneStyle: {
              backgroundColor: theme.colors.background
            }
          }}
        >
          <Tabs.Screen
            name="index"
            options={{
              title: 'Acasă',
              tabBarIcon: ({ color, focused }) => (
                <View style={{ width: 40, height: 40, borderRadius: 16, alignItems: 'center', justifyContent: 'center', backgroundColor: focused ? theme.colors.primary : 'transparent', marginTop: 1 }}>
                  <Ionicons name="home-outline" size={22} color={focused ? '#fff' : color} />
                </View>
              )
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
              tabBarIcon: ({ color, focused }) => (
                <View style={{ width: 40, height: 40, borderRadius: 16, alignItems: 'center', justifyContent: 'center', backgroundColor: focused ? theme.colors.primary : 'transparent', marginTop: 1 }}>
                  <Ionicons name="pulse-outline" size={22} color={focused ? '#fff' : color} />
                </View>
              )
            }}
          />
          <Tabs.Screen
            name="safety"
            options={{
              title: 'Siguranță',
              tabBarIcon: ({ color, focused }) => (
                <View style={{ width: 40, height: 40, borderRadius: 16, alignItems: 'center', justifyContent: 'center', backgroundColor: focused ? theme.colors.primary : 'transparent', marginTop: 1 }}>
                  <Ionicons name="shield-checkmark-outline" size={22} color={focused ? '#fff' : color} />
                </View>
              )
            }}
          />
          <Tabs.Screen
            name="sensors"
            options={{ href: null }}
          />
          <Tabs.Screen
            name="settings"
            options={{ href: null }}
          />

          <Tabs.Screen name="cube" options={{ href: null }} />
        </Tabs>
      </View>
    </View>
  );
}
