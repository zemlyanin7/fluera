import { useCallback, useEffect, useRef, useState } from 'react'
import {
  chapterExists,
  loadChapter,
  loadFootnotes,
  resolveImagePaths,
  saveChapters,
} from '../services/converter/chapterStorage'
import type { BookChapter, BookFootnotes, ContentItem, InlineNode } from '../services/parser/types'
import { extractInlineText } from '../components/reader/UnifiedRenderer'

/** Колбэк для on-the-fly конвертации ещё не сконвертированных глав */
export type ConvertChapterFn = (chapterIndex: number) => Promise<BookChapter>

/** Диапазон одной главы в объединённом массиве items */
export interface ChapterRange {
  chapter: number
  startIndex: number  // индекс в объединённом массиве items
  endIndex: number    // не включительно
  charOffset: number  // общее число символов до этой главы
}

export interface UseChapterLoaderResult {
  items: ContentItem[]
  chapterRanges: ChapterRange[]
  loading: boolean
  footnotes: BookFootnotes
  currentChapter: number
  totalChapters: number
  loadChapterByIndex: (index: number) => Promise<void>
}

/** Подсчитывает символы в массиве InlineNode */
function countInlineChars(nodes: InlineNode[]): number {
  return nodes.reduce((sum, node) => {
    if (node.type === 'text') return sum + node.text.length
    if (node.type === 'footnote-ref') return sum + node.label.length
    if ('children' in node) return sum + countInlineChars(node.children)
    return sum
  }, 0)
}

/** Подсчитывает символы в одном ContentItem */
function countItemChars(item: ContentItem): number {
  switch (item.type) {
    case 'heading':
      return extractInlineText(item.inlines).length
    case 'paragraph':
      return extractInlineText(item.inlines).length
    case 'blockquote': {
      const inlineLen = countInlineChars(item.inlines)
      const nestedLen = (item.nestedItems ?? []).reduce((s, i) => s + countItemChars(i), 0)
      return inlineLen + nestedLen
    }
    case 'list':
      return item.items.reduce((s, inlines) => s + countInlineChars(inlines), 0)
    case 'table-row':
      return item.cells.reduce((s, inlines) => s + countInlineChars(inlines), 0)
    case 'image':
      return (item.alt ?? '').length
    case 'separator':
      return 0
  }
}

/**
 * Хук для ленивой загрузки глав книги.
 *
 * @param bookId — ID книги
 * @param initialChapter — начальная глава (с которой открывается читалка)
 * @param totalChapters — общее число глав
 * @param convertChapter — колбэк для on-the-fly конвертации, когда JSON главы ещё не существует.
 *   Вызывается из UnifiedReader, который знает формат и путь к исходному файлу книги.
 */
export function useChapterLoader(
  bookId: string,
  initialChapter: number,
  totalChapters: number,
  convertChapter?: ConvertChapterFn,
): UseChapterLoaderResult {
  // Кэш загруженных глав: номер главы → данные главы
  const loadedChapters = useRef<Map<number, BookChapter>>(new Map())

  const [items, setItems] = useState<ContentItem[]>([])
  const [chapterRanges, setChapterRanges] = useState<ChapterRange[]>([])
  const [loading, setLoading] = useState(true)
  const [footnotes, setFootnotes] = useState<BookFootnotes>({})
  const [currentChapter, setCurrentChapter] = useState(initialChapter)

  /**
   * Пересобирает items[] и chapterRanges[] из кэша loadedChapters.
   * Главы сортируются по индексу, для каждой вызывается resolveImagePaths().
   */
  const rebuildItems = useCallback(() => {
    // Сортируем загруженные главы по номеру
    const sorted = Array.from(loadedChapters.current.entries())
      .sort(([a], [b]) => a - b)
      .map(([, chapter]) => resolveImagePaths(chapter, bookId))

    const newItems: ContentItem[] = []
    const newRanges: ChapterRange[] = []
    let charOffset = 0

    for (const chapter of sorted) {
      const startIndex = newItems.length
      newItems.push(...chapter.items)
      const endIndex = newItems.length

      // Считаем символы всех items этой главы для charOffset следующей
      const chapterChars = chapter.items.reduce((s, item) => s + countItemChars(item), 0)

      newRanges.push({
        chapter: chapter.index,
        startIndex,
        endIndex,
        charOffset,
      })

      charOffset += chapterChars
    }

    setItems(newItems)
    setChapterRanges(newRanges)
  }, [bookId])

  /**
   * Загружает главу по индексу.
   * Сначала пытается загрузить из JSON-файла. Если файл не существует и передан
   * convertChapter — вызывает его, сохраняет результат, затем пересобирает items.
   */
  const loadChapterByIndex = useCallback(async (index: number) => {
    // Уже загружена — ничего не делаем
    if (loadedChapters.current.has(index)) return

    // Индекс вне диапазона
    if (index < 0 || index >= totalChapters) return

    try {
      const exists = await chapterExists(bookId, index)

      if (exists) {
        // Загрузка из сохранённого JSON
        const chapter = await loadChapter(bookId, index)
        loadedChapters.current.set(index, chapter)
        rebuildItems()
      } else if (convertChapter) {
        // On-the-fly конвертация главы (JSON ещё не был создан)
        const chapter = await convertChapter(index)
        await saveChapters(bookId, [chapter])
        loadedChapters.current.set(index, chapter)
        rebuildItems()
      }
      // Если JSON нет и convertChapter не передан — ничего не делаем (глава недоступна)
    } catch (error) {
      // Ошибка загрузки главы — логируем, но не крашим приложение
      console.error(`[useChapterLoader] Ошибка загрузки главы ${index} книги ${bookId}:`, error)
    }
  }, [bookId, totalChapters, convertChapter, rebuildItems])

  /**
   * При монтировании: загружаем начальную главу, соседние главы (±1) и сноски.
   */
  useEffect(() => {
    let cancelled = false

    async function init() {
      setLoading(true)
      try {
        // Параллельно загружаем сноски и начальную главу
        const [loadedFootnotes] = await Promise.all([
          loadFootnotes(bookId),
          loadChapterByIndex(initialChapter),
        ])

        if (cancelled) return
        setFootnotes(loadedFootnotes)
        setCurrentChapter(initialChapter)

        // Загружаем соседние главы (не ждём завершения)
        void loadChapterByIndex(initialChapter - 1)
        void loadChapterByIndex(initialChapter + 1)
      } catch (error) {
        console.error('[useChapterLoader] Ошибка инициализации:', error)
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    void init()

    return () => {
      cancelled = true
    }
    // Зависимости намеренно минимальны: эффект запускается один раз при монтировании
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bookId, initialChapter])

  return {
    items,
    chapterRanges,
    loading,
    footnotes,
    currentChapter,
    totalChapters,
    loadChapterByIndex,
  }
}
