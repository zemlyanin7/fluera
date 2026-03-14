import React from 'react'
import { YStack, XStack, Text, Image } from 'tamagui'
import { useRouter } from 'expo-router'
import type { Book } from '../../db/models/Book'

interface BookCardProps {
  book: Book
}

export function BookCard({ book }: BookCardProps) {
  const router = useRouter()

  return (
    <XStack
      padding="$3"
      backgroundColor="$background"
      borderRadius="$3"
      marginBottom="$2"
      pressStyle={{ opacity: 0.8 }}
      onPress={() => router.push(`/reader/${book.id}`)}
      gap="$3"
    >
      {book.coverPath ? (
        <Image
          source={{ uri: book.coverPath }}
          width={60}
          height={90}
          borderRadius="$2"
        />
      ) : (
        <YStack
          width={60}
          height={90}
          backgroundColor="$gray5"
          borderRadius="$2"
          justifyContent="center"
          alignItems="center"
        >
          <Text fontSize="$2" color="$gray10">
            {book.format.toUpperCase()}
          </Text>
        </YStack>
      )}

      <YStack flex={1} justifyContent="space-between">
        <YStack>
          <Text fontSize="$5" fontWeight="bold" numberOfLines={2}>
            {book.title}
          </Text>
          <Text fontSize="$3" color="$gray10" numberOfLines={1}>
            {book.author}
          </Text>
        </YStack>

        <XStack alignItems="center" gap="$2">
          {/* Progress bar */}
          <YStack flex={1} height={4} backgroundColor="$gray5" borderRadius="$1">
            <YStack
              height={4}
              width={`${book.progress}%`}
              backgroundColor="$blue10"
              borderRadius="$1"
            />
          </YStack>
          <Text fontSize="$2" color="$gray10">
            {Math.round(book.progress)}%
          </Text>
        </XStack>
      </YStack>
    </XStack>
  )
}
