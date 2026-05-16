import { Database, Q } from '@nozbe/watermelondb';
import { ChapterModel } from '@/db/models';

export interface CreateChapterInput {
  bookId: string;
  title?: string | null;
  orderIndex: number;
  startChar: number;
  endChar: number;
}

export interface ChapterRecord {
  id: string;
  bookId: string;
  title: string | null;
  orderIndex: number;
  startChar: number;
  endChar: number;
}

function toRecord(m: ChapterModel): ChapterRecord {
  return {
    id: m.id,
    bookId: m.bookId,
    title: m.title,
    orderIndex: m.orderIndex,
    startChar: m.startChar,
    endChar: m.endChar,
  };
}

export class ChapterRepository {
  constructor(private db: Database) {}

  private get collection() {
    return this.db.collections.get<ChapterModel>('chapters');
  }

  async create(input: CreateChapterInput): Promise<ChapterRecord> {
    return this.db.write(async () => {
      const m = await this.collection.create((c) => {
        c.bookId = input.bookId;
        c.title = input.title ?? null;
        c.orderIndex = input.orderIndex;
        c.startChar = input.startChar;
        c.endChar = input.endChar;
      });
      return toRecord(m);
    });
  }

  async listByBook(bookId: string): Promise<ChapterRecord[]> {
    const rows = await this.collection
      .query(Q.where('book_id', bookId), Q.sortBy('order_index', Q.asc))
      .fetch();
    return rows.map(toRecord);
  }

  async deleteByBook(bookId: string): Promise<void> {
    return this.db.write(async () => {
      const rows = await this.collection.query(Q.where('book_id', bookId)).fetch();
      for (const m of rows) {
        await m.destroyPermanently();
      }
    });
  }
}
