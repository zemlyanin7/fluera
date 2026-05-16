// Production Database factory — SQLiteAdapter через JSI (RN 0.81 + new arch).
// Все 10 моделей зарегистрированы — это критично для cross-table queries
// (иначе "Collection not found" в runtime).
import { Database } from '@nozbe/watermelondb';
import SQLiteAdapter from '@nozbe/watermelondb/adapters/sqlite';
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
