// useReaderEngine: React hook обёртка над reducer + side effects.
// Continuous-scroll: после parse кладёт ВСЕ chapters в state.
import { useEffect, useReducer, useCallback, useRef } from 'react';
import { AppState } from 'react-native';
import * as FileSystem from 'expo-file-system/legacy';
import { useDatabase } from '@/db/DatabaseContext';
import { BookRepository } from '@/db/repositories/BookRepository';
import { ChapterRepository } from '@/db/repositories/ChapterRepository';
import { ReadingPositionRepository } from '@/db/repositories/ReadingPositionRepository';
import { base64Decode } from '@/services/parser/shared/base64Decode';
import { createDefaultParserRegistry, type ParsedBook } from '@/services/parser';
import { detectFormatFromBytes } from '@/services/import/detectFormat';
import { readerReducer, initialReaderState, type ReaderState } from './ReaderEngine';

export interface UseReaderEngineOptions {
  parseBook?: (bytes: Uint8Array, filename: string) => Promise<ParsedBook>;
}

export interface UseReaderEngineResult {
  state: ReaderState;
  jumpToChapter: (index: number) => void;
  setCurrentChapter: (index: number) => void;
  /** Save (chapter index + scroll offsetY). Debounced + flush на unmount. */
  savePosition: (chapterIndex: number, offsetY: number) => void;
}

export function useReaderEngine(
  bookId: string,
  opts: UseReaderEngineOptions = {},
): UseReaderEngineResult {
  const db = useDatabase();
  const [state, dispatch] = useReducer(readerReducer, initialReaderState);
  const savePositionTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingPositionRef = useRef<{ chapterIndex: number; offset: number } | null>(null);
  const bookFormatRef = useRef<string | null>(null);

  const parseBook =
    opts.parseBook ??
    (async (bytes, filename) => {
      const format = detectFormatFromBytes(bytes, filename);
      const reg = createDefaultParserRegistry();
      return reg.get(format).parse(bytes);
    });

  // Helper: пишет последнюю pending позицию в БД (fire-and-forget).
  const flushPendingPosition = useCallback(() => {
    const pending = pendingPositionRef.current;
    if (!pending) return;
    pendingPositionRef.current = null;
    const positions = new ReadingPositionRepository(db);
    positions
      .upsert({
        bookId,
        chapterOrderIndex: pending.chapterIndex,
        positionData: {
          type: bookFormatRef.current === 'epub' ? 'epub-cfi' : 'fb2-item',
          value: pending.offset.toString(),
        },
      })
      .then(() => {
        if (__DEV__) console.log('[reader] saved position', pending);
      })
      .catch((e) => {
        console.warn('[reader] flushPendingPosition failed:', e);
      });
  }, [db, bookId]);

  useEffect(() => {
    let cancelled = false;
    dispatch({ type: 'START', bookId });

    (async () => {
      try {
        const books = new BookRepository(db);
        const chapters = new ChapterRepository(db);
        const positions = new ReadingPositionRepository(db);

        const book = await books.findById(bookId);
        if (!book) throw new Error(`Book ${bookId} not found`);
        bookFormatRef.current = book.format;

        const meta = await chapters.listByBook(bookId);
        const pos = await positions.findByBook(bookId);

        const initialChapterIndex = pos?.chapterOrderIndex ?? 0;
        const initialOffset = pos?.positionData?.value
          ? parseInt(pos.positionData.value, 10) || 0
          : 0;

        if (cancelled) return;
        dispatch({
          type: 'BOOK_LOADED',
          book,
          chapterMeta: meta.map((m) => ({ index: m.orderIndex, title: m.title })),
          initialChapterIndex,
          initialOffset,
        });

        const base64 = await FileSystem.readAsStringAsync(book.filePath, {
          encoding: FileSystem.EncodingType.Base64,
        });
        const bytes = base64Decode(base64);
        const parsed = await parseBook(bytes, book.filePath);
        if (cancelled) return;

        if (parsed.totalChars === 0) {
          throw new Error(
            'Книга содержит только изображения (scanned). Текст недоступен для перевода. ' +
              'Удалите её из Library и импортируйте текстовую версию EPUB или FB2.',
          );
        }

        dispatch({ type: 'CHAPTERS_READY', chapters: parsed.chapters });

        // Restore точной позиции — pixel offset. Defer чтобы BookRenderer успел mount.
        if (initialOffset > 0) {
          setTimeout(() => {
            if (!cancelled) dispatch({ type: 'REQUEST_SCROLL_TO_OFFSET', offset: initialOffset });
          }, 50);
        } else if (initialChapterIndex > 0) {
          // Fallback: если только глава известна (старые записи), скроллим к ней.
          setTimeout(() => {
            if (!cancelled) dispatch({ type: 'REQUEST_SCROLL_TO_CHAPTER', index: initialChapterIndex });
          }, 50);
        }
      } catch (e) {
        if (!cancelled) dispatch({ type: 'ERROR', message: (e as Error).message });
      }
    })();

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bookId, db]);

  const jumpToChapter = useCallback((index: number) => {
    dispatch({ type: 'REQUEST_SCROLL_TO_CHAPTER', index });
  }, []);

  const setCurrentChapter = useCallback((index: number) => {
    dispatch({ type: 'SET_CURRENT_CHAPTER', index });
  }, []);

  const savePosition = useCallback(
    (chapterIndex: number, offsetY: number) => {
      pendingPositionRef.current = { chapterIndex, offset: offsetY };
      if (savePositionTimerRef.current) return;
      savePositionTimerRef.current = setTimeout(() => {
        savePositionTimerRef.current = null;
        flushPendingPosition();
      }, 200);
    },
    [flushPendingPosition],
  );

  // Unmount: flush любой pending position перед уходом со screen.
  useEffect(() => {
    return () => {
      if (savePositionTimerRef.current) {
        clearTimeout(savePositionTimerRef.current);
        savePositionTimerRef.current = null;
      }
      flushPendingPosition();
    };
  }, [flushPendingPosition]);

  // AppState: flush при уходе app в background/inactive (iOS swipe-kill не
  // вызывает unmount React, поэтому unmount-cleanup может не сработать).
  useEffect(() => {
    const sub = AppState.addEventListener('change', (next) => {
      if (next === 'background' || next === 'inactive') {
        if (savePositionTimerRef.current) {
          clearTimeout(savePositionTimerRef.current);
          savePositionTimerRef.current = null;
        }
        flushPendingPosition();
      }
    });
    return () => sub.remove();
  }, [flushPendingPosition]);

  return { state, jumpToChapter, setCurrentChapter, savePosition };
}
