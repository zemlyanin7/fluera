// Fail-safe эвристика для поиска позиции слова в переведённом предложении.
// Используется когда у нас есть и sentence translation, и word translation:
// ищем word translation в sentence translation → возвращаем char offset.
// Если не найдено — undefined (UI fallback: показать весь sentence без highlight).
export interface TryAlignWordInput {
  sourceSentence: string;
  wordOffset: number;
  sourceWord: string;
  translatedSentence: string;
  knownWordTranslation: string | undefined;
}

/**
 * Ищет `knownWordTranslation` в `translatedSentence` и возвращает char offset
 * первого вхождения (case-insensitive). Returns undefined если не найдено
 * или если knownWordTranslation не задан.
 */
export function tryAlignWord(input: TryAlignWordInput): number | undefined {
  if (!input.knownWordTranslation) return undefined;
  const needle = input.knownWordTranslation.toLowerCase().trim();
  if (!needle) return undefined;
  const haystack = input.translatedSentence.toLowerCase();
  const idx = haystack.indexOf(needle);
  return idx >= 0 ? idx : undefined;
}
