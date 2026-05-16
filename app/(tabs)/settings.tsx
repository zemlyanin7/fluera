// Settings — реальный ThemePicker (Day/Sepia/Night/Auto) и bookLanguage smoke-picker.
// theme.* читается inline через useUnistyles() — иначе закэшированный
// StyleSheet.create не подхватывает смену темы (см. PhoneShell.tsx).
import React from 'react';
import { View, Text, Pressable, ScrollView, StyleSheet as RN } from 'react-native';
import { useUnistyles } from 'react-native-unistyles';
import { PhoneShell, Headline, SectionLabel } from '@/components/ui';
import { useSettingsStore } from '@/stores/settingsStore';
import {
  ThemeId,
  BookLanguage,
  SUPPORTED_BOOK_LANGUAGES,
} from '@/types/settings';

const themes: { id: ThemeId; name: string }[] = [
  { id: 'light', name: 'Day' },
  { id: 'sepia', name: 'Sepia' },
  { id: 'dark', name: 'Night' },
];

const staticStyles = RN.create({
  content: { padding: 22, gap: 18 },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  rowSpaced: { marginTop: 8 },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 999,
  },
  chipText: { fontFamily: 'Inter-SemiBold' },
});

export default function SettingsScreen() {
  const themeId = useSettingsStore((s) => s.themeId);
  const themeAuto = useSettingsStore((s) => s.themeAuto);
  const setTheme = useSettingsStore((s) => s.setTheme);
  const bookLang = useSettingsStore((s) => s.bookLanguage);
  const setLang = useSettingsStore((s) => s.setBookLanguage);
  const { theme } = useUnistyles();

  const chipIdleBg = { backgroundColor: `${theme.ink}0F` };
  const chipActiveBg = { backgroundColor: theme.ink };
  const chipIdleText = { color: theme.ink };
  const chipActiveText = { color: theme.paper };

  return (
    <PhoneShell>
      <ScrollView contentContainerStyle={staticStyles.content}>
        <View>
          <SectionLabel>Paper</SectionLabel>
          <View style={[staticStyles.row, staticStyles.rowSpaced]}>
            {themes.map((t) => {
              const active = !themeAuto && themeId === t.id;
              return (
                <Pressable
                  key={t.id}
                  onPress={() => setTheme(t.id, false)}
                  style={[staticStyles.chip, active ? chipActiveBg : chipIdleBg]}
                >
                  <Text style={[staticStyles.chipText, active ? chipActiveText : chipIdleText]}>
                    {t.name}
                  </Text>
                </Pressable>
              );
            })}
            <Pressable
              onPress={() => setTheme(themeId, !themeAuto)}
              style={[staticStyles.chip, themeAuto ? chipActiveBg : chipIdleBg]}
            >
              <Text style={[staticStyles.chipText, themeAuto ? chipActiveText : chipIdleText]}>
                Auto
              </Text>
            </Pressable>
          </View>
        </View>

        <View>
          <SectionLabel>Book language (smoke)</SectionLabel>
          <View style={[staticStyles.row, staticStyles.rowSpaced]}>
            {SUPPORTED_BOOK_LANGUAGES.map((l) => {
              const active = bookLang === l;
              return (
                <Pressable
                  key={l}
                  onPress={() => setLang(l as BookLanguage)}
                  style={[staticStyles.chip, active ? chipActiveBg : chipIdleBg]}
                >
                  <Text
                    style={[staticStyles.chipText, active ? chipActiveText : chipIdleText]}
                  >
                    {l}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>

        <Headline level={3}>
          Остальные настройки → sub-project #8 Onboarding polish.
        </Headline>
      </ScrollView>
    </PhoneShell>
  );
}
