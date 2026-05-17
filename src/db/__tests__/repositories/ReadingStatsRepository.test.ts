import { createTestDatabase } from '@/db/testDatabase';
import { ReadingStatsRepository } from '@/db/repositories/ReadingStatsRepository';

function newRepo() {
  return new ReadingStatsRepository(createTestDatabase());
}

describe('ReadingStatsRepository', () => {
  test('upsertDay: create при первом вызове', async () => {
    const repo = newRepo();
    const r = await repo.upsertDay('2026-05-16', 'b1', { secondsReading: 120, wordsRead: 50 });
    expect(r.id).toBe('2026-05-16__b1');
    expect(r.secondsReading).toBe(120);
    expect(r.wordsRead).toBe(50);
    expect(r.wordsTranslated).toBe(0);
  });

  test('upsertDay: повторный вызов инкрементирует', async () => {
    const repo = newRepo();
    await repo.upsertDay('2026-05-16', 'b1', { secondsReading: 100 });
    const r = await repo.upsertDay('2026-05-16', 'b1', { secondsReading: 50, wordsTranslated: 3 });
    expect(r.secondsReading).toBe(150);
    expect(r.wordsTranslated).toBe(3);
  });

  test('upsertDay: bookId=null → sentinel "__all__"', async () => {
    const repo = newRepo();
    const r = await repo.upsertDay('2026-05-16', null, { wordsRead: 10 });
    expect(r.id).toBe('2026-05-16____all__');
    expect(r.bookId).toBe('__all__');
  });

  test('upsertDay: разные books не смешиваются', async () => {
    const repo = newRepo();
    await repo.upsertDay('2026-05-16', 'b1', { secondsReading: 100 });
    await repo.upsertDay('2026-05-16', 'b2', { secondsReading: 200 });
    expect((await repo.getDay('2026-05-16', 'b1'))?.secondsReading).toBe(100);
    expect((await repo.getDay('2026-05-16', 'b2'))?.secondsReading).toBe(200);
  });

  test('getDay returns null если записи нет', async () => {
    const repo = newRepo();
    expect(await repo.getDay('2026-01-01', 'b1')).toBeNull();
  });

  test('listForDateRange фильтрует по диапазону', async () => {
    const repo = newRepo();
    await repo.upsertDay('2026-05-14', 'b1', { wordsRead: 10 });
    await repo.upsertDay('2026-05-15', 'b1', { wordsRead: 20 });
    await repo.upsertDay('2026-05-16', 'b1', { wordsRead: 30 });
    const r = await repo.listForDateRange('2026-05-15', '2026-05-16', 'b1');
    expect(r.length).toBe(2);
    expect(r.map((s) => s.wordsRead)).toEqual([20, 30]); // sortBy date ASC
  });

  test('listForDateRange без bookId — все книги', async () => {
    const repo = newRepo();
    await repo.upsertDay('2026-05-16', 'b1', { wordsRead: 10 });
    await repo.upsertDay('2026-05-16', 'b2', { wordsRead: 20 });
    await repo.upsertDay('2026-05-16', null, { wordsRead: 30 });
    const r = await repo.listForDateRange('2026-05-16', '2026-05-16');
    expect(r.length).toBe(3);
  });

  test('clearAll', async () => {
    const repo = newRepo();
    await repo.upsertDay('2026-05-16', 'b1', { wordsRead: 10 });
    await repo.upsertDay('2026-05-16', null, { wordsRead: 20 });
    expect(await repo.clearAll()).toBe(2);
    expect(await repo.getDay('2026-05-16', 'b1')).toBeNull();
  });
});
