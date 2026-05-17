// WatermelonDB миграции. v1 — initial schema (см. schema.ts), миграций нет.
// При bump SCHEMA_VERSION в schema.ts:
//   1. Добавить новый { toVersion: N, steps: [...] } объект в массив ниже.
//   2. Никогда не редактировать прошлые миграции — они в проде у пользователей.
//   3. Запустить unit-тест миграции на in-memory LokiJS адаптере.
import { schemaMigrations } from '@nozbe/watermelondb/Schema/migrations';

export const migrations = schemaMigrations({
  migrations: [
    // future: { toVersion: 2, steps: [addColumns({...}), createTable({...})] },
  ],
});
