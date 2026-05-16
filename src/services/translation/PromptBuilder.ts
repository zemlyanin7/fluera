// Prompt assembly для llama inference. Универсальный template со
// substitution для language pair. CJK pairs используют 「」 (Japanese
// quotes) — они токенизируются стабильно, в отличие от « » которые
// llama.cpp иногда плохо обрабатывает в Asian script context.
import type { BookLanguage, NativeLanguage } from '@/types/settings';
import { langLabel } from './promptLabels';

const CJK_LANGS: ReadonlyArray<string> = ['ja', 'ko'];
const MAX_SENTENCE = 200;

export function isCJKPair(src: BookLanguage, dst: NativeLanguage): boolean {
  return CJK_LANGS.includes(src) || CJK_LANGS.includes(dst);
}

function truncate(s: string, max: number): string {
  if (s.length <= max) return s;
  return s.slice(0, max - 1) + '…';
}

export interface BuildPromptInput {
  word: string;
  sentence: string;
  bookLanguage: BookLanguage;
  nativeLanguage: NativeLanguage;
}

export function buildPrompt(input: BuildPromptInput): string {
  const src = langLabel(input.bookLanguage);
  const dst = langLabel(input.nativeLanguage);
  const word = input.word.trim();
  const sentence = truncate(input.sentence.trim(), MAX_SENTENCE);
  const cjk = isCJKPair(input.bookLanguage, input.nativeLanguage);
  const openQ = cjk ? '「' : '«';
  const closeQ = cjk ? '」' : '»';

  return [
    `You are a precise translator. Given a word in ${src} and the sentence it appears in,`,
    `return the ${dst} translation of the word ONLY, in its contextual meaning.`,
    `No explanation, no transliteration, no synonyms list.`,
    ``,
    `Sentence: ${openQ}${sentence}${closeQ}`,
    `Word: ${word}`,
    ``,
    `${dst} translation of ${openQ}${word}${closeQ}:`,
  ].join('\n');
}
