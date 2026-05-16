import { Model } from '@nozbe/watermelondb';
import { field } from '@nozbe/watermelondb/decorators';

export class WordOccurrenceModel extends Model {
  static override table = 'word_occurrences';

  @field('word_status_id') wordStatusId!: string;
  @field('book_id') bookId!: string;
  @field('chapter_order_index') chapterOrderIndex!: number | null;
  @field('context_sentence') contextSentence!: string;
  @field('created_at') createdAt!: number;
}
