// Library — фиксированная карточка Borges, тап → Reader.
import React, { useMemo } from 'react';
import { View, Pressable } from 'react-native';
import { useRouter } from 'expo-router';
import { StyleSheet } from 'react-native-unistyles';
import {
  PhoneShell,
  Headline,
  SectionLabel,
  BookCover,
  Pill,
  ProgressBar,
} from '@/components/ui';
import { useSettingsStore } from '@/stores/settingsStore';

const styles = StyleSheet.create((theme) => ({
  header: { paddingHorizontal: 22, paddingTop: 8, paddingBottom: 12 },
  cardWrap: { paddingHorizontal: 18, paddingBottom: 14 },
  card: {
    backgroundColor: theme.paper2,
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
}));

export default function LibraryScreen() {
  const router = useRouter();
  const uiLanguage = useSettingsStore((s) => s.uiLanguage);
  // M3: дата в UI-локали, без хардкода. Зависимость только от смены языка/дня.
  const todayLabel = useMemo(
    () => new Intl.DateTimeFormat(uiLanguage, { weekday: 'long', day: 'numeric', month: 'long' }).format(new Date()),
    [uiLanguage],
  );
  return (
    <PhoneShell>
      <View style={styles.header}>
        <SectionLabel>{todayLabel}</SectionLabel>
        <View style={styles.spacer2} />
        <Headline level={1}>Library</Headline>
      </View>
      <View style={styles.cardWrap}>
        <Pressable
          onPress={() => router.push('/reader/borges')}
          style={styles.card}
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
          <View style={styles.meta}>
            <View>
              <Headline level={3}>The Garden of Forking Paths</Headline>
              <View style={styles.pills}>
                <Pill>EN</Pill>
                <Pill tone="accent">14-day streak</Pill>
              </View>
            </View>
            <View style={styles.bottom}>
              <View style={styles.progressWrap}>
                <ProgressBar value={0.13} tone="accent" />
              </View>
            </View>
          </View>
        </Pressable>
      </View>
    </PhoneShell>
  );
}
