// Interface для on-device LLM-перевода. NoOp stub из #2 заменён на
// LlamaTranslationService в #4 (поверх llama.rn + Hy-MT1.5-1.8B-1.25bit-GGUF).
// Расширен в #4.5: sentence-level перевод, MWE, false-friend, encounter tracking.
// Расширен в #4.5.1 v3: generation token + abortSentence для race-safe rapid-tap.
import type { BookLanguage, NativeLanguage } from '@/types/settings';
import type { InferenceContext } from './inferenceContext';
import type { InlineNode } from '@/types/content';

export type TranslationSource = 'memory' | 'db' | 'inference';

export interface TranslationInput {
  word: string;
  contextWindow: string;
  bookLanguage: BookLanguage;
  nativeLanguage: NativeLanguage;
}

export type TranslationStatus = 'ok' | 'pending' | 'error';

export type TranslationErrorCode =
  | 'MODEL_NOT_INSTALLED'
  | 'MODEL_LOADING'
  | 'INFERENCE_TIMEOUT'
  | 'INFERENCE_FAILED'
  | 'EMPTY_RESPONSE'
  | 'UNSUPPORTED_PAIR';

/** Информация о false-friend (ложный друг переводчика). */
export interface FalseFriendInfo {
  /** Слово в исходном языке, которое похоже на родное. */
  looksLike: string;
  /** Реальное значение (не то, что ожидает читатель). */
  actualMeaning: string;
  /** Уверенность детектора. */
  confidence: 'high' | 'medium' | 'low';
  /** Домен ложного друга (general, technical, etc). */
  domain: string;
}

/** Информация о MWE (multi-word expression / phrasal verb). */
export interface MwePhraseInfo {
  /** Полная фраза (напр. "give up"). */
  phrase: string;
  /** Перевод фразы целиком. */
  translationEquivalent: string;
  /** Дословный перевод (опционально). */
  literalGloss?: string;
  /** Тип MWE. */
  type: 'phrasal_verb' | 'idiom' | 'collocation' | 'compound';
}

export interface TranslationResult {
  status: TranslationStatus;
  translation?: string;
  grammarNote?: string;
  errorMessage?: string;
  /** Где найден перевод (memory cache / db cache / fresh inference). */
  source?: TranslationSource;
  /** Машиночитаемый код ошибки для UI dispatch. */
  errorCode?: TranslationErrorCode;
  /** Альтернативные значения слова (полисемия). */
  alternativeSenses?: string[];
  /** Регистровая метка (formal, informal, archaic, ...). */
  registerTag?: string;
  /** Домен регистра (literary, medical, colloquial, ...). */
  registerDomain?: string;
  /** Информация о false-friend (если обнаружен). */
  falseFriend?: FalseFriendInfo;
  /** Информация о MWE (если слово является частью фразы). */
  mwePhrase?: MwePhraseInfo;
  /** Сколько раз читатель уже встречал это слово (из WordStatus). */
  encounterCount?: number;
  /** Произношение слова (транскрипция / IPA / каллиграфия). */
  pronunciation?: string;
  /** Контекст инференса на момент перевода. */
  inferenceContext?: InferenceContext;
}

// ---------------------------------------------------------------------------
// Sentence-level translation types (#4.5)
// ---------------------------------------------------------------------------

export interface SentenceTranslationInput {
  sentence: string;
  bookLanguage: BookLanguage;
  nativeLanguage: NativeLanguage;
  /** Char offset слова в предложении (для tryAlignWord). */
  wordOffset?: number;
  /** Исходное слово для tryAlignWord (опционально). */
  sourceWord?: string;
  /** v3: generation token для race-safe handling. */
  generation?: number;
  /** v3: InlineNode[] для inlineHash + preserved formatting. */
  sourceInlines?: InlineNode[];
}

export interface SentenceTranslationResult {
  status: 'ok' | 'error';
  /** Исходное предложение (echo). */
  sourceSentence?: string;
  /** Переведённое предложение. */
  translatedSentence?: string;
  /** Char offset слова в переведённом предложении (если tryAlignWord успешен). */
  translatedWordOffset?: number;
  /**
   * Sentence translation помечается experimental=true во всех результатах.
   * Используется UI для рендера "beta" badge и более мягкого error messaging.
   */
  experimental?: boolean;
  /** Контекст инференса на момент перевода. */
  inferenceContext?: InferenceContext;
  /** Источник (cache hit или fresh inference). */
  source?: TranslationSource;
  /** Машиночитаемый код ошибки. */
  errorCode?: TranslationErrorCode;
  errorMessage?: string;
  /** v3: echo input generation для caller stale check. */
  generation?: number;
  /** v3: word has multiple senses. */
  hasMultipleSenses?: boolean;
  /** v3: false-friend info if detected. */
  falseFriend?: { looksLike: string; actualMeaning: string };
}

export interface ITranslationService {
  translate(input: TranslationInput): Promise<TranslationResult>;
  /**
   * Перевод предложения целиком. Experimental в v1 — использует jinja
   * chat-template mode llama.cpp с более мягким sampling (temp 0.3).
   * Всегда возвращает experimental=true.
   */
  translateSentence(input: SentenceTranslationInput): Promise<SentenceTranslationResult>;
  /** v3: best-effort abort pending sentence translation. */
  abortSentence(generation: number): void;
  /**
   * Полная очистка cache: DB rows + in-memory LRU. Используется кнопкой
   * "Очистить кэш переводов" в Settings. Без LRU clear старые entries
   * возвращались бы из памяти даже после DB wipe.
   */
  clearCache(): Promise<void>;
}
