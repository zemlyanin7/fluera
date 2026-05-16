import React, { useCallback } from 'react';
import { FlatList } from 'react-native';
import type { BookChapter, ContentItem } from '@/types/content';
import type { ScriptId } from '@/theme/scripts';
import { ContentItemRenderer } from './ContentItemRenderer';

interface Props {
  chapter: BookChapter;
  onWordTap: (word: string, sentence: string) => void;
  onScroll: (offsetY: number) => void;
  fontSize: number;
  script: ScriptId;
  bookId: string;
}

export const ChapterRenderer = React.memo(function ChapterRenderer(props: Props) {
  const keyExtractor = useCallback(
    (_item: ContentItem, idx: number) => `${props.chapter.index}-${idx}`,
    [props.chapter.index],
  );
  const renderItem = useCallback(
    ({ item }: { item: ContentItem }) => (
      <ContentItemRenderer
        item={item}
        onWordTap={props.onWordTap}
        fontSize={props.fontSize}
        script={props.script}
        bookId={props.bookId}
      />
    ),
    [props.onWordTap, props.fontSize, props.script, props.bookId],
  );
  return (
    <FlatList
      data={props.chapter.items}
      keyExtractor={keyExtractor}
      renderItem={renderItem}
      initialNumToRender={20}
      windowSize={5}
      maxToRenderPerBatch={10}
      removeClippedSubviews
      onScroll={(e) => props.onScroll(e.nativeEvent.contentOffset.y)}
      scrollEventThrottle={250}
      contentContainerStyle={{ padding: 28, paddingBottom: 80 }}
    />
  );
});
