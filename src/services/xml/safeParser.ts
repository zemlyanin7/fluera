// Защитные проверки XML payload перед парсингом. Реализация именно парсера —
// в #3 (FB2) и #5 (OPDS). Здесь только signature + входная фильтрация
// от XXE / billion laughs / oversize.
//
// По спеке §6.7 (HIGH security fix):
// - REJECT-ANY-DOCTYPE (не whitelist ENTITY/SYSTEM/PUBLIC — regex обходим)
// - reject <?xml-stylesheet PI с external refs
// - size cap (default 50MB, caller может ужать для OPDS до 5MB)

export interface SafeXmlOpts {
  /** Default 50MB. Caller для OPDS feed должен ужать до 5MB. */
  maxBytes?: number;
}

const DEFAULT_MAX_BYTES = 50 * 1024 * 1024;

export function assertSafeXml(source: string, opts: SafeXmlOpts = {}): void {
  const cap = opts.maxBytes ?? DEFAULT_MAX_BYTES;
  if (source.length > cap) {
    throw new Error(`XML payload too large (>${cap} bytes)`);
  }
  if (/<!DOCTYPE/i.test(source)) {
    throw new Error('XML DOCTYPE rejected — external entity references not allowed');
  }
  if (/<\?xml-stylesheet/i.test(source)) {
    throw new Error('XML stylesheet processing instruction rejected');
  }
}
