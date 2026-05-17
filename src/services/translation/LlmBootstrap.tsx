// Mount-once compose: refreshStatus → if installed, schedule
// load(warmup) после первого batch React interactions (не блокируем UI).
// Также wires TranslationServiceProvider с LlamaTranslationService.
import React, { useEffect, useMemo } from 'react';
import { InteractionManager } from 'react-native';
import { useDatabase } from '@/db/DatabaseContext';
import { useLlmStatusStore } from '@/stores/llmStatusStore';
import { useModelLifecycle } from './useModelLifecycle';
import { useLlmRuntime } from './useLlmRuntime';
import { createLlamaLoader } from './createLlamaLoader';
import { TranslationCacheRepository } from '@/db/repositories/TranslationCacheRepository';
import { CacheLayer } from './CacheLayer';
import { InferenceQueue } from './InferenceQueue';
import { LlamaContextManager } from './LlamaContextManager';
import { LlamaTranslationService } from './LlamaTranslationService';
import { TranslationServiceProvider, DictionaryProvider } from './TranslationServiceContext';
import { getKernelBuildId } from './kernelBuildId';
import { MODEL_MANIFEST } from './modelManifest';

const NINETY_DAYS_MS = 90 * 24 * 60 * 60 * 1000;

export function LlmBootstrap({ children }: { children: React.ReactNode }) {
  const db = useDatabase();
  const { refreshStatus } = useModelLifecycle();
  const { load } = useLlmRuntime({ loader: createLlamaLoader });
  const status = useLlmStatusStore((s) => s.status);

  // Service singleton per db instance.
  const service = useMemo(() => {
    const repo = new TranslationCacheRepository(db);
    const cache = new CacheLayer(
      repo,
      500,
      () => String(MODEL_MANIFEST.version),
      getKernelBuildId,
    );
    const queue = new InferenceQueue();
    return new LlamaTranslationService({
      contextProvider: () => LlamaContextManager.instance().getContext(),
      cache,
      queue,
    });
  }, [db]);

  // 1. Check installed status на mount.
  useEffect(() => {
    void refreshStatus();
  }, [refreshStatus]);

  // 2. Auto-load когда status стал installed.
  useEffect(() => {
    if (status === 'installed') {
      const task = InteractionManager.runAfterInteractions(() => {
        void load();
      });
      return () => task.cancel();
    }
    return undefined;
  }, [status, load]);

  // 3. Purge старого cache (90+ дней) при app start.
  useEffect(() => {
    const cutoff = Date.now() - NINETY_DAYS_MS;
    new TranslationCacheRepository(db).purgeOlderThan(cutoff).catch((e) => {
      if (__DEV__) console.warn('[translation] purge failed', e);
    });
  }, [db]);

  return (
    <TranslationServiceProvider service={service}>
      <DictionaryProvider>{children}</DictionaryProvider>
    </TranslationServiceProvider>
  );
}
