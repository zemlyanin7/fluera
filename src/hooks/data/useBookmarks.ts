import React from 'react';
import { useDatabase } from '@/db/DatabaseContext';
import { BookmarkRepository, type BookmarkRecord } from '@/db/repositories/BookmarkRepository';

export interface UseBookmarksResult {
  bookmarks: BookmarkRecord[];
  isLoading: boolean;
}

/**
 * Read-only hook для bookmarks одной книги. Сортировка DESC by createdAt.
 * Мутации (создание/удаление) — через BookmarkRepository напрямую.
 */
export function useBookmarks(bookId: string): UseBookmarksResult {
  const db = useDatabase();
  const repo = React.useMemo(() => new BookmarkRepository(db), [db]);
  const [bookmarks, setBookmarks] = React.useState<BookmarkRecord[]>([]);
  const [isLoading, setIsLoading] = React.useState(true);

  React.useEffect(() => {
    let mounted = true;
    const refresh = () => {
      void repo.listByBook(bookId).then((rows) => {
        if (!mounted) return;
        setBookmarks(rows);
        setIsLoading(false);
      });
    };
    refresh();
    const sub = db.collections.get('bookmarks').changes.subscribe(() => refresh());
    return () => {
      mounted = false;
      sub.unsubscribe();
    };
  }, [db, repo, bookId]);

  return { bookmarks, isLoading };
}
