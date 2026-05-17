import { useSettingsStore } from '@/stores/settingsStore';
import { DEFAULT_SETTINGS } from '@/types/settings';

describe('settingsStore', () => {
  beforeEach(() => useSettingsStore.getState().reset());

  test('initial state equals DEFAULT_SETTINGS', () => {
    const s = useSettingsStore.getState();
    expect(s.themeId).toBe(DEFAULT_SETTINGS.themeId);
    expect(s.fontSize).toBe(DEFAULT_SETTINGS.fontSize);
    expect(s.highlightUnknown).toBe(DEFAULT_SETTINGS.highlightUnknown);
  });

  test('setTheme', () => {
    useSettingsStore.getState().setTheme('sepia', false);
    expect(useSettingsStore.getState().themeId).toBe('sepia');
    useSettingsStore.getState().setTheme('dark', true);
    expect(useSettingsStore.getState().themeAuto).toBe(true);
  });

  test('setFontSize clamp low', () => {
    useSettingsStore.getState().setFontSize(10);
    expect(useSettingsStore.getState().fontSize).toBe(15);
  });
  test('setFontSize clamp high', () => {
    useSettingsStore.getState().setFontSize(40);
    expect(useSettingsStore.getState().fontSize).toBe(26);
  });
  test('setFontSize in range', () => {
    useSettingsStore.getState().setFontSize(20);
    expect(useSettingsStore.getState().fontSize).toBe(20);
  });
  test('setReadingSessionGoalMinutes clamp', () => {
    useSettingsStore.getState().setReadingSessionGoalMinutes(1);
    expect(useSettingsStore.getState().readingSessionGoalMinutes).toBe(5);
    useSettingsStore.getState().setReadingSessionGoalMinutes(500);
    expect(useSettingsStore.getState().readingSessionGoalMinutes).toBe(120);
  });

  test.each([
    'toggleHighlightUnknown','toggleShowSentenceTranslation','togglePageFlipAnim',
    'toggleShowPhonetics','toggleLookupHistoryEnabled',
  ] as const)('%s toggles', (action) => {
    const key = action.replace(/^toggle/,'').replace(/^./, c => c.toLowerCase()) as keyof ReturnType<typeof useSettingsStore.getState>;
    const before = (useSettingsStore.getState() as any)[key];
    (useSettingsStore.getState() as any)[action]();
    expect((useSettingsStore.getState() as any)[key]).toBe(!before);
  });

  test('completeOnboarding', () => {
    expect(useSettingsStore.getState().onboardingCompleted).toBe(false);
    useSettingsStore.getState().completeOnboarding();
    expect(useSettingsStore.getState().onboardingCompleted).toBe(true);
  });

  test('language setters', () => {
    useSettingsStore.getState().setUiLanguage('ru');
    useSettingsStore.getState().setNativeLanguage('en');
    useSettingsStore.getState().setBookLanguage('ja');
    const s = useSettingsStore.getState();
    expect(s.uiLanguage).toBe('ru');
    expect(s.nativeLanguage).toBe('en');
    expect(s.bookLanguage).toBe('ja');
  });

  test('setFontFamilyMode', () => {
    useSettingsStore.getState().setFontFamilyMode('sans');
    expect(useSettingsStore.getState().fontFamilyMode).toBe('sans');
  });
  test('setScrollMode', () => {
    useSettingsStore.getState().setScrollMode('page');
    expect(useSettingsStore.getState().scrollMode).toBe('page');
  });
  test('setBookLanguageLevel', () => {
    useSettingsStore.getState().setBookLanguageLevel('B2');
    expect(useSettingsStore.getState().bookLanguageLevel).toBe('B2');
  });
  test('setTapToTranslateBehavior', () => {
    useSettingsStore.getState().setTapToTranslateBehavior('delay');
    expect(useSettingsStore.getState().tapToTranslateBehavior).toBe('delay');
  });
  test('setAutoAddToDeck', () => {
    useSettingsStore.getState().setAutoAddToDeck('always');
    expect(useSettingsStore.getState().autoAddToDeck).toBe('always');
  });
  test('reset', () => {
    useSettingsStore.getState().setTheme('dark', true);
    useSettingsStore.getState().setFontSize(25);
    useSettingsStore.getState().completeOnboarding();
    useSettingsStore.getState().reset();
    const s = useSettingsStore.getState();
    expect(s.themeId).toBe(DEFAULT_SETTINGS.themeId);
    expect(s.fontSize).toBe(DEFAULT_SETTINGS.fontSize);
    expect(s.onboardingCompleted).toBe(DEFAULT_SETTINGS.onboardingCompleted);
  });
});
