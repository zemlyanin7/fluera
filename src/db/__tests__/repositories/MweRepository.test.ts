import { createTestDatabase } from '@/db/testDatabase';
import { MweRepository } from '@/db/repositories/MweRepository';

describe('MweRepository', () => {
  it('bulkInsert + findForPair возвращает entries для (src, dst)', async () => {
    const db = createTestDatabase();
    const repo = new MweRepository(db);
    await repo.bulkInsert([
      {
        sourceLang: 'en',
        targetLang: 'ru',
        phrase: 'kick the bucket',
        translationEquivalent: 'сыграть в ящик',
        literalGloss: 'ударить ведро',
        mweType: 'idiom',
        gapPattern: null,
        domain: 'general',
        attribution: 'wiktionary',
      },
    ]);
    const rows = await repo.findForPair('en', 'ru');
    expect(rows).toHaveLength(1);
    expect(rows[0]!.phrase).toBe('kick the bucket');
  });

  it('findForPair возвращает пустой массив для неизвестной пары', async () => {
    const db = createTestDatabase();
    const repo = new MweRepository(db);
    const rows = await repo.findForPair('fr', 'de');
    expect(rows).toHaveLength(0);
  });

  it('deleteForPair удаляет только нужную пару', async () => {
    const db = createTestDatabase();
    const repo = new MweRepository(db);
    await repo.bulkInsert([
      {
        sourceLang: 'en',
        targetLang: 'ru',
        phrase: 'kick the bucket',
        translationEquivalent: 'сыграть в ящик',
        literalGloss: null,
        mweType: 'idiom',
        gapPattern: null,
        domain: 'general',
        attribution: null,
      },
      {
        sourceLang: 'en',
        targetLang: 'de',
        phrase: 'break a leg',
        translationEquivalent: 'Hals und Beinbruch',
        literalGloss: null,
        mweType: 'idiom',
        gapPattern: null,
        domain: 'general',
        attribution: null,
      },
    ]);
    await repo.deleteForPair('en', 'ru');
    expect(await repo.findForPair('en', 'ru')).toHaveLength(0);
    expect(await repo.findForPair('en', 'de')).toHaveLength(1);
  });
});
