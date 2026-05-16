// Канонические типы парсеров. ContentItem/BookChapter/BookFootnotes
// определены в Foundation (src/types/content.ts) — переиспользуем.
import type { BookChapter, BookFootnotes } from '@/types/content';
import type { BookLanguage } from '@/types/settings';

export interface ParsedImage {
  /** ID, на который ссылаются ContentItem.image.src. После sanitize. */
  id: string;
  /** Декодированные байты. Пишутся в FS пайплайном. */
  bytes: Uint8Array;
  /** MIME из metadata или определён по magic bytes. */
  mime: string;
}

export interface ParsedBook {
  title: string;
  author: string | null;
  /** null если язык не определён или unknown — Library UI попросит юзера. */
  language: BookLanguage | null;
  /** ID одного из `images`, либо null если cover нет. */
  coverId: string | null;
  chapters: BookChapter[];
  /** FB2: <body name="notes">. EPUB v1: пусто. */
  footnotes: BookFootnotes;
  images: ParsedImage[];
  /** Сумма символов всех paragraph.inlines — для прогресса. */
  totalChars: number;
}

export type ParserErrorCode =
  | 'FILE_TOO_LARGE'
  | 'UNKNOWN_FORMAT'
  | 'EPUB_ENCRYPTED'
  | 'EPUB_BAD_MIMETYPE'
  | 'EPUB_BAD_CONTAINER'
  | 'EPUB_NO_OPF'
  | 'EPUB_NO_SPINE'
  | 'EPUB_ZIP_BOMB'
  | 'FB2_NO_BODY'
  | 'FB2_INVALID_XML'
  | 'XML_UNSAFE'
  | 'IMAGE_TOO_LARGE'
  | 'IO_ERROR';

export class ParserError extends Error {
  constructor(
    public code: ParserErrorCode,
    message: string,
    public details?: unknown,
  ) {
    // Префикс с кодом — для удобного matching в тестах и логах.
    super(`[${code}] ${message}`);
    this.name = 'ParserError';
  }
}

export interface IParser {
  parse(bytes: Uint8Array): Promise<ParsedBook>;
}
