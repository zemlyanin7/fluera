// Continuous-scroll: рендерит ВСЕ chapters одним FlatList'ом.
// Chapter boundaries отмечены секциями с heading (внутри items уже).
// Дополнительно вставляем chapter-start marker для onViewableItemsChanged
// чтобы определять текущую главу для TopBar.
//
// Position save/restore: храним top-visible flat item index. scrollToIndex
// надёжнее scrollToOffset потому что FlatList всегда умеет найти item по
// индексу (через onScrollToIndexFailed retry). Pixel offset ломается на
// virtualized lists с unmeasured items.
import React, { useCallback, useImperativeHandle, useMemo, useRef } from 'react';
import { FlatList, View } from 'react-native';
import type { BookChapter, ContentItem, InlineNode } from '@/types/content';
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
  scrollToFlatIndex: (flatIndex: number) => void;
}

interface Props {
  chapters: BookChapter[];
  onWordTap: (word: string, sentence: string, inlines: InlineNode[], charOffset: number) => void;
  /** Срабатывает при изменении видимой chapter (для TopBar). */
  onCurrentChapterChange: (chapterIndex: number) => void;
  /** Срабатывает при изменении top-visible flat item (для save position). */
  onTopFlatItemChange: (flatIndex: number) => void;
  fontSize: number;
  script: ScriptId;
  bookId: string;
  /** Отключить виртуализацию на время multi-word selection (все items рендерятся). */
  selectionActive?: boolean;
}

export const BookRenderer = React.forwardRef<BookRendererHandle, Props>(function BookRenderer(
  { selectionActive = false, ...props },
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

  // Pending flatIndex для retry при onScrollToIndexFailed.
  const pendingScrollRef = useRef<number | null>(null);

  const doScrollToFlatIndex = useCallback((idx: number) => {
    if (idx < 0 || !listRef.current) return;
    pendingScrollRef.current = idx;
    try {
      listRef.current.scrollToIndex({
        index: idx,
        animated: false,
        viewPosition: 0,
      });
    } catch {
      // onScrollToIndexFailed обработает.
    }
  }, []);

  const doScrollToChapter = useCallback(
    (chapterIndex: number) => {
      const idx = chapterStartMap.get(chapterIndex);
      if (idx === undefined) return;
      doScrollToFlatIndex(idx);
    },
    [chapterStartMap, doScrollToFlatIndex],
  );

  useImperativeHandle(ref, () => ({
    scrollToChapter: doScrollToChapter,
    scrollToFlatIndex: doScrollToFlatIndex,
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

  // Используем ref-callback который имеет stable identity, но читает свежие
  // props через ref. onViewableItemsChanged нельзя менять между renders
  // (FlatList ругается).
  const propsRef = useRef(props);
  propsRef.current = props;

  const onViewableItemsChanged = useRef(
    ({
      viewableItems,
    }: {
      viewableItems: { item: FlatItem; index: number | null }[];
    }) => {
      const first = viewableItems[0];
      if (!first) return;
      if (first.item) propsRef.current.onCurrentChapterChange(first.item.chapterIndex);
      if (first.index !== null && first.index !== undefined) {
        propsRef.current.onTopFlatItemChange(first.index);
      }
    },
  ).current;

  return (
    <FlatList
      ref={listRef}
      data={flatItems}
      keyExtractor={keyExtractor}
      renderItem={renderItem}
      initialNumToRender={selectionActive ? 1000 : 30}
      windowSize={selectionActive ? 1000 : 9}
      maxToRenderPerBatch={selectionActive ? 1000 : 40}
      updateCellsBatchingPeriod={50}
      removeClippedSubviews={!selectionActive}
      viewabilityConfig={viewabilityConfig}
      onViewableItemsChanged={onViewableItemsChanged}
      onScrollToIndexFailed={(info) => {
        // Items ещё не measured. Сначала прокрутимся к approximate offset
        // чтобы FlatList отрисовал нужный диапазон, потом retry exact.
        const approxOffset = info.averageItemLength * info.index;
        listRef.current?.scrollToOffset({ offset: approxOffset, animated: false });
        setTimeout(() => {
          if (pendingScrollRef.current !== null) {
            try {
              listRef.current?.scrollToIndex({
                index: pendingScrollRef.current,
                animated: false,
                viewPosition: 0,
              });
            } catch {
              // continue silently
            }
          }
        }, 150);
      }}
      contentContainerStyle={{ padding: 28, paddingBottom: 80 }}
    />
  );
});
