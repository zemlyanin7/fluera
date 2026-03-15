/**
 * Маппинг именованных HTML-сущностей к соответствующим Unicode-символам.
 * Охватывает ~180 сущностей: базовые, типографические, математические,
 * стрелки, латинский-1, греческий алфавит, пространственные символы.
 */
export const HTML_ENTITIES: Record<string, string> = {
  // --- Базовые ---
  amp: '&',
  lt: '<',
  gt: '>',
  quot: '"',
  apos: "'",
  nbsp: '\u00A0',

  // --- Типографические ---
  mdash: '\u2014',
  ndash: '\u2013',
  laquo: '\u00AB',
  raquo: '\u00BB',
  hellip: '\u2026',
  bull: '\u2022',
  middot: '\u00B7',
  rsquo: '\u2019',
  lsquo: '\u2018',
  rdquo: '\u201D',
  ldquo: '\u201C',
  prime: '\u2032',
  Prime: '\u2033',
  trade: '\u2122',
  copy: '\u00A9',
  reg: '\u00AE',
  sect: '\u00A7',
  para: '\u00B6',
  dagger: '\u2020',
  Dagger: '\u2021',
  permil: '\u2030',

  // --- Математические / символы ---
  minus: '\u2212',
  times: '\u00D7',
  divide: '\u00F7',
  plusmn: '\u00B1',
  le: '\u2264',
  ge: '\u2265',
  ne: '\u2260',
  asymp: '\u2248',
  infin: '\u221E',
  sum: '\u2211',
  prod: '\u220F',
  radic: '\u221A',
  part: '\u2202',
  nabla: '\u2207',
  int: '\u222B',
  deg: '\u00B0',
  micro: '\u00B5',
  frac12: '\u00BD',
  frac14: '\u00BC',
  frac34: '\u00BE',
  sup1: '\u00B9',
  sup2: '\u00B2',
  sup3: '\u00B3',
  not: '\u00AC',
  and: '\u2227',
  or: '\u2228',
  cap: '\u2229',
  cup: '\u222A',
  exist: '\u2203',
  forall: '\u2200',
  isin: '\u2208',
  notin: '\u2209',
  ni: '\u220B',
  empty: '\u2205',
  sub: '\u2282',
  sup: '\u2283',
  sube: '\u2286',
  supe: '\u2287',
  oplus: '\u2295',
  otimes: '\u2297',
  perp: '\u22A5',
  sdot: '\u22C5',
  circ: '\u02C6',
  tilde: '\u02DC',

  // --- Стрелки ---
  larr: '\u2190',
  rarr: '\u2192',
  uarr: '\u2191',
  darr: '\u2193',
  harr: '\u2194',
  lArr: '\u21D0',
  rArr: '\u21D2',
  uArr: '\u21D1',
  dArr: '\u21D3',
  hArr: '\u21D4',
  crarr: '\u21B5',

  // --- Латинский-1 Supplement (U+00C0–U+00FF) ---
  // Заглавные
  Agrave: '\u00C0',
  Aacute: '\u00C1',
  Acirc: '\u00C2',
  Atilde: '\u00C3',
  Auml: '\u00C4',
  Aring: '\u00C5',
  AElig: '\u00C6',
  Ccedil: '\u00C7',
  Egrave: '\u00C8',
  Eacute: '\u00C9',
  Ecirc: '\u00CA',
  Euml: '\u00CB',
  Igrave: '\u00CC',
  Iacute: '\u00CD',
  Icirc: '\u00CE',
  Iuml: '\u00CF',
  ETH: '\u00D0',
  Ntilde: '\u00D1',
  Ograve: '\u00D2',
  Oacute: '\u00D3',
  Ocirc: '\u00D4',
  Otilde: '\u00D5',
  Ouml: '\u00D6',
  Oslash: '\u00D8',
  Ugrave: '\u00D9',
  Uacute: '\u00DA',
  Ucirc: '\u00DB',
  Uuml: '\u00DC',
  Yacute: '\u00DD',
  THORN: '\u00DE',
  szlig: '\u00DF',
  // Строчные
  agrave: '\u00E0',
  aacute: '\u00E1',
  acirc: '\u00E2',
  atilde: '\u00E3',
  auml: '\u00E4',
  aring: '\u00E5',
  aelig: '\u00E6',
  ccedil: '\u00E7',
  egrave: '\u00E8',
  eacute: '\u00E9',
  ecirc: '\u00EA',
  euml: '\u00EB',
  igrave: '\u00EC',
  iacute: '\u00ED',
  icirc: '\u00EE',
  iuml: '\u00EF',
  eth: '\u00F0',
  ntilde: '\u00F1',
  ograve: '\u00F2',
  oacute: '\u00F3',
  ocirc: '\u00F4',
  otilde: '\u00F5',
  ouml: '\u00F6',
  oslash: '\u00F8',
  ugrave: '\u00F9',
  uacute: '\u00FA',
  ucirc: '\u00FB',
  uuml: '\u00FC',
  yacute: '\u00FD',
  thorn: '\u00FE',
  yuml: '\u00FF',
  // Дополнительные латинские символы
  OElig: '\u0152',
  oelig: '\u0153',
  Scaron: '\u0160',
  scaron: '\u0161',
  Yuml: '\u0178',
  fnof: '\u0192',

  // --- Греческий алфавит ---
  // Заглавные
  Alpha: '\u0391',
  Beta: '\u0392',
  Gamma: '\u0393',
  Delta: '\u0394',
  Epsilon: '\u0395',
  Zeta: '\u0396',
  Eta: '\u0397',
  Theta: '\u0398',
  Iota: '\u0399',
  Kappa: '\u039A',
  Lambda: '\u039B',
  Mu: '\u039C',
  Nu: '\u039D',
  Xi: '\u039E',
  Omicron: '\u039F',
  Pi: '\u03A0',
  Rho: '\u03A1',
  Sigma: '\u03A3',
  Tau: '\u03A4',
  Upsilon: '\u03A5',
  Phi: '\u03A6',
  Chi: '\u03A7',
  Psi: '\u03A8',
  Omega: '\u03A9',
  // Строчные
  alpha: '\u03B1',
  beta: '\u03B2',
  gamma: '\u03B3',
  delta: '\u03B4',
  epsilon: '\u03B5',
  zeta: '\u03B6',
  eta: '\u03B7',
  theta: '\u03B8',
  iota: '\u03B9',
  kappa: '\u03BA',
  lambda: '\u03BB',
  mu: '\u03BC',
  nu: '\u03BD',
  xi: '\u03BE',
  omicron: '\u03BF',
  pi: '\u03C0',
  rho: '\u03C1',
  sigmaf: '\u03C2',
  sigma: '\u03C3',
  tau: '\u03C4',
  upsilon: '\u03C5',
  phi: '\u03C6',
  chi: '\u03C7',
  psi: '\u03C8',
  omega: '\u03C9',
  thetasym: '\u03D1',
  upsih: '\u03D2',
  piv: '\u03D6',

  // --- Пространственные / форматирующие символы ---
  ensp: '\u2002',
  emsp: '\u2003',
  thinsp: '\u2009',
  zwj: '\u200D',
  zwnj: '\u200C',
  zwnbsp: '\uFEFF',
  lrm: '\u200E',
  rlm: '\u200F',

  // --- Прочие типографические символы ---
  lsaquo: '\u2039',
  rsaquo: '\u203A',
  sbquo: '\u201A',
  bdquo: '\u201E',
  euro: '\u20AC',
  yen: '\u00A5',
  pound: '\u00A3',
  cent: '\u00A2',
  curren: '\u00A4',
  ordm: '\u00BA',
  ordf: '\u00AA',
  iexcl: '\u00A1',
  iquest: '\u00BF',
  uml: '\u00A8',
  macr: '\u00AF',
  acute: '\u00B4',
  cedil: '\u00B8',
  ordm2: '\u00BA',
  shy: '\u00AD',
  spades: '\u2660',
  clubs: '\u2663',
  hearts: '\u2665',
  diams: '\u2666',
  loz: '\u25CA',
};

/**
 * Декодирует HTML-сущности в строке.
 *
 * Поддерживает:
 * - Именованные сущности: `&amp;` → `&`, `&mdash;` → `—`
 * - Десятичные числовые ссылки: `&#160;` → `\u00A0`
 * - Шестнадцатеричные числовые ссылки: `&#x00A0;` → `\u00A0`
 */
export function decodeHtmlEntities(text: string): string {
  return text.replace(/&([^;]+);/g, (match, entity: string) => {
    // Числовые ссылки — шестнадцатеричные (&#xNNNN;)
    if (entity.startsWith('#x') || entity.startsWith('#X')) {
      const codePoint = parseInt(entity.slice(2), 16);
      if (!isNaN(codePoint)) {
        return String.fromCodePoint(codePoint);
      }
      return match;
    }

    // Числовые ссылки — десятичные (&#NNNN;)
    if (entity.startsWith('#')) {
      const codePoint = parseInt(entity.slice(1), 10);
      if (!isNaN(codePoint)) {
        return String.fromCodePoint(codePoint);
      }
      return match;
    }

    // Именованные сущности
    const resolved = HTML_ENTITIES[entity];
    return resolved !== undefined ? resolved : match;
  });
}
