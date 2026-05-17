import * as FileSystem from 'expo-file-system/legacy';
import { createTestDatabase } from '@/db/testDatabase';
import { createDefaultParserRegistry } from '@/services/parser';
import { ImportPipeline } from '../ImportPipeline';
import { buildEpub, simpleXhtml } from '@/services/parser/__tests__/fixtures/buildEpub';

// In-memory FS mock — поддерживает copy/move/read/write/getInfo/delete.
jest.mock('expo-file-system/legacy', () => {
  const files: Record<string, Uint8Array> = {};
  const dirs = new Set<string>();
  return {
    documentDirectory: '/mock/docs/',
    EncodingType: { Base64: 'base64', UTF8: 'utf8' },
    makeDirectoryAsync: jest.fn(async (path: string) => {
      dirs.add(path);
    }),
    copyAsync: jest.fn(async ({ from, to }: { from: string; to: string }) => {
      const src = files[from];
      if (!src) throw new Error(`source missing: ${from}`);
      files[to] = src;
    }),
    moveAsync: jest.fn(async ({ from, to }: { from: string; to: string }) => {
      const src = files[from];
      if (!src) throw new Error(`source missing: ${from}`);
      files[to] = src;
      delete files[from];
    }),
    writeAsStringAsync: jest.fn(async (path: string, data: string) => {
      const binary = atob(data);
      const bytes = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
      files[path] = bytes;
    }),
    readAsStringAsync: jest.fn(async (path: string) => {
      const b = files[path];
      if (!b) throw new Error(`file not found: ${path}`);
      let s = '';
      for (let i = 0; i < b.length; i++) s += String.fromCharCode(b[i] ?? 0);
      return btoa(s);
    }),
    getInfoAsync: jest.fn(async (path: string) => ({ exists: !!files[path] })),
    deleteAsync: jest.fn(async (path: string) => {
      for (const k of Object.keys(files)) {
        if (k.startsWith(path)) delete files[k];
      }
    }),
    __setFile: (path: string, content: Uint8Array) => {
      files[path] = content;
    },
    __getFile: (path: string) => files[path],
    __reset: () => {
      for (const k of Object.keys(files)) delete files[k];
      dirs.clear();
    },
  };
});

const fsHelpers = FileSystem as unknown as {
  __setFile: (p: string, c: Uint8Array) => void;
  __getFile: (p: string) => Uint8Array | undefined;
  __reset: () => void;
};

describe('ImportPipeline', () => {
  beforeEach(() => {
    fsHelpers.__reset();
    jest.clearAllMocks();
  });

  it('imports EPUB end-to-end', async () => {
    const epubBytes = buildEpub({
      metadata: { title: 'Import Test', creator: 'A', language: 'en' },
      manifest: [{ id: 'ch1', href: 'c.xhtml', mediaType: 'application/xhtml+xml' }],
      spine: ['ch1'],
      files: { 'c.xhtml': simpleXhtml('<h1>T</h1><p>Hello import</p>') },
    });
    fsHelpers.__setFile('file:///src.epub', epubBytes);

    const db = await createTestDatabase();
    const pipeline = new ImportPipeline(db, createDefaultParserRegistry());
    const result = await pipeline.import({
      uri: 'file:///src.epub',
      name: 'test.epub',
      size: epubBytes.length,
    });

    expect(result.chapterCount).toBe(1);
    expect(result.languageDetected).toBe('en');
    expect(result.bookId).toMatch(/^[a-f0-9-]+$/);
    expect(result.filePath).toContain(`/books/${result.bookId}/source.epub`);
    expect(fsHelpers.__getFile(result.filePath)).toBeDefined();
  });

  it('rejects scanned EPUB (image-only, totalChars=0)', async () => {
    const epubBytes = buildEpub({
      metadata: { title: 'Scanned' },
      manifest: [
        { id: 'p1', href: 'p1.xhtml', mediaType: 'application/xhtml+xml' },
        { id: 'img', href: 'images/scan1.jpg', mediaType: 'image/jpeg' },
      ],
      spine: ['p1'],
      files: {
        'p1.xhtml': simpleXhtml('<div><img src="images/scan1.jpg" alt=""/></div>'),
        'images/scan1.jpg': new Uint8Array([0xff, 0xd8, 0xff, 0xe0]),
      },
    });
    fsHelpers.__setFile('file:///scanned.epub', epubBytes);
    const db = await createTestDatabase();
    const pipeline = new ImportPipeline(db, createDefaultParserRegistry());
    await expect(
      pipeline.import({
        uri: 'file:///scanned.epub',
        name: 'scanned.epub',
        size: epubBytes.length,
      }),
    ).rejects.toThrow(/NO_TEXT_CONTENT/);
  });

  it('rolls back on parser failure', async () => {
    fsHelpers.__setFile('file:///broken.epub', new Uint8Array([0x50, 0x4b, 0x03, 0x04, 0xff, 0xff]));
    const db = await createTestDatabase();
    const pipeline = new ImportPipeline(db, createDefaultParserRegistry());
    await expect(
      pipeline.import({
        uri: 'file:///broken.epub',
        name: 'broken.epub',
        size: 6,
      }),
    ).rejects.toThrow();
    expect(FileSystem.deleteAsync).toHaveBeenCalled();
  });

  it('imports FB2 with cyrillic windows-1251', async () => {
    // minimal cp1251 FB2
    const parts: Uint8Array[] = [
      new TextEncoder().encode(
        '<?xml version="1.0" encoding="windows-1251"?>' +
          '<FictionBook><description><title-info><book-title>',
      ),
      new Uint8Array([0xca, 0xed, 0xe8, 0xe3, 0xe0]), // "Книга"
      new TextEncoder().encode(
        '</book-title><lang>ru</lang></title-info></description><body><section><p>x</p></section></body></FictionBook>',
      ),
    ];
    const total = parts.reduce((s, p) => s + p.length, 0);
    const bytes = new Uint8Array(total);
    let off = 0;
    for (const p of parts) {
      bytes.set(p, off);
      off += p.length;
    }
    fsHelpers.__setFile('file:///book.fb2', bytes);

    const db = await createTestDatabase();
    const pipeline = new ImportPipeline(db, createDefaultParserRegistry());
    const result = await pipeline.import({
      uri: 'file:///book.fb2',
      name: 'book.fb2',
      size: bytes.length,
    });
    expect(result.languageDetected).toBe('ru');
  });
});
