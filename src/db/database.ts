// Production Database factory — SQLiteAdapter через JSI (RN 0.81 + new arch).
// modelClasses пока пустой — заполнится после Phase 3.
// Borges seed conditional через __DEV__ + env var (Task 40).
import { Database } from '@nozbe/watermelondb';
import SQLiteAdapter from '@nozbe/watermelondb/adapters/sqlite';
import { schema } from './schema';
import { migrations } from './migrations';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const modelClasses: any[] = [];

export async function createDatabase(): Promise<Database> {
  const adapter = new SQLiteAdapter({
    schema,
    migrations,
    dbName: 'fluera',
    jsi: true,
    onSetUpError: (err) => {
      console.warn('[db] SQLite setup error:', err);
    },
  });
  return new Database({ adapter, modelClasses });
}
