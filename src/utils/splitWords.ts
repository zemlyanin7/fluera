// Минимальный токенизатор для разбиения текста на слова/пробелы/пунктуацию.
// Регулярка покрывает латиницу с диакритикой (À-ɏ) и кириллицу (Ѐ-ӿ),
// а также апостроф внутри слова (don't, l'eau).

export type WordToken =
  | { kind: 'word'; text: string }
  | { kind: 'space'; text: string }
  | { kind: 'punct'; text: string };

const TOKEN_RE = /([A-Za-zÀ-ɏЀ-ӿ']+)|(\s+)|([^A-Za-zÀ-ɏЀ-ӿ'\s]+)/g;

export function splitWords(input: string): WordToken[] {
  const result: WordToken[] = [];
  if (!input) return result;
  TOKEN_RE.lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = TOKEN_RE.exec(input)) !== null) {
    if (m[1] !== undefined) result.push({ kind: 'word', text: m[1] });
    else if (m[2] !== undefined) result.push({ kind: 'space', text: m[2] });
    else if (m[3] !== undefined) result.push({ kind: 'punct', text: m[3] });
  }
  return result;
}
