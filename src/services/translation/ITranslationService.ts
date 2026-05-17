// Interface для on-device LLM-перевода. NoOp stub из #2 заменён на
// LlamaTranslationService в #4 (поверх llama.rn + Hy-MT1.5-1.8B-1.25bit-GGUF).
import type { BookLanguage, NativeLanguage } from '@/types/settings';

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

export type TranslationSource = 'memory' | 'db' | 'inference';

export interface TranslationResult {
  status: TranslationStatus;
  translation?: string;
  grammarNote?: string;
  errorMessage?: string;
  /** Где найден перевод (memory cache / db cache / fresh inference). */
  source?: TranslationSource;
  /** Машиночитаемый код ошибки для UI dispatch. */
  errorCode?: TranslationErrorCode;
}

export interface ITranslationService {
  translate(input: TranslationInput): Promise<TranslationResult>;
  /**
   * Полная очистка cache: DB rows + in-memory LRU. Используется кнопкой
   * "Очистить кэш переводов" в Settings. Без LRU clear старые entries
   * возвращались бы из памяти даже после DB wipe.
   */
  clearCache(): Promise<void>;
}
