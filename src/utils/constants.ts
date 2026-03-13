export const OPDS_PRESETS = [
  {
    name: 'Project Gutenberg',
    url: 'https://www.gutenberg.org/ebooks/search/?format=opds',
  },
  {
    name: 'Standard Ebooks',
    url: 'https://standardebooks.org/feeds/opds',
  },
] as const

export const WORD_STATUS = {
  NEW: 1,
  RECOGNIZED: 2,
  FAMILIAR: 3,
  LEARNED: 4,
  KNOWN: 5,
} as const

export const WORD_STATUS_COLORS = {
  [WORD_STATUS.NEW]: '#4a90d9',
  [WORD_STATUS.RECOGNIZED]: 'rgba(245, 200, 66, 1)',
  [WORD_STATUS.FAMILIAR]: 'rgba(245, 200, 66, 0.7)',
  [WORD_STATUS.LEARNED]: 'rgba(245, 200, 66, 0.4)',
  [WORD_STATUS.KNOWN]: 'transparent',
} as const

export const SUPPORTED_BOOK_LANGUAGES = ['en'] as const
export const SUPPORTED_UI_LANGUAGES = ['en', 'ru', 'pl', 'uk'] as const
export const SUPPORTED_FORMATS = ['epub', 'fb2'] as const

export const TRANSLATION_CACHE_MAX = 100_000
export const TEXT_DIFFICULTY_SAMPLE_RATIO = 0.1
