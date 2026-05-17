import type { ContentItem } from '@/types/content';
import { countCharsInItem, countCharsInItems } from '../shared/countChars';

describe('countCharsInItem', () => {
  it('counts paragraph chars', () => {
    const p: ContentItem = { type: 'paragraph', inlines: [{ type: 'text', text: 'hello' }] };
    expect(countCharsInItem(p)).toBe(5);
  });

  it('counts heading chars', () => {
    const h: ContentItem = { type: 'heading', level: 1, inlines: [{ type: 'text', text: 'Title' }] };
    expect(countCharsInItem(h)).toBe(5);
  });

  it('returns 0 for image / separator', () => {
    expect(countCharsInItem({ type: 'image', src: 'x' })).toBe(0);
    expect(countCharsInItem({ type: 'separator' })).toBe(0);
  });

  it('counts blockquote recursively', () => {
    const bq: ContentItem = {
      type: 'blockquote',
      items: [{ type: 'paragraph', inlines: [{ type: 'text', text: 'quoted' }] }],
    };
    expect(countCharsInItem(bq)).toBe(6);
  });

  it('counts table-row cells', () => {
    const tr: ContentItem = {
      type: 'table-row',
      cells: [[{ type: 'text', text: 'ab' }], [{ type: 'text', text: 'cd' }]],
    };
    expect(countCharsInItem(tr)).toBe(4);
  });

  it('countCharsInItems sums', () => {
    const items: ContentItem[] = [
      { type: 'paragraph', inlines: [{ type: 'text', text: 'foo' }] },
      { type: 'paragraph', inlines: [{ type: 'text', text: 'bar' }] },
    ];
    expect(countCharsInItems(items)).toBe(6);
  });
});
