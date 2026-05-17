import { LlamaContextManager } from '../LlamaContextManager';

describe('LlamaContextManager', () => {
  beforeEach(() => LlamaContextManager.resetForTests());

  it('singleton returns same instance', () => {
    const a = LlamaContextManager.instance();
    const b = LlamaContextManager.instance();
    expect(a).toBe(b);
  });

  it('getContext returns null before load', () => {
    expect(LlamaContextManager.instance().getContext()).toBeNull();
  });

  it('load sets context and returns it', async () => {
    const mockCtx = { completion: jest.fn().mockResolvedValue({ text: 'x' }), release: jest.fn() };
    const loader = jest.fn().mockResolvedValue(mockCtx);
    const mgr = LlamaContextManager.instance();
    await mgr.load(loader);
    expect(mgr.getContext()).toBe(mockCtx);
  });

  it('load deduplicates concurrent calls', async () => {
    const mockCtx = { completion: jest.fn(), release: jest.fn() };
    const loader = jest.fn().mockImplementation(() => new Promise((r) => setTimeout(() => r(mockCtx), 30)));
    const mgr = LlamaContextManager.instance();
    const [a, b] = await Promise.all([mgr.load(loader), mgr.load(loader)]);
    expect(a).toBe(b);
    expect(loader).toHaveBeenCalledTimes(1);
  });

  it('unload releases context', async () => {
    const release = jest.fn().mockResolvedValue(undefined);
    const mockCtx = { completion: jest.fn(), release };
    const mgr = LlamaContextManager.instance();
    await mgr.load(jest.fn().mockResolvedValue(mockCtx));
    await mgr.unload();
    expect(release).toHaveBeenCalled();
    expect(mgr.getContext()).toBeNull();
  });
});
