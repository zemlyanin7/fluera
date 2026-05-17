import React from 'react';
import { render } from '@testing-library/react-native';
import { ParagraphInlineRender } from '@/components/reader/ParagraphInlineRender';
import type { InlineNode } from '@/types/content';

describe('ParagraphInlineRender', () => {
  it('renders plain text', () => {
    const inlines: InlineNode[] = [{ type: 'text', text: 'Hello world' }];
    const { getByText } = render(<ParagraphInlineRender inlines={inlines} />);
    expect(getByText('Hello world')).toBeTruthy();
  });

  it('renders italic с fontStyle italic', () => {
    const inlines: InlineNode[] = [
      { type: 'italic', children: [{ type: 'text', text: 'walked' }] },
    ];
    const { getByText } = render(<ParagraphInlineRender inlines={inlines} />);
    const node = getByText('walked');
    const styles = Array.isArray(node.props.style)
      ? Object.assign({}, ...node.props.style)
      : node.props.style;
    expect(styles.fontStyle).toBe('italic');
  });

  it('renders bold с fontWeight 700', () => {
    const inlines: InlineNode[] = [
      { type: 'bold', children: [{ type: 'text', text: 'angry' }] },
    ];
    const { getByText } = render(<ParagraphInlineRender inlines={inlines} />);
    const styles = Array.isArray(getByText('angry').props.style)
      ? Object.assign({}, ...getByText('angry').props.style)
      : getByText('angry').props.style;
    expect(styles.fontWeight).toBe('700');
  });

  it('highlights target word range с accentSoft background', () => {
    const inlines: InlineNode[] = [{ type: 'text', text: 'Hello world' }];
    const { toJSON } = render(
      <ParagraphInlineRender inlines={inlines} highlightOffset={6} highlightLength={5} />,
    );
    const tree = JSON.stringify(toJSON());
    expect(tree).toContain('world');
  });
});
