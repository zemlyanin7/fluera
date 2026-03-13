import { Model } from '@nozbe/watermelondb'
import { field } from '@nozbe/watermelondb/decorators'

export class UserSettings extends Model {
  static table = 'user_settings'

  @field('native_language') nativeLanguage!: string
  @field('book_language') bookLanguage!: string
  @field('theme') theme!: string
  @field('font_size') fontSize!: number
  @field('font_family') fontFamily!: string
  @field('line_height') lineHeight!: number
  @field('show_word_colors') showWordColors!: boolean
}
