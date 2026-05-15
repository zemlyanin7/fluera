// Settings — реальный ThemePicker (Day/Sepia/Night/Auto) и bookLanguage smoke-picker.
import React from 'react';
import { View, Text, Pressable, ScrollView } from 'react-native';
import { StyleSheet } from 'react-native-unistyles';
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

const styles = StyleSheet.create((theme) => ({
  content: { padding: 22, gap: 18 },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  rowSpaced: { marginTop: 8 },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 999,
    backgroundColor: `${theme.ink}0F`,
  },
  chipActive: { backgroundColor: theme.ink },
  chipText: { color: theme.ink, fontFamily: 'Inter-SemiBold' },
  chipTextActive: { color: theme.paper },
}));

export default function SettingsScreen() {
  const themeId = useSettingsStore((s) => s.themeId);
  const themeAuto = useSettingsStore((s) => s.themeAuto);
  const setTheme = useSettingsStore((s) => s.setTheme);
  const bookLang = useSettingsStore((s) => s.bookLanguage);
  const setLang = useSettingsStore((s) => s.setBookLanguage);

  return (
    <PhoneShell>
      <ScrollView contentContainerStyle={styles.content}>
        <View>
          <SectionLabel>Paper</SectionLabel>
          <View style={[styles.row, styles.rowSpaced]}>
            {themes.map((t) => {
              const active = !themeAuto && themeId === t.id;
              return (
                <Pressable
                  key={t.id}
                  onPress={() => setTheme(t.id, false)}
                  style={[styles.chip, active && styles.chipActive]}
                >
                  <Text style={[styles.chipText, active && styles.chipTextActive]}>
                    {t.name}
                  </Text>
                </Pressable>
              );
            })}
            <Pressable
              onPress={() => setTheme(themeId, !themeAuto)}
              style={[styles.chip, themeAuto && styles.chipActive]}
            >
              <Text style={[styles.chipText, themeAuto && styles.chipTextActive]}>
                Auto
              </Text>
            </Pressable>
          </View>
        </View>

        <View>
          <SectionLabel>Book language (smoke)</SectionLabel>
          <View style={[styles.row, styles.rowSpaced]}>
            {SUPPORTED_BOOK_LANGUAGES.map((l) => {
              const active = bookLang === l;
              return (
                <Pressable
                  key={l}
                  onPress={() => setLang(l as BookLanguage)}
                  style={[styles.chip, active && styles.chipActive]}
                >
                  <Text
                    style={[styles.chipText, active && styles.chipTextActive]}
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
