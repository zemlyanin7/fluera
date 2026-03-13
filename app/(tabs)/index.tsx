import { YStack, Text } from 'tamagui'
import { SafeAreaView } from 'react-native-safe-area-context'

export default function LibraryScreen() {
  return (
    <SafeAreaView style={{ flex: 1 }}>
      <YStack flex={1} alignItems="center" justifyContent="center" padding="$4">
        <Text fontSize="$8" fontWeight="bold">Library</Text>
        <Text color="$textSecondary" marginTop="$2">Your books will appear here</Text>
      </YStack>
    </SafeAreaView>
  )
}
