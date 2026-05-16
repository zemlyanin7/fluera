// Download Hy-MT GGUF из HuggingFace в Documents/llm. Resumable +
// progress callbacks + SHA-256 verify + atomic .partial → .gguf rename.
import * as FileSystem from 'expo-file-system/legacy';
import { MODEL_MANIFEST, getModelLocalDir, getModelLocalPath, getModelPartialPath } from './modelManifest';
import { verifyModelSha256 as defaultVerify } from './verifyModel';

export type DownloadErrorCode =
  | 'NETWORK_ERROR'
  | 'CHECKSUM_MISMATCH'
  | 'DISK_FULL'
  | 'CANCELLED';

export interface DownloadResult {
  ok: boolean;
  code?: DownloadErrorCode;
  errorMessage?: string;
}

export interface DownloadOptions {
  onProgress: (fraction: number) => void;
}

export interface ModelDownloaderDeps {
  verifySha256?: typeof defaultVerify;
}

export class ModelDownloader {
  private resumable: ReturnType<typeof FileSystem.createDownloadResumable> | null = null;
  private cancelled = false;
  private verifySha256: typeof defaultVerify;

  constructor(deps: ModelDownloaderDeps = {}) {
    this.verifySha256 = deps.verifySha256 ?? defaultVerify;
  }

  async start({ onProgress }: DownloadOptions): Promise<DownloadResult> {
    this.cancelled = false;
    try {
      await FileSystem.makeDirectoryAsync(getModelLocalDir(), { intermediates: true });

      this.resumable = FileSystem.createDownloadResumable(
        MODEL_MANIFEST.url,
        getModelPartialPath(),
        {},
        (event) => {
          if (event.totalBytesExpectedToWrite > 0) {
            onProgress(event.totalBytesWritten / event.totalBytesExpectedToWrite);
          }
        },
      );

      const result = await this.resumable.downloadAsync();
      if (this.cancelled) return { ok: false, code: 'CANCELLED' };
      if (!result) return { ok: false, code: 'NETWORK_ERROR', errorMessage: 'no result' };

      const verified = await this.verifySha256(getModelPartialPath(), MODEL_MANIFEST.sha256);
      if (!verified) {
        await FileSystem.deleteAsync(getModelPartialPath(), { idempotent: true });
        return { ok: false, code: 'CHECKSUM_MISMATCH' };
      }

      await FileSystem.moveAsync({
        from: getModelPartialPath(),
        to: getModelLocalPath(),
      });
      return { ok: true };
    } catch (e) {
      await FileSystem.deleteAsync(getModelPartialPath(), { idempotent: true }).catch(() => {});
      return { ok: false, code: 'NETWORK_ERROR', errorMessage: (e as Error).message };
    }
  }

  async pause(): Promise<void> {
    if (this.resumable) await this.resumable.pauseAsync();
  }

  async resume(): Promise<void> {
    if (this.resumable) await this.resumable.resumeAsync();
  }

  async cancel(): Promise<void> {
    this.cancelled = true;
    if (this.resumable) await this.resumable.pauseAsync().catch(() => {});
    await FileSystem.deleteAsync(getModelPartialPath(), { idempotent: true }).catch(() => {});
  }
}
