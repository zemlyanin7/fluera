import { useState, useEffect } from 'react';
import { database } from '../db';
import type { Book } from '../db/models/Book';

interface UseBookResult {
  book: Book | null;
  loading: boolean;
  error: 'book_not_found' | 'file_missing' | null;
}

export function useBook(bookId: string | undefined): UseBookResult {
  const [book, setBook] = useState<Book | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<UseBookResult['error']>(null);

  useEffect(() => {
    if (!bookId) {
      setLoading(false);
      setError('book_not_found');
      return;
    }

    let cancelled = false;

    async function loadBook() {
      try {
        console.log('[useBook] Looking for book:', bookId);
        const booksCollection = database.get<Book>('books');
        const record = await booksCollection.find(bookId!);
        console.log('[useBook] Found book:', record.title, 'path:', record.filePath);

        if (cancelled) return;

        setBook(record);
        setLoading(false);
      } catch (err) {
        console.error('[useBook] Error loading book:', err);
        if (!cancelled) {
          setError('book_not_found');
          setLoading(false);
        }
      }
    }

    loadBook();
    return () => { cancelled = true; };
  }, [bookId]);

  return { book, loading, error };
}
