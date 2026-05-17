import { create } from 'zustand';
import { subscribeWithSelector } from 'zustand/middleware';
import i18n from '@/i18n';
import { applyTheme } from '@/theme/applyTheme';
import {
  DEFAULT_SETTINGS, SettingsState, NativeLanguage, BookLanguage, UILanguage,
  ThemeId, FontFamilyMode, ScrollMode, ProficiencyLevel,
  TapToTranslateBehavior, AutoAddToDeck,
} from '@/types/settings';

// I5: store → i18n зависимость документирована.
// Пользователь меняет UI-язык → i18n.changeLanguage синхронизирует
// react-i18next, иначе строки остаются на предыдущем языке.
// Это однонаправленная зависимость (store knows about i18n); i18n НЕ знает
// о store. См. I6: первоначальная инициализация i18n идёт от device locale.

interface SettingsActions {
  setUiLanguage: (v: UILanguage) => void;
  setNativeLanguage: (v: NativeLanguage) => void;
  setBookLanguage: (v: BookLanguage) => void;
  setTheme: (id: ThemeId, auto?: boolean) => void;
  setFontFamilyMode: (v: FontFamilyMode) => void;
  setFontSize: (v: number) => void;
  setScrollMode: (v: ScrollMode) => void;
  toggleHighlightUnknown: () => void;
  toggleShowSentenceTranslation: () => void;
  togglePageFlipAnim: () => void;
  setBookLanguageLevel: (v: ProficiencyLevel) => void;
  setTapToTranslateBehavior: (v: TapToTranslateBehavior) => void;
  setAutoAddToDeck: (v: AutoAddToDeck) => void;
  toggleShowPhonetics: () => void;
  toggleLookupHistoryEnabled: () => void;
  setReadingSessionGoalMinutes: (v: number) => void;
  completeOnboarding: () => void;
  reset: () => void;
}

export type SettingsStore = SettingsState & SettingsActions;
const clamp = (v: number, min: number, max: number) => Math.max(min, Math.min(max, v));

export const useSettingsStore = create<SettingsStore>()(
  subscribeWithSelector((set) => ({
    ...DEFAULT_SETTINGS,
    setUiLanguage: (v) => {
      set({ uiLanguage: v });
      void i18n.changeLanguage(v);
    },
    setNativeLanguage: (v) => set({ nativeLanguage: v }),
    setBookLanguage: (v) => set({ bookLanguage: v }),
    setTheme: (id, auto = false) => {
      // Сначала обновляем UnistylesRuntime — set() ниже notify подписчиков
      // синхронно, и к моменту re-render PhoneShell тема уже актуальна.
      // Иначе useUnistyles читал бы старый theme.paper.
      applyTheme(id, auto);
      set({ themeId: id, themeAuto: auto });
    },
    setFontFamilyMode: (v) => set({ fontFamilyMode: v }),
    setFontSize: (v) => set({ fontSize: clamp(v, 15, 26) }),
    setScrollMode: (v) => set({ scrollMode: v }),
    toggleHighlightUnknown: () => set((s) => ({ highlightUnknown: !s.highlightUnknown })),
    toggleShowSentenceTranslation: () => set((s) => ({ showSentenceTranslation: !s.showSentenceTranslation })),
    togglePageFlipAnim: () => set((s) => ({ pageFlipAnim: !s.pageFlipAnim })),
    setBookLanguageLevel: (v) => set({ bookLanguageLevel: v }),
    setTapToTranslateBehavior: (v) => set({ tapToTranslateBehavior: v }),
    setAutoAddToDeck: (v) => set({ autoAddToDeck: v }),
    toggleShowPhonetics: () => set((s) => ({ showPhonetics: !s.showPhonetics })),
    toggleLookupHistoryEnabled: () => set((s) => ({ lookupHistoryEnabled: !s.lookupHistoryEnabled })),
    setReadingSessionGoalMinutes: (v) => set({ readingSessionGoalMinutes: clamp(v, 5, 120) }),
    completeOnboarding: () => set({ onboardingCompleted: true }),
    reset: () => set(DEFAULT_SETTINGS),
  })),
);
