import { schema, SCHEMA_VERSION } from '@/db/schema';

const TABLES_V1 = [
  'books', 'chapters', 'reading_positions', 'bookmarks',
  'word_statuses', 'word_occurrences', 'review_logs',
  'translation_cache', 'opds_catalogs', 'reading_stats',
];

const TABLES_V2 = [
  ...TABLES_V1,
  'mwe_phrases', 'false_friends', 'translation_feedback',
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

// Хелпер: возвращает имена колонок через columnArray (реальный WatermelonDB
// хранит columns как object-map, columnArray — как исходный массив).
function columnNames(tableName: string): string[] {
  const t = table(tableName);
  // WatermelonDB tableSchema: { columns: Record<string, col>, columnArray: col[] }
  const arr: Array<{ name: string }> = (t as unknown as { columnArray: Array<{ name: string }> }).columnArray;
  return arr.map((c) => c.name);
}

describe('schema', () => {
  test('SCHEMA_VERSION === 3 после #4.5.1 migration', () => {
    expect(SCHEMA_VERSION).toBe(3);
  });

  test('версия в appSchema совпадает с SCHEMA_VERSION', () => {
    expect(schema.version).toBe(SCHEMA_VERSION);
  });

  test('содержит все 13 таблиц v2 (v1 + #4.5)', () => {
    const names = Object.keys(schema.tables);
    expect(names.sort()).toEqual([...TABLES_V2].sort());
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

describe('schema v2 — translation_cache extended', () => {
  test('translation_cache extended с sentence + inference_context + versioning columns', () => {
    const names = columnNames('translation_cache');
    expect(names).toContain('sentence_translation');
    expect(names).toContain('translated_word_offset');
    expect(names).toContain('inference_context');
    expect(names).toContain('model_version');
    expect(names).toContain('kernel_build_id');
  });

  test('translation_cache.inference_context — обязательное поле (required)', () => {
    const col = column('translation_cache', 'inference_context');
    expect(col.isOptional).toBeFalsy();
  });

  test('translation_cache.sentence_translation и kernel_build_id — опциональные', () => {
    expect(column('translation_cache', 'sentence_translation').isOptional).toBe(true);
    expect(column('translation_cache', 'kernel_build_id').isOptional).toBe(true);
  });
});

describe('schema v2 — false_friends', () => {
  test('false_friends table присутствует со всеми колонками', () => {
    const t = table('false_friends');
    expect(t).toBeDefined();
    const names = columnNames('false_friends').sort();
    expect(names).toEqual(
      ['actual_meaning', 'confidence', 'domain', 'looks_like_native', 'source_lang', 'source_word', 'target_lang'].sort(),
    );
  });

  test('false_friends.source_lang, target_lang, source_word индексированы', () => {
    expect(column('false_friends', 'source_lang').isIndexed).toBe(true);
    expect(column('false_friends', 'target_lang').isIndexed).toBe(true);
    expect(column('false_friends', 'source_word').isIndexed).toBe(true);
  });
});

describe('schema v2 — translation_feedback', () => {
  test('translation_feedback table присутствует со всеми колонками', () => {
    const t = table('translation_feedback');
    expect(t).toBeDefined();
    const names = columnNames('translation_feedback').sort();
    expect(names).toEqual(
      ['book_id', 'book_language', 'created_at', 'kernel_build_id', 'model_version', 'native_language', 'source_sentence', 'translated_sentence'].sort(),
    );
  });

  test('translation_feedback.book_id и created_at индексированы', () => {
    expect(column('translation_feedback', 'book_id').isIndexed).toBe(true);
    expect(column('translation_feedback', 'created_at').isIndexed).toBe(true);
  });
});

describe('schema v2 — mwe_phrases', () => {
  test('mwe_phrases table присутствует со всеми колонками', () => {
    const t = table('mwe_phrases');
    expect(t).toBeDefined();
    const names = columnNames('mwe_phrases').sort();
    expect(names).toEqual(
      ['attribution', 'domain', 'gap_pattern', 'literal_gloss', 'mwe_type', 'phrase', 'source_lang', 'target_lang', 'translation_equivalent'].sort(),
    );
  });

  test('mwe_phrases.source_lang, target_lang, phrase индексированы', () => {
    expect(column('mwe_phrases', 'source_lang').isIndexed).toBe(true);
    expect(column('mwe_phrases', 'target_lang').isIndexed).toBe(true);
    expect(column('mwe_phrases', 'phrase').isIndexed).toBe(true);
  });
});

describe('schema v3 (#4.5.1 polish)', () => {
  it('SCHEMA_VERSION = 3', () => {
    expect(SCHEMA_VERSION).toBe(3);
  });

  it('word_status имеет saved_to_deck + saved_at', () => {
    const t = schema.tables.word_statuses;
    expect(t).toBeDefined();
    const names = (t as unknown as { columnArray: Array<{ name: string }> }).columnArray.map((c) => c.name);
    expect(names).toContain('saved_to_deck');
    expect(names).toContain('saved_at');
  });
});
