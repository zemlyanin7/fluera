import { useState, useEffect } from 'react';
import { Pressable, StyleSheet } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { YStack, Text, Spinner } from 'tamagui';
import { useTranslation } from 'react-i18next';
import * as FileSystem from 'expo-file-system/legacy';
import { useBook } from '../../src/hooks/useBook';
import { Fb2Reader } from '../../src/components/reader/Fb2Reader';
import { EpubReader } from '../../src/components/reader/EpubReader';
import { useSettingsStore } from '../../src/stores/settingsStore';

export default function ReaderScreen() {
  const { bookId } = useLocalSearchParams<{ bookId: string }>();
  const { book, loading, error } = useBook(bookId);
  const { t } = useTranslation();
  const router = useRouter();
  const settings = useSettingsStore();
  const [content, setContent] = useState<string | null>(null);

  console.log('[ReaderScreen] bookId:', bookId, 'loading:', loading, 'error:', error, 'book:', book?.title);

  useEffect(() => {
    if (book && book.format === 'fb2') {
      FileSystem.readAsStringAsync(book.filePath)
        .then(setContent)
        .catch((err) => console.error('[ReaderScreen] Failed to read file:', err));
    }
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

  if (book.format === 'epub') {
    return (
      <EpubReader
        fileUri={book.filePath}
        book={book}
        bookLanguage={settings.bookLanguage}
        nativeLanguage={settings.nativeLanguage}
      />
    );
  }

  // Loading file content for FB2
  if (book.format === 'fb2' && !content) {
    return (
      <YStack flex={1} justifyContent="center" alignItems="center">
        <Spinner size="large" />
      </YStack>
    );
  }

  if (book.format === 'fb2' && content) {
    return (
      <Fb2Reader
        xml={content}
        book={book}
        bookLanguage={settings.bookLanguage}
        nativeLanguage={settings.nativeLanguage}
      />
    );
  }

  // Fallback for unsupported formats
  return (
    <YStack flex={1} justifyContent="center" alignItems="center">
      <Text fontSize="$6">{book.title}</Text>
      <Text fontSize="$4" color="$textSecondary">{book.format} reader coming soon</Text>
    </YStack>
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
