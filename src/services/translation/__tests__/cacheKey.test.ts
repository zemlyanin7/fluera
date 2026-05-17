import { buildCacheKey, buildSentenceCacheKey } from '@/services/translation/cacheKey';

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

describe('buildSentenceCacheKey v3 (с inlineHash)', () => {
  it('меняется при разном inlineHash', async () => {
    const k1 = await buildSentenceCacheKey({
      sentence: 'hello world',
      bookLanguage: 'en',
      nativeLanguage: 'ru',
      modelVersion: 'mv1',
      kernelBuildId: 'kb1',
      inlineHash: 'hash1',
    });
    const k2 = await buildSentenceCacheKey({
      sentence: 'hello world',
      bookLanguage: 'en',
      nativeLanguage: 'ru',
      modelVersion: 'mv1',
      kernelBuildId: 'kb1',
      inlineHash: 'hash2',
    });
    expect(k1).not.toBe(k2);
  });
});
