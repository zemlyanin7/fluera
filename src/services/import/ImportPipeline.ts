// ImportPipeline: file → parse → FS + DB атомарно с rollback. См. spec §7.
import * as FileSystem from 'expo-file-system/legacy';
import { Database } from '@nozbe/watermelondb';
import {
  ParserError,
  type ParserRegistry,
  type ParsedImage,
} from '@/services/parser';
import { BookRepository } from '@/db/repositories/BookRepository';
import { ChapterRepository } from '@/db/repositories/ChapterRepository';
import { stagingCopy } from './stagingCopy';
import { cleanupOnFailure } from './cleanupOnFailure';
import { detectFormatFromBytes } from './detectFormat';
import { base64Decode } from '@/services/parser/shared/base64Decode';
import { countCharsInItems } from '@/services/parser/shared/countChars';
import type { ImportFile, ImportResult } from './types';
import type { BookLanguage } from '@/types/settings';

const docsDir = (): string => FileSystem.documentDirectory ?? '';

function uuidV4(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  bytes[6] = ((bytes[6] ?? 0) & 0x0f) | 0x40;
  bytes[8] = ((bytes[8] ?? 0) & 0x3f) | 0x80;
  const hex = Array.from(bytes).map((b) => b.toString(16).padStart(2, '0')).join('');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

async function readBytes(path: string): Promise<Uint8Array> {
  const base64 = await FileSystem.readAsStringAsync(path, {
    encoding: FileSystem.EncodingType.Base64,
  });
  return base64Decode(base64);
}

function uint8ToBase64(bytes: Uint8Array): string {
  let s = '';
  for (let i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i] ?? 0);
  return btoa(s);
}

async function writeImages(dir: string, images: ParsedImage[]): Promise<void> {
  for (const img of images) {
    const target = `${dir}${img.id}`;
    const base64 = uint8ToBase64(img.bytes);
    await FileSystem.writeAsStringAsync(target, base64, {
      encoding: FileSystem.EncodingType.Base64,
    });
  }
}

export class ImportPipeline {
  constructor(private db: Database, private parsers: ParserRegistry) {}

  async import(file: ImportFile): Promise<ImportResult> {
    let tmpPath: string | null = null;
    let bookId: string | null = null;
    try {
      tmpPath = await stagingCopy(file);
      const bytes = await readBytes(tmpPath);
      const format = detectFormatFromBytes(bytes, file.name);
      const parser = this.parsers.get(format);
      const parsed = await parser.parse(bytes);

      bookId = uuidV4();
      const bookDir = `${docsDir()}books/${bookId}/`;
      const imagesDir = `${bookDir}images/`;
      const finalPath = `${bookDir}source.${format}`;

      await FileSystem.makeDirectoryAsync(bookDir, { intermediates: true });
      await FileSystem.makeDirectoryAsync(imagesDir, { intermediates: true });
      await FileSystem.moveAsync({ from: tmpPath, to: finalPath });
      tmpPath = null;
      await writeImages(imagesDir, parsed.images);

      const coverPath = parsed.coverId ? `${imagesDir}${parsed.coverId}` : null;
      const language: BookLanguage = parsed.language ?? 'en';

      const books = new BookRepository(this.db);
      await books.createWithId({
        id: bookId,
        title: parsed.title,
        author: parsed.author,
        language,
        format,
        filePath: finalPath,
        coverPath,
        source: 'import',
        totalChars: parsed.totalChars,
      });

      const chapters = new ChapterRepository(this.db);
      let cursor = 0;
      const chapterRows = parsed.chapters.map((ch) => {
        const charCount = countCharsInItems(ch.items);
        const row = {
          title: ch.title,
          orderIndex: ch.index,
          startChar: cursor,
          endChar: cursor + charCount,
        };
        cursor += charCount;
        return row;
      });
      await chapters.bulkCreate(bookId, chapterRows);

      return {
        bookId,
        filePath: finalPath,
        chapterCount: parsed.chapters.length,
        languageDetected: parsed.language,
      };
    } catch (err) {
      await cleanupOnFailure({ tmpPath, bookId: bookId ?? undefined });
      if (err instanceof ParserError) throw err;
      throw new ParserError('IO_ERROR', `Import failed: ${(err as Error).message}`, err);
    }
  }
}
