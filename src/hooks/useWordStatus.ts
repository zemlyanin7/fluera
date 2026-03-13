import { useState, useEffect } from 'react';
import { Q } from '@nozbe/watermelondb';
import { database } from '../db';
import type { WordStatus } from '../db/models/WordStatus';
import type { WordStatusValue } from '../utils/types';

interface UseWordStatusResult {
  status: WordStatusValue | null;
  wordRecord: WordStatus | null;
}

export function useWordStatus(
  word: string,
  bookLanguage: string,
  nativeLanguage: string,
): UseWordStatusResult {
  const [wordRecord, setWordRecord] = useState<WordStatus | null>(null);

  useEffect(() => {
    const collection = database.get<WordStatus>('word_statuses');
    const query = collection.query(
      Q.where('word', word.toLowerCase()),
      Q.where('book_language', bookLanguage),
      Q.where('native_language', nativeLanguage),
    );

    const subscription = query.observe().subscribe((results) => {
      setWordRecord(results.length > 0 ? results[0] : null);
    });

    return () => subscription.unsubscribe();
  }, [word, bookLanguage, nativeLanguage]);

  return {
    status: wordRecord ? (wordRecord.status as WordStatusValue) : null,
    wordRecord,
  };
}
