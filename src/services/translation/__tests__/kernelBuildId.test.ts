import { getKernelBuildId } from '@/services/translation/kernelBuildId';

describe('kernelBuildId', () => {
  it('returns stable string identifying current llama.rn build', () => {
    const id1 = getKernelBuildId();
    const id2 = getKernelBuildId();
    expect(id1).toBe(id2);
    expect(id1).toMatch(/^[a-z0-9-]+$/);
    expect(id1.length).toBeGreaterThan(4);
  });
});
