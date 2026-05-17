import React from 'react';
import { useDatabase } from '@/db/DatabaseContext';
import { ReadingPositionRepository, type ReadingPositionRecord } from '@/db/repositories/ReadingPositionRepository';

export interface UseReadingPositionResult {
  position: ReadingPositionRecord | null;
  isLoading: boolean;
}

export function useReadingPosition(bookId: string): UseReadingPositionResult {
  const db = useDatabase();
  const repo = React.useMemo(() => new ReadingPositionRepository(db), [db]);
  const [position, setPosition] = React.useState<ReadingPositionRecord | null>(null);
  const [isLoading, setIsLoading] = React.useState(true);

  React.useEffect(() => {
    let mounted = true;
    const refresh = () => {
      void repo.findByBook(bookId).then((rec) => {
        if (!mounted) return;
        setPosition(rec);
        setIsLoading(false);
      });
    };
    refresh();
    const sub = db.collections.get('reading_positions').changes.subscribe(() => refresh());
    return () => {
      mounted = false;
      sub.unsubscribe();
    };
  }, [db, repo, bookId]);

  return { position, isLoading };
}
