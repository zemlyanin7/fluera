import * as FileSystem from 'expo-file-system';
import JSZip from 'jszip';
import { XMLParser } from 'fast-xml-parser';
import { database } from '../../db';
import { Book } from '../../db/models/Book';
import { Fb2Parser } from '../parser/Fb2Parser';
import type { BookFormat } from '../../utils/types';

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

    // Extract metadata
    let title = filename.replace(/\.\w+$/, '');
    let author = 'Unknown';
    const coverPath: string | null = null;

    try {
      if (format === 'fb2') {
        const content = await FileSystem.readAsStringAsync(filePath);
        const parsed = Fb2Parser.parse(content);
        if (parsed.title) title = parsed.title;
        if (parsed.author) author = parsed.author;
      } else if (format === 'epub') {
        const result = await this.extractEpubMetadata(filePath);
        if (result.title) title = result.title;
        if (result.author) author = result.author;
      }
    } catch {
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

    return book;
  }

  private static async extractEpubMetadata(
    epubPath: string,
  ): Promise<{ title: string | null; author: string | null }> {
    const data = await FileSystem.readAsStringAsync(epubPath, {
      encoding: FileSystem.EncodingType.Base64,
    });
    const zip = await JSZip.loadAsync(data, { base64: true });

    const containerXml = await zip.files['META-INF/container.xml']?.async('string');
    if (!containerXml) return { title: null, author: null };

    const parser = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: '@_' });
    const container = parser.parse(containerXml);
    const rootfile = container?.container?.rootfiles?.rootfile;
    const opfPath = rootfile?.['@_full-path'] || rootfile?.[0]?.['@_full-path'];
    if (!opfPath) return { title: null, author: null };

    const opfXml = await zip.files[opfPath]?.async('string');
    if (!opfXml) return { title: null, author: null };

    const opf = parser.parse(opfXml);
    const metadata = opf?.package?.metadata;

    const title = metadata?.['dc:title'] || null;
    const author = metadata?.['dc:creator']?.['#text'] || metadata?.['dc:creator'] || null;

    return { title, author };
  }
}
