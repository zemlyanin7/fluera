import { UnistylesRuntime } from 'react-native-unistyles';
import { useSettingsStore } from '@/stores/settingsStore';

/**
 * Подписка Settings → UnistylesRuntime.
 * Возвращает unsubscribe — обязательно вызывать в cleanup useEffect.
 * Threading: JS thread only, не из Reanimated worklet.
 */
export function attachThemeBridge(): () => void {
  return useSettingsStore.subscribe(
    (s) => ({ id: s.themeId, auto: s.themeAuto }),
    ({ id, auto }) => {
      if (auto) {
        UnistylesRuntime.setAdaptiveThemes(true);
      } else {
        UnistylesRuntime.setAdaptiveThemes(false);
        UnistylesRuntime.setTheme(id);
      }
    },
    { fireImmediately: true },
  );
}
