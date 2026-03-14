import React, { useState, useCallback, useMemo, useRef } from 'react';
import { YStack } from 'tamagui';
import { FlashList } from '@shopify/flash-list';
import { Fb2Parser } from '../../services/parser/Fb2Parser';
import { Fb2ItemRenderer } from './Fb2Renderer';
import { TranslationPopup } from './TranslationPopup';
import { ReaderTopBar } from './ReaderTopBar';
import { useSettingsStore } from '../../stores/settingsStore';
import { useWordStatusBatch } from '../../hooks/useWordStatusBatch';
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
      return flattenSections(parsed.sections);
    } catch {
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
    ({ viewableItems }: { viewableItems: { item: FlatItem }[] }) => {
      const words: string[] = [];
      for (const { item } of viewableItems) {
        if (item.type === 'section-title') {
          // tokenise title words
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
    [],
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
        />
      );
    },
    [handleWordTap, wordColors, settings.fontSize, settings.lineHeight, settings.fontFamily],
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
    <YStack flex={1} onPress={handleReaderPress}>
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
        contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 60, paddingBottom: 40 }}
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
    </YStack>
  );
}
