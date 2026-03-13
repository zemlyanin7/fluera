import React from 'react'
import { XStack, Text, Button } from 'tamagui'
import { useRouter } from 'expo-router'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import Animated, { useAnimatedStyle, withTiming } from 'react-native-reanimated'

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
      backgroundColor="$backgroundTransparent"
      justifyContent="space-between"
      alignItems="center"
      zIndex={100}
      style={animatedStyle}
    >
      <Button size="$3" chromeless onPress={() => router.back()}>
        ←
      </Button>
      <Text fontSize="$3" numberOfLines={1} flex={1} textAlign="center" marginHorizontal="$2">
        {title}
      </Text>
      <XStack alignItems="center" gap="$2">
        <Text fontSize="$2" color="$gray10">{Math.round(progress)}%</Text>
        <Button size="$3" chromeless onPress={onSettingsPress}>
          ⚙
        </Button>
      </XStack>
    </AnimatedXStack>
  )
}
