import { useState, useEffect } from 'react';
import { Pressable, StyleSheet } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { YStack, Text, Spinner } from 'tamagui';
import { useTranslation } from 'react-i18next';
import * as FileSystem from 'expo-file-system/legacy';
import { useBook } from '../../src/hooks/useBook';
import { UnifiedReader } from '../../src/components/reader/UnifiedReader';
import { useSettingsStore } from '../../src/stores/settingsStore';
import { chapterExists, saveChapters, saveFootnotes, ensureBookDirs } from '../../src/services/converter/chapterStorage';
import { convertFb2 } from '../../src/services/converter/fb2Converter';
import { convertEpub } from '../../src/services/converter/epubConverter';
import { database } from '../../src/db';
import type { Book } from '../../src/db/models/Book';

export default function ReaderScreen() {
  const { bookId } = useLocalSearchParams<{ bookId: string }>();
  const { book, loading, error } = useBook(bookId);
  const { t } = useTranslation();
  const router = useRouter();
  const settings = useSettingsStore();

  // Состояние авто-миграции: null — проверяем, true — готово, false — в процессе
  const [migrationDone, setMigrationDone] = useState<boolean | null>(null);

  console.log('[ReaderScreen] bookId:', bookId, 'loading:', loading, 'error:', error, 'book:', book?.title);

  useEffect(() => {
    if (!book) return;

    // Захватываем book в локальную переменную, чтобы TypeScript корректно сужал тип
    const currentBook = book;

    // Авто-миграция: если книга ещё не сконвертирована (totalChapters === null)
    // или если первая глава не существует на диске
    async function checkAndMigrate() {
      if (currentBook.totalChapters != null) {
        // Проверяем, существует ли первая глава на диске
        const exists = await chapterExists(currentBook.id, 0);
        if (exists) {
          setMigrationDone(true);
          return;
        }
      }

      // Необходима конвертация
      setMigrationDone(false);
      try {
        console.log('[Migration] Начало конвертации. format:', currentBook.format, 'id:', currentBook.id, 'filePath:', currentBook.filePath);
        await ensureBookDirs(currentBook.id);
        console.log('[Migration] ensureBookDirs OK');

        if (currentBook.format === 'fb2') {
          // Читаем XML-файл
          console.log('[Migration] Читаем FB2 файл...');
          const xml = await FileSystem.readAsStringAsync(currentBook.filePath);
          console.log('[Migration] FB2 прочитан, длина:', xml.length);
          const result = await convertFb2(xml, currentBook.id);
          console.log('[Migration] convertFb2 OK, глав:', result.chapters.length);
          await saveChapters(currentBook.id, result.chapters);
          console.log('[Migration] saveChapters OK');
          await saveFootnotes(currentBook.id, result.footnotes);

          // Обновляем метаданные книги в БД, сбрасываем lastPosition (формат изменился)
          // Перечитываем книгу из БД — useBook мог обновить lastReadAt в другом writer
          await database.write(async () => {
            const freshBook = await database.get<Book>('books').find(currentBook.id);
            await freshBook.update((record) => {
              record.totalChapters = result.totalChapters;
              record.contentVersion = 1;
              record.lastPosition = null;
            });
          });
        } else if (currentBook.format === 'epub') {
          // Читаем EPUB как base64 и конвертируем в ArrayBuffer
          console.log('[Migration] Читаем EPUB файл...');
          const base64 = await FileSystem.readAsStringAsync(currentBook.filePath, {
            encoding: FileSystem.EncodingType.Base64,
          });
          console.log('[Migration] EPUB прочитан, base64 длина:', base64.length);
          const binary = atob(base64);
          const buffer = new ArrayBuffer(binary.length);
          const view = new Uint8Array(buffer);
          for (let i = 0; i < binary.length; i++) {
            view[i] = binary.charCodeAt(i);
          }
          console.log('[Migration] ArrayBuffer создан, размер:', buffer.byteLength);

          const result = await convertEpub(buffer, currentBook.id);
          console.log('[Migration] convertEpub OK, глав:', result.chapters.length);
          await saveChapters(currentBook.id, result.chapters);
          console.log('[Migration] saveChapters OK');
          await saveFootnotes(currentBook.id, result.footnotes);

          // Обновляем метаданные книги в БД, сбрасываем lastPosition (формат изменился)
          // Перечитываем книгу из БД — useBook мог обновить lastReadAt в другом writer
          await database.write(async () => {
            const freshBook = await database.get<Book>('books').find(currentBook.id);
            await freshBook.update((record) => {
              record.totalChapters = result.chapters.length;
              record.contentVersion = 1;
              record.lastPosition = null;
            });
          });
        } else {
          // Неизвестный формат — просто помечаем как готовое
          setMigrationDone(true);
          return;
        }

        setMigrationDone(true);
      } catch (err) {
        console.error('[ReaderScreen] Ошибка авто-миграции:', err, err instanceof Error ? err.stack : '');
        // Даже при ошибке пытаемся открыть ридер — он покажет своё состояние загрузки
        setMigrationDone(true);
      }
    }

    void checkAndMigrate();
  }, [book]);

  if (loading) {
    return (
      <YStack flex={1} justifyContent="center" alignItems="center">
        <Spinner size="large" />
      </YStack>
    );
  }

  if (error || !book) {
    return (
      <YStack flex={1} justifyContent="center" alignItems="center" padding="$4" gap="$4">
        <Text fontSize="$6">
          {error === 'file_missing'
            ? t('reader.error.fileMissing')
            : t('reader.error.bookNotFound')}
        </Text>
        <Pressable
          style={({ pressed }) => [styles.backButton, pressed && styles.pressed]}
          onPress={() => router.back()}
        >
          <Text fontSize="$4" color="$primary">
            {t('reader.error.backToLibrary')}
          </Text>
        </Pressable>
      </YStack>
    );
  }

  // Авто-миграция в процессе
  if (migrationDone === null || migrationDone === false) {
    return (
      <YStack flex={1} justifyContent="center" alignItems="center" gap="$3">
        <Spinner size="large" />
        <Text fontSize="$4" color="$textSecondary">
          {t('reader.preparingBook')}
        </Text>
      </YStack>
    );
  }

  return (
    <UnifiedReader
      book={book}
      bookLanguage={settings.bookLanguage}
      nativeLanguage={settings.nativeLanguage}
    />
  );
}

const styles = StyleSheet.create({
  backButton: {
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 8,
    backgroundColor: '#f0f0f0',
  },
  pressed: {
    opacity: 0.7,
  },
});
