import React from 'react';
import { useDatabase } from '@/db/DatabaseContext';
import { TranslationCacheRepository, type TranslationCacheRecord } from '@/db/repositories/TranslationCacheRepository';
import { computeCacheKey } from '@/services/translation/cacheKey';
import {
  NoOpTranslationService,
} from '@/services/translation/NoOpTranslationService';
import type { ITranslationService } from '@/services/translation/ITranslationService';
import type { BookLanguage, NativeLanguage } from '@/types/settings';

export type TranslationHookStatus = 'idle' | 'cache-hit' | 'inferring' | 'error';

export interface UseTranslationResult {
  translation: TranslationCacheRecord | null;
  status: TranslationHookStatus;
  errorMessage?: string;
}

const defaultService = new NoOpTranslationService();

/**
 * Hook для перевода: sync cache check → on miss call service.translate() →
 * upsert в cache. Service по дефолту — NoOpTranslationService (stub из #2).
 * В #4 заменится на реальный on-device LLM service.
 */
export function useTranslation(
  word: string,
  contextWindow: string,
  bookLanguage: BookLanguage,
  nativeLanguage: NativeLanguage,
  service: ITranslationService = defaultService,
): UseTranslationResult {
  const db = useDatabase();
  const cacheRepo = React.useMemo(() => new TranslationCacheRepository(db), [db]);
  const [translation, setTranslation] = React.useState<TranslationCacheRecord | null>(null);
  const [status, setStatus] = React.useState<TranslationHookStatus>('idle');
  const [errorMessage, setErrorMessage] = React.useState<string | undefined>();

  React.useEffect(() => {
    if (!word) {
      setStatus('idle');
      setTranslation(null);
      return;
    }
    let mounted = true;
    const cacheKey = computeCacheKey(word, contextWindow, bookLanguage, nativeLanguage);

    void (async () => {
      const cached = await cacheRepo.findByKey(cacheKey);
      if (!mounted) return;
      if (cached) {
        setTranslation(cached);
        setStatus('cache-hit');
        return;
      }
      setStatus('inferring');
      try {
        const result = await service.translate({
          word, contextWindow, bookLanguage, nativeLanguage,
        });
        if (!mounted) return;
        if (result.status === 'ok' && result.translation) {
          const saved = await cacheRepo.upsertByKey({
            cacheKey,
            word, contextWindow, bookLanguage, nativeLanguage,
            translation: result.translation,
            grammar: result.grammarNote,
          });
          if (mounted) {
            setTranslation(saved);
            setStatus('cache-hit');
          }
        } else if (result.status === 'error') {
          setStatus('error');
          setErrorMessage(result.errorMessage);
        }
        // status='pending' (NoOp) — оставляем 'inferring' до настоящей #4
      } catch (err) {
        if (!mounted) return;
        setStatus('error');
        setErrorMessage(err instanceof Error ? err.message : String(err));
      }
    })();

    return () => {
      mounted = false;
    };
  }, [cacheRepo, word, contextWindow, bookLanguage, nativeLanguage, service]);

  return { translation, status, errorMessage };
}
