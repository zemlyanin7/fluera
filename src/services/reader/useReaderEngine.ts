// useReaderEngine: React hook обёртка над reducer + side effects.
// Continuous-scroll: после parse кладёт ВСЕ chapters в state.
import { useEffect, useReducer, useCallback, useRef } from 'react';
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
  /** Scroll-jump к chapter (из TOC). */
  jumpToChapter: (index: number) => void;
  /** Обновить currentChapterIndex (вызывает BookRenderer onViewableItemsChanged). */
  setCurrentChapter: (index: number) => void;
  /** Debounced save позиции (chapter index + offset within chapter). */
  savePosition: (chapterIndex: number, characterOffset: number) => void;
}

export function useReaderEngine(
  bookId: string,
  opts: UseReaderEngineOptions = {},
): UseReaderEngineResult {
  const db = useDatabase();
  const [state, dispatch] = useReducer(readerReducer, initialReaderState);
  const savePositionTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingPositionRef = useRef<{ chapterIndex: number; offset: number }>({
    chapterIndex: 0,
    offset: 0,
  });
  const bookFormatRef = useRef<string | null>(null);

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
    (chapterIndex: number, characterOffset: number) => {
      pendingPositionRef.current = { chapterIndex, offset: characterOffset };
      if (savePositionTimerRef.current) return;
      savePositionTimerRef.current = setTimeout(async () => {
        const positions = new ReadingPositionRepository(db);
        const { chapterIndex: ci, offset } = pendingPositionRef.current;
        try {
          await positions.upsert({
            bookId,
            chapterOrderIndex: ci,
            positionData: {
              type: bookFormatRef.current === 'epub' ? 'epub-cfi' : 'fb2-item',
              value: offset.toString(),
            },
          });
        } catch (e) {
          console.warn('savePosition failed:', e);
        }
        savePositionTimerRef.current = null;
      }, 500);
    },
    [db, bookId],
  );

  useEffect(() => {
    return () => {
      if (savePositionTimerRef.current) {
        clearTimeout(savePositionTimerRef.current);
        savePositionTimerRef.current = null;
      }
    };
  }, []);

  return { state, jumpToChapter, setCurrentChapter, savePosition };
}
