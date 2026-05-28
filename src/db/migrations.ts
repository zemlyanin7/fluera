// WatermelonDB миграции.
// Правила:
//   1. Новый { toVersion: N, steps: [...] } объект при каждом bump SCHEMA_VERSION.
//   2. Никогда не редактировать прошлые миграции — они в проде у пользователей.
//   3. Запустить unit-тест миграции перед коммитом.
import { schemaMigrations, createTable, addColumns } from '@nozbe/watermelondb/Schema/migrations';
import { migration0004 } from './migrations/0004-prefetch-source-ttl';

export const migrations = schemaMigrations({
  migrations: [
    // #4.6 Translation Prefetch + Lifecycle — schema v4
    migration0004,
    {
      // #4.5 Translation Popup Redesign:
      // - Новые таблицы: mwe_phrases, false_friends, translation_feedback
      // - Расширение translation_cache: sentence + inference + versioning поля
      toVersion: 2,
      steps: [
        createTable({
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
        createTable({
          name: 'false_friends',
          columns: [
            { name: 'source_lang', type: 'string', isIndexed: true },
            { name: 'target_lang', type: 'string', isIndexed: true },
            { name: 'source_word', type: 'string', isIndexed: true },
            { name: 'looks_like_native', type: 'string' },
            { name: 'actual_meaning', type: 'string' },
            { name: 'confidence', type: 'string' },
            { name: 'domain', type: 'string' },
          ],
        }),
        createTable({
          name: 'translation_feedback',
          columns: [
            { name: 'source_sentence', type: 'string' },
            { name: 'translated_sentence', type: 'string' },
            { name: 'book_language', type: 'string' },
            { name: 'native_language', type: 'string' },
            { name: 'model_version', type: 'string' },
            { name: 'kernel_build_id', type: 'string', isOptional: true },
            { name: 'book_id', type: 'string', isOptional: true, isIndexed: true },
            { name: 'created_at', type: 'number', isIndexed: true },
          ],
        }),
        addColumns({
          table: 'translation_cache',
          columns: [
            { name: 'sentence_translation', type: 'string', isOptional: true },
            { name: 'translated_word_offset', type: 'number', isOptional: true },
            // inference_context: 'cold' | 'warm' | 'thermal_throttled' — всегда записывается
            { name: 'inference_context', type: 'string' },
            { name: 'model_version', type: 'string' },
            { name: 'kernel_build_id', type: 'string', isOptional: true },
          ],
        }),
      ],
    },
    {
      // #4.5.1 Translation Popup Polish:
      // - word_statuses: saved_to_deck + saved_at (быстрое сохранение в деку из попапа)
      toVersion: 3,
      steps: [
        addColumns({
          table: 'word_statuses',
          columns: [
            { name: 'saved_to_deck', type: 'boolean' },
            { name: 'saved_at', type: 'number', isOptional: true },
          ],
        }),
      ],
    },
  ],
});
