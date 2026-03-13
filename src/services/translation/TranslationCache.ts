import type { TranslationResult } from './types'

/**
 * In-memory LRU cache for translations.
 * For MVP, this lives in memory. When WatermelonDB integration is wired up
 * for the full reader flow, this will delegate to the TranslationCacheEntry table.
 */
export class TranslationCache {
  private cache = new Map<string, TranslationResult>()
  private maxEntries: number

  constructor(maxEntries = 100_000) {
    this.maxEntries = maxEntries
  }

  async get(key: string): Promise<TranslationResult | null> {
    const entry = this.cache.get(key)
    if (!entry) return null
    // LRU: move to end
    this.cache.delete(key)
    this.cache.set(key, entry)
    return { ...entry, fromCache: true }
  }

  async set(key: string, result: TranslationResult): Promise<void> {
    if (this.cache.size >= this.maxEntries) {
      // Evict oldest (first entry in Map)
      const oldest = this.cache.keys().next().value
      if (oldest !== undefined) this.cache.delete(oldest)
    }
    this.cache.set(key, result)
  }

  buildKey(word: string, sentence: string, bookLang: string, nativeLang: string): string {
    const input = `${word.toLowerCase()}:${sentence.toLowerCase()}:${bookLang}:${nativeLang}`
    // Synchronous hash for cache key
    let hash = 0
    for (let i = 0; i < input.length; i++) {
      const char = input.charCodeAt(i)
      hash = ((hash << 5) - hash) + char
      hash = hash & hash // Convert to 32-bit integer
    }
    return `tc_${Math.abs(hash).toString(36)}_${bookLang}_${nativeLang}`
  }
}
