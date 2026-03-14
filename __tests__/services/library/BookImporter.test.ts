jest.mock('../../../src/db', () => ({
  database: {},
}));

import { BookImporter } from '../../../src/services/library/BookImporter';

describe('BookImporter', () => {
  it('detects FB2 format from extension', () => {
    expect(BookImporter.detectFormat('book.fb2')).toBe('fb2');
    expect(BookImporter.detectFormat('book.FB2')).toBe('fb2');
  });

  it('detects EPUB format from extension', () => {
    expect(BookImporter.detectFormat('book.epub')).toBe('epub');
  });

  it('detects FB2 ZIP format', () => {
    expect(BookImporter.detectFormat('book.fb2.zip')).toBe('fb2');
  });

  it('returns null for unsupported format', () => {
    expect(BookImporter.detectFormat('book.pdf')).toBeNull();
  });
});
