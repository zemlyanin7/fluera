import { parseMweCsv } from '@/services/translation/dictionaries/parseMweCsv';

const SAMPLE = `mwe,translation_equivalent,literal_gloss,type,gap_pattern,domain,attribution
kick the bucket,сыграть в ящик,ударить ведро,idiom,,general,wiktionary
give __ up,сдаваться,отдать __ вверх,phrasal_verb,__≤3,general,wiktionary
`;

describe('parseMweCsv', () => {
  it('parses 2 rows correctly', () => {
    const rows = parseMweCsv(SAMPLE);
    expect(rows).toHaveLength(2);
    expect(rows[0]!.phrase).toBe('kick the bucket');
    expect(rows[0]!.translationEquivalent).toBe('сыграть в ящик');
    expect(rows[0]!.gapPattern).toBeNull();
    expect(rows[1]!.gapPattern).toBe('__≤3');
  });

  it('skips header + empty lines', () => {
    const rows = parseMweCsv(SAMPLE + '\n\n');
    expect(rows).toHaveLength(2);
  });
});
