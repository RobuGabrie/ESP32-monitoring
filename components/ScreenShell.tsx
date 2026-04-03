import { ReactNode, useMemo, useState } from 'react';
import { Modal, Platform, Pressable, StyleProp, StyleSheet, Switch, Text, useWindowDimensions, View, ViewStyle } from 'react-native';

import { AppTheme } from '@/constants/theme';
import { useAppTheme } from '@/hooks/useAppTheme';
import { TimeRangeKey } from '@/hooks/useStore';

interface Props {
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
  contentStyle?: StyleProp<ViewStyle>;
  screenTitle?: string;
  screenSubtitle?: string;
  onExport?: () => void;
  selectedRange?: TimeRangeKey;
  onRangeChange?: (range: TimeRangeKey) => void;
}

const RANGE_OPTIONS: { key: TimeRangeKey; label: string }[] = [
  { key: '60s', label: 'Ultimele 60 secunde' },
  { key: '15m', label: 'Ultimele 15 minute' },
  { key: '1h', label: 'Ultima ora' },
  { key: '6h', label: 'Ultimele 6 ore' },
  { key: '24h', label: 'Ultimele 24 ore' },
  { key: '7d', label: 'Ultimele 7 zile' },
  { key: 'all', label: 'Toata istoria' }
];

const rangeLabel = (range: TimeRangeKey) => RANGE_OPTIONS.find((option) => option.key === range)?.label ?? 'Ultimele 60 secunde';

function TopBarPill({ children, theme }: { children: ReactNode; theme: AppTheme }) {
  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        backgroundColor: theme.colors.card,
        borderWidth: 1,
        borderColor: theme.colors.border,
        paddingHorizontal: 14,
        paddingVertical: 9,
        borderRadius: 8
      }}
    >
      {children}
    </View>
  );
}

function HeaderBar({
  title,
  subtitle,
  onExport,
  theme,
  themeMode,
  onToggleThemeMode,
  isDesktop,
  selectedRange,
  onRangeChange
}: {
  title: string;
  subtitle: string;
  onExport?: () => void;
  theme: AppTheme;
  themeMode: 'light' | 'dark';
  onToggleThemeMode: () => void;
  isDesktop: boolean;
  selectedRange?: TimeRangeKey;
  onRangeChange?: (range: TimeRangeKey) => void;
}) {
  const activeRange = selectedRange ?? '60s';
  const [rangeModalVisible, setRangeModalVisible] = useState(false);
  const [rangeWebMenuVisible, setRangeWebMenuVisible] = useState(false);
  const isWeb = Platform.OS === 'web';

  const onRangePress = () => {
    if (!onRangeChange) {
      return;
    }

    if (isWeb) {
      setRangeWebMenuVisible((current) => !current);
      return;
    }

    setRangeModalVisible(true);
  };

  return (
    <View
      style={{
        minHeight: isDesktop ? 64 : 92,
        flexDirection: isDesktop ? 'row' : 'column',
        alignItems: isDesktop ? 'center' : 'stretch',
        justifyContent: 'space-between',
        gap: isDesktop ? 0 : 8,
        paddingHorizontal: isDesktop ? 24 : 12,
        paddingVertical: isDesktop ? 0 : 10,
        position: 'relative',
        overflow: 'visible',
        zIndex: isWeb ? 60 : 1,
        borderBottomWidth: 1,
        borderBottomColor: theme.colors.border
      }}
    >
      <View>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <Text style={{ fontSize: 18, fontFamily: theme.font.bold, color: theme.colors.text }}>{title}</Text>
          <Text style={{ color: theme.colors.primary, fontSize: 13 }}>●</Text>
        </View>
        <Text style={{ fontSize: 13, color: theme.colors.textSoft, marginTop: 2 }}>{subtitle}</Text>
      </View>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
        <Pressable onPress={onRangePress}>
          <TopBarPill theme={theme}>
            <Text style={{ fontSize: 14, color: theme.colors.textSoft }}>⏱</Text>
            <Text style={{ fontSize: 13, color: theme.colors.textSoft, fontFamily: theme.font.medium }} numberOfLines={1}>
              {rangeLabel(activeRange)}
            </Text>
            <Text style={{ fontSize: 13, color: theme.colors.muted }}>›</Text>
          </TopBarPill>
        </Pressable>
        <TopBarPill theme={theme}>
          <Text style={{ fontSize: 13, color: theme.colors.textSoft, fontFamily: theme.font.medium }}>
            {themeMode === 'dark' ? 'Dark' : 'Light'}
          </Text>
          <Switch
            value={themeMode === 'dark'}
            onValueChange={onToggleThemeMode}
            thumbColor={Platform.OS === 'android' ? '#ffffff' : undefined}
            trackColor={{ false: theme.colors.border, true: theme.colors.primary }}
            ios_backgroundColor={theme.colors.border}
          />
        </TopBarPill>
        {onExport && (
          <Pressable
            onPress={onExport}
            style={{
              backgroundColor: theme.colors.primary,
              paddingHorizontal: isDesktop ? 18 : 14,
              paddingVertical: isDesktop ? 10 : 9,
              borderRadius: 8
            }}
          >
            <Text style={{ color: '#fff', fontSize: 14, fontFamily: theme.font.bold }}>⚡ AI Export</Text>
          </Pressable>
        )}
      </View>

      {isWeb && rangeWebMenuVisible ? (
        <View
          style={{
            position: 'absolute',
            top: isDesktop ? 56 : 86,
            right: isDesktop ? (onExport ? 168 : 24) : 12,
            width: 280,
            backgroundColor: theme.colors.card,
            borderRadius: 12,
            borderWidth: 1,
            borderColor: theme.colors.border,
            padding: 8,
            gap: 6,
            zIndex: 50,
            ...theme.shadow.floating
          }}
        >
          <Text style={{ color: theme.colors.text, fontFamily: theme.font.bold, fontSize: 14 }}>Alege intervalul</Text>
          {RANGE_OPTIONS.map((option) => {
            const isActive = option.key === activeRange;
            return (
              <Pressable
                key={option.key}
                onPress={() => {
                  onRangeChange?.(option.key);
                  setRangeWebMenuVisible(false);
                }}
                style={{
                  backgroundColor: isActive ? theme.colors.surfaceAlt : theme.colors.card,
                  borderWidth: 1,
                  borderColor: isActive ? theme.colors.primary : theme.colors.border,
                  borderRadius: 9,
                  paddingHorizontal: 10,
                  paddingVertical: 9
                }}
              >
                <Text
                  style={{
                    color: isActive ? theme.colors.primary : theme.colors.text,
                    fontFamily: isActive ? theme.font.bold : theme.font.medium,
                    fontSize: 13
                  }}
                >
                  {isActive ? `${option.label} ✓` : option.label}
                </Text>
              </Pressable>
            );
          })}
        </View>
      ) : null}

      <Modal visible={!isWeb && rangeModalVisible} transparent animationType="fade" onRequestClose={() => setRangeModalVisible(false)}>
        <Pressable
          style={{
            flex: 1,
            backgroundColor: 'rgba(0, 0, 0, 0.4)',
            justifyContent: 'center',
            paddingHorizontal: 16
          }}
          onPress={() => setRangeModalVisible(false)}
        >
          <Pressable
            style={{
              backgroundColor: theme.colors.card,
              borderRadius: 14,
              borderWidth: 1,
              borderColor: theme.colors.border,
              paddingVertical: 10,
              paddingHorizontal: 10,
              gap: 4,
              ...theme.shadow.floating
            }}
            onPress={(event) => event.stopPropagation()}
          >
            <Text style={{ color: theme.colors.text, fontFamily: theme.font.bold, fontSize: 16 }}>Alege intervalul</Text>
            <Text style={{ color: theme.colors.textSoft, fontFamily: theme.font.regular, fontSize: 12, marginBottom: 4 }}>
              Acest interval se aplica pe toate graficele si datele din dashboard.
            </Text>

            {RANGE_OPTIONS.map((option) => {
              const isActive = option.key === activeRange;
              return (
                <Pressable
                  key={option.key}
                  onPress={() => {
                    onRangeChange?.(option.key);
                    setRangeModalVisible(false);
                  }}
                  style={{
                    backgroundColor: isActive ? theme.colors.surfaceAlt : theme.colors.card,
                    borderWidth: 1,
                    borderColor: isActive ? theme.colors.primary : theme.colors.border,
                    borderRadius: 10,
                    paddingHorizontal: 12,
                    paddingVertical: 10
                  }}
                >
                  <Text
                    style={{
                      color: isActive ? theme.colors.primary : theme.colors.text,
                      fontFamily: isActive ? theme.font.bold : theme.font.medium,
                      fontSize: 14
                    }}
                  >
                    {isActive ? `${option.label} ✓` : option.label}
                  </Text>
                </Pressable>
              );
            })}

            <Pressable
              onPress={() => setRangeModalVisible(false)}
              style={{
                marginTop: 2,
                backgroundColor: theme.colors.surfaceMuted,
                borderWidth: 1,
                borderColor: theme.colors.border,
                borderRadius: 10,
                paddingHorizontal: 12,
                paddingVertical: 10,
                alignItems: 'center'
              }}
            >
              <Text style={{ color: theme.colors.textSoft, fontFamily: theme.font.medium, fontSize: 13 }}>Anuleaza</Text>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

export function ScreenShell({ children, style, contentStyle, screenTitle, screenSubtitle, onExport, selectedRange, onRangeChange }: Props) {
  const { theme, themeMode, toggleThemeMode } = useAppTheme();
  const { width } = useWindowDimensions();
  const isDesktop = width >= 768;
  const styles = useMemo(() => createStyles(theme), [theme]);

  return (
    <View style={[styles.shell, style]}>
      {screenTitle && (
        <HeaderBar
          title={screenTitle}
          subtitle={screenSubtitle ?? ''}
          onExport={onExport}
          theme={theme}
          themeMode={themeMode}
          onToggleThemeMode={toggleThemeMode}
          isDesktop={isDesktop}
          selectedRange={selectedRange}
          onRangeChange={onRangeChange}
        />
      )}
      <View style={[styles.content, contentStyle]}>{children}</View>
    </View>
  );
}

const createStyles = (theme: AppTheme) => StyleSheet.create({
  shell: {
    width: '100%',
    gap: theme.spacing.md
  },
  content: {
    width: '100%',
    paddingHorizontal: theme.spacing.md,
    paddingTop: theme.spacing.md,
    paddingBottom: theme.spacing.md
  }
});
