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

  it('captures chapter on CHAPTER_READY', () => {
    const s = readerReducer(
      { ...initialReaderState, status: 'parsing' },
      { type: 'CHAPTER_READY', chapter: { index: 0, title: null, items: [] } },
    );
    expect(s.currentChapter).not.toBeNull();
    expect(s.status).toBe('ready');
  });

  it('captures error', () => {
    const s = readerReducer(initialReaderState, { type: 'ERROR', message: 'boom' });
    expect(s.status).toBe('error');
    expect(s.error).toBe('boom');
  });

  it('switches chapter via SET_CHAPTER_INDEX', () => {
    const s = readerReducer(
      { ...initialReaderState, status: 'ready', currentChapterIndex: 0 },
      { type: 'SET_CHAPTER_INDEX', index: 2 },
    );
    expect(s.currentChapterIndex).toBe(2);
    expect(s.initialOffset).toBe(0);
    expect(s.currentChapter).toBeNull();
    expect(s.status).toBe('parsing');
  });
});
