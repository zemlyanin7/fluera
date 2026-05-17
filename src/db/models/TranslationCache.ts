import { Model } from '@nozbe/watermelondb';
import { field } from '@nozbe/watermelondb/decorators';

export class TranslationCacheModel extends Model {
  static override table = 'translation_cache';

  @field('cache_key') cacheKey!: string;
  @field('word') word!: string;
  @field('context_window') contextWindow!: string;
  @field('book_language') bookLanguage!: string;
  @field('native_language') nativeLanguage!: string;
  @field('translation') translation!: string;
  @field('grammar') grammar!: string | null;
  @field('created_at') createdAt!: number;
}
