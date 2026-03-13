import { createTokens } from '@tamagui/core'

export const tokens = createTokens({
  color: {
    // Brand
    primary: '#6c63ff',
    primaryLight: '#8b83ff',
    primaryDark: '#5449e6',

    // Reader word status
    wordNew: '#4a90d9',
    wordLearning: '#f5c842',
    wordLearning70: 'rgba(245, 200, 66, 0.7)',
    wordLearning40: 'rgba(245, 200, 66, 0.4)',

    // Semantic
    success: '#4caf50',
    error: '#ef4444',
    warning: '#f59e0b',
    info: '#3b82f6',

    // Light theme
    lightBg: '#ffffff',
    lightSurface: '#f8f9fa',
    lightCard: '#ffffff',
    lightText: '#1a1a2e',
    lightTextSecondary: '#666666',
    lightTextMuted: '#999999',
    lightBorder: '#e5e7eb',

    // Dark theme
    darkBg: '#1a1a2e',
    darkSurface: '#2d2d4e',
    darkCard: '#2d2d4e',
    darkText: '#e0e0e0',
    darkTextSecondary: '#aaaaaa',
    darkTextMuted: '#666666',
    darkBorder: '#333333',

    // Sepia theme
    sepiaBg: '#f5f0e1',
    sepiaSurface: '#ece6d3',
    sepiaCard: '#ece6d3',
    sepiaText: '#5b4636',
    sepiaTextSecondary: '#7a6952',
    sepiaTextMuted: '#a08b6f',
    sepiaBorder: '#d4cbb8',

    // Translation popup
    popupBgLight: '#f3f0ff',
    popupBgDark: '#2d2d4e',
    popupBgSepia: '#ece6d3',
  },
  space: {
    0: 0,
    1: 4,
    2: 8,
    3: 12,
    4: 16,
    5: 20,
    6: 24,
    8: 32,
    10: 40,
    12: 48,
    16: 64,
  },
  size: {
    0: 0,
    1: 4,
    2: 8,
    3: 12,
    4: 16,
    5: 20,
    6: 24,
    8: 32,
    10: 40,
    12: 48,
    16: 64,
  },
  radius: {
    0: 0,
    1: 4,
    2: 8,
    3: 12,
    4: 16,
    full: 9999,
  },
  zIndex: {
    0: 0,
    1: 100,
    2: 200,
    5: 500,
  },
})
