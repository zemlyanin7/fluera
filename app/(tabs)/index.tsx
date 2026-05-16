// Library — список книг из useBookList + кнопка Import.
// При пустой коллекции — empty state + CTA «Import a book».
import React, { useMemo } from 'react';
import { View, Pressable, ScrollView, Text } from 'react-native';
import { useRouter } from 'expo-router';
import { useUnistyles } from 'react-native-unistyles';
import { PhoneShell, Headline, SectionLabel, Pill, ProgressBar } from '@/components/ui';
import { CoverThumbnail } from '@/components/reader';
import { useSettingsStore } from '@/stores/settingsStore';
import { useBookList } from '@/hooks/data';

export default function LibraryScreen() {
  const router = useRouter();
  const uiLanguage = useSettingsStore((s) => s.uiLanguage);
  const { theme } = useUnistyles();
  const { books, isLoading } = useBookList();
  const todayLabel = useMemo(
    () =>
      new Intl.DateTimeFormat(uiLanguage, {
        weekday: 'long',
        day: 'numeric',
        month: 'long',
      }).format(new Date()),
    [uiLanguage],
  );

  return (
    <PhoneShell>
      <View style={{ paddingHorizontal: 22, paddingTop: 8, paddingBottom: 12 }}>
        <SectionLabel>{todayLabel}</SectionLabel>
        <View style={{ height: 2 }} />
        <Headline level={1}>Library</Headline>
      </View>
      <ScrollView contentContainerStyle={{ paddingBottom: 80 }}>
        {!isLoading && books.length === 0 && (
          <View style={{ padding: 32, alignItems: 'center', gap: 14 }}>
            <Text style={{ color: theme.ink2, textAlign: 'center' }}>
              No books yet. Import EPUB or FB2 to start reading.
            </Text>
            <Pressable
              accessibilityLabel="Import a book"
              onPress={() => router.push('/import')}
              style={{
                paddingHorizontal: 24,
                paddingVertical: 14,
                borderRadius: 14,
                backgroundColor: theme.accent,
              }}
            >
              <Text
                style={{
                  color: theme.paper,
                  fontFamily: 'Inter-SemiBold',
                  fontSize: 16,
                }}
              >
                + Import a book
              </Text>
            </Pressable>
          </View>
        )}
        {books.map((book) => (
          <View key={book.id} style={{ paddingHorizontal: 18, paddingBottom: 14 }}>
            <Pressable
              accessibilityLabel={`Open ${book.title}`}
              onPress={() => router.push(`/reader/${book.id}`)}
              style={{
                borderRadius: 22,
                padding: 18,
                flexDirection: 'row',
                gap: 16,
                backgroundColor: theme.paper2,
              }}
            >
              <CoverThumbnail
                coverPath={book.coverPath}
                title={book.title}
                width={92}
                height={130}
              />
              <View style={{ flex: 1, justifyContent: 'space-between' }}>
                <View>
                  <Headline level={3}>{book.title}</Headline>
                  {book.author && (
                    <Text style={{ color: theme.ink3, marginTop: 4 }}>{book.author}</Text>
                  )}
                  <View
                    style={{
                      flexDirection: 'row',
                      gap: 6,
                      marginTop: 8,
                      flexWrap: 'wrap',
                    }}
                  >
                    <Pill>{book.language.toUpperCase()}</Pill>
                  </View>
                </View>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 10 }}>
                  <View style={{ flex: 1 }}>
                    <ProgressBar value={book.progress} tone="accent" />
                  </View>
                </View>
              </View>
            </Pressable>
          </View>
        ))}
        {books.length > 0 && (
          <View style={{ padding: 18, alignItems: 'center' }}>
            <Pressable
              accessibilityLabel="Import a book"
              onPress={() => router.push('/import')}
              style={{
                paddingHorizontal: 20,
                paddingVertical: 12,
                borderRadius: 14,
                backgroundColor: theme.paper2,
                borderWidth: 1,
                borderColor: theme.accentLine,
              }}
            >
              <Text style={{ color: theme.ink, fontFamily: 'Inter-SemiBold' }}>
                + Add another book
              </Text>
            </Pressable>
          </View>
        )}
      </ScrollView>
    </PhoneShell>
  );
}
