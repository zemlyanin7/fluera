import React from 'react';
import { renderHook, waitFor, act } from '@testing-library/react-native';
import { createTestDatabase } from '@/db/testDatabase';
import { DatabaseProvider } from '@/db/DatabaseContext';
import { BookRepository } from '@/db/repositories/BookRepository';
import { useBookList } from '@/hooks/data/useBookList';

function wrapper(db: ReturnType<typeof createTestDatabase>) {
  return function Wrapper({ children }: { children: React.ReactNode }) {
    return <DatabaseProvider initialDatabase={db}>{children}</DatabaseProvider>;
  };
}

describe('useBookList', () => {
  test('возвращает books после mount', async () => {
    const db = createTestDatabase();
    const repo = new BookRepository(db);
    await repo.create({
      title: 'A', language: 'en', format: 'epub', filePath: '/a',
      source: 'import', totalChars: 1,
    });
    const { result } = renderHook(() => useBookList(), { wrapper: wrapper(db) });
    await waitFor(() => expect(result.current.books.length).toBe(1));
    expect(result.current.isLoading).toBe(false);
  });

  test('пустой результат если книг нет', async () => {
    const db = createTestDatabase();
    const { result } = renderHook(() => useBookList(), { wrapper: wrapper(db) });
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.books).toEqual([]);
  });

  test('обновляется при insert (реактивность)', async () => {
    const db = createTestDatabase();
    const repo = new BookRepository(db);
    const { result } = renderHook(() => useBookList(), { wrapper: wrapper(db) });
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.books.length).toBe(0);
    await act(async () => {
      await repo.create({
        title: 'New', language: 'en', format: 'epub',
        filePath: '/n', source: 'import', totalChars: 100,
      });
    });
    await waitFor(() => expect(result.current.books.length).toBe(1));
  });

  test('фильтр language применяется', async () => {
    const db = createTestDatabase();
    const repo = new BookRepository(db);
    await repo.create({ title: 'A', language: 'en', format: 'epub', filePath: '/a', source: 'import', totalChars: 1 });
    await repo.create({ title: 'B', language: 'ru', format: 'epub', filePath: '/b', source: 'import', totalChars: 1 });
    const { result } = renderHook(() => useBookList({ language: 'en' }), { wrapper: wrapper(db) });
    await waitFor(() => expect(result.current.books.length).toBe(1));
    expect(result.current.books[0]?.title).toBe('A');
  });
});
