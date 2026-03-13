// Mock react-native-gesture-handler before importing component
jest.mock('react-native-gesture-handler', () => ({
  Gesture: {
    Pan: () => ({
      onUpdate: () => ({
        onEnd: () => ({}),
      }),
    }),
  },
  GestureDetector: ({ children }: any) => children,
}));

// Mock react-native-reanimated
jest.mock('react-native-reanimated', () => ({
  default: {
    createAnimatedComponent: (comp: any) => comp,
    View: require('react-native').View,
  },
  useSharedValue: (val: any) => ({ value: val }),
  useAnimatedStyle: (fn: any) => ({}),
  withTiming: (val: any) => val,
  withSpring: (val: any) => val,
  runOnJS: (fn: any) => fn,
}));

// Mock Tamagui
jest.mock('tamagui', () => ({
  YStack: ({ children }: any) => children,
  XStack: ({ children }: any) => children,
  Text: ({ children }: any) => children,
  Button: ({ children, onPress }: any) => children,
  Spinner: () => null,
}));

import { TranslationPopup } from '../../../src/components/reader/TranslationPopup';

describe('TranslationPopup', () => {
  it('should export TranslationPopup component', () => {
    expect(typeof TranslationPopup).toBe('function');
  });
});
