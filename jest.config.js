const config = {
  displayName: 'Fluera',
  preset: 'jest-expo',
  testEnvironment: 'node',
  roots: ['<rootDir>'],
  testMatch: ['**/__tests__/**/*.test.ts?(x)'],
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'json'],
  setupFilesAfterEnv: ['<rootDir>/jest.setup.js'],
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
  },
  transformIgnorePatterns: [
    'node_modules/(?!(expo|expo-router|expo-dev-menu|expo-modules-core|@tamagui|@react-native|react-native|@react-native-async-storage|@epubjs-react-native|@nozbe|@shopify|@tanstack|i18next|fast-xml-parser)/)',
  ],
  collectCoverageFrom: [
    'src/**/*.{ts,tsx}',
    '!src/**/*.d.ts',
    '!src/index.ts',
  ],
};

module.exports = config;
