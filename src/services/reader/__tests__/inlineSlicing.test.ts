import { flattenWithIndex, splitSentencesSmartly } from '@/services/reader/inlineSlicing';
import type { InlineNode } from '@/types/content';

// ─── flattenWithIndex ────────────────────────────────────────────────────────

describe('flattenWithIndex', () => {
  it('plain text concat с offsets', () => {
    const inlines: InlineNode[] = [
      { type: 'text', text: 'Hello ' },
      { type: 'text', text: 'world.' },
    ];
    const { plainText, inlineMap } = flattenWithIndex(inlines);
    expect(plainText).toBe('Hello world.');
    expect(inlineMap).toHaveLength(2);
    expect(inlineMap[0]).toMatchObject({ plainStart: 0, plainEnd: 6 });
    expect(inlineMap[1]).toMatchObject({ plainStart: 6, plainEnd: 12 });
  });

  it('italic node — children flattened with wrappers', () => {
    const inlines: InlineNode[] = [
      { type: 'text', text: 'She ' },
      { type: 'italic', children: [{ type: 'text', text: 'walked' }] },
      { type: 'text', text: ' away.' },
    ];
    const { plainText, inlineMap } = flattenWithIndex(inlines);
    expect(plainText).toBe('She walked away.');
    expect(inlineMap).toHaveLength(3);
    expect(inlineMap[1]!.plainText).toBe('walked');
    expect(inlineMap[1]!.wrappers).toContain('italic');
  });

  it('nested formatting — bold inside italic', () => {
    const inlines: InlineNode[] = [
      {
        type: 'italic',
        children: [
          { type: 'text', text: 'very ' },
          { type: 'bold', children: [{ type: 'text', text: 'angry' }] },
        ],
      },
    ];
    const { plainText, inlineMap } = flattenWithIndex(inlines);
    expect(plainText).toBe('very angry');
    const angryEntry = inlineMap.find((e) => e.plainText === 'angry');
    expect(angryEntry!.wrappers).toEqual(['italic', 'bold']);
  });

  it('footnote-ref skipped from plain text', () => {
    const inlines: InlineNode[] = [
      { type: 'text', text: 'Reference' },
      { type: 'footnote-ref', id: 'fn1', label: '1' },
      { type: 'text', text: ' here.' },
    ];
    const { plainText } = flattenWithIndex(inlines);
    expect(plainText).toBe('Reference here.');
  });
});

// ─── splitSentencesSmartly ──────────────────────────────────────────────────

describe('splitSentencesSmartly', () => {
  it('basic split .!?', () => {
    const spans = splitSentencesSmartly('Hello world. How are you? Fine!');
    expect(spans).toHaveLength(3);
    expect(spans[0]!.text).toBe('Hello world.');
    expect(spans[1]!.text).toBe('How are you?');
    expect(spans[2]!.text).toBe('Fine!');
  });

  it('Mr. abbreviation preserved — не разрывает', () => {
    const spans = splitSentencesSmartly('Mr. Smith went home. He was tired.');
    expect(spans).toHaveLength(2);
    expect(spans[0]!.text).toContain('Mr. Smith');
  });

  it('decimal 3.14 preserved — не разрывает', () => {
    const spans = splitSentencesSmartly('Pi is 3.14 approximately. Next sentence.');
    expect(spans).toHaveLength(2);
    expect(spans[0]!.text).toContain('3.14');
  });

  it('ellipsis Wait... — single boundary', () => {
    const spans = splitSentencesSmartly('Wait... I forgot. Then he left.');
    // "Wait..." → нормализуется в "Wait…", одна граница
    expect(spans.length).toBeGreaterThanOrEqual(2);
    expect(spans[0]!.text).toMatch(/Wait[…\.]+/);
  });

  it('quoted speech "Hi!" — не разрывает внутри', () => {
    const spans = splitSentencesSmartly('She said "Hi!" and left.');
    expect(spans).toHaveLength(1);
    expect(spans[0]!.text).toContain('"Hi!"');
  });

  it('CJK これは。文。', () => {
    const spans = splitSentencesSmartly('これは。文。');
    expect(spans).toHaveLength(2);
    expect(spans[0]!.text).toBe('これは。');
    expect(spans[1]!.text).toBe('文。');
  });

  it('Arabic أين؟', () => {
    const spans = splitSentencesSmartly('أين؟ هنا.');
    expect(spans).toHaveLength(2);
    expect(spans[0]!.text).toBe('أين؟');
  });

  it('ASCII ... нормализуется к …', () => {
    const spans = splitSentencesSmartly('He left.... She stayed.');
    // Нормализованный ellipsis = одна граница
    expect(spans).toHaveLength(2);
    expect(spans[0]!.text).toContain('left');
    expect(spans[1]!.text).toBe('She stayed.');
  });

  it('RU г. abbreviation', () => {
    const spans = splitSentencesSmartly('В г. Москва всё хорошо. Следующее предложение.');
    expect(spans).toHaveLength(2);
    expect(spans[0]!.text).toContain('г. Москва');
  });
});
