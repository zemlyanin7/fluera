import type { TranslationProvider, TranslateParams, TranslationResult } from './types'

const GEMINI_API_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-lite:generateContent'

/** Extract JSON from LLM response that may be wrapped in markdown code blocks */
function extractJson(raw: string): Record<string, unknown> {
  const cleaned = raw.replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/, '').trim()
  return JSON.parse(cleaned)
}

export class GeminiProvider implements TranslationProvider {
  constructor(private apiKey: string) {}

  async translate(params: TranslateParams): Promise<TranslationResult> {
    const prompt = params.isPhrase
      ? `Translate phrase '${params.word}' in context '${params.sentence}', ${params.bookLanguage}→${params.nativeLanguage}. Give: translation, meaning as a whole. Respond in JSON: {"translation": "...", "grammar": null}`
      : `Translate '${params.word}' in context '${params.sentence}', ${params.bookLanguage}→${params.nativeLanguage}. Give: translation, brief explanation, example. Respond in JSON: {"translation": "...", "grammar": "..."}`

    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 5000) // 5s timeout for fallback per spec

    try {
      const response = await fetch(`${GEMINI_API_URL}?key=${this.apiKey}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: { temperature: 0.3, maxOutputTokens: 200 },
        }),
        signal: controller.signal,
      })

      if (!response.ok) throw new Error(`Gemini API error: ${response.status}`)

      const data = await response.json()
      const content = data.candidates?.[0]?.content?.parts?.[0]?.text ?? ''
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
