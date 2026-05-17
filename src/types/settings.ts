// M5: типы языков — это constrained string union'ы из supported-set,
// НЕ branded types в строгом смысле (nominal-типизация через intersection
// с __brand-полем не используется). Если в будущем потребуется усиление
// типобезопасности, можно добавить asNativeLanguage(v: string): NativeLanguage
// + brand. Сейчас union достаточен — компилятор ловит литералы вне набора.
export type ThemeId = 'light' | 'sepia' | 'dark';
export type FontFamilyMode = 'serif' | 'sans';
export type ScrollMode = 'page' | 'scroll';
export type ProficiencyLevel = 'A1' | 'A2' | 'B1' | 'B2' | 'C1' | 'C2' | 'auto';
export type TapToTranslateBehavior = 'instant' | 'delay' | 'long-press';
export type AutoAddToDeck = 'always' | 'never' | 'ask';

// Полная симметрия 3 наборов языков: UI = Native = Book = 13 значений.
// Пользователь может выбрать любую языковую пару из 13×13 = 169 комбинаций.
// Локальная LLM #4 должна покрывать все пары.
export const SUPPORTED_NATIVE_LANGUAGES = [
  'en','ru','pl','uk','es','fr','de','it','pt','ja','ko','ar','hi',
] as const;
export type NativeLanguage = (typeof SUPPORTED_NATIVE_LANGUAGES)[number];
export const SUPPORTED_BOOK_LANGUAGES = [
  'en','ru','pl','uk','es','fr','de','it','pt','ja','ko','ar','hi',
] as const;
export type BookLanguage = (typeof SUPPORTED_BOOK_LANGUAGES)[number];
export const SUPPORTED_UI_LANGUAGES = [
  'en','ru','pl','uk','es','fr','de','it','pt','ja','ko','ar','hi',
] as const;
export type UILanguage = (typeof SUPPORTED_UI_LANGUAGES)[number];

export interface PopupHintsSeen {
  longPressForSentence: boolean;
}

export interface SettingsState {
  uiLanguage: UILanguage;
  nativeLanguage: NativeLanguage;
  bookLanguage: BookLanguage;
  themeId: ThemeId;
  themeAuto: boolean;
  fontFamilyMode: FontFamilyMode;
  fontSize: number;
  scrollMode: ScrollMode;
  highlightUnknown: boolean;
  showSentenceTranslation: boolean;
  pageFlipAnim: boolean;
  bookLanguageLevel: ProficiencyLevel;
  tapToTranslateBehavior: TapToTranslateBehavior;
  autoAddToDeck: AutoAddToDeck;
  showPhonetics: boolean;
  lookupHistoryEnabled: boolean;
  readingSessionGoalMinutes: number;
  onboardingCompleted: boolean;
  popupHintsSeen: PopupHintsSeen;
}

export const DEFAULT_SETTINGS: SettingsState = {
  uiLanguage: 'en', nativeLanguage: 'ru', bookLanguage: 'en',
  themeId: 'light', themeAuto: false,
  fontFamilyMode: 'serif', fontSize: 19, scrollMode: 'scroll',
  highlightUnknown: false, showSentenceTranslation: false, pageFlipAnim: true,
  bookLanguageLevel: 'auto', tapToTranslateBehavior: 'instant',
  autoAddToDeck: 'ask', showPhonetics: false,
  lookupHistoryEnabled: true, readingSessionGoalMinutes: 15,
  onboardingCompleted: false,
  popupHintsSeen: { longPressForSentence: false },
};
