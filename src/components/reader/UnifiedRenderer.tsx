import React from 'react';
import { Image } from 'react-native';
import { Text, YStack, XStack } from 'tamagui';
import { WordTappable } from './WordTappable';
import { tokenizeIntoWords, extractSentence } from './Fb2Renderer';
import { WORD_STATUS_COLORS } from '../../utils/constants';
import type { ContentItem, InlineNode, BookFootnotes } from '../../services/parser/types';
import type { WordStatusValue } from '../../utils/types';

// ─── Constants ─────────────────────────────────────────────────────────────────

const MAX_INLINE_DEPTH = 20;

// ─── Inline context ────────────────────────────────────────────────────────────

interface InlineContext {
  bold?: 'bold';
  italic?: 'italic';
  textColor: string;
  fontSize: number;
  fontFamily?: string;
}

// ─── Props ─────────────────────────────────────────────────────────────────────

export interface UnifiedRendererProps {
  item: ContentItem;
  onWordTap: (word: string, sentence: string) => void;
  wordColors: Map<string, WordStatusValue>;
  fontSize?: number;
  lineHeight?: number;
  fontFamily?: string;
  textColor?: string;
  backgroundColor?: string;
  footnotes?: BookFootnotes;
  onFootnotePress?: (id: string) => void;
}

// ─── Utilities ─────────────────────────────────────────────────────────────────

function getWordColor(word: string, wordColors: Map<string, WordStatusValue>): string {
  const cleanWord = word.replace(/[^a-zA-Z\u00C0-\u00FF\u0400-\u04FF]/g, '').toLowerCase();
  const status = wordColors.get(cleanWord);
  if (status !== undefined) {
    return WORD_STATUS_COLORS[status];
  }
  // Default: treat as new word (status 1)
  return WORD_STATUS_COLORS[1];
}

/**
 * Recursively extracts plain text from an array of InlineNodes.
 */
export function extractInlineText(nodes: InlineNode[]): string {
  return nodes
    .map((node) => {
      if (node.type === 'text') return node.text;
      if (node.type === 'footnote-ref') return node.label;
      if ('children' in node) return extractInlineText(node.children);
      return '';
    })
    .join('');
}

/**
 * Extracts full plain text from a ContentItem for sentence context.
 */
export function extractItemText(item: ContentItem): string {
  switch (item.type) {
    case 'heading':
      return extractInlineText(item.inlines);
    case 'paragraph':
      return extractInlineText(item.inlines);
    case 'blockquote': {
      const inlineText = extractInlineText(item.inlines);
      const nestedText = (item.nestedItems ?? []).map(extractItemText).join(' ');
      return [inlineText, nestedText].filter(Boolean).join(' ');
    }
    case 'list':
      return item.items.map((inlines) => extractInlineText(inlines)).join(' ');
    case 'table-row':
      return item.cells.map((inlines) => extractInlineText(inlines)).join(' ');
    case 'image':
      return item.alt ?? '';
    case 'separator':
      return '';
  }
}

// ─── Inline renderer ───────────────────────────────────────────────────────────

function renderInlines(
  nodes: InlineNode[],
  ctx: InlineContext,
  fullText: string,
  onWordTap: (word: string, sentence: string) => void,
  wordColors: Map<string, WordStatusValue>,
  onFootnotePress?: (id: string) => void,
  depth: number = 0,
): React.ReactNode[] {
  if (depth > MAX_INLINE_DEPTH) return [];

  const elements: React.ReactNode[] = [];

  nodes.forEach((node, nodeIndex) => {
    const key = `${depth}-${nodeIndex}`;

    if (node.type === 'text') {
      const tokens = tokenizeIntoWords(node.text);
      tokens.forEach((token, tokenIndex) => {
        const color = getWordColor(token.word, wordColors);
        const sentence = extractSentence(fullText, token.word);
        elements.push(
          <Text
            key={`${key}-${tokenIndex}-wrapper`}
            fontWeight={ctx.bold}
            fontStyle={ctx.italic}
            fontSize={ctx.fontSize}
            fontFamily={ctx.fontFamily as any}
          >
            <WordTappable
              key={`${key}-${tokenIndex}`}
              word={token.word}
              sentenceContext={sentence}
              onWordTap={onWordTap}
              color={color}
              textColor={ctx.textColor}
            />
          </Text>,
        );
        if (token.trailing) {
          elements.push(
            <Text
              key={`${key}-${tokenIndex}-space`}
              fontSize={ctx.fontSize}
              fontWeight={ctx.bold}
              fontStyle={ctx.italic}
              color={ctx.textColor || undefined}
            >
              {token.trailing}
            </Text>,
          );
        }
      });
    } else if (node.type === 'bold') {
      const childCtx: InlineContext = { ...ctx, bold: 'bold' };
      const childElements = renderInlines(
        node.children,
        childCtx,
        fullText,
        onWordTap,
        wordColors,
        onFootnotePress,
        depth + 1,
      );
      elements.push(...childElements);
    } else if (node.type === 'italic') {
      const childCtx: InlineContext = { ...ctx, italic: 'italic' };
      const childElements = renderInlines(
        node.children,
        childCtx,
        fullText,
        onWordTap,
        wordColors,
        onFootnotePress,
        depth + 1,
      );
      elements.push(...childElements);
    } else if (node.type === 'link') {
      // External links rendered as underlined text
      const childElements = renderInlines(
        node.children,
        ctx,
        fullText,
        onWordTap,
        wordColors,
        onFootnotePress,
        depth + 1,
      );
      elements.push(
        <Text key={key} textDecorationLine="underline" fontSize={ctx.fontSize} color={ctx.textColor || undefined}>
          {childElements}
        </Text>,
      );
    } else if (node.type === 'sup') {
      const supCtx: InlineContext = { ...ctx, fontSize: ctx.fontSize * 0.7 };
      const childElements = renderInlines(
        node.children,
        supCtx,
        fullText,
        onWordTap,
        wordColors,
        onFootnotePress,
        depth + 1,
      );
      elements.push(
        <Text key={key} fontSize={ctx.fontSize * 0.7} color={ctx.textColor || undefined}>
          {childElements}
        </Text>,
      );
    } else if (node.type === 'sub') {
      const subCtx: InlineContext = { ...ctx, fontSize: ctx.fontSize * 0.7 };
      const childElements = renderInlines(
        node.children,
        subCtx,
        fullText,
        onWordTap,
        wordColors,
        onFootnotePress,
        depth + 1,
      );
      elements.push(
        <Text key={key} fontSize={ctx.fontSize * 0.7} color={ctx.textColor || undefined}>
          {childElements}
        </Text>,
      );
    } else if (node.type === 'footnote-ref') {
      elements.push(
        <Text
          key={key}
          fontSize={ctx.fontSize * 0.7}
          color="#6c63ff"
          onPress={() => onFootnotePress?.(node.id)}
        >
          {node.label}
        </Text>,
      );
    }
  });

  return elements;
}

// ─── Block item renderer ───────────────────────────────────────────────────────

/**
 * Renders a single ContentItem into native React Native / Tamagui components.
 */
export function UnifiedRenderer({
  item,
  onWordTap,
  wordColors,
  fontSize = 16,
  lineHeight = 24,
  fontFamily,
  textColor,
  footnotes: _footnotes,
  onFootnotePress,
}: UnifiedRendererProps): React.ReactElement {
  const baseCtx: InlineContext = {
    textColor: textColor ?? '#000000',
    fontSize,
    fontFamily,
  };

  // ── separator ──────────────────────────────────────────────────────────────
  if (item.type === 'separator') {
    return <YStack height="$2" />;
  }

  // ── heading ───────────────────────────────────────────────────────────────
  if (item.type === 'heading') {
    const addSize = item.level === 1 ? 8 : item.level === 2 ? 4 : item.level === 3 ? 2 : 0;
    const headingFontSize = fontSize + addSize;
    const fullText = extractInlineText(item.inlines);

    const headingCtx: InlineContext = { ...baseCtx, bold: 'bold', fontSize: headingFontSize };
    const elements = renderInlines(
      item.inlines,
      headingCtx,
      fullText,
      onWordTap,
      wordColors,
      onFootnotePress,
    );

    return (
      <YStack paddingVertical="$3" paddingHorizontal="$4">
        <XStack flexWrap="wrap" alignItems="baseline">
          {elements}
        </XStack>
      </YStack>
    );
  }

  // ── paragraph ─────────────────────────────────────────────────────────────
  if (item.type === 'paragraph') {
    const fullText = extractInlineText(item.inlines);
    const style = item.style;

    const paragraphCtx: InlineContext = {
      ...baseCtx,
      italic: style?.italic ? 'italic' : undefined,
    };

    const elements = renderInlines(
      item.inlines,
      paragraphCtx,
      fullText,
      onWordTap,
      wordColors,
      onFootnotePress,
    );

    const textAlign = style?.textAlign;
    const paddingLeft = style?.indent ? '$8' : '$4';

    return (
      <YStack paddingHorizontal="$4" paddingVertical="$1" paddingLeft={paddingLeft}>
        <XStack flexWrap="wrap" alignItems="baseline" justifyContent={textAlign === 'center' ? 'center' : textAlign === 'right' ? 'flex-end' : 'flex-start'}>
          {elements}
        </XStack>
      </YStack>
    );
  }

  // ── image ─────────────────────────────────────────────────────────────────
  if (item.type === 'image') {
    const aspectRatio =
      item.width && item.height ? item.width / item.height : undefined;

    return (
      <YStack paddingVertical="$2" paddingHorizontal="$4">
        <Image
          source={{ uri: item.src }}
          resizeMode="contain"
          style={[
            { width: '100%' },
            aspectRatio !== undefined ? { aspectRatio } : undefined,
          ].filter(Boolean) as any}
          accessibilityLabel={item.alt}
        />
      </YStack>
    );
  }

  // ── blockquote ────────────────────────────────────────────────────────────
  if (item.type === 'blockquote') {
    const fullText = extractItemText(item);

    const inlineElements =
      item.inlines.length > 0
        ? renderInlines(
            item.inlines,
            baseCtx,
            fullText,
            onWordTap,
            wordColors,
            onFootnotePress,
          )
        : null;

    const nestedElements =
      item.nestedItems && item.nestedItems.length > 0
        ? item.nestedItems.map((nestedItem, index) => (
            <UnifiedRenderer
              key={index}
              item={nestedItem}
              onWordTap={onWordTap}
              wordColors={wordColors}
              fontSize={fontSize}
              lineHeight={lineHeight}
              fontFamily={fontFamily}
              textColor={textColor}
              onFootnotePress={onFootnotePress}
            />
          ))
        : null;

    return (
      <YStack
        borderLeftWidth={3}
        borderLeftColor="#aaaaaa"
        paddingLeft="$4"
        paddingRight="$4"
        paddingVertical="$2"
        marginHorizontal="$4"
        marginVertical="$1"
      >
        {inlineElements && (
          <XStack flexWrap="wrap" alignItems="baseline">
            {inlineElements}
          </XStack>
        )}
        {nestedElements}
      </YStack>
    );
  }

  // ── list ──────────────────────────────────────────────────────────────────
  if (item.type === 'list') {
    const fullText = item.items
      .map((inlines) => extractInlineText(inlines))
      .join(' ');

    return (
      <YStack paddingHorizontal="$4" paddingVertical="$1">
        {item.items.map((inlines, index) => {
          const marker = item.ordered ? `${index + 1}. ` : '• ';
          const elements = renderInlines(
            inlines,
            baseCtx,
            fullText,
            onWordTap,
            wordColors,
            onFootnotePress,
          );
          return (
            <XStack key={index} flexWrap="wrap" alignItems="baseline" marginVertical="$0.5">
              <Text fontSize={fontSize} color={textColor || undefined}>
                {marker}
              </Text>
              {elements}
            </XStack>
          );
        })}
      </YStack>
    );
  }

  // ── table-row ─────────────────────────────────────────────────────────────
  if (item.type === 'table-row') {
    const fullText = item.cells
      .map((inlines) => extractInlineText(inlines))
      .join(' ');

    return (
      <XStack paddingHorizontal="$4" paddingVertical="$1" flexWrap="wrap" alignItems="baseline">
        {item.cells.map((inlines, index) => {
          const elements = renderInlines(
            inlines,
            baseCtx,
            fullText,
            onWordTap,
            wordColors,
            onFootnotePress,
          );
          return (
            <React.Fragment key={index}>
              {index > 0 && (
                <Text fontSize={fontSize} color={textColor || undefined}>
                  {' | '}
                </Text>
              )}
              {elements}
            </React.Fragment>
          );
        })}
      </XStack>
    );
  }

  // Fallback — should never happen if ContentItem union is exhaustive
  return <YStack />;
}
