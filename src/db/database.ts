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
import { pruneBrokenSeedRecords } from './seed/borges';

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
  // С приходом sub-project #3 (real Import flow) seed-книга больше не нужна.
  // Очищаем сломанные seed-записи (filePath = '/dev/null/...') из БД старых
  // dev-builds — иначе reader падает при попытке открыть несуществующий файл.
  if (__DEV__) {
    try {
      await pruneBrokenSeedRecords(db);
    } catch (err) {
      console.warn('[db] prune broken seed failed:', err);
    }
  }
  return db;
}
