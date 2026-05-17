import React from 'react';
import { Text } from 'react-native';
import { useUnistyles } from 'react-native-unistyles';
import type { InlineNode, ParagraphStyle } from '@/types/content';
import { splitWords } from '@/utils/splitWords';
import { scriptTypography } from '@/theme/tokens';
import type { ScriptId } from '@/theme/scripts';

interface Props {
  inlines: InlineNode[];
  style?: ParagraphStyle;
  onWordTap: (word: string, sentence: string) => void;
  fontSize: number;
  script: ScriptId;
  buildSentence?: (word: string, fullText: string) => string;
}

const SCRIPT_FONT: Record<ScriptId, string> = {
  latin: 'SourceSerif4-Regular',
  cyrillic: 'Lora-Regular',
  cjk_jp: 'ShipporiMinchoB1-Regular',
  cjk_kr: 'NotoSerifKR-Regular',
  arabic: 'Amiri-Regular',
  devanagari: 'TiroDevanagariHindi-Regular',
};

interface RenderCtx {
  fullText: string;
  onWordTap: (word: string, sentence: string) => void;
  buildSentence: NonNullable<Props['buildSentence']>;
  accent: string;
}

function renderInline(node: InlineNode, keyPrefix: string, ctx: RenderCtx): React.ReactNode {
  if (node.type === 'text') {
    const tokens = splitWords(node.text);
    return tokens.map((tok, ti) => {
      if (tok.kind !== 'word') return <Text key={`${keyPrefix}-${ti}`}>{tok.text}</Text>;
      return (
        <Text
          key={`${keyPrefix}-${ti}`}
          onPress={() => ctx.onWordTap(tok.text, ctx.buildSentence(tok.text, ctx.fullText))}
        >
          {tok.text}
        </Text>
      );
    });
  }
  if (node.type === 'footnote-ref') {
    return (
      <Text key={keyPrefix} style={{ color: ctx.accent }}>
        [{node.label}]
      </Text>
    );
  }
  const children = node.children.map((c, i) => renderInline(c, `${keyPrefix}-${i}`, ctx));
  if (node.type === 'bold')
    return (
      <Text key={keyPrefix} style={{ fontWeight: 'bold' }}>
        {children}
      </Text>
    );
  if (node.type === 'italic')
    return (
      <Text key={keyPrefix} style={{ fontStyle: 'italic' }}>
        {children}
      </Text>
    );
  if (node.type === 'link')
    return (
      <Text key={keyPrefix} style={{ color: ctx.accent }}>
        {children}
      </Text>
    );
  if (node.type === 'sup' || node.type === 'sub')
    return (
      <Text key={keyPrefix} style={{ fontSize: 12 }}>
        {children}
      </Text>
    );
  return <Text key={keyPrefix}>{children}</Text>;
}

function flattenText(inlines: InlineNode[]): string {
  return inlines
    .map((n) => {
      if (n.type === 'text') return n.text;
      if (n.type === 'footnote-ref') return '';
      return flattenText(n.children);
    })
    .join('');
}

export const ParagraphRender = React.memo(function ParagraphRender({
  inlines,
  style,
  onWordTap,
  fontSize,
  script,
  buildSentence,
}: Props) {
  const { theme } = useUnistyles();
  const leading = scriptTypography[script].readingLeading;
  const fullText = flattenText(inlines);
  const sentenceFn = buildSentence ?? ((_w: string, t: string) => t);
  return (
    <Text
      style={{
        color: theme.ink,
        fontSize,
        lineHeight: fontSize * leading,
        fontFamily: SCRIPT_FONT[script],
        textAlign: style?.textAlign,
        fontStyle: style?.italic ? 'italic' : 'normal',
        marginBottom: 14,
      }}
    >
      {inlines.map((n, i) =>
        renderInline(n, `i-${i}`, {
          fullText,
          onWordTap,
          buildSentence: sentenceFn,
          accent: theme.accent,
        }),
      )}
    </Text>
  );
});
