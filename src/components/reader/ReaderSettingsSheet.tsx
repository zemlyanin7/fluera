import React, { useCallback } from 'react';
import { Pressable, StyleSheet } from 'react-native';
import { YStack, XStack, Text, Button, Slider } from 'tamagui';
import Animated, { useSharedValue, useAnimatedStyle, withTiming, withSpring } from 'react-native-reanimated';
import { useSettingsStore } from '../../stores/settingsStore';
import { useTranslation } from 'react-i18next';

interface ReaderSettingsSheetProps {
  visible: boolean;
  onClose: () => void;
}

const THEMES = ['light', 'dark', 'sepia'] as const;
const FONTS = ['System', 'serif', 'sans-serif'] as const;

export function ReaderSettingsSheet({ visible, onClose }: ReaderSettingsSheetProps) {
  const settings = useSettingsStore();
  const { t } = useTranslation();
  const translateY = useSharedValue(300);

  React.useEffect(() => {
    translateY.value = visible
      ? withSpring(0, { damping: 20 })
      : withTiming(300, { duration: 200 });
  }, [visible]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }],
  }));

  if (!visible) return null;

  return (
    <>
      <Pressable style={StyleSheet.absoluteFill} onPress={onClose}>
        <Animated.View style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(0,0,0,0.3)' }]} />
      </Pressable>

      <Animated.View style={[{ position: 'absolute', bottom: 0, left: 0, right: 0 }, animatedStyle]}>
        <YStack backgroundColor="$background" borderTopLeftRadius="$4" borderTopRightRadius="$4" padding="$4" gap="$4">
          {/* Font size */}
          <YStack gap="$2">
            <Text fontSize="$3" fontWeight="bold">{t('reader.settings.fontSize')}</Text>
            <XStack alignItems="center" gap="$2">
              <Text fontSize="$2">A</Text>
              <Slider
                flex={1} min={14} max={28} step={1}
                value={[settings.fontSize]}
                onValueChange={([v]) => settings.setFontSize(v)}
              >
                <Slider.Track><Slider.TrackActive /></Slider.Track>
                <Slider.Thumb index={0} circular size="$1" />
              </Slider>
              <Text fontSize="$5">A</Text>
            </XStack>
          </YStack>

          {/* Theme */}
          <YStack gap="$2">
            <Text fontSize="$3" fontWeight="bold">{t('reader.settings.theme')}</Text>
            <XStack gap="$2">
              {THEMES.map((theme) => (
                <Button
                  key={theme} flex={1} size="$3"
                  theme={settings.readerTheme === theme ? 'blue' : undefined}
                  onPress={() => settings.setReaderTheme(theme)}
                >
                  {t(`reader.settings.theme_${theme}`)}
                </Button>
              ))}
            </XStack>
          </YStack>

          {/* Line height */}
          <YStack gap="$2">
            <Text fontSize="$3" fontWeight="bold">{t('reader.settings.lineHeight')}</Text>
            <Slider
              min={12} max={20} step={1}
              value={[Math.round(settings.lineHeight * 10)]}
              onValueChange={([v]) => settings.setLineHeight(v / 10)}
            >
              <Slider.Track><Slider.TrackActive /></Slider.Track>
              <Slider.Thumb index={0} circular size="$1" />
            </Slider>
          </YStack>

          {/* Font family */}
          <YStack gap="$2">
            <Text fontSize="$3" fontWeight="bold">{t('reader.settings.fontFamily')}</Text>
            <XStack gap="$2">
              {FONTS.map((font) => (
                <Button
                  key={font} flex={1} size="$3"
                  theme={settings.fontFamily === font ? 'blue' : undefined}
                  onPress={() => settings.setFontFamily(font)}
                >
                  {font}
                </Button>
              ))}
            </XStack>
          </YStack>
        </YStack>
      </Animated.View>
    </>
  );
}
