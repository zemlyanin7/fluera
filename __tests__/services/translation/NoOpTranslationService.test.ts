import { NoOpTranslationService } from '@/services/translation/NoOpTranslationService';
import type { TranslationInput } from '@/services/translation/ITranslationService';

describe('NoOpTranslationService', () => {
  test('translate возвращает { status: "pending" }', async () => {
    const svc = new NoOpTranslationService();
    const input: TranslationInput = {
      word: 'hello',
      contextWindow: 'world',
      bookLanguage: 'en',
      nativeLanguage: 'ru',
    };
    const result = await svc.translate(input);
    expect(result.status).toBe('pending');
    expect(result.translation).toBeUndefined();
  });

  test('реализует ITranslationService interface', () => {
    const svc = new NoOpTranslationService();
    expect(typeof svc.translate).toBe('function');
  });
});
