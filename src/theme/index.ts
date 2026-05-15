// M6: side-effect-импорт ДО реэкспортов (import/first lint rule).
// unistyles читает useSettingsStore.getState() и вызывает StyleSheet.configure;
// это должно произойти до того, как любой компонент попробует получить тему.
import './unistyles';

export * from './tokens';
export * from './scripts';
export * from './bridge';
