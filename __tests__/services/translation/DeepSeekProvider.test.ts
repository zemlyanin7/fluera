import { DeepSeekProvider } from '../../../src/services/translation/DeepSeekProvider'

// Mock global fetch
const mockFetch = jest.fn()
global.fetch = mockFetch

describe('DeepSeekProvider', () => {
  const provider = new DeepSeekProvider('test-api-key')
  const params = {
    word: 'fireplace',
    sentence: 'sat by the fireplace',
    bookLanguage: 'en',
    nativeLanguage: 'ru',
    isPhrase: false,
  }

  afterEach(() => mockFetch.mockReset())

  it('returns parsed translation from API response', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        choices: [{ message: { content: '{"translation": "камин", "grammar": "noun"}' } }],
      }),
    })
    const result = await provider.translate(params)
    expect(result.translation).toBe('камин')
    expect(result.grammar).toBe('noun')
    expect(result.fromCache).toBe(false)
  })

  it('handles JSON wrapped in markdown code blocks', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        choices: [{ message: { content: '```json\n{"translation": "камин", "grammar": null}\n```' } }],
      }),
    })
    const result = await provider.translate(params)
    expect(result.translation).toBe('камин')
  })

  it('throws on non-OK HTTP response', async () => {
    mockFetch.mockResolvedValueOnce({ ok: false, status: 429 })
    await expect(provider.translate(params)).rejects.toThrow('DeepSeek API error: 429')
  })

  it('sends correct Authorization header', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        choices: [{ message: { content: '{"translation": "t", "grammar": null}' } }],
      }),
    })
    await provider.translate(params)
    expect(mockFetch).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        headers: expect.objectContaining({
          Authorization: 'Bearer test-api-key',
        }),
      }),
    )
  })
})
