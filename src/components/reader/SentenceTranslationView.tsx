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
    <View style={{ gap: 14 }}>
      {/* Source sentence card */}
      <View
        style={{
          backgroundColor: theme.paper2,
          padding: 14,
          borderRadius: 12,
        }}
      >
        <Text style={{ color: theme.ink3, fontSize: 11, marginBottom: 6, letterSpacing: 0.5 }}>
          ОРИГИНАЛ
        </Text>
        <Text style={{ color: theme.ink2, fontSize: 16, lineHeight: 23 }}>
          <Text>{sourceSegments.before}</Text>
          <Text
            style={{
              fontWeight: '700',
              color: theme.accent,
              backgroundColor: theme.accentSoft,
            }}
          >
            {sourceSegments.match}
          </Text>
          <Text>{sourceSegments.after}</Text>
        </Text>
      </View>

      {/* Translation card — visual emphasis */}
      <View
        style={{
          backgroundColor: theme.accentSoft,
          padding: 14,
          borderRadius: 12,
        }}
      >
        <Text style={{ color: theme.ink3, fontSize: 11, marginBottom: 6, letterSpacing: 0.5 }}>
          ПЕРЕВОД
        </Text>
        {targetSegments != null ? (
          <Text
            style={{ color: theme.ink, fontSize: 17, lineHeight: 24, fontWeight: '500' }}
            accessibilityLabel={`aligned: ${targetSegments.match}`}
          >
            <Text>{targetSegments.before}</Text>
            <Text
              style={{
                fontWeight: '800',
                color: theme.accent,
              }}
            >
              {targetSegments.match}
            </Text>
            <Text>{targetSegments.after}</Text>
          </Text>
        ) : (
          <Text style={{ color: theme.ink, fontSize: 17, lineHeight: 24, fontWeight: '500' }}>
            {translatedSentence}
          </Text>
        )}
      </View>
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
