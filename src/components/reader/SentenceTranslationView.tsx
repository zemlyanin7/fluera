import React from 'react';
import { View, Text } from 'react-native';
import { useUnistyles } from 'react-native-unistyles';

interface Props {
  sourceSentence: string;
  translatedSentence: string;
  sourceWordOffset: number;
  sourceWord: string;
  translatedWordOffset: number | undefined;
}

export function SentenceTranslationView({
  sourceSentence,
  translatedSentence,
  sourceWordOffset,
  sourceWord,
  translatedWordOffset,
}: Props) {
  const { theme } = useUnistyles();

  const sourceSegments = splitWithHighlight(sourceSentence, sourceWordOffset, sourceWord.length);

  // Highlight target word at offset if provided; otherwise render plain.
  const targetSegments =
    translatedWordOffset !== undefined
      ? splitTargetWithHighlight(translatedSentence, translatedWordOffset)
      : null;

  return (
    <View>
      <Text style={{ color: theme.ink2, fontSize: 12 }}>Source:</Text>
      {/* Source sentence with highlighted word */}
      <Text style={{ color: theme.ink, fontSize: 15, marginBottom: 8 }}>
        <Text>{sourceSegments.before}</Text>
        <Text
          style={{
            fontWeight: '700',
            textDecorationLine: 'underline',
            color: theme.accent,
          }}
        >
          {sourceSegments.match}
        </Text>
        <Text>{sourceSegments.after}</Text>
      </Text>

      <Text style={{ color: theme.ink2, fontSize: 12 }}>Translation:</Text>
      {/* Translation with optional aligned-word highlight */}
      {targetSegments != null ? (
        <Text
          style={{ color: theme.ink, fontSize: 15 }}
          accessibilityLabel={`aligned: ${targetSegments.match}`}
        >
          <Text>{targetSegments.before}</Text>
          <Text
            style={{
              fontWeight: '700',
              textDecorationLine: 'underline',
              color: theme.accent,
            }}
          >
            {targetSegments.match}
          </Text>
          <Text>{targetSegments.after}</Text>
        </Text>
      ) : (
        <Text style={{ color: theme.ink, fontSize: 15 }}>{translatedSentence}</Text>
      )}
    </View>
  );
}

// Split text into before/match/after at a character offset and length.
function splitWithHighlight(text: string, offset: number, length: number) {
  const safeOffset = Math.min(offset, text.length);
  const safeEnd = Math.min(safeOffset + length, text.length);
  return {
    before: text.slice(0, safeOffset),
    match: text.slice(safeOffset, safeEnd),
    after: text.slice(safeEnd),
  };
}

// Split translated text at offset; highlight to next whitespace/punctuation.
function splitTargetWithHighlight(text: string, offset: number) {
  const safeOffset = Math.min(offset, text.length);
  const after = text.slice(safeOffset);
  const wordEnd = after.search(/[\s.,;:!?]/);
  const matchEnd = wordEnd === -1 ? text.length : safeOffset + wordEnd;
  return {
    before: text.slice(0, safeOffset),
    match: text.slice(safeOffset, matchEnd),
    after: text.slice(matchEnd),
  };
}
