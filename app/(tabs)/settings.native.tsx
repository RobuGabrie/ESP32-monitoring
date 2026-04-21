import { useMemo } from 'react';
import { Alert, Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';

import { useAppTheme } from '@/hooks/useAppTheme';
import { useConnectivity } from '@/hooks/useConnectivity';

function SectionTitle({ title, subtitle }: { title: string; subtitle: string }) {
	const { theme } = useAppTheme();

	return (
		<View style={{ marginBottom: 12 }}>
			<Text style={{ fontSize: 18, fontFamily: theme.font.bold, color: theme.colors.text }}>{title}</Text>
			<Text style={{ fontSize: 12, fontFamily: theme.font.medium, color: theme.colors.textSoft, marginTop: 3 }}>{subtitle}</Text>
		</View>
	);
}

function SettingItem({
	icon,
	label,
	description,
	onPress,
	active,
	danger,
}: {
	icon: keyof typeof Ionicons.glyphMap;
	label: string;
	description: string;
	onPress?: () => void;
	active?: boolean;
	danger?: boolean;
}) {
	const { theme } = useAppTheme();

	return (
		<Pressable
			onPress={onPress}
			style={({ pressed }) => ({
				backgroundColor: danger ? 'rgba(255,93,124,0.08)' : active ? 'rgba(47,207,180,0.10)' : theme.colors.surface,
				borderRadius: 18,
				borderWidth: 1,
				borderColor: danger ? 'rgba(255,93,124,0.18)' : active ? 'rgba(47,207,180,0.22)' : theme.colors.border,
				padding: 14,
				flexDirection: 'row',
				alignItems: 'center',
				gap: 12,
				opacity: pressed ? 0.82 : 1,
			})}
		>
			<View style={{ width: 40, height: 40, borderRadius: 14, backgroundColor: danger ? 'rgba(255,93,124,0.14)' : 'rgba(47,207,180,0.16)', alignItems: 'center', justifyContent: 'center' }}>
				<Ionicons name={icon} size={18} color={danger ? '#FF5D7C' : '#2FCFB4'} />
			</View>
			<View style={{ flex: 1 }}>
				<Text style={{ fontSize: 15, fontFamily: theme.font.bold, color: theme.colors.text }}>{label}</Text>
				<Text style={{ fontSize: 12, fontFamily: theme.font.medium, color: theme.colors.textSoft, marginTop: 3, lineHeight: 17 }}>{description}</Text>
			</View>
			<Ionicons name="chevron-forward" size={16} color={theme.colors.textSoft} />
		</Pressable>
	);
}

export default function SettingsNativeScreen() {
	const { theme, toggleThemeMode, themeMode } = useAppTheme();
	const router = useRouter();
	const { connectivityState, disconnect, connectRememberedOrScan, startDiveSession, stopDiveSession, sendCommand } = useConnectivity();

	const isOnline = connectivityState.connectionStatus === 'online';
	const sessionActive = useMemo(() => connectivityState.connectionStatus === 'online' && connectivityState.hasReceivedData, [connectivityState]);

	return (
		<View style={{ flex: 1, backgroundColor: '#EDEEF2' }}>
			<SafeAreaView edges={['top', 'left', 'right', 'bottom']} style={{ flex: 1 }}>
				<ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 10, paddingBottom: 24 }}>
					<View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 18 }}>
						<View>
							<Text style={{ color: theme.colors.text, fontSize: 28, lineHeight: 30, fontFamily: theme.font.bold, letterSpacing: -0.8 }}>Setări</Text>
							<Text style={{ color: theme.colors.textSoft, fontSize: 12, fontFamily: theme.font.medium, marginTop: 3 }}>
								{isOnline ? 'Dispozitiv conectat' : 'Niciun dispozitiv conectat'}
							</Text>
						</View>
						<View style={{ width: 40, height: 40, borderRadius: 14, backgroundColor: theme.colors.surfaceRaised, borderWidth: 1, borderColor: theme.colors.border, alignItems: 'center', justifyContent: 'center' }}>
							<Ionicons name="settings-outline" size={18} color={theme.colors.text} />
						</View>
					</View>

					<View style={{ backgroundColor: theme.colors.surfaceRaised, borderRadius: 28, padding: 16, marginBottom: 14, borderWidth: 1, borderColor: theme.colors.border }}>
						<View style={{ position: 'absolute', left: 0, right: 0, top: 0, bottom: 0, backgroundColor: 'rgba(255,255,255,0.04)' }} />
						<View style={{ gap: 10 }}>
							<Text style={{ color: theme.colors.textSoft, fontSize: 12, fontFamily: theme.font.bold, letterSpacing: 1.2, textTransform: 'uppercase' }}>Conectivitate</Text>
							<Text style={{ color: theme.colors.text, fontSize: 26, lineHeight: 30, fontFamily: theme.font.bold }}>Skywatch onboard</Text>
							<Text style={{ color: theme.colors.textSoft, fontSize: 13, lineHeight: 18, fontFamily: theme.font.medium, maxWidth: 280 }}>
								Intră în ecranul de scanare BLE, conectează dispozitivul și controlează sesiunea de jump.
							</Text>

							<View style={{ flexDirection: 'row', gap: 8, marginTop: 6 }}>
								<Pressable
									onPress={async () => {
										router.push('/connect');
									}}
									style={{ flex: 1, backgroundColor: '#2FCFB4', borderRadius: 999, paddingVertical: 14, alignItems: 'center', justifyContent: 'center' }}
								>
									<Text style={{ color: '#fff', fontSize: 14, fontFamily: theme.font.bold }}>Deschide scanare BLE</Text>
								</Pressable>
								<Pressable
									onPress={() => {
										disconnect();
										Alert.alert('Deconectat', 'Conexiunea BLE a fost oprită.');
									}}
									style={{ width: 52, height: 52, borderRadius: 18, backgroundColor: theme.colors.surface, borderWidth: 1, borderColor: theme.colors.border, alignItems: 'center', justifyContent: 'center' }}
								>
									<Ionicons name="close" size={20} color={theme.colors.text} />
								</Pressable>
							</View>
						</View>
					</View>

					<View style={{ backgroundColor: theme.colors.surfaceRaised, borderRadius: 24, borderWidth: 1, borderColor: theme.colors.border, padding: 14, marginBottom: 14 }}>
						<SectionTitle title="Acțiuni rapide" subtitle="Control sesiune jump și aspect aplicație" />
						<View style={{ gap: 10 }}>
							<SettingItem
								icon="bluetooth-outline"
								label="Reconectează dispozitivul memorat"
								description="Încearcă mai întâi dispozitivul salvat, apoi scanează perifericele din apropiere."
								onPress={() => connectRememberedOrScan({ esp32Only: true, scanDurationMs: 6000, allowDuplicates: false, namePrefixes: ['ESP32', 'ESP32-C3', 'C3', 'Skydiver', 'skywatch'] })}
								active={isOnline}
							/>
							<SettingItem
								icon="play-circle-outline"
								label={sessionActive ? 'Oprește sesiunea jump' : 'Pornește sesiunea jump'}
								description={sessionActive ? 'Închide cronometrul curent de jump.' : 'Armează sesiunea de jump și logarea telemetriei.'}
								onPress={async () => {
									if (sessionActive) {
										await sendCommand('STOP');
										await stopDiveSession();
									} else {
										await startDiveSession();
										await sendCommand('START');
									}
								}}
								active={sessionActive}
							/>
							<SettingItem
								icon="color-palette-outline"
								label={themeMode === 'light' ? 'Comută pe temă dark' : 'Comută pe temă light'}
								description="Comută aspectul aplicației între cele două stiluri vizuale."
								onPress={toggleThemeMode}
							/>
						</View>
					</View>

					<View style={{ backgroundColor: theme.colors.surfaceRaised, borderRadius: 24, borderWidth: 1, borderColor: theme.colors.border, padding: 14, marginBottom: 14 }}>
						<SectionTitle title="Navigație" subtitle="Comută între ecranele native principale" />
						<View style={{ gap: 10 }}>
							<SettingItem icon="home-outline" label="Dashboard" description="Ecran principal cu control jump." onPress={() => router.push('/')} />
							<SettingItem icon="map-outline" label="GPS Live" description="Hartă, altitudine și telemetrie." onPress={() => router.push('/telemetrie')} />
							<SettingItem icon="settings-outline" label="Setări" description="Ecranul curent." onPress={() => router.push('/settings')} />
						</View>
					</View>

					<View style={{ backgroundColor: theme.colors.surfaceRaised, borderRadius: 24, borderWidth: 1, borderColor: theme.colors.border, padding: 14 }}>
						<SectionTitle title="Conexiune" subtitle="Status BLE și detalii sesiune" />
						<View style={{ flexDirection: 'row', gap: 8, marginBottom: 10 }}>
							<View style={{ flex: 1, backgroundColor: theme.colors.surface, borderRadius: 16, padding: 12 }}>
								<Text style={{ fontSize: 10, fontFamily: theme.font.bold, color: theme.colors.textSoft, textTransform: 'uppercase', letterSpacing: 0.8 }}>Status</Text>
								<Text style={{ fontSize: 18, fontFamily: theme.font.bold, color: isOnline ? '#2FCFB4' : theme.colors.textSoft, marginTop: 4 }}>{isOnline ? 'Dispozitiv conectat' : 'Niciun dispozitiv conectat'}</Text>
							</View>
							<View style={{ flex: 1, backgroundColor: theme.colors.surface, borderRadius: 16, padding: 12 }}>
								<Text style={{ fontSize: 10, fontFamily: theme.font.bold, color: theme.colors.textSoft, textTransform: 'uppercase', letterSpacing: 0.8 }}>Stream</Text>
								<Text style={{ fontSize: 18, fontFamily: theme.font.bold, color: theme.colors.text, marginTop: 4 }}>{connectivityState.dataStreamStatus.toUpperCase()}</Text>
							</View>
						</View>
						<View style={{ backgroundColor: theme.colors.surface, borderRadius: 16, borderWidth: 1, borderColor: theme.colors.border, padding: 12 }}>
							<Text style={{ fontSize: 12, fontFamily: theme.font.medium, color: theme.colors.textSoft, lineHeight: 18 }}>
								Diagnosticul de pairing și telemetrie este aliniat cu noul sistem vizual nativ. Conectează o dată, iar aplicația va memora dispozitivul pentru lansările următoare.
							</Text>
						</View>
					</View>
				</ScrollView>
			</SafeAreaView>
		</View>
	);
}
