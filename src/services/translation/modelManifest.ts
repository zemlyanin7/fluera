// Constants для GGUF модели + path helpers. Hardcoded URL/SHA — single
// source of truth для ModelDownloader + verifier.
import * as FileSystem from 'expo-file-system/legacy';

export interface ModelManifest {
  name: string;
  version: number;
  /**
   * SHA-256 of raw model bytes (совпадает с HuggingFace X-Linked-ETag).
   * Получить: `curl -sIL <resolve-URL> | grep -i x-linked-etag` ИЛИ
   * `curl -L <URL> -o m.gguf && sha256sum m.gguf`. Поле X-Linked-ETag
   * на HF — git-lfs sha256 of raw bytes, authoritative.
   */
  sha256: string;
  sizeBytes: number;
  url: string;
  filename: string;
}

// Verified против HF API на 2026-05-17:
// - repo: tencent/Hy-MT1.5-1.8B-1.25bit-GGUF
// - file: Hy-MT1.5-1.8B-1.25bit.gguf, size = 461,861,216 bytes
// - X-Linked-ETag (raw bytes SHA-256): 987121bc98...
export const MODEL_MANIFEST: ModelManifest = {
  name: 'Hy-MT1.5-1.8B-1.25bit',
  version: 1,
  sha256: '987121bc98dd7107078019f63e72447d67b224efe97da75811e74529e22e3525',
  sizeBytes: 461_861_216,
  url: 'https://huggingface.co/tencent/Hy-MT1.5-1.8B-1.25bit-GGUF/resolve/main/Hy-MT1.5-1.8B-1.25bit.gguf',
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
