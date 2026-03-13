import { TranslationService } from '../../../src/services/translation/TranslationService'
import type { TranslationProvider, TranslateParams, TranslationResult } from '../../../src/services/translation/types'

class MockProvider implements TranslationProvider {
  callCount = 0
  shouldFail = false

  async translate(params: TranslateParams): Promise<TranslationResult> {
    this.callCount++
    if (this.shouldFail) throw new Error('API error')
    return { translation: `translated: ${params.word}`, grammar: null, fromCache: false }
  }
}

class MockCache {
  private store = new Map<string, TranslationResult>()

  async get(key: string): Promise<TranslationResult | null> {
    return this.store.get(key) ?? null
  }

  async set(key: string, result: TranslationResult): Promise<void> {
    this.store.set(key, result)
  }

  buildKey(word: string, sentence: string, bookLang: string, nativeLang: string): string {
    return `${word}:${bookLang}:${nativeLang}`
  }
}

describe('TranslationService', () => {
  let primary: MockProvider
  let fallback: MockProvider
  let cache: MockCache
  let service: TranslationService

  beforeEach(() => {
    primary = new MockProvider()
    fallback = new MockProvider()
    cache = new MockCache()
    service = new TranslationService(primary, fallback, cache as any)
  })

  const params: TranslateParams = {
    word: 'fireplace',
    sentence: 'sat by the fireplace',
    bookLanguage: 'en',
    nativeLanguage: 'ru',
    isPhrase: false,
  }

  it('returns cached result if available', async () => {
    await cache.set(cache.buildKey('fireplace', 'sat by the fireplace', 'en', 'ru'), {
      translation: 'камин', grammar: null, fromCache: true,
    })
    const result = await service.translate(params)
    expect(result.translation).toBe('камин')
    expect(result.fromCache).toBe(true)
    expect(primary.callCount).toBe(0)
  })

  it('calls primary provider on cache miss', async () => {
    const result = await service.translate(params)
    expect(result.translation).toBe('translated: fireplace')
    expect(primary.callCount).toBe(1)
  })

  it('falls back to secondary on primary failure', async () => {
    primary.shouldFail = true
    const result = await service.translate(params)
    expect(result.translation).toBe('translated: fireplace')
    expect(primary.callCount).toBeGreaterThanOrEqual(1)
    expect(fallback.callCount).toBe(1)
  })

  it('throws when both providers fail', async () => {
    primary.shouldFail = true
    fallback.shouldFail = true
    await expect(service.translate(params)).rejects.toThrow()
  })
})
