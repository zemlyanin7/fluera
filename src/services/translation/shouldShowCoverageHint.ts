export interface CoverageHintInput {
  pageCoverage: number;
  sentenceComplex: boolean;
}

/**
 * Порог покрытия страницы ниже которого показывается подсказка.
 * < 0.9 = пользователь не знает 10%+ слов на странице.
 */
export const COVERAGE_HINT_THRESHOLD = 0.9;

/**
 * Возвращает true если стоит показать подсказку "сложное предложение /
 * много незнакомых слов" рядом с переводом.
 * Обе условия должны быть истинными: низкое покрытие И сложная грамматика.
 */
export function shouldShowCoverageHint(input: CoverageHintInput): boolean {
  return input.pageCoverage < COVERAGE_HINT_THRESHOLD && input.sentenceComplex;
}
