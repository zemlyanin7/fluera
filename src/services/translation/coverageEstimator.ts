export interface CoverageInput {
  pageWords: string[];
  knownLemmas: Set<string>;
}

/**
 * Оценивает долю слов на странице, которые пользователь знает.
 * Возвращает 0..1: 1.0 = все слова знакомы, 0 = ни одного.
 */
export function estimatePageCoverage(input: CoverageInput): number {
  if (input.pageWords.length === 0) return 0;
  let known = 0;
  for (const w of input.pageWords) {
    if (input.knownLemmas.has(w.toLowerCase())) known++;
  }
  return known / input.pageWords.length;
}
