// WatermelonDB schema — sub-project #2 Data layer, v1 initial.
// Реализация §4 спеки docs/superpowers/specs/2026-05-16-data-layer-design.md.
// При изменении схемы: bump SCHEMA_VERSION + добавить миграционный step в
// src/db/migrations.ts с toVersion = новый номер. Никогда не редактировать
// прошлые миграции.
import { appSchema, tableSchema } from '@nozbe/watermelondb';

export const SCHEMA_VERSION = 2;

export const schema = appSchema({
  version: SCHEMA_VERSION,
  tables: [
    tableSchema({
      name: 'books',
      columns: [
        { name: 'title', type: 'string' },
        { name: 'author', type: 'string', isOptional: true },
        { name: 'language', type: 'string', isIndexed: true },
        { name: 'format', type: 'string' },
        { name: 'file_path', type: 'string' },
        { name: 'cover_path', type: 'string', isOptional: true },
        { name: 'source', type: 'string' },
        { name: 'opds_catalog_id', type: 'string', isOptional: true },
        { name: 'total_chars', type: 'number' },
        { name: 'progress', type: 'number' },
        { name: 'difficulty', type: 'number', isOptional: true },
        { name: 'difficulty_computed_at', type: 'number', isOptional: true },
        { name: 'added_at', type: 'number' },
        { name: 'last_read_at', type: 'number', isOptional: true, isIndexed: true },
        { name: 'archived', type: 'boolean', isIndexed: true },
      ],
    }),
    tableSchema({
      name: 'chapters',
      columns: [
        { name: 'book_id', type: 'string', isIndexed: true },
        { name: 'title', type: 'string', isOptional: true },
        { name: 'order_index', type: 'number' },
        { name: 'start_char', type: 'number' },
        { name: 'end_char', type: 'number' },
      ],
    }),
    tableSchema({
      name: 'reading_positions',
      columns: [
        { name: 'book_id', type: 'string', isIndexed: true },
        { name: 'chapter_order_index', type: 'number' },
        { name: 'position_data', type: 'string' },
        { name: 'updated_at', type: 'number' },
      ],
    }),
    tableSchema({
      name: 'bookmarks',
      columns: [
        { name: 'book_id', type: 'string', isIndexed: true },
        { name: 'chapter_order_index', type: 'number' },
        { name: 'position_data', type: 'string' },
        { name: 'note', type: 'string', isOptional: true },
        { name: 'created_at', type: 'number' },
      ],
    }),
    tableSchema({
      name: 'word_statuses',
      columns: [
        // natural key
        { name: 'word', type: 'string', isIndexed: true },
        { name: 'book_language', type: 'string', isIndexed: true },
        { name: 'native_language', type: 'string', isIndexed: true },
        // metadata
        { name: 'status', type: 'number', isIndexed: true },
        { name: 'translation', type: 'string' },
        { name: 'grammar_note', type: 'string', isOptional: true },
        // FSRS-6 (см. spec §4.5)
        { name: 'fsrs_state', type: 'number' },
        { name: 'fsrs_difficulty', type: 'number' },
        { name: 'fsrs_stability', type: 'number' },
        { name: 'fsrs_reps', type: 'number' },
        { name: 'fsrs_lapses', type: 'number' },
        { name: 'fsrs_last_review', type: 'number', isOptional: true },
        { name: 'fsrs_next_review', type: 'number', isOptional: true, isIndexed: true },
        { name: 'fsrs_elapsed_days', type: 'number' },
        { name: 'fsrs_scheduled_days', type: 'number' },
        // deck overrides
        { name: 'deck_suspended', type: 'boolean' },
        { name: 'deck_priority', type: 'number' },
        // timestamps
        { name: 'created_at', type: 'number' },
        { name: 'updated_at', type: 'number' },
      ],
    }),
    tableSchema({
      name: 'word_occurrences',
      columns: [
        { name: 'word_status_id', type: 'string', isIndexed: true },
        { name: 'book_id', type: 'string', isIndexed: true },
        { name: 'chapter_order_index', type: 'number', isOptional: true },
        { name: 'context_sentence', type: 'string' },
        { name: 'created_at', type: 'number' },
      ],
    }),
    tableSchema({
      name: 'review_logs',
      columns: [
        { name: 'word_status_id', type: 'string', isIndexed: true },
        { name: 'rating', type: 'number' },
        { name: 'reviewed_at', type: 'number', isIndexed: true },
        { name: 'elapsed_days', type: 'number' },
        { name: 'scheduled_days', type: 'number' },
        { name: 'state_before', type: 'number' },
        // калибровочные поля (см. spec §4.7) — нужны для ts-fsrs optimizer
        { name: 'stability_after', type: 'number' },
        { name: 'difficulty_after', type: 'number' },
        { name: 'due', type: 'number' },
      ],
    }),
    tableSchema({
      name: 'translation_cache',
      columns: [
        { name: 'cache_key', type: 'string', isIndexed: true },
        { name: 'word', type: 'string' },
        { name: 'context_window', type: 'string' },
        { name: 'book_language', type: 'string' },
        { name: 'native_language', type: 'string' },
        { name: 'translation', type: 'string' },
        { name: 'grammar', type: 'string', isOptional: true },
        { name: 'created_at', type: 'number', isIndexed: true },
      ],
    }),
    tableSchema({
      name: 'opds_catalogs',
      columns: [
        { name: 'name', type: 'string' },
        // URL хранится БЕЗ userinfo. Креды в expo-secure-store (см. §6.4).
        { name: 'url', type: 'string' },
        { name: 'requires_auth', type: 'boolean' },
        { name: 'kind', type: 'string' },
        { name: 'last_fetched_at', type: 'number', isOptional: true },
        { name: 'created_at', type: 'number', isIndexed: true },
      ],
    }),
    // #4.5 Translation Popup — MWE словарь (multi-word expressions)
    tableSchema({
      name: 'mwe_phrases',
      columns: [
        { name: 'source_lang', type: 'string', isIndexed: true },
        { name: 'target_lang', type: 'string', isIndexed: true },
        { name: 'phrase', type: 'string', isIndexed: true },
        { name: 'translation_equivalent', type: 'string' },
        { name: 'literal_gloss', type: 'string', isOptional: true },
        { name: 'mwe_type', type: 'string', isOptional: true },
        { name: 'gap_pattern', type: 'string', isOptional: true },
        { name: 'domain', type: 'string' },
        { name: 'attribution', type: 'string', isOptional: true },
      ],
    }),
    tableSchema({
      name: 'reading_stats',
      columns: [
        // (date, book_id) — детерминированный ID '${date}__${book_id}'.
        // Для агрегатов "все книги" book_id = '__all__' sentinel (NOT NULL).
        { name: 'date', type: 'string', isIndexed: true },
        { name: 'book_id', type: 'string', isIndexed: true },
        { name: 'seconds_reading', type: 'number' },
        { name: 'words_read', type: 'number' },
        { name: 'words_translated', type: 'number' },
        { name: 'words_added_to_deck', type: 'number' },
        { name: 'words_learned', type: 'number' },
        { name: 'updated_at', type: 'number' },
      ],
    }),
  ],
});
