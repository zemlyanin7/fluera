import React from 'react';
import { useDatabase } from '@/db/DatabaseContext';
import { BookRepository, type BookRecord, type BookListOpts } from '@/db/repositories/BookRepository';

export interface UseBookListResult {
  books: BookRecord[];
  isLoading: boolean;
}

/**
 * Реактивный список книг. Перерисовывается на любое изменение коллекции
 * books — repo.list(opts) перезапрашивается. Фильтры в opts передаются как
 * примитивы (или undefined) — useEffect dep ловит их через комбинацию.
 */
export function useBookList(opts: BookListOpts = {}): UseBookListResult {
  const db = useDatabase();
  const repo = React.useMemo(() => new BookRepository(db), [db]);
  const [books, setBooks] = React.useState<BookRecord[]>([]);
  const [isLoading, setIsLoading] = React.useState(true);

  // Сериализуем opts чтобы effect не реран на каждый рендер с новой ссылкой.
  const optsKey = JSON.stringify(opts);

  React.useEffect(() => {
    let mounted = true;
    const refresh = () => {
      void repo.list(opts).then((rows) => {
        if (mounted) {
          setBooks(rows);
          setIsLoading(false);
        }
      });
    };
    refresh();
    const sub = db.collections.get('books').changes.subscribe(() => refresh());
    return () => {
      mounted = false;
      sub.unsubscribe();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [db, repo, optsKey]);

  return { books, isLoading };
}
