// FNV-1a 64-bit sync hash для translation cache key. NOT security boundary —
// только dedup. По спеке §6.5: SHA-256 async (5-15ms) убивает hot-path reader,
// FNV-1a sync ~0.1ms.
// Алгоритм Björn Ottosson FNV-1a 64-bit, работает в BigInt.
import type { BookLanguage, NativeLanguage } from '@/types/settings';

const FNV_PRIME_64 = 1099511628211n;
const FNV_OFFSET_64 = 14695981039346656037n;
const MASK_64 = (1n << 64n) - 1n;

function fnv1a64Hex(input: string): string {
  let h = FNV_OFFSET_64;
  const bytes = new TextEncoder().encode(input.normalize('NFC'));
  for (let i = 0; i < bytes.length; i++) {
    h = (h ^ BigInt(bytes[i]!)) & MASK_64;
    h = (h * FNV_PRIME_64) & MASK_64;
  }
  return h.toString(16).padStart(16, '0');
}

export function computeCacheKey(
  word: string,
  contextWindow: string,
  bookLanguage: BookLanguage,
  nativeLanguage: NativeLanguage,
): string {
  const normalized = word.toLowerCase().normalize('NFC');
  const ctxNorm = contextWindow.normalize('NFC');
  const hash = fnv1a64Hex(`${normalized}\x00${ctxNorm}`);
  // 16 (hash) + 1 (_) + ~5 (lang pair) ≤ 32 chars
  return `${hash}_${bookLanguage}-${nativeLanguage}`;
}
