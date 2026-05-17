// Interface для on-device LLM-перевода. Реализация — в sub-project #4
// (Hy-MT1.5-1.8B-1.25bit-GGUF). В #2 поставляется NoOpTranslationService stub.
import type { BookLanguage, NativeLanguage } from '@/types/settings';

export interface TranslationInput {
  word: string;
  contextWindow: string;
  bookLanguage: BookLanguage;
  nativeLanguage: NativeLanguage;
}

export type TranslationStatus = 'ok' | 'pending' | 'error';

export interface TranslationResult {
  status: TranslationStatus;
  translation?: string;
  grammarNote?: string;
  errorMessage?: string;
}

export interface ITranslationService {
  translate(input: TranslationInput): Promise<TranslationResult>;
}
