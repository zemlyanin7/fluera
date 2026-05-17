import type { InlineNode } from '@/types/content';
import type { BookLanguage } from '@/types/settings';

export interface ExtractedContext {
  inlines: InlineNode[];
  plainText: string;
  wordOffsetInPlain: number;
  wordLength: number;
  wasCapped: boolean;
  startOffsetInParagraph: number;
  endOffsetInParagraph: number;
}

// Re-export for convenience
export type { InlineNode, BookLanguage };
