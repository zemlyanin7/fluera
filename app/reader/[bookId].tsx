// Reader smoke: топ-бар, ScrollView с параграфами Borges, тап по слову →
// подсветка accent, Sheet с темой Day/Sepia/Night.
// Skript-variant: stylesheet.useVariants({ script }) подменяет fontFamily.
// ВАЖНО (I11): word-tap nested <Text onPress> — Foundation smoke. На Android
// background рендерится только за глифами. Реальная реализация — в #4
// (range-based highlight через onTouchStart math на родительском Text).
import React, { useState, useRef } from 'react';
import { View, Text, Pressable, ScrollView } from 'react-native';
import { useRouter } from 'expo-router';
import { StyleSheet } from 'react-native-unistyles';
import {
  PhoneShell,
  IconBtn,
  Sheet,
  SheetRef,
  Headline,
  SectionLabel,
} from '@/components/ui';
import { IcChevronLeft, IcFontSize } from '@/components/icons';
import { BORGES_SAMPLE } from '@/fixtures/borges';
import { useSettingsStore } from '@/stores/settingsStore';
import { scriptForLang } from '@/theme/scripts';
import { splitWords } from '@/utils/splitWords';
import { scriptTypography } from '@/theme/tokens';
import type { InlineNode, ContentItem, ThemeId } from '@/types';

const stylesheet = StyleSheet.create((theme) => ({
  topBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 18, paddingVertical: 8 },
  centerLabel: { textAlign: 'center' as const },
  chapterNum: { fontFamily: 'Inter-SemiBold', fontSize: 13, color: theme.ink, fontWeight: '600' as const },
  bookName: { fontFamily: 'SourceSerif4-Italic', fontStyle: 'italic' as const, fontSize: 12, color: theme.ink3 },
  content: { padding: 28, paddingBottom: 80, flexGrow: 1 },
  reading: {
    color: theme.ink,
    variants: {
      script: {
        latin: { fontFamily: 'SourceSerif4-Regular' },
        cyrillic: { fontFamily: 'Lora-Regular' },
        cjk_jp: { fontFamily: 'ShipporiMinchoB1-Regular' },
        cjk_kr: { fontFamily: 'NotoSerifKR-Regular' },
        arabic: { fontFamily: 'Amiri-Regular', writingDirection: 'rtl' as const, textAlign: 'right' as const },
        devanagari: { fontFamily: 'TiroDevanagariHindi-Regular' },
      },
    },
  },
  paragraph: { marginBottom: 14 },
  word: { paddingHorizontal: 1, borderRadius: 3 },
  wordActive: { backgroundColor: theme.accent, color: theme.paper },
  sheetTitle: { marginBottom: 12 },
  sheetRow: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
  themeChip: { paddingHorizontal: 16, paddingVertical: 14, borderRadius: 14, minWidth: 90, alignItems: 'center', backgroundColor: theme.paper2 },
  themeChipActive: { borderWidth: 2, borderColor: theme.accent },
  themeChipText: { fontFamily: 'Inter-SemiBold', fontSize: 13, color: theme.ink },
  spacer4: { height: 4 }, spacer8: { height: 8 }, spacer14: { height: 14 },
}));

const THEMES: { id: ThemeId; name: string }[] = [
  { id: 'light', name: 'Day' },
  { id: 'sepia', name: 'Sepia' },
  { id: 'dark', name: 'Night' },
];

// I2: модульный const — массив больше не пересоздаётся каждый рендер
// (избегаем лишних ре-рендеров BottomSheet).
const READER_SHEET_SNAPS: (string | number)[] = ['40%'];

// M2: ThemeSheet вынесен из основного компонента, чтобы [bookId].tsx
// уместился в лимит 200 строк (CLAUDE.md §«Паттерны компонентов»).
const ThemeSheet = React.forwardRef<SheetRef, { themeId: ThemeId; onPickTheme: (id: ThemeId) => void }>(
  ({ themeId, onPickTheme }, ref) => (
    <Sheet ref={ref} snapPoints={READER_SHEET_SNAPS}>
      <View style={stylesheet.sheetTitle}>
        <Headline level={2}>Reading</Headline>
      </View>
      <SectionLabel>Paper</SectionLabel>
      <View style={stylesheet.spacer8} />
      <View style={stylesheet.sheetRow}>
        {THEMES.map((t) => {
          const active = themeId === t.id;
          return (
            <Pressable
              key={t.id}
              onPress={() => onPickTheme(t.id)}
              style={[stylesheet.themeChip, active && stylesheet.themeChipActive]}
            >
              <Text style={stylesheet.themeChipText}>{t.name}</Text>
            </Pressable>
          );
        })}
      </View>
    </Sheet>
  ),
);
ThemeSheet.displayName = 'ThemeSheet';

export default function ReaderScreen() {
  const router = useRouter();
  const bookLang = useSettingsStore((s) => s.bookLanguage);
  const themeId = useSettingsStore((s) => s.themeId);
  const setTheme = useSettingsStore((s) => s.setTheme);
  const fontSize = useSettingsStore((s) => s.fontSize);
  const script = scriptForLang(bookLang);

  stylesheet.useVariants({ script });

  const sheetRef = useRef<SheetRef>(null);
  const [activeWord, setActiveWord] = useState<string | null>(null);
  const onTap = (id: string) =>
    setActiveWord((prev) => (prev === id ? null : id));

  const renderInline = (node: InlineNode, pi: number, ii: number): React.ReactNode => {
    if (node.type !== 'text') return null;
    const tokens = splitWords(node.text);
    return tokens.map((tok, ti) => {
      if (tok.kind !== 'word') return <Text key={`${pi}-${ii}-${ti}-x`}>{tok.text}</Text>;
      const id = `${pi}-${ii}-${ti}`;
      const isActive = activeWord === id;
      return (
        <Text
          key={id}
          onPress={() => onTap(id)}
          style={[stylesheet.word, isActive && stylesheet.wordActive]}
        >
          {tok.text}
        </Text>
      );
    });
  };

  const renderItem = (item: ContentItem, pi: number): React.ReactNode => {
    if (item.type !== 'paragraph') return null;
    const leading = scriptTypography[script].readingLeading;
    return (
      <Text
        key={pi}
        style={[
          stylesheet.reading,
          stylesheet.paragraph,
          { fontSize, lineHeight: fontSize * leading },
        ]}
      >
        {item.inlines.map((n, ii) => renderInline(n, pi, ii))}
      </Text>
    );
  };

  return (
    <PhoneShell>
      <View style={stylesheet.topBar}>
        <IconBtn onPress={() => router.back()} accessibilityLabel="Back">
          <IcChevronLeft size={18} />
        </IconBtn>
        <View>
          <Text style={[stylesheet.centerLabel, stylesheet.chapterNum]}>
            Ch. {BORGES_SAMPLE.index + 1}
          </Text>
          <Text style={[stylesheet.centerLabel, stylesheet.bookName]}>
            The Garden of Forking Paths
          </Text>
        </View>
        <IconBtn onPress={() => sheetRef.current?.expand()} accessibilityLabel="Settings">
          <IcFontSize size={18} />
        </IconBtn>
      </View>

      <ScrollView contentContainerStyle={stylesheet.content}>
        <SectionLabel>Chapter</SectionLabel>
        <View style={stylesheet.spacer4} />
        <Headline level={1}>{BORGES_SAMPLE.title ?? ''}</Headline>
        <View style={stylesheet.spacer14} />
        {BORGES_SAMPLE.items.map((item, pi) => renderItem(item, pi))}
      </ScrollView>

      <ThemeSheet ref={sheetRef} themeId={themeId} onPickTheme={(id) => setTheme(id, false)} />
    </PhoneShell>
  );
}
