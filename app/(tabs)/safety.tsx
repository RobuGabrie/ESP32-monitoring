import { useEffect, useState } from 'react';
import { ScrollView, Text, View, Pressable, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';

import { ScreenShell } from '@/components/ScreenShell';
import { useAppTheme } from '@/hooks/useAppTheme';
import { useConnectivity } from '@/hooks/useConnectivity';

interface SafetyAlert {
  id: string;
  type: 'critical' | 'warning' | 'info';
  title: string;
  message: string;
  timestamp: string;
  acknowledged: boolean;
}

export default function SafetyScreen() {
  const { theme } = useAppTheme();
  const { currentData, analytics, sendCommand } = useConnectivity();

  const [alerts, setAlerts] = useState<SafetyAlert[]>([]);
  const [emergencyMode, setEmergencyMode] = useState(false);

  // ── Alert generation (logic unchanged) ──────────────────────────────────
  useEffect(() => {
    const newAlerts: SafetyAlert[] = [];

    if (analytics?.predictions) {
      const { predictions } = analytics;
      if (predictions.fallDetected) newAlerts.push({ id: 'fall-detected', type: 'critical', title: 'Cădere necontrolată detectată', message: 'Este necesară acțiune imediată. Se recomandă deschiderea parașutei.', timestamp: new Date().toISOString(), acknowledged: false });
      if (predictions.rotationExcessive) newAlerts.push({ id: 'rotation-excessive', type: 'warning', title: 'Rotație excesivă', message: 'Rotația corpului depășește limitele sigure. Corectează poziția imediat.', timestamp: new Date().toISOString(), acknowledged: false });
      if (predictions.unconscious) newAlerts.push({ id: 'unconscious', type: 'critical', title: 'Stare de inconștiență detectată', message: 'Nu a fost detectată mișcare. Poate fi necesară intervenția de urgență.', timestamp: new Date().toISOString(), acknowledged: false });
      if (predictions.stressLevel > 80) newAlerts.push({ id: 'high-stress', type: 'warning', title: 'Nivel ridicat de stres', message: `Nivelul de stres este ${predictions.stressLevel}%. Respiră adânc și concentrează-te.`, timestamp: new Date().toISOString(), acknowledged: false });
    }

    if (currentData) {
      if (currentData.heartRate && (currentData.heartRate < 50 || currentData.heartRate > 150)) newAlerts.push({ id: 'abnormal-heart-rate', type: 'warning', title: 'Ritm cardiac anormal', message: `Ritm cardiac: ${currentData.heartRate} BPM. Solicită ajutor medical dacă persistă.`, timestamp: new Date().toISOString(), acknowledged: false });
      if (currentData.bloodOxygen && currentData.bloodOxygen < 90) newAlerts.push({ id: 'low-oxygen', type: 'critical', title: 'Oxigen în sânge scăzut', message: `Oxigen în sânge: ${currentData.bloodOxygen}%. Coboară imediat.`, timestamp: new Date().toISOString(), acknowledged: false });
      if (currentData.bodyTemp && (currentData.bodyTemp < 35 || currentData.bodyTemp > 40)) newAlerts.push({ id: 'abnormal-temperature', type: 'warning', title: 'Temperatură corporală anormală', message: `Temperatura corporală: ${currentData.bodyTemp}°C. Monitorizează atent.`, timestamp: new Date().toISOString(), acknowledged: false });
    }

    setAlerts(newAlerts);
  }, [analytics, currentData]);

  const acknowledgeAlert = (alertId: string) => setAlerts((prev) => prev.map((a) => a.id === alertId ? { ...a, acknowledged: true } : a));

  const triggerEmergency = () => {
    Alert.alert('Semnal de urgență', 'Acest lucru va trimite un semnal de urgență către echipă și echipa de la sol. Ești sigur?', [
      { text: 'Anulează', style: 'cancel' },
      { text: 'Trimite urgența', style: 'destructive', onPress: async () => {
        try {
          await sendCommand('emergency', { location: 'current_gps' });
          setEmergencyMode(true);
          Alert.alert('Semnal trimis', 'Ajutorul este pe drum.');
        } catch { Alert.alert('Eroare', 'Nu s-a putut trimite semnalul de urgență.'); }
      }}
    ]);
  };

  const activeAlerts = alerts.filter((a) => !a.acknowledged);
  const hasCritical = activeAlerts.some((a) => a.type === 'critical');

  const alertColor = (type: SafetyAlert['type']) =>
    type === 'critical' ? theme.colors.error : type === 'warning' ? theme.colors.warning : theme.colors.primary;

  const vitalRows = [
    { icon: 'heart-outline' as const, iconColor: theme.colors.error, iconBg: 'rgba(226,75,74,0.10)', label: 'Ritm cardiac', note: 'Normal 60–100 BPM', value: currentData?.heartRate ? `${currentData.heartRate} BPM` : '—' },
    { icon: 'water-outline' as const, iconColor: theme.colors.primary, iconBg: 'rgba(15,142,207,0.10)', label: 'Oxigen sânge', note: 'Normal >95%', value: currentData?.bloodOxygen ? `${currentData.bloodOxygen}%` : '—' },
    { icon: 'thermometer-outline' as const, iconColor: theme.colors.warning, iconBg: 'rgba(239,159,39,0.12)', label: 'Temperatură corporală', note: 'Normal 36–37.5°C', value: currentData?.bodyTemp ? `${currentData.bodyTemp.toFixed(1)}°C` : '—' },
    { icon: 'battery-half-outline' as const, iconColor: theme.colors.success, iconBg: 'rgba(26,188,82,0.10)', label: 'Baterie dispozitiv', note: 'Ultimul raport BLE', value: currentData?.batteryPercent ? `${currentData.batteryPercent}%` : '—' },
  ];

  const checklist = [
    'Dispozitivul purtabil este încărcat și conectat',
    'Semnalul GPS este puternic',
    'Contactele de urgență sunt configurate',
    'Condițiile meteo au fost verificate',
    'Inspecția echipamentului este finalizată',
  ];

  // ── Shared card wrapper ─────────────────────────────────────────────────
  const Card = ({ children, style }: { children: React.ReactNode; style?: object }) => (
    <View style={{ backgroundColor: theme.colors.surfaceRaised, borderRadius: 20, borderWidth: 1, borderColor: theme.colors.border, marginHorizontal: 16, marginTop: 14, overflow: 'hidden', ...theme.shadow.card, ...style }}>
      {children}
    </View>
  );

  return (
    <ScreenShell contentStyle={{ padding: 0 }}>
      <SafeAreaView edges={['top', 'left', 'right']} style={{ flex: 1 }}>
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 32 }}>

          {/* Top bar */}
          <View style={{ flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', paddingHorizontal: 16, paddingTop: 14 }}>
            <View>
              <Text style={{ fontSize: 20, fontFamily: theme.font.bold, color: theme.colors.text, letterSpacing: -0.3 }}>Monitor siguranță</Text>
              <Text style={{ fontSize: 12, fontFamily: theme.font.medium, color: theme.colors.textSoft, marginTop: 2 }}>Monitorizare în timp real</Text>
            </View>
            <View style={{ width: 36, height: 36, borderRadius: 10, borderWidth: 1, borderColor: theme.colors.border, backgroundColor: theme.colors.surface, alignItems: 'center', justifyContent: 'center' }}>
              <Ionicons name="ellipsis-horizontal" size={16} color={theme.colors.text} />
            </View>
          </View>

          {/* Emergency button */}
          <Pressable onPress={triggerEmergency}
            style={({ pressed }) => ({
              marginHorizontal: 16, marginTop: 14, borderRadius: 18,
              borderWidth: 1.5, borderColor: theme.colors.error,
              backgroundColor: emergencyMode ? 'rgba(226,75,74,0.07)' : theme.colors.surfaceRaised,
              overflow: 'hidden', opacity: pressed ? 0.88 : 1,
              ...theme.shadow.card
            })}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14, padding: 16 }}>
              <View style={{ width: 48, height: 48, borderRadius: 14, backgroundColor: 'rgba(226,75,74,0.10)', alignItems: 'center', justifyContent: 'center' }}>
                <Ionicons name="medical-outline" size={24} color={theme.colors.error} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 16, fontFamily: theme.font.bold, color: theme.colors.error }}>
                  {emergencyMode ? 'URGENȚĂ ACTIVĂ' : 'Trimite semnal urgență'}
                </Text>
                <Text style={{ fontSize: 12, fontFamily: theme.font.medium, color: theme.colors.textSoft, marginTop: 3, lineHeight: 17 }}>
                  {emergencyMode ? 'Semnal trimis. Ajutorul este pe drum.' : 'Apasă pentru a alerta echipa și echipa de la sol'}
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={16} color={theme.colors.textSoft} />
            </View>
          </Pressable>

          {/* Status row */}
          <View style={{ flexDirection: 'row', gap: 10, marginHorizontal: 16, marginTop: 14 }}>
            {/* Safety status */}
            <View style={{ flex: 1, backgroundColor: theme.colors.surfaceRaised, borderRadius: 16, borderWidth: 1, borderColor: theme.colors.border, padding: 14, alignItems: 'center', gap: 4, ...theme.shadow.card }}>
              <View style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: hasCritical ? 'rgba(226,75,74,0.10)' : 'rgba(26,188,82,0.12)', alignItems: 'center', justifyContent: 'center' }}>
                <Ionicons name={hasCritical ? 'warning-outline' : 'checkmark-circle-outline'} size={20} color={hasCritical ? theme.colors.error : theme.colors.success} />
              </View>
              <Text style={{ fontSize: 15, fontFamily: theme.font.bold, color: hasCritical ? theme.colors.error : theme.colors.success, marginTop: 4 }}>
                {hasCritical ? 'Critic' : 'Sigur'}
              </Text>
              <Text style={{ fontSize: 11, fontFamily: theme.font.medium, color: theme.colors.textSoft }}>Stare siguranță</Text>
            </View>
            {/* Alert count */}
            <View style={{ flex: 1, backgroundColor: theme.colors.surfaceRaised, borderRadius: 16, borderWidth: 1, borderColor: theme.colors.border, padding: 14, alignItems: 'center', gap: 4, ...theme.shadow.card }}>
              <View style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: 'rgba(242,106,45,0.10)', alignItems: 'center', justifyContent: 'center' }}>
                <Ionicons name="alert-outline" size={20} color="#F26A2D" />
              </View>
              <Text style={{ fontSize: 32, fontFamily: theme.font.bold, color: '#F26A2D', lineHeight: 36 }}>{activeAlerts.length}</Text>
              <Text style={{ fontSize: 11, fontFamily: theme.font.medium, color: theme.colors.textSoft }}>Alerte active</Text>
            </View>
          </View>

          {/* Section label */}
          <Text style={{ fontSize: 11, fontFamily: theme.font.bold, color: theme.colors.textSoft, paddingHorizontal: 16, marginTop: 18, marginBottom: 6, letterSpacing: 0.5 }}>
            SEMNE VITALE
          </Text>

          {/* Vitals */}
          <Card>
            {vitalRows.map((row, i) => (
              <View key={row.label} style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 13, paddingHorizontal: 16, borderBottomWidth: i < vitalRows.length - 1 ? 1 : 0, borderBottomColor: theme.colors.border }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                  <View style={{ width: 32, height: 32, borderRadius: 9, backgroundColor: row.iconBg, alignItems: 'center', justifyContent: 'center' }}>
                    <Ionicons name={row.icon} size={16} color={row.iconColor} />
                  </View>
                  <View>
                    <Text style={{ fontSize: 14, fontFamily: theme.font.bold, color: theme.colors.text }}>{row.label}</Text>
                    <Text style={{ fontSize: 11, fontFamily: theme.font.medium, color: theme.colors.textSoft, marginTop: 1 }}>{row.note}</Text>
                  </View>
                </View>
                <Text style={{ fontSize: 16, fontFamily: theme.font.bold, color: theme.colors.text }}>{row.value}</Text>
              </View>
            ))}
          </Card>

          {/* Active alerts */}
          {activeAlerts.length > 0 && (
            <>
              <Text style={{ fontSize: 11, fontFamily: theme.font.bold, color: theme.colors.textSoft, paddingHorizontal: 16, marginTop: 18, marginBottom: 6, letterSpacing: 0.5 }}>
                ALERTE ACTIVE
              </Text>
              <Card>
                {activeAlerts.map((alert, i) => (
                  <View key={alert.id} style={{ padding: 14, borderBottomWidth: i < activeAlerts.length - 1 ? 1 : 0, borderBottomColor: theme.colors.border }}>
                    <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 10, marginBottom: 10 }}>
                      <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: alertColor(alert.type), marginTop: 5, flexShrink: 0 }} />
                      <View style={{ flex: 1 }}>
                        <Text style={{ fontSize: 14, fontFamily: theme.font.bold, color: theme.colors.text }}>{alert.title}</Text>
                        <Text style={{ fontSize: 12, fontFamily: theme.font.medium, color: theme.colors.textSoft, marginTop: 3, lineHeight: 17 }}>{alert.message}</Text>
                      </View>
                    </View>
                    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                      <Text style={{ fontSize: 11, fontFamily: theme.font.medium, color: theme.colors.textSoft }}>
                        {new Date(alert.timestamp).toLocaleTimeString('ro-RO')}
                      </Text>
                      <Pressable onPress={() => acknowledgeAlert(alert.id)}
                        style={({ pressed }) => ({ paddingVertical: 5, paddingHorizontal: 12, borderRadius: 99, backgroundColor: theme.colors.surface, borderWidth: 1, borderColor: theme.colors.border, opacity: pressed ? 0.7 : 1 })}
                      >
                        <Text style={{ fontSize: 12, fontFamily: theme.font.bold, color: theme.colors.text }}>Confirmă</Text>
                      </Pressable>
                    </View>
                  </View>
                ))}
              </Card>
            </>
          )}

          {/* Checklist */}
          <Text style={{ fontSize: 11, fontFamily: theme.font.bold, color: theme.colors.textSoft, paddingHorizontal: 16, marginTop: 18, marginBottom: 6, letterSpacing: 0.5 }}>
            VERIFICARE PRE-SALT
          </Text>
          <Card>
            {checklist.map((item, i) => (
              <View key={i} style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 11, paddingHorizontal: 16, borderBottomWidth: i < checklist.length - 1 ? 1 : 0, borderBottomColor: theme.colors.border }}>
                <View style={{ width: 22, height: 22, borderRadius: 11, backgroundColor: 'rgba(26,188,82,0.12)', borderWidth: 1, borderColor: 'rgba(26,188,82,0.4)', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <Ionicons name="checkmark" size={13} color={theme.colors.success} />
                </View>
                <Text style={{ flex: 1, fontSize: 13, fontFamily: theme.font.medium, color: theme.colors.text, lineHeight: 18 }}>{item}</Text>
              </View>
            ))}
          </Card>

        </ScrollView>
      </SafeAreaView>
    </ScreenShell>
  );
}