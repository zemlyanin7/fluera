// Главный TranslationService — оркестрирует cache lookup, prompt build,
// llama.cpp inference, post-processing, cache write. Hot-path:
// 1. status check → block early если model не ready
// 2. cache.lookup → return if hit
// 3. queue.run(completion) with timeout
// 4. cleanTranslation
// 5. cache.write (fire-and-forget)
// 6. return ok
//
// translateSentence (experimental, #4.5) — sentence-level перевод через
// jinja chat-template mode. Использует messages array вместо строки промпта.
// Всегда помечает результат experimental=true.
import { useLlmStatusStore } from '@/stores/llmStatusStore';
import type {
  ITranslationService,
  TranslationInput,
  TranslationResult,
  TranslationErrorCode,
  SentenceTranslationInput,
  SentenceTranslationResult,
} from './ITranslationService';
import type { LlamaContext } from './llamaTypes';
import { CacheLayer } from './CacheLayer';
import { InferenceQueue } from './InferenceQueue';
import { buildPrompt, buildSentencePrompt } from './PromptBuilder';
import { cleanTranslation } from './cleanTranslation';
import { cleanSentenceTranslation } from './sentence/cleanSentenceTranslation';
import { tryAlignWord } from './sentence/tryAlignWord';
import type { InferenceContextTracker } from './inferenceContext';

// 30s допуск: cold first inference (cache miss + STQ kernel прогрев Metal
// pipeline) может занять 10-20s даже на M-series. Cached lookups instant.
// CLAUDE.md SLA <3s применяется для warm cache hits, не cold start.
const DEFAULT_TIMEOUT_MS = 30000;

// Sentence inference: более мягкий sampling для natural sentence output.
// temp 0.3 + top_k 40 вместо greedy — более natural sentences, допустимые
// варианты перевода. max_tokens 200 для длинных предложений.
const SENTENCE_INFERENCE_CONFIG = {
  temperature: 0.3,
  top_p: 0.95,
  top_k: 40,
  repeat_penalty: 1.15,
  max_tokens: 200,
  stop: ['\n\n'],
  n_threads: 4,
};

// Sentence timeout: CLAUDE.md SLA — sentence translation 5-15s warm, 10-25s cold.
// Даём 45s — с запасом для cold start.
const DEFAULT_SENTENCE_TIMEOUT_MS = 45000;

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
  sentenceTimeoutMs?: number;
  inferenceTracker?: InferenceContextTracker;
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
  private sentenceTimeoutMs: number;

  constructor(deps: LlamaTranslationServiceDeps) {
    this.deps = deps;
    this.timeoutMs = deps.timeoutMs ?? DEFAULT_TIMEOUT_MS;
    this.sentenceTimeoutMs = deps.sentenceTimeoutMs ?? DEFAULT_SENTENCE_TIMEOUT_MS;
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

  async translateSentence(input: SentenceTranslationInput): Promise<SentenceTranslationResult> {
    const status = useLlmStatusStore.getState().status;
    if (status !== 'ready') {
      const code: TranslationErrorCode =
        status === 'loading' || status === 'warming_up' || status === 'verifying'
          ? 'MODEL_LOADING'
          : 'MODEL_NOT_INSTALLED';
      return { status: 'error', errorCode: code, errorMessage: `LLM not ready (${status})`, experimental: true };
    }

    // Cache lookup
    const cached = await this.deps.cache.sentenceLookup(
      input.sentence,
      input.bookLanguage,
      input.nativeLanguage,
    );
    if (cached) {
      return {
        status: 'ok',
        sourceSentence: input.sentence,
        translatedSentence: cached.sentenceTranslation,
        translatedWordOffset: cached.translatedWordOffset ?? undefined,
        experimental: true,
        source: cached.source,
      };
    }

    const ctx = this.deps.contextProvider();
    if (!ctx) {
      return { status: 'error', errorCode: 'MODEL_LOADING', errorMessage: 'context null', experimental: true };
    }

    const messages = buildSentencePrompt({
      sentence: input.sentence,
      bookLanguage: input.bookLanguage,
      nativeLanguage: input.nativeLanguage,
    });

    try {
      const t0 = Date.now();
      if (__DEV__) console.log(`[translateSentence] start len=${input.sentence.length}`);
      // Adapter принимает либо string либо ChatMsg[]. Передаём messages array
      // (system + user) — adapter wraps в jinja messages → chat template модели.
      const raw = await this.deps.queue.run(() =>
        withTimeout(ctx.completion(messages, SENTENCE_INFERENCE_CONFIG), this.sentenceTimeoutMs),
      );
      const dt = Date.now() - t0;
      if (__DEV__) console.log(`[translateSentence] done ${dt}ms → "${raw.text.slice(0, 60)}"`);

      const translatedSentence = cleanSentenceTranslation(raw.text);
      if (!translatedSentence) {
        return { status: 'error', errorCode: 'EMPTY_RESPONSE', errorMessage: 'whitespace output', experimental: true };
      }

      // Optional word alignment via tryAlignWord
      let translatedWordOffset: number | undefined;
      if (input.sourceWord !== undefined && input.wordOffset !== undefined) {
        // Lookup cached word translation to align (best-effort)
        const wordCached = await this.deps.cache.lookup(
          input.sourceWord,
          input.sentence,
          input.bookLanguage,
          input.nativeLanguage,
        );
        translatedWordOffset = tryAlignWord({
          sourceSentence: input.sentence,
          wordOffset: input.wordOffset,
          sourceWord: input.sourceWord,
          translatedSentence,
          knownWordTranslation: wordCached?.value,
        });
      }

      const inferenceContext = this.deps.inferenceTracker?.current() ?? 'warm';

      // Fire-and-forget cache write
      this.deps.cache
        .writeSentence(
          input.sentence,
          input.bookLanguage,
          input.nativeLanguage,
          translatedSentence,
          translatedWordOffset ?? null,
          { inferenceContext },
        )
        .catch((e) => {
          if (__DEV__) console.warn('[translateSentence] cache write failed:', e);
        });

      return {
        status: 'ok',
        sourceSentence: input.sentence,
        translatedSentence,
        translatedWordOffset,
        experimental: true,
        inferenceContext,
        source: 'inference',
      };
    } catch (e) {
      const msg = (e as Error).message;
      if (msg === '__timeout__') {
        return { status: 'error', errorCode: 'INFERENCE_TIMEOUT', errorMessage: 'timed out', experimental: true };
      }
      return { status: 'error', errorCode: 'INFERENCE_FAILED', errorMessage: msg, experimental: true };
    }
  }
}
