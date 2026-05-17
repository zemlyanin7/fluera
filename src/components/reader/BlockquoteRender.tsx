import React from 'react';
import { View } from 'react-native';
import { useUnistyles } from 'react-native-unistyles';
import type { ContentItem, InlineNode } from '@/types/content';
import type { ScriptId } from '@/theme/scripts';
import { ContentItemRenderer } from './ContentItemRenderer';

interface Props {
  items: ContentItem[];
  onWordTap: (word: string, sentence: string, inlines: InlineNode[], charOffset: number) => void;
  fontSize: number;
  script: ScriptId;
  bookId?: string;
}

export const BlockquoteRender = React.memo(function BlockquoteRender(props: Props) {
  const { theme } = useUnistyles();
  return (
    <View
      style={{
        borderLeftWidth: 3,
        borderLeftColor: theme.accentLine,
        paddingLeft: 12,
        marginVertical: 14,
      }}
    >
      {props.items.map((item, i) => (
        <ContentItemRenderer
          key={i}
          item={item}
          onWordTap={props.onWordTap}
          fontSize={props.fontSize}
          script={props.script}
          bookId={props.bookId}
        />
      ))}
    </View>
  );
});
