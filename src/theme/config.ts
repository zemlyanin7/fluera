import { createTamagui } from '@tamagui/core'
import { createInterFont } from '@tamagui/font-inter'
import { createAnimations } from '@tamagui/animations-react-native'
import { tokens } from './tokens'
import { lightTheme, darkTheme, sepiaTheme } from './themes'

const interFont = createInterFont()

const animations = createAnimations({
  fast: { type: 'spring', damping: 20, stiffness: 250 },
  medium: { type: 'spring', damping: 15, stiffness: 150 },
  slow: { type: 'spring', damping: 15, stiffness: 100 },
})

export const config = createTamagui({
  tokens,
  themes: {
    light: lightTheme,
    dark: darkTheme,
    sepia: sepiaTheme,
  },
  fonts: {
    heading: interFont,
    body: interFont,
  },
  animations,
})

export type AppConfig = typeof config

declare module '@tamagui/core' {
  interface TamaguiCustomConfig extends AppConfig {}
}
