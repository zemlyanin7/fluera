module.exports = {
  preset: 'jest-expo',
  setupFilesAfterEnv: ['<rootDir>/jest.setup.js'],
  transformIgnorePatterns: [
    'node_modules/(?!(jest-)?@?react-native|@react-native-community|@react-navigation|expo(nent)?|@expo(nent)?/.*|@expo-google-fonts/.*|react-native-svg|react-native-unistyles|@gorhom/.*|react-native-reanimated)',
  ],
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
    // CSV files are Metro-bundled assets (numeric module IDs at runtime).
    // Jest cannot parse them as JS — return 0 (a valid asset module placeholder).
    '\\.csv$': '<rootDir>/src/__mocks__/csvAssetStub.js',
  },
  testPathIgnorePatterns: ['/node_modules/', '/ios/', '/android/', '/__tests__/fixtures/'],
};
