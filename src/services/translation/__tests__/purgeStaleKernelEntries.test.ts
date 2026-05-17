import { createTestDatabase } from '@/db/testDatabase';
import { TranslationCacheRepository } from '@/db/repositories/TranslationCacheRepository';
import { purgeStaleKernelEntries } from '@/services/translation/purgeStaleKernelEntries';

describe('purgeStaleKernelEntries', () => {
  it('удаляет entries с другим kernel_build_id', async () => {
    const db = createTestDatabase();
    const repo = new TranslationCacheRepository(db);
    await repo.upsertByKey({
      cacheKey: 'oldkey1',
      word: 'hi',
      contextWindow: 'hi',
      bookLanguage: 'en',
      nativeLanguage: 'ru',
      translation: 'привет',
      sentenceTranslation: null,
      translatedWordOffset: null,
      inferenceContext: 'warm',
      modelVersion: 'mv1',
      kernelBuildId: 'old-kernel',
    });
    await repo.upsertByKey({
      cacheKey: 'newkey1',
      word: 'bye',
      contextWindow: 'bye',
      bookLanguage: 'en',
      nativeLanguage: 'ru',
      translation: 'пока',
      sentenceTranslation: null,
      translatedWordOffset: null,
      inferenceContext: 'warm',
      modelVersion: 'mv1',
      kernelBuildId: 'current-kernel',
    });
    const purged = await purgeStaleKernelEntries(db, 'current-kernel');
    expect(purged).toBe(1);
  });

  it('не удаляет ничего если все entries имеют текущий kernel_build_id', async () => {
    const db = createTestDatabase();
    const repo = new TranslationCacheRepository(db);
    await repo.upsertByKey({
      cacheKey: 'key1',
      word: 'hello',
      contextWindow: 'hello',
      bookLanguage: 'en',
      nativeLanguage: 'ru',
      translation: 'привет',
      sentenceTranslation: null,
      translatedWordOffset: null,
      inferenceContext: 'warm',
      modelVersion: 'mv1',
      kernelBuildId: 'current-kernel',
    });
    const purged = await purgeStaleKernelEntries(db, 'current-kernel');
    expect(purged).toBe(0);
  });

  it('возвращает 0 если база пуста', async () => {
    const db = createTestDatabase();
    const purged = await purgeStaleKernelEntries(db, 'current-kernel');
    expect(purged).toBe(0);
  });

  it('удаляет все stale entries когда все они устаревшие', async () => {
    const db = createTestDatabase();
    const repo = new TranslationCacheRepository(db);
    await repo.upsertByKey({
      cacheKey: 'stale1',
      word: 'a',
      contextWindow: 'a',
      bookLanguage: 'en',
      nativeLanguage: 'ru',
      translation: 'а',
      sentenceTranslation: null,
      translatedWordOffset: null,
      inferenceContext: 'warm',
      modelVersion: 'mv1',
      kernelBuildId: 'old-kernel',
    });
    await repo.upsertByKey({
      cacheKey: 'stale2',
      word: 'b',
      contextWindow: 'b',
      bookLanguage: 'en',
      nativeLanguage: 'ru',
      translation: 'б',
      sentenceTranslation: null,
      translatedWordOffset: null,
      inferenceContext: 'warm',
      modelVersion: 'mv1',
      kernelBuildId: 'other-old-kernel',
    });
    const purged = await purgeStaleKernelEntries(db, 'current-kernel');
    expect(purged).toBe(2);
  });

  it('удаляет entries с null kernel_build_id (старые записи до v2)', async () => {
    const db = createTestDatabase();
    const repo = new TranslationCacheRepository(db);
    await repo.upsertByKey({
      cacheKey: 'nullkey1',
      word: 'old',
      contextWindow: 'old',
      bookLanguage: 'en',
      nativeLanguage: 'ru',
      translation: 'старый',
      sentenceTranslation: null,
      translatedWordOffset: null,
      inferenceContext: 'warm',
      modelVersion: 'mv0',
      kernelBuildId: null,
    });
    const purged = await purgeStaleKernelEntries(db, 'current-kernel');
    expect(purged).toBe(1);
  });
});
