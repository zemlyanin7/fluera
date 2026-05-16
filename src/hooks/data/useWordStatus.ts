import React from 'react';
import { useDatabase } from '@/db/DatabaseContext';
import { WordRepository, type WordStatusRecord } from '@/db/repositories/WordRepository';
import type { BookLanguage, NativeLanguage } from '@/types/settings';

export interface UseWordStatusResult {
  status: WordStatusRecord | null;
  isLoading: boolean;
}

export function useWordStatus(
  word: string,
  bookLanguage: BookLanguage,
  nativeLanguage: NativeLanguage,
): UseWordStatusResult {
  const db = useDatabase();
  const repo = React.useMemo(() => new WordRepository(db), [db]);
  const [status, setStatus] = React.useState<WordStatusRecord | null>(null);
  const [isLoading, setIsLoading] = React.useState(true);

  React.useEffect(() => {
    let mounted = true;
    const refresh = () => {
      void repo.findStatus(word, bookLanguage, nativeLanguage).then((rec) => {
        if (!mounted) return;
        setStatus(rec);
        setIsLoading(false);
      });
    };
    refresh();
    const sub = db.collections.get('word_statuses').changes.subscribe(() => refresh());
    return () => {
      mounted = false;
      sub.unsubscribe();
    };
  }, [db, repo, word, bookLanguage, nativeLanguage]);

  return { status, isLoading };
}
