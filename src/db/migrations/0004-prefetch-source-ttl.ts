// #4.6 Translation Prefetch + Lifecycle: schema v3 → v4.
// Добавляет source/ttl_days/chrf_score колонки на translation_cache.
// inference_context уже в v3 — не дублировать.
import { addColumns } from '@nozbe/watermelondb/Schema/migrations';

export const migration0004 = {
  toVersion: 4,
  steps: [
    addColumns({
      table: 'translation_cache',
      columns: [
        { name: 'source', type: 'string' as const, isIndexed: true },
        { name: 'ttl_days', type: 'number' as const },
        { name: 'chrf_score', type: 'number' as const, isOptional: true },
      ],
    }),
  ],
};
