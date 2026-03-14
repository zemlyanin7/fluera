import React, { useState, useEffect, useRef } from 'react'
import { FlatList } from 'react-native'
import { YStack, Text } from 'tamagui'
import { Q } from '@nozbe/watermelondb'
import { useTranslation } from 'react-i18next'
import { database } from '../../src/db'
import { Book } from '../../src/db/models/Book'
import { BookCard } from '../../src/components/library/BookCard'
import { AddBookButton } from '../../src/components/library/AddBookButton'
import { BookImporter } from '../../src/services/library/BookImporter'

export default function LibraryScreen() {
  const { t } = useTranslation()
  const [books, setBooks] = useState<Book[]>([])
  const coversExtracted = useRef(false)

  // Load books from DB — WatermelonDB's observe() is reactive,
  // so the list updates automatically when books are added/modified/deleted
  useEffect(() => {
    const collection = database.get<Book>('books')
    const subscription = collection
      .query(Q.sortBy('last_read_at', Q.desc))
      .observe()
      .subscribe(setBooks)

    return () => subscription.unsubscribe()
  }, [])

  // One-time: extract covers for books imported before cover support
  useEffect(() => {
    if (books.length > 0 && !coversExtracted.current) {
      coversExtracted.current = true
      BookImporter.extractMissingCovers()
    }
  }, [books.length])

  if (books.length === 0) {
    return (
      <YStack flex={1} alignItems="center" padding="$6" gap="$4">
        <YStack flex={1} />
        <Text fontSize="$9" textAlign="center">📚</Text>
        <Text fontSize="$5" textAlign="center" color="$textSecondary">
          {t('library.emptyState.title')}
        </Text>
        <Text fontSize="$3" textAlign="center" color="$textMuted">
          {t('library.emptyState.subtitle')}
        </Text>
        <AddBookButton />
        <YStack flex={2} />
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
