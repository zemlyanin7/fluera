import { CacheLayer } from '../CacheLayer';
import type { TranslationCacheRepository } from '@/db/repositories/TranslationCacheRepository';

function makeMockRepo() {
  return {
    findByKey: jest.fn().mockResolvedValue(null),
    upsertByKey: jest.fn().mockResolvedValue({}),
    countAll: jest.fn().mockResolvedValue(0),
    clearAll: jest.fn().mockResolvedValue(0),
    purgeOlderThan: jest.fn().mockResolvedValue(0),
    purgeOldest10Percent: jest.fn().mockResolvedValue(0),
  } as unknown as jest.Mocked<TranslationCacheRepository>;
}

describe('CacheLayer', () => {
  it('cacheKey deterministic + 32 chars + case-insensitive word', async () => {
    const cache = new CacheLayer(makeMockRepo(), 10);
    const k1 = await cache.cacheKey('Cat', 'The Cat.', 'en', 'ru');
    const k2 = await cache.cacheKey('cat', 'The Cat.', 'en', 'ru');
    expect(k1).toBe(k2);
    expect(k1).toHaveLength(32);
  });

  it('lookup memory hit without DB call', async () => {
    const repo = makeMockRepo();
    const cache = new CacheLayer(repo, 10);
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
      createdAt: 0,
    });
    const cache = new CacheLayer(repo, 10);
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
    const cache = new CacheLayer(repo, 10);
    expect(await cache.lookup('x', 'y', 'en', 'ru')).toBeNull();
  });

  it('write fires repo.upsertByKey (fire-and-forget)', async () => {
    const repo = makeMockRepo();
    repo.upsertByKey.mockResolvedValue({} as any);
    const cache = new CacheLayer(repo, 10);
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
    const cache = new CacheLayer(repo, 10);
    await cache.write('cat', 'ctx', 'en', 'ru', 'кошка');
    cache.clearMemory();
    expect(repo.clearAll).not.toHaveBeenCalled();
  });
});
