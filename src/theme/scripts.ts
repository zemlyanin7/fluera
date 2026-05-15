import { scriptTypography } from './tokens';

export type ScriptId = keyof typeof scriptTypography;

const langToScript: Record<string, ScriptId> = {
  en: 'latin', es: 'latin', fr: 'latin', de: 'latin',
  it: 'latin', pt: 'latin', pl: 'latin',
  ru: 'cyrillic', uk: 'cyrillic', be: 'cyrillic', sr: 'cyrillic',
  ja: 'cjk_jp', ko: 'cjk_kr',
  // I9: zh пока маппим в cjk_jp как workaround (нет cjk_zh-варианта со
  // шрифтами NotoSerifSC). После добавления полноценного cjk_zh в
  // scriptTypography поменять здесь и добавить шрифты в config plugin.
  zh: 'cjk_jp',
  ar: 'arabic', fa: 'arabic', ur: 'arabic',
  hi: 'devanagari', mr: 'devanagari', sa: 'devanagari',
};

export function scriptForLang(lang: string): ScriptId {
  return langToScript[lang] ?? 'latin';
}
