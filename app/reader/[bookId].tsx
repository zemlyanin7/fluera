// Reader screen — continuous-scroll model (sub-project #3).
// Все chapters рендерятся в одном FlatList. TOC sheet вместо prev/next.
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { View, Text, ActivityIndicator } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useUnistyles } from 'react-native-unistyles';
import { PhoneShell, type SheetRef } from '@/components/ui';
import { useSettingsStore } from '@/stores/settingsStore';
import { scriptForLang } from '@/theme/scripts';
import { useReaderEngine } from '@/services/reader/useReaderEngine';
import {
  BookRenderer,
  type BookRendererHandle,
  ReaderTopBar,
  ReaderControlsSheet,
  TableOfContentsSheet,
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
  const { state, jumpToChapter, setCurrentChapter, savePosition } = useReaderEngine(bookId);
  const bookLang: BookLanguage = (state.book?.language as BookLanguage) ?? 'en';
  const script = scriptForLang(bookLang);
  const controlsRef = useRef<SheetRef>(null);
  const tocRef = useRef<SheetRef>(null);
  const bookRendererRef = useRef<BookRendererHandle>(null);
  const [popup, setPopup] = useState<TranslationPopupState>({ kind: 'closed' });
  const lastScrollOffsetRef = useRef(0);
  // Прячем content пока initial scroll-restore не завершён — иначе видно
  // мгновение «началась с 1 страницы».
  const [restoreVeilVisible, setRestoreVeilVisible] = useState(false);

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
      lastScrollOffsetRef.current = offsetY;
      savePosition(state.currentChapterIndex, Math.floor(offsetY));
    },
    [savePosition, state.currentChapterIndex],
  );

  // Реагируем на REQUEST_SCROLL_TO_CHAPTER из TOC и initial restore.
  useEffect(() => {
    if (!state.scrollToChapterRequest) return;
    bookRendererRef.current?.scrollToChapter(state.scrollToChapterRequest.index);
  }, [state.scrollToChapterRequest]);

  // Когда reader впервые становится ready, если есть сохранённая позиция —
  // показываем veil чтобы скрыть промежуточные кадры до scroll completion.
  useEffect(() => {
    if (state.status !== 'ready') return;
    if (state.initialOffset > 0 || state.currentChapterIndex > 0) {
      setRestoreVeilVisible(true);
      const t = setTimeout(() => setRestoreVeilVisible(false), 400);
      return () => clearTimeout(t);
    }
    return undefined;
    // Только на момент перехода в ready
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.status]);

  if (state.status === 'error') {
    return (
      <PhoneShell>
        <ReaderTopBar
          chapterIndex={0}
          chapterTitle={null}
          onBack={() => router.back()}
          onOpenSettings={() => {}}
          onOpenToc={() => {}}
        />
        <View
          style={{ flex: 1, padding: 18, justifyContent: 'center', alignItems: 'center', gap: 12 }}
        >
          <Text style={{ color: theme.ink, fontSize: 16, textAlign: 'center' }}>
            Ошибка: {state.error}
          </Text>
          <Text style={{ color: theme.ink3, fontSize: 13, textAlign: 'center' }}>
            Tap back ↑ или удалите книгу из Library
          </Text>
        </View>
      </PhoneShell>
    );
  }

  if (state.status !== 'ready' || state.chapters.length === 0 || !state.book) {
    return (
      <PhoneShell>
        <ReaderTopBar
          chapterIndex={0}
          chapterTitle={null}
          onBack={() => router.back()}
          onOpenSettings={() => {}}
          onOpenToc={() => {}}
        />
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
          <ActivityIndicator color={theme.accent} />
        </View>
      </PhoneShell>
    );
  }

  const currentChapter = state.chapters.find((c) => c.index === state.currentChapterIndex);

  return (
    <PhoneShell>
      <ReaderTopBar
        chapterIndex={state.currentChapterIndex}
        chapterTitle={currentChapter?.title ?? null}
        onBack={() => router.back()}
        onOpenSettings={() => controlsRef.current?.expand()}
        onOpenToc={() => tocRef.current?.expand()}
      />
      <View style={{ flex: 1 }}>
        <BookRenderer
          ref={bookRendererRef}
          chapters={state.chapters}
          onWordTap={onWordTap}
          onCurrentChapterChange={setCurrentChapter}
          onScroll={onScroll}
          fontSize={fontSize}
          script={script}
          bookId={state.book.id}
        />
        {restoreVeilVisible && (
          <View
            pointerEvents="none"
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              backgroundColor: theme.paper,
              justifyContent: 'center',
              alignItems: 'center',
            }}
          >
            <ActivityIndicator color={theme.accent} />
          </View>
        )}
      </View>
      <ReaderControlsSheet ref={controlsRef} />
      <TableOfContentsSheet
        ref={tocRef}
        chapters={state.chapterMeta.length > 0 ? state.chapterMeta : state.chapters.map((c) => ({ index: c.index, title: c.title }))}
        currentChapterIndex={state.currentChapterIndex}
        onPickChapter={(idx) => {
          tocRef.current?.close();
          jumpToChapter(idx);
        }}
      />
      <TranslationPopup state={popup} onClose={() => setPopup({ kind: 'closed' })} />
    </PhoneShell>
  );
}
