import React, { useCallback } from 'react';
import { Text } from 'tamagui';

interface WordTappableProps {
  word: string;
  sentenceContext: string;
  onWordTap: (word: string, sentence: string) => void;
  color: string; // From WORD_STATUS_COLORS
}

export const WordTappable = React.memo(function WordTappable({
  word,
  sentenceContext,
  onWordTap,
  color,
}: WordTappableProps) {
  const handlePress = useCallback(() => {
    onWordTap(word, sentenceContext);
  }, [word, sentenceContext, onWordTap]);

  return (
    <Text
      onPress={handlePress}
      color={color === 'transparent' ? undefined : color}
      fontSize="$4"
    >
      {word}
    </Text>
  );
});
