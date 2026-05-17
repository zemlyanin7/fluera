export interface WaitForScrollIdleOptions {
  getVelocity: () => number;
  maxWaitMs: number;
  pollMs?: number;
}

export async function waitForScrollIdle(opts: WaitForScrollIdleOptions): Promise<void> {
  const poll = opts.pollMs ?? 20;
  const start = Date.now();
  while (Date.now() - start < opts.maxWaitMs) {
    if (opts.getVelocity() === 0) return;
    await new Promise((r) => setTimeout(r, poll));
  }
}
