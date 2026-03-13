import { useState, useEffect } from 'react';
import { database } from '../db';
import * as FileSystem from 'expo-file-system';
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
        const booksCollection = database.get<Book>('books');
        const record = await booksCollection.find(bookId!);

        if (cancelled) return;

        // Validate file exists on disk
        const fileInfo = await FileSystem.getInfoAsync(record.filePath);
        if (!fileInfo.exists) {
          setError('file_missing');
          setLoading(false);
          return;
        }

        setBook(record);
        setLoading(false);
      } catch {
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
