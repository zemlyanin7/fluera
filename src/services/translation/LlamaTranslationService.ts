// Главный TranslationService — оркестрирует cache lookup, prompt build,
// llama.cpp inference, post-processing, cache write. Hot-path:
// 1. status check → block early если model не ready
// 2. cache.lookup → return if hit
// 3. queue.run(completion) with timeout
// 4. cleanTranslation
// 5. cache.write (fire-and-forget)
// 6. return ok
import { useLlmStatusStore } from '@/stores/llmStatusStore';
import type {
  ITranslationService,
  TranslationInput,
  TranslationResult,
  TranslationErrorCode,
} from './ITranslationService';
import type { LlamaContext } from './llamaTypes';
import { CacheLayer } from './CacheLayer';
import { InferenceQueue } from './InferenceQueue';
import { buildPrompt } from './PromptBuilder';
import { cleanTranslation } from './cleanTranslation';

// 30s допуск: cold first inference (cache miss + STQ kernel прогрев Metal
// pipeline) может занять 10-20s даже на M-series. Cached lookups instant.
// CLAUDE.md SLA <3s применяется для warm cache hits, не cold start.
const DEFAULT_TIMEOUT_MS = 30000;

// Sampling tuned для 1.25-bit Sherry quant. На сильной компрессии logits
// noisy → требуется deterministic decoding + агрессивный repeat penalty
// чтобы не залипало в "ууууу"-loop.
// - temp 0.0 + top_k 1 = greedy (одинаковый top-1 token каждый шаг)
// - repeat_penalty 1.3 — bump чтобы кокнуть последовательные дубликаты
// - max_tokens 64 — Hy-MT может выдавать sentence-level перевод для phrase input
const INFERENCE_CONFIG = {
  temperature: 0.0,
  top_p: 1.0,
  top_k: 1,
  repeat_penalty: 1.3,
  max_tokens: 64,
  stop: ['\n'],
  n_threads: 4,
};

export interface LlamaTranslationServiceDeps {
  contextProvider: () => LlamaContext | null;
  cache: CacheLayer;
  queue: InferenceQueue;
  timeoutMs?: number;
}

function withTimeout<T>(p: Promise<T>, ms: number): Promise<T> {
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error('__timeout__')), ms);
    p.then(
      (v) => {
        clearTimeout(t);
        resolve(v);
      },
      (e) => {
        clearTimeout(t);
        reject(e);
      },
    );
  });
}

export class LlamaTranslationService implements ITranslationService {
  private deps: LlamaTranslationServiceDeps;
  private timeoutMs: number;

  constructor(deps: LlamaTranslationServiceDeps) {
    this.deps = deps;
    this.timeoutMs = deps.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  }

  async clearCache(): Promise<void> {
    this.deps.cache.clearMemory();
    await this.deps.cache.clearPersistent();
  }

  async translate(input: TranslationInput): Promise<TranslationResult> {
    const status = useLlmStatusStore.getState().status;
    if (status !== 'ready') {
      const code: TranslationErrorCode =
        status === 'loading' || status === 'warming_up' || status === 'verifying'
          ? 'MODEL_LOADING'
          : 'MODEL_NOT_INSTALLED';
      return { status: 'error', errorCode: code, errorMessage: `LLM not ready (${status})` };
    }

    const cached = await this.deps.cache.lookup(
      input.word,
      input.contextWindow,
      input.bookLanguage,
      input.nativeLanguage,
    );
    if (cached) {
      return { status: 'ok', translation: cached.value, source: cached.source };
    }

    const ctx = this.deps.contextProvider();
    if (!ctx) {
      return { status: 'error', errorCode: 'MODEL_LOADING', errorMessage: 'context null' };
    }

    const prompt = buildPrompt({
      word: input.word,
      sentence: input.contextWindow,
      bookLanguage: input.bookLanguage,
      nativeLanguage: input.nativeLanguage,
    });

    try {
      const t0 = Date.now();
      if (__DEV__) console.log(`[translate] start "${input.word}" prompt=${prompt.length}ch`);
      const raw = await this.deps.queue.run(() =>
        withTimeout(ctx.completion(prompt, INFERENCE_CONFIG), this.timeoutMs),
      );
      const dt = Date.now() - t0;
      if (__DEV__) console.log(`[translate] done "${input.word}" ${dt}ms → "${raw.text.slice(0, 60)}"`);
      const cleaned = cleanTranslation(raw.text);
      if (!cleaned) {
        return {
          status: 'error',
          errorCode: 'EMPTY_RESPONSE',
          errorMessage: 'whitespace output',
        };
      }
      await this.deps.cache.write(
        input.word,
        input.contextWindow,
        input.bookLanguage,
        input.nativeLanguage,
        cleaned,
        { inferenceContext: 'warm' },
      );
      return { status: 'ok', translation: cleaned, source: 'inference' };
    } catch (e) {
      const msg = (e as Error).message;
      if (msg === '__timeout__') {
        return { status: 'error', errorCode: 'INFERENCE_TIMEOUT', errorMessage: 'timed out' };
      }
      return { status: 'error', errorCode: 'INFERENCE_FAILED', errorMessage: msg };
    }
  }
}
