import { createTestDatabase } from '@/db/testDatabase';
import { TranslationCacheRepository } from '@/db/repositories/TranslationCacheRepository';

function newRepo() {
  return new TranslationCacheRepository(createTestDatabase());
}

const baseInput = {
  word: 'hello', contextWindow: 'world ctx',
  bookLanguage: 'en', nativeLanguage: 'ru',
  translation: 'привет',
};

describe('TranslationCacheRepository', () => {
  test('upsertByKey + findByKey roundtrip', async () => {
    const repo = newRepo();
    const created = await repo.upsertByKey({ cacheKey: 'k1', ...baseInput });
    expect(created.id).toBe('k1');
    expect(created.translation).toBe('привет');
    const found = await repo.findByKey('k1');
    expect(found?.translation).toBe('привет');
  });

  test('findByKey returns null если ключа нет', async () => {
    const repo = newRepo();
    expect(await repo.findByKey('nope')).toBeNull();
  });

  test('upsertByKey идемпотентен (тот же id)', async () => {
    const repo = newRepo();
    const a = await repo.upsertByKey({ cacheKey: 'k1', ...baseInput });
    const b = await repo.upsertByKey({ cacheKey: 'k1', ...baseInput, translation: 'другой' });
    expect(b.id).toBe(a.id);
    expect(b.translation).toBe('другой');
    expect(await repo.countAll()).toBe(1);
  });

  test('purgeOlderThan удаляет записи < cutoff', async () => {
    const repo = newRepo();
    const old = Date.now() - 100 * 24 * 60 * 60 * 1000; // 100 дней назад
    const fresh = Date.now();
    await repo.upsertByKey({ cacheKey: 'k_old', ...baseInput, createdAt: old });
    await repo.upsertByKey({ cacheKey: 'k_fresh', ...baseInput, createdAt: fresh });
    const cutoff = Date.now() - 90 * 24 * 60 * 60 * 1000;
    const purged = await repo.purgeOlderThan(cutoff);
    expect(purged).toBe(1);
    expect(await repo.findByKey('k_old')).toBeNull();
    expect(await repo.findByKey('k_fresh')).not.toBeNull();
  });

  test('countAll возвращает количество', async () => {
    const repo = newRepo();
    expect(await repo.countAll()).toBe(0);
    await repo.upsertByKey({ cacheKey: 'k1', ...baseInput });
    await repo.upsertByKey({ cacheKey: 'k2', ...baseInput });
    expect(await repo.countAll()).toBe(2);
  });

  test('purgeOldest10Percent удаляет ~10% старейших', async () => {
    const repo = newRepo();
    const now = Date.now();
    for (let i = 0; i < 50; i++) {
      await repo.upsertByKey({ cacheKey: `k${i}`, ...baseInput, createdAt: now - i * 1000 });
    }
    expect(await repo.countAll()).toBe(50);
    const purged = await repo.purgeOldest10Percent();
    expect(purged).toBe(5);
    expect(await repo.countAll()).toBe(45);
  });

  test('clearAll удаляет всё', async () => {
    const repo = newRepo();
    await repo.upsertByKey({ cacheKey: 'k1', ...baseInput });
    await repo.upsertByKey({ cacheKey: 'k2', ...baseInput });
    expect(await repo.clearAll()).toBe(2);
    expect(await repo.countAll()).toBe(0);
  });
});
