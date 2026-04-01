import { StyleProp, StyleSheet, Text, View, ViewStyle } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { theme } from '@/constants/theme';

type StatusSummaryCardProps = {
  label: string;
  value: string;
  icon: keyof typeof Ionicons.glyphMap;
  accent: string;
  iconColor?: string;
  style?: StyleProp<ViewStyle>;
};

export function StatusSummaryCard({
  label,
  value,
  icon,
  accent,
  iconColor = '#1E3A8A',
  style
}: StatusSummaryCardProps) {
  return (
    <View style={[styles.card, style]}>
      <View style={styles.header}>
        <View style={[styles.iconWrap, { backgroundColor: accent }]}> 
          <Ionicons name={icon} size={13} color={iconColor} />
        </View>
        <Text style={styles.label}>{label}</Text>
      </View>
      <Text style={styles.value}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    flexGrow: 1,
    minWidth: 150,
    backgroundColor: '#F7FAFE',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#DCE7F3',
    paddingVertical: 12,
    paddingHorizontal: 12,
    minHeight: 86
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7
  },
  iconWrap: {
    width: 20,
    height: 20,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center'
  },
  label: {
    color: theme.colors.textSoft,
    ...theme.type.cardLabel
  },
  value: {
    marginTop: 7,
    color: theme.colors.text,
    ...theme.type.cardValue,
    lineHeight: 30
  }
});
