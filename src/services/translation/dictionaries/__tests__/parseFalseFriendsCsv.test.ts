import { parseFalseFriendsCsv } from '@/services/translation/dictionaries/parseFalseFriendsCsv';

const SAMPLE = `source_word,looks_like_native,actual_meaning,confidence,domain
магазин,magazine,"shop (not magazine)",high,general
sensible,sensible,"reasonable EN / sensitive ES — partial",medium,general
`;

describe('parseFalseFriendsCsv', () => {
  it('parses 2 rows + sourceLang/targetLang injected', () => {
    const rows = parseFalseFriendsCsv(SAMPLE, 'ru', 'en');
    expect(rows).toHaveLength(2);
    const row0 = rows[0]!;
    const row1 = rows[1]!;
    expect(row0.sourceLang).toBe('ru');
    expect(row0.targetLang).toBe('en');
    expect(row0.sourceWord).toBe('магазин');
    expect(row0.confidence).toBe('high');
    expect(row1.confidence).toBe('medium');
  });
});
