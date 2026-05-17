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
  type PopupViewState,
} from '@/components/reader';
import {
  useTranslationService,
  useMweDictionary,
  useDictionaryLoader,
} from '@/services/translation/TranslationServiceContext';
import { tokenize } from '@/services/translation/dictionaries/tokenize';
import type { BookLanguage, NativeLanguage } from '@/types/settings';

export default function ReaderScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ bookId: string }>();
  const bookId = params.bookId ?? '';
  const { theme } = useUnistyles();
  const fontSize = useSettingsStore((s) => s.fontSize);
  const nativeLanguage = useSettingsStore((s) => s.nativeLanguage);
  const translation = useTranslationService();
  const mweDictionary = useMweDictionary();
  const dictionaryLoader = useDictionaryLoader();
  const { state, jumpToChapter, setCurrentChapter, savePosition } = useReaderEngine(bookId);
  const bookLang: BookLanguage = (state.book?.language as BookLanguage) ?? 'en';

  // Lazy-load MWE/false-friend dictionaries для пары bookLang→nativeLanguage.
  // Per #4.5 §4.4: seed на book open. Дешёво — async no-op если pair уже loaded.
  useEffect(() => {
    void dictionaryLoader.loadPair(bookLang, nativeLanguage);
  }, [dictionaryLoader, bookLang, nativeLanguage]);
  const script = scriptForLang(bookLang);
  const controlsRef = useRef<SheetRef>(null);
  const tocRef = useRef<SheetRef>(null);
  const bookRendererRef = useRef<BookRendererHandle>(null);
  const [popup, setPopup] = useState<PopupViewState>({
    visible: false,
    mode: 'word',
    word: '',
    sourceSentence: '',
    wordOffsetInSentence: 0,
    status: 'loading',
    placement: { mode: 'modalSheet', arrowDirection: 'right' },
    anchorRect: { x: 0, y: 0, width: 0, height: 0 },
    result: null,
    encounterCount: 0,
    coverageHint: false,
    bookLanguage: 'en',
    nativeLanguage: 'ru',
  });
  const lastFlatIndexRef = useRef(0);
  // Veil прячет content пока scroll-jump (TOC tap или initial restore) идёт.
  // Снимается когда target chapter становится видимым (onViewableItemsChanged).
  const [veilTarget, setVeilTarget] = useState<number | null>(null);
  const veilTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // v2.2.2: single-tap → sentence translation с выделением выражения.
  // Если слово часть MWE (idiom/phrasal_verb) — выделяем всю фразу.
  // Иначе — выделяем одно слово. Long-press и drag-selection убраны.
  const onWordTap = useCallback(
    async (word: string, sentence: string) => {
      // Position тапнутого слова в предложении. indexOf простой эвристический —
      // если слово встречается несколько раз в предложении, найдёт первое
      // вхождение. Для MWE-lookup достаточно, т.к. matcher проверяет соседние
      // токены тоже.
      const wordCharOffset = Math.max(0, sentence.toLowerCase().indexOf(word.toLowerCase()));

      // Lookup MWE — может вернуть фразу типа "kick the bucket" если тапнули
      // на любом слове внутри.
      const mweHit = mweDictionary.lookup(sentence, wordCharOffset);

      // Compute expression: либо MWE-фраза, либо одно слово.
      let expressionStart = wordCharOffset;
      let expressionText = word;
      if (mweHit) {
        // Найти char-границы matched-span в оригинальном sentence (без лоуэркейс).
        const tokens = tokenize(sentence);
        const startTokenIdx = mweHit.matchStartTokenIdx;
        const endTokenIdx = startTokenIdx + mweHit.matchedTokens; // exclusive
        const startTokenText = tokens[startTokenIdx];
        const endTokenText = tokens[endTokenIdx - 1];
        if (startTokenText && endTokenText) {
          // Найти позицию первого токена в оригинале (case-insensitive).
          const sLower = sentence.toLowerCase();
          const sStart = sLower.indexOf(startTokenText);
          if (sStart >= 0) {
            // Найти конец последнего токена.
            const sEnd = sLower.indexOf(endTokenText, sStart) + endTokenText.length;
            if (sEnd > sStart) {
              expressionStart = sStart;
              expressionText = sentence.slice(sStart, sEnd);
            }
          }
        }
      }

      const base: PopupViewState = {
        visible: true,
        mode: 'sentence',
        word: expressionText,
        sourceSentence: sentence,
        wordOffsetInSentence: expressionStart,
        status: 'loading',
        placement: { mode: 'modalSheet', arrowDirection: 'right' },
        anchorRect: { x: 0, y: 0, width: 0, height: 0 },
        result: null,
        encounterCount: 0,
        coverageHint: false,
        bookLanguage: bookLang,
        nativeLanguage: nativeLanguage as NativeLanguage,
      };
      setPopup(base);

      const res = await translation.translateSentence({
        sentence,
        bookLanguage: bookLang,
        nativeLanguage: nativeLanguage as NativeLanguage,
        wordOffset: expressionStart,
        sourceWord: expressionText,
      });

      if (res.status === 'ok' && res.translatedSentence) {
        setPopup({
          ...base,
          status: 'ready',
          result: {
            status: 'ok',
            sourceSentence: res.sourceSentence ?? sentence,
            translatedSentence: res.translatedSentence,
            translatedWordOffset: res.translatedWordOffset,
            experimental: true,
            source: res.source,
          } as any,
        });
      } else if (res.errorCode === 'MODEL_LOADING') {
        setPopup({ ...base, status: 'loading' });
      } else {
        setPopup({ ...base, status: 'error' });
      }
    },
    [translation, mweDictionary, bookLang, nativeLanguage],
  );

  const onTopFlatItemChange = useCallback(
    (flatIndex: number) => {
      lastFlatIndexRef.current = flatIndex;
      // Во время restore (veil активен) не save — иначе промежуточные индексы
      // от FlatList'a OVERWRITE'ят сохранённую позицию пользователя.
      if (veilTarget !== null) return;
      savePosition(state.currentChapterIndex, flatIndex);
    },
    [savePosition, state.currentChapterIndex, veilTarget],
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

  // Initial restore → exact top-visible flat item index.
  useEffect(() => {
    if (!state.scrollToFlatIndexRequest) return;
    setVeilTarget(state.currentChapterIndex);
    bookRendererRef.current?.scrollToFlatIndex(state.scrollToFlatIndexRequest.index);
    if (veilTimeoutRef.current) clearTimeout(veilTimeoutRef.current);
    // 2000ms запас — onScrollToIndexFailed retry может ~150ms.
    veilTimeoutRef.current = setTimeout(() => setVeilTarget(null), 2000);
    return () => {
      if (veilTimeoutRef.current) clearTimeout(veilTimeoutRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.scrollToFlatIndexRequest]);

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
          onTopFlatItemChange={onTopFlatItemChange}
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
      <TranslationPopup
        state={popup}
        onClose={() => setPopup((prev) => ({ ...prev, visible: false }))}
        onTranslateSentence={() => {}}
        onDislike={() => {}}
      />
    </PhoneShell>
  );
}
