import React from 'react';
import { View, Text } from 'react-native';
import { useUnistyles } from 'react-native-unistyles';
import type { ContentItem } from '@/types/content';
import type { ScriptId } from '@/theme/scripts';
import { ContentItemRenderer } from './ContentItemRenderer';

interface Props {
  ordered: boolean;
  items: ContentItem[][];
  onWordTap: (word: string, sentence: string) => void;
  fontSize: number;
  script: ScriptId;
  bookId?: string;
}

export const ListRender = React.memo(function ListRender(props: Props) {
  const { theme } = useUnistyles();
  return (
    <View style={{ marginVertical: 10 }}>
      {props.items.map((sub, i) => (
        <View key={i} style={{ flexDirection: 'row', marginBottom: 6 }}>
          <Text
            style={{ color: theme.ink2, fontSize: props.fontSize, marginRight: 8, minWidth: 24 }}
          >
            {props.ordered ? `${i + 1}.` : '•'}
          </Text>
          <View style={{ flex: 1 }}>
            {sub.map((item, j) => (
              <ContentItemRenderer
                key={j}
                item={item}
                onWordTap={props.onWordTap}
                fontSize={props.fontSize}
                script={props.script}
                bookId={props.bookId}
              />
            ))}
          </View>
        </View>
      ))}
    </View>
  );
});
