import { Model } from '@nozbe/watermelondb';
import { field } from '@nozbe/watermelondb/decorators';

export class ReadingStatsModel extends Model {
  static override table = 'reading_stats';

  // (date, book_id) deterministic ID = `${date}__${book_id}`. Для "all books"
  // sentinel book_id = '__all__' (NOT NULL — SQLite UNIQUE с NULL ломается).
  @field('date') date!: string;
  @field('book_id') bookId!: string;
  @field('seconds_reading') secondsReading!: number;
  @field('words_read') wordsRead!: number;
  @field('words_translated') wordsTranslated!: number;
  @field('words_added_to_deck') wordsAddedToDeck!: number;
  @field('words_learned') wordsLearned!: number;
  @field('updated_at') updatedAt!: number;
}
