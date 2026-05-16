import { schema, SCHEMA_VERSION } from '@/db/schema';

const TABLES = [
  'books', 'chapters', 'reading_positions', 'bookmarks',
  'word_statuses', 'word_occurrences', 'review_logs',
  'translation_cache', 'opds_catalogs', 'reading_stats',
];

describe('schema', () => {
  test('SCHEMA_VERSION === 1', () => {
    expect(SCHEMA_VERSION).toBe(1);
  });

  test('версия в appSchema совпадает с SCHEMA_VERSION', () => {
    expect(schema.version).toBe(SCHEMA_VERSION);
  });

  test('содержит все 10 таблиц', () => {
    const names = Object.keys(schema.tables);
    expect(names.sort()).toEqual([...TABLES].sort());
  });

  test('books имеет обязательные поля', () => {
    const cols = Object.keys(schema.tables.books.columns);
    [
      'title', 'author', 'language', 'format', 'file_path', 'cover_path',
      'source', 'opds_catalog_id', 'total_chars', 'progress', 'difficulty',
      'difficulty_computed_at', 'added_at', 'last_read_at', 'archived',
    ].forEach((c) => expect(cols).toContain(c));
  });

  test('books.last_read_at и language индексированы', () => {
    expect(schema.tables.books.columns.last_read_at.isIndexed).toBe(true);
    expect(schema.tables.books.columns.language.isIndexed).toBe(true);
    expect(schema.tables.books.columns.archived.isIndexed).toBe(true);
  });

  test('word_statuses имеет FSRS-6 поля', () => {
    const cols = Object.keys(schema.tables.word_statuses.columns);
    [
      'fsrs_state', 'fsrs_difficulty', 'fsrs_stability',
      'fsrs_reps', 'fsrs_lapses', 'fsrs_last_review',
      'fsrs_next_review', 'fsrs_elapsed_days', 'fsrs_scheduled_days',
    ].forEach((c) => expect(cols).toContain(c));
  });

  test('word_statuses.fsrs_next_review индексирован для deck queue', () => {
    expect(schema.tables.word_statuses.columns.fsrs_next_review.isIndexed).toBe(true);
  });

  test('word_statuses имеет deck_suspended и deck_priority', () => {
    const cols = Object.keys(schema.tables.word_statuses.columns);
    expect(cols).toContain('deck_suspended');
    expect(cols).toContain('deck_priority');
  });

  test('review_logs имеет калибровочные поля для FSRS', () => {
    const cols = Object.keys(schema.tables.review_logs.columns);
    [
      'rating', 'reviewed_at', 'elapsed_days', 'scheduled_days',
      'state_before', 'stability_after', 'difficulty_after', 'due',
    ].forEach((c) => expect(cols).toContain(c));
  });

  test('review_logs.reviewed_at индексирован для retention purge', () => {
    expect(schema.tables.review_logs.columns.reviewed_at.isIndexed).toBe(true);
  });

  test('translation_cache.cache_key и created_at индексированы', () => {
    expect(schema.tables.translation_cache.columns.cache_key.isIndexed).toBe(true);
    expect(schema.tables.translation_cache.columns.created_at.isIndexed).toBe(true);
  });

  test('reading_positions.book_id индексирован', () => {
    expect(schema.tables.reading_positions.columns.book_id.isIndexed).toBe(true);
  });

  test('reading_stats.date и book_id индексированы', () => {
    expect(schema.tables.reading_stats.columns.date.isIndexed).toBe(true);
    expect(schema.tables.reading_stats.columns.book_id.isIndexed).toBe(true);
  });

  test('chapters.book_id индексирован', () => {
    expect(schema.tables.chapters.columns.book_id.isIndexed).toBe(true);
  });

  test('bookmarks.book_id индексирован', () => {
    expect(schema.tables.bookmarks.columns.book_id.isIndexed).toBe(true);
  });

  test('opds_catalogs.created_at индексирован', () => {
    expect(schema.tables.opds_catalogs.columns.created_at.isIndexed).toBe(true);
  });

  test('word_occurrences.word_status_id и book_id индексированы', () => {
    expect(schema.tables.word_occurrences.columns.word_status_id.isIndexed).toBe(true);
    expect(schema.tables.word_occurrences.columns.book_id.isIndexed).toBe(true);
  });
});
