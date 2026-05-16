// applyTheme — синхронная функция, применяющая theme/auto к UnistylesRuntime.
// Вынесена в отдельный модуль чтобы избежать циклической зависимости
// settingsStore ↔ bridge (store.setTheme вызывает applyTheme; bridge тоже
// вызывает applyTheme при подписке на стор для persist-rehydration).
import { UnistylesRuntime } from 'react-native-unistyles';
import type { ThemeId } from '@/types/settings';

/**
 * BUG-FIX (react-native-unistyles issue #1179 в v3.2.4):
 *   `setAdaptiveThemes(false)` + `setTheme(id)` подряд в одном JS-тике
 *   race-condition с ShadowTreeManager на iOS. Симптом — тема применяется
 *   с отставанием на один шаг (нажал Day → видишь Sepia bg, нажал Sepia →
 *   видишь Night bg и т.д., классическая 3-way rotation).
 *
 *   Workaround: НЕ вызывать setAdaptiveThemes на каждый setTheme.
 *   adaptiveThemes:false — это уже дефолт из StyleSheet.configure()
 *   (см. settings:{adaptiveThemes:false} в theme/unistyles.ts), поэтому
 *   нет смысла повторять. Вызываем setAdaptiveThemes ТОЛЬКО при изменении
 *   auto-флага (через module-level кэш `lastAuto`).
 *
 * C2: auto + sepia. Adaptive themes умеет переключать только light↔dark по
 *   colorScheme устройства, sepia не учитывается. Если пользователь выбрал
 *   sepia и при этом включил auto — смысловой конфликт. Решение: при
 *   id === 'sepia' принудительно отключаем adaptiveThemes и применяем sepia
 *   как фиксированную тему.
 */
let lastAuto: boolean | null = null;

export function applyTheme(id: ThemeId, auto: boolean): void {
  if (auto && id === 'sepia') {
    console.warn(
      '[theme/applyTheme] auto=true несовместим с themeId=sepia: ' +
        'adaptiveThemes отключаются, применяется sepia как fixed theme.',
    );
    if (lastAuto !== false) {
      UnistylesRuntime.setAdaptiveThemes(false);
      lastAuto = false;
    }
    UnistylesRuntime.setTheme('sepia');
    return;
  }
  if (auto) {
    if (lastAuto !== true) {
      UnistylesRuntime.setAdaptiveThemes(true);
      lastAuto = true;
    }
    return;
  }
  if (lastAuto !== false) {
    UnistylesRuntime.setAdaptiveThemes(false);
    lastAuto = false;
  }
  UnistylesRuntime.setTheme(id);
}
