import React, { forwardRef } from 'react';
import { View, Text, Pressable } from 'react-native';
import { useUnistyles } from 'react-native-unistyles';
import { Sheet, type SheetRef, Headline, SectionLabel } from '@/components/ui';
import { useSettingsStore } from '@/stores/settingsStore';
import type { ThemeId } from '@/types/settings';

const SNAP: (string | number)[] = ['50%'];

const THEMES: { id: ThemeId; name: string }[] = [
  { id: 'light', name: 'Day' },
  { id: 'sepia', name: 'Sepia' },
  { id: 'dark', name: 'Night' },
];

export const ReaderControlsSheet = forwardRef<SheetRef>((_, ref) => {
  const { theme } = useUnistyles();
  const themeId = useSettingsStore((s) => s.themeId);
  const fontSize = useSettingsStore((s) => s.fontSize);
  const setTheme = useSettingsStore((s) => s.setTheme);
  const setFontSize = useSettingsStore((s) => s.setFontSize);
  return (
    <Sheet ref={ref} snapPoints={SNAP}>
      <View style={{ padding: 18, gap: 18 }}>
        <Headline level={2}>Reading</Headline>
        <View>
          <SectionLabel>Paper</SectionLabel>
          <View style={{ flexDirection: 'row', gap: 8, marginTop: 8 }}>
            {THEMES.map((t) => {
              const active = themeId === t.id;
              return (
                <Pressable
                  key={t.id}
                  onPress={() => setTheme(t.id, false)}
                  accessibilityLabel={`Theme ${t.name}`}
                  style={{
                    paddingHorizontal: 16,
                    paddingVertical: 14,
                    borderRadius: 14,
                    minWidth: 90,
                    alignItems: 'center',
                    backgroundColor: theme.paper2,
                    borderWidth: active ? 2 : 0,
                    borderColor: theme.accent,
                  }}
                >
                  <Text
                    style={{
                      fontFamily: 'Inter-SemiBold',
                      fontSize: 13,
                      color: theme.ink,
                    }}
                  >
                    {t.name}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>
        <View>
          <SectionLabel>Font size</SectionLabel>
          <View
            style={{ flexDirection: 'row', gap: 12, marginTop: 8, alignItems: 'center' }}
          >
            <Pressable
              onPress={() => setFontSize(fontSize - 1)}
              accessibilityLabel="Decrease font size"
              style={{ padding: 12, backgroundColor: theme.paper2, borderRadius: 10 }}
            >
              <Text style={{ color: theme.ink, fontSize: 18 }}>A−</Text>
            </Pressable>
            <Text style={{ color: theme.ink2, minWidth: 30, textAlign: 'center' }}>
              {fontSize}
            </Text>
            <Pressable
              onPress={() => setFontSize(fontSize + 1)}
              accessibilityLabel="Increase font size"
              style={{ padding: 12, backgroundColor: theme.paper2, borderRadius: 10 }}
            >
              <Text style={{ color: theme.ink, fontSize: 18 }}>A+</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Sheet>
  );
});
ReaderControlsSheet.displayName = 'ReaderControlsSheet';
