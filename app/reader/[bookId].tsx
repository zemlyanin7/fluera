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
        await ensureBookDirs(currentBook.id);

        if (currentBook.format === 'fb2') {
          // Читаем XML-файл
          const xml = await FileSystem.readAsStringAsync(currentBook.filePath);
          const result = await convertFb2(xml, currentBook.id);
          await saveChapters(currentBook.id, result.chapters);
          await saveFootnotes(currentBook.id, result.footnotes);

          // Обновляем метаданные книги в БД, сбрасываем lastPosition (формат изменился)
          await database.write(async () => {
            await currentBook.update((record) => {
              record.totalChapters = result.totalChapters;
              record.contentVersion = 1;
              record.lastPosition = null;
            });
          });
        } else if (currentBook.format === 'epub') {
          // Читаем EPUB как base64 и конвертируем в ArrayBuffer
          const base64 = await FileSystem.readAsStringAsync(currentBook.filePath, {
            encoding: FileSystem.EncodingType.Base64,
          });
          const binary = atob(base64);
          const buffer = new ArrayBuffer(binary.length);
          const view = new Uint8Array(buffer);
          for (let i = 0; i < binary.length; i++) {
            view[i] = binary.charCodeAt(i);
          }

          const result = await convertEpub(buffer, currentBook.id);
          await saveChapters(currentBook.id, result.chapters);
          await saveFootnotes(currentBook.id, result.footnotes);

          // Обновляем метаданные книги в БД, сбрасываем lastPosition (формат изменился)
          await database.write(async () => {
            await currentBook.update((record) => {
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
        console.error('[ReaderScreen] Ошибка авто-миграции:', err);
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
