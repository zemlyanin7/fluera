// Reader engine state machine. См. spec §2.5, §4.3, §8.
import type { BookRecord } from '@/db/repositories/BookRepository';
import type { BookChapter } from '@/types/content';

export interface ReaderState {
  book: BookRecord | null;
  chapterMeta: Array<{ index: number; title: string | null }>;
  currentChapterIndex: number;
  currentChapter: BookChapter | null;
  initialOffset: number;
  status: 'idle' | 'loading' | 'parsing' | 'ready' | 'error';
  error: string | null;
}

export const initialReaderState: ReaderState = {
  book: null,
  chapterMeta: [],
  currentChapterIndex: 0,
  currentChapter: null,
  initialOffset: 0,
  status: 'idle',
  error: null,
};

export type ReaderAction =
  | { type: 'START'; bookId: string }
  | {
      type: 'BOOK_LOADED';
      book: BookRecord;
      chapterMeta: Array<{ index: number; title: string | null }>;
      initialChapterIndex: number;
      initialOffset: number;
    }
  | { type: 'CHAPTER_READY'; chapter: BookChapter }
  | { type: 'SET_CHAPTER_INDEX'; index: number }
  | { type: 'ERROR'; message: string };

export function readerReducer(state: ReaderState, action: ReaderAction): ReaderState {
  switch (action.type) {
    case 'START':
      return { ...initialReaderState, status: 'loading' };
    case 'BOOK_LOADED':
      return {
        ...state,
        book: action.book,
        chapterMeta: action.chapterMeta,
        currentChapterIndex: action.initialChapterIndex,
        initialOffset: action.initialOffset,
        status: 'parsing',
      };
    case 'CHAPTER_READY':
      return { ...state, currentChapter: action.chapter, status: 'ready' };
    case 'SET_CHAPTER_INDEX':
      return {
        ...state,
        currentChapterIndex: action.index,
        initialOffset: 0,
        currentChapter: null,
        status: 'parsing',
      };
    case 'ERROR':
      return { ...state, status: 'error', error: action.message };
  }
}
