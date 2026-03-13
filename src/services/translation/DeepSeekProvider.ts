import type { TranslationProvider, TranslateParams, TranslationResult } from './types'

const DEEPSEEK_API_URL = 'https://api.deepseek.com/v1/chat/completions'

/** Extract JSON from LLM response that may be wrapped in markdown code blocks */
function extractJson(raw: string): Record<string, unknown> {
  // Strip markdown code block wrappers if present
  const cleaned = raw.replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/, '').trim()
  return JSON.parse(cleaned)
}

export class DeepSeekProvider implements TranslationProvider {
  constructor(private apiKey: string) {}

  async translate(params: TranslateParams): Promise<TranslationResult> {
    const prompt = params.isPhrase
      ? `Translate phrase '${params.word}' in context '${params.sentence}', ${params.bookLanguage}→${params.nativeLanguage}. Give: translation, meaning as a whole. Respond in JSON: {"translation": "...", "grammar": null}`
      : `Translate '${params.word}' in context '${params.sentence}', ${params.bookLanguage}→${params.nativeLanguage}. Give: translation, brief explanation, example. Respond in JSON: {"translation": "...", "grammar": "..."}`

    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 3000) // 3s timeout per spec

    try {
      const response = await fetch(DEEPSEEK_API_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify({
          model: 'deepseek-chat',
          messages: [
            { role: 'system', content: 'You are a language learning assistant. Respond only with valid JSON, no markdown.' },
            { role: 'user', content: prompt },
          ],
          temperature: 0.3,
          max_tokens: 200,
        }),
        signal: controller.signal,
      })

      if (!response.ok) throw new Error(`DeepSeek API error: ${response.status}`)

      const data = await response.json()
      const content = data.choices?.[0]?.message?.content ?? ''
      const parsed = extractJson(content)

      return {
        translation: String(parsed.translation ?? content),
        grammar: parsed.grammar ? String(parsed.grammar) : null,
        fromCache: false,
      }
    } finally {
      clearTimeout(timeout)
    }
  }
}
