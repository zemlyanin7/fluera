import { extractContextForWord } from '@/services/reader/extractContextForWord';
import type { InlineNode } from '@/types/content';

function makeText(text: string): InlineNode[] {
  return [{ type: 'text', text }];
}

describe('extractContextForWord', () => {
  it('returns sentence containing word', () => {
    const inlines = makeText('Hello. World tap here.');
    const r = extractContextForWord(inlines, 'World', 7, 'en');
    expect(r.plainText).toBe('World tap here.');
    expect(r.wordOffsetInPlain).toBe(0);
    expect(r.wasCapped).toBe(false);
  });

  it('caps long sentence per-language (Latin 150)', () => {
    const long = 'a '.repeat(100) + 'target ' + 'b '.repeat(100);
    const inlines = makeText(long);
    const offset = long.indexOf('target');
    const r = extractContextForWord(inlines, 'target', offset, 'en');
    expect(r.plainText.length).toBeLessThanOrEqual(180);
    expect(r.wasCapped).toBe(true);
  });

  it('Cyrillic cap = 200', () => {
    const long = 'слово '.repeat(40);
    const inlines = makeText(long);
    const r = extractContextForWord(inlines, 'слово', 100, 'ru');
    expect(r.wasCapped).toBe(true);
  });

  it('CJK cap = 90', () => {
    const long = 'こんにちは'.repeat(30);
    const inlines = makeText(long);
    const r = extractContextForWord(inlines, 'こん', 50, 'ja');
    expect(r.wasCapped).toBe(true);
    expect(r.plainText.length).toBeLessThanOrEqual(120);
  });

  it('preserves italic formatting в результате', () => {
    const inlines: InlineNode[] = [
      { type: 'text', text: 'She ' },
      { type: 'italic', children: [{ type: 'text', text: 'walked' }] },
      { type: 'text', text: ' away.' },
    ];
    const r = extractContextForWord(inlines, 'walked', 4, 'en');
    const hasItalic = JSON.stringify(r.inlines).includes('"italic"');
    expect(hasItalic).toBe(true);
  });

  it('wordOffsetInPlain корректен', () => {
    const inlines = makeText('First sentence. Word in second.');
    const r = extractContextForWord(inlines, 'Word', 16, 'en');
    expect(r.plainText).toBe('Word in second.');
    expect(r.wordOffsetInPlain).toBe(0);
    expect(r.wordLength).toBe(4);
  });

  it('escalation по semicolon когда sentence слишком длинный', () => {
    // Предложение > 150 символов (en cap), слово 'target' в отдельном клоузе
    const text =
      'Part one is short and descriptive here; part two contains the target word specifically right here; part three follows with more text and details; part four adds even more words to exceed the cap here.';
    const inlines = makeText(text);
    const offset = text.indexOf('target');
    const r = extractContextForWord(inlines, 'target', offset, 'en');
    expect(r.wasCapped).toBe(true);
    expect(r.plainText).toContain('target');
    expect(r.plainText.length).toBeLessThanOrEqual(150);
  });
});
