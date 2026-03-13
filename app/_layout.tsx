import { Stack } from 'expo-router'
import { TamaguiProvider, Theme } from '@tamagui/core'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { StatusBar } from 'expo-status-bar'
import { useColorScheme } from 'react-native'
import config from '../tamagui.config'
import '../src/i18n/config'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { staleTime: 5 * 60 * 1000, retry: 2 },
  },
})

export default function RootLayout() {
  const colorScheme = useColorScheme()
  const theme = colorScheme === 'dark' ? 'dark' : 'light'

  return (
    <TamaguiProvider config={config} defaultTheme={theme}>
      <Theme name={theme}>
        <QueryClientProvider client={queryClient}>
          <StatusBar style={colorScheme === 'dark' ? 'light' : 'dark'} />
          <Stack screenOptions={{ headerShown: false }}>
            <Stack.Screen name="(tabs)" />
            <Stack.Screen name="reader/[bookId]" options={{ presentation: 'fullScreenModal' }} />
            <Stack.Screen name="catalog" />
          </Stack>
        </QueryClientProvider>
      </Theme>
    </TamaguiProvider>
  )
}
