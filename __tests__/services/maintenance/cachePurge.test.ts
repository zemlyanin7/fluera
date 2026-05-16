import { createTestDatabase } from '@/db/testDatabase';
import { TranslationCacheRepository } from '@/db/repositories/TranslationCacheRepository';
import { runCachePurge } from '@/services/maintenance/cachePurge';

const base = {
  word: 'w', contextWindow: '', bookLanguage: 'en',
  nativeLanguage: 'ru', translation: 't',
};

describe('runCachePurge', () => {
  test('удаляет cache rows старше 90 дней', async () => {
    const db = createTestDatabase();
    const repo = new TranslationCacheRepository(db);
    const now = Date.now();
    await repo.upsertByKey({ cacheKey: 'k_old', ...base, createdAt: now - 91 * 24 * 60 * 60 * 1000 });
    await repo.upsertByKey({ cacheKey: 'k_fresh', ...base, createdAt: now });
    const result = await runCachePurge(db, { now });
    expect(result.purgedExpired).toBe(1);
    expect(result.totalAfter).toBe(1);
    expect(await repo.findByKey('k_old')).toBeNull();
    expect(await repo.findByKey('k_fresh')).not.toBeNull();
  });

  test('не трогает свежие записи', async () => {
    const db = createTestDatabase();
    const repo = new TranslationCacheRepository(db);
    await repo.upsertByKey({ cacheKey: 'k1', ...base });
    await repo.upsertByKey({ cacheKey: 'k2', ...base });
    const result = await runCachePurge(db);
    expect(result.purgedExpired).toBe(0);
    expect(result.totalAfter).toBe(2);
  });

  test('кастомный TTL', async () => {
    const db = createTestDatabase();
    const repo = new TranslationCacheRepository(db);
    const now = Date.now();
    await repo.upsertByKey({ cacheKey: 'k', ...base, createdAt: now - 2 * 24 * 60 * 60 * 1000 });
    const result = await runCachePurge(db, { now, ttlMs: 24 * 60 * 60 * 1000 });
    expect(result.purgedExpired).toBe(1);
  });

  test('hard cap → purge 10% oldest', async () => {
    const db = createTestDatabase();
    const repo = new TranslationCacheRepository(db);
    const now = Date.now();
    // 100 свежих rows; hardCap=50 → должно остаться ~90 (purge 10%)
    for (let i = 0; i < 100; i++) {
      await repo.upsertByKey({ cacheKey: `k${i}`, ...base, createdAt: now - i * 1000 });
    }
    const result = await runCachePurge(db, { now, hardCap: 50 });
    expect(result.purgedExpired).toBe(0);
    expect(result.purgedOverCap).toBe(10);
    expect(result.totalAfter).toBe(90);
  });
});
