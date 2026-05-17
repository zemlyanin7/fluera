import { computeCacheKey } from '@/services/translation/cacheKey';

describe('computeCacheKey (FNV-1a)', () => {
  test('детерминирован: одинаковый input → одинаковый key', () => {
    expect(computeCacheKey('hello', 'world ctx', 'en', 'ru'))
      .toBe(computeCacheKey('hello', 'world ctx', 'en', 'ru'));
  });

  test('case-insensitive по word', () => {
    expect(computeCacheKey('Hello', 'ctx', 'en', 'ru'))
      .toBe(computeCacheKey('hello', 'ctx', 'en', 'ru'));
  });

  test('разные пары языков → разные ключи', () => {
    expect(computeCacheKey('hello', 'ctx', 'en', 'ru'))
      .not.toBe(computeCacheKey('hello', 'ctx', 'en', 'es'));
  });

  test('разный контекст → разные ключи', () => {
    expect(computeCacheKey('hello', 'ctx a', 'en', 'ru'))
      .not.toBe(computeCacheKey('hello', 'ctx b', 'en', 'ru'));
  });

  test('длина <= 32 chars', () => {
    expect(computeCacheKey('any', 'any', 'en', 'ru').length).toBeLessThanOrEqual(32);
    expect(computeCacheKey('long-japanese-word', 'long context here too', 'ja', 'hi').length)
      .toBeLessThanOrEqual(32);
  });

  test('sync — возвращает string не Promise', () => {
    const r = computeCacheKey('x', 'y', 'en', 'ru');
    expect(typeof r).toBe('string');
    expect(r).toMatch(/^[0-9a-f]{16}_/);
  });

  test('NFC normalization для unicode', () => {
    // composed vs decomposed форма
    const composed = 'café'; // é = U+00E9
    const decomposed = 'café'; // e + U+0301 combining acute
    expect(computeCacheKey(composed, 'ctx', 'en', 'ru'))
      .toBe(computeCacheKey(decomposed, 'ctx', 'en', 'ru'));
  });
});
