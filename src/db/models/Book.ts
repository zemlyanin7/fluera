import { Model } from '@nozbe/watermelondb'
import { field, date, children } from '@nozbe/watermelondb/decorators'

export class Book extends Model {
  static table = 'books'
  static associations = {
    chapters: { type: 'has_many' as const, foreignKey: 'book_id' },
    word_occurrences: { type: 'has_many' as const, foreignKey: 'book_id' },
    reading_stats: { type: 'has_many' as const, foreignKey: 'book_id' },
  }

  @field('title') title!: string
  @field('author') author!: string
  @field('language') language!: string
  @field('format') format!: string
  @field('file_path') filePath!: string
  @field('cover_path') coverPath!: string | null
  @field('source') source!: string
  @field('opds_url') opdsUrl!: string | null
  @field('progress') progress!: number
  @field('total_words') totalWords!: number
  @field('difficulty') difficulty!: number | null
  @date('added_at') addedAt!: Date
  @date('last_read_at') lastReadAt!: Date
}
