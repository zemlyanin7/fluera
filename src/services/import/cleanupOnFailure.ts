// Rollback на любой ошибке импорта: удаляет временный файл + books/{bookId}/.
// См. spec §7.5.
import * as FileSystem from 'expo-file-system/legacy';

export interface CleanupInput {
  tmpPath: string | null;
  bookId?: string;
}

export async function cleanupOnFailure(input: CleanupInput): Promise<void> {
  if (input.tmpPath) {
    try {
      const info = await FileSystem.getInfoAsync(input.tmpPath);
      if (info.exists) {
        await FileSystem.deleteAsync(input.tmpPath, { idempotent: true });
      }
    } catch {
      // swallow — best-effort cleanup
    }
  }
  if (input.bookId) {
    try {
      await FileSystem.deleteAsync(
        `${FileSystem.documentDirectory}books/${input.bookId}`,
        { idempotent: true },
      );
    } catch {
      // swallow
    }
  }
}
