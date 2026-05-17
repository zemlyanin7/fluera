// Deterministic mock для unit-tests + dev preview когда модель не
// установлена. Принимает фиксированный word→translation map; для отсутствующих
// возвращает {word}-translated-{nativeLang} placeholder.
import type {
  ITranslationService,
  TranslationInput,
  TranslationResult,
} from './ITranslationService';

export interface MockOptions {
  map?: Record<string, string>;
  delay?: number;
}

export class MockTranslationService implements ITranslationService {
  constructor(private opts: MockOptions = {}) {}

  async translate(input: TranslationInput): Promise<TranslationResult> {
    if (this.opts.delay) await new Promise((r) => setTimeout(r, this.opts.delay));
    const key = input.word.toLowerCase();
    const direct = this.opts.map?.[key];
    const translation = direct ?? `${input.word}-translated-${input.nativeLanguage}`;
    return { status: 'ok', translation, source: 'inference' };
  }

  async clearCache(): Promise<void> {
    // Mock: no-op.
  }
}
