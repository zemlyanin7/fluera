/**
 * Эвристические признаки синтаксической сложности предложения.
 * Используется для определения нужности подсказки "это сложное предложение".
 * Поддерживает: en, ru, de, fr, es (остальные — по умолчанию false).
 */

const SUBORDINATE_MARKERS: Record<string, RegExp> = {
  en: /\b(that|which|who|when|if|because|although|while)\b/i,
  ru: /\b(который|которая|которое|которые|что|если|когда|потому что|хотя)\b/i,
  de: /\b(dass|wenn|weil|obwohl|während)\b/i,
  fr: /\b(que|qui|si|parce que|bien que)\b/i,
  es: /\b(que|si|porque|aunque|cuando|mientras)\b/i,
};

const PASSIVE_PATTERNS: Record<string, RegExp> = {
  // Покрывает правильные причастия (-ed) и неправильные (-en, -n, -wn, -t)
  en: /\b(was|were|been|being|is|are|am)\s+\w+(?:ed|en|wn|own|orn|awn|tten|lt|nt|pt|ght)\b/i,
  ru: /\b(был|была|было|были|есть|являлся|являлась)\s+\w+\b/i,
};

/**
 * Возвращает true если предложение является синтаксически сложным
 * по одному из трёх критериев:
 * 1. 3+ клаузы (>2 запятых/точек с запятой)
 * 2. Наличие подчинительного союза/относительного местоимения
 * 3. Пассивная конструкция
 */
export function isSentenceComplex(sentence: string, lang: string): boolean {
  const clauses = (sentence.match(/[,;]/g) ?? []).length + 1;
  if (clauses > 2) return true;

  const subMarker = SUBORDINATE_MARKERS[lang];
  if (subMarker && subMarker.test(sentence)) return true;

  const passive = PASSIVE_PATTERNS[lang];
  if (passive && passive.test(sentence)) return true;

  return false;
}
