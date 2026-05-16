import type { BookRecord } from '@/db/repositories/BookRepository';
import { readerReducer, initialReaderState } from '../ReaderEngine';

const fakeBook = { id: 'b1', title: 'X' } as BookRecord;

describe('readerReducer', () => {
  it('moves to loading on START', () => {
    const s = readerReducer(initialReaderState, { type: 'START', bookId: 'b1' });
    expect(s.status).toBe('loading');
  });

  it('captures book on BOOK_LOADED', () => {
    const s = readerReducer(initialReaderState, {
      type: 'BOOK_LOADED',
      book: fakeBook,
      chapterMeta: [{ index: 0, title: 'Ch1' }],
      initialChapterIndex: 0,
      initialOffset: 0,
    });
    expect(s.book?.id).toBe('b1');
    expect(s.status).toBe('parsing');
  });

  it('captures chapters on CHAPTERS_READY', () => {
    const s = readerReducer(
      { ...initialReaderState, status: 'parsing' },
      {
        type: 'CHAPTERS_READY',
        chapters: [
          { index: 0, title: null, items: [] },
          { index: 1, title: 'Ch2', items: [] },
        ],
      },
    );
    expect(s.chapters).toHaveLength(2);
    expect(s.status).toBe('ready');
  });

  it('captures error', () => {
    const s = readerReducer(initialReaderState, { type: 'ERROR', message: 'boom' });
    expect(s.status).toBe('error');
    expect(s.error).toBe('boom');
  });

  it('updates current chapter via SET_CURRENT_CHAPTER', () => {
    const s = readerReducer(
      { ...initialReaderState, status: 'ready', currentChapterIndex: 0 },
      { type: 'SET_CURRENT_CHAPTER', index: 2 },
    );
    expect(s.currentChapterIndex).toBe(2);
  });

  it('emits scroll-to-chapter request on REQUEST_SCROLL_TO_CHAPTER', () => {
    const s = readerReducer(
      { ...initialReaderState, status: 'ready' },
      { type: 'REQUEST_SCROLL_TO_CHAPTER', index: 5 },
    );
    expect(s.scrollToChapterRequest?.index).toBe(5);
    expect(s.currentChapterIndex).toBe(5);
  });

  it('emits scroll-to-offset request on REQUEST_SCROLL_TO_OFFSET', () => {
    const s = readerReducer(
      { ...initialReaderState, status: 'ready' },
      { type: 'REQUEST_SCROLL_TO_OFFSET', offset: 1234 },
    );
    expect(s.scrollToOffsetRequest?.offset).toBe(1234);
  });
});
