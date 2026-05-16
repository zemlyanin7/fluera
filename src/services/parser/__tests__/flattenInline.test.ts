import type { InlineNode } from '@/types/content';
import { MAX_INLINE_DEPTH } from '@/types/content';
import { flattenInlineText, appendInlineSafe } from '../shared/flattenInline';

describe('flattenInlineText', () => {
  it('extracts text from leaf', () => {
    expect(flattenInlineText({ type: 'text', text: 'hello' })).toBe('hello');
  });

  it('concatenates children', () => {
    const n: InlineNode = {
      type: 'bold',
      children: [
        { type: 'text', text: 'foo ' },
        { type: 'italic', children: [{ type: 'text', text: 'bar' }] },
      ],
    };
    expect(flattenInlineText(n)).toBe('foo bar');
  });

  it('ignores footnote-ref label', () => {
    expect(flattenInlineText({ type: 'footnote-ref', id: 'n1', label: '1' })).toBe('');
  });
});

describe('appendInlineSafe', () => {
  it('appends child within depth limit', () => {
    const arr: InlineNode[] = [];
    appendInlineSafe(arr, { type: 'text', text: 'x' }, 0);
    expect(arr).toHaveLength(1);
  });

  it('flattens to text at MAX_INLINE_DEPTH', () => {
    const deep: InlineNode = {
      type: 'bold',
      children: [{ type: 'italic', children: [{ type: 'text', text: 'deep' }] }],
    };
    const arr: InlineNode[] = [];
    appendInlineSafe(arr, deep, MAX_INLINE_DEPTH);
    expect(arr).toEqual([{ type: 'text', text: 'deep' }]);
  });

  it('preserves structure below limit', () => {
    const arr: InlineNode[] = [];
    appendInlineSafe(arr, { type: 'italic', children: [{ type: 'text', text: 'a' }] }, 5);
    expect(arr[0].type).toBe('italic');
  });
});
