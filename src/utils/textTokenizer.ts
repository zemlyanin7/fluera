// Утилиты для токенизации текста — используются в UnifiedRenderer (и ранее в Fb2Renderer)

// ─── Тип токена ─────────────────────────────────────────────────────────────

export interface WordToken {
  /** Само слово без окружающих пробелов */
  word: string;
  /** Пробельные символы, следующие за словом */
  trailing: string;
}

// ─── Функции ─────────────────────────────────────────────────────────────────

/**
 * Разбивает текст на токены-слова, сохраняя информацию о завершающих пробелах.
 * Каждый токен содержит само слово и пробелы, идущие после него.
 */
export function tokenizeIntoWords(text: string): WordToken[] {
  if (!text) return [];

  // Разбиваем по границам пробелов, захватывая разделители
  const parts = text.split(/(\s+)/);
  const tokens: WordToken[] = [];

  for (let i = 0; i < parts.length; i++) {
    const part = parts[i];
    if (!part) continue;

    // Нечётные части из split с захватом — это пробельные разделители
    const isWhitespace = /^\s+$/.test(part);
    if (isWhitespace) continue;

    const nextPart = parts[i + 1];
    const trailing = nextPart && /^\s+$/.test(nextPart) ? nextPart : '';

    tokens.push({ word: part, trailing });
  }

  return tokens;
}

/**
 * Находит и возвращает предложение, содержащее указанное слово.
 * Границами предложений служат `.`, `!`, `?` или символы новой строки.
 * Возвращает полный текст, если граница не найдена.
 */
export function extractSentence(fullText: string, word: string): string {
  const wordIndex = fullText.indexOf(word);
  if (wordIndex === -1) return fullText;

  // Разбиваем на предложения по граничным символам
  const sentencePattern = /[^.!?\n]+[.!?\n]*/g;
  let match: RegExpExecArray | null;

  while ((match = sentencePattern.exec(fullText)) !== null) {
    const start = match.index;
    const end = start + match[0].length;
    if (wordIndex >= start && wordIndex < end) {
      return match[0].trim();
    }
  }

  return fullText;
}
