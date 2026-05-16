import { useLlmStatusStore } from '../llmStatusStore';

describe('llmStatusStore', () => {
  beforeEach(() => {
    useLlmStatusStore.setState({ status: 'not_installed', progress: 0, errorMessage: null });
  });

  it('default state is not_installed', () => {
    expect(useLlmStatusStore.getState().status).toBe('not_installed');
  });

  it('setStatus changes status', () => {
    useLlmStatusStore.getState().setStatus('downloading');
    expect(useLlmStatusStore.getState().status).toBe('downloading');
  });

  it('setProgress clamps to [0,1]', () => {
    useLlmStatusStore.getState().setProgress(-0.5);
    expect(useLlmStatusStore.getState().progress).toBe(0);
    useLlmStatusStore.getState().setProgress(1.5);
    expect(useLlmStatusStore.getState().progress).toBe(1);
    useLlmStatusStore.getState().setProgress(0.42);
    expect(useLlmStatusStore.getState().progress).toBe(0.42);
  });

  it('setError sets errorMessage and status=error if non-null', () => {
    useLlmStatusStore.getState().setError('boom');
    expect(useLlmStatusStore.getState().errorMessage).toBe('boom');
    expect(useLlmStatusStore.getState().status).toBe('error');
  });

  it('setError(null) clears error but does not change status', () => {
    useLlmStatusStore.setState({ status: 'ready', errorMessage: 'old', progress: 0 });
    useLlmStatusStore.getState().setError(null);
    expect(useLlmStatusStore.getState().errorMessage).toBeNull();
    expect(useLlmStatusStore.getState().status).toBe('ready');
  });
});
