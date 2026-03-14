// src/components/reader/ReaderSettingsSheet.tsx

import React, { useCallback } from 'react';
import { Pressable, StyleSheet, Switch, View } from 'react-native';
import { Text } from 'tamagui';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { useSettingsStore } from '../../stores/settingsStore';
import { useReaderTheme } from '../../hooks/useReaderTheme';
import {
  READER_THEMES,
  LIGHT_THEMES,
  DARK_THEMES,
  getThemeById,
} from '../../theme/readerThemes';
import type { ReaderThemeDefinition } from '../../theme/readerThemes';

interface ReaderSettingsSheetProps {
  visible: boolean;
  onClose: () => void;
}

const ALL_THEMES = [...LIGHT_THEMES, ...DARK_THEMES];

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
  return (
    <Pressable onPress={onPress}>
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
            style={styles.checkmark}
          >
            ✓
          </Text>
        )}
      </View>
    </Pressable>
  );
}

export function ReaderSettingsSheet({ visible, onClose }: ReaderSettingsSheetProps) {
  const settings = useSettingsStore();
  const readerTheme = useReaderTheme();
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const translateY = useSharedValue(400);

  React.useEffect(() => {
    translateY.value = visible
      ? withSpring(0, { damping: 20 })
      : withTiming(400, { duration: 200 });
  }, [visible, translateY]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }],
  }));

  // ─── Font size handlers ───
  const handleFontDecrease = useCallback(() => {
    if (settings.fontSize > 14) {
      settings.setFontSize(settings.fontSize - 1);
    }
  }, [settings]);

  const handleFontIncrease = useCallback(() => {
    if (settings.fontSize < 28) {
      settings.setFontSize(settings.fontSize + 1);
    }
  }, [settings]);

  // ─── Theme selection ───
  const handleThemeSelect = useCallback(
    (themeId: string) => {
      const selected = getThemeById(themeId);

      // Update the appropriate theme slot
      if (selected.group === 'light') {
        settings.setLightThemeId(themeId);
      } else {
        settings.setDarkThemeId(themeId);
      }

      // Always track as manual selection
      settings.setManualThemeId(themeId);
    },
    [settings],
  );

  const handlePairedThemeSelect = useCallback(
    (themeId: string) => {
      const selected = getThemeById(themeId);
      if (selected.group === 'light') {
        settings.setLightThemeId(themeId);
      } else {
        settings.setDarkThemeId(themeId);
      }
    },
    [settings],
  );

  const handleAutoThemeToggle = useCallback(
    (value: boolean) => {
      settings.setAutoTheme(value);
    },
    [settings],
  );

  if (!visible) return null;

  // Determine active theme ID for the main row
  const activeThemeId = readerTheme.id;

  // Determine paired theme row
  const showPairedRow = settings.autoTheme;
  const pairedThemes = readerTheme.group === 'dark' ? LIGHT_THEMES : DARK_THEMES;
  const pairedLabel =
    readerTheme.group === 'dark'
      ? t('reader.settings.dayTheme')
      : t('reader.settings.nightTheme');
  const pairedActiveId =
    readerTheme.group === 'dark' ? settings.lightThemeId : settings.darkThemeId;

  const circleBorder = readerTheme.colors.border;

  return (
    <>
      {/* Backdrop */}
      <Pressable style={StyleSheet.absoluteFill} onPress={onClose}>
        <Animated.View
          style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(0,0,0,0.3)' }]}
        />
      </Pressable>

      {/* Sheet */}
      <Animated.View
        style={[styles.sheetContainer, animatedStyle]}
      >
        <View
          style={[
            styles.sheet,
            {
              backgroundColor: readerTheme.colors.surface,
              paddingBottom: insets.bottom + 16,
            },
          ]}
        >
          {/* Drag handle */}
          <View style={styles.handleRow}>
            <View style={[styles.handle, { backgroundColor: readerTheme.colors.border }]} />
          </View>

          {/* Font size */}
          <View style={styles.row}>
            <Text fontSize={13} color={readerTheme.colors.textSecondary}>
              {t('reader.settings.fontSize')}
            </Text>
            <View style={styles.fontSizeControls}>
              <Pressable
                onPress={handleFontDecrease}
                style={[styles.fontButton, { backgroundColor: readerTheme.colors.background }]}
              >
                <Text fontSize={14} fontWeight="600" color={readerTheme.colors.text}>
                  A-
                </Text>
              </Pressable>
              <Text fontSize={15} fontWeight="500" color={readerTheme.colors.text}>
                {settings.fontSize}
              </Text>
              <Pressable
                onPress={handleFontIncrease}
                style={[styles.fontButton, { backgroundColor: readerTheme.colors.background }]}
              >
                <Text fontSize={18} fontWeight="600" color={readerTheme.colors.text}>
                  A+
                </Text>
              </Pressable>
            </View>
          </View>

          {/* Theme label */}
          <Text
            fontSize={13}
            color={readerTheme.colors.textSecondary}
            style={styles.sectionLabel}
          >
            {t('reader.settings.theme')}
          </Text>

          {/* 8 theme circles */}
          <View style={styles.themesRow}>
            {ALL_THEMES.map((theme) => (
              <ThemeCircle
                key={theme.id}
                theme={theme}
                isActive={activeThemeId === theme.id}
                onPress={() => handleThemeSelect(theme.id)}
                borderColorForInactive={circleBorder}
              />
            ))}
          </View>

          {/* Auto day/night switch */}
          <View style={[styles.switchRow, { borderTopColor: readerTheme.colors.border }]}>
            <View>
              <Text fontSize={14} color={readerTheme.colors.text}>
                {t('reader.settings.autoTheme')}
              </Text>
              <Text fontSize={11} color={readerTheme.colors.textSecondary}>
                {t('reader.settings.autoThemeSubtitle')}
              </Text>
            </View>
            <Switch
              value={settings.autoTheme}
              onValueChange={handleAutoThemeToggle}
              trackColor={{ false: readerTheme.colors.border, true: '#6c63ff' }}
            />
          </View>

          {/* Paired theme row (visible only when auto is ON) */}
          {showPairedRow && (
            <View style={[styles.pairedSection, { borderTopColor: readerTheme.colors.border }]}>
              <Text
                fontSize={13}
                color={readerTheme.colors.textSecondary}
                style={styles.sectionLabel}
              >
                {pairedLabel}
              </Text>
              <View style={styles.themesRow}>
                {pairedThemes.map((theme) => (
                  <ThemeCircle
                    key={theme.id}
                    theme={theme}
                    isActive={pairedActiveId === theme.id}
                    onPress={() => handlePairedThemeSelect(theme.id)}
                    borderColorForInactive={circleBorder}
                  />
                ))}
              </View>
            </View>
          )}
        </View>
      </Animated.View>
    </>
  );
}

const styles = StyleSheet.create({
  sheetContainer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
  },
  sheet: {
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    paddingHorizontal: 20,
    paddingTop: 12,
  },
  handleRow: {
    alignItems: 'center',
    paddingBottom: 16,
  },
  handle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    opacity: 0.5,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  fontSizeControls: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  fontButton: {
    width: 32,
    height: 32,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sectionLabel: {
    marginBottom: 8,
  },
  themesRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 10,
    marginBottom: 16,
  },
  themeCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkmark: {
    textAlign: 'center',
  },
  switchRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderTopWidth: 1,
  },
  pairedSection: {
    paddingTop: 12,
    borderTopWidth: 1,
  },
});
