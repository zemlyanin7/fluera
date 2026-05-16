// Post-process raw inference text:
// 1. Берём первую строку (модель часто продолжает много вариантов).
// 2. Strip leading/trailing quotes/punctuation.
// 3. Collapse internal whitespace.
// 4. Cap length at 200 chars.
const LEADING_TRAILING = /^["'«»""''""""""``::,.\s【】「」]+|["'«»""''""""""``::,.\s【】「」]+$/g;

export function cleanTranslation(raw: string): string {
  const firstLine = raw.split('\n')[0] ?? '';
  const stripped = firstLine
    .replace(LEADING_TRAILING, '')
    .replace(/\s+/g, ' ')
    .trim();
  return stripped.slice(0, 200);
}
