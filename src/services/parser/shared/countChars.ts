// Position metric — суммируем символы по дереву ContentItem.
// Используется для прогресса чтения + reading_positions.character_offset.
import type { ContentItem, InlineNode } from '@/types/content';
import { flattenInlineText } from './flattenInline';

function sumInlines(inlines: InlineNode[]): number {
  return inlines.reduce((s, n) => s + flattenInlineText(n).length, 0);
}

export function countCharsInItem(item: ContentItem): number {
  switch (item.type) {
    case 'paragraph':
    case 'heading':
      return sumInlines(item.inlines);
    case 'blockquote':
      return item.items.reduce((s, sub) => s + countCharsInItem(sub), 0);
    case 'list':
      return item.items.reduce(
        (s, blk) => s + blk.reduce((sb, sub) => sb + countCharsInItem(sub), 0),
        0,
      );
    case 'table-row':
      return item.cells.reduce((s, cell) => s + sumInlines(cell), 0);
    case 'image':
    case 'separator':
      return 0;
  }
}

export function countCharsInItems(items: ContentItem[]): number {
  return items.reduce((s, i) => s + countCharsInItem(i), 0);
}
