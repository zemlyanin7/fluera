import * as FileSystem from 'expo-file-system/legacy'
import type { BookChapter, BookFootnotes, ContentItem } from '../parser/types'

const BOOKS_DIR = `${FileSystem.documentDirectory}books/`

/** Путь к директории глав книги */
function chaptersDir(bookId: string): string {
  return `${BOOKS_DIR}${bookId}/chapters/`
}

/** Путь к файлу конкретной главы */
function chapterPath(bookId: string, index: number): string {
  return `${chaptersDir(bookId)}${index}.json`
}

/** Путь к файлу сносок книги */
function footnotesPath(bookId: string): string {
  return `${BOOKS_DIR}${bookId}/footnotes.json`
}

/** Путь к директории изображений книги */
export function imagesDir(bookId: string): string {
  return `${BOOKS_DIR}${bookId}/images/`
}

/** Путь к исходному файлу книги */
export function sourcePath(bookId: string, ext: string): string {
  return `${BOOKS_DIR}${bookId}/source${ext}`
}

/** Создать директории для книги (chapters/ + images/) */
export async function ensureBookDirs(bookId: string): Promise<void> {
  await FileSystem.makeDirectoryAsync(chaptersDir(bookId), { intermediates: true })
  await FileSystem.makeDirectoryAsync(imagesDir(bookId), { intermediates: true })
}

/** Сохранить массив глав на диск */
export async function saveChapters(bookId: string, chapters: BookChapter[]): Promise<void> {
  for (const chapter of chapters) {
    await FileSystem.writeAsStringAsync(
      chapterPath(bookId, chapter.index),
      JSON.stringify(chapter),
    )
  }
}

/** Загрузить одну главу из JSON */
export async function loadChapter(bookId: string, index: number): Promise<BookChapter> {
  const path = chapterPath(bookId, index)
  const json = await FileSystem.readAsStringAsync(path)
  return JSON.parse(json) as BookChapter
}

/** Проверить, существует ли файл главы */
export async function chapterExists(bookId: string, index: number): Promise<boolean> {
  const info = await FileSystem.getInfoAsync(chapterPath(bookId, index))
  return info.exists
}

/** Сохранить сноски на диск */
export async function saveFootnotes(bookId: string, footnotes: BookFootnotes): Promise<void> {
  if (Object.keys(footnotes).length === 0) return
  await FileSystem.writeAsStringAsync(
    footnotesPath(bookId),
    JSON.stringify(footnotes),
  )
}

/** Загрузить сноски книги */
export async function loadFootnotes(bookId: string): Promise<BookFootnotes> {
  try {
    const json = await FileSystem.readAsStringAsync(footnotesPath(bookId))
    return JSON.parse(json) as BookFootnotes
  } catch {
    return {}
  }
}

/** Сохранить изображение (base64) в директорию images/ */
export async function saveImage(bookId: string, filename: string, base64: string): Promise<void> {
  await FileSystem.writeAsStringAsync(
    `${imagesDir(bookId)}${filename}`,
    base64,
    { encoding: FileSystem.EncodingType.Base64 },
  )
}

/** Удалить всю директорию книги */
export async function deleteBookDir(bookId: string): Promise<void> {
  await FileSystem.deleteAsync(`${BOOKS_DIR}${bookId}/`, { idempotent: true })
}

/** Заменить относительные src изображений на абсолютные пути (рекурсивно, включая nestedItems) */
export function resolveImagePaths(chapter: BookChapter, bookId: string): BookChapter {
  const base = `${BOOKS_DIR}${bookId}/`

  function resolveItems(items: ContentItem[]): ContentItem[] {
    return items.map((item) => {
      if (item.type === 'image' && item.src && !item.src.startsWith('file://')) {
        return { ...item, src: `${base}${item.src}` }
      }
      if (item.type === 'blockquote' && item.nestedItems) {
        return { ...item, nestedItems: resolveItems(item.nestedItems) }
      }
      return item
    })
  }

  return { ...chapter, items: resolveItems(chapter.items) }
}
