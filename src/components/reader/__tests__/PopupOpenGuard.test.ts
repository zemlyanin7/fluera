import { waitForScrollIdle } from '@/components/reader/PopupOpenGuard';

describe('waitForScrollIdle', () => {
  it('resolves immediately when velocity already 0', async () => {
    const t0 = Date.now();
    await waitForScrollIdle({ getVelocity: () => 0, maxWaitMs: 150 });
    expect(Date.now() - t0).toBeLessThan(50);
  });

  it('resolves after velocity drops к 0 within window', async () => {
    let v = 5;
    setTimeout(() => { v = 0; }, 60);
    const t0 = Date.now();
    await waitForScrollIdle({ getVelocity: () => v, maxWaitMs: 150 });
    expect(Date.now() - t0).toBeGreaterThanOrEqual(50);
    expect(Date.now() - t0).toBeLessThan(150);
  });

  it('resolves after maxWaitMs даже если velocity не падает', async () => {
    const t0 = Date.now();
    await waitForScrollIdle({ getVelocity: () => 10, maxWaitMs: 100 });
    expect(Date.now() - t0).toBeGreaterThanOrEqual(100);
  });
});
