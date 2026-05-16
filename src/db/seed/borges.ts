// Borges sample book — dev-only seed для пустой БД. Idempotent.
// Запускается из createDatabase() только при __DEV__ + ENV != '0'.
import { Database } from '@nozbe/watermelondb';
import { BookRepository } from '@/db/repositories/BookRepository';
import { ChapterRepository } from '@/db/repositories/ChapterRepository';

const BORGES_TITLE = 'The Garden of Forking Paths';

export async function seedBorgesIfEmpty(db: Database): Promise<void> {
  const books = new BookRepository(db);
  const existing = await books.list();
  if (existing.length > 0) return;
  const book = await books.create({
    title: BORGES_TITLE,
    author: 'J. L. Borges',
    language: 'en',
    format: 'epub',
    filePath: '/dev/null/borges.epub',
    source: 'import',
    totalChars: 5000,
  });
  const chapters = new ChapterRepository(db);
  await chapters.create({
    bookId: book.id,
    title: 'I.',
    orderIndex: 0,
    startChar: 0,
    endChar: 5000,
  });
}
