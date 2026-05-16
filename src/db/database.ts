// Production Database factory — SQLiteAdapter через JSI (RN 0.81 + new arch).
// Все 10 моделей зарегистрированы — это критично для cross-table queries
// (иначе "Collection not found" в runtime).
import { Database } from '@nozbe/watermelondb';
import SQLiteAdapter from '@nozbe/watermelondb/adapters/sqlite';
import { Platform } from 'react-native';
// expo-file-system v19 переехал на legacy для documentDirectory + setBackupAttributeAsync
import * as FileSystem from 'expo-file-system/legacy';
import { schema } from './schema';
import { migrations } from './migrations';
import {
  BookModel, ChapterModel, ReadingPositionModel, BookmarkModel,
  WordStatusModel, WordOccurrenceModel, ReviewLogModel,
  TranslationCacheModel, OPDSCatalogModel, ReadingStatsModel,
} from './models';
import { seedBorgesIfEmpty } from './seed/borges';

const DB_NAME = 'fluera';

const modelClasses = [
  BookModel, ChapterModel, ReadingPositionModel, BookmarkModel,
  WordStatusModel, WordOccurrenceModel, ReviewLogModel,
  TranslationCacheModel, OPDSCatalogModel, ReadingStatsModel,
];

/**
 * iOS: исключаем SQLite файл + sibling WAL/SHM/journal из iCloud backup.
 * Per §6.6 спеки. Книги в Documents/Books/ — НЕ исключаются (user-data).
 * Безопасно вызывать даже если файлы ещё не созданы — ловим ошибки silent.
 */
async function excludeFromBackupIOS(): Promise<void> {
  if (Platform.OS !== 'ios') return;
  const baseDir = FileSystem.documentDirectory ?? '';
  if (!baseDir) return;
  const files = [
    `${baseDir}${DB_NAME}.db`,
    `${baseDir}${DB_NAME}.db-wal`,
    `${baseDir}${DB_NAME}.db-shm`,
    `${baseDir}${DB_NAME}.db-journal`,
  ];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const fs = FileSystem as any;
  if (typeof fs.setBackupAttributeAsync !== 'function') {
    // expo-file-system без этого API — fallback на config plugin
    // (NSURLIsExcludedFromBackupKey через Info.plist build-time).
    return;
  }
  for (const path of files) {
    try {
      await fs.setBackupAttributeAsync(path, { iCloudBackupEnabled: false });
    } catch {
      // файл может ещё не существовать (первый cold-start) — silent
    }
  }
}

export async function createDatabase(): Promise<Database> {
  const adapter = new SQLiteAdapter({
    schema,
    migrations,
    dbName: DB_NAME,
    jsi: true,
    onSetUpError: (err) => {
      console.warn('[db] SQLite setup error:', err);
    },
  });
  const db = new Database({ adapter, modelClasses });
  // Backup exclusion — НЕ ждём чтобы не блокировать createDatabase
  void excludeFromBackupIOS();
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
