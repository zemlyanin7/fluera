import { createTestDatabase } from '@/db/testDatabase';
import { seedBorgesIfEmpty } from '@/db/seed/borges';
import { BookRepository } from '@/db/repositories/BookRepository';
import { ChapterRepository } from '@/db/repositories/ChapterRepository';

describe('seedBorgesIfEmpty', () => {
  test('добавляет Borges если БД пустая', async () => {
    const db = createTestDatabase();
    await seedBorgesIfEmpty(db);
    const books = await new BookRepository(db).list();
    expect(books.length).toBe(1);
    expect(books[0]?.title).toMatch(/Forking Paths/i);
    expect(books[0]?.author).toBe('J. L. Borges');
    expect(books[0]?.language).toBe('en');
    expect(books[0]?.format).toBe('epub');
  });

  test('создаёт chapter I с диапазоном 0..5000', async () => {
    const db = createTestDatabase();
    await seedBorgesIfEmpty(db);
    const books = await new BookRepository(db).list();
    const chapters = await new ChapterRepository(db).listByBook(books[0]!.id);
    expect(chapters.length).toBe(1);
    expect(chapters[0]?.title).toBe('I.');
    expect(chapters[0]?.startChar).toBe(0);
    expect(chapters[0]?.endChar).toBe(5000);
  });

  test('idempotent: не дублирует если книга уже есть', async () => {
    const db = createTestDatabase();
    await seedBorgesIfEmpty(db);
    await seedBorgesIfEmpty(db);
    await seedBorgesIfEmpty(db);
    const books = await new BookRepository(db).list();
    expect(books.length).toBe(1);
  });
});
