// #4.6 — TranslationCacheRepository: source/ttl_days persistence + TTL purge.
import { createTestDatabase } from '@/db/testDatabase';
import { TranslationCacheRepository } from '../TranslationCacheRepository';

const baseInput = {
  cacheKey: 'k1',
  word: 'hello',
  contextWindow: 'hello world',
  bookLanguage: 'en',
  nativeLanguage: 'ru',
  translation: 'привет',
  inferenceContext: 'warm',
  modelVersion: '1.0',
  kernelBuildId: 'build-x',
};

describe('TranslationCacheRepository — prefetch source', () => {
  it('upsertByKey persists source + ttl_days', async () => {
    const db = await createTestDatabase();
    const repo = new TranslationCacheRepository(db);
    await repo.upsertByKey({
      ...baseInput,
      source: 'prefetch',
      ttlDays: 30,
    });
    const row = await repo.findByKey('k1');
    expect(row?.source).toBe('prefetch');
    expect(row?.ttlDays).toBe(30);
  });

  it('upsertByKey default source on_demand + ttl 90 when not provided', async () => {
    const db = await createTestDatabase();
    const repo = new TranslationCacheRepository(db);
    await repo.upsertByKey(baseInput as any);
    const row = await repo.findByKey('k1');
    expect(row?.source).toBe('on_demand');
    expect(row?.ttlDays).toBe(90);
  });

  it('purgeExpiredBySource removes prefetch entries older than ttl_days', async () => {
    const db = await createTestDatabase();
    const repo = new TranslationCacheRepository(db);
    const past = Date.now() - 40 * 24 * 60 * 60 * 1000; // 40 days ago
    await repo.upsertByKey({
      ...baseInput,
      cacheKey: 'k_old',
      source: 'prefetch',
      ttlDays: 30,
      createdAt: past,
    });
    await repo.upsertByKey({
      ...baseInput,
      cacheKey: 'k_fresh',
      source: 'prefetch',
      ttlDays: 30,
    });
    const n = await repo.purgeExpiredBySource();
    expect(n).toBeGreaterThanOrEqual(1);
    expect(await repo.findByKey('k_old')).toBeNull();
    expect(await repo.findByKey('k_fresh')).not.toBeNull();
  });

  it('deleteByKey removes single row', async () => {
    const db = await createTestDatabase();
    const repo = new TranslationCacheRepository(db);
    await repo.upsertByKey({ ...baseInput, source: 'on_demand', ttlDays: 90 });
    await repo.deleteByKey('k1');
    expect(await repo.findByKey('k1')).toBeNull();
  });

  it('upsertSentenceByKey persists source + ttl_days (P1-I mirror)', async () => {
    const db = await createTestDatabase();
    const repo = new TranslationCacheRepository(db);
    await repo.upsertSentenceByKey({
      cacheKey: 'sentkey1',
      bookLanguage: 'en',
      nativeLanguage: 'ru',
      sentenceTranslation: 'привет мир',
      inferenceContext: 'warm',
      modelVersion: '1.0',
      kernelBuildId: 'build-x',
      source: 'prefetch',
      ttlDays: 30,
    });
    const row = await repo.findSentenceByKey('sentkey1');
    expect(row?.source).toBe('prefetch');
    expect(row?.ttlDays).toBe(30);
  });
});
