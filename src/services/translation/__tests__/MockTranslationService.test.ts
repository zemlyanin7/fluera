import { MockTranslationService } from '../MockTranslationService';

describe('MockTranslationService', () => {
  it('returns mapped translation', async () => {
    const svc = new MockTranslationService({ map: { cat: 'кошка' } });
    const res = await svc.translate({
      word: 'cat',
      contextWindow: 'x',
      bookLanguage: 'en',
      nativeLanguage: 'ru',
    });
    expect(res.status).toBe('ok');
    expect(res.translation).toBe('кошка');
  });

  it('case-insensitive map lookup', async () => {
    const svc = new MockTranslationService({ map: { cat: 'кошка' } });
    const res = await svc.translate({
      word: 'Cat',
      contextWindow: 'x',
      bookLanguage: 'en',
      nativeLanguage: 'ru',
    });
    expect(res.translation).toBe('кошка');
  });

  it('falls back to fake translation', async () => {
    const svc = new MockTranslationService({ map: {} });
    const res = await svc.translate({
      word: 'cat',
      contextWindow: 'x',
      bookLanguage: 'en',
      nativeLanguage: 'ru',
    });
    expect(res.translation).toBe('cat-translated-ru');
  });

  it('honours delay', async () => {
    const svc = new MockTranslationService({ map: {}, delay: 50 });
    const start = Date.now();
    await svc.translate({
      word: 'x',
      contextWindow: 'y',
      bookLanguage: 'en',
      nativeLanguage: 'ru',
    });
    expect(Date.now() - start).toBeGreaterThanOrEqual(45);
  });
});
