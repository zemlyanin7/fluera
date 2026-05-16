// Continuous-scroll: рендерит ВСЕ chapters одним FlatList'ом.
// Chapter boundaries отмечены секциями с heading (внутри items уже).
// Дополнительно вставляем chapter-start marker для onViewableItemsChanged
// чтобы определять текущую главу для TopBar.
import React, { useCallback, useImperativeHandle, useMemo, useRef } from 'react';
import { FlatList, View } from 'react-native';
import type { BookChapter, ContentItem } from '@/types/content';
import type { ScriptId } from '@/theme/scripts';
import { ContentItemRenderer } from './ContentItemRenderer';

/**
 * Один FlatList item: либо ContentItem (paragraph/heading/...),
 * либо chapter-boundary marker (для viewability tracking + jump).
 */
type FlatItem =
  | { kind: 'chapter-marker'; chapterIndex: number }
  | { kind: 'content'; chapterIndex: number; itemIndex: number; item: ContentItem };

export interface BookRendererHandle {
  scrollToChapter: (chapterIndex: number) => void;
}

interface Props {
  chapters: BookChapter[];
  onWordTap: (word: string, sentence: string) => void;
  /** Срабатывает при изменении видимой chapter (для TopBar). */
  onCurrentChapterChange: (chapterIndex: number) => void;
  /** Throttled offsetY callback для savePosition. */
  onScroll: (offsetY: number) => void;
  fontSize: number;
  script: ScriptId;
  bookId: string;
}

export const BookRenderer = React.forwardRef<BookRendererHandle, Props>(function BookRenderer(
  props,
  ref,
) {
  const listRef = useRef<FlatList<FlatItem>>(null);

  // Flat array со всеми chapters + chapter-markers.
  const flatItems = useMemo<FlatItem[]>(() => {
    const out: FlatItem[] = [];
    for (const ch of props.chapters) {
      out.push({ kind: 'chapter-marker', chapterIndex: ch.index });
      for (let i = 0; i < ch.items.length; i++) {
        const item = ch.items[i];
        if (item) out.push({ kind: 'content', chapterIndex: ch.index, itemIndex: i, item });
      }
    }
    return out;
  }, [props.chapters]);

  // chapterIndex → flatItems index (для scrollToChapter).
  const chapterStartMap = useMemo(() => {
    const m = new Map<number, number>();
    for (let i = 0; i < flatItems.length; i++) {
      const f = flatItems[i];
      if (f?.kind === 'chapter-marker') m.set(f.chapterIndex, i);
    }
    return m;
  }, [flatItems]);

  useImperativeHandle(ref, () => ({
    scrollToChapter: (chapterIndex: number) => {
      const idx = chapterStartMap.get(chapterIndex);
      if (idx === undefined || !listRef.current) return;
      listRef.current.scrollToIndex({ index: idx, animated: true, viewPosition: 0 });
    },
  }));

  const keyExtractor = useCallback((it: FlatItem) => {
    if (it.kind === 'chapter-marker') return `ch-${it.chapterIndex}`;
    return `c${it.chapterIndex}-i${it.itemIndex}`;
  }, []);

  const renderItem = useCallback(
    ({ item }: { item: FlatItem }) => {
      if (item.kind === 'chapter-marker') {
        // Невидимый маркер высоты 1px — чисто для viewability tracking.
        return <View style={{ height: 1 }} />;
      }
      return (
        <ContentItemRenderer
          item={item.item}
          onWordTap={props.onWordTap}
          fontSize={props.fontSize}
          script={props.script}
          bookId={props.bookId}
        />
      );
    },
    [props.onWordTap, props.fontSize, props.script, props.bookId],
  );

  const viewabilityConfig = useRef({
    itemVisiblePercentThreshold: 1,
    minimumViewTime: 50,
  }).current;

  const onViewableItemsChanged = useRef(
    ({ viewableItems }: { viewableItems: { item: FlatItem }[] }) => {
      // Берём самый верхний viewable item — определяет current chapter.
      const first = viewableItems[0]?.item;
      if (first) props.onCurrentChapterChange(first.chapterIndex);
    },
  ).current;

  return (
    <FlatList
      ref={listRef}
      data={flatItems}
      keyExtractor={keyExtractor}
      renderItem={renderItem}
      initialNumToRender={25}
      windowSize={7}
      maxToRenderPerBatch={15}
      removeClippedSubviews
      onScroll={(e) => props.onScroll(e.nativeEvent.contentOffset.y)}
      scrollEventThrottle={250}
      viewabilityConfig={viewabilityConfig}
      onViewableItemsChanged={onViewableItemsChanged}
      onScrollToIndexFailed={(info) => {
        // Fallback на approximate offset (FlatList не measured ещё)
        const offset = info.averageItemLength * info.index;
        listRef.current?.scrollToOffset({ offset, animated: false });
      }}
      contentContainerStyle={{ padding: 28, paddingBottom: 80 }}
    />
  );
});
