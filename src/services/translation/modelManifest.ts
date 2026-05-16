// Constants для GGUF модели + path helpers. Hardcoded URL/SHA — single
// source of truth для ModelDownloader + verifier.
import * as FileSystem from 'expo-file-system/legacy';

export interface ModelManifest {
  name: string;
  version: number;
  /**
   * SHA-256 of base64-encoded model bytes (NOT raw bytes). См. verifyModel.ts —
   * mobile SHA computation идёт через base64 read из expo-file-system.
   * Получить: `curl -sL <URL> -o m.gguf && base64 m.gguf | sha256sum`.
   *
   * Placeholder (все нули) — заменить перед device smoke. До замены
   * ModelDownloader всегда будет fail'ить verify → ОК для dev.
   */
  sha256: string;
  sizeBytes: number;
  url: string;
  filename: string;
}

// ⚠️ URL и filename — best-guess. Проверить на huggingface.co/tencent —
// модель может называться иначе (Hy-MT1.5_1.8B_IQ1_S.gguf или подобное).
// sizeBytes: 1.8B params × 1.25-bit = ~281MB raw + GGUF metadata/embed
// overhead ≈ ~440MB. Replace на точный размер после curl -I HEAD request.
export const MODEL_MANIFEST: ModelManifest = {
  name: 'Hy-MT1.5-1.8B-1.25bit',
  version: 1,
  sha256: '0000000000000000000000000000000000000000000000000000000000000000',
  sizeBytes: 440_000_000,
  url: 'https://huggingface.co/tencent/Hunyuan-MT-1.5B-1.8B-1.25bit-GGUF/resolve/main/Hy-MT1.5-1.8B-1.25bit.gguf',
  filename: 'Hy-MT1.5-1.8B-1.25bit.gguf',
};

export function getModelLocalDir(): string {
  return `${FileSystem.documentDirectory}llm/`;
}

export function getModelLocalPath(): string {
  return `${getModelLocalDir()}${MODEL_MANIFEST.filename}`;
}

export function getModelPartialPath(): string {
  return `${getModelLocalPath()}.partial`;
}
