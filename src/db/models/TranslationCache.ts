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
  // #4.5 Translation Popup — sentence translation + inference metadata
  @field('sentence_translation') sentenceTranslation!: string | null;
  @field('translated_word_offset') translatedWordOffset!: number | null;
  @field('inference_context') inferenceContext!: string;
  @field('model_version') modelVersion!: string;
  @field('kernel_build_id') kernelBuildId!: string | null;
  // #4.6 Translation Prefetch + Lifecycle — provenance + TTL по source
  @field('source') source!: 'on_demand' | 'prefetch';
  @field('ttl_days') ttlDays!: number;
  @field('chrf_score') chrfScore!: number | null;
}
