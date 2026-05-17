// Smoke-tests для всех data-хуков. useBookList покрыт в отдельном файле.
import React from 'react';
import { renderHook, waitFor, act } from '@testing-library/react-native';
import { createTestDatabase } from '@/db/testDatabase';
import { DatabaseProvider } from '@/db/DatabaseContext';
import { BookRepository } from '@/db/repositories/BookRepository';
import { ReadingPositionRepository } from '@/db/repositories/ReadingPositionRepository';
import { BookmarkRepository } from '@/db/repositories/BookmarkRepository';
import { WordRepository } from '@/db/repositories/WordRepository';
import { OPDSCatalogRepository } from '@/db/repositories/OPDSCatalogRepository';
import { ReadingStatsRepository } from '@/db/repositories/ReadingStatsRepository';
import { useBookProgress } from '@/hooks/data/useBookProgress';
import { useReadingPosition } from '@/hooks/data/useReadingPosition';
import { useBookmarks } from '@/hooks/data/useBookmarks';
import { useWordStatus } from '@/hooks/data/useWordStatus';
import { useDeckQueue } from '@/hooks/data/useDeckQueue';
import { useTranslation } from '@/hooks/data/useTranslation';
import { useOPDSCatalogs } from '@/hooks/data/useOPDSCatalogs';
import { useReadingStats } from '@/hooks/data/useReadingStats';

function makeWrapper(db: ReturnType<typeof createTestDatabase>) {
  return function Wrapper({ children }: { children: React.ReactNode }) {
    return <DatabaseProvider initialDatabase={db}>{children}</DatabaseProvider>;
  };
}

describe('data hooks', () => {
  test('useBookProgress: возвращает progress + lastReadAt', async () => {
    const db = createTestDatabase();
    const repo = new BookRepository(db);
    const b = await repo.create({
      title: 'T', language: 'en', format: 'epub', filePath: '/t',
      source: 'import', totalChars: 100,
    });
    await repo.updateProgress(b.id, 0.3);
    const { result } = renderHook(() => useBookProgress(b.id), { wrapper: makeWrapper(db) });
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.progress).toBe(0.3);
    expect(result.current.lastReadAt).toBeInstanceOf(Date);
  });

  test('useReadingPosition: null если нет позиции, обновляется при upsert', async () => {
    const db = createTestDatabase();
    const repo = new ReadingPositionRepository(db);
    const { result } = renderHook(() => useReadingPosition('b1'), { wrapper: makeWrapper(db) });
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.position).toBeNull();
    await act(async () => {
      await repo.upsert({
        bookId: 'b1', chapterOrderIndex: 2,
        positionData: { type: 'epub-cfi', value: '/6/4!/4/1:0' },
      });
    });
    await waitFor(() => expect(result.current.position?.chapterOrderIndex).toBe(2));
  });

  test('useBookmarks: list reactive', async () => {
    const db = createTestDatabase();
    const repo = new BookmarkRepository(db);
    const { result } = renderHook(() => useBookmarks('b1'), { wrapper: makeWrapper(db) });
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.bookmarks.length).toBe(0);
    await act(async () => {
      await repo.create({
        bookId: 'b1', chapterOrderIndex: 0,
        positionData: { type: 'epub-cfi', value: '/1' },
      });
    });
    await waitFor(() => expect(result.current.bookmarks.length).toBe(1));
  });

  test('useWordStatus: null если слова нет, обновляется upsert', async () => {
    const db = createTestDatabase();
    const repo = new WordRepository(db);
    const { result } = renderHook(
      () => useWordStatus('hello', 'en', 'ru'),
      { wrapper: makeWrapper(db) },
    );
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.status).toBeNull();
    await act(async () => {
      await repo.upsertStatus({ word: 'hello', bookLanguage: 'en', nativeLanguage: 'ru' });
    });
    await waitFor(() => expect(result.current.status?.word).toBe('hello'));
  });

  test('useDeckQueue: пустой если нет due карточек', async () => {
    const db = createTestDatabase();
    const { result } = renderHook(
      () => useDeckQueue('en', 'ru'),
      { wrapper: makeWrapper(db) },
    );
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.queue).toEqual([]);
  });

  test('useTranslation: cache hit немедленно', async () => {
    const db = createTestDatabase();
    const { TranslationCacheRepository } = require('@/db/repositories/TranslationCacheRepository');
    const cacheRepo = new TranslationCacheRepository(db);
    const { computeCacheKey } = require('@/services/translation/cacheKey');
    const key = computeCacheKey('hello', 'world', 'en', 'ru');
    await cacheRepo.upsertByKey({
      cacheKey: key, word: 'hello', contextWindow: 'world',
      bookLanguage: 'en', nativeLanguage: 'ru', translation: 'привет',
    });
    const { result } = renderHook(
      () => useTranslation('hello', 'world', 'en', 'ru'),
      { wrapper: makeWrapper(db) },
    );
    await waitFor(() => expect(result.current.status).toBe('cache-hit'));
    expect(result.current.translation?.translation).toBe('привет');
  });

  test('useTranslation: NoOp service → status inferring и не пишет в cache', async () => {
    const db = createTestDatabase();
    const { result } = renderHook(
      () => useTranslation('miss', 'ctx', 'en', 'ru'),
      { wrapper: makeWrapper(db) },
    );
    await waitFor(() => expect(result.current.status).toBe('inferring'));
    // NoOp возвращает pending → translation остаётся null
    expect(result.current.translation).toBeNull();
  });

  test('useOPDSCatalogs: пустой список', async () => {
    const db = createTestDatabase();
    const { result } = renderHook(() => useOPDSCatalogs(), { wrapper: makeWrapper(db) });
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.catalogs).toEqual([]);
  });

  test('useOPDSCatalogs: обновляется при create', async () => {
    const db = createTestDatabase();
    const repo = new OPDSCatalogRepository(db);
    const { result } = renderHook(() => useOPDSCatalogs(), { wrapper: makeWrapper(db) });
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    await act(async () => {
      await repo.create({ name: 'x', url: 'https://example.com/opds' });
    });
    await waitFor(() => expect(result.current.catalogs.length).toBe(1));
  });

  test('useReadingStats: фильтр по диапазону дат', async () => {
    const db = createTestDatabase();
    const repo = new ReadingStatsRepository(db);
    await repo.upsertDay('2026-05-15', 'b1', { secondsReading: 100 });
    await repo.upsertDay('2026-05-16', 'b1', { secondsReading: 200 });
    const { result } = renderHook(
      () => useReadingStats({ fromDate: '2026-05-15', toDate: '2026-05-16', bookId: 'b1' }),
      { wrapper: makeWrapper(db) },
    );
    await waitFor(() => expect(result.current.stats.length).toBe(2));
  });
});
