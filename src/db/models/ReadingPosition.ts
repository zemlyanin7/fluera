import { Model } from '@nozbe/watermelondb';
import { field } from '@nozbe/watermelondb/decorators';

export class ReadingPositionModel extends Model {
  static override table = 'reading_positions';

  @field('book_id') bookId!: string;
  @field('chapter_order_index') chapterOrderIndex!: number;
  @field('position_data') positionData!: string;
  @field('updated_at') updatedAt!: number;
}
