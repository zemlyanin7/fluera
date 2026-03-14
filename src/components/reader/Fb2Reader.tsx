import React, { useState, useCallback, useMemo, useRef, useEffect } from 'react';
import { View, Pressable, StyleSheet, FlatList, useWindowDimensions } from 'react-native';
import { Text } from 'tamagui';
import { useTranslation } from 'react-i18next';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { FlashList } from '@shopify/flash-list';
import { useReaderTheme } from '../../hooks/useReaderTheme';
import { Fb2Parser } from '../../services/parser/Fb2Parser';
import { Fb2ItemRenderer } from './Fb2Renderer';
import { TranslationPopup } from './TranslationPopup';
import { ReaderTopBar } from './ReaderTopBar';
import { ReaderSettingsSheet } from './ReaderSettingsSheet';
import { useSettingsStore } from '../../stores/settingsStore';
import { useWordStatusBatch } from '../../hooks/useWordStatusBatch';
import { database } from '../../db';
import type { Book } from '../../db/models/Book';
import type { Fb2Paragraph, Fb2Section } from '../../services/parser/types';
import type { WordStatusValue } from '../../utils/types';

// ─── Types ─────────────────────────────────────────────────────────────────────

interface Fb2ReaderProps {
  xml: string;
  book: Book;
  bookLanguage: string;
  nativeLanguage: string;
}

type FlatItem =
  | { type: 'section-title'; title: string }
  | { type: 'paragraph'; data: Fb2Paragraph };

interface PageData {
  pageIndex: number;
  items: FlatItem[];
  firstParagraphIndex: number; // Index into the flat `items` array — for position saving
}

// ─── Constants ─────────────────────────────────────────────────────────────────

const TOP_BAR_HEIGHT = 44;
const MEASURE_BATCH_SIZE = 50; // Measure ~50 paragraphs at a time per spec

// ─── Helpers ───────────────────────────────────────────────────────────────────

function flattenSections(sections: Fb2Section[]): FlatItem[] {
  const items: FlatItem[] = [];
  for (const section of sections) {
    if (section.title) {
      items.push({ type: 'section-title', title: section.title });
    }
    for (const para of section.paragraphs) {
      items.push({ type: 'paragraph', data: para });
    }
  }
  return items;
}

// ─── Component ─────────────────────────────────────────────────────────────────

export function Fb2Reader({ xml, book, bookLanguage, nativeLanguage }: Fb2ReaderProps) {
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

  // ─── Pagination state ────────────────────────────────────────────────────────
  const [pages, setPages] = useState<PageData[]>([]);
  const [measureBatchIndex, setMeasureBatchIndex] = useState(0);
  const itemHeightsRef = useRef<Map<number, number>>(new Map()); // useRef to avoid O(N²) re-renders
  const [measurementComplete, setMeasurementComplete] = useState(false);
  const paginatedListRef = useRef<FlatList<PageData>>(null);
  const remeasureTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Parse and flatten FB2 content
  const items = useMemo(() => {
    try {
      const parsed = Fb2Parser.parse(xml);
      console.log('[Fb2Reader] Parsed:', {
        title: parsed.title,
        sectionsCount: parsed.sections.length,
        firstSectionParagraphs: parsed.sections[0]?.paragraphs?.length,
        firstPara: JSON.stringify(parsed.sections[0]?.paragraphs?.[0])?.slice(0, 200),
      });
      const flat = flattenSections(parsed.sections);
      console.log('[Fb2Reader] Flattened items:', flat.length);
      return flat;
    } catch (err) {
      console.error('[Fb2Reader] Parse error:', err);
      return [];
    }
  }, [xml]);

  // Collect all words for batch status lookup
  const [visibleWords, setVisibleWords] = useState<string[]>([]);
  const wordColors = useWordStatusBatch(visibleWords, bookLanguage, nativeLanguage);

  // Restore initial scroll position from book.lastPosition JSON {index: number}
  const initialScrollIndex = useMemo(() => {
    if (book.lastPosition) {
      try {
        const pos = JSON.parse(book.lastPosition) as { index?: number };
        return pos.index ?? 0;
      } catch {
        return 0;
      }
    }
    return 0;
  }, [book.lastPosition]);

  // ─── Position saving (debounced) ────────────────────────────────────────────
  const firstVisibleIndex = useRef(initialScrollIndex);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const savePosition = useCallback(() => {
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(async () => {
      try {
        const idx = firstVisibleIndex.current;
        const totalItems = items.length;
        const pct = totalItems > 0 ? Math.min(100, (idx / totalItems) * 100) : 0;
        await database.write(async () => {
          await book.update((record) => {
            record.lastPosition = JSON.stringify({ index: idx });
            record.progress = pct;
            record.lastReadAt = new Date();
          });
        });
      } catch (err) {
        console.warn('[Fb2Reader] Failed to save position:', err);
      }
    }, 1500);
  }, [book, items.length]);

  // Clean up timer on unmount + save final position
  useEffect(() => {
    return () => {
      if (saveTimer.current) clearTimeout(saveTimer.current);
      // Save final position on exit
      const idx = firstVisibleIndex.current;
      const totalItems = items.length;
      const pct = totalItems > 0 ? Math.min(100, (idx / totalItems) * 100) : 0;
      database.write(async () => {
        await book.update((record) => {
          record.lastPosition = JSON.stringify({ index: idx });
          record.progress = pct;
          record.lastReadAt = new Date();
        });
      }).catch((err) => console.warn('[Fb2Reader] Failed to save final position:', err));
    };
  }, [book, items.length]);

  // ─── Chunked measurement ─────────────────────────────────────────────────────

  // Calculate which batch of items to measure
  const batchStart = measureBatchIndex * MEASURE_BATCH_SIZE;
  const batchEnd = Math.min(batchStart + MEASURE_BATCH_SIZE, items.length);
  const currentBatchItems = items.slice(batchStart, batchEnd);

  // Track measurements for current batch
  const batchMeasuredRef = useRef(0);

  const handleItemLayout = useCallback(
    (globalIndex: number, height: number) => {
      itemHeightsRef.current.set(globalIndex, height);
      batchMeasuredRef.current += 1;

      // When current batch is fully measured, advance to next batch or finish
      if (batchMeasuredRef.current >= currentBatchItems.length) {
        batchMeasuredRef.current = 0;
        if (batchEnd >= items.length) {
          // All batches measured
          setMeasurementComplete(true);
        } else {
          // Advance to next batch
          setMeasureBatchIndex((prev) => prev + 1);
        }
      }
    },
    [currentBatchItems.length, batchEnd, items.length],
  );

  // Render items off-screen to measure heights (only during measurement phase)
  const MeasureContainer = useMemo(() => {
    if (settings.scrollMode !== 'paginated' || measurementComplete) return null;
    if (items.length === 0) return null;

    return (
      <View
        style={{
          position: 'absolute',
          top: -9999,
          left: 0,
          width: screenWidth - 32, // account for paddingHorizontal
        }}
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
              <Fb2ItemRenderer
                item={item.type === 'section-title' ? item.title : item.data}
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
  }, [settings.scrollMode, measurementComplete, items.length, currentBatchItems, batchStart, screenWidth, wordColors, settings.fontSize, settings.lineHeight, settings.fontFamily, readerTheme.colors.text, handleItemLayout]);

  // ─── Build pages when all measurements are done ──────────────────────────────

  useEffect(() => {
    if (settings.scrollMode !== 'paginated') {
      setPages([]);
      return;
    }

    if (!measurementComplete || items.length === 0) return;

    // Group items into pages using measured heights
    const heights = itemHeightsRef.current;
    const builtPages: PageData[] = [];
    let currentItems: FlatItem[] = [];
    let currentHeight = 0;
    let pageIndex = 0;
    let pageStartIndex = 0;

    for (let i = 0; i < items.length; i++) {
      const h = heights.get(i) || 40;
      if (currentHeight + h > pageHeight && currentItems.length > 0) {
        builtPages.push({
          pageIndex,
          items: currentItems,
          firstParagraphIndex: pageStartIndex,
        });
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
      builtPages.push({
        pageIndex,
        items: currentItems,
        firstParagraphIndex: pageStartIndex,
      });
    }

    setPages(builtPages);
  }, [measurementComplete, items, pageHeight, settings.scrollMode]);

  // ─── Debounced re-measurement when display settings change ───────────────────

  useEffect(() => {
    if (settings.scrollMode !== 'paginated') return;

    // Debounce re-measurement to avoid rapid re-renders when holding A-/A+ button
    if (remeasureTimerRef.current) {
      clearTimeout(remeasureTimerRef.current);
    }

    remeasureTimerRef.current = setTimeout(() => {
      setPages([]);
      itemHeightsRef.current = new Map();
      setMeasureBatchIndex(0);
      setMeasurementComplete(false);
    }, 300); // 300ms debounce

    return () => {
      if (remeasureTimerRef.current) {
        clearTimeout(remeasureTimerRef.current);
      }
    };
  }, [settings.fontSize, settings.lineHeight, settings.fontFamily, screenWidth, screenHeight, settings.scrollMode]);

  // ─── Handlers ────────────────────────────────────────────────────────────────

  const handleWordTap = useCallback((word: string, sentence: string) => {
    setSelectedWord(word);
    setSelectedSentence(sentence);
    setPopupVisible(true);
  }, []);

  const handleReaderPress = useCallback(() => {
    if (settingsVisible) return; // Don't toggle TopBar while settings sheet is open
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
        // Use pre-computed firstParagraphIndex for O(1) position tracking
        firstVisibleIndex.current = page.firstParagraphIndex;

        const pct = pages.length > 0 ? ((pageIdx + 1) / pages.length) * 100 : 0;
        setProgress(Math.min(100, pct));
        savePosition();
      }
    },
    [pages, screenWidth, savePosition],
  );

  const handleViewableItemsChanged = useCallback(
    ({ viewableItems }: { viewableItems: { item: FlatItem; index: number | null }[] }) => {
      // Track first visible item index for position saving
      if (viewableItems.length > 0 && viewableItems[0].index != null) {
        firstVisibleIndex.current = viewableItems[0].index;
        savePosition();
      }

      const words: string[] = [];
      for (const { item } of viewableItems) {
        if (item.type === 'section-title') {
          const titleWords = item.title.split(/\s+/).filter(Boolean);
          words.push(...titleWords);
        } else {
          for (const inline of item.data.children) {
            if (inline.text) {
              const inlineWords = inline.text.split(/\s+/).filter(Boolean);
              words.push(...inlineWords);
            }
            if (inline.children) {
              for (const child of inline.children) {
                if (child.text) {
                  const childWords = child.text.split(/\s+/).filter(Boolean);
                  words.push(...childWords);
                }
              }
            }
          }
        }
      }
      setVisibleWords(words);
    },
    [savePosition],
  );

  const renderItem = useCallback(
    ({ item }: { item: FlatItem }) => {
      if (item.type === 'section-title') {
        return (
          <Fb2ItemRenderer
            item={item.title}
            onWordTap={handleWordTap}
            wordColors={wordColors}
            fontSize={settings.fontSize}
            lineHeight={settings.lineHeight}
            fontFamily={settings.fontFamily}
            textColor={readerTheme.colors.text}
          />
        );
      }
      return (
        <Fb2ItemRenderer
          item={item.data}
          onWordTap={handleWordTap}
          wordColors={wordColors}
          fontSize={settings.fontSize}
          lineHeight={settings.lineHeight}
          fontFamily={settings.fontFamily}
          textColor={readerTheme.colors.text}
        />
      );
    },
    [handleWordTap, wordColors, settings.fontSize, settings.lineHeight, settings.fontFamily, readerTheme.colors.text],
  );

  const getItemType = useCallback((item: FlatItem) => {
    return item.type === 'section-title' ? 'title' : item.data.type;
  }, []);

  // ─── Paginated render ─────────────────────────────────────────────────────────

  const renderPage = useCallback(
    ({ item: page }: { item: PageData }) => {
      return (
        <View style={{ width: screenWidth, height: pageHeight, paddingHorizontal: 16 }}>
          {page.items.map((flatItem, idx) => (
            <Fb2ItemRenderer
              key={`${page.pageIndex}-${idx}`}
              item={flatItem.type === 'section-title' ? flatItem.title : flatItem.data}
              onWordTap={handleWordTap}
              wordColors={wordColors}
              fontSize={settings.fontSize}
              lineHeight={settings.lineHeight}
              fontFamily={settings.fontFamily}
              textColor={readerTheme.colors.text}
            />
          ))}
        </View>
      );
    },
    [screenWidth, pageHeight, handleWordTap, wordColors, settings.fontSize, settings.lineHeight, settings.fontFamily, readerTheme.colors.text],
  );

  // Find initial page from saved position (reverse search for last page whose firstParagraphIndex <= savedIdx)
  const initialPageIndex = useMemo(() => {
    if (settings.scrollMode !== 'paginated' || pages.length === 0) return 0;
    const savedIdx = initialScrollIndex;

    // Binary-search style: find the last page whose firstParagraphIndex <= savedIdx
    for (let p = pages.length - 1; p >= 0; p--) {
      if (pages[p].firstParagraphIndex <= savedIdx) {
        return p;
      }
    }
    return 0;
  }, [pages, initialScrollIndex, settings.scrollMode]);

  // ─── TranslationPopup callbacks (placeholders) ────────────────────────────────

  const handleSave = useCallback(
    async (
      _word: string,
      _translation: string,
      _grammar: string,
      _sentence: string,
    ): Promise<void> => {
      // TODO: Create/update WordStatus + WordOccurrence in DB (Task 14)
    },
    [],
  );

  const handleStatusChange = useCallback((_status: WordStatusValue): void => {
    // TODO: Update WordStatus in DB (Task 14)
  }, []);

  const handlePopupClose = useCallback(() => {
    setPopupVisible(false);
    setSelectedWord('');
    setSelectedSentence('');
  }, []);

  // ─── Render ──────────────────────────────────────────────────────────────────

  return (
    <Pressable
      style={[styles.container, { backgroundColor: readerTheme.colors.background }]}
      onPress={handleReaderPress}
    >
      {/* Measurement container (hidden, only during measurement phase) */}
      {MeasureContainer}

      {settings.scrollMode === 'scroll' ? (
        // Vertical scroll mode — existing FlashList
        <FlashList
          ref={listRef}
          data={items}
          renderItem={renderItem}
          {...{ estimatedItemSize: 80 } as any}
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
        // Paginated mode — horizontal FlatList
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
        // Measuring phase — show loading
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
