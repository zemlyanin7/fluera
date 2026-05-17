// WordStatusRepository — простые операции save/unsave для #4.5.1 Translation Popup Polish.
// Не дублирует WordRepository (FSRS + occurrences + review_logs) — только saved-флаг.
import { Database, Q } from '@nozbe/watermelondb';
import { WordStatusModel } from '@/db/models';

export interface WordStatusRecord {
  id: string;
  word: string;
  bookLanguage: string;
  savedToDeck: boolean;
  savedAt: number | null;
  lookupCount: number;
  passiveEncounters: number;
}

function toRecord(m: WordStatusModel): WordStatusRecord {
  return {
    id: m.id,
    word: m.word,
    bookLanguage: m.bookLanguage,
    savedToDeck: m.savedToDeck,
    savedAt: m.savedAt,
    lookupCount: (m as any).lookupCount ?? 0,
    passiveEncounters: (m as any).passiveEncounters ?? 0,
  };
}

export class WordStatusRepository {
  constructor(private db: Database) {}

  private get collection() {
    return this.db.collections.get<WordStatusModel>('word_statuses');
  }

  async findByWordAndLang(word: string, bookLanguage: string): Promise<WordStatusRecord | null> {
    const rows = await this.collection
      .query(
        Q.where('word', word.toLowerCase().trim()),
        Q.where('book_language', bookLanguage),
      )
      .fetch();
    if (rows.length === 0 || rows[0] === undefined) return null;
    return toRecord(rows[0]);
  }

  async save(input: { word: string; bookLanguage: string }): Promise<void> {
    const now = Date.now();
    const existing = await this.findByWordAndLang(input.word, input.bookLanguage);
    await this.db.write(async () => {
      if (existing) {
        const m = await this.collection.find(existing.id);
        await m.update((rec: any) => {
          rec.savedToDeck = true;
          rec.savedAt = now;
        });
      } else {
        await this.collection.create((rec: any) => {
          rec.word = input.word.toLowerCase().trim();
          rec.bookLanguage = input.bookLanguage;
          rec.lookupCount = 0;
          rec.passiveEncounters = 0;
          rec.savedToDeck = true;
          rec.savedAt = now;
        });
      }
    });
  }

  async unsave(input: { word: string; bookLanguage: string }): Promise<void> {
    const existing = await this.findByWordAndLang(input.word, input.bookLanguage);
    if (!existing) return;
    await this.db.write(async () => {
      const m = await this.collection.find(existing.id);
      await m.update((rec: any) => {
        rec.savedToDeck = false;
        rec.savedAt = null;
      });
    });
  }
}
