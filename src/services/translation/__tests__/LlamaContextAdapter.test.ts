import { LlamaContextAdapter } from '../LlamaContextAdapter';

const mockNativeCtx = {
  completion: jest.fn(),
  release: jest.fn(),
};

describe('LlamaContextAdapter', () => {
  beforeEach(() => jest.clearAllMocks());

  it('completion returns text', async () => {
    mockNativeCtx.completion.mockResolvedValue({ text: 'hello world' });
    const adapter = new LlamaContextAdapter(mockNativeCtx as never);
    const res = await adapter.completion('test', { max_tokens: 10 });
    expect(res.text).toBe('hello world');
  });

  it('completion maps config to llama.rn params', async () => {
    mockNativeCtx.completion.mockResolvedValue({ text: 'x' });
    const adapter = new LlamaContextAdapter(mockNativeCtx as never);
    await adapter.completion('p', { temperature: 0.5, max_tokens: 20, stop: ['.'] });
    expect(mockNativeCtx.completion).toHaveBeenCalledWith(
      expect.objectContaining({ prompt: 'p', temperature: 0.5, n_predict: 20, stop: ['.'] }),
    );
  });

  it('release calls native release', async () => {
    mockNativeCtx.release.mockResolvedValue(undefined);
    const adapter = new LlamaContextAdapter(mockNativeCtx as never);
    await adapter.release();
    expect(mockNativeCtx.release).toHaveBeenCalled();
  });
});
