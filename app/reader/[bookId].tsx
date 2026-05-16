// Reader screen — переписан поверх ReaderEngine (sub-project #3).
// Загружает книгу из data layer, парсит файл, рендерит chapter через FlatList.
// Word-tap → TranslationPopup (NoOp service возвращает pending).
import React, { useCallback, useRef, useState } from 'react';
import { View, Text, ActivityIndicator } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useUnistyles } from 'react-native-unistyles';
import { PhoneShell, type SheetRef } from '@/components/ui';
import { useSettingsStore } from '@/stores/settingsStore';
import { scriptForLang } from '@/theme/scripts';
import { useReaderEngine } from '@/services/reader/useReaderEngine';
import {
  ChapterRenderer,
  ReaderTopBar,
  ChapterNavBar,
  ReaderControlsSheet,
  TranslationPopup,
  type TranslationPopupState,
} from '@/components/reader';
import { NoOpTranslationService } from '@/services/translation/NoOpTranslationService';
import type { BookLanguage, NativeLanguage } from '@/types/settings';

const translation = new NoOpTranslationService();

export default function ReaderScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ bookId: string }>();
  const bookId = params.bookId ?? '';
  const { theme } = useUnistyles();
  const fontSize = useSettingsStore((s) => s.fontSize);
  const nativeLanguage = useSettingsStore((s) => s.nativeLanguage);
  const { state, setChapter, savePosition } = useReaderEngine(bookId);
  const bookLang: BookLanguage = (state.book?.language as BookLanguage) ?? 'en';
  const script = scriptForLang(bookLang);
  const controlsRef = useRef<SheetRef>(null);
  const [popup, setPopup] = useState<TranslationPopupState>({ kind: 'closed' });

  const onWordTap = useCallback(
    async (word: string, sentence: string) => {
      setPopup({ kind: 'opening', word, sentence });
      const res = await translation.translate({
        word,
        contextWindow: sentence,
        bookLanguage: bookLang,
        nativeLanguage: nativeLanguage as NativeLanguage,
      });
      if (res.status === 'pending') {
        setPopup({ kind: 'pending', word, sentence });
      } else if (res.status === 'ok' && res.translation) {
        setPopup({ kind: 'success', word, translation: res.translation });
      } else {
        setPopup({ kind: 'error', word, reason: res.errorMessage ?? 'unknown' });
      }
    },
    [bookLang, nativeLanguage],
  );

  const onScroll = useCallback(
    (offsetY: number) => {
      savePosition(Math.floor(offsetY));
    },
    [savePosition],
  );

  if (state.status === 'error') {
    return (
      <PhoneShell>
        <View style={{ flex: 1, padding: 18, justifyContent: 'center', alignItems: 'center' }}>
          <Text style={{ color: theme.ink, fontSize: 16 }}>Ошибка: {state.error}</Text>
        </View>
      </PhoneShell>
    );
  }

  if (state.status !== 'ready' || !state.currentChapter || !state.book) {
    return (
      <PhoneShell>
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
          <ActivityIndicator color={theme.accent} />
        </View>
      </PhoneShell>
    );
  }

  return (
    <PhoneShell>
      <ReaderTopBar
        chapterIndex={state.currentChapterIndex}
        chapterTitle={state.currentChapter.title}
        onBack={() => router.back()}
        onOpenSettings={() => controlsRef.current?.expand()}
      />
      <View style={{ flex: 1 }}>
        <ChapterRenderer
          chapter={state.currentChapter}
          onWordTap={onWordTap}
          onScroll={onScroll}
          fontSize={fontSize}
          script={script}
          bookId={state.book.id}
        />
      </View>
      <ChapterNavBar
        index={state.currentChapterIndex}
        total={state.chapterMeta.length}
        onPrev={() => setChapter(state.currentChapterIndex - 1)}
        onNext={() => setChapter(state.currentChapterIndex + 1)}
      />
      <ReaderControlsSheet ref={controlsRef} />
      <TranslationPopup state={popup} onClose={() => setPopup({ kind: 'closed' })} />
    </PhoneShell>
  );
}
