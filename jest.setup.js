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
    // useUnistyles() hook — возвращает текущую тему как объект.
    // В native ShadowTree это reactive-прокси, но для unit-тестов достаточно
    // отдать тот же themeStub, что и в StyleSheet.create.
    useUnistyles: () => ({ theme: themeStub, rt: { insets: { top: 0, right: 0, bottom: 0, left: 0 } } }),
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
// Поддерживает базовую интерполяцию {{var}} из opts.
jest.mock('react-i18next', () => {
  const en = require('./src/i18n/locales/en.json');
  const get = (obj, path) =>
    path.split('.').reduce((acc, k) => (acc == null ? undefined : acc[k]), obj);
  const interpolate = (str, opts) => {
    if (!opts || typeof opts !== 'object') return str;
    return str.replace(/\{\{(\w+)\}\}/g, (_, k) => (k in opts ? String(opts[k]) : `{{${k}}}`));
  };
  return {
    useTranslation: () => ({
      t: (key, opts) => {
        const v = get(en, key);
        if (typeof v === 'string') return interpolate(v, opts);
        if (opts && typeof opts === 'object' && typeof opts.defaultValue === 'string') return interpolate(opts.defaultValue, opts);
        return key;
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
jest.mock('react-native-reanimated', () => {
  const mock = require('react-native-reanimated/mock');
  // useReducedMotion не входит в стандартный mock — добавляем вручную.
  // В тестах всегда возвращаем false (анимации разрешены), чтобы не скрывать
  // проблемы с логикой анимаций. Тесты на reduced-motion ожидают duration=0,
  // что обрабатывается в компоненте условно по этому значению.
  mock.useReducedMotion = jest.fn(() => false);
  return mock;
});

// #2 Data layer — мок AsyncStorage (in-memory Map, persist через тесты)
jest.mock('@react-native-async-storage/async-storage', () => {
  const store = new Map();
  return {
    __esModule: true,
    default: {
      getItem: jest.fn((k) => Promise.resolve(store.has(k) ? store.get(k) : null)),
      setItem: jest.fn((k, v) => { store.set(k, v); return Promise.resolve(); }),
      removeItem: jest.fn((k) => { store.delete(k); return Promise.resolve(); }),
      clear: jest.fn(() => { store.clear(); return Promise.resolve(); }),
      getAllKeys: jest.fn(() => Promise.resolve(Array.from(store.keys()))),
      multiGet: jest.fn((keys) => Promise.resolve(keys.map((k) => [k, store.get(k) ?? null]))),
    },
  };
});

// expo-secure-store — in-memory mock
jest.mock('expo-secure-store', () => {
  const store = new Map();
  return {
    getItemAsync: jest.fn((k) => Promise.resolve(store.get(k) ?? null)),
    setItemAsync: jest.fn((k, v) => { store.set(k, v); return Promise.resolve(); }),
    deleteItemAsync: jest.fn((k) => { store.delete(k); return Promise.resolve(); }),
  };
});

// expo-crypto — детерминированный SHA-256 через node:crypto для тестов
jest.mock('expo-crypto', () => {
  const nodeCrypto = require('crypto');
  return {
    CryptoDigestAlgorithm: { SHA256: 'SHA-256' },
    digestStringAsync: jest.fn((_algo, input) =>
      Promise.resolve(nodeCrypto.createHash('sha256').update(input).digest('hex')),
    ),
  };
});

// react-native-get-random-values — no-op в jest (jsdom поставляет crypto.getRandomValues)
jest.mock('react-native-get-random-values', () => ({}));

// expo-battery — нативный модуль, мок для unit-тестов (#4.6).
// Мокаем три independent calls + три listeners; getPowerStateAsync removed
// in SDK 54 (BatteryBridge composes via Promise.all).
jest.mock('expo-battery', () => ({
  __esModule: true,
  BatteryState: { UNKNOWN: 0, UNPLUGGED: 1, CHARGING: 2, FULL: 3 },
  getBatteryLevelAsync: jest.fn().mockResolvedValue(0.8),
  getBatteryStateAsync: jest.fn().mockResolvedValue(2),
  isLowPowerModeEnabledAsync: jest.fn().mockResolvedValue(false),
  addBatteryLevelListener: jest.fn().mockReturnValue({ remove: jest.fn() }),
  addBatteryStateListener: jest.fn().mockReturnValue({ remove: jest.fn() }),
  addLowPowerModeListener: jest.fn().mockReturnValue({ remove: jest.fn() }),
}));

// expo-document-picker — нативный модуль, нужен мок для unit-тестов (#3)
jest.mock('expo-document-picker', () => ({
  getDocumentAsync: jest.fn(async () => ({ canceled: true, assets: null })),
}));
