jest.mock('react-native-unistyles', () => ({
  StyleSheet: {
    configure: jest.fn(),
    create: (factory) => {
      const result = typeof factory === 'function'
        ? factory(
            { ink: '#000', paper: '#fff', accent: '#c0392b', ink2: '#333', ink3: '#888',
              accentSoft: '#c0392b22', knownSoft: '#22cc8822', learningSoft: '#ffcc0022',
              known: '#22cc88', learning: '#ffcc00' },
            { insets: { top: 0, right: 0, bottom: 0, left: 0 } },
          )
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
  const React = require('react');
  const RN = require('react-native');
  return {
    __esModule: true,
    default: React.forwardRef(({ children }, _ref) => React.createElement(RN.View, null, children)),
    BottomSheetView: ({ children }) => React.createElement(RN.View, null, children),
    BottomSheetBackdrop: () => null,
  };
});

jest.mock('react-native-svg', () => {
  const React = require('react');
  const RN = require('react-native');
  const PT = ({ children }) => React.createElement(RN.View, null, children);
  return { Svg: PT, Path: PT, Circle: PT, Rect: PT, G: PT, Defs: PT,
           LinearGradient: PT, Stop: PT };
});

jest.mock('expo-blur', () => {
  const React = require('react');
  const RN = require('react-native');
  return { BlurView: ({ children }) => React.createElement(RN.View, null, children) };
});

jest.mock('expo-linear-gradient', () => {
  const React = require('react');
  const RN = require('react-native');
  return { LinearGradient: ({ children }) => React.createElement(RN.View, null, children) };
});

jest.mock('expo-font', () => ({ useFonts: () => [true, null], isLoaded: () => true }));
jest.mock('expo-localization', () => ({ getLocales: () => [{ languageCode: 'en' }], locale: 'en-US' }));
jest.mock('expo-splash-screen', () => ({ preventAutoHideAsync: jest.fn(), hideAsync: jest.fn() }));
jest.mock('react-native-reanimated', () => require('react-native-reanimated/mock'));
