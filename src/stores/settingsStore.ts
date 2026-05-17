import { create } from 'zustand';
import { persist, createJSONStorage, subscribeWithSelector } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import i18n from '@/i18n';
import { applyTheme, applyThemeImmediate } from '@/theme/applyTheme';
import {
  DEFAULT_SETTINGS, SettingsState, NativeLanguage, BookLanguage, UILanguage,
  ThemeId, FontFamilyMode, ScrollMode, ProficiencyLevel,
  TapToTranslateBehavior, AutoAddToDeck, PopupHintsSeen,
  SentenceTranslationGesture, ReadingMode,
} from '@/types/settings';

/**
 * AsyncStorage persist allowlist — ТОЛЬКО non-credential preferences.
 * НИКАКИХ tokens/secrets/auth-данных здесь не должно быть. Креды → SecureStore.
 * См. CLAUDE.md и §6.3 спеки.
 */
const ALLOWLIST = [
  // UI preferences
  'themeId', 'themeAuto', 'fontFamilyMode', 'fontSize', 'scrollMode',
  'highlightUnknown', 'showSentenceTranslation', 'pageFlipAnim',
  'showPhonetics', 'lookupHistoryEnabled',
  // Language pair
  'uiLanguage', 'nativeLanguage', 'bookLanguage',
  // Pedagogy
  'bookLanguageLevel', 'tapToTranslateBehavior', 'autoAddToDeck',
  'readingSessionGoalMinutes',
  // Onboarding state
  'onboardingCompleted',
  // Coach mark hints
  'popupHintsSeen',
  // Translation popup flags
  'showRegisterTags', 'sentenceTranslationGesture', 'mweAutoExpand',
  'falseFriendsEnabled', 'readingMode',
] as const satisfies readonly (keyof SettingsState)[];

type PersistedKeys = (typeof ALLOWLIST)[number];
type PersistedSettings = Pick<SettingsState, PersistedKeys>;

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
  markPopupHintSeen: (key: keyof PopupHintsSeen) => void;
  resetPopupHints: () => void;
  setSentenceTranslation: (v: boolean) => void;
  setRegisterTags: (v: boolean) => void;
  setSentenceGesture: (v: SentenceTranslationGesture) => void;
  setMweAutoExpand: (v: boolean) => void;
  setFalseFriendsEnabled: (v: boolean) => void;
  setReadingMode: (v: ReadingMode) => void;
  reset: () => void;
}

export type SettingsStore = SettingsState & SettingsActions;
const clamp = (v: number, min: number, max: number) => Math.max(min, Math.min(max, v));

export const useSettingsStore = create<SettingsStore>()(
  persist(
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
      markPopupHintSeen: (key) =>
        set((s) => ({ popupHintsSeen: { ...s.popupHintsSeen, [key]: true } })),
      resetPopupHints: () =>
        set({ popupHintsSeen: { longPressForSentence: false } }),
      setSentenceTranslation: (v) => set({ showSentenceTranslation: v }),
      setRegisterTags: (v) => set({ showRegisterTags: v }),
      setSentenceGesture: (v) => set({ sentenceTranslationGesture: v }),
      setMweAutoExpand: (v) => set({ mweAutoExpand: v }),
      setFalseFriendsEnabled: (v) => set({ falseFriendsEnabled: v }),
      setReadingMode: (v) => set({ readingMode: v }),
      reset: () => set(DEFAULT_SETTINGS),
    })),
    {
      name: 'fluera-settings-v1',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (s) =>
        ALLOWLIST.reduce<Partial<PersistedSettings>>(
          (acc, k) => ({ ...acc, [k]: s[k] }),
          {},
        ) as PersistedSettings,
      // v2: bumped с 1 для force-применения новых defaults (uiLanguage='ru')
      // + #4.5 popup-флаги (sentenceTranslationGesture, mweAutoExpand, etc).
      // Старый persist state сбрасывается к DEFAULT_SETTINGS.
      version: 2,
      migrate: (_persisted: any, _from: number) => {
        // Простая migration: при любой смене версии — сбрасываем к defaults.
        // Юзеры в v1 ещё в beta-кодстейте, потери persisted preferences
        // допустимы. В prod после v1 release миграции должны быть soft.
        return undefined; // undefined → Zustand fresh-инициализирует от DEFAULT_SETTINGS.
      },
      onRehydrateStorage: () => (state) => {
        // Cold-start theme apply: используем applyThemeImmediate (без rAF),
        // т.к. React tree ещё не отрисован и race из #1179 не возникает.
        // Это устраняет theme flash при кэшированной dark/sepia теме.
        if (state) {
          applyThemeImmediate(state.themeId, state.themeAuto);
          // i18n также подтягиваем из persist (UI-язык переживает restart).
          void i18n.changeLanguage(state.uiLanguage);
        }
      },
    },
  ),
);
