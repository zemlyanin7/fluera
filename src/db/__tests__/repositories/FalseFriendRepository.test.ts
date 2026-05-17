import { createTestDatabase } from '@/db/testDatabase';
import { FalseFriendRepository } from '@/db/repositories/FalseFriendRepository';

const baseEntry = {
  sourceLang: 'en',
  targetLang: 'ru',
  sourceWord: 'magazine',
  looksLikeNative: 'магазин',
  actualMeaning: 'журнал',
  confidence: 'high' as const,
  domain: 'general',
};

describe('FalseFriendRepository', () => {
  it('lookupByWord hit для known word', async () => {
    const db = createTestDatabase();
    const repo = new FalseFriendRepository(db);
    await repo.bulkInsert([baseEntry]);
    const result = await repo.lookupByWord('en', 'ru', 'magazine');
    expect(result).not.toBeNull();
    expect(result!.actualMeaning).toBe('журнал');
    expect(result!.confidence).toBe('high');
  });

  it('lookupByWord case insensitive', async () => {
    const db = createTestDatabase();
    const repo = new FalseFriendRepository(db);
    await repo.bulkInsert([baseEntry]);
    const result = await repo.lookupByWord('en', 'ru', 'MAGAZINE');
    expect(result).not.toBeNull();
    expect(result!.sourceWord).toBe('magazine');
  });

  it('lookupByWord returns null при miss', async () => {
    const db = createTestDatabase();
    const repo = new FalseFriendRepository(db);
    await repo.bulkInsert([baseEntry]);
    const result = await repo.lookupByWord('en', 'ru', 'unknown_word');
    expect(result).toBeNull();
  });

  it('deleteForPair удаляет только нужную пару', async () => {
    const db = createTestDatabase();
    const repo = new FalseFriendRepository(db);
    await repo.bulkInsert([
      baseEntry,
      { ...baseEntry, sourceLang: 'en', targetLang: 'de', sourceWord: 'gift', looksLikeNative: 'Gift', actualMeaning: 'Geschenk', confidence: 'high' as const },
    ]);
    await repo.deleteForPair('en', 'ru');
    expect(await repo.lookupByWord('en', 'ru', 'magazine')).toBeNull();
    expect(await repo.lookupByWord('en', 'de', 'gift')).not.toBeNull();
  });
});
