// app/(tabs)/settings.tsx

import React from 'react';
import { ScrollView, Pressable, StyleSheet, Switch, View, useColorScheme } from 'react-native';
import { Text } from 'tamagui';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { useSettingsStore } from '../../src/stores/settingsStore';
import {
  LIGHT_THEMES,
  DARK_THEMES,
  getThemeById,
} from '../../src/theme/readerThemes';
import type { ReaderThemeDefinition } from '../../src/theme/readerThemes';

function ThemeCircle({
  theme,
  isActive,
  onPress,
  borderColorForInactive,
}: {
  theme: ReaderThemeDefinition;
  isActive: boolean;
  onPress: () => void;
  borderColorForInactive: string;
}) {
  const { t } = useTranslation();

  return (
    <Pressable onPress={onPress} style={styles.themeCircleWrapper}>
      <View
        style={[
          styles.themeCircle,
          {
            backgroundColor: theme.preview,
            borderColor: isActive ? '#6c63ff' : borderColorForInactive,
            borderWidth: isActive ? 3 : 2,
          },
        ]}
      >
        {isActive && (
          <Text
            fontSize={14}
            color={theme.group === 'dark' ? '#FFFFFF' : '#333333'}
          >
            ✓
          </Text>
        )}
      </View>
      <Text fontSize={10} color="$textSecondary" textAlign="center" numberOfLines={1}>
        {t(theme.nameKey)}
      </Text>
    </Pressable>
  );
}

export default function SettingsScreen() {
  const settings = useSettingsStore();
  const { t } = useTranslation();
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';

  // Adaptive colors for Settings screen (follows system theme, NOT reader theme)
  const colors = {
    bg: isDark ? '#1c1c1e' : '#FFFFFF',
    text: isDark ? '#FFFFFF' : '#000000',
    textSecondary: isDark ? '#8e8e93' : '#6b6b6b',
    surface: isDark ? '#2c2c2e' : '#f0f0f0',
    circleBorder: isDark ? '#555555' : '#cccccc',
  };

  const fontSizeStep = (delta: number) => {
    const next = settings.fontSize + delta;
    if (next >= 14 && next <= 28) {
      settings.setFontSize(next);
    }
  };

  const lineHeightStep = (delta: number) => {
    const next = Math.round((settings.lineHeight + delta) * 10) / 10;
    if (next >= 1.2 && next <= 2.0) {
      settings.setLineHeight(next);
    }
  };

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: colors.bg }]}>
      <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>
        <Text fontSize={24} fontWeight="bold" marginBottom={24} color={colors.text}>
          {t('settings.title')}
        </Text>

        {/* ─── Reading section ─── */}
        <Text fontSize={18} fontWeight="600" marginBottom={16} color={colors.text}>
          {t('settings.reading')}
        </Text>

        {/* Day theme */}
        <Text fontSize={14} color={colors.textSecondary} marginBottom={8}>
          {t('settings.dayTheme')}
        </Text>
        <View style={styles.themesRow}>
          {LIGHT_THEMES.map((theme) => (
            <ThemeCircle
              key={theme.id}
              theme={theme}
              isActive={settings.lightThemeId === theme.id}
              onPress={() => settings.setLightThemeId(theme.id)}
              borderColorForInactive={colors.circleBorder}
            />
          ))}
        </View>

        {/* Night theme */}
        <Text fontSize={14} color={colors.textSecondary} marginBottom={8} marginTop={8}>
          {t('settings.nightTheme')}
        </Text>
        <View style={styles.themesRow}>
          {DARK_THEMES.map((theme) => (
            <ThemeCircle
              key={theme.id}
              theme={theme}
              isActive={settings.darkThemeId === theme.id}
              onPress={() => settings.setDarkThemeId(theme.id)}
              borderColorForInactive={colors.circleBorder}
            />
          ))}
        </View>

        {/* Auto day/night */}
        <View style={styles.switchRow}>
          <View style={styles.switchLabel}>
            <Text fontSize={16} color={colors.text}>{t('settings.autoTheme')}</Text>
            <Text fontSize={12} color={colors.textSecondary}>
              {t('settings.autoThemeSubtitle')}
            </Text>
          </View>
          <Switch
            value={settings.autoTheme}
            onValueChange={settings.setAutoTheme}
            trackColor={{ false: colors.circleBorder, true: '#6c63ff' }}
          />
        </View>

        {/* Scroll mode */}
        <Text fontSize={14} color={colors.textSecondary} marginBottom={8} marginTop={16}>
          {t('settings.scrollMode')}
        </Text>
        <View style={styles.segmentRow}>
          <Pressable
            style={[
              styles.segmentButton,
              { backgroundColor: colors.surface },
              settings.scrollMode === 'paginated' && styles.segmentActive,
            ]}
            onPress={() => settings.setScrollMode('paginated')}
          >
            <Text
              fontSize={14}
              color={settings.scrollMode === 'paginated' ? '#FFFFFF' : colors.text}
            >
              {t('settings.scrollModePaginated')}
            </Text>
          </Pressable>
          <Pressable
            style={[
              styles.segmentButton,
              { backgroundColor: colors.surface },
              settings.scrollMode === 'scroll' && styles.segmentActive,
            ]}
            onPress={() => settings.setScrollMode('scroll')}
          >
            <Text
              fontSize={14}
              color={settings.scrollMode === 'scroll' ? '#FFFFFF' : colors.text}
            >
              {t('settings.scrollModeScroll')}
            </Text>
          </Pressable>
        </View>

        {/* Font size */}
        <Text fontSize={14} color={colors.textSecondary} marginBottom={8} marginTop={16}>
          {t('settings.fontSize')}
        </Text>
        <View style={styles.stepperRow}>
          <Pressable style={[styles.stepperButton, { backgroundColor: colors.surface }]} onPress={() => fontSizeStep(-1)}>
            <Text fontSize={16} fontWeight="600" color={colors.text}>A-</Text>
          </Pressable>
          <Text fontSize={18} fontWeight="500" color={colors.text}>{settings.fontSize}</Text>
          <Pressable style={[styles.stepperButton, { backgroundColor: colors.surface }]} onPress={() => fontSizeStep(1)}>
            <Text fontSize={20} fontWeight="600" color={colors.text}>A+</Text>
          </Pressable>
        </View>

        {/* Font family */}
        <Text fontSize={14} color={colors.textSecondary} marginBottom={8} marginTop={16}>
          {t('settings.font')}
        </Text>
        <View style={styles.segmentRow}>
          {([
            { value: 'System', label: t('settings.fontSystem') },
            { value: 'Georgia', label: t('settings.fontSerif') },
            { value: 'sans-serif', label: t('settings.fontSansSerif') },
          ] as const).map(({ value, label }) => (
            <Pressable
              key={value}
              style={[
                styles.segmentButton,
                { backgroundColor: colors.surface },
                settings.fontFamily === value && styles.segmentActive,
              ]}
              onPress={() => settings.setFontFamily(value)}
            >
              <Text
                fontSize={14}
                color={settings.fontFamily === value ? '#FFFFFF' : colors.text}
                fontFamily={value as any}
              >
                {label}
              </Text>
            </Pressable>
          ))}
        </View>

        {/* Line height */}
        <Text fontSize={14} color={colors.textSecondary} marginBottom={8} marginTop={16}>
          {t('settings.lineHeight')}
        </Text>
        <View style={styles.stepperRow}>
          <Pressable style={[styles.stepperButton, { backgroundColor: colors.surface }]} onPress={() => lineHeightStep(-0.1)}>
            <Text fontSize={16} fontWeight="600" color={colors.text}>−</Text>
          </Pressable>
          <Text fontSize={18} fontWeight="500" color={colors.text}>{settings.lineHeight.toFixed(1)}</Text>
          <Pressable style={[styles.stepperButton, { backgroundColor: colors.surface }]} onPress={() => lineHeightStep(0.1)}>
            <Text fontSize={16} fontWeight="600" color={colors.text}>+</Text>
          </Pressable>
        </View>

        {/* Bottom spacing */}
        <View style={{ height: 40 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
  },
  scroll: {
    flex: 1,
  },
  content: {
    padding: 20,
  },
  themesRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 12,
  },
  themeCircleWrapper: {
    alignItems: 'center',
    gap: 4,
    width: 44,
  },
  themeCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  switchRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    marginTop: 8,
  },
  switchLabel: {
    flex: 1,
  },
  segmentRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 8,
  },
  segmentButton: {
    flex: 1,
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 8,
    alignItems: 'center',
  },
  segmentActive: {
    backgroundColor: '#6c63ff',
  },
  stepperRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 20,
    marginBottom: 8,
  },
  stepperButton: {
    width: 40,
    height: 40,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
