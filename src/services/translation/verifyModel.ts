// SHA-256 verification по raw bytes (совпадает с HuggingFace X-Linked-ETag).
// Pipeline: read file as base64 → decode base64 → Uint8Array → digest →
// hex compare. Memory peak: ~base64+raw ≈ 2× filesize. Acceptable для
// one-time post-download verify на 440MB модели (~880MB peak на iPhone 13+
// с 6GB RAM нормально). Android low-end (<3GB) — может swap, но это
// единственный момент high memory.
import * as Crypto from 'expo-crypto';
import * as FileSystem from 'expo-file-system/legacy';
import { base64Decode } from '@/services/parser/shared/base64Decode';

function bufferToHex(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let out = '';
  for (let i = 0; i < bytes.length; i++) {
    const b = bytes[i] as number;
    out += b.toString(16).padStart(2, '0');
  }
  return out;
}

export async function verifyModelSha256(
  filePath: string,
  expectedHex: string,
): Promise<boolean> {
  const base64 = await FileSystem.readAsStringAsync(filePath, {
    encoding: FileSystem.EncodingType.Base64,
  });
  const bytes = base64Decode(base64);
  // TS-cast: Uint8Array<ArrayBufferLike> vs BufferSource ArrayBuffer mismatch
  // в strict mode. Runtime — обычный Uint8Array.
  const digest = await Crypto.digest(
    Crypto.CryptoDigestAlgorithm.SHA256,
    bytes as unknown as ArrayBuffer,
  );
  const actualHex = bufferToHex(digest);
  return actualHex.toLowerCase() === expectedHex.toLowerCase();
}
