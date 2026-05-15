import { UnistylesRuntime } from 'react-native-unistyles';
import { shallow } from 'zustand/shallow';
import { useSettingsStore } from '@/stores/settingsStore';

/**
 * Подписка Settings → UnistylesRuntime.
 * Возвращает unsubscribe — обязательно вызывать в cleanup useEffect.
 * Threading: JS thread only, не из Reanimated worklet.
 *
 * C1: `equalityFn: shallow` — селектор возвращает новый объект каждый вызов,
 *     без shallow listener срабатывал бы на КАЖДОЕ изменение settings,
 *     а не только при смене themeId/themeAuto.
 *
 * C2: auto + sepia. Adaptive themes (UnistylesRuntime.setAdaptiveThemes(true))
 *     умеет переключать только light↔dark по colorScheme устройства, sepia
 *     не учитывается. Если пользователь выбрал sepia и при этом включил auto,
 *     это смысловой конфликт — sepia не может быть «авто». Решение: при
 *     id === 'sepia' принудительно отключаем adaptiveThemes и применяем sepia
 *     как фиксированную тему. Лог-предупреждение для дебага.
 */
export function attachThemeBridge(): () => void {
  return useSettingsStore.subscribe(
    (s) => ({ id: s.themeId, auto: s.themeAuto }),
    ({ id, auto }) => {
      if (auto && id === 'sepia') {
        console.warn(
          '[theme/bridge] auto=true несовместим с themeId=sepia: ' +
            'adaptiveThemes отключаются, применяется sepia как fixed theme.',
        );
        UnistylesRuntime.setAdaptiveThemes(false);
        UnistylesRuntime.setTheme('sepia');
        return;
      }
      if (auto) {
        UnistylesRuntime.setAdaptiveThemes(true);
      } else {
        UnistylesRuntime.setAdaptiveThemes(false);
        UnistylesRuntime.setTheme(id);
      }
    },
    { equalityFn: shallow, fireImmediately: true },
  );
}
