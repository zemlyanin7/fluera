import * as FileSystem from 'expo-file-system/legacy';
import { createTestDatabase } from '@/db/testDatabase';
import { BookRepository } from '@/db/repositories/BookRepository';
import { pruneOrphanedBookDirs } from '../orphanedCleanup';

jest.mock('expo-file-system/legacy', () => ({
  documentDirectory: '/mock/',
  readDirectoryAsync: jest.fn(async () => ['validBook', 'orphan-1', 'orphan-2']),
  deleteAsync: jest.fn(async () => {}),
}));

describe('pruneOrphanedBookDirs', () => {
  beforeEach(() => jest.clearAllMocks());

  it('deletes dirs without DB record', async () => {
    const db = await createTestDatabase();
    const books = new BookRepository(db);
    await books.createWithId({
      id: 'validBook',
      title: 'V',
      language: 'en',
      format: 'epub',
      filePath: '/mock/books/validBook/source.epub',
      source: 'import',
      totalChars: 0,
    });

    const pruned = await pruneOrphanedBookDirs(db);
    expect(pruned).toBe(2);
    expect(FileSystem.deleteAsync).toHaveBeenCalledWith('/mock/books/orphan-1', {
      idempotent: true,
    });
    expect(FileSystem.deleteAsync).toHaveBeenCalledWith('/mock/books/orphan-2', {
      idempotent: true,
    });
  });

  it('skips _tmp directory', async () => {
    (FileSystem.readDirectoryAsync as jest.Mock).mockResolvedValueOnce(['_tmp', 'orphan-1']);
    const db = await createTestDatabase();
    await pruneOrphanedBookDirs(db);
    const calls = (FileSystem.deleteAsync as jest.Mock).mock.calls;
    for (const c of calls) {
      expect(c[0]).not.toContain('_tmp');
    }
  });
});
