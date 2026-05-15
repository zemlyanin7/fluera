module.exports = {
  preset: 'jest-expo',
  setupFilesAfterEach: ['<rootDir>/jest.setup.js'],
  transformIgnorePatterns: [
    'node_modules/(?!(jest-)?@?react-native|@react-native-community|@react-navigation|expo(nent)?|@expo(nent)?/.*|@expo-google-fonts/.*|react-native-svg|react-native-unistyles|@gorhom/.*|react-native-reanimated)',
  ],
  moduleNameMapper: { '^@/(.*)$': '<rootDir>/src/$1' },
  testPathIgnorePatterns: ['/node_modules/', '/ios/', '/android/'],
};
