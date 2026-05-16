import React from 'react';
import { Text } from 'react-native';
import { useUnistyles } from 'react-native-unistyles';
import type { InlineNode } from '@/types/content';
import { flattenInlineText } from '@/services/parser/shared/flattenInline';

interface Props {
  level: 1 | 2 | 3 | 4 | 5 | 6;
  inlines: InlineNode[];
}

const SIZE_MAP = { 1: 28, 2: 24, 3: 20, 4: 18, 5: 17, 6: 16 } as const;

export const HeadingRender = React.memo(function HeadingRender({ level, inlines }: Props) {
  const { theme } = useUnistyles();
  const text = inlines.map(flattenInlineText).join('');
  return (
    <Text
      accessibilityRole="header"
      style={{
        color: theme.ink,
        fontSize: SIZE_MAP[level],
        fontFamily: 'Inter-SemiBold',
        fontWeight: '600',
        marginVertical: 18,
      }}
    >
      {text}
    </Text>
  );
});
