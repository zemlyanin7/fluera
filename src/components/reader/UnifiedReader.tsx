import React, { useState, useCallback, useMemo, useRef, useEffect } from 'react';
import { View, Pressable, StyleSheet, FlatList, useWindowDimensions, ActivityIndicator } from 'react-native';
import { Text } from 'tamagui';
import { useTranslation } from 'react-i18next';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { FlashList } from '@shopify/flash-list';
import { useReaderTheme } from '../../hooks/useReaderTheme';
import { UnifiedItemRenderer, extractItemText } from './UnifiedRenderer';
import { TranslationPopup } from './TranslationPopup';
import { ReaderTopBar } from './ReaderTopBar';
import { ReaderSettingsSheet } from './ReaderSettingsSheet';
import { FootnoteSheet } from './FootnoteSheet';
import { useSettingsStore } from '../../stores/settingsStore';
import { useWordStatusBatch } from '../../hooks/useWordStatusBatch';
import { useChapterLoader } from '../../hooks/useChapterLoader';
import { database } from '../../db';
import type { Book } from '../../db/models/Book';
import type { ContentItem } from '../../services/parser/types';
import type { WordStatusValue } from '../../utils/types';

// ─── Типы ───────────────────────────────────────────────────────────────────────

interface UnifiedReaderProps {
  book: Book;
  bookLanguage: string;
  nativeLanguage: string;
}

// FlatItem — прямой ContentItem без обёртки
type FlatItem = ContentItem;

interface PageData {
  pageIndex: number;
  items: FlatItem[];
  firstItemIndex: number; // Индекс в объединённом массиве items
}

// ─── Константы ──────────────────────────────────────────────────────────────────

const TOP_BAR_HEIGHT = 44;
const MEASURE_BATCH_SIZE = 50;

// ─── Вспомогательные функции ────────────────────────────────────────────────────

/** Извлекает слова из ContentItem для useWordStatusBatch */
function extractWordsFromItem(item: ContentItem): string[] {
  const text = extractItemText(item);
  return text.split(/\s+/).filter(Boolean);
}

// ─── Компонент ──────────────────────────────────────────────────────────────────

export function UnifiedReader({ book, bookLanguage, nativeLanguage }: UnifiedReaderProps) {
  const { t } = useTranslation();
  const settings = useSettingsStore();
  const readerTheme = useReaderTheme();
  const insets = useSafeAreaInsets();
  const { width: screenWidth, height: screenHeight } = useWindowDimensions();
  const pageHeight = screenHeight - insets.top - TOP_BAR_HEIGHT - insets.bottom;

  const listRef = useRef<any>(null);

  const [popupVisible, setPopupVisible] = useState(false);
  const [selectedWord, setSelectedWord] = useState('');
  const [selectedSentence, setSelectedSentence] = useState('');
  const [topBarVisible, setTopBarVisible] = useState(true);
  const [progress, setProgress] = useState(book.progress || 0);
  const [settingsVisible, setSettingsVisible] = useState(false);

  // Состояние сноски
  const [footnoteId, setFootnoteId] = useState<string | null>(null);
  const [footnoteVisible, setFootnoteVisible] = useState(false);

  // ─── Начальная позиция ───────────────────────────────────────────────────────

  const initialPosition = useMemo(() => {
    if (book.lastPosition) {
      try {
        const pos = JSON.parse(book.lastPosition) as { chapter?: number; charOffset?: number };
        return { chapter: pos.chapter ?? 0, charOffset: pos.charOffset ?? 0 };
      } catch {
        return { chapter: 0, charOffset: 0 };
      }
    }
    return { chapter: 0, charOffset: 0 };
  }, [book.lastPosition]);

  const totalChapters = book.totalChapters ?? 1;

  // ─── Загрузка глав ──────────────────────────────────────────────────────────

  const { items, chapterRanges, loading, footnotes, loadChapterByIndex } = useChapterLoader(
    book.id,
    initialPosition.chapter,
    totalChapters,
  );

  // ─── Пагинация — состояние ───────────────────────────────────────────────────

  const [pages, setPages] = useState<PageData[]>([]);
  const [measureBatchIndex, setMeasureBatchIndex] = useState(0);
  const itemHeightsRef = useRef<Map<number, number>>(new Map());
  const [measurementComplete, setMeasurementComplete] = useState(false);
  const paginatedListRef = useRef<FlatList<PageData>>(null);
  const remeasureTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isInitialMountRef = useRef(true);

  // ─── Отслеживание позиции ────────────────────────────────────────────────────

  const firstVisibleIndexRef = useRef(0);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  /** Вычисляет номер главы и charOffset по индексу элемента в объединённом массиве */
  const computePosition = useCallback(
    (flatIndex: number): { chapter: number; charOffset: number } => {
      if (chapterRanges.length === 0) return { chapter: initialPosition.chapter, charOffset: 0 };

      // Ищем главу, в которую попадает flatIndex
      let foundRange = chapterRanges[0];
      for (const range of chapterRanges) {
        if (flatIndex >= range.startIndex) {
          foundRange = range;
        } else {
          break;
        }
      }

      // Приблизительное смещение в символах внутри главы
      const itemsInChapter = items.slice(foundRange.startIndex, flatIndex);
      const charsInChapter = itemsInChapter.reduce((sum, item) => {
        return sum + extractItemText(item).length;
      }, 0);

      return {
        chapter: foundRange.chapter,
        charOffset: foundRange.charOffset + charsInChapter,
      };
    },
    [chapterRanges, items, initialPosition.chapter],
  );

  const savePosition = useCallback(() => {
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(async () => {
      try {
        const flatIndex = firstVisibleIndexRef.current;
        const totalItems = items.length;
        const pct = totalItems > 0 ? Math.min(100, (flatIndex / totalItems) * 100) : 0;
        const { chapter, charOffset } = computePosition(flatIndex);

        await database.write(async () => {
          await book.update((record) => {
            record.lastPosition = JSON.stringify({ chapter, charOffset });
            record.progress = pct;
            record.lastReadAt = new Date();
          });
        });
      } catch (err) {
        console.warn('[UnifiedReader] Не удалось сохранить позицию:', err);
      }
    }, 1500);
  }, [book, items.length, computePosition]);

  // Сохраняем финальную позицию при размонтировании
  useEffect(() => {
    return () => {
      if (saveTimer.current) clearTimeout(saveTimer.current);
      const totalItems = items.length;
      if (totalItems === 0) return;
      const flatIndex = firstVisibleIndexRef.current;
      const pct = Math.min(100, (flatIndex / totalItems) * 100);
      const { chapter, charOffset } = computePosition(flatIndex);
      database
        .write(async () => {
          await book.update((record) => {
            record.lastPosition = JSON.stringify({ chapter, charOffset });
            record.progress = pct;
            record.lastReadAt = new Date();
          });
        })
        .catch((err) => console.warn('[UnifiedReader] Не удалось сохранить финальную позицию:', err));
    };
  }, [book, items.length, computePosition]);

  // ─── Сбор видимых слов ───────────────────────────────────────────────────────

  const [visibleWords, setVisibleWords] = useState<string[]>([]);
  const wordColors = useWordStatusBatch(visibleWords, bookLanguage, nativeLanguage);

  // ─── Начальный индекс скролла ────────────────────────────────────────────────

  const initialScrollIndex = useMemo(() => {
    if (chapterRanges.length === 0 || items.length === 0) return 0;

    // Находим диапазон начальной главы
    const range = chapterRanges.find((r) => r.chapter === initialPosition.chapter);
    if (!range) return 0;

    // Восстанавливаем примерный flatIndex по charOffset
    const targetCharOffset = initialPosition.charOffset - range.charOffset;
    if (targetCharOffset <= 0) return range.startIndex;

    let accumulated = 0;
    for (let i = range.startIndex; i < range.endIndex && i < items.length; i++) {
      const len = extractItemText(items[i]).length;
      if (accumulated + len >= targetCharOffset) return i;
      accumulated += len;
    }
    return range.startIndex;
  }, [chapterRanges, items, initialPosition]);

  // ─── Пакетное измерение элементов для постраничного режима ──────────────────

  const batchStart = measureBatchIndex * MEASURE_BATCH_SIZE;
  const batchEnd = Math.min(batchStart + MEASURE_BATCH_SIZE, items.length);
  const currentBatchItems = items.slice(batchStart, batchEnd);
  const batchMeasuredRef = useRef(0);

  const handleItemLayout = useCallback(
    (globalIndex: number, height: number) => {
      itemHeightsRef.current.set(globalIndex, height);
      batchMeasuredRef.current += 1;

      if (batchMeasuredRef.current >= currentBatchItems.length) {
        batchMeasuredRef.current = 0;
        if (batchEnd >= items.length) {
          setMeasurementComplete(true);
        } else {
          setMeasureBatchIndex((prev) => prev + 1);
        }
      }
    },
    [currentBatchItems.length, batchEnd, items.length],
  );

  // Контейнер для off-screen измерений (только в постраничном режиме)
  const MeasureContainer = useMemo(() => {
    if (settings.scrollMode !== 'paginated' || measurementComplete) return null;
    if (items.length === 0) return null;

    return (
      <View
        style={{ position: 'absolute', top: -9999, left: 0, width: screenWidth - 32 }}
        pointerEvents="none"
      >
        {currentBatchItems.map((item, idx) => {
          const globalIndex = batchStart + idx;
          return (
            <View
              key={`measure-${globalIndex}`}
              onLayout={(event) => {
                handleItemLayout(globalIndex, event.nativeEvent.layout.height);
              }}
            >
              <UnifiedItemRenderer
                item={item}
                onWordTap={() => {}}
                wordColors={wordColors}
                fontSize={settings.fontSize}
                lineHeight={settings.lineHeight}
                fontFamily={settings.fontFamily}
                textColor={readerTheme.colors.text}
              />
            </View>
          );
        })}
      </View>
    );
  }, [
    settings.scrollMode,
    measurementComplete,
    items.length,
    currentBatchItems,
    batchStart,
    screenWidth,
    wordColors,
    settings.fontSize,
    settings.lineHeight,
    settings.fontFamily,
    readerTheme.colors.text,
    handleItemLayout,
  ]);

  // ─── Сборка страниц после измерения ─────────────────────────────────────────

  useEffect(() => {
    if (settings.scrollMode !== 'paginated') {
      setPages([]);
      return;
    }
    if (!measurementComplete || items.length === 0) return;

    const heights = itemHeightsRef.current;
    const builtPages: PageData[] = [];
    let currentItems: FlatItem[] = [];
    let currentHeight = 0;
    let pageIndex = 0;
    let pageStartIndex = 0;

    for (let i = 0; i < items.length; i++) {
      const h = heights.get(i) || 40;
      if (currentHeight + h > pageHeight && currentItems.length > 0) {
        builtPages.push({ pageIndex, items: currentItems, firstItemIndex: pageStartIndex });
        pageIndex++;
        pageStartIndex = i;
        currentItems = [items[i]];
        currentHeight = h;
      } else {
        currentItems.push(items[i]);
        currentHeight += h;
      }
    }
    if (currentItems.length > 0) {
      builtPages.push({ pageIndex, items: currentItems, firstItemIndex: pageStartIndex });
    }

    setPages(builtPages);
  }, [measurementComplete, items, pageHeight, settings.scrollMode]);

  // ─── Сброс измерений при изменении настроек отображения ─────────────────────

  useEffect(() => {
    if (isInitialMountRef.current) {
      isInitialMountRef.current = false;
      return;
    }
    if (settings.scrollMode !== 'paginated') return;

    if (remeasureTimerRef.current) clearTimeout(remeasureTimerRef.current);

    remeasureTimerRef.current = setTimeout(() => {
      setPages([]);
      itemHeightsRef.current = new Map();
      setMeasureBatchIndex(0);
      setMeasurementComplete(false);
    }, 300);

    return () => {
      if (remeasureTimerRef.current) clearTimeout(remeasureTimerRef.current);
    };
  }, [settings.fontSize, settings.lineHeight, settings.fontFamily, screenWidth, screenHeight, settings.scrollMode]);

  // ─── Обработчики ────────────────────────────────────────────────────────────

  const handleWordTap = useCallback((word: string, sentence: string) => {
    setSelectedWord(word);
    setSelectedSentence(sentence);
    setPopupVisible(true);
  }, []);

  const handleFootnotePress = useCallback(
    (id: string) => {
      if (footnotes[id]) {
        setFootnoteId(id);
        setFootnoteVisible(true);
      }
    },
    [footnotes],
  );

  const handleReaderPress = useCallback(() => {
    if (settingsVisible) return;
    setTopBarVisible((prev) => !prev);
  }, [settingsVisible]);

  const handleScroll = useCallback(
    (event: { nativeEvent: { contentOffset: { y: number }; contentSize: { height: number } } }) => {
      const { contentOffset, contentSize } = event.nativeEvent;
      if (contentSize.height > 0) {
        const pct = (contentOffset.y / contentSize.height) * 100;
        setProgress(Math.min(100, Math.max(0, pct)));
      }
    },
    [],
  );

  const handlePageChange = useCallback(
    (event: { nativeEvent: { contentOffset: { x: number } } }) => {
      const pageIdx = Math.round(event.nativeEvent.contentOffset.x / screenWidth);
      const page = pages[pageIdx];
      if (page) {
        firstVisibleIndexRef.current = page.firstItemIndex;
        const pct = pages.length > 0 ? ((pageIdx + 1) / pages.length) * 100 : 0;
        setProgress(Math.min(100, pct));
        savePosition();
      }
    },
    [pages, screenWidth, savePosition],
  );

  const handleViewableItemsChanged = useCallback(
    ({ viewableItems }: { viewableItems: { item: FlatItem; index: number | null }[] }) => {
      if (viewableItems.length > 0 && viewableItems[0].index != null) {
        firstVisibleIndexRef.current = viewableItems[0].index;
        savePosition();
      }

      // Предзагрузка следующей главы, когда пользователь достиг 80% загруженного контента
      if (viewableItems.length > 0 && items.length > 0) {
        const lastVisible = viewableItems[viewableItems.length - 1];
        const lastIndex = lastVisible.index ?? 0;
        if (lastIndex >= items.length * 0.8) {
          // Определяем текущую главу и запрашиваем предзагрузку следующей
          let currentChapterIdx = 0;
          for (const range of chapterRanges) {
            if (lastIndex >= range.startIndex) currentChapterIdx = range.chapter;
          }
          void loadChapterByIndex(currentChapterIdx + 1);
        }
      }

      // Собираем видимые слова для useWordStatusBatch
      const words: string[] = [];
      for (const { item } of viewableItems) {
        words.push(...extractWordsFromItem(item));
      }
      setVisibleWords(words);
    },
    [savePosition, items.length, chapterRanges, loadChapterByIndex],
  );

  const renderItem = useCallback(
    ({ item }: { item: FlatItem }) => (
      <UnifiedItemRenderer
        item={item}
        onWordTap={handleWordTap}
        wordColors={wordColors}
        fontSize={settings.fontSize}
        lineHeight={settings.lineHeight}
        fontFamily={settings.fontFamily}
        textColor={readerTheme.colors.text}
        onFootnotePress={handleFootnotePress}
      />
    ),
    [
      handleWordTap,
      wordColors,
      settings.fontSize,
      settings.lineHeight,
      settings.fontFamily,
      readerTheme.colors.text,
      handleFootnotePress,
    ],
  );

  const getItemType = useCallback((item: FlatItem) => {
    return item.type;
  }, []);

  // ─── Постраничный рендер ─────────────────────────────────────────────────────

  const renderPage = useCallback(
    ({ item: page }: { item: PageData }) => (
      <View style={{ width: screenWidth, height: pageHeight, paddingHorizontal: 16 }}>
        {page.items.map((flatItem, idx) => (
          <UnifiedItemRenderer
            key={`${page.pageIndex}-${idx}`}
            item={flatItem}
            onWordTap={handleWordTap}
            wordColors={wordColors}
            fontSize={settings.fontSize}
            lineHeight={settings.lineHeight}
            fontFamily={settings.fontFamily}
            textColor={readerTheme.colors.text}
            onFootnotePress={handleFootnotePress}
          />
        ))}
      </View>
    ),
    [
      screenWidth,
      pageHeight,
      handleWordTap,
      wordColors,
      settings.fontSize,
      settings.lineHeight,
      settings.fontFamily,
      readerTheme.colors.text,
      handleFootnotePress,
    ],
  );

  // Определяем начальную страницу для постраничного режима
  const initialPageIndex = useMemo(() => {
    if (settings.scrollMode !== 'paginated' || pages.length === 0) return 0;
    for (let p = pages.length - 1; p >= 0; p--) {
      if (pages[p].firstItemIndex <= initialScrollIndex) return p;
    }
    return 0;
  }, [pages, initialScrollIndex, settings.scrollMode]);

  // ─── Заглушки для TranslationPopup ──────────────────────────────────────────

  const handleSave = useCallback(
    async (
      _word: string,
      _translation: string,
      _grammar: string,
      _sentence: string,
    ): Promise<void> => {
      // TODO: Создать/обновить WordStatus + WordOccurrence в БД (Task 14)
    },
    [],
  );

  const handleStatusChange = useCallback((_status: WordStatusValue): void => {
    // TODO: Обновить WordStatus в БД (Task 14)
  }, []);

  const handlePopupClose = useCallback(() => {
    setPopupVisible(false);
    setSelectedWord('');
    setSelectedSentence('');
  }, []);

  // ─── Рендер ──────────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <View style={[styles.container, { backgroundColor: readerTheme.colors.background }]}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#6c63ff" />
          <Text color={readerTheme.colors.textSecondary} marginTop={12}>
            {t('reader.loading')}
          </Text>
        </View>
      </View>
    );
  }

  return (
    <Pressable
      style={[styles.container, { backgroundColor: readerTheme.colors.background }]}
      onPress={handleReaderPress}
    >
      {/* Контейнер для off-screen измерений (скрыт, только в фазе измерения) */}
      {MeasureContainer}

      {settings.scrollMode === 'scroll' ? (
        // Режим вертикального скролла — FlashList
        <FlashList
          ref={listRef}
          data={items}
          renderItem={renderItem}
          {...({ estimatedItemSize: 80 } as any)}
          getItemType={getItemType}
          keyExtractor={(_, index) => String(index)}
          onScroll={handleScroll}
          scrollEventThrottle={500}
          initialScrollIndex={initialScrollIndex > 0 ? initialScrollIndex : undefined}
          onViewableItemsChanged={handleViewableItemsChanged}
          viewabilityConfig={{ itemVisiblePercentThreshold: 10 }}
          contentContainerStyle={{
            paddingHorizontal: 16,
            paddingTop: insets.top + TOP_BAR_HEIGHT,
            paddingBottom: insets.bottom,
          }}
        />
      ) : pages.length > 0 ? (
        // Постраничный режим — горизонтальный FlatList
        <FlatList
          ref={paginatedListRef}
          data={pages}
          renderItem={renderPage}
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          keyExtractor={(page) => String(page.pageIndex)}
          onMomentumScrollEnd={handlePageChange}
          initialScrollIndex={initialPageIndex > 0 ? initialPageIndex : undefined}
          getItemLayout={(_, index) => ({
            length: screenWidth,
            offset: screenWidth * index,
            index,
          })}
          style={{ marginTop: insets.top + TOP_BAR_HEIGHT }}
        />
      ) : settings.scrollMode === 'paginated' && items.length > 0 ? (
        // Фаза измерения — показываем индикатор загрузки
        <View style={styles.loadingContainer}>
          <Text color={readerTheme.colors.textSecondary}>{t('reader.loading')}</Text>
        </View>
      ) : null}

      <ReaderTopBar
        title={book.title}
        progress={progress}
        visible={topBarVisible}
        onSettingsPress={() => setSettingsVisible(true)}
      />
      <TranslationPopup
        visible={popupVisible}
        word={selectedWord}
        sentence={selectedSentence}
        bookLanguage={bookLanguage}
        nativeLanguage={nativeLanguage}
        isPhrase={false}
        onClose={handlePopupClose}
        onSave={handleSave}
        onStatusChange={handleStatusChange}
      />
      <ReaderSettingsSheet
        visible={settingsVisible}
        onClose={() => setSettingsVisible(false)}
      />
      <FootnoteSheet
        visible={footnoteVisible}
        footnoteId={footnoteId}
        content={footnoteId ? (footnotes[footnoteId] ?? null) : null}
        onClose={() => setFootnoteVisible(false)}
        textColor={readerTheme.colors.text}
        backgroundColor={readerTheme.colors.background}
        fontSize={settings.fontSize}
      />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
});
