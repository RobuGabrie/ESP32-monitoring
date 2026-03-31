import { Tabs } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

import { theme } from '@/constants/theme';

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: '#1D4ED8',
        tabBarInactiveTintColor: '#64748B',
        tabBarStyle: {
          height: 64,
          borderTopWidth: 1,
          borderTopColor: '#E2E8F0',
          backgroundColor: theme.colors.card,
          paddingBottom: 8,
          paddingTop: 6
        },
        tabBarLabelStyle: {
          fontFamily: theme.font.medium,
          fontSize: 11
        }
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Dashboard',
          tabBarIcon: ({ color, size }) => <Ionicons name="grid-outline" size={size} color={color} />
        }}
      />
      <Tabs.Screen
        name="cube"
        options={{
          title: '3D Cube',
          tabBarIcon: ({ color, size }) => <Ionicons name="cube-outline" size={size} color={color} />
        }}
      />
      <Tabs.Screen
        name="sensors"
        options={{
          title: 'Sensors',
          tabBarIcon: ({ color, size }) => <Ionicons name="hardware-chip-outline" size={size} color={color} />
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: 'Settings',
          tabBarIcon: ({ color, size }) => <Ionicons name="settings-outline" size={size} color={color} />
        }}
      />
    </Tabs>
  );
}
