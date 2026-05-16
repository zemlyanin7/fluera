// In-memory LokiJS адаптер для unit-тестов. Не использовать в production —
// production createDatabase() в database.ts использует SQLiteAdapter.
// modelClasses пока пустой — заполнится после Phase 3 (Tasks 15-24).
import { Database } from '@nozbe/watermelondb';
import LokiJSAdapter from '@nozbe/watermelondb/adapters/lokijs';
import { schema } from './schema';
import { migrations } from './migrations';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const modelClasses: any[] = [];

export function createTestDatabase(): Database {
  const adapter = new LokiJSAdapter({
    schema,
    migrations,
    dbName: `fluera-test-${Math.random().toString(36).slice(2)}`,
    useWebWorker: false,
  });
  return new Database({ adapter, modelClasses });
}
