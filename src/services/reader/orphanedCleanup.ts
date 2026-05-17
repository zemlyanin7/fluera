// Удаляет директории books/{id}/ без соответствующей записи Book в БД.
// Возникают после failed import-ов. Запуск при cold-start приложения.
// См. spec §7.5, §10.5.
import * as FileSystem from 'expo-file-system/legacy';
import { Database } from '@nozbe/watermelondb';
import { BookRepository } from '@/db/repositories/BookRepository';

export async function pruneOrphanedBookDirs(db: Database): Promise<number> {
  const root = `${FileSystem.documentDirectory}books/`;
  let dirs: string[];
  try {
    dirs = await FileSystem.readDirectoryAsync(root);
  } catch {
    return 0;
  }
  const books = new BookRepository(db);
  const all = await books.list();
  const validIds = new Set(all.map((b) => b.id));
  let pruned = 0;
  for (const name of dirs) {
    if (name === '_tmp') continue;
    if (!validIds.has(name)) {
      try {
        await FileSystem.deleteAsync(`${root}${name}`, { idempotent: true });
        pruned++;
      } catch {
        // swallow — best-effort
      }
    }
  }
  return pruned;
}
