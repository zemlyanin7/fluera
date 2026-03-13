import React from 'react';
import { Text, YStack, XStack } from 'tamagui';
import { WordTappable } from './WordTappable';
import { WORD_STATUS_COLORS } from '../../utils/constants';
import type { Fb2Paragraph, Fb2Inline } from '../../services/parser/types';
import type { WordStatusValue } from '../../utils/types';

// ─── Token type ────────────────────────────────────────────────────────────────

interface WordToken {
  word: string;
  trailing: string;
}

// ─── Exported utilities ────────────────────────────────────────────────────────

/**
 * Splits text into word tokens preserving trailing whitespace information.
 * Each token has the word itself and the whitespace that follows it.
 */
export function tokenizeIntoWords(text: string): WordToken[] {
  if (!text) return [];

  // Split on whitespace boundaries, capturing the separators
  const parts = text.split(/(\s+)/);
  const tokens: WordToken[] = [];

  for (let i = 0; i < parts.length; i++) {
    const part = parts[i];
    if (!part) continue;

    // Odd parts from capturing group split are whitespace separators
    const isWhitespace = /^\s+$/.test(part);
    if (isWhitespace) continue;

    const nextPart = parts[i + 1];
    const trailing = nextPart && /^\s+$/.test(nextPart) ? nextPart : '';

    tokens.push({ word: part, trailing });
  }

  return tokens;
}

/**
 * Finds and returns the sentence containing the given word.
 * Sentence boundaries are `.`, `!`, `?`, or newlines.
 * Returns the full text if no boundary is found.
 */
export function extractSentence(fullText: string, word: string): string {
  const wordIndex = fullText.indexOf(word);
  if (wordIndex === -1) return fullText;

  // Split into sentences on boundary characters
  const sentencePattern = /[^.!?\n]+[.!?\n]*/g;
  let match: RegExpExecArray | null;

  while ((match = sentencePattern.exec(fullText)) !== null) {
    const start = match.index;
    const end = start + match[0].length;
    if (wordIndex >= start && wordIndex < end) {
      return match[0].trim();
    }
  }

  return fullText;
}

// ─── Renderer props ────────────────────────────────────────────────────────────

export interface Fb2RendererItem {
  item: string | Fb2Paragraph;
  onWordTap: (word: string, sentence: string) => void;
  wordColors: Map<string, WordStatusValue>;
  fontSize?: number;
  lineHeight?: number;
  fontFamily?: string;
}

// ─── Inline renderer helper ────────────────────────────────────────────────────

interface InlineRendererProps {
  inlines: Fb2Inline[];
  fullText: string;
  onWordTap: (word: string, sentence: string) => void;
  wordColors: Map<string, WordStatusValue>;
  fontSize?: number;
  fontFamily?: string;
  italic?: boolean;
  bold?: boolean;
}

function getWordColor(word: string, wordColors: Map<string, WordStatusValue>): string {
  const cleanWord = word.replace(/[^a-zA-Z\u00C0-\u00FF\u0400-\u04FF]/g, '').toLowerCase();
  const status = wordColors.get(cleanWord);
  if (status !== undefined) {
    return WORD_STATUS_COLORS[status];
  }
  // Default: treat as new word (status 1)
  return WORD_STATUS_COLORS[1];
}

function InlineRenderer({
  inlines,
  fullText,
  onWordTap,
  wordColors,
  fontSize,
  fontFamily,
  italic = false,
  bold = false,
}: InlineRendererProps): React.ReactElement {
  const elements: React.ReactNode[] = [];

  inlines.forEach((inline, inlineIndex) => {
    if (inline.type === 'text' && inline.text) {
      const tokens = tokenizeIntoWords(inline.text);
      tokens.forEach((token, tokenIndex) => {
        const color = getWordColor(token.word, wordColors);
        const sentence = extractSentence(fullText, token.word);
        elements.push(
          <WordTappable
            key={`${inlineIndex}-${tokenIndex}`}
            word={token.word}
            sentenceContext={sentence}
            onWordTap={onWordTap}
            color={color}
          />,
        );
        if (token.trailing) {
          elements.push(
            <Text key={`${inlineIndex}-${tokenIndex}-space`} fontSize={fontSize}>
              {token.trailing}
            </Text>,
          );
        }
      });
    } else if ((inline.type === 'emphasis' || inline.type === 'strong') && inline.children) {
      const isItalic = inline.type === 'emphasis';
      const isBold = inline.type === 'strong';
      inline.children.forEach((child, childIndex) => {
        if (child.type === 'text' && child.text) {
          const tokens = tokenizeIntoWords(child.text);
          tokens.forEach((token, tokenIndex) => {
            const color = getWordColor(token.word, wordColors);
            const sentence = extractSentence(fullText, token.word);
            elements.push(
              <Text
                key={`${inlineIndex}-${childIndex}-${tokenIndex}-wrapper`}
                fontStyle={isItalic ? 'italic' : italic ? 'italic' : undefined}
                fontWeight={isBold ? 'bold' : bold ? 'bold' : undefined}
                fontSize={fontSize}
                fontFamily={fontFamily}
              >
                <WordTappable
                  word={token.word}
                  sentenceContext={sentence}
                  onWordTap={onWordTap}
                  color={color}
                />
              </Text>,
            );
            if (token.trailing) {
              elements.push(
                <Text key={`${inlineIndex}-${childIndex}-${tokenIndex}-space`} fontSize={fontSize}>
                  {token.trailing}
                </Text>,
              );
            }
          });
        }
      });
    }
    // 'link' and 'image' types are not rendered as tappable words
  });

  return <>{elements}</>;
}

// ─── Fb2ItemRenderer ───────────────────────────────────────────────────────────

/**
 * Renders a single flat-list item from a flattened FB2 document.
 * String items are section titles; Fb2Paragraph items are paragraphs.
 */
export function Fb2ItemRenderer({
  item,
  onWordTap,
  wordColors,
  fontSize = 16,
  lineHeight = 24,
  fontFamily,
}: Fb2RendererItem): React.ReactElement {
  // Section title (string item)
  if (typeof item === 'string') {
    return (
      <Text
        fontWeight="bold"
        fontSize={fontSize + 4}
        lineHeight={lineHeight + 6}
        fontFamily={fontFamily}
        paddingVertical="$3"
        paddingHorizontal="$4"
      >
        {item}
      </Text>
    );
  }

  const paragraph = item as Fb2Paragraph;

  // Empty line spacer
  if (paragraph.type === 'empty-line') {
    return <YStack height="$2" />;
  }

  // Collect full text for sentence extraction
  const fullText = paragraph.children
    .map((inline) => {
      if (inline.text) return inline.text;
      if (inline.children) return inline.children.map((c) => c.text ?? '').join('');
      return '';
    })
    .join(' ');

  // Subtitle
  if (paragraph.type === 'subtitle') {
    return (
      <Text
        fontWeight="600"
        fontSize={fontSize + 2}
        lineHeight={lineHeight + 4}
        fontFamily={fontFamily}
        paddingVertical="$2"
        paddingHorizontal="$4"
      >
        {fullText}
      </Text>
    );
  }

  // Epigraph — indented, italic
  if (paragraph.type === 'epigraph') {
    return (
      <YStack paddingLeft="$8" paddingRight="$4" paddingVertical="$2">
        <XStack flexWrap="wrap" alignItems="baseline">
          <InlineRenderer
            inlines={paragraph.children}
            fullText={fullText}
            onWordTap={onWordTap}
            wordColors={wordColors}
            fontSize={fontSize}
            fontFamily={fontFamily}
            italic
          />
        </XStack>
      </YStack>
    );
  }

  // Poem / stanza / verse line
  if (
    paragraph.type === 'poem' ||
    paragraph.type === 'stanza' ||
    paragraph.type === 'v'
  ) {
    return (
      <YStack paddingLeft="$6" paddingRight="$4" paddingVertical="$1">
        <XStack flexWrap="wrap" alignItems="baseline">
          <InlineRenderer
            inlines={paragraph.children}
            fullText={fullText}
            onWordTap={onWordTap}
            wordColors={wordColors}
            fontSize={fontSize}
            fontFamily={fontFamily}
            italic
          />
        </XStack>
      </YStack>
    );
  }

  // Regular paragraph (type === 'p', 'title', 'cite', 'annotation', or unrecognised)
  return (
    <YStack paddingHorizontal="$4" paddingVertical="$1">
      <XStack flexWrap="wrap" alignItems="baseline">
        <InlineRenderer
          inlines={paragraph.children}
          fullText={fullText}
          onWordTap={onWordTap}
          wordColors={wordColors}
          fontSize={fontSize}
          fontFamily={fontFamily}
        />
      </XStack>
    </YStack>
  );
}
