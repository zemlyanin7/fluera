// EPUB parser entry point. См. spec §5.2.
import { unzipSync } from 'fflate';
import { ParserError, type IParser, type ParsedBook, type ParsedImage } from './types';
import { findOpfPath } from './epub/container';
import { parseOpf, resolveOpfHref } from './epub/opf';
import { parseXhtmlBody } from './epub/xhtml';
import { countCharsInItems } from './shared/countChars';
import { sanitizeImageId } from './shared/sanitizeImageId';
import { SUPPORTED_BOOK_LANGUAGES, type BookLanguage } from '@/types/settings';
import type { BookChapter, ContentItem } from '@/types/content';

const MAX_EPUB_FILE_SIZE = 100 * 1024 * 1024;
const MAX_EPUB_UNCOMPRESSED = 200 * 1024 * 1024;
const MAX_IMAGE_DECODED = 10 * 1024 * 1024;

function decodeUtf8(bytes: Uint8Array): string {
  return new TextDecoder('utf-8').decode(bytes);
}

function normalizeLanguage(raw: string | null): BookLanguage | null {
  if (!raw) return null;
  const base = (raw.toLowerCase().split('-')[0] ?? '').trim();
  return (SUPPORTED_BOOK_LANGUAGES as readonly string[]).includes(base)
    ? (base as BookLanguage)
    : null;
}

function extractTitle(items: ContentItem[]): string | null {
  const h = items.find((i) => i.type === 'heading');
  if (!h || h.type !== 'heading') return null;
  return (
    h.inlines
      .filter((n) => n.type === 'text')
      .map((n) => (n.type === 'text' ? n.text : ''))
      .join('') || null
  );
}

export class EpubParser implements IParser {
  async parse(bytes: Uint8Array): Promise<ParsedBook> {
    if (bytes.length > MAX_EPUB_FILE_SIZE) {
      throw new ParserError(
        'FILE_TOO_LARGE',
        `EPUB размер ${bytes.length} > ${MAX_EPUB_FILE_SIZE}`,
      );
    }
    let archive: Record<string, Uint8Array>;
    try {
      archive = unzipSync(bytes);
    } catch (e) {
      throw new ParserError(
        'EPUB_BAD_CONTAINER',
        `Не удалось распаковать zip: ${(e as Error).message}`,
      );
    }
    const totalUncompressed = Object.values(archive).reduce((s, b) => s + b.length, 0);
    if (totalUncompressed > MAX_EPUB_UNCOMPRESSED) {
      throw new ParserError(
        'EPUB_ZIP_BOMB',
        `Распакованный размер ${totalUncompressed} > ${MAX_EPUB_UNCOMPRESSED}`,
      );
    }
    if (archive['META-INF/encryption.xml']) {
      throw new ParserError('EPUB_ENCRYPTED', 'DRM-защищённые EPUB не поддерживаются');
    }
    const mimetypeBytes = archive['mimetype'];
    if (!mimetypeBytes || decodeUtf8(mimetypeBytes).trim() !== 'application/epub+zip') {
      throw new ParserError(
        'EPUB_BAD_MIMETYPE',
        'mimetype отсутствует или не application/epub+zip',
      );
    }
    const containerBytes = archive['META-INF/container.xml'];
    if (!containerBytes) {
      throw new ParserError('EPUB_BAD_CONTAINER', 'META-INF/container.xml отсутствует');
    }
    const opfPath = findOpfPath(decodeUtf8(containerBytes));
    const opfBytes = archive[opfPath];
    if (!opfBytes) throw new ParserError('EPUB_NO_OPF', `OPF файл не найден: ${opfPath}`);
    const opf = parseOpf(decodeUtf8(opfBytes), opfPath);

    const chapters: BookChapter[] = [];
    for (let i = 0; i < opf.spine.length; i++) {
      const id = opf.spine[i];
      if (!id) continue;
      const href = opf.manifest[id];
      if (!href) continue;
      const resolved = resolveOpfHref(opf.opfDir, href);
      const xhtmlBytes = archive[resolved];
      if (!xhtmlBytes) continue;
      const items = parseXhtmlBody(decodeUtf8(xhtmlBytes));
      chapters.push({ index: i, title: extractTitle(items), items });
    }

    const images: ParsedImage[] = [];
    for (const [id, href] of Object.entries(opf.manifest)) {
      const mime = opf.manifestMime[id];
      if (!mime?.startsWith('image/')) continue;
      const resolved = resolveOpfHref(opf.opfDir, href);
      const imgBytes = archive[resolved];
      if (!imgBytes) continue;
      if (imgBytes.length > MAX_IMAGE_DECODED) {
        throw new ParserError('IMAGE_TOO_LARGE', `Image ${id} > ${MAX_IMAGE_DECODED}`);
      }
      const last = href.split('/').pop() ?? id;
      const filename = sanitizeImageId(last);
      images.push({ id: filename, bytes: imgBytes, mime });
    }

    let coverFilename: string | null = null;
    if (opf.metadata.coverId) {
      const coverHref = opf.manifest[opf.metadata.coverId];
      if (coverHref) {
        const last = coverHref.split('/').pop() ?? opf.metadata.coverId;
        coverFilename = sanitizeImageId(last);
      }
    }

    const totalChars = chapters.reduce((s, ch) => s + countCharsInItems(ch.items), 0);

    return {
      title: opf.metadata.title ?? 'Untitled',
      author: opf.metadata.creator,
      language: normalizeLanguage(opf.metadata.language),
      coverId: coverFilename,
      chapters,
      footnotes: {},
      images,
      totalChars,
    };
  }
}
