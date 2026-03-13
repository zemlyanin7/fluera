import { useState, useEffect, useRef } from 'react';
import { Q } from '@nozbe/watermelondb';
import { database } from '../db';
import type { WordStatus } from '../db/models/WordStatus';
import type { WordStatusValue } from '../utils/types';

export function useWordStatusBatch(
  words: string[],
  bookLanguage: string,
  nativeLanguage: string,
): Map<string, WordStatusValue> {
  const [statusMap, setStatusMap] = useState<Map<string, WordStatusValue>>(new Map());
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (words.length === 0) {
      setStatusMap(new Map());
      return;
    }

    // Debounce 300ms
    if (debounceRef.current) clearTimeout(debounceRef.current);

    debounceRef.current = setTimeout(async () => {
      try {
        const collection = database.get<WordStatus>('word_statuses');
        const lowerWords = words.map((w) => w.toLowerCase());
        const results = await collection
          .query(
            Q.where('word', Q.oneOf(lowerWords)),
            Q.where('book_language', bookLanguage),
            Q.where('native_language', nativeLanguage),
          )
          .fetch();

        const map = new Map<string, WordStatusValue>();
        for (const record of results) {
          map.set(record.word, record.status as WordStatusValue);
        }
        setStatusMap(map);
      } catch {
        // Silently fail — words will render with default (new) color
      }
    }, 300);

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [words.join(','), bookLanguage, nativeLanguage]);

  return statusMap;
}
