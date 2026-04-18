import { useMemo } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';

import { ScreenShell } from '@/components/ScreenShell';
import { useAppTheme } from '@/hooks/useAppTheme';
import { useConnectivity } from '@/hooks/useConnectivity';

function formatReading(value: number | null | undefined, fractionDigits = 0, suffix = '') {
	if (value == null || !Number.isFinite(value)) {
		return '--';
	}

	return `${value.toFixed(fractionDigits)}${suffix}`;
}

function InfoTile({ label, value }: { label: string; value: string }) {
	const { theme } = useAppTheme();

	return (
		<View
			style={{
				width: '48.5%',
				backgroundColor: theme.colors.surface,
				borderRadius: 14,
				borderWidth: 1,
				borderColor: theme.colors.border,
				padding: 12,
				marginBottom: 10,
			}}
		>
			<Text style={{ fontSize: 11, color: theme.colors.textSoft, fontFamily: theme.font.medium }}>{label}</Text>
			<Text style={{ fontSize: 16, color: theme.colors.text, fontFamily: theme.font.bold, marginTop: 4 }} numberOfLines={1}>{value}</Text>
		</View>
	);
}

export default function TelemetrieScreen() {
	const { theme } = useAppTheme();
	const router = useRouter();
	const { currentData, connectivityState } = useConnectivity();

	const isOnline = connectivityState.connectionStatus === 'online';
	const dataAgeSec = connectivityState.lastDataReceived
		? Math.max(0, Math.round((Date.now() - connectivityState.lastDataReceived.getTime()) / 1000))
		: null;

	const detailRows = useMemo(
		() => [
			{ label: 'Temperatura', value: formatReading(currentData?.temp, 1, '°C') },
			{ label: 'CPU', value: formatReading(currentData?.cpu, 0, '%') },
			{ label: 'Curent', value: formatReading(currentData?.current, 0, ' mA') },
			{ label: 'Tensiune', value: formatReading(currentData?.volt, 2, ' V') },
			{ label: 'Putere', value: formatReading(currentData?.powerMw, 0, ' mW') },
			{ label: 'Baterie', value: formatReading(currentData?.batteryPercent, 0, '%') },
			{ label: 'Gyro X', value: formatReading(currentData?.gyroX, 1, '°/s') },
			{ label: 'Gyro Y', value: formatReading(currentData?.gyroY, 1, '°/s') },
			{ label: 'Gyro Z', value: formatReading(currentData?.gyroZ, 1, '°/s') },
			{ label: 'IMU Roll', value: formatReading(currentData?.roll, 1, '°') },
			{ label: 'IMU Pitch', value: formatReading(currentData?.pitch, 1, '°') },
			{ label: 'IMU Yaw', value: formatReading(currentData?.yaw, 1, '°') },
			{ label: 'IMU Seq', value: currentData?.imuSeq != null ? `${currentData.imuSeq}` : '--' },
			{ label: 'Quaternion q0', value: formatReading(currentData?.q0, 3) },
			{ label: 'Quaternion q1', value: formatReading(currentData?.q1, 3) },
			{ label: 'Quaternion q2', value: formatReading(currentData?.q2, 3) },
			{ label: 'Quaternion q3', value: formatReading(currentData?.q3, 3) },
			{ label: 'Stationary', value: currentData?.stationary == null ? '--' : currentData.stationary ? 'Da' : 'Nu' },
			{ label: 'Uptime', value: currentData?.uptime != null ? `${Math.floor(currentData.uptime / 60)} min` : '--' },
		],
		[currentData]
	);

	return (
		<ScreenShell contentStyle={{ paddingHorizontal: 0, paddingTop: 0 }}>
			<SafeAreaView edges={['top', 'left', 'right']} style={{ flex: 1 }}>
				<ScrollView contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 10, paddingBottom: 24 }}>
					<View
						style={{
							backgroundColor: isOnline ? 'rgba(26,188,82,0.10)' : theme.colors.surfaceRaised,
							borderRadius: 16,
							borderWidth: 1,
							borderColor: isOnline ? 'rgba(26,188,82,0.30)' : theme.colors.border,
							padding: 14,
							marginBottom: 14,
							flexDirection: 'row',
							alignItems: 'center',
							justifyContent: 'space-between',
							gap: 10,
						}}
					>
						<View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1 }}>
							<Ionicons
								name={isOnline ? 'radio-outline' : 'bluetooth-outline'}
								size={16}
								color={isOnline ? theme.colors.success : theme.colors.primary}
							/>
							<View style={{ flex: 1 }}>
								<Text style={{ fontSize: 13, color: theme.colors.text, fontFamily: theme.font.bold }}>
									{isOnline ? 'Conectat la dispozitiv' : 'Nu exista conexiune activa'}
								</Text>
								<Text style={{ fontSize: 11, color: theme.colors.textSoft, fontFamily: theme.font.medium }}>
									{dataAgeSec == null ? 'Nu am primit inca date.' : `Ultimul pachet: ${dataAgeSec}s in urma`}
								</Text>
							</View>
						</View>

						<Pressable
							onPress={() => router.push('/connect')}
							style={({ pressed }) => ({
								height: 34,
								paddingHorizontal: 12,
								borderRadius: 10,
								backgroundColor: theme.colors.surface,
								borderWidth: 1,
								borderColor: theme.colors.border,
								alignItems: 'center',
								justifyContent: 'center',
								opacity: pressed ? 0.75 : 1,
							})}
						>
							<Text style={{ color: theme.colors.text, fontSize: 12, fontFamily: theme.font.bold }}>Gestioneaza BLE</Text>
						</Pressable>
					</View>

					<View
						style={{
							backgroundColor: theme.colors.surfaceRaised,
							borderRadius: 20,
							borderWidth: 1,
							borderColor: theme.colors.border,
							padding: 14,
							...theme.shadow.card,
						}}
					>
						<Text style={{ fontSize: 15, color: theme.colors.text, fontFamily: theme.font.bold, marginBottom: 10 }}>
							Date telemetrie senzori
						</Text>
						<View style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between' }}>
							{detailRows.map((row) => (
								<InfoTile key={row.label} label={row.label} value={row.value} />
							))}
						</View>
					</View>
				</ScrollView>
			</SafeAreaView>
		</ScreenShell>
	);
}
