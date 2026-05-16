// Reader engine state machine. См. spec §2.5, §4.3, §8.
import type { BookRecord } from '@/db/repositories/BookRepository';
import type { BookChapter } from '@/types/content';

export interface ReaderState {
  book: BookRecord | null;
  chapters: BookChapter[];
  chapterMeta: { index: number; title: string | null }[];
  /** Индекс главы, в которой пользователь сейчас (для TopBar/TOC highlight). */
  currentChapterIndex: number;
  /** Сохранённый pixel-offset для scroll-restore. */
  initialOffset: number;
  /** TOC tap: скроллить к chapter-marker. */
  scrollToChapterRequest: { index: number; token: number } | null;
  /** Initial restore: скроллить к exact pixel offset. */
  scrollToOffsetRequest: { offset: number; token: number } | null;
  status: 'idle' | 'loading' | 'parsing' | 'ready' | 'error';
  error: string | null;
}

export const initialReaderState: ReaderState = {
  book: null,
  chapters: [],
  chapterMeta: [],
  currentChapterIndex: 0,
  initialOffset: 0,
  scrollToChapterRequest: null,
  scrollToOffsetRequest: null,
  status: 'idle',
  error: null,
};

export type ReaderAction =
  | { type: 'START'; bookId: string }
  | {
      type: 'BOOK_LOADED';
      book: BookRecord;
      chapterMeta: { index: number; title: string | null }[];
      initialChapterIndex: number;
      initialOffset: number;
    }
  | { type: 'CHAPTERS_READY'; chapters: BookChapter[] }
  | { type: 'SET_CURRENT_CHAPTER'; index: number }
  | { type: 'REQUEST_SCROLL_TO_CHAPTER'; index: number }
  | { type: 'REQUEST_SCROLL_TO_OFFSET'; offset: number }
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
    case 'CHAPTERS_READY':
      return { ...state, chapters: action.chapters, status: 'ready' };
    case 'SET_CURRENT_CHAPTER':
      if (state.currentChapterIndex === action.index) return state;
      return { ...state, currentChapterIndex: action.index };
    case 'REQUEST_SCROLL_TO_CHAPTER':
      return {
        ...state,
        scrollToChapterRequest: { index: action.index, token: Date.now() },
        currentChapterIndex: action.index,
      };
    case 'REQUEST_SCROLL_TO_OFFSET':
      return {
        ...state,
        scrollToOffsetRequest: { offset: action.offset, token: Date.now() },
      };
    case 'ERROR':
      return { ...state, status: 'error', error: action.message };
  }
}
