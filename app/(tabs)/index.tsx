import React, { useState } from 'react'
import { FlatList } from 'react-native'
import { YStack, Text } from 'tamagui'
import { Q } from '@nozbe/watermelondb'
import { useTranslation } from 'react-i18next'
import { database } from '../../src/db'
import { Book } from '../../src/db/models/Book'
import { BookCard } from '../../src/components/library/BookCard'
import { AddBookButton } from '../../src/components/library/AddBookButton'

export default function LibraryScreen() {
  const { t } = useTranslation()
  const [books, setBooks] = useState<Book[]>([])

  // Load books from DB — WatermelonDB's observe() is reactive,
  // so the list updates automatically when books are added/modified/deleted
  React.useEffect(() => {
    const collection = database.get<Book>('books')
    const subscription = collection
      .query(Q.sortBy('last_read_at', Q.desc))
      .observe()
      .subscribe(setBooks)

    return () => subscription.unsubscribe()
  }, [])

  if (books.length === 0) {
    return (
      <YStack flex={1} justifyContent="center" alignItems="center" padding="$6" gap="$4">
        <Text fontSize="$7" textAlign="center">📚</Text>
        <Text fontSize="$5" textAlign="center" color="$gray11">
          {t('library.emptyState.title')}
        </Text>
        <Text fontSize="$3" textAlign="center" color="$gray10">
          {t('library.emptyState.subtitle')}
        </Text>
        <AddBookButton />
      </YStack>
    )
  }

  return (
    <YStack flex={1} padding="$3">
      <FlatList
        data={books}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => <BookCard book={item} />}
        ListHeaderComponent={
          <YStack marginBottom="$3">
            <AddBookButton />
          </YStack>
        }
      />
    </YStack>
  )
}
