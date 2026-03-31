import { ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { IMUCube } from '@/components/IMUCube';
import { SectionHeader } from '@/components/SectionHeader';
import { TabHero } from '@/components/TabHero';
import { theme } from '@/constants/theme';
import { useESP32 } from '@/hooks/useESP32';

export default function CubeScreen() {
  const { data, status } = useESP32();

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.content}>
        <TabHero
          title="3D IMU Cube"
          subtitle="Orientare in timp real pe baza MPU9250 (accelerometru + giroscop)."
          statusLabel={status === 'offline' ? 'Offline' : 'Conectat'}
          statusTone={status === 'offline' ? 'offline' : 'online'}
          meta={[
            { label: 'Sensor', value: 'MPU9250' },
            { label: 'Cadenta', value: 'Live stream' }
          ]}
        />

        <SectionHeader title="Vizualizare 3D" count={1} />
        <View style={styles.cubeWrap}>
          <IMUCube
            accelX={data?.accelX}
            accelY={data?.accelY}
            accelZ={data?.accelZ}
            gyroX={data?.gyroX}
            gyroY={data?.gyroY}
            gyroZ={data?.gyroZ}
          />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: theme.colors.background },
  content: { padding: 14, paddingBottom: 100 },
  cubeWrap: {
    borderRadius: theme.radius.lg,
    borderWidth: 1,
    borderColor: '#DDE6F0',
    backgroundColor: '#F7FAFC',
    padding: 10
  }
});
