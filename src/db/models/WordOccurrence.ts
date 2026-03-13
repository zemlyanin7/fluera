import { Model } from '@nozbe/watermelondb'
import { field, relation } from '@nozbe/watermelondb/decorators'

export class WordOccurrence extends Model {
  static table = 'word_occurrences'
  static associations = {
    word_statuses: { type: 'belongs_to' as const, key: 'word_status_id' },
    books: { type: 'belongs_to' as const, key: 'book_id' },
  }

  @field('word_status_id') wordStatusId!: string
  @field('book_id') bookId!: string
  @field('chapter_title') chapterTitle!: string
  @field('context_sentence') contextSentence!: string
  @field('created_at') createdAt!: number
}
