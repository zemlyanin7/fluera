// Library — фиксированная карточка Borges, тап → Reader.
// theme.paper2 читается inline через useUnistyles() — иначе закэшированный
// StyleSheet.create не подхватывает смену темы (см. PhoneShell.tsx).
import React, { useMemo } from 'react';
import { View, Pressable, StyleSheet as RN } from 'react-native';
import { useRouter } from 'expo-router';
import { useUnistyles } from 'react-native-unistyles';
import {
  PhoneShell,
  Headline,
  SectionLabel,
  BookCover,
  Pill,
  ProgressBar,
} from '@/components/ui';
import { useSettingsStore } from '@/stores/settingsStore';

const staticStyles = RN.create({
  header: { paddingHorizontal: 22, paddingTop: 8, paddingBottom: 12 },
  cardWrap: { paddingHorizontal: 18, paddingBottom: 14 },
  card: {
    borderRadius: 22,
    padding: 18,
    flexDirection: 'row',
    gap: 16,
  },
  meta: { flex: 1, justifyContent: 'space-between' },
  pills: { flexDirection: 'row', gap: 6, marginTop: 8, flexWrap: 'wrap' },
  bottom: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 10 },
  progressWrap: { flex: 1 },
  spacer2: { height: 2 },
});

export default function LibraryScreen() {
  const router = useRouter();
  const uiLanguage = useSettingsStore((s) => s.uiLanguage);
  const { theme } = useUnistyles();
  // M3: дата в UI-локали, без хардкода. Зависимость только от смены языка/дня.
  const todayLabel = useMemo(
    () => new Intl.DateTimeFormat(uiLanguage, { weekday: 'long', day: 'numeric', month: 'long' }).format(new Date()),
    [uiLanguage],
  );
  return (
    <PhoneShell>
      <View style={staticStyles.header}>
        <SectionLabel>{todayLabel}</SectionLabel>
        <View style={staticStyles.spacer2} />
        <Headline level={1}>Library</Headline>
      </View>
      <View style={staticStyles.cardWrap}>
        <Pressable
          onPress={() => router.push('/reader/borges')}
          style={[staticStyles.card, { backgroundColor: theme.paper2 }]}
        >
          <BookCover
            book={{
              title: 'The Garden of Forking Paths',
              author: 'J. L. Borges',
              gradient: ['#C0392B', '#8B2A1F', '#5C1810'],
            }}
            w={92}
            h={130}
          />
          <View style={staticStyles.meta}>
            <View>
              <Headline level={3}>The Garden of Forking Paths</Headline>
              <View style={staticStyles.pills}>
                <Pill>EN</Pill>
                <Pill tone="accent">14-day streak</Pill>
              </View>
            </View>
            <View style={staticStyles.bottom}>
              <View style={staticStyles.progressWrap}>
                <ProgressBar value={0.13} tone="accent" />
              </View>
            </View>
          </View>
        </Pressable>
      </View>
    </PhoneShell>
  );
}
