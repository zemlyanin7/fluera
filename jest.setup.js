// I7: useVariants реально мутирует стиль — мерджит ветку variants[name][value]
// в корень. Упрощённая, но достаточная реализация для unit-тестов
// (нет nested compoundVariants, без breakpoints).
jest.mock('react-native-unistyles', () => {
  const themeStub = {
    ink: '#000', paper: '#fff', paper2: '#f5efe4', paperOverlay: 'rgba(245,239,228,0.30)',
    accent: '#c0392b', ink2: '#333', ink3: '#888',
    accentSoft: '#c0392b22', accentLine: '#c0392b55',
    knownSoft: '#22cc8822', learningSoft: '#ffcc0022',
    known: '#22cc88', learning: '#ffcc00', newSoft: '#c0392b33',
    sizes: { radii: { md: 12, lg: 14 }, spacing: { md: 12 }, iconBtn: 36, statusbarH: 54, tabbarH: 60 },
  };
  return {
    StyleSheet: {
      configure: jest.fn(),
      create: (factory) => {
        const result = typeof factory === 'function'
          ? factory(themeStub, { insets: { top: 0, right: 0, bottom: 0, left: 0 } })
          : factory;
        return Object.assign(result, {
          useVariants: (selected) => {
            if (!selected || typeof selected !== 'object') return;
            for (const styleKey of Object.keys(result)) {
              const style = result[styleKey];
              if (!style || typeof style !== 'object' || !style.variants) continue;
              for (const [variantName, variantValue] of Object.entries(selected)) {
                const branch = style.variants?.[variantName]?.[variantValue];
                if (branch && typeof branch === 'object') {
                  Object.assign(style, branch);
                }
              }
            }
          },
        });
      },
    },
    UnistylesRuntime: {
      setTheme: jest.fn(),
      setAdaptiveThemes: jest.fn(),
      colorScheme: 'light',
    },
  };
});

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

// react-i18next mock — возвращает ключ через простой lookup по en.json,
// чтобы тесты на TabBar/прочие компоненты не требовали инициализации i18n.
jest.mock('react-i18next', () => {
  const en = require('./src/i18n/locales/en.json');
  const get = (obj, path) =>
    path.split('.').reduce((acc, k) => (acc == null ? undefined : acc[k]), obj);
  return {
    useTranslation: () => ({
      t: (key) => {
        const v = get(en, key);
        return typeof v === 'string' ? v : key;
      },
      i18n: { changeLanguage: jest.fn() },
    }),
    initReactI18next: { type: '3rdParty', init: jest.fn() },
    Trans: ({ children }) => children,
  };
});

jest.mock('expo-font', () => ({ useFonts: () => [true, null], isLoaded: () => true }));
jest.mock('expo-localization', () => ({ getLocales: () => [{ languageCode: 'en' }], locale: 'en-US' }));
jest.mock('expo-splash-screen', () => ({ preventAutoHideAsync: jest.fn(), hideAsync: jest.fn() }));
jest.mock('react-native-reanimated', () => require('react-native-reanimated/mock'));
