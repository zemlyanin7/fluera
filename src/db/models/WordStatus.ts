import { Model } from '@nozbe/watermelondb'
import { field, children } from '@nozbe/watermelondb/decorators'

export class WordStatus extends Model {
  static table = 'word_statuses'
  static associations = {
    word_occurrences: { type: 'has_many' as const, foreignKey: 'word_status_id' },
  }

  @field('word') word!: string
  @field('book_language') bookLanguage!: string
  @field('native_language') nativeLanguage!: string
  @field('word_lang_key') wordLangKey!: string
  @field('status') status!: number
  @field('translation') translation!: string
  @field('srs_interval') srsInterval!: number
  @field('srs_ease_factor') srsEaseFactor!: number
  @field('srs_next_review') srsNextReview!: number | null
  @field('srs_repetitions') srsRepetitions!: number
  @field('grammar_note') grammarNote!: string | null
  @field('created_at') createdAt!: number
  @field('updated_at') updatedAt!: number

  static buildWordLangKey(word: string, bookLang: string, nativeLang: string): string {
    return `${word.toLowerCase()}:${bookLang}:${nativeLang}`
  }
}
