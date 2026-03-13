import { appSchema, tableSchema } from '@nozbe/watermelondb'

export const schema = appSchema({
  version: 1,
  tables: [
    tableSchema({
      name: 'books',
      columns: [
        { name: 'title', type: 'string' },
        { name: 'author', type: 'string' },
        { name: 'language', type: 'string' },
        { name: 'format', type: 'string' },
        { name: 'file_path', type: 'string' },
        { name: 'cover_path', type: 'string', isOptional: true },
        { name: 'source', type: 'string' },
        { name: 'opds_url', type: 'string', isOptional: true },
        { name: 'progress', type: 'number' },
        { name: 'total_words', type: 'number' },
        { name: 'difficulty', type: 'number', isOptional: true },
        { name: 'added_at', type: 'number' },
        { name: 'last_read_at', type: 'number', isIndexed: true },
      ],
    }),
    tableSchema({
      name: 'chapters',
      columns: [
        { name: 'book_id', type: 'string', isIndexed: true },
        { name: 'title', type: 'string' },
        { name: 'order_index', type: 'number' },
        { name: 'progress', type: 'number' },
      ],
    }),
    tableSchema({
      name: 'word_statuses',
      columns: [
        { name: 'word', type: 'string', isIndexed: true },
        { name: 'book_language', type: 'string' },
        { name: 'native_language', type: 'string' },
        { name: 'word_lang_key', type: 'string', isIndexed: true },
        { name: 'status', type: 'number' },
        { name: 'translation', type: 'string' },
        { name: 'srs_interval', type: 'number' },
        { name: 'srs_ease_factor', type: 'number' },
        { name: 'srs_next_review', type: 'number', isOptional: true, isIndexed: true },
        { name: 'srs_repetitions', type: 'number' },
        { name: 'grammar_note', type: 'string', isOptional: true },
        { name: 'created_at', type: 'number' },
        { name: 'updated_at', type: 'number' },
      ],
    }),
    tableSchema({
      name: 'word_occurrences',
      columns: [
        { name: 'word_status_id', type: 'string', isIndexed: true },
        { name: 'book_id', type: 'string', isIndexed: true },
        { name: 'chapter_title', type: 'string' },
        { name: 'context_sentence', type: 'string' },
        { name: 'created_at', type: 'number' },
      ],
    }),
    tableSchema({
      name: 'translation_cache',
      columns: [
        { name: 'cache_key', type: 'string', isIndexed: true },
        { name: 'word', type: 'string' },
        { name: 'context', type: 'string' },
        { name: 'book_lang', type: 'string' },
        { name: 'native_lang', type: 'string' },
        { name: 'translation', type: 'string' },
        { name: 'grammar', type: 'string', isOptional: true },
        { name: 'created_at', type: 'number' },
      ],
    }),
    tableSchema({
      name: 'opds_catalogs',
      columns: [
        { name: 'name', type: 'string' },
        { name: 'url', type: 'string' },
        { name: 'catalog_type', type: 'string' },
        { name: 'last_fetched_at', type: 'number', isOptional: true },
      ],
    }),
    tableSchema({
      name: 'reading_stats',
      columns: [
        { name: 'date', type: 'string', isIndexed: true },
        { name: 'book_id', type: 'string', isOptional: true, isIndexed: true },
        { name: 'words_read', type: 'number' },
        { name: 'words_learned', type: 'number' },
        { name: 'time_reading_sec', type: 'number' },
        { name: 'translations_made', type: 'number' },
      ],
    }),
    tableSchema({
      name: 'user_settings',
      columns: [
        { name: 'native_language', type: 'string' },
        { name: 'book_language', type: 'string' },
        { name: 'theme', type: 'string' },
        { name: 'font_size', type: 'number' },
        { name: 'font_family', type: 'string' },
        { name: 'line_height', type: 'number' },
        { name: 'show_word_colors', type: 'boolean' },
      ],
    }),
  ],
})
