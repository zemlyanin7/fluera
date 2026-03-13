import { useLocalSearchParams } from 'expo-router';
import { YStack, Text, Spinner, Button } from 'tamagui';
import { useTranslation } from 'react-i18next';
import { useRouter } from 'expo-router';
import { useBook } from '../../src/hooks/useBook';

export default function ReaderScreen() {
  const { bookId } = useLocalSearchParams<{ bookId: string }>();
  const { book, loading, error } = useBook(bookId);
  const { t } = useTranslation();
  const router = useRouter();

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

  // Format-specific reader will be added in Tasks 8 (FB2) and 12 (EPUB)
  return (
    <YStack flex={1} justifyContent="center" alignItems="center">
      <Text fontSize="$6">{book.title}</Text>
      <Text fontSize="$4" color="$gray10">{book.format} reader coming soon</Text>
    </YStack>
  );
}
