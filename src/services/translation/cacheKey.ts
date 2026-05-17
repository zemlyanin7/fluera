// Versioned cache keys для TranslationCache.
// buildCacheKey / buildSentenceCacheKey — async SHA-256 (64-char hex),
// включают modelVersion + kernelBuildId для автоматической инвалидации
// при обновлении модели или kernel-патча.
//
// computeCacheKey (legacy) — синхронный FNV-1a для useTranslation hook
// (hot-path UI: SHA-256 async 5-15ms убивал бы react render).
import * as Crypto from 'expo-crypto';
import type { BookLanguage, NativeLanguage } from '@/types/settings';

// ─── Legacy sync key (FNV-1a 64-bit) ─────────────────────────────────────────
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

/** Синхронный ключ (FNV-1a). Используется в useTranslation hook для UI hot-path. */
export function computeCacheKey(
  word: string,
  contextWindow: string,
  bookLanguage: BookLanguage,
  nativeLanguage: NativeLanguage,
): string {
  const normalized = word.toLowerCase().normalize('NFC');
  const ctxNorm = contextWindow.normalize('NFC');
  const hash = fnv1a64Hex(`${normalized}\x00${ctxNorm}`);
  return `${hash}_${bookLanguage}-${nativeLanguage}`;
}

// ─── Versioned async keys (SHA-256, 64-char) ─────────────────────────────────

export interface CacheKeyInput {
  word: string;
  contextWindow: string;
  bookLanguage: BookLanguage;
  nativeLanguage: NativeLanguage;
  modelVersion: string;
  kernelBuildId: string;
}

/** Версионированный ключ для word-level переводов. Полный SHA-256 hex (64 chars). */
export async function buildCacheKey(input: CacheKeyInput): Promise<string> {
  const normalized = [
    input.word.toLowerCase().trim(),
    input.contextWindow.trim(),
    `${input.bookLanguage}-${input.nativeLanguage}`,
    `mv${input.modelVersion}`,
    `kb${input.kernelBuildId}`,
  ].join('::');
  return await Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, normalized);
}

export interface SentenceCacheKeyInput {
  sentence: string;
  bookLanguage: BookLanguage;
  nativeLanguage: NativeLanguage;
  modelVersion: string;
  kernelBuildId: string;
}

/** Версионированный ключ для sentence-level переводов. Полный SHA-256 hex (64 chars). */
export async function buildSentenceCacheKey(input: SentenceCacheKeyInput): Promise<string> {
  const normalized = [
    'sentence',
    input.sentence.trim(),
    `${input.bookLanguage}-${input.nativeLanguage}`,
    `mv${input.modelVersion}`,
    `kb${input.kernelBuildId}`,
  ].join('::');
  return await Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, normalized);
}
