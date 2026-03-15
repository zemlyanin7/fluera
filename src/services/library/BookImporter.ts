import * as FileSystem from 'expo-file-system/legacy';
import JSZip from 'jszip';
import { XMLParser } from 'fast-xml-parser';
import { InteractionManager } from 'react-native';
import { database } from '../../db';
import { Book } from '../../db/models/Book';
import { Fb2Parser } from '../parser/Fb2Parser';

import type { BookFormat } from '../../utils/types';
import { convertFb2 } from '../converter/fb2Converter';
import { convertEpub } from '../converter/epubConverter';
import { saveChapters, saveFootnotes, ensureBookDirs } from '../converter/chapterStorage';

const BOOKS_DIR = `${FileSystem.documentDirectory}books/`;
const COVERS_DIR = `${FileSystem.documentDirectory}covers/`;

export class BookImporter {
  static detectFormat(filename: string): BookFormat | null {
    const lower = filename.toLowerCase();
    if (lower.endsWith('.fb2.zip') || lower.endsWith('.fb2')) return 'fb2';
    if (lower.endsWith('.epub')) return 'epub';
    return null;
  }

  static async importFile(sourceUri: string, filename: string): Promise<Book> {
    const format = this.detectFormat(filename);
    if (!format) throw new Error(`Unsupported format: ${filename}`);

    // Ensure directories exist
    await FileSystem.makeDirectoryAsync(BOOKS_DIR, { intermediates: true });
    await FileSystem.makeDirectoryAsync(COVERS_DIR, { intermediates: true });

    const bookId = Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
    const ext = format === 'fb2' ? '.fb2' : '.epub';
    const destPath = `${BOOKS_DIR}${bookId}${ext}`;

    // Handle .fb2.zip: extract first
    const filePath = destPath;
    if (filename.toLowerCase().endsWith('.fb2.zip')) {
      const zipData = await FileSystem.readAsStringAsync(sourceUri, {
        encoding: FileSystem.EncodingType.Base64,
      });
      const zip = await JSZip.loadAsync(zipData, { base64: true });
      const fb2File = Object.keys(zip.files).find((n) => n.toLowerCase().endsWith('.fb2'));
      if (!fb2File) throw new Error('No .fb2 file found in archive');
      const content = await zip.files[fb2File].async('string');
      await FileSystem.writeAsStringAsync(destPath, content, {
        encoding: FileSystem.EncodingType.UTF8,
      });
    } else {
      await FileSystem.copyAsync({ from: sourceUri, to: destPath });
    }

    // Extract metadata + cover
    let title = filename.replace(/\.\w+$/, '');
    let author = 'Unknown';
    let coverPath: string | null = null;
    // Сохраняем содержимое файла для последующей конвертации
    let fb2XmlContent: string | null = null;
    let epubBase64Content: string | null = null;

    try {
      if (format === 'fb2') {
        const content = await FileSystem.readAsStringAsync(filePath);
        fb2XmlContent = content;
        const parsed = Fb2Parser.parse(content);
        if (parsed.title) title = parsed.title;
        if (parsed.author) author = parsed.author;
        if (parsed.coverBase64) {
          coverPath = await this.saveCoverBase64(bookId, parsed.coverBase64);
        }
      } else if (format === 'epub') {
        epubBase64Content = await FileSystem.readAsStringAsync(filePath, {
          encoding: FileSystem.EncodingType.Base64,
        });
        const result = await this.extractEpubMetadata(filePath);
        if (result.title) title = result.title;
        if (result.author) author = result.author;
        if (result.coverBase64) {
          coverPath = await this.saveCoverBase64(bookId, result.coverBase64);
        }
      }
    } catch (err) {
      console.warn('[BookImporter] Metadata/cover extraction error:', err);
      // Fallback: use filename as title, keep defaults
    }

    // Create Book record in WatermelonDB
    const booksCollection = database.get<Book>('books');
    const book = await database.write(async () => {
      return booksCollection.create((record) => {
        record.title = title;
        record.author = author;
        record.language = '';
        record.format = format;
        record.filePath = filePath;
        record.coverPath = coverPath || '';
        record.source = 'file';
        record.opdsUrl = '';
        record.progress = 0;
        record.totalWords = 0;
        record.difficulty = 0;
        record.addedAt = new Date(Date.now());
        record.lastReadAt = new Date(0);
      });
    });

    // Конвертация в JSON-главы после сохранения записи в БД
    try {
      if (format === 'fb2' && fb2XmlContent != null) {
        await ensureBookDirs(bookId);
        const fb2Result = await convertFb2(fb2XmlContent, bookId);
        const totalChapters = fb2Result.chapters.length;

        if (totalChapters <= 10) {
          // Маленькая книга: сохраняем все главы сразу
          await saveChapters(bookId, fb2Result.chapters);
        } else {
          // Прогрессивный импорт: первые 5 глав сохраняем сразу
          const initialChapters = fb2Result.chapters.slice(0, 5);
          await saveChapters(bookId, initialChapters);
          // Остальные главы конвертируем в фоне
          const remaining = fb2Result.chapters.slice(5);
          InteractionManager.runAfterInteractions(async () => {
            await saveChapters(bookId, remaining);
          });
        }

        if (Object.keys(fb2Result.footnotes).length > 0) {
          await saveFootnotes(bookId, fb2Result.footnotes);
        }

        // Обновляем totalChapters и contentVersion в БД
        await database.write(async () => {
          await book.update((record) => {
            record.totalChapters = totalChapters;
            record.contentVersion = 1;
          });
        });
      } else if (format === 'epub' && epubBase64Content != null) {
        await ensureBookDirs(bookId);
        // Декодируем base64 → ArrayBuffer для convertEpub
        const binaryStr = atob(epubBase64Content);
        const bytes = new Uint8Array(binaryStr.length);
        for (let i = 0; i < binaryStr.length; i++) {
          bytes[i] = binaryStr.charCodeAt(i);
        }
        const epubArrayBuffer = bytes.buffer;

        const epubResult = await convertEpub(epubArrayBuffer, bookId);
        const totalChapters = epubResult.chapters.length;

        if (totalChapters <= 10) {
          // Маленькая книга: сохраняем все главы сразу
          await saveChapters(bookId, epubResult.chapters);
        } else {
          // Прогрессивный импорт: первые 5 глав сохраняем сразу
          const initialChapters = epubResult.chapters.slice(0, 5);
          await saveChapters(bookId, initialChapters);
          // Остальные главы конвертируем в фоне
          const remaining = epubResult.chapters.slice(5);
          InteractionManager.runAfterInteractions(async () => {
            await saveChapters(bookId, remaining);
          });
        }

        if (Object.keys(epubResult.footnotes).length > 0) {
          await saveFootnotes(bookId, epubResult.footnotes);
        }

        // Обновляем totalChapters и contentVersion в БД
        await database.write(async () => {
          await book.update((record) => {
            record.totalChapters = totalChapters;
            record.contentVersion = 1;
          });
        });
      }
    } catch (err) {
      // Конвертация провалилась — логируем предупреждение, но не прерываем импорт
      console.warn('[BookImporter] Chapter conversion error:', err);
    }

    return book;
  }

  /** Re-extract covers for books that are missing them */
  static async extractMissingCovers(): Promise<void> {
    try {
      await FileSystem.makeDirectoryAsync(COVERS_DIR, { intermediates: true });
      const booksCollection = database.get<Book>('books');
      const books = await booksCollection.query().fetch();

      for (const book of books) {
        if (book.coverPath) continue; // Already has cover

        try {
          let coverBase64: string | null = null;

          if (book.format === 'fb2') {
            const content = await FileSystem.readAsStringAsync(book.filePath);
            const parsed = Fb2Parser.parse(content);
            coverBase64 = parsed.coverBase64;
          } else if (book.format === 'epub') {
            const result = await this.extractEpubMetadata(book.filePath);
            coverBase64 = result.coverBase64;
          }

          if (coverBase64) {
            const coverPath = await this.saveCoverBase64(book.id, coverBase64);
            if (coverPath) {
              await database.write(async () => {
                await book.update((record) => {
                  record.coverPath = coverPath;
                });
              });
              console.log(`[BookImporter] Cover extracted for: ${book.title}`);
            }
          }
        } catch (err) {
          console.warn(`[BookImporter] Failed to extract cover for ${book.title}:`, err);
        }
      }
    } catch (err) {
      console.warn('[BookImporter] extractMissingCovers error:', err);
    }
  }

  /** Save a base64-encoded cover image to disk and return the file URI */
  private static async saveCoverBase64(bookId: string, base64Data: string): Promise<string | null> {
    try {
      // Clean base64: remove whitespace/newlines
      const cleanBase64 = base64Data.replace(/\s/g, '');
      if (!cleanBase64) return null;

      // Detect image type from base64 header or default to jpg
      const ext = cleanBase64.startsWith('/9j/') ? '.jpg' : '.png';
      const coverFile = `${COVERS_DIR}${bookId}${ext}`;

      await FileSystem.writeAsStringAsync(coverFile, cleanBase64, {
        encoding: FileSystem.EncodingType.Base64,
      });
      return coverFile;
    } catch (err) {
      console.warn('[BookImporter] Failed to save cover:', err);
      return null;
    }
  }

  private static async extractEpubMetadata(
    epubPath: string,
  ): Promise<{ title: string | null; author: string | null; coverBase64: string | null }> {
    const data = await FileSystem.readAsStringAsync(epubPath, {
      encoding: FileSystem.EncodingType.Base64,
    });
    const zip = await JSZip.loadAsync(data, { base64: true });

    const containerXml = await zip.files['META-INF/container.xml']?.async('string');
    if (!containerXml) return { title: null, author: null, coverBase64: null };

    const parser = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: '@_' });
    const container = parser.parse(containerXml);
    const rootfile = container?.container?.rootfiles?.rootfile;
    const opfPath = rootfile?.['@_full-path'] || rootfile?.[0]?.['@_full-path'];
    if (!opfPath) return { title: null, author: null, coverBase64: null };

    const opfXml = await zip.files[opfPath]?.async('string');
    if (!opfXml) return { title: null, author: null, coverBase64: null };

    const opf = parser.parse(opfXml);
    const metadata = opf?.package?.metadata;
    const manifest = opf?.package?.manifest?.item;

    const title = metadata?.['dc:title'] || null;
    const author = metadata?.['dc:creator']?.['#text'] || metadata?.['dc:creator'] || null;

    // Extract cover image
    let coverBase64: string | null = null;
    try {
      const items = Array.isArray(manifest) ? manifest : manifest ? [manifest] : [];
      const metaArr = Array.isArray(metadata?.meta) ? metadata.meta : metadata?.meta ? [metadata.meta] : [];

      // Strategy 1: find <meta name="cover" content="cover-image-id"/>
      const coverMeta = metaArr.find(
        (m: Record<string, string>) => m['@_name'] === 'cover',
      );
      let coverItem = coverMeta
        ? items.find((item: Record<string, string>) => item['@_id'] === coverMeta['@_content'])
        : null;

      // Strategy 2: find item with properties="cover-image" (EPUB 3)
      if (!coverItem) {
        coverItem = items.find(
          (item: Record<string, string>) => item['@_properties']?.includes('cover-image'),
        );
      }

      // Strategy 3: find item with id containing "cover" and image media-type
      if (!coverItem) {
        coverItem = items.find(
          (item: Record<string, string>) =>
            item['@_id']?.toLowerCase().includes('cover') &&
            item['@_media-type']?.startsWith('image/'),
        );
      }

      if (coverItem) {
        const coverHref = coverItem['@_href'];
        // Resolve relative path from OPF directory
        const opfDir = opfPath.includes('/') ? opfPath.substring(0, opfPath.lastIndexOf('/') + 1) : '';
        const coverFullPath = coverHref.startsWith('/') ? coverHref.slice(1) : opfDir + coverHref;

        const coverFile = zip.files[coverFullPath];
        if (coverFile) {
          coverBase64 = await coverFile.async('base64');
        }
      }
    } catch (err) {
      console.warn('[BookImporter] EPUB cover extraction error:', err);
    }

    return { title, author, coverBase64 };
  }
}
