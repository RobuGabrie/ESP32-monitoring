import { StyleSheet, Text, View } from 'react-native';

import { theme } from '@/constants/theme';

interface Props {
  temp: number;
  light: number;
  lightRaw: number;
  volt: number;
  powerMw: number;
  batteryPercent: number;
  uptime: number;
}

export function StatsBanner({ temp, light, lightRaw, volt, powerMw, batteryPercent, uptime }: Props) {
  const metrics = [
    { title: 'Temp', value: `${temp.toFixed(1)}°C` },
    { title: 'Light', value: `${Math.round(light)}% (${Math.round(lightRaw)}/255)` },
    { title: 'Voltage', value: `${volt.toFixed(2)} V` },
    { title: 'Power', value: `${Math.round(powerMw)} mW` },
    { title: 'Battery', value: `${Math.round(batteryPercent)}%` },
    { title: 'Uptime', value: `${Math.round(uptime)} s` }
  ];

  return (
    <View style={styles.container}>
      {metrics.map((metric) => (
        <Stat key={metric.title} title={metric.title} value={metric.value} />
      ))}
    </View>
  );
}

function Stat({ title, value }: { title: string; value: string }) {
  return (
    <View style={styles.stat}>
      <Text style={styles.title}>{title}</Text>
      <Text style={styles.value}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: theme.colors.primary,
    borderRadius: theme.radius.lg,
    paddingVertical: 10,
    paddingHorizontal: 8,
    flexDirection: 'row',
    flexWrap: 'wrap',
    rowGap: 8,
    columnGap: 8,
    marginBottom: theme.spacing.lg
  },
  stat: {
    width: '31%',
    minHeight: 58,
    borderRadius: 10,
    backgroundColor: 'rgba(255,255,255,0.12)',
    paddingVertical: 8,
    paddingHorizontal: 8
  },
  title: {
    fontSize: 11,
    color: '#DBEAFE',
    fontFamily: theme.font.medium,
    marginBottom: 3
  },
  value: {
    fontSize: 14,
    color: '#FFFFFF',
    fontFamily: theme.font.bold
  }
});
