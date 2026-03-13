import { Model } from '@nozbe/watermelondb'
import { field } from '@nozbe/watermelondb/decorators'

export class ReadingStats extends Model {
  static table = 'reading_stats'

  @field('date') date!: string
  @field('book_id') bookId!: string | null
  @field('words_read') wordsRead!: number
  @field('words_learned') wordsLearned!: number
  @field('time_reading_sec') timeReadingSec!: number
  @field('translations_made') translationsMade!: number
}
