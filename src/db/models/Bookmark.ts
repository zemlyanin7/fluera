import { Model } from '@nozbe/watermelondb';
import { field } from '@nozbe/watermelondb/decorators';

export class BookmarkModel extends Model {
  static override table = 'bookmarks';

  @field('book_id') bookId!: string;
  @field('chapter_order_index') chapterOrderIndex!: number;
  @field('position_data') positionData!: string;
  @field('note') note!: string | null;
  @field('created_at') createdAt!: number;
}
