import { Model } from '@nozbe/watermelondb';
import { field } from '@nozbe/watermelondb/decorators';

export class ChapterModel extends Model {
  static override table = 'chapters';

  @field('book_id') bookId!: string;
  @field('title') title!: string | null;
  @field('order_index') orderIndex!: number;
  @field('start_char') startChar!: number;
  @field('end_char') endChar!: number;
}
