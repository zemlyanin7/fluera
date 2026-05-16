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
import { seedBorgesIfEmpty } from './seed/borges';

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
  const db = new Database({ adapter, modelClasses });
  // Borges seed только в __DEV__ + явное opt-out через EXPO_PUBLIC_FLUERA_SEED_BORGES=0.
  // В production builds сидинг не запускается. eas.json profiles должны явно
  // unset эту переменную для prod.
  if (__DEV__ && process.env.EXPO_PUBLIC_FLUERA_SEED_BORGES !== '0') {
    try {
      await seedBorgesIfEmpty(db);
    } catch (err) {
      console.warn('[db] Borges seed failed:', err);
    }
  }
  return db;
}
