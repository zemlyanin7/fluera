import { inlineHash } from '@/services/translation/inlineHash';

describe('inlineHash', () => {
  it('returns stable 16-char hex for same input', async () => {
    const inlines = [{ type: 'text', text: 'hello' }];
    const a = await inlineHash(inlines as any);
    const b = await inlineHash(inlines as any);
    expect(a).toBe(b);
    expect(a).toMatch(/^[a-f0-9]{16}$/);
  });

  it('produces different hash for italic vs plain', async () => {
    const plain = [{ type: 'text', text: 'word' }];
    const italic = [{ type: 'italic', children: [{ type: 'text', text: 'word' }] }];
    const h1 = await inlineHash(plain as any);
    const h2 = await inlineHash(italic as any);
    expect(h1).not.toBe(h2);
  });
});
