jest.mock('react-native-unistyles', () => ({
  StyleSheet: {
    configure: jest.fn(),
    create: (factory) => {
      const result = typeof factory === 'function'
        ? factory({ ink: '#000', paper: '#fff', accent: '#c0392b' }, {})
        : factory;
      return Object.assign(result, { useVariants: jest.fn() });
    },
  },
  UnistylesRuntime: {
    setTheme: jest.fn(),
    setAdaptiveThemes: jest.fn(),
    colorScheme: 'light',
  },
}));

jest.mock('@gorhom/bottom-sheet', () => {
  const RN = require('react-native');
  return {
    __esModule: true,
    default: ({ children }) => RN.createElement(RN.View, null, children),
    BottomSheetView: ({ children }) => RN.createElement(RN.View, null, children),
    BottomSheetBackdrop: () => null,
  };
});

jest.mock('react-native-svg', () => {
  const RN = require('react-native');
  const PT = ({ children }) => RN.createElement(RN.View, null, children);
  return { Svg: PT, Path: PT, Circle: PT, Rect: PT, G: PT, Defs: PT,
           LinearGradient: PT, Stop: PT };
});

jest.mock('expo-blur', () => {
  const RN = require('react-native');
  return { BlurView: ({ children }) => RN.createElement(RN.View, null, children) };
});

jest.mock('expo-linear-gradient', () => {
  const RN = require('react-native');
  return { LinearGradient: ({ children }) => RN.createElement(RN.View, null, children) };
});

jest.mock('expo-font', () => ({ useFonts: () => [true, null], isLoaded: () => true }));
jest.mock('expo-localization', () => ({ getLocales: () => [{ languageCode: 'en' }], locale: 'en-US' }));
jest.mock('expo-splash-screen', () => ({ preventAutoHideAsync: jest.fn(), hideAsync: jest.fn() }));
jest.mock('react-native-reanimated', () => require('react-native-reanimated/mock'));
