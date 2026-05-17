import { shallow } from 'zustand/shallow';
import { useSettingsStore } from '@/stores/settingsStore';
import { applyTheme } from './applyTheme';

/**
 * Подписка Settings → UnistylesRuntime.
 * Возвращает unsubscribe — обязательно вызывать в cleanup useEffect.
 * Threading: JS thread only, не из Reanimated worklet.
 *
 * Используется как fallback для случаев, когда settings меняются НЕ через
 * action (persist-rehydration, внешние мутации стора). Основное применение
 * темы идёт через прямой вызов applyTheme внутри setTheme action — это
 * устраняет race-condition в порядке Zustand notify (бридж атачится в
 * useEffect корневого _layout, который запускается ПОСЛЕ useEffect детей,
 * → бридж оказывается в конце списка подписчиков и срабатывает после того,
 * как Settings/PhoneShell уже re-render с новым themeId).
 *
 * C1: `equalityFn: shallow` — селектор возвращает новый объект каждый вызов,
 *     без shallow listener срабатывал бы на КАЖДОЕ изменение settings,
 *     а не только при смене themeId/themeAuto.
 */
export function attachThemeBridge(): () => void {
  return useSettingsStore.subscribe(
    (s) => ({ id: s.themeId, auto: s.themeAuto }),
    ({ id, auto }) => applyTheme(id, auto),
    { equalityFn: shallow, fireImmediately: true },
  );
}
