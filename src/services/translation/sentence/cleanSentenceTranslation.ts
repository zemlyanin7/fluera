// Post-processing для sentence-level перевода. Убирает leading/trailing
// whitespace и распространённые артефакты вроде "Translation:" / "Перевод:"
// которые некоторые модели добавляют перед ответом несмотря на системный промпт.
const PREFIX_RE =
  /^(translation|перевод|traducción|traduction|übersetzung|traduzione|tradução|翻訳|번역|الترجمة|अनुवाद)\s*[:：]\s*/i;

export function cleanSentenceTranslation(raw: string): string {
  let s = raw.trim();
  s = s.replace(PREFIX_RE, '');
  return s.trim();
}
