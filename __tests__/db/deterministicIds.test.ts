import {
  wordStatusId, readingStatsId, readingPositionId, ALL_BOOKS_SENTINEL,
} from '@/db/deterministicIds';

describe('deterministicIds', () => {
  test('wordStatusId: детерминированный SHA-256 truncate 16', async () => {
    const a = await wordStatusId('hello', 'en', 'ru');
    const b = await wordStatusId('hello', 'en', 'ru');
    expect(a).toBe(b);
    expect(a.length).toBe(16);
    expect(a).toMatch(/^[0-9a-f]{16}$/);
  });

  test('wordStatusId: case-insensitive по word', async () => {
    expect(await wordStatusId('Hello', 'en', 'ru'))
      .toBe(await wordStatusId('hello', 'en', 'ru'));
  });

  test('wordStatusId: разные natural keys → разные ID', async () => {
    const a = await wordStatusId('hello', 'en', 'ru');
    const b = await wordStatusId('hello', 'en', 'es');
    const c = await wordStatusId('world', 'en', 'ru');
    expect(a).not.toBe(b);
    expect(a).not.toBe(c);
  });

  test('readingPositionId: совпадает с book_id', () => {
    expect(readingPositionId('book-123')).toBe('book-123');
  });

  test('readingStatsId: date__bookId', () => {
    expect(readingStatsId('2026-05-16', 'book-1')).toBe('2026-05-16__book-1');
  });

  test('readingStatsId: null bookId → __all__ sentinel', () => {
    expect(readingStatsId('2026-05-16', null)).toBe('2026-05-16____all__');
  });

  test('ALL_BOOKS_SENTINEL экспортирован как "__all__"', () => {
    expect(ALL_BOOKS_SENTINEL).toBe('__all__');
  });
});
