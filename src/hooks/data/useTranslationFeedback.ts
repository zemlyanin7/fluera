import { useMemo, useCallback } from 'react';
import { useDatabase } from '@/db/DatabaseContext';
import {
  TranslationFeedbackRepository,
  type TranslationFeedbackRecord,
} from '@/db/repositories/TranslationFeedbackRepository';

export type TranslationFeedbackDTO = TranslationFeedbackRecord;

export interface RecordFeedbackInput {
  sourceSentence: string;
  translatedSentence: string;
  bookLanguage: string;
  nativeLanguage: string;
  modelVersion: string;
  kernelBuildId: string | null;
  bookId: string | null;
}

export function useTranslationFeedback() {
  const db = useDatabase();
  const repo = useMemo(() => new TranslationFeedbackRepository(db), [db]);

  const record = useCallback(
    async (input: RecordFeedbackInput) => {
      await repo.insert({ ...input, createdAt: Date.now() });
    },
    [repo],
  );

  const listRecent = useCallback(
    async (limit: number): Promise<TranslationFeedbackDTO[]> => repo.listRecent(limit),
    [repo],
  );

  const clearAll = useCallback(async () => repo.clearAll(), [repo]);

  const purgeOlderThan = useCallback(
    async (cutoffMs: number) => repo.purgeOlderThan(cutoffMs),
    [repo],
  );

  return { record, listRecent, clearAll, purgeOlderThan };
}
