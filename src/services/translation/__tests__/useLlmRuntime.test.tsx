import { renderHook, act } from '@testing-library/react-native';
import { useLlmRuntime } from '../useLlmRuntime';
import { useLlmStatusStore } from '@/stores/llmStatusStore';
import { LlamaContextManager } from '../LlamaContextManager';

describe('useLlmRuntime', () => {
  beforeEach(() => {
    LlamaContextManager.resetForTests();
    useLlmStatusStore.setState({ status: 'installed', progress: 0, errorMessage: null });
  });

  it('load() transitions installed → loading → warming_up → ready', async () => {
    const events: string[] = [];
    const unsub = useLlmStatusStore.subscribe((s) => events.push(s.status));
    const loader = jest.fn().mockResolvedValue({
      completion: jest.fn().mockResolvedValue({ text: 'hi' }),
      release: jest.fn(),
    });
    const { result } = renderHook(() => useLlmRuntime({ loader }));
    await act(async () => {
      await result.current.load();
    });
    unsub();
    expect(useLlmStatusStore.getState().status).toBe('ready');
    expect(events).toContain('loading');
    expect(events).toContain('warming_up');
    expect(events).toContain('ready');
  });

  it('skip load if status != installed', async () => {
    useLlmStatusStore.setState({ status: 'not_installed' } as any);
    const loader = jest.fn();
    const { result } = renderHook(() => useLlmRuntime({ loader }));
    await act(async () => {
      await result.current.load();
    });
    expect(loader).not.toHaveBeenCalled();
  });

  it('error path sets status=error', async () => {
    const loader = jest.fn().mockRejectedValue(new Error('boom'));
    const { result } = renderHook(() => useLlmRuntime({ loader }));
    await act(async () => {
      await result.current.load();
    });
    expect(useLlmStatusStore.getState().status).toBe('error');
  });

  it('unload returns status to installed', async () => {
    const loader = jest.fn().mockResolvedValue({
      completion: jest.fn().mockResolvedValue({ text: 'hi' }),
      release: jest.fn().mockResolvedValue(undefined),
    });
    const { result } = renderHook(() => useLlmRuntime({ loader }));
    await act(async () => {
      await result.current.load();
    });
    await act(async () => {
      await result.current.unload();
    });
    expect(useLlmStatusStore.getState().status).toBe('installed');
  });
});
