// #4.6 — CacheLayer accepts source + chooses TTL + lazy TTL purge on lookup.
import { CacheLayer } from '@/services/translation/CacheLayer';

function makeRepoSpy() {
  const calls: any[] = [];
  return {
    calls,
    findByKey: jest.fn(async () => null),
    findSentenceByKey: jest.fn(async () => null),
    upsertByKey: jest.fn(async (input: any) => {
      calls.push(input);
      return null;
    }),
    upsertSentenceByKey: jest.fn(async (input: any) => {
      calls.push(input);
      return null;
    }),
    deleteByKey: jest.fn(async () => {}),
    clearAll: jest.fn(async () => 0),
  } as any;
}

describe('CacheLayer — source + ttl_days', () => {
  it('default write tags on_demand + ttl 90', async () => {
    const repo = makeRepoSpy();
    const layer = new CacheLayer(repo, 100, () => 'm1', () => 'k1');
    await layer.write('hello', 'ctx', 'en', 'ru', 'привет', { inferenceContext: 'warm' });
    await new Promise((r) => setImmediate(r));
    expect(repo.calls[0]).toMatchObject({ source: 'on_demand', ttlDays: 90 });
  });

  it('prefetch write tags prefetch + ttl 30', async () => {
    const repo = makeRepoSpy();
    const layer = new CacheLayer(repo, 100, () => 'm1', () => 'k1');
    await layer.write('hello', 'ctx', 'en', 'ru', 'привет', {
      inferenceContext: 'warm',
      source: 'prefetch',
    });
    await new Promise((r) => setImmediate(r));
    expect(repo.calls[0]).toMatchObject({ source: 'prefetch', ttlDays: 30 });
  });

  it('cold inference does NOT persist regardless of source', async () => {
    const repo = makeRepoSpy();
    const layer = new CacheLayer(repo, 100, () => 'm1', () => 'k1');
    await layer.write('hello', 'ctx', 'en', 'ru', 'привет', {
      inferenceContext: 'cold',
      source: 'prefetch',
    });
    await new Promise((r) => setImmediate(r));
    expect(repo.upsertByKey).not.toHaveBeenCalled();
  });

  it('writeSentence accepts source/ttl_days (P1-I mirror)', async () => {
    const repo = makeRepoSpy();
    const layer = new CacheLayer(repo, 100, () => 'm1', () => 'k1');
    await layer.writeSentence('hello world.', 'en', 'ru', 'привет мир.', null, {
      inferenceContext: 'warm',
      source: 'prefetch',
    });
    await new Promise((r) => setImmediate(r));
    expect(repo.calls[0]).toMatchObject({ source: 'prefetch', ttlDays: 30 });
  });

  it('lookup on TTL-expired row returns null and deletes the row', async () => {
    const past = Date.now() - 40 * 24 * 60 * 60 * 1000;
    const repo = makeRepoSpy();
    repo.findByKey = jest.fn(async () => ({
      id: 'k',
      cacheKey: 'k',
      word: 'hello',
      contextWindow: 'ctx',
      bookLanguage: 'en',
      nativeLanguage: 'ru',
      translation: 'привет',
      grammar: null,
      sentenceTranslation: null,
      translatedWordOffset: null,
      source: 'prefetch',
      ttlDays: 30,
      createdAt: past,
      inferenceContext: 'warm',
      modelVersion: 'm1',
      kernelBuildId: 'k1',
      chrfScore: null,
    }));
    const layer = new CacheLayer(repo, 100, () => 'm1', () => 'k1');
    const hit = await layer.lookup('hello', 'ctx', 'en', 'ru');
    expect(hit).toBeNull();
    expect(repo.deleteByKey).toHaveBeenCalled();
  });

  it('lookup on fresh row within TTL returns hit', async () => {
    const repo = makeRepoSpy();
    repo.findByKey = jest.fn(async () => ({
      id: 'k',
      cacheKey: 'k',
      word: 'hello',
      contextWindow: 'ctx',
      bookLanguage: 'en',
      nativeLanguage: 'ru',
      translation: 'привет',
      grammar: null,
      sentenceTranslation: null,
      translatedWordOffset: null,
      source: 'prefetch',
      ttlDays: 30,
      createdAt: Date.now() - 1000,
      inferenceContext: 'warm',
      modelVersion: 'm1',
      kernelBuildId: 'k1',
      chrfScore: null,
    }));
    const layer = new CacheLayer(repo, 100, () => 'm1', () => 'k1');
    const hit = await layer.lookup('hello', 'ctx', 'en', 'ru');
    expect(hit?.value).toBe('привет');
    expect(repo.deleteByKey).not.toHaveBeenCalled();
  });
});
