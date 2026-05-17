import { buildCacheKey } from '@/services/translation/cacheKey';

describe('buildCacheKey v2 (versioned)', () => {
  it('меняется при model version bump', async () => {
    const k1 = await buildCacheKey({
      word: 'hello', contextWindow: 'hello world',
      bookLanguage: 'en', nativeLanguage: 'ru',
      modelVersion: 'v1', kernelBuildId: 'kb1',
    });
    const k2 = await buildCacheKey({
      word: 'hello', contextWindow: 'hello world',
      bookLanguage: 'en', nativeLanguage: 'ru',
      modelVersion: 'v2', kernelBuildId: 'kb1',
    });
    expect(k1).not.toBe(k2);
  });

  it('меняется при kernel build bump', async () => {
    const k1 = await buildCacheKey({
      word: 'hello', contextWindow: 'hello world',
      bookLanguage: 'en', nativeLanguage: 'ru',
      modelVersion: 'v1', kernelBuildId: 'kb1',
    });
    const k2 = await buildCacheKey({
      word: 'hello', contextWindow: 'hello world',
      bookLanguage: 'en', nativeLanguage: 'ru',
      modelVersion: 'v1', kernelBuildId: 'kb2',
    });
    expect(k1).not.toBe(k2);
  });

  it('returns full 64-char hash', async () => {
    const k = await buildCacheKey({
      word: 'hello', contextWindow: 'hello world',
      bookLanguage: 'en', nativeLanguage: 'ru',
      modelVersion: 'v1', kernelBuildId: 'kb1',
    });
    expect(k.length).toBe(64);
  });
});
