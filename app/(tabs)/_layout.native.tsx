import { Tabs, usePathname, useRouter } from 'expo-router';
import { Pressable, Text, useWindowDimensions, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { useAppTheme } from '@/hooks/useAppTheme';




export default function NativeTabsLayout() {
  const { theme } = useAppTheme();
  const { width } = useWindowDimensions();
  const isDesktop = width >= 768;

  return (
    <View style={{ flex: 1, flexDirection: 'row', backgroundColor: theme.colors.background }}>
      {isDesktop}
      <View style={{ flex: 1 }}>
        <Tabs
          initialRouteName="start"
          screenOptions={{
            headerShown: false,
            tabBarActiveTintColor: theme.colors.primary,
            tabBarInactiveTintColor: theme.colors.muted,
            tabBarShowLabel: false,
            tabBarStyle: { display: 'none' },
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
              backgroundColor: theme.colors.background,
              paddingBottom: 0
            }
          }}
        >
          <Tabs.Screen
            name="start"
            options={{ href: null, tabBarStyle: { display: 'none' } }}
          />
          <Tabs.Screen
            name="index"
            options={{
              title: 'Dashboard',
              tabBarIcon: ({ color, focused }) => (
                <View style={{ width: 42, height: 42, borderRadius: 16, alignItems: 'center', justifyContent: 'center', backgroundColor: focused ? '#2FCFB4' : 'transparent', marginTop: 1 }}>
                  <Ionicons name="home-outline" size={22} color={focused ? '#fff' : color} />
                </View>
              )
            }}
          />
          <Tabs.Screen
            name="connect"
            options={{ href: null, tabBarStyle: { display: 'none' } }}
          />
          <Tabs.Screen
            name="telemetrie"
            options={{
              title: 'GPS',
              tabBarIcon: ({ color, focused }) => (
                <View style={{ width: 42, height: 42, borderRadius: 16, alignItems: 'center', justifyContent: 'center', backgroundColor: focused ? '#2FCFB4' : 'transparent', marginTop: 1 }}>
                  <Ionicons name="map-outline" size={22} color={focused ? '#fff' : color} />
                </View>
              )
            }}
          />
          <Tabs.Screen
            name="settings"
            options={{
              title: 'Setări',
              tabBarIcon: ({ color, focused }) => (
                <View style={{ width: 42, height: 42, borderRadius: 16, alignItems: 'center', justifyContent: 'center', backgroundColor: focused ? '#2FCFB4' : 'transparent', marginTop: 1 }}>
                  <Ionicons name="settings-outline" size={22} color={focused ? '#fff' : color} />
                </View>
              )
            }}
          />

     
          <Tabs.Screen name="cube" options={{ href: null }} />
        </Tabs>
      </View>
    </View>
  );
}
