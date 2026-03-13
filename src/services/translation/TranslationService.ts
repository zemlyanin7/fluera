import type { TranslationProvider, TranslateParams, TranslationResult } from './types'

interface TranslationCacheInterface {
  get(key: string): Promise<TranslationResult | null>
  set(key: string, result: TranslationResult): Promise<void>
  buildKey(word: string, sentence: string, bookLang: string, nativeLang: string): string
}

export class TranslationService {
  constructor(
    private primary: TranslationProvider,
    private fallback: TranslationProvider,
    private cache: TranslationCacheInterface,
  ) {}

  async translate(params: TranslateParams): Promise<TranslationResult> {
    const cacheKey = this.cache.buildKey(
      params.word, params.sentence, params.bookLanguage, params.nativeLanguage
    )

    const cached = await this.cache.get(cacheKey)
    if (cached) return { ...cached, fromCache: true }

    const result = await this.callWithFallback(params)

    await this.cache.set(cacheKey, result).catch(() => {})

    return result
  }

  private async callWithFallback(params: TranslateParams): Promise<TranslationResult> {
    try {
      return await this.callWithRetry(this.primary, params, 1)
    } catch {
      return await this.callWithRetry(this.fallback, params, 0)
    }
  }

  private async callWithRetry(
    provider: TranslationProvider,
    params: TranslateParams,
    retries: number,
  ): Promise<TranslationResult> {
    let lastError: Error | undefined
    for (let attempt = 0; attempt <= retries; attempt++) {
      try {
        return await provider.translate(params)
      } catch (e) {
        lastError = e instanceof Error ? e : new Error(String(e))
        if (attempt < retries) await new Promise((r) => setTimeout(r, 1000))
      }
    }
    throw lastError
  }
}
