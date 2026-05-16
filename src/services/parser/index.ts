// Barrel + default registry со всеми парсерами.
export * from './types';
export { ParserRegistry } from './ParserRegistry';
export { EpubParser } from './EpubParser';
export { Fb2Parser } from './Fb2Parser';

import { ParserRegistry } from './ParserRegistry';
import { EpubParser } from './EpubParser';
import { Fb2Parser } from './Fb2Parser';

export function createDefaultParserRegistry(): ParserRegistry {
  const reg = new ParserRegistry();
  reg.register('epub', new EpubParser());
  reg.register('fb2', new Fb2Parser());
  return reg;
}
