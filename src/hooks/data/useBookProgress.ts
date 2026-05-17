import React from 'react';
import { useDatabase } from '@/db/DatabaseContext';
import { BookRepository } from '@/db/repositories/BookRepository';

export interface UseBookProgressResult {
  progress: number;
  lastReadAt: Date | null;
  isLoading: boolean;
}

export function useBookProgress(bookId: string): UseBookProgressResult {
  const db = useDatabase();
  const repo = React.useMemo(() => new BookRepository(db), [db]);
  const [progress, setProgress] = React.useState(0);
  const [lastReadAt, setLastReadAt] = React.useState<Date | null>(null);
  const [isLoading, setIsLoading] = React.useState(true);

  React.useEffect(() => {
    let mounted = true;
    const refresh = () => {
      void repo.findById(bookId).then((rec) => {
        if (!mounted) return;
        setProgress(rec?.progress ?? 0);
        setLastReadAt(rec?.lastReadAt ? new Date(rec.lastReadAt) : null);
        setIsLoading(false);
      });
    };
    refresh();
    const sub = db.collections.get('books').changes.subscribe(() => refresh());
    return () => {
      mounted = false;
      sub.unsubscribe();
    };
  }, [db, repo, bookId]);

  return { progress, lastReadAt, isLoading };
}
