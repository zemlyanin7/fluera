import React from 'react';
import { renderHook, waitFor, act } from '@testing-library/react-native';
import { DatabaseProvider } from '@/db/DatabaseContext';
import { createTestDatabase } from '@/db/testDatabase';
import { BookRepository } from '@/db/repositories/BookRepository';
import { ChapterRepository } from '@/db/repositories/ChapterRepository';
import { ReadingPositionRepository } from '@/db/repositories/ReadingPositionRepository';
import { useReaderEngine } from '../useReaderEngine';

jest.mock('expo-file-system/legacy', () => ({
  documentDirectory: '/mock/',
  EncodingType: { Base64: 'base64' },
  readAsStringAsync: jest.fn(async () => btoa('fake bytes')),
  getInfoAsync: jest.fn(async () => ({ exists: true })),
}));

const fakeParseBook = jest.fn(async () => ({
  title: 'T',
  author: null,
  language: 'en' as const,
  coverId: null,
  chapters: [
    {
      index: 0,
      title: 'Ch1',
      items: [{ type: 'paragraph' as const, inlines: [{ type: 'text' as const, text: 'hi' }] }],
    },
    {
      index: 1,
      title: 'Ch2',
      items: [{ type: 'paragraph' as const, inlines: [{ type: 'text' as const, text: 'second' }] }],
    },
  ],
  footnotes: {},
  images: [],
  totalChars: 8,
}));

async function setupBook(db: Awaited<ReturnType<typeof createTestDatabase>>) {
  const books = new BookRepository(db);
  const chapters = new ChapterRepository(db);
  const book = await books.create({
    title: 'T',
    language: 'en',
    format: 'fb2',
    filePath: '/mock/x.fb2',
    source: 'import',
    totalChars: 10,
  });
  await chapters.bulkCreate(book.id, [
    { title: 'Ch1', orderIndex: 0, startChar: 0, endChar: 4 },
    { title: 'Ch2', orderIndex: 1, startChar: 4, endChar: 10 },
  ]);
  return book;
}

describe('useReaderEngine', () => {
  it('progresses through states to ready', async () => {
    const db = await createTestDatabase();
    const book = await setupBook(db);

    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <DatabaseProvider initialDatabase={db}>{children}</DatabaseProvider>
    );
    const { result } = renderHook(
      () => useReaderEngine(book.id, { parseBook: fakeParseBook }),
      { wrapper },
    );
    await waitFor(() => expect(result.current.state.status).toBe('ready'));
    expect(result.current.state.chapters[0]?.title).toBe('Ch1');
    expect(result.current.state.chapters).toHaveLength(2);
  });

  it('savePosition writes to DB after 500ms debounce', async () => {
    jest.useFakeTimers();
    const db = await createTestDatabase();
    const book = await setupBook(db);
    const positions = new ReadingPositionRepository(db);

    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <DatabaseProvider initialDatabase={db}>{children}</DatabaseProvider>
    );
    const { result } = renderHook(
      () => useReaderEngine(book.id, { parseBook: fakeParseBook }),
      { wrapper },
    );
    // Wait for ready (need to advance any pending microtasks)
    await act(async () => {
      jest.advanceTimersByTime(0);
      await Promise.resolve();
    });
    while (result.current.state.status !== 'ready') {
      await act(async () => {
        await Promise.resolve();
      });
    }

    act(() => result.current.savePosition(0, 100));
    act(() => result.current.savePosition(0, 200));

    // Nothing written yet
    expect(await positions.findByBook(book.id)).toBeNull();

    await act(async () => {
      jest.advanceTimersByTime(500);
      await Promise.resolve();
      await Promise.resolve();
    });

    await waitFor(async () => {
      const p = await positions.findByBook(book.id);
      expect(p?.positionData.value).toBe('200');
    });
    jest.useRealTimers();
  });
});
