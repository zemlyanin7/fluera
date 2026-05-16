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
  // Veil прячет content пока scroll-jump (TOC tap или initial restore) идёт.
  // Снимается когда target chapter становится видимым (onViewableItemsChanged).
  const [veilTarget, setVeilTarget] = useState<number | null>(null);
  const veilTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

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

  // TOC tap → scroll to chapter marker.
  useEffect(() => {
    if (!state.scrollToChapterRequest) return;
    const target = state.scrollToChapterRequest.index;
    setVeilTarget(target);
    bookRendererRef.current?.scrollToChapter(target);
    if (veilTimeoutRef.current) clearTimeout(veilTimeoutRef.current);
    veilTimeoutRef.current = setTimeout(() => setVeilTarget(null), 2000);
    return () => {
      if (veilTimeoutRef.current) clearTimeout(veilTimeoutRef.current);
    };
  }, [state.scrollToChapterRequest]);

  // Initial restore → exact pixel offset.
  useEffect(() => {
    if (!state.scrollToOffsetRequest) return;
    setVeilTarget(state.currentChapterIndex);
    bookRendererRef.current?.scrollToOffset(state.scrollToOffsetRequest.offset);
    if (veilTimeoutRef.current) clearTimeout(veilTimeoutRef.current);
    // Offset restore не вызывает chapter change, поэтому держим veil
    // через timer а не onViewableItemsChanged.
    veilTimeoutRef.current = setTimeout(() => setVeilTarget(null), 600);
    return () => {
      if (veilTimeoutRef.current) clearTimeout(veilTimeoutRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.scrollToOffsetRequest]);

  // Снимаем veil когда target chapter стал текущим (для TOC jump).
  useEffect(() => {
    if (veilTarget !== null && state.currentChapterIndex === veilTarget) {
      if (veilTimeoutRef.current) {
        clearTimeout(veilTimeoutRef.current);
        veilTimeoutRef.current = null;
      }
      setVeilTarget(null);
    }
  }, [state.currentChapterIndex, veilTarget]);

  useEffect(() => {
    return () => {
      if (veilTimeoutRef.current) clearTimeout(veilTimeoutRef.current);
    };
  }, []);

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
        {veilTarget !== null && (
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
