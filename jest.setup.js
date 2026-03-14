// Jest setup file for Expo/React Native testing

// Mock expo-dev-menu
jest.mock('expo-dev-menu', () => ({
  registerDevMenuItems: jest.fn(),
}));

// Mock expo-constants
jest.mock('expo-constants', () => ({
  default: {
    expoConfig: {
      extra: {
        DEEPSEEK_API_KEY: 'test-key',
        GEMINI_API_KEY: 'test-key',
        OPENROUTER_API_KEY: 'test-key',
      },
    },
  },
}));

// Mock expo-file-system
jest.mock('expo-file-system', () => ({
  default: {
    documentDirectory: '/mock/docs/',
  },
}));

// Mock async-storage
jest.mock('@react-native-async-storage/async-storage', () => ({
  default: {
    getItem: jest.fn(),
    setItem: jest.fn(),
    removeItem: jest.fn(),
    multiGet: jest.fn(),
    multiSet: jest.fn(),
  },
}));

// Mock expo-dev-client
jest.mock('expo-dev-client');

// Suppress warnings
global.console = {
  ...console,
  warn: jest.fn(),
  error: jest.fn((message) => {
    // Allow some errors, suppress others
    if (message && message.includes?.('TurboModule')) {
      return;
    }
    // Fallback to original error for unexpected errors
    console.error.bind(console, message);
  }),
};
