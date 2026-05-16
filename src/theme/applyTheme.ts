// applyTheme — синхронная функция, применяющая theme/auto к UnistylesRuntime.
// Вынесена в отдельный модуль чтобы избежать циклической зависимости
// settingsStore ↔ bridge (store.setTheme вызывает applyTheme; bridge тоже
// вызывает applyTheme при подписке на стор для persist-rehydration).
import { UnistylesRuntime } from 'react-native-unistyles';
import type { ThemeId } from '@/types/settings';

/**
 * C2: auto + sepia. Adaptive themes (UnistylesRuntime.setAdaptiveThemes(true))
 *     умеет переключать только light↔dark по colorScheme устройства, sepia
 *     не учитывается. Если пользователь выбрал sepia и при этом включил auto,
 *     это смысловой конфликт — sepia не может быть «авто». Решение: при
 *     id === 'sepia' принудительно отключаем adaptiveThemes и применяем sepia
 *     как фиксированную тему. Лог-предупреждение для дебага.
 */
export function applyTheme(id: ThemeId, auto: boolean): void {
  if (auto && id === 'sepia') {
    console.warn(
      '[theme/applyTheme] auto=true несовместим с themeId=sepia: ' +
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
}
