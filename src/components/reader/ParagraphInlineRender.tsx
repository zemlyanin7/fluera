import React from 'react';
import { Text, type TextStyle } from 'react-native';
import { useUnistyles } from 'react-native-unistyles';
import type { InlineNode } from '@/types/content';

interface Props {
  inlines: InlineNode[];
  highlightOffset?: number;
  highlightLength?: number;
  baseStyle?: TextStyle;
}

interface RenderContext {
  highlightStart: number;
  highlightEnd: number;
  globalOffset: { value: number };
  accentColor: string;
  accentSoft: string;
}

function renderNode(
  node: InlineNode,
  key: string,
  ctx: RenderContext,
  inheritedStyle: TextStyle,
): React.ReactNode {
  if (node.type === 'text') {
    const text = node.text;
    const start = ctx.globalOffset.value;
    const end = start + text.length;
    ctx.globalOffset.value = end;

    const hlStart = Math.max(start, ctx.highlightStart);
    const hlEnd = Math.min(end, ctx.highlightEnd);
    if (hlEnd <= hlStart) {
      return <Text key={key} style={inheritedStyle}>{text}</Text>;
    }
    const before = text.slice(0, hlStart - start);
    const hl = text.slice(hlStart - start, hlEnd - start);
    const after = text.slice(hlEnd - start);
    return (
      <Text key={key} style={inheritedStyle}>
        {before}
        <Text
          style={{
            backgroundColor: ctx.accentSoft,
            color: ctx.accentColor,
            fontWeight: '700',
          }}
        >
          {hl}
        </Text>
        {after}
      </Text>
    );
  }
  if (node.type === 'footnote-ref') return null;

  let style: TextStyle = { ...inheritedStyle };
  if (node.type === 'italic') style = { ...style, fontStyle: 'italic' };
  else if (node.type === 'bold') style = { ...style, fontWeight: '700' };
  else if (node.type === 'sup') style = { ...style, fontSize: 12 };
  else if (node.type === 'sub') style = { ...style, fontSize: 12 };

  return (
    <Text key={key} style={style}>
      {node.children.map((c, i) => renderNode(c, `${key}-${i}`, ctx, style))}
    </Text>
  );
}

export function ParagraphInlineRender({
  inlines,
  highlightOffset = -1,
  highlightLength = 0,
  baseStyle,
}: Props) {
  const { theme } = useUnistyles();
  const ctx: RenderContext = {
    highlightStart: highlightOffset,
    highlightEnd: highlightOffset + highlightLength,
    globalOffset: { value: 0 },
    accentColor: theme.accent,
    accentSoft: theme.accentSoft,
  };
  const base: TextStyle = baseStyle ?? { color: theme.ink, fontSize: 15 };
  return (
    <Text style={base}>
      {inlines.map((n, i) => renderNode(n, String(i), ctx, base))}
    </Text>
  );
}
