import React, { useState, useCallback, useMemo, useRef, useEffect } from 'react';
import { Pressable, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { FlashList } from '@shopify/flash-list';
import { useReaderTheme } from '../../hooks/useReaderTheme';
import { Fb2Parser } from '../../services/parser/Fb2Parser';
import { Fb2ItemRenderer } from './Fb2Renderer';
import { TranslationPopup } from './TranslationPopup';
import { ReaderTopBar } from './ReaderTopBar';
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

// ─── Constants ─────────────────────────────────────────────────────────────────

const TOP_BAR_HEIGHT = 44;

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
  const settings = useSettingsStore();
  const readerTheme = useReaderTheme();
  const insets = useSafeAreaInsets();
  const listRef = useRef<any>(null);

  const [popupVisible, setPopupVisible] = useState(false);
  const [selectedWord, setSelectedWord] = useState('');
  const [selectedSentence, setSelectedSentence] = useState('');
  const [topBarVisible, setTopBarVisible] = useState(true);
  const [progress, setProgress] = useState(book.progress || 0);

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

  // ─── Handlers ────────────────────────────────────────────────────────────────

  const handleWordTap = useCallback((word: string, sentence: string) => {
    setSelectedWord(word);
    setSelectedSentence(sentence);
    setPopupVisible(true);
  }, []);

  const handleReaderPress = useCallback(() => {
    setTopBarVisible((prev) => !prev);
  }, []);

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
      <FlashList
        ref={listRef}
        data={items}
        renderItem={renderItem}
        {...{estimatedItemSize: 80} as any}
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
      <ReaderTopBar
        title={book.title}
        progress={progress}
        visible={topBarVisible}
        onSettingsPress={() => {
          // TODO: open ReaderSettingsSheet (Task 15)
        }}
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
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
});
