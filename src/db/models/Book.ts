import { Model } from '@nozbe/watermelondb';
import { field } from '@nozbe/watermelondb/decorators';

export class BookModel extends Model {
  static override table = 'books';

  @field('title') title!: string;
  @field('author') author!: string | null;
  @field('language') language!: string;
  @field('format') format!: string;
  @field('file_path') filePath!: string;
  @field('cover_path') coverPath!: string | null;
  @field('source') source!: string;
  @field('opds_catalog_id') opdsCatalogId!: string | null;
  @field('total_chars') totalChars!: number;
  @field('progress') progress!: number;
  @field('difficulty') difficulty!: number | null;
  @field('difficulty_computed_at') difficultyComputedAt!: number | null;
  @field('added_at') addedAt!: number;
  @field('last_read_at') lastReadAt!: number | null;
  @field('archived') archived!: boolean;
}
