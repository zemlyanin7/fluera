import React from 'react';
import { View, Text } from 'react-native';
import { useUnistyles } from 'react-native-unistyles';
import { useTranslation } from 'react-i18next';
import type { InlineNode } from '@/types/content';
import { ParagraphInlineRender } from './ParagraphInlineRender';

interface Props {
  sourceInlines: InlineNode[];
  sourcePlainText: string;
  translatedSentence: string;
  sourceWordOffset: number;
  sourceWordLength: number;
  translatedWordOffset: number | undefined;
  wasCapped?: boolean;
}

export function SentenceTranslationView({
  sourceInlines,
  sourcePlainText: _sourcePlainText,
  translatedSentence,
  sourceWordOffset,
  sourceWordLength,
  translatedWordOffset,
  wasCapped = false,
}: Props) {
  const { theme } = useUnistyles();
  const { t } = useTranslation();

  const targetHighlight =
    translatedWordOffset !== undefined
      ? computeTargetHighlight(translatedSentence, translatedWordOffset)
      : null;

  return (
    <View style={{ gap: 14 }}>
      {/* Source card */}
      <View style={{ backgroundColor: theme.paper2, padding: 14, borderRadius: 12 }}>
        <Text style={{ color: theme.ink3, fontSize: 11, marginBottom: 6, letterSpacing: 0.5 }}>
          {t('translation.sourceLabel', { defaultValue: 'ОРИГИНАЛ' })}
        </Text>
        {wasCapped && (
          <Text style={{ color: theme.ink3, fontSize: 14, opacity: 0.6 }}>…</Text>
        )}
        <ParagraphInlineRender
          inlines={sourceInlines}
          highlightOffset={sourceWordOffset}
          highlightLength={sourceWordLength}
          baseStyle={{ color: theme.ink, fontSize: 16, lineHeight: 23 }}
        />
        {wasCapped && (
          <Text style={{ color: theme.ink3, fontSize: 14, opacity: 0.6, textAlign: 'right' }}>…</Text>
        )}
      </View>

      {/* Translation card — paper2 + accentLine border-top */}
      <View
        style={{
          backgroundColor: theme.paper2,
          padding: 14,
          borderRadius: 12,
          borderTopWidth: 3,
          borderTopColor: theme.accentLine,
        }}
      >
        <Text style={{ color: theme.ink3, fontSize: 11, marginBottom: 6, letterSpacing: 0.5 }}>
          {t('translation.translationLabel', { defaultValue: 'ПЕРЕВОД' })}
        </Text>
        {targetHighlight ? (
          <Text
            style={{ color: theme.ink, fontSize: 17, lineHeight: 24, fontWeight: '500' }}
            accessibilityLabel={`aligned: ${targetHighlight.match}`}
          >
            <Text>{targetHighlight.before}</Text>
            <Text
              style={{
                backgroundColor: theme.accentSoft,
                color: theme.accent,
                fontWeight: '800',
              }}
            >
              {targetHighlight.match}
            </Text>
            <Text>{targetHighlight.after}</Text>
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

function computeTargetHighlight(text: string, offset: number) {
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
