import { Link, Stack } from 'expo-router'
import { YStack, Text } from 'tamagui'

export default function NotFoundScreen() {
  return (
    <>
      <Stack.Screen options={{ title: 'Not Found' }} />
      <YStack flex={1} alignItems="center" justifyContent="center" padding="$4">
        <Text fontSize="$8">Page not found</Text>
        <Link href="/" style={{ marginTop: 16 }}>
          <Text color="$primary">Go to Library</Text>
        </Link>
      </YStack>
    </>
  )
}
