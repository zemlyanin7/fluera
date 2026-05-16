// useReaderEngine: React hook обёртка над reducer + side effects.
// См. spec §8.1, §8.3.
import { useEffect, useReducer, useCallback, useRef } from 'react';
import * as FileSystem from 'expo-file-system/legacy';
import { useDatabase } from '@/db/DatabaseContext';
import { BookRepository } from '@/db/repositories/BookRepository';
import { ChapterRepository } from '@/db/repositories/ChapterRepository';
import { ReadingPositionRepository } from '@/db/repositories/ReadingPositionRepository';
import { base64Decode } from '@/services/parser/shared/base64Decode';
import { createDefaultParserRegistry, type ParsedBook } from '@/services/parser';
import { detectFormatFromBytes } from '@/services/import/detectFormat';
import { readerReducer, initialReaderState } from './ReaderEngine';

export interface UseReaderEngineOptions {
  /** Test injection: кастомный парсер. По дефолту — createDefaultParserRegistry. */
  parseBook?: (bytes: Uint8Array, filename: string) => Promise<ParsedBook>;
}

export interface UseReaderEngineResult {
  state: ReturnType<typeof readerReducer>;
  setChapter: (index: number) => void;
  savePosition: (characterOffset: number) => void;
}

export function useReaderEngine(
  bookId: string,
  opts: UseReaderEngineOptions = {},
): UseReaderEngineResult {
  const db = useDatabase();
  const [state, dispatch] = useReducer(readerReducer, initialReaderState);
  const parsedBookRef = useRef<ParsedBook | null>(null);
  const savePositionTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingOffsetRef = useRef<number>(0);

  const parseBook =
    opts.parseBook ??
    (async (bytes, filename) => {
      const format = detectFormatFromBytes(bytes, filename);
      const reg = createDefaultParserRegistry();
      return reg.get(format).parse(bytes);
    });

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

        parsedBookRef.current = parsed;
        const target = parsed.chapters[initialChapterIndex] ?? parsed.chapters[0];
        if (target) dispatch({ type: 'CHAPTER_READY', chapter: target });
      } catch (e) {
        if (!cancelled) dispatch({ type: 'ERROR', message: (e as Error).message });
      }
    })();

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bookId, db]);

  // Switch chapter — берёт уже распарсенную книгу из ref.
  const setChapter = useCallback(
    (index: number) => {
      dispatch({ type: 'SET_CHAPTER_INDEX', index });
      const parsed = parsedBookRef.current;
      if (!parsed) return;
      const target = parsed.chapters[index];
      if (target) {
        // Микро-defer чтобы reducer успел применить SET_CHAPTER_INDEX
        Promise.resolve().then(() => dispatch({ type: 'CHAPTER_READY', chapter: target }));
      }
    },
    [],
  );

  // Debounced position save (500ms). При unmount — clearTimeout.
  const savePosition = useCallback(
    (characterOffset: number) => {
      pendingOffsetRef.current = characterOffset;
      if (savePositionTimerRef.current) return;
      savePositionTimerRef.current = setTimeout(async () => {
        const positions = new ReadingPositionRepository(db);
        try {
          await positions.upsert({
            bookId,
            chapterOrderIndex: state.currentChapterIndex,
            positionData: {
              type: state.book?.format === 'epub' ? 'epub-cfi' : 'fb2-item',
              value: pendingOffsetRef.current.toString(),
            },
          });
        } catch (e) {
          console.warn('savePosition failed:', e);
        }
        savePositionTimerRef.current = null;
      }, 500);
    },
    [db, bookId, state.currentChapterIndex, state.book?.format],
  );

  useEffect(() => {
    return () => {
      if (savePositionTimerRef.current) {
        clearTimeout(savePositionTimerRef.current);
        savePositionTimerRef.current = null;
      }
    };
  }, []);

  return { state, setChapter, savePosition };
}
