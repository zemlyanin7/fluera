import { CacheLayer } from '../CacheLayer';
import type { TranslationCacheRepository } from '@/db/repositories/TranslationCacheRepository';

function makeMockRepo() {
  return {
    findByKey: jest.fn().mockResolvedValue(null),
    upsertByKey: jest.fn().mockResolvedValue({}),
    findSentenceByKey: jest.fn().mockResolvedValue(null),
    upsertSentenceByKey: jest.fn().mockResolvedValue({}),
    countAll: jest.fn().mockResolvedValue(0),
    clearAll: jest.fn().mockResolvedValue(0),
    purgeOlderThan: jest.fn().mockResolvedValue(0),
    purgeOldest10Percent: jest.fn().mockResolvedValue(0),
  } as unknown as jest.Mocked<TranslationCacheRepository>;
}

describe('CacheLayer', () => {
  it('lookup memory hit without DB call', async () => {
    const repo = makeMockRepo();
    const cache = new CacheLayer(repo, 10, () => 'mv1', () => 'kb1');
    await cache.write('cat', 'ctx', 'en', 'ru', 'кошка');
    const res = await cache.lookup('cat', 'ctx', 'en', 'ru');
    expect(res?.value).toBe('кошка');
    expect(res?.source).toBe('memory');
    expect(repo.findByKey).not.toHaveBeenCalled();
  });

  it('lookup falls through to DB and populates memory', async () => {
    const repo = makeMockRepo();
    repo.findByKey.mockResolvedValue({
      id: '1',
      cacheKey: 'x',
      word: 'cat',
      contextWindow: 'ctx',
      bookLanguage: 'en',
      nativeLanguage: 'ru',
      translation: 'кошка',
      grammar: null,
      createdAt: Date.now(),
      sentenceTranslation: null,
      translatedWordOffset: null,
      inferenceContext: 'warm',
      modelVersion: 'mv1',
      kernelBuildId: null,
      source: 'on_demand',
      ttlDays: 90,
      chrfScore: null,
    });
    const cache = new CacheLayer(repo, 10, () => 'mv1', () => 'kb1');
    const res = await cache.lookup('cat', 'ctx', 'en', 'ru');
    expect(res?.source).toBe('db');
    repo.findByKey.mockClear();
    const res2 = await cache.lookup('cat', 'ctx', 'en', 'ru');
    expect(res2?.source).toBe('memory');
    expect(repo.findByKey).not.toHaveBeenCalled();
  });

  it('lookup returns null on miss', async () => {
    const repo = makeMockRepo();
    repo.findByKey.mockResolvedValue(null);
    const cache = new CacheLayer(repo, 10, () => 'mv1', () => 'kb1');
    expect(await cache.lookup('x', 'y', 'en', 'ru')).toBeNull();
  });

  it('write fires repo.upsertByKey (fire-and-forget)', async () => {
    const repo = makeMockRepo();
    repo.upsertByKey.mockResolvedValue({} as any);
    const cache = new CacheLayer(repo, 10, () => 'mv1', () => 'kb1');
    await cache.write('cat', 'ctx', 'en', 'ru', 'кошка');
    await new Promise((r) => setTimeout(r, 20));
    expect(repo.upsertByKey).toHaveBeenCalledWith(
      expect.objectContaining({
        word: 'cat',
        contextWindow: 'ctx',
        bookLanguage: 'en',
        nativeLanguage: 'ru',
        translation: 'кошка',
      }),
    );
  });

  it('clearMemory wipes in-memory but not DB', async () => {
    const repo = makeMockRepo();
    const cache = new CacheLayer(repo, 10, () => 'mv1', () => 'kb1');
    await cache.write('cat', 'ctx', 'en', 'ru', 'кошка');
    cache.clearMemory();
    expect(repo.clearAll).not.toHaveBeenCalled();
  });
});

describe('CacheLayer cold rule', () => {
  it('cold inference НЕ персистится в DB, только memory', async () => {
    const repoMock = {
      findByKey: jest.fn().mockResolvedValue(null),
      upsertByKey: jest.fn().mockResolvedValue(undefined),
      findSentenceByKey: jest.fn().mockResolvedValue(null),
      upsertSentenceByKey: jest.fn().mockResolvedValue(undefined),
      clearAll: jest.fn().mockResolvedValue(undefined),
    };
    const cache = new CacheLayer(repoMock as any, 100, () => 'mv1', () => 'kb1');
    await cache.write('hello', 'hello world', 'en', 'ru', 'привет', { inferenceContext: 'cold' });
    expect(repoMock.upsertByKey).not.toHaveBeenCalled();
    const hit = await cache.lookup('hello', 'hello world', 'en', 'ru');
    expect(hit!.value).toBe('привет');
    expect(hit!.source).toBe('memory');
  });

  it('warm inference персистится в DB', async () => {
    const repoMock = {
      findByKey: jest.fn().mockResolvedValue(null),
      upsertByKey: jest.fn().mockResolvedValue(undefined),
      findSentenceByKey: jest.fn().mockResolvedValue(null),
      upsertSentenceByKey: jest.fn().mockResolvedValue(undefined),
      clearAll: jest.fn().mockResolvedValue(undefined),
    };
    const cache = new CacheLayer(repoMock as any, 100, () => 'mv1', () => 'kb1');
    await cache.write('hello', 'hello world', 'en', 'ru', 'привет', { inferenceContext: 'warm' });
    await new Promise((r) => setTimeout(r, 10));
    expect(repoMock.upsertByKey).toHaveBeenCalledTimes(1);
  });
});
