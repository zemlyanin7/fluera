// Reader screen — continuous-scroll model (sub-project #3).
// Все chapters рендерятся в одном FlatList. TOC sheet вместо prev/next.
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
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
import { extractContextForWord } from '@/services/reader/extractContextForWord';
import { WordStatusRepository } from '@/db/repositories/WordStatusRepository';
import { useDatabase } from '@/db/DatabaseContext';
import type { BookLanguage, NativeLanguage } from '@/types/settings';
import type { InlineNode } from '@/types/content';

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
  const generationRef = useRef(0);
  const db = useDatabase();
  const wordStatusRepo = useMemo(() => new WordStatusRepository(db), [db]);
  const savedToDeckHintShown = useSettingsStore((s) => s.savedToDeckHintShown);
  const markSavedToDeckHintShown = useSettingsStore((s) => s.markSavedToDeckHintShown);

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
    savedToDeck: false,
    hasMultipleSenses: false,
    falseFriendInfo: null,
    generation: 0,
  });
  const lastFlatIndexRef = useRef(0);
  // Veil прячет content пока scroll-jump (TOC tap или initial restore) идёт.
  // Снимается когда target chapter становится видимым (onViewableItemsChanged).
  const [veilTarget, setVeilTarget] = useState<number | null>(null);
  const veilTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // v2.2.2: single-tap → sentence translation с выделением выражения.
  // Если слово часть MWE (idiom/phrasal_verb) — выделяем всю фразу.
  // Иначе — выделяем одно слово. Long-press и drag-selection убраны.
  // Task 38: extractContextForWord из InlineNode[] для preserved formatting.
  // Task 39: generation token для race-safe rapid taps.
  // Task 41: принимает inlines + charOffset от ParagraphRender каскада.
  const onWordTap = useCallback(
    async (word: string, _sentence: string, inlines: InlineNode[], charOffset: number) => {
      const gen = ++generationRef.current;

      const ctx = extractContextForWord(inlines, word, charOffset, bookLang);

      // MWE lookup использует plain text
      const mweHit = mweDictionary.lookup(ctx.plainText, ctx.wordOffsetInPlain);

      let expressionStart = ctx.wordOffsetInPlain;
      let expressionText = word;
      if (mweHit) {
        const tokens = tokenize(ctx.plainText);
        const startTokenIdx = mweHit.matchStartTokenIdx;
        const endTokenIdx = startTokenIdx + mweHit.matchedTokens;
        const startTokenText = tokens[startTokenIdx];
        const endTokenText = tokens[endTokenIdx - 1];
        if (startTokenText && endTokenText) {
          const sLower = ctx.plainText.toLowerCase();
          const sStart = sLower.indexOf(startTokenText);
          if (sStart >= 0) {
            const sEnd = sLower.indexOf(endTokenText, sStart) + endTokenText.length;
            if (sEnd > sStart) {
              expressionStart = sStart;
              expressionText = ctx.plainText.slice(sStart, sEnd);
            }
          }
        }
      }

      const base: PopupViewState = {
        visible: true,
        mode: 'sentence',
        word: expressionText,
        sourceSentence: ctx.plainText,
        sourceInlines: ctx.inlines,
        sourcePlainText: ctx.plainText,
        wordOffsetInSentence: expressionStart,
        wordOffsetInPlain: expressionStart,
        wordLength: expressionText.length,
        wasCapped: ctx.wasCapped,
        status: 'loading',
        placement: { mode: 'modalSheet', arrowDirection: 'right' },
        anchorRect: { x: 0, y: 0, width: 0, height: 0 },
        result: null,
        encounterCount: 0,
        coverageHint: false,
        bookLanguage: bookLang,
        nativeLanguage: nativeLanguage as NativeLanguage,
        savedToDeck: false,
        hasMultipleSenses: false,
        falseFriendInfo: null,
        generation: gen,
      };
      setPopup(base);

      // Progressive UI (v3.1): InferenceQueue serializes completions
      // (один llama context = один inference). Promise.all не даёт parallelism.
      // Strategy: sentence FIRST — самое важное для юзера, показываем popup
      // как только готово. word AFTER — заполняет primary contextual card
      // вторым setPopup. Total latency = sent + word (как и было), но
      // perceived latency = sent (юзер видит результат раньше).
      const sentRes = await translation.translateSentence({
        sentence: ctx.plainText,
        sourceInlines: ctx.inlines,
        bookLanguage: bookLang,
        nativeLanguage: nativeLanguage as NativeLanguage,
        wordOffset: expressionStart,
        sourceWord: expressionText,
        generation: gen,
      });

      // Stale check после sentence
      if (gen !== generationRef.current) {
        if (__DEV__) console.log(`[onWordTap] gen=${gen} stale after sent, discard`);
        return;
      }

      if (__DEV__) {
        console.log(
          `[onWordTap] gen=${gen} sent="${sentRes.translatedSentence?.slice(0, 30)}" err=${sentRes.errorCode}`,
        );
      }

      if (sentRes.status === 'ok' && sentRes.translatedSentence) {
        // Step 1: показать popup с sentence translation (без contextual word yet)
        setPopup({
          ...base,
          status: 'ready',
          result: {
            status: 'ok',
            sourceSentence: sentRes.sourceSentence ?? ctx.plainText,
            translatedSentence: sentRes.translatedSentence,
            translatedWordOffset: sentRes.translatedWordOffset,
            translation: undefined,
            experimental: true,
            source: sentRes.source,
          } as any,
        });

        // Step 2: word translation в фоне → обновляем primary card + alignment.
        // max_tokens 16 → ~250ms warm на M-series. Юзер уже видит sentence.
        translation
          .translate({
            word: expressionText,
            contextWindow: ctx.plainText,
            bookLanguage: bookLang,
            nativeLanguage: nativeLanguage as NativeLanguage,
          })
          .then((wordRes) => {
            // Stale check: пользователь мог тапнуть другое слово
            if (gen !== generationRef.current) return;
            if (wordRes.status !== 'ok' || !wordRes.translation) return;

            // Recompute alignment с известным word translation
            let alignedOffset = sentRes.translatedWordOffset;
            if (sentRes.translatedSentence) {
              const idx = sentRes.translatedSentence
                .toLowerCase()
                .indexOf(wordRes.translation.toLowerCase());
              if (idx >= 0) alignedOffset = idx;
            }

            setPopup((p) => {
              // Защита: popup мог быть закрыт пока word грузился
              if (!p.visible || p.generation !== gen) return p;
              return {
                ...p,
                result: {
                  ...(p.result as any),
                  translation: wordRes.translation,
                  translatedWordOffset: alignedOffset,
                } as any,
              };
            });
          })
          .catch((e) => {
            if (__DEV__) console.warn('[onWordTap] word translate failed:', e);
          });
      } else if (sentRes.errorCode === 'MODEL_LOADING') {
        setPopup({ ...base, status: 'loading' });
      } else {
        setPopup({ ...base, status: 'error' });
      }
    },
    [translation, mweDictionary, bookLang, nativeLanguage],
  );

  const handleSheetClose = useCallback(() => {
    translation.abortSentence(generationRef.current);
    setPopup((p) => ({ ...p, visible: false }));
  }, [translation]);

  const handleHeartToggle = useCallback(async () => {
    const word = popup.word;
    if (!word) return;
    const isSaved = popup.savedToDeck ?? false;
    if (isSaved) {
      await wordStatusRepo.unsave({ word, bookLanguage: bookLang });
    } else {
      await wordStatusRepo.save({ word, bookLanguage: bookLang });
      if (!savedToDeckHintShown) markSavedToDeckHintShown();
    }
    setPopup((p) => ({ ...p, savedToDeck: !isSaved }));
  }, [popup, wordStatusRepo, bookLang, savedToDeckHintShown, markSavedToDeckHintShown]);

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
        onClose={handleSheetClose}
        onTranslateSentence={() => {}}
        onDislike={() => {}}
        onHeartToggle={handleHeartToggle}
      />
    </PhoneShell>
  );
}
