import { InferenceQueue } from '../InferenceQueue';

describe('InferenceQueue', () => {
  it('runs single task and returns result', async () => {
    const q = new InferenceQueue();
    const res = await q.run(async () => 42);
    expect(res).toBe(42);
  });

  it('serializes concurrent calls', async () => {
    const q = new InferenceQueue();
    const order: number[] = [];
    const t1 = q.run(async () => {
      order.push(1);
      await new Promise((r) => setTimeout(r, 50));
      order.push(2);
      return 1;
    });
    const t2 = q.run(async () => {
      order.push(3);
      return 2;
    });
    await Promise.all([t1, t2]);
    expect(order).toEqual([1, 2, 3]);
  });

  it('continues even if earlier task rejects', async () => {
    const q = new InferenceQueue();
    const p1 = q.run(async () => {
      throw new Error('boom');
    });
    const p2 = q.run(async () => 99);
    await expect(p1).rejects.toThrow('boom');
    await expect(p2).resolves.toBe(99);
  });
});
