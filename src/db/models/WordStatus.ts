import { Model } from '@nozbe/watermelondb';
import { field } from '@nozbe/watermelondb/decorators';

export class WordStatusModel extends Model {
  static override table = 'word_statuses';

  // natural key
  @field('word') word!: string;
  @field('book_language') bookLanguage!: string;
  @field('native_language') nativeLanguage!: string;

  // metadata
  @field('status') status!: number;
  @field('translation') translation!: string;
  @field('grammar_note') grammarNote!: string | null;

  // FSRS-6 (см. spec §4.5)
  @field('fsrs_state') fsrsState!: number;
  @field('fsrs_difficulty') fsrsDifficulty!: number;
  @field('fsrs_stability') fsrsStability!: number;
  @field('fsrs_reps') fsrsReps!: number;
  @field('fsrs_lapses') fsrsLapses!: number;
  @field('fsrs_last_review') fsrsLastReview!: number | null;
  @field('fsrs_next_review') fsrsNextReview!: number | null;
  @field('fsrs_elapsed_days') fsrsElapsedDays!: number;
  @field('fsrs_scheduled_days') fsrsScheduledDays!: number;

  // deck overrides
  @field('deck_suspended') deckSuspended!: boolean;
  @field('deck_priority') deckPriority!: number;

  // #4.5.1 Translation Popup Polish — saved to deck
  @field('saved_to_deck') savedToDeck!: boolean;
  @field('saved_at') savedAt!: number | null;

  // timestamps
  @field('created_at') createdAt!: number;
  @field('updated_at') updatedAt!: number;
}
