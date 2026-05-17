import { renderHook, act } from '@testing-library/react-native';

jest.mock('../ModelStore');
jest.mock('../ModelDownloader');

import { ModelStore } from '../ModelStore';
import { ModelDownloader } from '../ModelDownloader';
import { useModelLifecycle } from '../useModelLifecycle';
import { useLlmStatusStore } from '@/stores/llmStatusStore';

describe('useModelLifecycle', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    useLlmStatusStore.setState({ status: 'not_installed', progress: 0, errorMessage: null });
  });

  it('refreshStatus sets installed when model present', async () => {
    (ModelStore as jest.Mock).mockImplementation(() => ({
      isInstalled: jest.fn().mockResolvedValue(true),
    }));
    const { result } = renderHook(() => useModelLifecycle());
    await act(async () => {
      await result.current.refreshStatus();
    });
    expect(useLlmStatusStore.getState().status).toBe('installed');
  });

  it('refreshStatus keeps not_installed when model absent', async () => {
    (ModelStore as jest.Mock).mockImplementation(() => ({
      isInstalled: jest.fn().mockResolvedValue(false),
    }));
    const { result } = renderHook(() => useModelLifecycle());
    await act(async () => {
      await result.current.refreshStatus();
    });
    expect(useLlmStatusStore.getState().status).toBe('not_installed');
  });

  it('startDownload transitions through downloading → installed on ok', async () => {
    const downloadStart = jest.fn(async ({ onProgress }: { onProgress: (n: number) => void }) => {
      onProgress(0.5);
      return { ok: true };
    });
    (ModelDownloader as jest.Mock).mockImplementation(() => ({ start: downloadStart }));
    const markInstalled = jest.fn();
    (ModelStore as jest.Mock).mockImplementation(() => ({ markInstalled }));

    const { result } = renderHook(() => useModelLifecycle());
    await act(async () => {
      await result.current.startDownload();
    });
    expect(useLlmStatusStore.getState().status).toBe('installed');
    expect(markInstalled).toHaveBeenCalled();
  });

  it('startDownload sets error on failure', async () => {
    (ModelDownloader as jest.Mock).mockImplementation(() => ({
      start: jest.fn().mockResolvedValue({ ok: false, code: 'NETWORK_ERROR', errorMessage: 'net' }),
    }));
    (ModelStore as jest.Mock).mockImplementation(() => ({ markInstalled: jest.fn() }));

    const { result } = renderHook(() => useModelLifecycle());
    await act(async () => {
      await result.current.startDownload();
    });
    expect(useLlmStatusStore.getState().status).toBe('error');
    expect(useLlmStatusStore.getState().errorMessage).toContain('NETWORK_ERROR');
  });
});
