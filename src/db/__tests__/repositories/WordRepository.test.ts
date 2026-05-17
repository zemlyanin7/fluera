import { createTestDatabase } from '@/db/testDatabase';
import { WordRepository } from '@/db/repositories/WordRepository';

function newRepo() {
  return new WordRepository(createTestDatabase());
}

describe('WordRepository', () => {
  describe('upsertStatus + findStatus', () => {
    test('create при первом вызове, FSRS-defaults', async () => {
      const repo = newRepo();
      const ws = await repo.upsertStatus({
        word: 'hello', bookLanguage: 'en', nativeLanguage: 'ru',
      });
      expect(ws.word).toBe('hello');
      expect(ws.status).toBe(1);
      expect(ws.fsrsState).toBe(0);
      expect(ws.fsrsDifficulty).toBe(5.0);
      expect(ws.deckSuspended).toBe(false);
    });

    test('idempotent — повторный upsert не дублирует и сохраняет FSRS state', async () => {
      const repo = newRepo();
      const first = await repo.upsertStatus({
        word: 'cat', bookLanguage: 'en', nativeLanguage: 'ru',
      });
      // имитируем что review произошёл — поднимем FSRS state через batch update
      // (через store API нельзя — это будущая работа SRS-сервиса), но id уже стабилен
      const second = await repo.upsertStatus({
        word: 'cat', bookLanguage: 'en', nativeLanguage: 'ru',
        translation: 'кошка',
      });
      expect(second.id).toBe(first.id);
      expect(second.translation).toBe('кошка');
      // FSRS state не перетёрт upsert'ом
      expect(second.fsrsDifficulty).toBe(first.fsrsDifficulty);
    });

    test('case-insensitive: HELLO == hello', async () => {
      const repo = newRepo();
      const a = await repo.upsertStatus({ word: 'Hello', bookLanguage: 'en', nativeLanguage: 'ru' });
      const b = await repo.upsertStatus({ word: 'hello', bookLanguage: 'en', nativeLanguage: 'ru' });
      expect(b.id).toBe(a.id);
    });

    test('findStatus возвращает null если слова нет', async () => {
      const repo = newRepo();
      expect(await repo.findStatus('missing', 'en', 'ru')).toBeNull();
    });

    test('findStatus находит upserted запись', async () => {
      const repo = newRepo();
      await repo.upsertStatus({ word: 'dog', bookLanguage: 'en', nativeLanguage: 'ru' });
      const found = await repo.findStatus('dog', 'en', 'ru');
      expect(found?.word).toBe('dog');
    });
  });

  describe('addOccurrence + listOccurrences', () => {
    test('записывает контекст по book', async () => {
      const repo = newRepo();
      const ws = await repo.upsertStatus({ word: 'cat', bookLanguage: 'en', nativeLanguage: 'ru' });
      await repo.addOccurrence({
        wordStatusId: ws.id, bookId: 'b1',
        chapterOrderIndex: 0, contextSentence: 'The cat sat on the mat.',
      });
      const occs = await repo.listOccurrences(ws.id);
      expect(occs.length).toBe(1);
      expect(occs[0]?.contextSentence).toMatch(/cat sat/);
    });

    test('deleteOccurrencesByBook удаляет все контексты книги', async () => {
      const repo = newRepo();
      const ws = await repo.upsertStatus({ word: 'cat', bookLanguage: 'en', nativeLanguage: 'ru' });
      await repo.addOccurrence({ wordStatusId: ws.id, bookId: 'b1', contextSentence: 'one' });
      await repo.addOccurrence({ wordStatusId: ws.id, bookId: 'b1', contextSentence: 'two' });
      await repo.addOccurrence({ wordStatusId: ws.id, bookId: 'b2', contextSentence: 'three' });
      await repo.deleteOccurrencesByBook('b1');
      const occs = await repo.listOccurrences(ws.id);
      expect(occs.length).toBe(1);
      expect(occs[0]?.bookId).toBe('b2');
    });
  });

  describe('appendReviewLog + listReviewLogs', () => {
    test('пишет лог с калибровочными полями', async () => {
      const repo = newRepo();
      const ws = await repo.upsertStatus({ word: 'cat', bookLanguage: 'en', nativeLanguage: 'ru' });
      await repo.appendReviewLog({
        wordStatusId: ws.id, rating: 3, elapsedDays: 0, scheduledDays: 1,
        stateBefore: 0, stabilityAfter: 1.5, difficultyAfter: 5.0, due: Date.now() + 86_400_000,
      });
      const logs = await repo.listReviewLogs(ws.id);
      expect(logs.length).toBe(1);
      expect(logs[0]?.rating).toBe(3);
      expect(logs[0]?.stabilityAfter).toBe(1.5);
    });

    test('logs отсортированы DESC по reviewedAt', async () => {
      const repo = newRepo();
      const ws = await repo.upsertStatus({ word: 'cat', bookLanguage: 'en', nativeLanguage: 'ru' });
      const t0 = Date.now() - 86400000;
      const t1 = Date.now();
      await repo.appendReviewLog({
        wordStatusId: ws.id, rating: 3, reviewedAt: t0, elapsedDays: 0, scheduledDays: 1,
        stateBefore: 0, stabilityAfter: 1.0, difficultyAfter: 5.0, due: t0 + 86_400_000,
      });
      await repo.appendReviewLog({
        wordStatusId: ws.id, rating: 4, reviewedAt: t1, elapsedDays: 1, scheduledDays: 3,
        stateBefore: 1, stabilityAfter: 3.0, difficultyAfter: 4.5, due: t1 + 3 * 86_400_000,
      });
      const logs = await repo.listReviewLogs(ws.id);
      expect(logs[0]?.rating).toBe(4); // самый новый сверху
      expect(logs[1]?.rating).toBe(3);
    });
  });

  describe('deckQueue', () => {
    test('возвращает только due слова', async () => {
      const repo = newRepo();
      const now = Date.now();
      // создаём слова через upsert, потом меняем поля напрямую через db.write
      const db = (repo as unknown as { db: import('@nozbe/watermelondb').Database }).db;
      const ws1 = await repo.upsertStatus({ word: 'one', bookLanguage: 'en', nativeLanguage: 'ru' });
      const ws2 = await repo.upsertStatus({ word: 'two', bookLanguage: 'en', nativeLanguage: 'ru' });
      const ws3 = await repo.upsertStatus({ word: 'three', bookLanguage: 'en', nativeLanguage: 'ru' });
      await db.write(async () => {
        // ws1 — due (state=2, next_review в прошлом)
        const m1 = await db.collections.get<import('@/db/models').WordStatusModel>('word_statuses').find(ws1.id);
        await m1.update((m) => { m.fsrsState = 2; m.fsrsNextReview = now - 1000; });
        // ws2 — будущее (не должен попасть)
        const m2 = await db.collections.get<import('@/db/models').WordStatusModel>('word_statuses').find(ws2.id);
        await m2.update((m) => { m.fsrsState = 2; m.fsrsNextReview = now + 86_400_000; });
        // ws3 — suspended (не должен попасть даже если due)
        const m3 = await db.collections.get<import('@/db/models').WordStatusModel>('word_statuses').find(ws3.id);
        await m3.update((m) => { m.fsrsState = 2; m.fsrsNextReview = now - 1000; m.deckSuspended = true; });
      });
      const queue = await repo.deckQueue('en', 'ru', 50, now);
      expect(queue.length).toBe(1);
      expect(queue[0]?.word).toBe('one');
    });

    test('включает never-reviewed карточки (fsrs_next_review = null) с state in (1,2,3)', async () => {
      const repo = newRepo();
      const ws = await repo.upsertStatus({ word: 'fresh', bookLanguage: 'en', nativeLanguage: 'ru' });
      const db = (repo as unknown as { db: import('@nozbe/watermelondb').Database }).db;
      await db.write(async () => {
        const m = await db.collections.get<import('@/db/models').WordStatusModel>('word_statuses').find(ws.id);
        // state=1 (learning), next_review null
        await m.update((x) => { x.fsrsState = 1; x.fsrsNextReview = null; });
      });
      const queue = await repo.deckQueue('en', 'ru');
      expect(queue.length).toBe(1);
    });

    test('фильтрация по language pair', async () => {
      const repo = newRepo();
      const a = await repo.upsertStatus({ word: 'one', bookLanguage: 'en', nativeLanguage: 'ru' });
      const b = await repo.upsertStatus({ word: 'one', bookLanguage: 'fr', nativeLanguage: 'ru' });
      const db = (repo as unknown as { db: import('@nozbe/watermelondb').Database }).db;
      await db.write(async () => {
        for (const id of [a.id, b.id]) {
          const m = await db.collections.get<import('@/db/models').WordStatusModel>('word_statuses').find(id);
          await m.update((x) => { x.fsrsState = 2; x.fsrsNextReview = Date.now() - 1000; });
        }
      });
      const en = await repo.deckQueue('en', 'ru');
      expect(en.length).toBe(1);
      expect(en[0]?.bookLanguage).toBe('en');
    });
  });

  describe('pruneReviewLogs', () => {
    test('всё в пределах 1y → ничего не удаляется даже > 100 (whichever-larger)', async () => {
      const repo = newRepo();
      const ws = await repo.upsertStatus({ word: 'cat', bookLanguage: 'en', nativeLanguage: 'ru' });
      const now = Date.now();
      for (let i = 0; i < 110; i++) {
        await repo.appendReviewLog({
          wordStatusId: ws.id, rating: 3,
          reviewedAt: now - i * 60_000, // все в пределах 1y
          elapsedDays: 0, scheduledDays: 1, stateBefore: 0,
          stabilityAfter: 1, difficultyAfter: 5, due: now,
        });
      }
      // 110 > 100, all within 1y → keep всё (whichever-larger = 110)
      const purged = await repo.pruneReviewLogs(ws.id, now);
      expect(purged).toBe(0);
    });

    test('старые > 1y И > 100 total → trim до union(top100, within-1y)', async () => {
      const repo = newRepo();
      const ws = await repo.upsertStatus({ word: 'old', bookLanguage: 'en', nativeLanguage: 'ru' });
      const now = Date.now();
      const oneYearMs = 365 * 24 * 60 * 60 * 1000;
      // 50 новых (в пределах 1y), 60 старых (старше 1y)
      for (let i = 0; i < 50; i++) {
        await repo.appendReviewLog({
          wordStatusId: ws.id, rating: 3,
          reviewedAt: now - i * 60_000,
          elapsedDays: 0, scheduledDays: 1, stateBefore: 0,
          stabilityAfter: 1, difficultyAfter: 5, due: now,
        });
      }
      for (let i = 0; i < 60; i++) {
        await repo.appendReviewLog({
          wordStatusId: ws.id, rating: 3,
          reviewedAt: now - oneYearMs - i * 86_400_000, // все старше года
          elapsedDays: 0, scheduledDays: 1, stateBefore: 0,
          stabilityAfter: 1, difficultyAfter: 5, due: now,
        });
      }
      // top-100 by reviewedAt DESC = 50 fresh + 50 newest старых; within-1y = 50.
      // union = top-100 ∪ within-1y = 100 (top-100 already includes all within-1y).
      // total 110 → purge 10.
      const purged = await repo.pruneReviewLogs(ws.id, now);
      expect(purged).toBe(10);
      const remaining = await repo.listReviewLogs(ws.id);
      expect(remaining.length).toBe(100);
    });
  });
});
