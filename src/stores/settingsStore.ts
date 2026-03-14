// src/stores/settingsStore.ts

import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'
import AsyncStorage from '@react-native-async-storage/async-storage'

interface SettingsState {
  // Language
  nativeLanguage: string
  bookLanguage: string

  // Reader themes (replaces old readerTheme field)
  lightThemeId: string
  darkThemeId: string
  autoTheme: boolean
  manualThemeId: string

  // Reader display
  scrollMode: 'paginated' | 'scroll'
  fontSize: number
  fontFamily: string
  lineHeight: number
  showWordColors: boolean

  // Actions
  setNativeLanguage: (lang: string) => void
  setBookLanguage: (lang: string) => void
  setLightThemeId: (id: string) => void
  setDarkThemeId: (id: string) => void
  setAutoTheme: (auto: boolean) => void
  setManualThemeId: (id: string) => void
  setScrollMode: (mode: 'paginated' | 'scroll') => void
  setFontSize: (size: number) => void
  setFontFamily: (fontFamily: string) => void
  setLineHeight: (lineHeight: number) => void
  setShowWordColors: (show: boolean) => void
}

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({
      nativeLanguage: 'ru',
      bookLanguage: 'en',

      lightThemeId: 'white',
      darkThemeId: 'dark',
      autoTheme: true,
      manualThemeId: 'white',

      scrollMode: 'paginated',
      fontSize: 18,
      fontFamily: 'Georgia',
      lineHeight: 1.8,
      showWordColors: true,

      setNativeLanguage: (lang) => set({ nativeLanguage: lang }),
      setBookLanguage: (lang) => set({ bookLanguage: lang }),
      setLightThemeId: (id) => set({ lightThemeId: id }),
      setDarkThemeId: (id) => set({ darkThemeId: id }),
      setAutoTheme: (auto) => set({ autoTheme: auto }),
      setManualThemeId: (id) => set({ manualThemeId: id }),
      setScrollMode: (mode) => set({ scrollMode: mode }),
      setFontSize: (size) => set({ fontSize: size }),
      setFontFamily: (fontFamily) => set({ fontFamily }),
      setLineHeight: (lineHeight) => set({ lineHeight }),
      setShowWordColors: (show) => set({ showWordColors: show }),
    }),
    {
      name: 'fluera-settings',
      storage: createJSONStorage(() => AsyncStorage),
      version: 1,
      migrate: (persistedState: unknown, version: number) => {
        const state = persistedState as Record<string, unknown>

        if (version === 0 || version === undefined) {
          // Migrate from old readerTheme: 'light' | 'dark' | 'sepia'
          const oldTheme = state.readerTheme as string | undefined

          if (oldTheme === 'sepia') {
            state.lightThemeId = 'sepia'
            state.darkThemeId = 'dark'
            state.autoTheme = false
            state.manualThemeId = 'sepia'
          } else {
            state.lightThemeId = 'white'
            state.darkThemeId = 'dark'
            state.autoTheme = true
            state.manualThemeId = 'white'
          }

          // Set new defaults for fields that didn't exist
          if (state.scrollMode === undefined) {
            state.scrollMode = 'paginated'
          }

          // Remove old field
          delete state.readerTheme
        }

        return state as unknown as SettingsState
      },
    },
  ),
)
