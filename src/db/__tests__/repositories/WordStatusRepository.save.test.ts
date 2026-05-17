import { createTestDatabase } from '@/db/testDatabase';
import { WordStatusRepository } from '@/db/repositories/WordStatusRepository';

describe('WordStatusRepository.save/unsave', () => {
  it('save устанавливает savedToDeck=true и savedAt=current ms', async () => {
    const db = createTestDatabase();
    const repo = new WordStatusRepository(db);
    const now = Date.now();
    await repo.save({ word: 'spring', bookLanguage: 'en' });
    const ws = await repo.findByWordAndLang('spring', 'en');
    expect(ws).not.toBeNull();
    expect(ws!.savedToDeck).toBe(true);
    expect(ws!.savedAt).toBeGreaterThanOrEqual(now);
  });

  it('unsave сбрасывает savedToDeck=false и savedAt=null', async () => {
    const db = createTestDatabase();
    const repo = new WordStatusRepository(db);
    await repo.save({ word: 'spring', bookLanguage: 'en' });
    await repo.unsave({ word: 'spring', bookLanguage: 'en' });
    const ws = await repo.findByWordAndLang('spring', 'en');
    expect(ws!.savedToDeck).toBe(false);
    expect(ws!.savedAt).toBeNull();
  });
});
