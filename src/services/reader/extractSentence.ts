// Извлекает sentence, в котором лежит tapped слово — для LLM-контекста.
// См. spec §8.5.
import type { ContentItem, InlineNode } from '@/types/content';
import { flattenInlineText } from '@/services/parser/shared/flattenInline';

function flattenAll(inlines: InlineNode[]): string {
  return inlines.map(flattenInlineText).join('');
}

export function extractSentence(item: ContentItem, word: string): string {
  if (item.type !== 'paragraph') return '';
  const text = flattenAll(item.inlines);
  const sentences = text.match(/[^.!?]+[.!?]+|[^.!?]+$/g) ?? [text];
  for (const s of sentences) {
    if (s.includes(word)) return s.trim();
  }
  return text;
}
