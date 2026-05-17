import { createTestDatabase } from '@/db/testDatabase';
import { pruneBrokenSeedRecords } from '@/db/seed/borges';
import { BookRepository } from '@/db/repositories/BookRepository';

describe('pruneBrokenSeedRecords', () => {
  test('deletes books with filePath under /dev/null', async () => {
    const db = createTestDatabase();
    const repo = new BookRepository(db);
    await repo.create({
      title: 'Broken seed',
      author: null,
      language: 'en',
      format: 'epub',
      filePath: '/dev/null/borges.epub',
      source: 'import',
      totalChars: 0,
    });
    await repo.create({
      title: 'Real book',
      author: null,
      language: 'en',
      format: 'epub',
      filePath: '/var/mobile/.../source.epub',
      source: 'import',
      totalChars: 100,
    });
    const pruned = await pruneBrokenSeedRecords(db);
    expect(pruned).toBe(1);
    const remaining = await repo.list();
    expect(remaining).toHaveLength(1);
    expect(remaining[0]?.title).toBe('Real book');
  });

  test('returns 0 when no broken records', async () => {
    const db = createTestDatabase();
    expect(await pruneBrokenSeedRecords(db)).toBe(0);
  });

  test('idempotent', async () => {
    const db = createTestDatabase();
    const repo = new BookRepository(db);
    await repo.create({
      title: 'X',
      language: 'en',
      format: 'epub',
      filePath: '/dev/null/x.epub',
      source: 'import',
      totalChars: 0,
    });
    expect(await pruneBrokenSeedRecords(db)).toBe(1);
    expect(await pruneBrokenSeedRecords(db)).toBe(0);
  });
});
