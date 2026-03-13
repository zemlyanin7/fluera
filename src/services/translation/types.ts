export interface TranslationResult {
  translation: string
  grammar: string | null
  fromCache: boolean
}

export interface TranslationProvider {
  translate(params: TranslateParams): Promise<TranslationResult>
}

export interface TranslateParams {
  word: string
  sentence: string
  bookLanguage: string
  nativeLanguage: string
  isPhrase: boolean
}
