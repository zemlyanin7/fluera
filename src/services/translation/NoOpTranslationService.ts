// Stub implementation для #2 Data layer. Реальная реализация — в #4
// (Hy-MT1.5-1.8B on-device через локальный llama.cpp / mlc-llm runtime).
// useTranslation hook принимает service: ITranslationService с default=NoOp.
import type {
  ITranslationService,
  TranslationInput,
  TranslationResult,
  SentenceTranslationResult,
} from './ITranslationService';

export class NoOpTranslationService implements ITranslationService {

  async translate(_input: TranslationInput): Promise<TranslationResult> {
    return { status: 'pending' };
  }

  async translateSentence(): Promise<SentenceTranslationResult> {
    return { status: 'error', errorCode: 'MODEL_NOT_INSTALLED', errorMessage: 'NoOp: no LLM' };
  }

  async clearCache(): Promise<void> {
    // NoOp: нет cache.
  }
}
