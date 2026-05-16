// WordRepository объединяет 3 связанные таблицы: word_statuses (FSRS-6),
// word_occurrences (per-book контексты), review_logs (FSRS-история).
// Deterministic id для WordStatus: SHA-256(word, bookLang, nativeLang)[:16] —
// idempotent upsert (см. §6.0 спеки).
import { Database, Q } from '@nozbe/watermelondb';
import { WordStatusModel, WordOccurrenceModel, ReviewLogModel } from '@/db/models';
import { wordStatusId } from '@/db/deterministicIds';
import type { BookLanguage, NativeLanguage } from '@/types/settings';

export interface WordStatusRecord {
  id: string;
  word: string;
  bookLanguage: string;
  nativeLanguage: string;
  status: number;
  translation: string;
  grammarNote: string | null;
  fsrsState: number;
  fsrsDifficulty: number;
  fsrsStability: number;
  fsrsReps: number;
  fsrsLapses: number;
  fsrsLastReview: number | null;
  fsrsNextReview: number | null;
  fsrsElapsedDays: number;
  fsrsScheduledDays: number;
  deckSuspended: boolean;
  deckPriority: number;
  createdAt: number;
  updatedAt: number;
}

export interface UpsertWordStatusInput {
  word: string;
  bookLanguage: BookLanguage;
  nativeLanguage: NativeLanguage;
  status?: number;
  translation?: string;
  grammarNote?: string | null;
}

export interface WordOccurrenceRecord {
  id: string;
  wordStatusId: string;
  bookId: string;
  chapterOrderIndex: number | null;
  contextSentence: string;
  createdAt: number;
}

export interface AddOccurrenceInput {
  wordStatusId: string;
  bookId: string;
  chapterOrderIndex?: number | null;
  contextSentence: string;
}

export interface ReviewLogRecord {
  id: string;
  wordStatusId: string;
  rating: number;
  reviewedAt: number;
  elapsedDays: number;
  scheduledDays: number;
  stateBefore: number;
  stabilityAfter: number;
  difficultyAfter: number;
  due: number;
}

export interface AppendReviewLogInput {
  wordStatusId: string;
  rating: number; // 1=again, 2=hard, 3=good, 4=easy
  reviewedAt?: number;
  elapsedDays: number;
  scheduledDays: number;
  stateBefore: number;
  stabilityAfter: number;
  difficultyAfter: number;
  due: number;
}

function statusToRecord(m: WordStatusModel): WordStatusRecord {
  return {
    id: m.id,
    word: m.word,
    bookLanguage: m.bookLanguage,
    nativeLanguage: m.nativeLanguage,
    status: m.status,
    translation: m.translation,
    grammarNote: m.grammarNote,
    fsrsState: m.fsrsState,
    fsrsDifficulty: m.fsrsDifficulty,
    fsrsStability: m.fsrsStability,
    fsrsReps: m.fsrsReps,
    fsrsLapses: m.fsrsLapses,
    fsrsLastReview: m.fsrsLastReview,
    fsrsNextReview: m.fsrsNextReview,
    fsrsElapsedDays: m.fsrsElapsedDays,
    fsrsScheduledDays: m.fsrsScheduledDays,
    deckSuspended: m.deckSuspended,
    deckPriority: m.deckPriority,
    createdAt: m.createdAt,
    updatedAt: m.updatedAt,
  };
}

function occurrenceToRecord(m: WordOccurrenceModel): WordOccurrenceRecord {
  return {
    id: m.id,
    wordStatusId: m.wordStatusId,
    bookId: m.bookId,
    chapterOrderIndex: m.chapterOrderIndex,
    contextSentence: m.contextSentence,
    createdAt: m.createdAt,
  };
}

function logToRecord(m: ReviewLogModel): ReviewLogRecord {
  return {
    id: m.id,
    wordStatusId: m.wordStatusId,
    rating: m.rating,
    reviewedAt: m.reviewedAt,
    elapsedDays: m.elapsedDays,
    scheduledDays: m.scheduledDays,
    stateBefore: m.stateBefore,
    stabilityAfter: m.stabilityAfter,
    difficultyAfter: m.difficultyAfter,
    due: m.due,
  };
}

export class WordRepository {
  constructor(private db: Database) {}

  private get statuses() {
    return this.db.collections.get<WordStatusModel>('word_statuses');
  }

  private get occurrences() {
    return this.db.collections.get<WordOccurrenceModel>('word_occurrences');
  }

  private get logs() {
    return this.db.collections.get<ReviewLogModel>('review_logs');
  }

  /**
   * Idempotent upsert (deterministic id, см. §6.0). Если запись существует —
   * НЕ перетираем FSRS-состояние, обновляем только translation/grammar/status.
   */
  async upsertStatus(input: UpsertWordStatusInput): Promise<WordStatusRecord> {
    const id = await wordStatusId(input.word, input.bookLanguage, input.nativeLanguage);
    const now = Date.now();
    return this.db.write(async () => {
      try {
        const existing = await this.statuses.find(id);
        await existing.update((m) => {
          if (input.status !== undefined) m.status = input.status;
          if (input.translation !== undefined) m.translation = input.translation;
          if (input.grammarNote !== undefined) m.grammarNote = input.grammarNote;
          m.updatedAt = now;
        });
        return statusToRecord(existing);
      } catch {
        const created = await this.statuses.create((m) => {
          m._raw.id = id;
          m.word = input.word.toLowerCase().normalize('NFC');
          m.bookLanguage = input.bookLanguage;
          m.nativeLanguage = input.nativeLanguage;
          m.status = input.status ?? 1; // new
          m.translation = input.translation ?? '';
          m.grammarNote = input.grammarNote ?? null;
          // FSRS-6 initial state (ts-fsrs defaults)
          m.fsrsState = 0; // New
          m.fsrsDifficulty = 5.0;
          m.fsrsStability = 0;
          m.fsrsReps = 0;
          m.fsrsLapses = 0;
          m.fsrsLastReview = null;
          m.fsrsNextReview = null;
          m.fsrsElapsedDays = 0;
          m.fsrsScheduledDays = 0;
          m.deckSuspended = false;
          m.deckPriority = 0;
          m.createdAt = now;
          m.updatedAt = now;
        });
        return statusToRecord(created);
      }
    });
  }

  async findStatus(
    word: string,
    bookLanguage: BookLanguage,
    nativeLanguage: NativeLanguage,
  ): Promise<WordStatusRecord | null> {
    const id = await wordStatusId(word, bookLanguage, nativeLanguage);
    try {
      const m = await this.statuses.find(id);
      return statusToRecord(m);
    } catch {
      return null;
    }
  }

  async addOccurrence(input: AddOccurrenceInput): Promise<WordOccurrenceRecord> {
    return this.db.write(async () => {
      const m = await this.occurrences.create((o) => {
        o.wordStatusId = input.wordStatusId;
        o.bookId = input.bookId;
        o.chapterOrderIndex = input.chapterOrderIndex ?? null;
        o.contextSentence = input.contextSentence;
        o.createdAt = Date.now();
      });
      return occurrenceToRecord(m);
    });
  }

  async listOccurrences(wordStatusId: string): Promise<WordOccurrenceRecord[]> {
    const rows = await this.occurrences
      .query(Q.where('word_status_id', wordStatusId))
      .fetch();
    return rows.map(occurrenceToRecord);
  }

  async appendReviewLog(input: AppendReviewLogInput): Promise<ReviewLogRecord> {
    return this.db.write(async () => {
      const m = await this.logs.create((l) => {
        l.wordStatusId = input.wordStatusId;
        l.rating = input.rating;
        l.reviewedAt = input.reviewedAt ?? Date.now();
        l.elapsedDays = input.elapsedDays;
        l.scheduledDays = input.scheduledDays;
        l.stateBefore = input.stateBefore;
        l.stabilityAfter = input.stabilityAfter;
        l.difficultyAfter = input.difficultyAfter;
        l.due = input.due;
      });
      return logToRecord(m);
    });
  }

  async listReviewLogs(wordStatusId: string): Promise<ReviewLogRecord[]> {
    const rows = await this.logs
      .query(Q.where('word_status_id', wordStatusId), Q.sortBy('reviewed_at', Q.desc))
      .fetch();
    return rows.map(logToRecord);
  }

  /**
   * Deck queue: fsrs_state in (1,2,3) + не suspended + due <= now (или never reviewed).
   * Сортировка: fsrs_next_review ASC (NULL first т.к. ещё не reviewed = max priority).
   */
  async deckQueue(
    bookLanguage: BookLanguage,
    nativeLanguage: NativeLanguage,
    limit = 50,
    now: number = Date.now(),
  ): Promise<WordStatusRecord[]> {
    const rows = await this.statuses
      .query(
        Q.where('book_language', bookLanguage),
        Q.where('native_language', nativeLanguage),
        Q.where('deck_suspended', false),
        Q.where('fsrs_state', Q.oneOf([1, 2, 3])),
        Q.or(
          Q.where('fsrs_next_review', Q.eq(null)),
          Q.where('fsrs_next_review', Q.lte(now)),
        ),
        Q.sortBy('fsrs_next_review', Q.asc),
        Q.take(limit),
      )
      .fetch();
    return rows.map(statusToRecord);
  }

  /**
   * Retention review_logs: keep last 365 дней OR last 100 на word — что больше.
   * Запускается ежедневно из cachePurge.
   */
  async pruneReviewLogs(wordStatusIdValue: string, now: number = Date.now()): Promise<number> {
    const oneYearAgo = now - 365 * 24 * 60 * 60 * 1000;
    return this.db.write(async () => {
      // загружаем все логи слова DESC, оставляем top-100 OR newer-than-1y
      const all = await this.logs
        .query(Q.where('word_status_id', wordStatusIdValue), Q.sortBy('reviewed_at', Q.desc))
        .fetch();
      const keep = new Set<string>();
      all.slice(0, 100).forEach((m) => keep.add(m.id));
      all.filter((m) => m.reviewedAt >= oneYearAgo).forEach((m) => keep.add(m.id));
      let purged = 0;
      for (const m of all) {
        if (!keep.has(m.id)) {
          await m.destroyPermanently();
          purged++;
        }
      }
      return purged;
    });
  }

  async deleteOccurrencesByBook(bookId: string): Promise<void> {
    return this.db.write(async () => {
      const rows = await this.occurrences.query(Q.where('book_id', bookId)).fetch();
      for (const m of rows) {
        await m.destroyPermanently();
      }
    });
  }
}
