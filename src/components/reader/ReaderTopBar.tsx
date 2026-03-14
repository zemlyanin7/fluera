import React from 'react'
import { Pressable, StyleSheet } from 'react-native'
import { XStack, Text } from 'tamagui'
import { useRouter } from 'expo-router'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import Animated, { useAnimatedStyle, withTiming } from 'react-native-reanimated'
import { useReaderTheme } from '../../hooks/useReaderTheme'

interface ReaderTopBarProps {
  title: string
  progress: number // 0-100
  visible: boolean
  onSettingsPress: () => void
}

const AnimatedXStack = Animated.createAnimatedComponent(XStack)

export function ReaderTopBar({ title, progress, visible, onSettingsPress }: ReaderTopBarProps) {
  const router = useRouter()
  const insets = useSafeAreaInsets()
  const readerTheme = useReaderTheme()

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: withTiming(visible ? 1 : 0, { duration: 200 }),
    transform: [{ translateY: withTiming(visible ? 0 : -60, { duration: 200 }) }],
  }))

  return (
    <AnimatedXStack
      position="absolute"
      top={0}
      left={0}
      right={0}
      paddingTop={insets.top}
      paddingHorizontal="$3"
      paddingBottom="$2"
      backgroundColor={readerTheme.colors.topBarBg}
      justifyContent="space-between"
      alignItems="center"
      zIndex={100}
      style={animatedStyle}
    >
      <Pressable
        style={({ pressed }) => [styles.iconButton, pressed && styles.pressed]}
        onPress={() => router.back()}
      >
        <Text fontSize={18} color={readerTheme.colors.text}>←</Text>
      </Pressable>
      <Text fontSize="$3" numberOfLines={1} flex={1} textAlign="center" marginHorizontal="$2" color={readerTheme.colors.text}>
        {title}
      </Text>
      <XStack alignItems="center" gap="$2">
        <Text fontSize="$2" color={readerTheme.colors.textSecondary}>{Math.round(progress)}%</Text>
        <Pressable
          style={({ pressed }) => [styles.iconButton, pressed && styles.pressed]}
          onPress={onSettingsPress}
        >
          <Text fontSize={18} color={readerTheme.colors.text}>⚙</Text>
        </Pressable>
      </XStack>
    </AnimatedXStack>
  )
}

const styles = StyleSheet.create({
  iconButton: {
    padding: 8,
    borderRadius: 8,
  },
  pressed: {
    opacity: 0.6,
  },
})
