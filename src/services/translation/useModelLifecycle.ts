// Hook: координирует ModelStore + ModelDownloader + LlmStatusStore.
// UI вызывает refreshStatus() на mount, startDownload() из CTA.
import { useCallback, useRef } from 'react';
import { useLlmStatusStore } from '@/stores/llmStatusStore';
import { ModelStore } from './ModelStore';
import { ModelDownloader } from './ModelDownloader';
import { MODEL_MANIFEST } from './modelManifest';

export interface UseModelLifecycleResult {
  refreshStatus: () => Promise<void>;
  startDownload: () => Promise<void>;
  pauseDownload: () => Promise<void>;
  resumeDownload: () => Promise<void>;
  cancelDownload: () => Promise<void>;
  wipeAndRedownload: () => Promise<void>;
}

export function useModelLifecycle(): UseModelLifecycleResult {
  const downloaderRef = useRef<ModelDownloader | null>(null);
  const setStatus = useLlmStatusStore((s) => s.setStatus);
  const setProgress = useLlmStatusStore((s) => s.setProgress);
  const setError = useLlmStatusStore((s) => s.setError);

  const refreshStatus = useCallback(async () => {
    const store = new ModelStore();
    const installed = await store.isInstalled();
    setStatus(installed ? 'installed' : 'not_installed');
  }, [setStatus]);

  const startDownload = useCallback(async () => {
    const store = new ModelStore();
    const downloader = new ModelDownloader();
    downloaderRef.current = downloader;
    setStatus('downloading');
    setProgress(0);
    setError(null);

    const res = await downloader.start({
      onProgress: (p) => setProgress(p),
    });

    if (res.ok) {
      await store.markInstalled(MODEL_MANIFEST.sha256);
      setStatus('installed');
    } else {
      setError(`Download failed: ${res.code ?? 'unknown'} ${res.errorMessage ?? ''}`);
    }
  }, [setStatus, setProgress, setError]);

  const pauseDownload = useCallback(async () => {
    await downloaderRef.current?.pause();
    setStatus('paused');
  }, [setStatus]);

  const resumeDownload = useCallback(async () => {
    setStatus('downloading');
    await downloaderRef.current?.resume();
  }, [setStatus]);

  const cancelDownload = useCallback(async () => {
    await downloaderRef.current?.cancel();
    setStatus('not_installed');
    setProgress(0);
  }, [setStatus, setProgress]);

  const wipeAndRedownload = useCallback(async () => {
    await new ModelStore().wipe();
    setStatus('not_installed');
    await startDownload();
  }, [setStatus, startDownload]);

  return { refreshStatus, startDownload, pauseDownload, resumeDownload, cancelDownload, wipeAndRedownload };
}
