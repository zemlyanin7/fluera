import { createTestDatabase } from '@/db/testDatabase';
import { BookRepository } from '../BookRepository';

describe('BookRepository.createWithId', () => {
  it('creates book with caller-supplied id', async () => {
    const db = await createTestDatabase();
    const repo = new BookRepository(db);
    const id = 'fixed-uuid-123';
    const book = await repo.createWithId({
      id,
      title: 'X',
      author: 'Y',
      language: 'en',
      format: 'epub',
      filePath: '/p',
      coverPath: null,
      source: 'import',
      totalChars: 100,
    });
    expect(book.id).toBe(id);
    const found = await repo.findById(id);
    expect(found?.id).toBe(id);
    expect(found?.title).toBe('X');
  });
});
