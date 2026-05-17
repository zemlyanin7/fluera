import { Q, type Database } from '@nozbe/watermelondb';
import type { TranslationCacheModel } from '@/db/models/TranslationCache';

/**
 * Удаляет все записи translation_cache, у которых kernel_build_id отличается
 * от текущего. Вызывается при старте приложения для инвалидации кэша при
 * смене kernel (llama.rn version / STQ-патч / extraction version).
 *
 * @returns количество удалённых записей
 */
export async function purgeStaleKernelEntries(
  db: Database,
  currentKernelBuildId: string,
): Promise<number> {
  const collection = db.get<TranslationCacheModel>('translation_cache');
  const stale = await collection
    .query(Q.where('kernel_build_id', Q.notEq(currentKernelBuildId)))
    .fetch();
  if (stale.length === 0) return 0;
  await db.write(async () => {
    await db.batch(...stale.map((m) => m.prepareDestroyPermanently()));
  });
  return stale.length;
}
