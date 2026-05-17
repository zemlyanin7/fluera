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
// Инициализация: configure() задаёт adaptiveThemes:false по умолчанию,
// поэтому стартовое значение — false. Это позволяет ПЕРВОМУ вызову
// applyTheme(*, false) сразу пропустить setAdaptiveThemes и не словить
// race-condition на самом первом переключении.
let lastAuto: boolean = false;

export function applyTheme(id: ThemeId, auto: boolean): void {
  if (auto && id === 'sepia') {
    console.warn(
      '[theme/applyTheme] auto=true несовместим с themeId=sepia: ' +
        'adaptiveThemes отключаются, применяется sepia как fixed theme.',
    );
    if (lastAuto) {
      UnistylesRuntime.setAdaptiveThemes(false);
      lastAuto = false;
    }
    UnistylesRuntime.setTheme('sepia');
    return;
  }
  if (auto) {
    if (!lastAuto) {
      UnistylesRuntime.setAdaptiveThemes(true);
      lastAuto = true;
    }
    return;
  }
  if (lastAuto) {
    UnistylesRuntime.setAdaptiveThemes(false);
    lastAuto = false;
  }
  // requestAnimationFrame — workaround #1179: даём ShadowTreeManager
  // отдельный кадр для применения, чтобы избежать race с React-рендером
  // и обновить styles, закэшированные в StyleSheet.create. Без rAF
  // только компоненты с inline useUnistyles().theme обновлялись на iOS.
  requestAnimationFrame(() => UnistylesRuntime.setTheme(id));
}

/**
 * Синхронный вариант applyTheme БЕЗ requestAnimationFrame. Используется
 * ТОЛЬКО в onRehydrateStorage cold-start callback (см. §6.3 спеки): на этой
 * стадии React tree ещё не отрисован, ShadowTreeManager race из issue #1179
 * не возникает, а rAF мог бы отстрелить ПОСЛЕ splash.hideAsync() и дать
 * flash светлой темы.
 */
export function applyThemeImmediate(id: ThemeId, auto: boolean): void {
  if (auto && id === 'sepia') {
    if (lastAuto) {
      UnistylesRuntime.setAdaptiveThemes(false);
      lastAuto = false;
    }
    UnistylesRuntime.setTheme('sepia');
    return;
  }
  if (auto) {
    if (!lastAuto) {
      UnistylesRuntime.setAdaptiveThemes(true);
      lastAuto = true;
    }
    return;
  }
  if (lastAuto) {
    UnistylesRuntime.setAdaptiveThemes(false);
    lastAuto = false;
  }
  UnistylesRuntime.setTheme(id);
}
