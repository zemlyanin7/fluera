// Простой whitespace tokenizer + lowercase + strip punctuation.
// Используется MWE trie + slot matcher. НЕ Intl.Segmenter (Hermes SDK 54 не поддерживает).
export function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[!?.,;:"()«»\[\]]/g, '')
    .split(/\s+/)
    .filter((t) => t.length > 0);
}
