// Human-readable labels для всех 13 MVP languages. Used в prompt templates
// ("English translation of ..."). Подстановка в PromptBuilder.
import type { BookLanguage } from '@/types/settings';

export const LANG_LABELS: Record<BookLanguage, string> = {
  en: 'English',
  ru: 'Russian',
  pl: 'Polish',
  uk: 'Ukrainian',
  es: 'Spanish',
  fr: 'French',
  de: 'German',
  it: 'Italian',
  pt: 'Portuguese',
  ja: 'Japanese',
  ko: 'Korean',
  ar: 'Arabic',
  hi: 'Hindi',
};

export function langLabel(code: BookLanguage): string {
  const label = LANG_LABELS[code];
  if (!label) throw new Error(`Unsupported language: ${code}`);
  return label;
}
