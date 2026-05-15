import { scriptTypography } from './tokens';

export type ScriptId = keyof typeof scriptTypography;

const langToScript: Record<string, ScriptId> = {
  en: 'latin', es: 'latin', fr: 'latin', de: 'latin',
  it: 'latin', pt: 'latin', pl: 'latin',
  ru: 'cyrillic', uk: 'cyrillic', be: 'cyrillic', sr: 'cyrillic',
  ja: 'cjk_jp', ko: 'cjk_kr',
  ar: 'arabic', fa: 'arabic', ur: 'arabic',
  hi: 'devanagari', mr: 'devanagari', sa: 'devanagari',
};

export function scriptForLang(lang: string): ScriptId {
  return langToScript[lang] ?? 'latin';
}
