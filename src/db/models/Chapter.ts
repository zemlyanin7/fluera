import { Model } from '@nozbe/watermelondb'
import { field, relation } from '@nozbe/watermelondb/decorators'

export class Chapter extends Model {
  static table = 'chapters'
  static associations = {
    books: { type: 'belongs_to' as const, key: 'book_id' },
  }

  @field('book_id') bookId!: string
  @field('title') title!: string
  @field('order_index') orderIndex!: number
  @field('progress') progress!: number
}
