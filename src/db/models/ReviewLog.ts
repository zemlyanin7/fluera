import { Model } from '@nozbe/watermelondb';
import { field } from '@nozbe/watermelondb/decorators';

export class ReviewLogModel extends Model {
  static override table = 'review_logs';

  @field('word_status_id') wordStatusId!: string;
  @field('rating') rating!: number;
  @field('reviewed_at') reviewedAt!: number;
  @field('elapsed_days') elapsedDays!: number;
  @field('scheduled_days') scheduledDays!: number;
  @field('state_before') stateBefore!: number;
  // FSRS калибровочные поля (см. spec §4.7)
  @field('stability_after') stabilityAfter!: number;
  @field('difficulty_after') difficultyAfter!: number;
  @field('due') due!: number;
}
