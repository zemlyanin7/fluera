import { schema, SCHEMA_VERSION } from '@/db/schema';

const TABLES = [
  'books', 'chapters', 'reading_positions', 'bookmarks',
  'word_statuses', 'word_occurrences', 'review_logs',
  'translation_cache', 'opds_catalogs', 'reading_stats',
];

function table(name: string) {
  const t = schema.tables[name];
  if (!t) throw new Error(`schema.tables.${name} missing`);
  return t;
}

function column(tableName: string, colName: string) {
  const t = table(tableName);
  const col = t.columns[colName];
  if (!col) throw new Error(`schema.tables.${tableName}.columns.${colName} missing`);
  return col;
}

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
    const cols = Object.keys(table('books').columns);
    [
      'title', 'author', 'language', 'format', 'file_path', 'cover_path',
      'source', 'opds_catalog_id', 'total_chars', 'progress', 'difficulty',
      'difficulty_computed_at', 'added_at', 'last_read_at', 'archived',
    ].forEach((c) => expect(cols).toContain(c));
  });

  test('books.last_read_at, language, archived индексированы', () => {
    expect(column('books', 'last_read_at').isIndexed).toBe(true);
    expect(column('books', 'language').isIndexed).toBe(true);
    expect(column('books', 'archived').isIndexed).toBe(true);
  });

  test('word_statuses имеет FSRS-6 поля', () => {
    const cols = Object.keys(table('word_statuses').columns);
    [
      'fsrs_state', 'fsrs_difficulty', 'fsrs_stability',
      'fsrs_reps', 'fsrs_lapses', 'fsrs_last_review',
      'fsrs_next_review', 'fsrs_elapsed_days', 'fsrs_scheduled_days',
    ].forEach((c) => expect(cols).toContain(c));
  });

  test('word_statuses.fsrs_next_review индексирован для deck queue', () => {
    expect(column('word_statuses', 'fsrs_next_review').isIndexed).toBe(true);
  });

  test('word_statuses имеет deck_suspended и deck_priority', () => {
    const cols = Object.keys(table('word_statuses').columns);
    expect(cols).toContain('deck_suspended');
    expect(cols).toContain('deck_priority');
  });

  test('review_logs имеет калибровочные поля FSRS', () => {
    const cols = Object.keys(table('review_logs').columns);
    [
      'rating', 'reviewed_at', 'elapsed_days', 'scheduled_days',
      'state_before', 'stability_after', 'difficulty_after', 'due',
    ].forEach((c) => expect(cols).toContain(c));
  });

  test('review_logs.reviewed_at индексирован для retention purge', () => {
    expect(column('review_logs', 'reviewed_at').isIndexed).toBe(true);
  });

  test('translation_cache.cache_key и created_at индексированы', () => {
    expect(column('translation_cache', 'cache_key').isIndexed).toBe(true);
    expect(column('translation_cache', 'created_at').isIndexed).toBe(true);
  });

  test('reading_positions.book_id индексирован', () => {
    expect(column('reading_positions', 'book_id').isIndexed).toBe(true);
  });

  test('reading_stats.date и book_id индексированы', () => {
    expect(column('reading_stats', 'date').isIndexed).toBe(true);
    expect(column('reading_stats', 'book_id').isIndexed).toBe(true);
  });

  test('chapters.book_id индексирован', () => {
    expect(column('chapters', 'book_id').isIndexed).toBe(true);
  });

  test('bookmarks.book_id индексирован', () => {
    expect(column('bookmarks', 'book_id').isIndexed).toBe(true);
  });

  test('opds_catalogs.created_at индексирован', () => {
    expect(column('opds_catalogs', 'created_at').isIndexed).toBe(true);
  });

  test('word_occurrences.word_status_id и book_id индексированы', () => {
    expect(column('word_occurrences', 'word_status_id').isIndexed).toBe(true);
    expect(column('word_occurrences', 'book_id').isIndexed).toBe(true);
  });
});
