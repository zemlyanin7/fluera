// Изолируем jest-state — каждый test очищает AsyncStorage перед запуском.
// Сам useSettingsStore singleton, и persist hydrate уже произошёл во время
// импорта — это OK для smoke-теста allowlist'а и rehydrate flow.
import AsyncStorage from '@react-native-async-storage/async-storage';

const STORAGE_KEY = 'fluera-settings-v1';
const FORBIDDEN_KEYWORDS = /token|auth|password|secret|opds.*cred/i;

describe('settingsStore persist', () => {
  beforeEach(async () => {
    await AsyncStorage.clear();
  });

  test('persist key — fluera-settings-v1', async () => {
    const { useSettingsStore } = require('@/stores/settingsStore');
    useSettingsStore.getState().setTheme('dark');
    await new Promise((r) => setTimeout(r, 50));
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    expect(raw).not.toBeNull();
    const parsed = JSON.parse(raw!);
    expect(parsed.state.themeId).toBe('dark');
    expect(parsed.version).toBe(2);
  });

  test('partialize: только allowlist в storage, ни одного credential', async () => {
    const { useSettingsStore } = require('@/stores/settingsStore');
    useSettingsStore.getState().setTheme('sepia');
    await new Promise((r) => setTimeout(r, 50));
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    const parsed = JSON.parse(raw!);
    const keys = Object.keys(parsed.state);
    keys.forEach((k) => expect(k).not.toMatch(FORBIDDEN_KEYWORDS));
  });

  test('hasHydrated API доступно', async () => {
    const { useSettingsStore } = require('@/stores/settingsStore');
    expect(typeof useSettingsStore.persist.hasHydrated).toBe('function');
    // В jest persist hydrate выполняется async — но к моменту import уже завершён
    expect(useSettingsStore.persist.hasHydrated()).toBe(true);
  });

  test('persist пишет 25 поля allowlist (не больше) — 18 baseline + 6 для #4.5 (sentence translation gesture, MWE/FF/register, popupHintsSeen, readingMode) + 1 для #4.5.1 (savedToDeckHintShown)', async () => {
    const { useSettingsStore } = require('@/stores/settingsStore');
    useSettingsStore.getState().setFontSize(20);
    await new Promise((r) => setTimeout(r, 50));
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    const parsed = JSON.parse(raw!);
    expect(Object.keys(parsed.state).length).toBe(25);
  });
});
