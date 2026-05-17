import { createTestDatabase } from '@/db/testDatabase';
import { ChapterRepository } from '../ChapterRepository';
import { BookRepository } from '../BookRepository';

describe('ChapterRepository.bulkCreate', () => {
  it('creates multiple chapters in one transaction', async () => {
    const db = await createTestDatabase();
    const books = new BookRepository(db);
    const chapters = new ChapterRepository(db);
    const book = await books.create({
      title: 'B',
      language: 'en',
      format: 'epub',
      filePath: '/p',
      source: 'import',
      totalChars: 100,
    });
    await chapters.bulkCreate(book.id, [
      { title: 'One', orderIndex: 0, startChar: 0, endChar: 50 },
      { title: 'Two', orderIndex: 1, startChar: 50, endChar: 100 },
    ]);
    const list = await chapters.listByBook(book.id);
    expect(list).toHaveLength(2);
    expect(list[0]?.title).toBe('One');
    expect(list[1]?.startChar).toBe(50);
  });
});
