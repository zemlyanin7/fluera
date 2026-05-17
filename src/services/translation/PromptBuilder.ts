// Prompt assembly для llama inference. Hy-MT 1.5 1.8B был обучен на formate
// из официальной демки Tencent:
//   `Translate the following segment into <LANG>, without additional explanation：<TEXT>`
// (full-width colon ：U+FF1A — важно, model запомнила именно его).
// Sentence context опускаем — Hy-MT segment-level translator, лишний контекст
// добавляет шум.
//
// buildSentencePrompt — отдельный промпт для sentence-level перевода через
// jinja chat-template mode (messages array). Использует более мягкий sampling
// (temp 0.3) для более natural sentence output.
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

// ---------------------------------------------------------------------------
// Sentence-level prompt (jinja chat-template messages array)
// ---------------------------------------------------------------------------

export interface SentencePromptInput {
  sentence: string;
  bookLanguage: BookLanguage;
  nativeLanguage: NativeLanguage;
}

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

/**
 * Собирает messages array для sentence-level перевода через jinja chat-template
 * mode llama.cpp. Возвращает [system, user] с полным именем target language.
 */
export function buildSentencePrompt(input: SentencePromptInput): ChatMessage[] {
  const target = langLabel(input.nativeLanguage);
  return [
    {
      role: 'system',
      content: `You are a careful translator. Translate the user's sentence into ${target}. Preserve meaning, register, and named entities. Respond with translation only, no explanations.`,
    },
    {
      role: 'user',
      content: `Translate to ${target}:\n${input.sentence.trim()}`,
    },
  ];
}
