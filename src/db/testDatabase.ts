// In-memory LokiJS адаптер для unit-тестов. Не использовать в production —
// production createDatabase() в database.ts использует SQLiteAdapter.
import { Database } from '@nozbe/watermelondb';
import LokiJSAdapter from '@nozbe/watermelondb/adapters/lokijs';
import { schema } from './schema';
import { migrations } from './migrations';
import {
  BookModel, ChapterModel, ReadingPositionModel, BookmarkModel,
  WordStatusModel, WordOccurrenceModel, ReviewLogModel,
  TranslationCacheModel, OPDSCatalogModel, ReadingStatsModel,
} from './models';

const modelClasses = [
  BookModel, ChapterModel, ReadingPositionModel, BookmarkModel,
  WordStatusModel, WordOccurrenceModel, ReviewLogModel,
  TranslationCacheModel, OPDSCatalogModel, ReadingStatsModel,
];

export function createTestDatabase(): Database {
  const adapter = new LokiJSAdapter({
    schema,
    migrations,
    dbName: `fluera-test-${Math.random().toString(36).slice(2)}`,
    useWebWorker: false,
    useIncrementalIndexedDB: false, // обязательно: WatermelonDB бросает diagnostic error без флага
  });
  return new Database({ adapter, modelClasses });
}
