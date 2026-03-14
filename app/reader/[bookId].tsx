import { useState, useEffect } from 'react';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { YStack, Text, Spinner, Button } from 'tamagui';
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

  useEffect(() => {
    if (book) {
      FileSystem.readAsStringAsync(book.filePath).then(setContent);
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
        <Text fontSize="$6" color="$red10">
          {error === 'file_missing'
            ? t('reader.error.fileMissing')
            : t('reader.error.bookNotFound')}
        </Text>
        <Button size="$4" onPress={() => router.back()}>
          {t('reader.error.backToLibrary')}
        </Button>
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

  // Loading file content
  if (!content) {
    return (
      <YStack flex={1} justifyContent="center" alignItems="center">
        <Spinner size="large" />
      </YStack>
    );
  }

  if (book.format === 'fb2') {
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
      <Text fontSize="$4" color="$gray10">{book.format} reader coming soon</Text>
    </YStack>
  );
}
