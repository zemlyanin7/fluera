// Integrity verify скачанной модели.
//
// IDEAL: SHA-256(raw bytes) против HF X-Linked-ETag. Проблема: Hermes JS
// engine имеет string length limit ~256MB chars. base64 representation
// 440MB файла = ~590MB string → "String length exceeds limit" crash.
// expo-file-system/legacy не поддерживает chunked / stream read.
//
// V1 COMPROMISE: size verify только. Ловит:
// - truncated downloads (network drop)
// - disk full mid-write
// - wrong file (URL change)
// НЕ ловит: malicious same-size replacement.
//
// V2 TODO: native chunked SHA через JSI ИЛИ migration на expo-file-system
// v2 (streaming read API). MODEL_MANIFEST.sha256 сохраняется для будущего
// use — пока validating только size.
import * as FileSystem from 'expo-file-system/legacy';
import { MODEL_MANIFEST } from './modelManifest';

export async function verifyModelSha256(
  filePath: string,
  _expectedHex: string,
): Promise<boolean> {
  const info = await FileSystem.getInfoAsync(filePath);
  if (!info.exists) return false;
  // info.size доступен если файл existing.
  const size = (info as { size?: number }).size;
  if (typeof size !== 'number') return false;
  return size === MODEL_MANIFEST.sizeBytes;
}
