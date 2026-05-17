// Prompt assembly для llama inference. Hy-MT 1.5 1.8B был обучен на formate
// из официальной демки Tencent:
//   `Translate the following segment into <LANG>, without additional explanation：<TEXT>`
// (full-width colon ：U+FF1A — важно, model запомнила именно его).
// Sentence context опускаем — Hy-MT segment-level translator, лишний контекст
// добавляет шум.
import type { BookLanguage, NativeLanguage } from '@/types/settings';
import { langLabel } from './promptLabels';

const CJK_LANGS: ReadonlyArray<string> = ['ja', 'ko'];

export function isCJKPair(src: BookLanguage, dst: NativeLanguage): boolean {
  return CJK_LANGS.includes(src) || CJK_LANGS.includes(dst);
}

export interface BuildPromptInput {
  word: string;
  sentence: string;
  bookLanguage: BookLanguage;
  nativeLanguage: NativeLanguage;
}

export function buildPrompt(input: BuildPromptInput): string {
  const dst = langLabel(input.nativeLanguage);
  const word = input.word.trim();
  return `Translate the following segment into ${dst}, without additional explanation：${word}`;
}
