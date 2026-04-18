import { ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ScreenShell } from '@/components/ScreenShell';
import { useAppTheme } from '@/hooks/useAppTheme';

export default function HistoryScreen() {
  const { theme } = useAppTheme();

  return (
    <ScreenShell>
      <SafeAreaView edges={['top', 'left', 'right']} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={{ padding: 16 }}>
          <View
            style={{
              borderRadius: 20,
              borderWidth: 1,
              borderColor: theme.colors.border,
              backgroundColor: theme.colors.surfaceRaised,
              padding: 16,
              gap: 8
            }}
          >
            <Text style={{ color: theme.colors.text, fontSize: 18, fontFamily: theme.font.bold }}>
              Istoric sesiuni
            </Text>
            <Text style={{ color: theme.colors.textSoft, fontSize: 13, lineHeight: 19, fontFamily: theme.font.medium }}>
              Ecranul pentru istoricul sesiunilor este gata pentru integrarea listei de salturi salvate.
            </Text>
          </View>
        </ScrollView>
      </SafeAreaView>
    </ScreenShell>
  );
}
