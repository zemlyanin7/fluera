import React from 'react';
import { useDatabase } from '@/db/DatabaseContext';
import { WordRepository, type WordStatusRecord } from '@/db/repositories/WordRepository';
import type { BookLanguage, NativeLanguage } from '@/types/settings';

export interface UseDeckQueueResult {
  queue: WordStatusRecord[];
  isLoading: boolean;
}

export function useDeckQueue(
  bookLanguage: BookLanguage,
  nativeLanguage: NativeLanguage,
  limit = 50,
): UseDeckQueueResult {
  const db = useDatabase();
  const repo = React.useMemo(() => new WordRepository(db), [db]);
  const [queue, setQueue] = React.useState<WordStatusRecord[]>([]);
  const [isLoading, setIsLoading] = React.useState(true);

  React.useEffect(() => {
    let mounted = true;
    const refresh = () => {
      void repo.deckQueue(bookLanguage, nativeLanguage, limit).then((rows) => {
        if (!mounted) return;
        setQueue(rows);
        setIsLoading(false);
      });
    };
    refresh();
    const sub = db.collections.get('word_statuses').changes.subscribe(() => refresh());
    return () => {
      mounted = false;
      sub.unsubscribe();
    };
  }, [db, repo, bookLanguage, nativeLanguage, limit]);

  return { queue, isLoading };
}
