import { UnistylesRuntime } from 'react-native-unistyles';
import { applyThemeImmediate } from '@/theme/applyTheme';

jest.mock('react-native-unistyles', () => ({
  UnistylesRuntime: {
    setTheme: jest.fn(),
    setAdaptiveThemes: jest.fn(),
  },
}));

describe('applyThemeImmediate', () => {
  beforeEach(() => {
    (UnistylesRuntime.setTheme as jest.Mock).mockClear();
    (UnistylesRuntime.setAdaptiveThemes as jest.Mock).mockClear();
  });

  test('синхронный setTheme для dark', () => {
    applyThemeImmediate('dark', false);
    expect(UnistylesRuntime.setTheme).toHaveBeenCalledWith('dark');
  });

  test('синхронный setTheme для light', () => {
    applyThemeImmediate('light', false);
    expect(UnistylesRuntime.setTheme).toHaveBeenCalledWith('light');
  });

  test('синхронный setTheme для sepia', () => {
    applyThemeImmediate('sepia', false);
    expect(UnistylesRuntime.setTheme).toHaveBeenCalledWith('sepia');
  });

  test('auto=true → setAdaptiveThemes(true), не setTheme', () => {
    applyThemeImmediate('light', true);
    expect(UnistylesRuntime.setAdaptiveThemes).toHaveBeenCalledWith(true);
    expect(UnistylesRuntime.setTheme).not.toHaveBeenCalled();
  });

  test('sepia + auto → adaptive off + setTheme(sepia)', () => {
    applyThemeImmediate('sepia', true);
    expect(UnistylesRuntime.setTheme).toHaveBeenCalledWith('sepia');
  });
});
