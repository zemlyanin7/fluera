// Детерминированные ID для таблиц с natural key (см. §6.0 спеки).
// WatermelonDB не имеет native UNIQUE constraints — паттерн check-then-insert
// расистен. ID, производный от natural key, делает upsert идемпотентным:
// `find(id)` → exists → update / not exists → create.
import * as Crypto from 'expo-crypto';
import type { BookLanguage, NativeLanguage } from '@/types/settings';

export const ALL_BOOKS_SENTINEL = '__all__';

/**
 * SHA-256 от (word, bookLanguage, nativeLanguage), truncate до 16 chars.
 * Collision risk при 10K words на пару языков ≈ 10⁻³⁰ — acceptable.
 */
export async function wordStatusId(
  word: string,
  bookLanguage: BookLanguage,
  nativeLanguage: NativeLanguage,
): Promise<string> {
  const input = `${word.toLowerCase().normalize('NFC')}\x00${bookLanguage}\x00${nativeLanguage}`;
  const full = await Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, input);
  return full.slice(0, 16);
}

/** 1:1 relation reading_position ↔ book — ID = bookId. */
export function readingPositionId(bookId: string): string {
  return bookId;
}

/**
 * `${date}__${book_id}`. Для агрегатов "any book" — sentinel '__all__'
 * (SQLite NULL != NULL ломает UNIQUE composite).
 */
export function readingStatsId(date: string, bookId: string | null): string {
  return `${date}__${bookId ?? ALL_BOOKS_SENTINEL}`;
}
