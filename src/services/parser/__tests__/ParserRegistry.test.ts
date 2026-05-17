import { ParserRegistry } from '../ParserRegistry';
import type { IParser, ParsedBook } from '../types';

const stubParser: IParser = {
  parse: async () => ({
    title: 'X', author: null, language: null, coverId: null,
    chapters: [], footnotes: {}, images: [], totalChars: 0,
  } as ParsedBook),
};

describe('ParserRegistry', () => {
  it('returns registered parser', () => {
    const reg = new ParserRegistry();
    reg.register('epub', stubParser);
    expect(reg.get('epub')).toBe(stubParser);
  });

  it('throws for unknown format', () => {
    const reg = new ParserRegistry();
    expect(() => reg.get('fb2')).toThrow();
  });
});
