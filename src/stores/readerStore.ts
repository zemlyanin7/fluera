import { create } from 'zustand'

interface ReaderState {
  currentBookId: string | null
  currentChapter: number
  scrollPosition: number
  isTranslationOpen: boolean
  selectedWord: string | null
  selectedPhrase: string | null
  selectedSentence: string | null

  openBook: (bookId: string) => void
  closeBook: () => void
  setChapter: (chapter: number) => void
  setScrollPosition: (position: number) => void
  selectWord: (word: string, sentence: string) => void
  selectPhrase: (phrase: string, sentence: string) => void
  clearSelection: () => void
}

export const useReaderStore = create<ReaderState>((set) => ({
  currentBookId: null,
  currentChapter: 0,
  scrollPosition: 0,
  isTranslationOpen: false,
  selectedWord: null,
  selectedPhrase: null,
  selectedSentence: null,

  openBook: (bookId) =>
    set({ currentBookId: bookId, currentChapter: 0, scrollPosition: 0 }),
  closeBook: () =>
    set({
      currentBookId: null,
      selectedWord: null,
      selectedPhrase: null,
      isTranslationOpen: false,
    }),
  setChapter: (chapter) => set({ currentChapter: chapter }),
  setScrollPosition: (position) => set({ scrollPosition: position }),
  selectWord: (word, sentence) =>
    set({
      selectedWord: word,
      selectedPhrase: null,
      selectedSentence: sentence,
      isTranslationOpen: true,
    }),
  selectPhrase: (phrase, sentence) =>
    set({
      selectedWord: null,
      selectedPhrase: phrase,
      selectedSentence: sentence,
      isTranslationOpen: true,
    }),
  clearSelection: () =>
    set({
      selectedWord: null,
      selectedPhrase: null,
      selectedSentence: null,
      isTranslationOpen: false,
    }),
}))
