import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'
import AsyncStorage from '@react-native-async-storage/async-storage'
import type { ReaderTheme } from '../utils/types'

interface SettingsState {
  nativeLanguage: string
  bookLanguage: string
  readerTheme: ReaderTheme
  fontSize: number
  fontFamily: string
  lineHeight: number
  showWordColors: boolean

  setNativeLanguage: (lang: string) => void
  setBookLanguage: (lang: string) => void
  setReaderTheme: (theme: ReaderTheme) => void
  setFontSize: (size: number) => void
  setShowWordColors: (show: boolean) => void
}

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({
      nativeLanguage: 'ru',
      bookLanguage: 'en',
      readerTheme: 'dark',
      fontSize: 18,
      fontFamily: 'Georgia',
      lineHeight: 1.8,
      showWordColors: true,

      setNativeLanguage: (lang) => set({ nativeLanguage: lang }),
      setBookLanguage: (lang) => set({ bookLanguage: lang }),
      setReaderTheme: (theme) => set({ readerTheme: theme }),
      setFontSize: (size) => set({ fontSize: size }),
      setShowWordColors: (show) => set({ showWordColors: show }),
    }),
    {
      name: 'fluera-settings',
      storage: createJSONStorage(() => AsyncStorage),
    },
  ),
)
