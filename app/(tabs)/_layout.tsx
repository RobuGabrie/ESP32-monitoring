import { Ionicons } from '@expo/vector-icons';
import { Tabs } from 'expo-router';

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: '#2563EB',
        tabBarInactiveTintColor: '#6B7280',
        tabBarStyle: {
          height: 66,
          paddingTop: 8,
          paddingBottom: 8,
          backgroundColor: '#FFFFFF'
        },
        tabBarLabelStyle: {
          fontFamily: 'DMSans_500Medium',
          fontSize: 12
        }
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Home',
          tabBarIcon: ({ color, size }) => <Ionicons name="home-outline" size={size} color={color} />
        }}
      />
      <Tabs.Screen
        name="sensors"
        options={{
          title: 'Sensors',
          tabBarIcon: ({ color, size }) => <Ionicons name="thermometer-outline" size={size} color={color} />
        }}
      />
      <Tabs.Screen
        name="power"
        options={{
          title: 'Power',
          tabBarIcon: ({ color, size }) => <Ionicons name="flash-outline" size={size} color={color} />
        }}
      />
      <Tabs.Screen
        name="network"
        options={{
          title: 'Network',
          tabBarIcon: ({ color, size }) => <Ionicons name="wifi-outline" size={size} color={color} />
        }}
      />
    </Tabs>
  );
}
