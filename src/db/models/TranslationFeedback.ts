import { Model } from '@nozbe/watermelondb';
import { field } from '@nozbe/watermelondb/decorators';

export class TranslationFeedbackModel extends Model {
  static override table = 'translation_feedback';

  @field('source_sentence') sourceSentence!: string;
  @field('translated_sentence') translatedSentence!: string;
  @field('book_language') bookLanguage!: string;
  @field('native_language') nativeLanguage!: string;
  @field('model_version') modelVersion!: string;
  @field('kernel_build_id') kernelBuildId!: string | null;
  @field('book_id') bookId!: string | null;
  @field('created_at') createdAt!: number;
}
