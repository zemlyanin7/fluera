// BookRepository: CRUD + filter helpers. Возвращает PLAIN DTO (BookRecord),
// не WatermelonDB Model instances — позволяет тестировать без real adapter.
import { Database, Q } from '@nozbe/watermelondb';
import { BookModel } from '@/db/models';
import type { BookLanguage } from '@/types/settings';

export interface CreateBookInput {
  title: string;
  author?: string | null;
  language: BookLanguage;
  format: 'epub' | 'fb2';
  filePath: string;
  coverPath?: string | null;
  source: 'import' | 'opds' | 'url';
  opdsCatalogId?: string | null;
  totalChars: number;
}

export interface BookRecord {
  id: string;
  title: string;
  author: string | null;
  language: string;
  format: string;
  filePath: string;
  coverPath: string | null;
  source: string;
  opdsCatalogId: string | null;
  totalChars: number;
  progress: number;
  difficulty: number | null;
  difficultyComputedAt: number | null;
  addedAt: number;
  lastReadAt: number | null;
  archived: boolean;
}

export interface BookListOpts {
  language?: BookLanguage;
  archived?: boolean;
  sortBy?: 'lastReadAt' | 'addedAt';
}

function toRecord(m: BookModel): BookRecord {
  return {
    id: m.id,
    title: m.title,
    author: m.author,
    language: m.language,
    format: m.format,
    filePath: m.filePath,
    coverPath: m.coverPath,
    source: m.source,
    opdsCatalogId: m.opdsCatalogId,
    totalChars: m.totalChars,
    progress: m.progress,
    difficulty: m.difficulty,
    difficultyComputedAt: m.difficultyComputedAt,
    addedAt: m.addedAt,
    lastReadAt: m.lastReadAt,
    archived: m.archived,
  };
}

export class BookRepository {
  constructor(private db: Database) {}

  private get collection() {
    return this.db.collections.get<BookModel>('books');
  }

  async create(input: CreateBookInput): Promise<BookRecord> {
    return this.db.write(async () => {
      const now = Date.now();
      const m = await this.collection.create((b) => {
        b.title = input.title;
        b.author = input.author ?? null;
        b.language = input.language;
        b.format = input.format;
        b.filePath = input.filePath;
        b.coverPath = input.coverPath ?? null;
        b.source = input.source;
        b.opdsCatalogId = input.opdsCatalogId ?? null;
        b.totalChars = input.totalChars;
        b.progress = 0;
        b.difficulty = null;
        b.difficultyComputedAt = null;
        b.addedAt = now;
        b.lastReadAt = null;
        b.archived = false;
      });
      return toRecord(m);
    });
  }

  /**
   * Создание с заранее заданным ID. Нужно для ImportPipeline — bookId
   * генерируется до записи, чтобы FileSystem-пути привязать к нему атомарно.
   */
  async createWithId(input: CreateBookInput & { id: string }): Promise<BookRecord> {
    return this.db.write(async () => {
      const now = Date.now();
      const m = await this.collection.create((b) => {
        b._raw.id = input.id;
        b.title = input.title;
        b.author = input.author ?? null;
        b.language = input.language;
        b.format = input.format;
        b.filePath = input.filePath;
        b.coverPath = input.coverPath ?? null;
        b.source = input.source;
        b.opdsCatalogId = input.opdsCatalogId ?? null;
        b.totalChars = input.totalChars;
        b.progress = 0;
        b.difficulty = null;
        b.difficultyComputedAt = null;
        b.addedAt = now;
        b.lastReadAt = null;
        b.archived = false;
      });
      return toRecord(m);
    });
  }

  async findById(id: string): Promise<BookRecord | null> {
    try {
      const m = await this.collection.find(id);
      return toRecord(m);
    } catch {
      return null;
    }
  }

  async list(opts: BookListOpts = {}): Promise<BookRecord[]> {
     
    const clauses: any[] = [];
    if (opts.language) clauses.push(Q.where('language', opts.language));
    if (opts.archived !== undefined) clauses.push(Q.where('archived', opts.archived));
    // По умолчанию sortBy lastReadAt DESC (последние прочитанные сверху).
    const sortBy = opts.sortBy ?? 'lastReadAt';
    const sortCol = sortBy === 'lastReadAt' ? 'last_read_at' : 'added_at';
    clauses.push(Q.sortBy(sortCol, Q.desc));
    const rows = await this.collection.query(...clauses).fetch();
    return rows.map(toRecord);
  }

  async delete(id: string): Promise<void> {
    return this.db.write(async () => {
      const m = await this.collection.find(id);
      // destroyPermanently (не markAsDeleted) — v1 без sync, см. §6.1.2 спеки
      await m.destroyPermanently();
    });
  }

  async updateProgress(id: string, progress: number): Promise<void> {
    const clamped = Math.max(0, Math.min(1, progress));
    return this.db.write(async () => {
      const m = await this.collection.find(id);
      await m.update((b) => {
        b.progress = clamped;
        b.lastReadAt = Date.now();
      });
    });
  }

  async setArchived(id: string, archived: boolean): Promise<void> {
    return this.db.write(async () => {
      const m = await this.collection.find(id);
      await m.update((b) => {
        b.archived = archived;
      });
    });
  }
}
