// Two-tier cache: in-memory LRU (~500 entries) для <50ms hot-path,
// WatermelonDB persist для cross-session memory. lookup memory → DB →
// null. write fires async DB upsert не блокируя caller.
//
// Key = SHA-256 32-char truncated of normalized inputs (см. spec §5.1).
import * as Crypto from 'expo-crypto';
import { InMemoryLRU } from './InMemoryLRU';
import type { TranslationCacheRepository } from '@/db/repositories/TranslationCacheRepository';
import type { BookLanguage, NativeLanguage } from '@/types/settings';

export type CacheSource = 'memory' | 'db';

export interface CacheLookupResult {
  value: string;
  source: CacheSource;
}

export class CacheLayer {
  private lru: InMemoryLRU<string>;

  constructor(
    private repo: TranslationCacheRepository,
    capacity: number,
  ) {
    this.lru = new InMemoryLRU<string>(capacity);
  }

  async cacheKey(
    word: string,
    contextWindow: string,
    bookLanguage: BookLanguage,
    nativeLanguage: NativeLanguage,
  ): Promise<string> {
    const input = `${word.toLowerCase().trim()}::${contextWindow.trim()}::${bookLanguage}-${nativeLanguage}`;
    const hash = await Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, input);
    return hash.slice(0, 32);
  }

  async lookup(
    word: string,
    contextWindow: string,
    bookLanguage: BookLanguage,
    nativeLanguage: NativeLanguage,
  ): Promise<CacheLookupResult | null> {
    const key = await this.cacheKey(word, contextWindow, bookLanguage, nativeLanguage);
    const mem = this.lru.get(key);
    if (mem !== undefined) return { value: mem, source: 'memory' };

    const fromDb = await this.repo.findByKey(key);
    if (fromDb) {
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
  ): Promise<void> {
    const key = await this.cacheKey(word, contextWindow, bookLanguage, nativeLanguage);
    this.lru.set(key, translation);
    // Fire-and-forget DB write — не блокируем popup на disk I/O.
    this.repo
      .upsertByKey({
        cacheKey: key,
        word,
        contextWindow,
        bookLanguage,
        nativeLanguage,
        translation,
      })
      .catch((e) => {
        if (__DEV__) console.warn('[translation] cache DB write failed:', e);
      });
  }

  clearMemory(): void {
    this.lru.clear();
  }
}
