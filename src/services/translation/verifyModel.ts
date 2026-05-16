// SHA-256 verification для скачанной GGUF. expo-file-system reads file
// as base64 (нет stream API на JS layer без custom JSI). digestStringAsync
// хеширует base64-string. → manifest.sha256 хранит SHA-256 of base64(bytes),
// НЕ raw bytes. См. modelManifest.ts comment.
import * as Crypto from 'expo-crypto';
import * as FileSystem from 'expo-file-system/legacy';

export async function verifyModelSha256(
  filePath: string,
  expectedHex: string,
): Promise<boolean> {
  const base64 = await FileSystem.readAsStringAsync(filePath, {
    encoding: FileSystem.EncodingType.Base64,
  });
  const actual = await Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, base64);
  return actual.toLowerCase() === expectedHex.toLowerCase();
}
