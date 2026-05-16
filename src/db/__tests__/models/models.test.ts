import { createTestDatabase } from '@/db/testDatabase';
import {
  BookModel, ChapterModel, ReadingPositionModel, BookmarkModel,
  WordStatusModel, WordOccurrenceModel, ReviewLogModel,
  TranslationCacheModel, OPDSCatalogModel, ReadingStatsModel,
} from '@/db/models';

describe('Models', () => {
  test('table names совпадают со схемой', () => {
    expect(BookModel.table).toBe('books');
    expect(ChapterModel.table).toBe('chapters');
    expect(ReadingPositionModel.table).toBe('reading_positions');
    expect(BookmarkModel.table).toBe('bookmarks');
    expect(WordStatusModel.table).toBe('word_statuses');
    expect(WordOccurrenceModel.table).toBe('word_occurrences');
    expect(ReviewLogModel.table).toBe('review_logs');
    expect(TranslationCacheModel.table).toBe('translation_cache');
    expect(OPDSCatalogModel.table).toBe('opds_catalogs');
    expect(ReadingStatsModel.table).toBe('reading_stats');
  });

  test('BookModel: create через write — поля корректно записываются', async () => {
    const db = createTestDatabase();
    const now = Date.now();
    const book = await db.write(async () =>
      db.collections.get<BookModel>('books').create((b) => {
        b.title = 'Forking Paths';
        b.author = 'J. L. Borges';
        b.language = 'en';
        b.format = 'epub';
        b.filePath = '/tmp/borges.epub';
        b.coverPath = null;
        b.source = 'import';
        b.opdsCatalogId = null;
        b.totalChars = 5000;
        b.progress = 0;
        b.difficulty = null;
        b.difficultyComputedAt = null;
        b.addedAt = now;
        b.lastReadAt = null;
        b.archived = false;
      }),
    );
    expect(book.title).toBe('Forking Paths');
    expect(book.language).toBe('en');
    expect(book.totalChars).toBe(5000);
    expect(book.archived).toBe(false);
  });

  test('WordStatusModel: создание с FSRS-defaults', async () => {
    const db = createTestDatabase();
    const ws = await db.write(async () =>
      db.collections.get<WordStatusModel>('word_statuses').create((w) => {
        w.word = 'forking';
        w.bookLanguage = 'en';
        w.nativeLanguage = 'ru';
        w.status = 1; // new
        w.translation = '';
        w.grammarNote = null;
        w.fsrsState = 0; // New per ts-fsrs
        w.fsrsDifficulty = 5.0;
        w.fsrsStability = 0;
        w.fsrsReps = 0;
        w.fsrsLapses = 0;
        w.fsrsLastReview = null;
        w.fsrsNextReview = null;
        w.fsrsElapsedDays = 0;
        w.fsrsScheduledDays = 0;
        w.deckSuspended = false;
        w.deckPriority = 0;
        w.createdAt = Date.now();
        w.updatedAt = Date.now();
      }),
    );
    expect(ws.word).toBe('forking');
    expect(ws.fsrsState).toBe(0);
    expect(ws.fsrsDifficulty).toBe(5.0);
    expect(ws.deckSuspended).toBe(false);
  });

  test('ReviewLogModel: создание с калибровочными полями', async () => {
    const db = createTestDatabase();
    const log = await db.write(async () =>
      db.collections.get<ReviewLogModel>('review_logs').create((r) => {
        r.wordStatusId = 'ws-1';
        r.rating = 3; // good
        r.reviewedAt = Date.now();
        r.elapsedDays = 0;
        r.scheduledDays = 1;
        r.stateBefore = 0;
        r.stabilityAfter = 1.5;
        r.difficultyAfter = 5.0;
        r.due = Date.now() + 86_400_000;
      }),
    );
    expect(log.rating).toBe(3);
    expect(log.stabilityAfter).toBe(1.5);
  });

  test('ReadingStatsModel: book_id sentinel "__all__"', async () => {
    const db = createTestDatabase();
    const stat = await db.write(async () =>
      db.collections.get<ReadingStatsModel>('reading_stats').create((s) => {
        s.date = '2026-05-16';
        s.bookId = '__all__'; // sentinel для daily aggregate
        s.secondsReading = 0;
        s.wordsRead = 0;
        s.wordsTranslated = 0;
        s.wordsAddedToDeck = 0;
        s.wordsLearned = 0;
        s.updatedAt = Date.now();
      }),
    );
    expect(stat.bookId).toBe('__all__');
  });

  test('OPDSCatalogModel: URL хранится без userinfo', async () => {
    const db = createTestDatabase();
    const cat = await db.write(async () =>
      db.collections.get<OPDSCatalogModel>('opds_catalogs').create((c) => {
        c.name = 'Standard Ebooks';
        c.url = 'https://standardebooks.org/opds';
        c.requiresAuth = false;
        c.kind = 'preset';
        c.lastFetchedAt = null;
        c.createdAt = Date.now();
      }),
    );
    expect(cat.url).not.toMatch(/@/); // нет userinfo
    expect(cat.requiresAuth).toBe(false);
  });
});
