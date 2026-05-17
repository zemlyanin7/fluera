import React from 'react';
import { View, Text } from 'react-native';
import { useUnistyles } from 'react-native-unistyles';
import type { InlineNode } from '@/types/content';
import type { ScriptId } from '@/theme/scripts';
import { ParagraphRender } from './ParagraphRender';

interface Props {
  cells: InlineNode[][];
  onWordTap: (word: string, sentence: string, inlines: InlineNode[], charOffset: number) => void;
  fontSize: number;
  script: ScriptId;
}

export const TableRowRender = React.memo(function TableRowRender(props: Props) {
  const { theme } = useUnistyles();
  return (
    <View style={{ flexDirection: 'row', marginVertical: 6, alignItems: 'flex-start' }}>
      {props.cells.map((cell, i) => (
        <React.Fragment key={i}>
          {i > 0 && <Text style={{ color: theme.ink3, marginHorizontal: 6 }}>|</Text>}
          <View style={{ flex: 1 }}>
            <ParagraphRender
              inlines={cell}
              onWordTap={props.onWordTap}
              fontSize={props.fontSize}
              script={props.script}
            />
          </View>
        </React.Fragment>
      ))}
    </View>
  );
});
