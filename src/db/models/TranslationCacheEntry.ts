import { Model } from '@nozbe/watermelondb'
import { field } from '@nozbe/watermelondb/decorators'

export class TranslationCacheEntry extends Model {
  static table = 'translation_cache'

  @field('cache_key') cacheKey!: string
  @field('word') word!: string
  @field('context') context!: string
  @field('book_lang') bookLang!: string
  @field('native_lang') nativeLang!: string
  @field('translation') translation!: string
  @field('grammar') grammar!: string | null
  @field('created_at') createdAt!: number
}
