// Hook оркеструет: load model → warm-up → ready. Используется в
// RootLayout LlmBootstrap на app start (если model installed).
import { useCallback } from 'react';
import { useLlmStatusStore } from '@/stores/llmStatusStore';
import { LlamaContextManager } from './LlamaContextManager';
import type { LlamaContext } from './llamaTypes';

export interface UseLlmRuntimeOptions {
  loader: () => Promise<LlamaContext>;
}

export interface UseLlmRuntimeResult {
  load: () => Promise<void>;
  unload: () => Promise<void>;
}

export function useLlmRuntime(opts: UseLlmRuntimeOptions): UseLlmRuntimeResult {
  const setStatus = useLlmStatusStore((s) => s.setStatus);
  const setError = useLlmStatusStore((s) => s.setError);

  const load = useCallback(async () => {
    const cur = useLlmStatusStore.getState().status;
    if (cur !== 'installed') return;
    setStatus('loading');
    try {
      const tLoad = Date.now();
      if (__DEV__) console.log('[llm] load start');
      const ctx = await LlamaContextManager.instance().load(opts.loader);
      if (__DEV__) console.log(`[llm] load done ${Date.now() - tLoad}ms`);
      setStatus('warming_up');
      // Warm-up: короткий dummy inference. Прогревает KV-cache + GPU pipeline.
      const tWarm = Date.now();
      if (__DEV__) console.log('[llm] warmup start');
      await ctx
        .completion('Hello.', { temperature: 0.2, max_tokens: 8, stop: ['\n'] })
        .then((r) => {
          if (__DEV__)
            console.log(`[llm] warmup done ${Date.now() - tWarm}ms text="${r.text}"`);
        })
        .catch((e) => {
          if (__DEV__) console.warn('[llm] warmup failed', e);
        });
      setStatus('ready');
    } catch (e) {
      setError(`LLM load failed: ${(e as Error).message}`);
    }
  }, [opts.loader, setStatus, setError]);

  const unload = useCallback(async () => {
    await LlamaContextManager.instance().unload();
    setStatus('installed');
  }, [setStatus]);

  return { load, unload };
}
