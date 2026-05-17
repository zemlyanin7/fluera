import { createTestDatabase } from '@/db/testDatabase';
import { TranslationFeedbackRepository } from '@/db/repositories/TranslationFeedbackRepository';

const baseEntry = {
  sourceSentence: 'The cat sat on the mat.',
  translatedSentence: 'Кошка сидела на коврике.',
  bookLanguage: 'en',
  nativeLanguage: 'ru',
  modelVersion: 'Hy-MT1.5-1.8B-1.25bit',
  kernelBuildId: null,
  bookId: null,
};

describe('TranslationFeedbackRepository', () => {
  it('insert возвращает id', async () => {
    const db = createTestDatabase();
    const repo = new TranslationFeedbackRepository(db);
    const id = await repo.insert({ ...baseEntry, createdAt: Date.now() });
    expect(typeof id).toBe('string');
    expect(id.length).toBeGreaterThan(0);
  });

  it('insert + listRecent возвращает отсортированные по убыванию created_at', async () => {
    const db = createTestDatabase();
    const repo = new TranslationFeedbackRepository(db);
    const now = Date.now();
    await repo.insert({ ...baseEntry, sourceSentence: 'first', createdAt: now - 2000 });
    await repo.insert({ ...baseEntry, sourceSentence: 'second', createdAt: now - 1000 });
    await repo.insert({ ...baseEntry, sourceSentence: 'third', createdAt: now });

    const rows = await repo.listRecent(10);
    expect(rows).toHaveLength(3);
    // DESC order — newest first
    expect(rows[0]!.sourceSentence).toBe('third');
    expect(rows[1]!.sourceSentence).toBe('second');
    expect(rows[2]!.sourceSentence).toBe('first');
  });

  it('listRecent ограничивает количество результатов', async () => {
    const db = createTestDatabase();
    const repo = new TranslationFeedbackRepository(db);
    const now = Date.now();
    for (let i = 0; i < 5; i++) {
      await repo.insert({ ...baseEntry, createdAt: now + i });
    }
    const rows = await repo.listRecent(3);
    expect(rows).toHaveLength(3);
  });

  it('purgeOlderThan удаляет записи старше cutoff', async () => {
    const db = createTestDatabase();
    const repo = new TranslationFeedbackRepository(db);
    const now = Date.now();
    const cutoff = now - 10_000;
    await repo.insert({ ...baseEntry, sourceSentence: 'old', createdAt: now - 20_000 });
    await repo.insert({ ...baseEntry, sourceSentence: 'recent', createdAt: now });

    const purged = await repo.purgeOlderThan(cutoff);
    expect(purged).toBe(1);

    const remaining = await repo.listRecent(10);
    expect(remaining).toHaveLength(1);
    expect(remaining[0]!.sourceSentence).toBe('recent');
  });

  it('clearAll удаляет все записи', async () => {
    const db = createTestDatabase();
    const repo = new TranslationFeedbackRepository(db);
    await repo.insert({ ...baseEntry, createdAt: Date.now() });
    await repo.insert({ ...baseEntry, createdAt: Date.now() });
    const count = await repo.clearAll();
    expect(count).toBe(2);
    expect(await repo.listRecent(10)).toHaveLength(0);
  });
});
