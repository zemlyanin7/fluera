// Защита от patalogical вложенности EPUB (см. spec §5.5).
// При depth >= MAX_INLINE_DEPTH — flatten child в plain text-нод,
// сохраняя текстовое содержимое.
import { MAX_INLINE_DEPTH, type InlineNode } from '@/types/content';

/** Извлекает только текст из inline-дерева (без структуры). */
export function flattenInlineText(node: InlineNode): string {
  if (node.type === 'text') return node.text;
  if (node.type === 'footnote-ref') return '';
  return node.children.map(flattenInlineText).join('');
}

/**
 * Добавляет child в parent с защитой от patalogical вложенности.
 * При depth >= MAX_INLINE_DEPTH — flatten child в plain text-нод.
 */
export function appendInlineSafe(parent: InlineNode[], child: InlineNode, depth: number): void {
  if (depth >= MAX_INLINE_DEPTH) {
    parent.push({ type: 'text', text: flattenInlineText(child) });
    return;
  }
  parent.push(child);
}
