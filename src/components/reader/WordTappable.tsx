import React, { useCallback } from 'react';
import { Text } from 'tamagui';

interface WordTappableProps {
  word: string;
  sentenceContext: string;
  onWordTap: (word: string, sentence: string) => void;
  color: string; // From WORD_STATUS_COLORS
  textColor?: string; // Reader theme text color for known (transparent) words
}

export const WordTappable = React.memo(function WordTappable({
  word,
  sentenceContext,
  onWordTap,
  color,
  textColor,
}: WordTappableProps) {
  const handlePress = useCallback(() => {
    onWordTap(word, sentenceContext);
  }, [word, sentenceContext, onWordTap]);

  // If color is 'transparent' (known word), use the reader theme text color
  const resolvedColor = color === 'transparent' ? textColor : color;

  return (
    <Text
      onPress={handlePress}
      color={resolvedColor || undefined}
      fontSize="$4"
    >
      {word}
    </Text>
  );
});
