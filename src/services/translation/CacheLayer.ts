// Two-tier cache: in-memory LRU (~500 entries) для <50ms hot-path,
// WatermelonDB persist для cross-session memory. lookup memory → DB → null.
// write fires async DB upsert не блокируя caller.
//
// Cold inference rule: cold-инференсы (первые ~30s после warm-up) записываются
// только в in-memory LRU, НЕ в DB. Warm инференсы персистируются в DB.
import { buildCacheKey, buildSentenceCacheKey } from './cacheKey';
import { InMemoryLRU } from './InMemoryLRU';
import type { TranslationCacheRepository } from '@/db/repositories/TranslationCacheRepository';
import type { BookLanguage, NativeLanguage } from '@/types/settings';
import type { InferenceContext } from './inferenceContext';

export type CacheSource = 'memory' | 'db';
export type TranslationSource = 'on_demand' | 'prefetch';

export interface CacheLookupResult {
  value: string;
  source: CacheSource;
}

export interface WriteOptions {
  inferenceContext: InferenceContext;
  // #4.6 Translation Prefetch + Lifecycle — provenance + TTL по source.
  // Default 'on_demand' (TTL 90d). 'prefetch' → TTL 30d (shorter — lower
  // quality risk + faster eviction if user never visits these pages).
  source?: TranslationSource;
}

const TTL_BY_SOURCE: Record<TranslationSource, number> = {
  on_demand: 90,
  prefetch: 30,
};

export interface SentenceLookupResult {
  sentenceTranslation: string;
  translatedWordOffset: number | null;
  source: CacheSource;
}

export class CacheLayer {
  private lru: InMemoryLRU<string>;
  private sentenceLru: InMemoryLRU<SentenceLookupResult>;

  constructor(
    private repo: TranslationCacheRepository,
    capacity: number,
    private getModelVersion: () => string,
    private getKernelBuildId: () => string,
  ) {
    this.lru = new InMemoryLRU<string>(capacity);
    this.sentenceLru = new InMemoryLRU<SentenceLookupResult>(capacity);
  }

  private async wordKey(
    word: string,
    contextWindow: string,
    bookLanguage: BookLanguage,
    nativeLanguage: NativeLanguage,
  ): Promise<string> {
    return buildCacheKey({
      word,
      contextWindow,
      bookLanguage,
      nativeLanguage,
      modelVersion: this.getModelVersion(),
      kernelBuildId: this.getKernelBuildId(),
    });
  }

  private async sentKey(
    sentence: string,
    bookLanguage: BookLanguage,
    nativeLanguage: NativeLanguage,
  ): Promise<string> {
    return buildSentenceCacheKey({
      sentence,
      bookLanguage,
      nativeLanguage,
      modelVersion: this.getModelVersion(),
      kernelBuildId: this.getKernelBuildId(),
    });
  }

  async lookup(
    word: string,
    contextWindow: string,
    bookLanguage: BookLanguage,
    nativeLanguage: NativeLanguage,
  ): Promise<CacheLookupResult | null> {
    const key = await this.wordKey(word, contextWindow, bookLanguage, nativeLanguage);
    const mem = this.lru.get(key);
    if (mem !== undefined) return { value: mem, source: 'memory' };

    const fromDb = await this.repo.findByKey(key);
    if (fromDb) {
      // #4.6 P1-G: lazy TTL purge. If row expired по ttl_days, delete inline +
      // treat as miss. Bulk sweep via repo.purgeExpiredBySource() happens on
      // schedule elsewhere; this catches expired-but-not-yet-swept rows on
      // hot path.
      const ttlMs = (fromDb.ttlDays ?? 90) * 24 * 60 * 60 * 1000;
      if (Date.now() - fromDb.createdAt > ttlMs) {
        void this.repo.deleteByKey(key).catch(() => {});
        return null;
      }
      this.lru.set(key, fromDb.translation);
      return { value: fromDb.translation, source: 'db' };
    }
    return null;
  }

  async write(
    word: string,
    contextWindow: string,
    bookLanguage: BookLanguage,
    nativeLanguage: NativeLanguage,
    translation: string,
    opts: WriteOptions = { inferenceContext: 'warm' },
  ): Promise<void> {
    const key = await this.wordKey(word, contextWindow, bookLanguage, nativeLanguage);
    this.lru.set(key, translation);

    // Cold inference: не персистируем в DB, только в память
    if (opts.inferenceContext === 'cold') return;

    // Fire-and-forget DB write — не блокируем popup на disk I/O
    const source: TranslationSource = opts.source ?? 'on_demand';
    this.repo
      .upsertByKey({
        cacheKey: key,
        word,
        contextWindow,
        bookLanguage,
        nativeLanguage,
        translation,
        inferenceContext: opts.inferenceContext,
        modelVersion: this.getModelVersion(),
        kernelBuildId: this.getKernelBuildId(),
        source,
        ttlDays: TTL_BY_SOURCE[source],
      })
      .catch((e) => {
        if (__DEV__) console.warn('[translation] cache DB write failed:', e);
      });
  }

  async sentenceLookup(
    sentence: string,
    bookLanguage: BookLanguage,
    nativeLanguage: NativeLanguage,
  ): Promise<SentenceLookupResult | null> {
    const key = await this.sentKey(sentence, bookLanguage, nativeLanguage);
    const mem = this.sentenceLru.get(key);
    if (mem !== undefined) return mem;

    const fromDb = await this.repo.findSentenceByKey(key);
    if (fromDb?.sentenceTranslation) {
      const result: SentenceLookupResult = {
        sentenceTranslation: fromDb.sentenceTranslation,
        translatedWordOffset: fromDb.translatedWordOffset,
        source: 'db',
      };
      this.sentenceLru.set(key, result);
      return result;
    }
    return null;
  }

  async writeSentence(
    sentence: string,
    bookLanguage: BookLanguage,
    nativeLanguage: NativeLanguage,
    translatedSentence: string,
    offset: number | null,
    opts: WriteOptions = { inferenceContext: 'warm' },
  ): Promise<void> {
    const key = await this.sentKey(sentence, bookLanguage, nativeLanguage);
    const result: SentenceLookupResult = {
      sentenceTranslation: translatedSentence,
      translatedWordOffset: offset,
      source: 'memory',
    };
    this.sentenceLru.set(key, result);

    // Cold inference: не персистируем в DB
    if (opts.inferenceContext === 'cold') return;

    const source: TranslationSource = opts.source ?? 'on_demand';
    this.repo
      .upsertSentenceByKey({
        cacheKey: key,
        bookLanguage,
        nativeLanguage,
        sentenceTranslation: translatedSentence,
        translatedWordOffset: offset,
        inferenceContext: opts.inferenceContext,
        modelVersion: this.getModelVersion(),
        kernelBuildId: this.getKernelBuildId(),
        source,
        ttlDays: TTL_BY_SOURCE[source],
      })
      .catch((e) => {
        if (__DEV__) console.warn('[translation] sentence cache DB write failed:', e);
      });
  }

  clearMemory(): void {
    this.lru.clear();
    this.sentenceLru.clear();
  }

  async clearPersistent(): Promise<void> {
    await this.repo.clearAll();
  }
}
