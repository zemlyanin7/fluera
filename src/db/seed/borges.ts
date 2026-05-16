// Был Borges-seed для пустой БД (sub-project #2).
// Sub-project #3 поставил real ImportPipeline — seed-книга больше не нужна.
// Эта функция чистит старые сломанные seed-записи из dev-builds
// (filePath='/dev/null/...' → reader падает при чтении файла).
import { Database, Q } from '@nozbe/watermelondb';
import { BookModel } from '@/db/models';

export async function pruneBrokenSeedRecords(db: Database): Promise<number> {
  const books = db.collections.get<BookModel>('books');
  // Любая запись с filePath, начинающимся с '/dev/null' — заведомо сломанная.
  const broken = await books.query(Q.where('file_path', Q.like('/dev/null%'))).fetch();
  if (broken.length === 0) return 0;
  await db.write(async () => {
    for (const b of broken) {
      await b.destroyPermanently();
    }
  });
  return broken.length;
}
